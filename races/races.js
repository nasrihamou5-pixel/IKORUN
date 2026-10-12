/* ============================================================================
   IKORUN — CALENDRIER DES COURSES ALGÉRIENNES (V4.0.0, chargé par ikLoad('races'))
   ----------------------------------------------------------------------------
   · Écran Courses : liste (groupée par mois) ou calendrier, filtres (distance,
     type, wilaya), recherche sans accents ; hors ligne : dernière liste reçue.
   · Fiche d'une course : infos, carte (OpenStreetMap, affichée sur demande),
     inscription, météo du jour J (Open-Meteo, 16 jours avant), « Préparer cette
     course », rappels J-30 / J-7 / veille, export .ics, partage.
   · Propositions des coureurs et des clubs (validées par un admin).
   · Admin : propositions, dates contradictoires, ajout / modification, import
     CSV ou JSON (saison de cross FAA…) avec aperçu et dédoublonnage côté serveur.
   Données : table races (lecture publique) ; écriture uniquement par les fonctions
   ikorun_race_* (voir supabase/migrations/20261012130000_races.sql).
   Aucune donnée n'est inventée : la liste ne contient que ce qu'un admin a saisi,
   importé ou validé.
   ============================================================================ */
(function(){
  const CACHE='ik_races_v1', STALE=6*3600*1000;
  const KINDS=['route','cross','trail','piste','ultra','marche','autre'];
  const DIST=[['all'],['short',r=>r.distances&&r.distances.some(k=>k<=10.5)],['semi',r=>r.distances&&r.distances.some(k=>k>=20.5&&k<=22)],
    ['marathon',r=>r.distances&&r.distances.some(k=>k>=42&&k<=43)],['trail',r=>r.kind==='trail'||r.kind==='ultra'],['cross',r=>r.kind==='cross']];
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const RC={list:null,ts:0,busy:null,err:false,f:{q:'',dist:'all',wil:0,past:false},view:'list',month:null,day:null,pick:null,admin:null};
  const sb=()=>window.supabaseClient||null;
  const E=s=>escHtml(s==null?'':String(s));
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’'`-]/g,' ');
  const wilName=n=>{ const w=(typeof WILAYAS!=='undefined'?WILAYAS:[]).find(x=>x[0]===+n); return w?w[1]:''; };
  const fmtKm=k=>(k>=42&&k<=42.3)?t('rcMarathon'):(k>=21&&k<=21.2)?t('rcSemi'):fmtKmShort(k)+' km';
  const dLong=k=>ikDate(new Date(k+'T12:00:00'),'{weekday:long,day:numeric,month:long,year:numeric}',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const dShort=k=>ikDate(new Date(k+'T12:00:00'),'{day:numeric,month:short}',{day:'numeric',month:'short'});
  const monthLab=ym=>ikDate(new Date(ym+'-15T12:00:00'),'{month:long,year:numeric}',{month:'long',year:'numeric'});
  const safeUrl=u=>/^https?:\/\/[^\s<>"']+$/.test(u||'')?u:'';
  const extA=(u,lab,cls)=>{ const s=safeUrl(u); return s?'<a class="'+(cls||'btn ghost sm')+'" href="'+E(s)+'" target="_blank" rel="noopener noreferrer">'+lab+'</a>':''; };

  /* ---------- données ---------- */
  function readCache(){ try{ const v=JSON.parse(localStorage.getItem(CACHE)||'null'); if(v&&Array.isArray(v.list)){ RC.list=v.list; RC.ts=v.ts||0; } }catch(e){} }
  function clean(r){
    // ce qui vient du serveur est déjà contrôlé ; on refait le minimum avant tout affichage
    if(!r||!UUID.test(r.id||'')||!/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')) return null;
    const d=Array.isArray(r.distances)?r.distances.map(Number).filter(x=>isFinite(x)&&x>0).slice(0,8):[];
    return {id:r.id,name:String(r.name||'').slice(0,140),date:r.date,date_end:/^\d{4}-\d{2}-\d{2}$/.test(r.date_end||'')?r.date_end:null,
      start_time:/^\d{2}:\d{2}/.test(r.start_time||'')?r.start_time.slice(0,5):null,city:String(r.city||'').slice(0,80),wilaya:+r.wilaya||null,
      lat:isFinite(+r.lat)&&r.lat!==null?+r.lat:null,lon:isFinite(+r.lon)&&r.lon!==null?+r.lon:null,kind:KINDS.includes(r.kind)?r.kind:'autre',distances:d,
      organizer:r.organizer?String(r.organizer).slice(0,120):'',url:safeUrl(r.url),reg_url:safeUrl(r.reg_url),description:r.description?String(r.description).slice(0,1500):'',
      source:r.source||'admin',source_url:safeUrl(r.source_url),status:['published','cancelled','postponed'].includes(r.status)?r.status:'published',
      date_conflict:!!r.date_conflict,conflict_note:r.conflict_note?String(r.conflict_note).slice(0,500):''};
  }
  function load(force){
    if(!RC.list) readCache();
    if(RC.busy) return RC.busy;
    if(!force && RC.list && Date.now()-RC.ts<STALE) return Promise.resolve(RC.list);
    const c=sb(); if(!c || !navigator.onLine){ RC.err=!RC.list; return Promise.resolve(RC.list||[]); }
    const since=adKeyAdd(todayKey(),-60);
    RC.busy=Promise.resolve(c.from('races').select('id,name,date,date_end,start_time,city,wilaya,lat,lon,kind,distances,organizer,url,reg_url,description,source,source_url,status,date_conflict,conflict_note')
      .gte('date',since).order('date',{ascending:true}).limit(1000))
      .then(res=>{ if(res.error) throw res.error; RC.list=(res.data||[]).map(clean).filter(Boolean); RC.ts=Date.now(); RC.err=false;
        try{ localStorage.setItem(CACHE,JSON.stringify({ts:RC.ts,list:RC.list})); }catch(e){}
        syncFollows(); return RC.list; })
      .catch(e=>{ console.warn('[IKORUN] courses',e&&e.message); RC.err=!RC.list; return RC.list||[]; })
      .finally(()=>{ RC.busy=null; });
    return RC.busy;
  }
  // Une course suivie a changé de date ou de nom (correction d'un admin) : la copie locale suit.
  function syncFollows(){
    const f=raceFollows(); if(!f.length) return; let ch=false;
    f.forEach(x=>{ const r=RC.list.find(y=>y.id===x.id); if(r && (r.date!==x.date||r.name!==x.name)){ x.date=r.date; x.name=r.name; x.city=r.city; ch=true; } });
    if(ch){ P.raceFollows=f; DB.save('profile',P); }
  }
  function isAdmin(){
    if(RC.admin!==null) return Promise.resolve(RC.admin);
    const c=sb(), uid=window.currentUserId; if(!c||!uid||window.isGuestUser){ RC.admin=false; return Promise.resolve(false); }
    return Promise.resolve(c.from('app_admins').select('user_id').eq('user_id',uid).maybeSingle())
      .then(r=>{ RC.admin=!!(r&&r.data); return RC.admin; }).catch(()=>false);
  }
  window.racesAdminState=()=>RC.admin;
  function byId(id){ return (RC.list||[]).find(r=>r.id===id)||null; }

  /* ---------- filtres ---------- */
  function filtered(){
    const tk=todayKey(), q=norm(RC.f.q).trim(), words=q?q.split(/\s+/):[], dist=DIST.find(d=>d[0]===RC.f.dist);
    return (RC.list||[]).filter(r=>{
      if(!RC.f.past && (r.date_end||r.date)<tk) return false;
      if(RC.f.past && (r.date_end||r.date)>=tk) return false;
      if(RC.f.wil && r.wilaya!==RC.f.wil) return false;
      if(dist && dist[1] && !dist[1](r)) return false;
      if(words.length){ const hay=norm(r.name+' '+r.city+' '+wilName(r.wilaya)+' '+(r.organizer||'')); if(!words.every(w=>hay.includes(w))) return false; }
      return true;
    }).sort((a,b)=>RC.f.past?(a.date<b.date?1:-1):(a.date<b.date?-1:1));
  }

  /* ---------- écran Courses ---------- */
  window.racesOpen=function(opts){
    RC.pick=opts&&opts.pick||null;
    if(!RC.month) RC.month=todayKey().slice(0,7);
    openOv('ovRaces'); $('#ovRacesTitle').textContent=t(RC.pick?'rcPickTitle':'racesTitle');
    readCache(); paint();
    load(false).then(paint);
    isAdmin().then(a=>{ if(a){ paint(); if(opts&&opts.admin) window.raceAdminOpen('prop'); } });
    try{ if(typeof ikTrack==='function') ikTrack('races_open',{pick:RC.pick||''}); }catch(e){}
  };
  function chip(lab,on,js){ return '<button type="button" class="sh-chip'+(on?' on':'')+'" aria-pressed="'+on+'" onclick="'+js+'">'+lab+'</button>'; }
  function paint(){
    const body=$('#racesBody'); if(!body) return;
    const keepQ=document.activeElement&&document.activeElement.id==='rcQ';
    let h='';
    if(RC.pick) h+='<div class="rc-pickbar">'+ICN('flag',15)+' '+t('rcPickHint')+'</div>';
    h+='<div class="rc-search"><span aria-hidden="true">'+ICN('search',16)+'</span><input id="rcQ" type="search" enterkeyhint="search" autocomplete="off" placeholder="'+E(t('rcSearchPh'))+'" aria-label="'+E(t('rcSearchPh'))+'" value="'+E(RC.f.q)+'" oninput="racesSearch(this.value)"></div>';
    h+='<div class="seg-ctrl rc-seg"><div class="seg-btn'+(RC.view==='list'?' on':'')+'" role="button" tabindex="0" onclick="racesView(\'list\')">'+t('rcViewList')+'</div><div class="seg-btn'+(RC.view==='cal'?' on':'')+'" role="button" tabindex="0" onclick="racesView(\'cal\')">'+t('rcViewCal')+'</div></div>';
    h+='<div class="sh-row rc-filters">'+DIST.map(d=>chip(t('rcDist_'+d[0]),RC.f.dist===d[0],'racesFilter(\'dist\',\''+d[0]+'\')')).join('')+'</div>';
    h+='<div class="rc-row2"><select class="ps-select rc-wil" aria-label="'+E(t('rcWilaya'))+'" onchange="racesFilter(\'wil\',+this.value)"><option value="0">'+E(t('rcAllWilayas'))+'</option>'+
      (typeof WILAYAS!=='undefined'?WILAYAS:[]).map(w=>'<option value="'+w[0]+'"'+(RC.f.wil===w[0]?' selected':'')+'>'+String(w[0]).padStart(2,'0')+' · '+E(w[1])+'</option>').join('')+'</select>'+
      (RC.view==='list'?chip(t('rcPast'),RC.f.past,'racesFilter(\'past\','+(!RC.f.past)+')'):'')+'</div>';
    h+='<div id="rcRes" aria-live="polite">'+resultsHTML()+'</div>';
    h+='<div class="rc-foot">';
    if(!RC.pick) h+='<button type="button" class="btn ghost" onclick="raceProposeOpen()">'+ICN('plus',16)+' '+t('rcPropose')+'</button>';
    if(RC.admin) h+='<button type="button" class="btn ghost" onclick="raceAdminOpen()">'+ICN('gear',16)+' '+t('rcAdmin')+'</button>';
    h+='<p class="ad-foot">'+t('rcSourcesNote')+'</p></div>';
    body.innerHTML=h;
    if(keepQ){ const q=$('#rcQ'); if(q){ q.focus(); try{ q.setSelectionRange(q.value.length,q.value.length); }catch(e){} } }
  }
  function resultsHTML(){
    if(!RC.list) return RC.busy||navigator.onLine?'<div class="rc-empty">'+t('rcLoading')+'</div>':'<div class="rc-empty">'+t('rcOfflineEmpty')+'</div>';
    if(RC.view==='cal') return calHTML();
    const list=filtered();
    let h=RC.err?'<div class="rc-note">'+t('rcOfflineCache')+'</div>':'';
    if(!list.length){
      const any=(RC.list||[]).length;
      return h+'<div class="rc-empty"><b>'+t(any?'rcNoMatch':'rcEmptyTitle')+'</b><span>'+t(any?'rcNoMatchSub':'rcEmptySub')+'</span></div>';
    }
    let cur='';
    list.forEach(r=>{ const ym=r.date.slice(0,7); if(ym!==cur){ cur=ym; h+='<div class="rc-month">'+E(monthLab(ym))+'</div>'; } h+=rowHTML(r); });
    return h;
  }
  function rowHTML(r){
    const n=raceDaysTo(r.date), d=new Date(r.date+'T12:00:00');
    const tags=(r.distances||[]).slice(0,4).map(k=>'<span class="rc-tag">'+E(fmtKm(k))+'</span>').join('')+(r.kind!=='route'?'<span class="rc-tag k">'+t('rcKind_'+r.kind)+'</span>':'');
    const flag=r.status!=='published'?'<span class="rc-st '+r.status+'">'+t('rcSt_'+r.status)+'</span>':r.date_conflict?'<span class="rc-st warn">'+t('rcDateToConfirm')+'</span>':'';
    return '<button type="button" class="rc-item'+(r.status==='cancelled'?' off':'')+'" onclick="raceTap(\''+r.id+'\')">'+
      '<span class="rc-date" aria-hidden="true"><b>'+E(ikDate(d,'{day:numeric}',{day:'numeric'}))+'</b><small>'+E(ikDate(d,'mo',{month:'short'}).replace('.',''))+'</small></span>'+
      '<span class="rc-main"><b dir="auto">'+E(r.name)+'</b><small>'+E(r.city)+(r.wilaya&&wilName(r.wilaya)!==r.city?' · '+E(wilName(r.wilaya)):'')+(n>=0&&n<=60?' · '+(n===0?t('raceToday'):tp('raceInDays',n)):'')+'</small>'+
      (tags||flag?'<span class="rc-tags">'+flag+tags+'</span>':'')+'</span>'+
      (raceIsFollowed(r.id)?'<span class="rc-fol" title="'+E(t('rcFollowing'))+'">'+ICN('bell',14)+'</span>':'')+'</button>';
  }
  /* calendrier du mois : lundi en premier, points sur les jours de course */
  function calHTML(){
    const ym=RC.month, [y,m]=ym.split('-').map(Number), first=new Date(y,m-1,1), days=new Date(y,m,0).getDate(), lead=(first.getDay()+6)%7, tk=todayKey();
    const dist=DIST.find(d=>d[0]===RC.f.dist), all=(RC.list||[]).filter(r=>(!RC.f.wil||r.wilaya===RC.f.wil)&&(!dist||!dist[1]||dist[1](r))&&(!RC.f.q||norm(r.name+' '+r.city).includes(norm(RC.f.q).trim())));
    const on={}; all.forEach(r=>{ let k=r.date; const e=r.date_end||r.date; for(let i=0;i<7&&k<=e;i++){ if(k.slice(0,7)===ym) (on[k]=on[k]||[]).push(r); k=adKeyAdd(k,1); } });
    const wd=[0,1,2,3,4,5,6].map(i=>ikDate(new Date(2023,0,2+i),'{weekday:narrow}',{weekday:'narrow'}));
    let h='<div class="rc-cal"><div class="rc-cal-h"><button type="button" class="x" aria-label="'+E(t('rcPrevMonth'))+'" onclick="racesMonth(-1)">‹</button><b>'+E(monthLab(ym))+'</b><button type="button" class="x" aria-label="'+E(t('rcNextMonth'))+'" onclick="racesMonth(1)">›</button></div>';
    h+='<div class="rc-grid">'+wd.map(x=>'<span class="rc-wd">'+E(x)+'</span>').join('');
    for(let i=0;i<lead;i++) h+='<span></span>';
    for(let d=1;d<=days;d++){ const k=ym+'-'+String(d).padStart(2,'0'), n=(on[k]||[]).length;
      h+='<button type="button" class="rc-day'+(k===tk?' today':'')+(n?' has':'')+(RC.day===k?' sel':'')+'" '+(n?'onclick="racesDay(\''+k+'\')" aria-label="'+E(dLong(k)+' · '+tp('rcCountRaces',n))+'"':'tabindex="-1" aria-hidden="true"')+'>'+d+(n?'<i>'+(n>1?n:'')+'</i>':'')+'</button>'; }
    h+='</div></div>';
    const sel=RC.day&&RC.day.slice(0,7)===ym?(on[RC.day]||[]):null;
    if(sel&&sel.length) h+='<div class="rc-month">'+E(dLong(RC.day))+'</div>'+sel.map(rowHTML).join('');
    else { const mon=all.filter(r=>r.date.slice(0,7)===ym).sort((a,b)=>a.date<b.date?-1:1);
      h+=mon.length?mon.map(rowHTML).join(''):'<div class="rc-empty"><span>'+t((RC.list||[]).length?'rcNoneThisMonth':'rcEmptySub')+'</span></div>'; }
    return h;
  }
  let _qT=0;
  window.racesSearch=function(v){ RC.f.q=String(v||'').slice(0,60); clearTimeout(_qT); _qT=setTimeout(()=>{ const el=$('#rcRes'); if(el) el.innerHTML=resultsHTML(); },120); };
  window.racesFilter=function(k,v){ RC.f[k]=v; RC.day=null; paint(); haptic(); };
  window.racesView=function(v){ RC.view=v; paint(); };
  window.racesMonth=function(d){ const [y,m]=RC.month.split('-').map(Number), x=new Date(y,m-1+d,1); RC.month=x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0'); RC.day=null; const el=$('#rcRes'); if(el) el.innerHTML=resultsHTML(); };
  window.racesDay=function(k){ RC.day=RC.day===k?null:k; const el=$('#rcRes'); if(el) el.innerHTML=resultsHTML(); };
  window.raceTap=function(id){ if(RC.pick) return racePick(id); window.raceOpen(id); };

  /* ---------- choix d'une course (inscription, configuration du plan) ---------- */
  function racePick(id){
    const r=byId(id); if(!r) return;
    if(r.status==='cancelled'){ toast(t('rcSt_cancelled')); return; }
    if(r.distances.length>1) return distChooser(r,km=>pickDone(r,km));
    pickDone(r,r.distances[0]||0);
  }
  function pickDone(r,km){
    const mode=RC.pick; RC.pick=null; closeOv('ovRaces');
    if(mode==='onboarding') racePickedForOnboarding(r,km);
    else if(mode==='plan') racePickedForPlan(r,km);
  }
  function distChooser(r,cb){
    window._rcDistCb=cb;
    openOv('ovRace'); $('#ovRaceTitle').textContent=t('rcWhichDist');
    $('#raceBody').innerHTML='<p class="rc-lead" dir="auto">'+E(r.name)+'</p><div class="rc-dists">'+r.distances.map(k=>'<button type="button" class="btn ghost" onclick="raceDistChosen('+k+')">'+E(fmtKm(k))+'</button>').join('')+'</div>';
  }
  window.raceDistChosen=function(k){ const cb=window._rcDistCb; window._rcDistCb=null; closeOv('ovRace'); if(cb) cb(+k); };

  /* ---------- fiche d'une course ---------- */
  window.raceOpen=function(id){
    readCache();
    const show=()=>{ const r=byId(id); if(!r){ toast(t('rcNotFound')); return; } paintRace(r); };
    openOv('ovRace'); $('#ovRaceTitle').textContent=t('rcRaceTitle');
    if(byId(id)) show(); else { $('#raceBody').innerHTML='<div class="rc-empty">'+t('rcLoading')+'</div>'; load(true).then(show); }
    isAdmin().then(a=>{ if(a && byId(id) && $('#ovRace').classList.contains('on')) paintRace(byId(id)); });
  };
  function mapCoords(r){ if(r.lat!=null&&r.lon!=null) return {lat:r.lat,lon:r.lon,approx:false}; const w=(typeof WILAYAS!=='undefined'?WILAYAS:[]).find(x=>x[0]===r.wilaya); return w?{lat:w[2],lon:w[3],approx:true}:null; }
  function mapsUrl(r,c){
    const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    if(c&&!c.approx) return ios?'https://maps.apple.com/?ll='+c.lat+','+c.lon+'&q='+encodeURIComponent(r.name):'https://www.google.com/maps/search/?api=1&query='+c.lat+','+c.lon;
    const q=encodeURIComponent(r.city+', '+(wilName(r.wilaya)||'')+', Algérie');
    return ios?'https://maps.apple.com/?q='+q:'https://www.google.com/maps/search/?api=1&query='+q;
  }
  function paintRace(r){
    const n=raceDaysTo(r.date), fol=raceIsFollowed(r.id), c=mapCoords(r), past=(r.date_end||r.date)<todayKey();
    let h='<div class="rc-hero"><div class="rc-hero-k">'+t('rcKind_'+r.kind)+'</div><h3 dir="auto">'+E(r.name)+'</h3>'+
      '<div class="rc-hero-d">'+E(dLong(r.date))+(r.date_end&&r.date_end!==r.date?' – '+E(dLong(r.date_end)):'')+(r.start_time?' · <bdi dir="ltr">'+E(r.start_time)+'</bdi>':'')+'</div>'+
      '<div class="rc-hero-c">'+(past?t('rcPastRace'):n===0?t('raceToday'):n===1?t('raceTomorrow'):tp('raceInDays',n))+'</div></div>';
    if(r.status!=='published') h+='<div class="rc-alert '+r.status+'">'+ICN('warning',16)+' '+t('rcSt_'+r.status+'_long')+'</div>';
    if(r.date_conflict) h+='<div class="rc-alert warn">'+ICN('warning',16)+' '+t('rcConflictLong')+'</div>';
    h+='<div class="card rc-info">';
    h+=row('pin',t('rcPlace'),E(r.city)+(r.wilaya?' · '+E(wilName(r.wilaya))+' ('+String(r.wilaya).padStart(2,'0')+')':''));
    if(r.distances.length) h+=row('road',t('rcDistances'),'<span class="rc-tags">'+r.distances.map(k=>'<span class="rc-tag">'+E(fmtKm(k))+'</span>').join('')+'</span>');
    if(r.organizer) h+=row('users',t('rcOrganizer'),E(r.organizer));
    if(r.description) h+='<p class="rc-desc" dir="auto">'+E(r.description)+'</p>';
    h+='</div>';
    // actions principales
    h+='<div class="rc-acts">';
    if(!past && r.status!=='cancelled') h+='<button type="button" class="btn" onclick="racePrepareTap(\''+r.id+'\')">'+ICN('target',17)+' '+t('rcPrepare')+'</button>';
    if(!past && r.reg_url) h+=extA(r.reg_url,ICN('arrowRight',16)+' '+t('rcRegister'),'btn ghost');
    h+='</div><div class="rc-acts2">';
    if(!past) h+='<button type="button" class="btn ghost sm'+(fol?' on':'')+'" aria-pressed="'+fol+'" onclick="raceFollowTap(\''+r.id+'\')">'+ICN('bell',15)+' '+t(fol?'rcFollowing':'rcFollow')+'</button>';
    if(!past) h+='<button type="button" class="btn ghost sm" onclick="raceIcs(\''+r.id+'\')">'+ICN('calendar',15)+' '+t('rcAddCal')+'</button>';
    h+='<button type="button" class="btn ghost sm" onclick="raceShare(\''+r.id+'\')">'+ICN('share',15)+' '+t('share')+'</button>';
    if(r.url) h+=extA(r.url,ICN('globe',15)+' '+t('rcWebsite'));
    h+='</div>';
    if(!past) h+='<p class="ad-foot">'+t(fol?'rcFollowOnNote':'rcFollowNote')+'</p>';
    // météo du jour J
    if(!past) h+='<div class="db-sec">'+t('rcWeather')+'</div><div class="card rc-wx" id="rcWx">'+(n<=15?t('rcWxLoading'):tp('rcWxLater',dLong(adKeyAdd(r.date,-15))))+'</div>';
    // carte : affichée sur demande seulement (OpenStreetMap n'est contacté qu'à ce moment)
    if(c) h+='<div class="db-sec">'+t('rcMap')+'</div><div class="rc-map" id="rcMap"><button type="button" class="btn ghost sm" onclick="raceMapShow(\''+r.id+'\')">'+ICN('pin',15)+' '+t('rcShowMap')+'</button></div>'+
      (c.approx?'<p class="ad-foot">'+t('rcMapApprox')+'</p>':'');
    h+='<div class="rc-acts2">'+extA(mapsUrl(r,c),ICN('pin',15)+' '+t('rcOpenMaps'))+'</div>';
    if(r.source_url) h+='<p class="ad-foot">'+t('rcSource')+' : '+extA(r.source_url,E(r.source_url.replace(/^https?:\/\//,'').slice(0,48)),'rc-link')+'</p>';
    if(RC.admin) h+='<div class="db-sec">'+t('rcAdmin')+'</div><div class="rc-acts2"><button type="button" class="btn ghost sm" onclick="raceEdit(\''+r.id+'\')">'+ICN('edit',15)+' '+t('rcEdit')+'</button>'+
      (r.date_conflict?'<button type="button" class="btn ghost sm" onclick="raceResolve(\''+r.id+'\')">'+ICN('check',15)+' '+t('rcResolve')+'</button>':'')+
      '<button type="button" class="btn ghost sm danger" onclick="raceDelete(\''+r.id+'\')">'+ICN('trash',15)+' '+t('delete')+'</button></div>'+(r.conflict_note?'<p class="ad-foot">'+E(r.conflict_note)+'</p>':'');
    $('#ovRaceTitle').textContent=t('rcRaceTitle');
    $('#raceBody').innerHTML=h;
    const sc=$('#raceBody').closest('.ov-body-scroll'); if(sc) sc.scrollTop=0;
    if(!past && n<=15 && n>=0) raceWeather(r);
  }
  function row(ic,lab,val){ return '<div class="rc-r"><span class="rc-r-ic">'+ICN(ic,15)+'</span><span class="rc-r-l">'+lab+'</span><span class="rc-r-v">'+val+'</span></div>'; }
  window.racePrepareTap=function(id){
    const r=byId(id); if(!r) return;
    if(!getUserVDOT()){ toast(t('profileIncompleteAddTime')); return; }
    const go=km=>{ closeOv('ovRace'); closeOv('ovRaces'); racePrepare(r,km); };
    if(r.distances.length>1) return distChooser(r,go);
    go(r.distances[0]||0);
  };
  window.raceFollowTap=function(id){
    const r=byId(id); if(!r) return; const on=!raceIsFollowed(id);
    raceFollowSet(r,on); haptic(); toast(t(on?'rcFollowToast':'rcUnfollowToast'));
    if(on && window.currentUserId && typeof Notification!=='undefined' && Notification.permission==='default' && typeof notifPermBubbleHTML==='function') toast(t('rcFollowPushHint'));
    paintRace(r);
  };
  window.raceMapShow=function(id){
    const r=byId(id), c=r&&mapCoords(r), el=$('#rcMap'); if(!c||!el) return;
    const d=c.approx?0.25:0.012, bb=[c.lon-d,c.lat-d*0.7,c.lon+d,c.lat+d*0.7].map(x=>x.toFixed(5)).join(',');
    el.innerHTML='<iframe title="'+E(t('rcMap'))+'" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin" src="https://www.openstreetmap.org/export/embed.html?bbox='+bb+'&layer=mapnik'+(c.approx?'':'&marker='+c.lat.toFixed(5)+','+c.lon.toFixed(5))+'"></iframe>'+
      '<small class="rc-osm">© OpenStreetMap</small>';
  };
  // Météo du jour J à l'heure du départ (9 h si inconnue), au lieu de la course.
  const _wx={};
  function raceWeather(r){
    const c=mapCoords(r), el=()=>$('#rcWx'); if(!c){ if(el()) el().textContent=t('rcWxNoPlace'); return; }
    const h=r.start_time?+r.start_time.slice(0,2):9, key=r.id+'|'+r.date;
    const show=d=>{ const box=el(); if(!box) return; if(!d){ box.textContent=t('rcWxNone'); return; }
      const w=d, hc=heatCorr(w.t,w.dew), cond=typeof wxCondLabel==='function'?wxCondLabel(w):'';
      box.innerHTML='<div class="rc-wx-top"><b><bdi dir="ltr">'+Math.round(w.t)+'°</bdi></b><span>'+E(cond)+'<small>'+tp('rcWxAt',String(h).padStart(2,'0')+':00')+(c.approx?' · '+t('rcWxApprox'):'')+'</small></span></div>'+
        '<div class="rc-wx-row"><span>'+ICN('wind',14)+' <bdi dir="ltr">'+Math.round(w.wind||0)+' km/h</bdi></span><span>'+ICN('rain',14)+' <bdi dir="ltr">'+Math.round(w.pp||0)+' %</bdi></span>'+(w.feel!=null?'<span>'+t('rcWxFeel')+' <bdi dir="ltr">'+Math.round(w.feel)+'°</bdi></span>':'')+'</div>'+
        (hc.noHard?'<p class="rc-wx-adv bad">'+t('rcWxNoHard')+'</p>':hc.corr>=0.005?'<p class="rc-wx-adv">'+tp('rcWxHeat',fmt1(Math.round(hc.corr*1000)/10))+'</p>':'<p class="rc-wx-adv ok">'+t('rcWxFine')+'</p>')+
        '<p class="ad-foot">'+t('wxAttribution')+'</p>'; };
    const m=_wx[key]; if(m && Date.now()-m.ts<3*3600*1000) return show(m.d);
    if(!navigator.onLine){ if(el()) el().textContent=t('rcWxOffline'); return; }
    const u=WX_API+'?latitude='+c.lat+'&longitude='+c.lon+'&hourly=temperature_2m,apparent_temperature,dew_point_2m,precipitation_probability,weather_code,wind_speed_10m,is_day&timezone=auto&start_date='+r.date+'&end_date='+r.date+'&wind_speed_unit=kmh';
    fetch(u,{cache:'no-cache'}).then(x=>x.ok?x.json():null).then(j=>{
      const H=j&&j.hourly, i=H&&H.time?H.time.indexOf(r.date+'T'+String(h).padStart(2,'0')+':00'):-1;
      const d=i>=0?{t:H.temperature_2m[i],feel:H.apparent_temperature[i],dew:H.dew_point_2m[i],pp:H.precipitation_probability[i],code:H.weather_code[i],wind:H.wind_speed_10m[i],day:H.is_day[i]}:null;
      _wx[key]={ts:Date.now(),d}; show(d);
    }).catch(()=>{ if(el()) el().textContent=t('rcWxNone'); });
  }
  window.raceShare=function(id){
    const r=byId(id); if(!r) return;
    const url='https://ikorun.pages.dev/?open=race:'+r.id, text=r.name+' · '+dLong(r.date)+' · '+r.city;
    if(navigator.share) navigator.share({title:r.name,text,url}).catch(()=>{});
    else if(navigator.clipboard) navigator.clipboard.writeText(text+'\n'+url).then(()=>toast(t('rcLinkCopied'))).catch(()=>toast(url));
    else toast(url);
  };

  /* ---------- export .ics (rappels J-30, J-7, veille dans le calendrier du téléphone) ---------- */
  function icsEsc(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n'); }
  // Lignes de 75 octets au plus (RFC 5545) : on coupe sans casser un caractère UTF-8.
  function icsFold(line){
    const enc=new TextEncoder(); let out='', cur='', n=0;
    for(const ch of line){ const b=enc.encode(ch).length; if(n+b>(out?74:75)){ out+=(out?'\r\n ':'')+cur; cur=''; n=0; } cur+=ch; n+=b; }
    return out?out+'\r\n '+cur:cur;
  }
  function raceIcsText(r,now){
    const ymd=k=>k.replace(/-/g,''), stamp=(now||new Date()).toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
    const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//IKORUN//Courses en Algerie//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
    if(r.start_time) L.push('BEGIN:VTIMEZONE','TZID:Africa/Algiers','BEGIN:STANDARD','DTSTART:19700101T000000','TZOFFSETFROM:+0100','TZOFFSETTO:+0100','TZNAME:CET','END:STANDARD','END:VTIMEZONE');
    L.push('BEGIN:VEVENT','UID:'+r.id+'@ikorun.pages.dev','DTSTAMP:'+stamp);
    if(r.start_time){ const [hh,mm]=r.start_time.split(':').map(Number), e=new Date(Date.UTC(2000,0,1,hh+3,mm));
      L.push('DTSTART;TZID=Africa/Algiers:'+ymd(r.date)+'T'+String(hh).padStart(2,'0')+String(mm).padStart(2,'0')+'00',
             'DTEND;TZID=Africa/Algiers:'+ymd(e.getUTCDate()>1?adKeyAdd(r.date,1):r.date)+'T'+String(e.getUTCHours()).padStart(2,'0')+String(e.getUTCMinutes()).padStart(2,'0')+'00'); }
    else L.push('DTSTART;VALUE=DATE:'+ymd(r.date),'DTEND;VALUE=DATE:'+ymd(adKeyAdd(r.date_end||r.date,1)));
    const desc=[r.distances.length?t('rcDistances')+' : '+r.distances.map(fmtKm).join(', '):'',r.organizer?t('rcOrganizer')+' : '+r.organizer:'',r.reg_url?t('rcRegister')+' : '+r.reg_url:'',r.url||'','IKORUN · https://ikorun.pages.dev/?open=race:'+r.id].filter(Boolean).join('\n');
    L.push('SUMMARY:'+icsEsc(r.name),'LOCATION:'+icsEsc(r.city+(r.wilaya?', '+wilName(r.wilaya):'')+', Algérie'),'DESCRIPTION:'+icsEsc(desc));
    if(r.reg_url||r.url) L.push('URL:'+(r.reg_url||r.url));
    if(r.lat!=null&&r.lon!=null) L.push('GEO:'+r.lat.toFixed(5)+';'+r.lon.toFixed(5));
    if(r.status==='cancelled') L.push('STATUS:CANCELLED');
    // journée entière : rappels à 9 h (la veille à 9 h = 15 h avant minuit) ; avec heure : même heure
    const al=r.start_time?[['-P30D','rcIcsJ30'],['-P7D','rcIcsJ7'],['-P1D','rcIcsJ1']]:[['-P29DT15H','rcIcsJ30'],['-P6DT15H','rcIcsJ7'],['-PT15H','rcIcsJ1']];
    al.forEach(a=>L.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEsc(tp(a[1],r.name)),'TRIGGER:'+a[0],'END:VALARM'));
    L.push('END:VEVENT','END:VCALENDAR');
    return L.map(icsFold).join('\r\n')+'\r\n';
  }
  window.raceIcsText=raceIcsText;
  window.raceIcs=function(id){
    const r=byId(id); if(!r) return;
    const txt=raceIcsText(r), name='ikorun-'+r.date+'-'+norm(r.name).replace(/[^a-z0-9]+/g,'-').slice(0,40)+'.ics';
    const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    try{ if(typeof ikTrack==='function') ikTrack('race_ics',{}); }catch(e){}
    // iPhone : Safari ouvre directement « Ajouter au calendrier » sur un lien data: text/calendar
    if(ios){ location.href='data:text/calendar;charset=utf-8,'+encodeURIComponent(txt); return; }
    const url=URL.createObjectURL(new Blob([txt],{type:'text/calendar;charset=utf-8'})), a=document.createElement('a');
    a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000);
    toast(t('rcIcsSaved'));
  };

  /* ---------- formulaire (proposition et admin) ---------- */
  const ERRK={name:'rcErrName',date:'rcErrDate',date_end:'rcErrDateEnd',start_time:'rcErrTime',city:'rcErrCity',wilaya:'rcErrWilaya',coords:'rcErrCoords',kind:'rcErrKind',
    distances:'rcErrDist',url:'rcErrUrl',reg_url:'rcErrUrl',source_url:'rcErrUrl',organizer:'rcErrOrganizer',description:'rcErrDesc',format:'rcErrFormat',status:'rcErrFormat'};
  // Même contrôle que ikorun_race_check (serveur) : un code d'erreur ou null.
  function check(p){
    const dk=/^\d{4}-\d{2}-\d{2}$/, url=/^https?:\/\/[^\s<>"']+$/;
    if(!p||typeof p!=='object') return 'format';
    if(String(p.name||'').trim().length<3||String(p.name).trim().length>140) return 'name';
    if(!dk.test(p.date||'')||isNaN(new Date(p.date+'T12:00:00'))||p.date<'2020-01-01'||p.date>'2100-12-31') return 'date';
    if(p.date_end&&(!dk.test(p.date_end)||p.date_end<p.date)) return 'date_end';
    if(p.start_time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.start_time)) return 'start_time';
    if(String(p.city||'').trim().length<2||String(p.city).trim().length>80) return 'city';
    if(p.wilaya!=null&&p.wilaya!==''&&!(Number.isInteger(+p.wilaya)&&+p.wilaya>=1&&+p.wilaya<=58)) return 'wilaya';
    if((p.lat!=null&&p.lat!=='')||(p.lon!=null&&p.lon!=='')){ if(!(+p.lat>=18&&+p.lat<=38&&+p.lon>=-9&&+p.lon<=12.5)) return 'coords'; }
    if(p.kind&&!KINDS.includes(p.kind)) return 'kind';
    if(p.distances!=null){ if(!Array.isArray(p.distances)||p.distances.length>8||p.distances.some(k=>!(+k>=0.1&&+k<=400))) return 'distances'; }
    for(const k of ['url','reg_url','source_url']) if(p[k]&&(String(p[k]).length>300||!url.test(p[k]))) return k;
    if(String(p.organizer||'').length>120) return 'organizer';
    if(String(p.description||'').length>1500) return 'description';
    return null;
  }
  window.raceCheck=check;
  // « 10 ; 21,1 » → [10, 21.1]
  function parseDists(s){ const v=String(s||'').split(/[;|\/]+|\s{1,}|,(?=\s)/).map(x=>x.trim().replace(',','.').replace(/km$/i,'')).filter(Boolean); return v.length?v.map(Number):null; }
  window.raceParseDists=parseDists;
  function formHTML(r,mode){
    r=r||{};
    const f=(id,lab,inp,hint)=>'<label class="rc-f" for="'+id+'"><span>'+lab+'</span>'+inp+(hint?'<small>'+hint+'</small>':'')+'</label>';
    const txtI=(id,v,max,type,extra)=>'<input class="inp" id="'+id+'" type="'+(type||'text')+'" maxlength="'+max+'" value="'+E(v||'')+'"'+(['url','date','time'].includes(type)?' dir="ltr"':' dir="auto"')+(extra||'')+'>';
    let h='<div class="rc-form">';
    h+=f('rf_name',t('rcFName')+' *',txtI('rf_name',r.name,140,'text',' autocomplete="off"'));
    h+='<div class="rc-f2">'+f('rf_date',t('rcFDate')+' *',txtI('rf_date',r.date,10,'date'))+f('rf_time',t('rcFTime'),txtI('rf_time',r.start_time,5,'time'))+'</div>';
    h+=f('rf_end',t('rcFDateEnd'),txtI('rf_end',r.date_end,10,'date'),t('rcFDateEndHint'));
    h+='<div class="rc-f2">'+f('rf_city',t('rcFCity')+' *',txtI('rf_city',r.city,80))+f('rf_wil',t('rcWilaya'),'<select class="ps-select" id="rf_wil"><option value="">—</option>'+(typeof WILAYAS!=='undefined'?WILAYAS:[]).map(w=>'<option value="'+w[0]+'"'+(+r.wilaya===w[0]?' selected':'')+'>'+String(w[0]).padStart(2,'0')+' · '+E(w[1])+'</option>').join('')+'</select>')+'</div>';
    h+='<div class="rc-f2">'+f('rf_kind',t('rcFKind'),'<select class="ps-select" id="rf_kind">'+KINDS.map(k=>'<option value="'+k+'"'+((r.kind||'route')===k?' selected':'')+'>'+t('rcKind_'+k)+'</option>').join('')+'</select>')+
      f('rf_dist',t('rcFDist'),txtI('rf_dist',(r.distances||[]).map(k=>String(k).replace('.',',')).join(' ; '),60,'text',' inputmode="decimal"'),t('rcFDistHint'))+'</div>';
    h+=f('rf_org',t('rcOrganizer'),txtI('rf_org',r.organizer,120));
    h+=f('rf_url',t('rcFUrl'),txtI('rf_url',r.url,300,'url',' inputmode="url" placeholder="https://"'));
    h+=f('rf_reg',t('rcFRegUrl'),txtI('rf_reg',r.reg_url,300,'url',' inputmode="url" placeholder="https://"'));
    if(mode==='admin'){
      h+='<div class="rc-f2">'+f('rf_lat',t('rcFLat'),txtI('rf_lat',r.lat,10,'text',' inputmode="decimal"'))+f('rf_lon',t('rcFLon'),txtI('rf_lon',r.lon,10,'text',' inputmode="decimal"'))+'</div>';
      h+=f('rf_src',t('rcFSource'),txtI('rf_src',r.source_url,300,'url',' inputmode="url" placeholder="https://"'));
      h+=f('rf_st',t('rcFStatus'),'<select class="ps-select" id="rf_st">'+['published','postponed','cancelled'].map(k=>'<option value="'+k+'"'+((r.status||'published')===k?' selected':'')+'>'+t('rcSt_'+k)+'</option>').join('')+'</select>');
    }
    h+=f('rf_desc',t('rcFDesc'),'<textarea class="inp" id="rf_desc" rows="3" maxlength="1500" dir="auto">'+E(r.description||'')+'</textarea>');
    h+='<div class="rc-err" id="rf_err" role="alert"></div></div>';
    return h;
  }
  function readForm(mode){
    const v=id=>{ const el=document.getElementById(id); return el?String(el.value||'').trim():''; };
    const p={name:v('rf_name'),date:v('rf_date'),date_end:v('rf_end')||null,start_time:v('rf_time')?v('rf_time').slice(0,5):null,city:v('rf_city'),
      wilaya:v('rf_wil')?+v('rf_wil'):null,kind:v('rf_kind')||'route',distances:parseDists(v('rf_dist')),organizer:v('rf_org')||null,url:v('rf_url')||null,reg_url:v('rf_reg')||null,description:v('rf_desc')||null};
    if(mode==='admin'){ p.lat=v('rf_lat')?+v('rf_lat').replace(',','.'):null; p.lon=v('rf_lon')?+v('rf_lon').replace(',','.'):null; p.source_url=v('rf_src')||null; p.status=v('rf_st')||'published'; }
    return p;
  }
  function showErr(code){ const el=$('#rf_err'); if(el) el.textContent=code?t(ERRK[code]||'rcErrFormat'):''; if(code){ const map={name:'rf_name',date:'rf_date',date_end:'rf_end',start_time:'rf_time',city:'rf_city',wilaya:'rf_wil',distances:'rf_dist',url:'rf_url',reg_url:'rf_reg',source_url:'rf_src',coords:'rf_lat',organizer:'rf_org',description:'rf_desc'}; const f=document.getElementById(map[code]); if(f) f.focus(); } }

  /* ---------- proposer une course ---------- */
  window.raceProposeOpen=function(){
    openOv('ovRace'); $('#ovRaceTitle').textContent=t('rcPropose');
    if(!window.currentUserId || window.isGuestUser){ $('#raceBody').innerHTML='<div class="rc-empty"><b>'+t('rcProposeAccount')+'</b><span>'+t('rcProposeAccountSub')+'</span></div>'; return; }
    $('#raceBody').innerHTML='<p class="rc-lead">'+t('rcProposeLead')+'</p>'+formHTML({},'propose')+'<div id="rfClub"></div>'+
      '<label class="rc-f" for="rf_note"><span>'+t('rcFNote')+'</span><textarea class="inp" id="rf_note" rows="2" maxlength="500" placeholder="'+E(t('rcFNotePh'))+'"></textarea></label>'+
      '<div class="ik-cta-bar"><button type="button" class="btn" id="rfSend" onclick="raceProposeSend()">'+t('rcProposeSend')+'</button></div>';
    myAdminClubs().then(cl=>{ const el=$('#rfClub'); if(el && cl.length) el.innerHTML='<label class="rc-f" for="rf_club"><span>'+t('rcFClub')+'</span><select class="ps-select" id="rf_club"><option value="">'+E(t('rcFClubNone'))+'</option>'+cl.map(c=>'<option value="'+E(c.id)+'">'+E(c.name)+'</option>').join('')+'</select></label>'; });
  };
  function myAdminClubs(){
    const c=sb(), uid=window.currentUserId; if(!c||!uid) return Promise.resolve([]);
    return Promise.all([c.from('clubs').select('id,name').eq('owner_id',uid),c.from('club_members').select('club_id').eq('user_id',uid).eq('role','admin')])
      .then(([a,b])=>{ const own=(a&&a.data)||[], ids=((b&&b.data)||[]).map(x=>x.club_id).filter(id=>!own.some(o=>o.id===id));
        return ids.length?Promise.resolve(c.from('clubs').select('id,name').in('id',ids)).then(r=>own.concat((r&&r.data)||[])):own; })
      .catch(()=>[]);
  }
  window.raceProposeSend=function(){
    const p=readForm('propose'), err=check(p); showErr(err); if(err) return;
    if(p.date<todayKey()){ showErr('date'); return; }
    const c=sb(); if(!c||!navigator.onLine){ toast(t('rcNeedNetwork')); return; }
    const note=($('#rf_note')&&$('#rf_note').value||'').trim().slice(0,500)||null, club=$('#rf_club')&&$('#rf_club').value||null;
    const btn=$('#rfSend'); if(btn) btn.disabled=true;
    Promise.resolve(c.from('race_proposals').insert({user_id:window.currentUserId,data:p,note,club_id:club})).then(res=>{
      if(res.error){ const m=res.error.message||''; toast(/rate_limited/.test(m)?t('rcRateLimited'):/invalid_(\w+)/.test(m)?t(ERRK[m.match(/invalid_(\w+)/)[1]]||'rcErrFormat'):t('genericErrorRetry')); if(btn) btn.disabled=false; return; }
      try{ if(typeof ikTrack==='function') ikTrack('race_propose',{}); }catch(e){}
      $('#raceBody').innerHTML='<div class="rc-empty ok">'+ICN('check',28)+'<b>'+t('rcProposeThanks')+'</b><span>'+t('rcProposeThanksSub')+'</span></div><div class="ik-cta-bar"><button type="button" class="btn" onclick="closeOv(\'ovRace\')">'+t('notedCoachBtn')+'</button></div>';
    }).catch(()=>{ toast(t('genericErrorRetry')); if(btn) btn.disabled=false; });
  };

  /* ---------- administration ---------- */
  let ADM={tab:'prop',props:null,imp:null};
  window.raceAdminOpen=function(tab){
    if(!RC.admin) return;
    if(tab) ADM.tab=tab;
    openOv('ovRace'); $('#ovRaceTitle').textContent=t('rcAdmin'); admPaint();
    if(ADM.tab==='prop') admLoadProps();
  };
  function admPaint(){
    const tabs=[['prop',t('rcAdmProps')],['conf',t('rcAdmConflicts')],['add',t('rcAdmAdd')],['imp',t('rcAdmImport')]];
    let h='<div class="seg-ctrl rc-seg">'+tabs.map(x=>'<div class="seg-btn'+(ADM.tab===x[0]?' on':'')+'" role="button" tabindex="0" onclick="raceAdminTab(\''+x[0]+'\')">'+x[1]+'</div>').join('')+'</div>';
    if(ADM.tab==='prop'){
      if(!ADM.props) h+='<div class="rc-empty">'+t('rcLoading')+'</div>';
      else if(!ADM.props.length) h+='<div class="rc-empty"><span>'+t('rcAdmNoProps')+'</span></div>';
      else ADM.props.forEach((p,i)=>{ const d=p.data||{}, e=check(d);
        h+='<div class="card rc-prop"><b dir="auto">'+E(d.name)+'</b><small>'+(d.date?E(dLong(d.date)):'—')+' · '+E(d.city||'')+(d.wilaya?' · '+E(wilName(d.wilaya)):'')+'</small>'+
          (Array.isArray(d.distances)&&d.distances.length?'<span class="rc-tags">'+d.distances.map(k=>'<span class="rc-tag">'+E(fmtKm(+k))+'</span>').join('')+'</span>':'')+
          '<small>'+tp('rcAdmBy',E(p.username||'?'))+(p.club_name?' · '+tp('rcAdmClub',E(p.club_name)):'')+' · '+E(dShort(String(p.created_at).slice(0,10)))+'</small>'+
          (p.note?'<p class="rc-desc" dir="auto">'+E(p.note)+'</p>':'')+(d.reg_url||d.url?'<p class="ad-foot">'+extA(d.reg_url||d.url,E(String(d.reg_url||d.url).replace(/^https?:\/\//,'').slice(0,48)),'rc-link')+'</p>':'')+
          (e?'<div class="rc-err">'+t(ERRK[e]||'rcErrFormat')+'</div>':'')+
          '<div class="rc-acts2"><button type="button" class="btn sm" onclick="raceReview('+i+',true)"'+(e?' disabled':'')+'>'+ICN('check',15)+' '+t('rcAccept')+'</button><button type="button" class="btn ghost sm" onclick="raceReviewEdit('+i+')">'+ICN('edit',15)+' '+t('rcEdit')+'</button><button type="button" class="btn ghost sm danger" onclick="raceReview('+i+',false)">'+t('rcReject')+'</button></div></div>'; });
    } else if(ADM.tab==='conf'){
      const list=(RC.list||[]).filter(r=>r.date_conflict);
      h+=list.length?list.map(r=>rowHTML(r)+(r.conflict_note?'<p class="ad-foot rc-cnote">'+E(r.conflict_note)+'</p>':'')).join(''):'<div class="rc-empty"><span>'+t('rcAdmNoConflicts')+'</span></div>';
    } else if(ADM.tab==='add'){
      h+=formHTML(ADM.edit||{},'admin')+'<div class="ik-cta-bar"><button type="button" class="btn" onclick="raceAdminSave()">'+t(ADM.edit&&ADM.edit.id?'rcSave':'rcAdd')+'</button></div>';
    } else {
      h+='<p class="rc-lead">'+t('rcImpLead')+'</p><pre class="rc-code">nom;date;heure;ville;wilaya;type;distances;organisateur;site;inscription;source\n'+E(t('rcImpExample'))+'</pre>'+
        '<div class="rc-acts2"><button type="button" class="btn ghost sm" onclick="raceImportFile()">'+ICN('upload',15)+' '+t('rcImpFile')+'</button></div>'+
        '<label class="rc-f" for="rcImpTxt"><span>'+t('rcImpPaste')+'</span><textarea class="inp rc-mono" id="rcImpTxt" rows="6" spellcheck="false"></textarea></label>'+
        '<div class="rc-acts2"><button type="button" class="btn sm" onclick="raceImportPreview()">'+t('rcImpPreview')+'</button></div><div id="rcImpOut">'+(ADM.imp?impHTML():'')+'</div>';
    }
    $('#raceBody').innerHTML=h;
  }
  window.raceAdminTab=function(k){ if(k==='add') ADM.edit=null; window.raceAdminOpen(k); };
  function admLoadProps(){
    const c=sb(); if(!c) return;
    Promise.resolve(c.rpc('ikorun_race_proposals_pending')).then(r=>{ ADM.props=(r&&r.data)||[]; if(ADM.tab==='prop' && $('#ovRace').classList.contains('on')) admPaint(); }).catch(()=>{ ADM.props=[]; admPaint(); });
  }
  window.raceReview=function(i,accept){
    const p=ADM.props&&ADM.props[i], c=sb(); if(!p||!c) return;
    const go=note=>Promise.resolve(c.rpc('ikorun_race_review',{p_id:p.id,p_accept:accept,p_note:note||null,p_data:ADM.fix&&ADM.fix.id===p.id?ADM.fix.data:null})).then(r=>{
      if(r.error){ toast(t('genericErrorRetry')); return; }
      const a=r.data&&r.data.action; ADM.fix=null;
      toast(a==='conflict'?t('rcAdmConflictToast'):a==='merged'?t('rcAdmMergedToast'):a==='rejected'?t('rcAdmRejectedToast'):a==='invalid'?t(ERRK[r.data.error]||'rcErrFormat'):t('rcAdmAddedToast'));
      ADM.props.splice(i,1); RC.ts=0; load(true); admPaint();
    });
    if(accept) go(null); else customPrompt(t('rcRejectWhy'),'',v=>go(v),{maxLength:300,placeholder:t('rcRejectWhyPh'),yesLabel:t('rcReject')});
  };
  // Corriger une proposition avant de l'accepter : le formulaire admin, puis « Accepter ».
  window.raceReviewEdit=function(i){ const p=ADM.props&&ADM.props[i]; if(!p) return; ADM.edit=Object.assign({},p.data,{_prop:i}); ADM.tab='add'; admPaint(); };
  window.raceAdminSave=function(){
    const p=readForm('admin'), err=check(p); showErr(err); if(err) return;
    const c=sb(); if(!c||!navigator.onLine){ toast(t('rcNeedNetwork')); return; }
    const ed=ADM.edit||{};
    if(ed._prop!=null && ADM.props && ADM.props[ed._prop]){ ADM.fix={id:ADM.props[ed._prop].id,data:p}; const i=ed._prop; ADM.edit=null; ADM.tab='prop'; admPaint(); return window.raceReview(i,true); }
    const q=ed.id?c.from('races').update(Object.assign({},p,{date_conflict:false,conflict_note:null})).eq('id',ed.id).select('id'):c.rpc('ikorun_race_upsert',{p,p_source:'admin',p_dry:false});
    Promise.resolve(q).then(r=>{
      if(r.error){ toast(t('genericErrorRetry')); return; }
      const a=ed.id?'saved':r.data&&r.data.action;
      toast(a==='conflict'?t('rcAdmConflictToast'):a==='merged'?t('rcAdmMergedToast'):a==='invalid'?t(ERRK[r.data.error]||'rcErrFormat'):t(ed.id?'rcAdmSavedToast':'rcAdmAddedToast'));
      ADM.edit=null; RC.ts=0; load(true).then(()=>{ if(ed.id) window.raceOpen(ed.id); else admPaint(); });
    }).catch(()=>toast(t('genericErrorRetry')));
  };
  window.raceEdit=function(id){ const r=byId(id); if(!r) return; ADM.edit=Object.assign({},r); ADM.tab='add'; window.raceAdminOpen('add'); };
  window.raceResolve=function(id){
    const c=sb(); if(!c) return;
    Promise.resolve(c.from('races').update({date_conflict:false,conflict_note:null}).eq('id',id)).then(r=>{ if(r.error){ toast(t('genericErrorRetry')); return; } toast(t('rcAdmSavedToast')); RC.ts=0; load(true).then(()=>window.raceOpen(id)); });
  };
  window.raceDelete=function(id){
    const r=byId(id), c=sb(); if(!r||!c) return;
    customConfirm(tp('rcDeleteConfirm',r.name),()=>{
      Promise.resolve(c.from('races').delete().eq('id',id)).then(x=>{ if(x.error){ toast(t('genericErrorRetry')); return; } RC.list=RC.list.filter(y=>y.id!==id); closeOv('ovRace'); paint(); toast(t('rcAdmDeletedToast')); }); },{danger:true,yesLabel:t('delete')});
  };

  /* ---------- import CSV / JSON ---------- */
  // CSV : séparateur « ; » ou « , » (détecté sur l'en-tête), guillemets doubles, en-têtes FR ou EN.
  const COLS={nom:'name',name:'name',date:'date',date_fin:'date_end',date_end:'date_end',fin:'date_end',heure:'start_time',start_time:'start_time',time:'start_time',
    ville:'city',city:'city',lieu:'city',wilaya:'wilaya',lat:'lat',latitude:'lat',lon:'lon',lng:'lon',longitude:'lon',type:'kind',kind:'kind',distances:'distances',distance:'distances',
    organisateur:'organizer',organizer:'organizer',site:'url',url:'url',inscription:'reg_url',reg_url:'reg_url',registration:'reg_url',description:'description',source:'source_url',source_url:'source_url',statut:'status',status:'status'};
  const KIND_FR={route:'route',road:'route',cross:'cross','cross-country':'cross',trail:'trail',piste:'piste',track:'piste',ultra:'ultra',marche:'marche',walk:'marche',autre:'autre',other:'autre'};
  function csvRows(txt){
    const s=String(txt||'').replace(/^\uFEFF/,''), first=s.split(/\r?\n/)[0]||'', sep=(first.split(';').length>=first.split(',').length)?';':',';
    const rows=[]; let row=[], cur='', q=false;
    for(let i=0;i<s.length;i++){ const ch=s[i];
      if(q){ if(ch==='"'){ if(s[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=ch; }
      else if(ch==='"') q=true;
      else if(ch===sep){ row.push(cur); cur=''; }
      else if(ch==='\n'||ch==='\r'){ if(ch==='\r'&&s[i+1]==='\n') i++; row.push(cur); cur=''; if(row.some(x=>x.trim())) rows.push(row); row=[]; }
      else cur+=ch; }
    row.push(cur); if(row.some(x=>x.trim())) rows.push(row);
    return rows;
  }
  // Date « 2027-01-10 » ou « 10/01/2027 » ; nombres à virgule.
  function toKey(v){ v=String(v||'').trim(); let m; if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; if((m=v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/))) return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'); return v; }
  function normRow(o){
    const p={};
    Object.keys(o).forEach(k0=>{ const k=COLS[norm(k0).trim().replace(/\s+/g,'_')]; if(!k) return; let v=o[k0]; if(v==null) return; if(typeof v==='string') v=v.trim(); if(v==='') return; p[k]=v; });
    if(p.date) p.date=toKey(p.date); if(p.date_end) p.date_end=toKey(p.date_end);
    if(p.start_time) p.start_time=String(p.start_time).replace('h',':').replace(/^(\d):/,'0$1:').slice(0,5);
    if(p.wilaya!=null){ const n=parseInt(p.wilaya,10); if(Number.isFinite(n)) p.wilaya=n; else { const w=(typeof WILAYAS!=='undefined'?WILAYAS:[]).find(x=>norm(x[1])===norm(p.wilaya)); p.wilaya=w?w[0]:p.wilaya; } }
    if(p.kind) p.kind=KIND_FR[norm(p.kind).trim()]||p.kind;
    if(p.distances!=null && !Array.isArray(p.distances)) p.distances=parseDists(p.distances);
    if(p.lat!=null) p.lat=+String(p.lat).replace(',','.'); if(p.lon!=null) p.lon=+String(p.lon).replace(',','.');
    return p;
  }
  function parseImport(txt){
    const s=String(txt||'').trim(); if(!s) return [];
    if(s[0]==='['||s[0]==='{'){ let j; try{ j=JSON.parse(s); }catch(e){ return {err:'rcImpBadJson'}; } const a=Array.isArray(j)?j:Array.isArray(j.races)?j.races:null; if(!a) return {err:'rcImpBadJson'}; return a.slice(0,500).map(x=>normRow(x&&typeof x==='object'?x:{})); }
    const rows=csvRows(s); if(rows.length<2) return {err:'rcImpNoRows'};
    const head=rows[0]; return rows.slice(1,501).map(r=>{ const o={}; head.forEach((h,i)=>{ o[h]=r[i]; }); return normRow(o); });
  }
  window.raceParseImport=parseImport;
  window.raceImportFile=function(){
    const inp=document.createElement('input'); inp.type='file'; inp.accept='.csv,.json,text/csv,application/json,text/plain';
    inp.onchange=e=>{ const f=e.target.files[0]; if(!f) return; if(f.size>1024*1024){ toast(t('rcImpTooBig')); return; }
      const rd=new FileReader(); rd.onload=()=>{ const ta=$('#rcImpTxt'); if(ta) ta.value=String(rd.result||''); window.raceImportPreview(); }; rd.readAsText(f,'utf-8'); };
    inp.click();
  };
  window.raceImportPreview=function(){
    const ta=$('#rcImpTxt'), rows=parseImport(ta?ta.value:'');
    if(rows.err){ ADM.imp={err:rows.err}; $('#rcImpOut').innerHTML=impHTML(); return; }
    if(!rows.length){ ADM.imp={err:'rcImpNoRows'}; $('#rcImpOut').innerHTML=impHTML(); return; }
    const local=rows.map(p=>check(p));
    ADM.imp={rows,local,res:null,busy:true}; $('#rcImpOut').innerHTML=impHTML();
    const c=sb(); if(!c) return;
    // simulation côté serveur : dédoublonnage et contradictions vus AVANT d'importer
    Promise.resolve(c.rpc('ikorun_races_import',{p_rows:rows,p_dry:true})).then(r=>{ ADM.imp.busy=false; ADM.imp.res=r.error?null:r.data; ADM.imp.err=r.error?'rcImpServerErr':null; $('#rcImpOut').innerHTML=impHTML(); });
  };
  function impHTML(){
    const I=ADM.imp; if(!I) return ''; if(I.err && !I.rows) return '<div class="rc-err">'+t(I.err)+'</div>';
    const res=I.res||[], cnt={new:0,merged:0,conflict:0,invalid:0};
    I.rows.forEach((p,i)=>{ const a=I.local[i]?'invalid':(res[i]&&res[i].action)||'?'; if(cnt[a]!=null) cnt[a]++; });
    let h='<div class="rc-imp-sum">'+(I.busy?t('rcLoading'):tp('rcImpSummary',cnt.new,cnt.merged,cnt.conflict,cnt.invalid))+'</div>'+(I.err?'<div class="rc-err">'+t(I.err)+'</div>':'');
    h+='<div class="rc-imp">'+I.rows.slice(0,200).map((p,i)=>{ const e=I.local[i]||(res[i]&&res[i].error), a=e?'invalid':(res[i]&&res[i].action)||'';
      return '<div class="rc-imp-r '+a+'"><span>'+(i+1)+'</span><b>'+E(p.name||'—')+'</b><small>'+E(p.date||'')+' · '+E(p.city||'')+'</small><em>'+(e?t(ERRK[e]||'rcErrFormat'):a?t('rcImp_'+a):'')+'</em></div>'; }).join('')+'</div>';
    if(I.res && cnt.new+cnt.merged+cnt.conflict>0) h+='<div class="ik-cta-bar"><button type="button" class="btn" onclick="raceImportGo()">'+tp('rcImpGo',cnt.new+cnt.merged+cnt.conflict)+'</button></div>';
    return h;
  }
  window.raceImportGo=function(){
    const I=ADM.imp, c=sb(); if(!I||!I.rows||!c) return;
    const ok=I.rows.filter((p,i)=>!I.local[i]);
    Promise.resolve(c.rpc('ikorun_races_import',{p_rows:ok,p_dry:false})).then(r=>{
      if(r.error){ toast(t('rcImpServerErr')); return; }
      const n=(r.data||[]).filter(x=>x.action==='inserted').length, m=(r.data||[]).filter(x=>x.action==='merged').length, k=(r.data||[]).filter(x=>x.action==='conflict').length;
      toast(tp('rcImpDone',n,m,k)); ADM.imp=null; RC.ts=0; load(true); admPaint();
    });
  };
})();
