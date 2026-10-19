/* ============================================================================
   IKORUN — INSCRIPTION (V4.10.0), sur le modèle de l'assistant de KORE
   ----------------------------------------------------------------------------
   Une question par écran, comme les assistants d'Apple :
   - un grand titre, une phrase qui dit POURQUOI on la pose, des réponses qu'on
     touche (listes à cocher, roues, cases) ; on ne tape que le prénom et le pseudo ;
   - les choix simples passent tout seuls à l'écran suivant ;
   - entre deux parties (Toi → Course → Ton app), un écran d'étapes où celle qu'on
     vient de finir se coche ;
   - à la fin, un récapitulatif dont chaque ligne se touche pour corriger, puis la
     construction de l'espace, étape par étape.
   Tout s'affiche dans #ob (les gardes « #ob.on » du reste de l'app restent valables).
   Les données sont écrites dans P exactement comme avant (finishOnboarding), plus
   ce que l'inscription demande désormais : km par semaine, course visée, terrain,
   objectif (finir / chrono). « Configurer mon plan » reprend tout à la 1re génération.
   ============================================================================ */
const IKOB=(()=>{
  let el=null, d=null, cur=null, depuisRecap=false, occupe=false, autoT=0;
  const svg=(p,s=22,w=2.4)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const CHECK=svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>',15,3.4), CHEV_G=svg('<path d="M15 5l-7 7 7 7"/>',22,2.6), CHEV_D=svg('<path d="M9 5l7 7-7 7"/>',18,2.4);
  const tic=()=>{ try{ haptic(); }catch(e){} try{ sfx('tap'); }catch(e){} };
  const E_=s=>escHtml(String(s==null?'':s));
  const tile=(ic,s)=>`<span class="ikob-tile" style="width:${s}px;height:${s}px">${ICN(ic,Math.round(s*.52),'currentColor')}</span>`;
  const mk=(h,cls)=>{ const x=document.createElement('div'); if(cls) x.className=cls; x.innerHTML=h; return x; };
  const LEVELS=[['Débutant','lvlBeginner','ob2LvlDeb','seedling'],['Intermédiaire','lvlIntermediate','ob2LvlInt','run'],['Confirmé','lvlAdvanced','ob2LvlConf','bolt'],
    ['Très avancé','lvlVeryAdvanced','ob2LvlTa','fire'],['Élite','lvlElite','ob2LvlEl','medal']];
  // VDOT de départ quand on n'a aucun chrono : volontairement prudente, le test de fin de bloc la corrige
  const VDOT_NIV={'Débutant':32,'Intermédiaire':40,'Confirmé':47,'Très avancé':54,'Élite':62};
  const REF=[[1500,'1 500 m','1500 m'],[3000,'3 000 m','3000 m'],[5000,'5 km','5000 m'],[10000,'10 km','10 km'],[21097,'semi','Semi-marathon'],[42195,'marathon','Marathon']];
  const refLab=m=>{ const r=REF.find(x=>x[0]===m); if(!r) return fmtKmShort(m/1000)+' km'; return r[1]==='semi'?t('ob2Half'):r[1]==='marathon'?t('ob2Marathon'):r[1]; };
  const RACES=()=>[
    {v:'aucune',ic:'trend',t:t('ob2RaceNone'),s:t('ob2RaceNoneS')},
    {v:'5 km',t:'5 km'},{v:'10 km',t:'10 km'},{v:'Semi-marathon',t:t('ob2Half'),s:'21,1 km'},{v:'Marathon',t:t('ob2Marathon'),s:'42,2 km'},
    {v:'Trail',t:'Trail'},{v:'Cross',t:'Cross'},{v:'Ultra',t:'Ultra'},{v:'Autre',t:t('ob2RaceOther')}];
  const raceNom=()=>d.race==='Autre'?fmtKmShort(d.raceKm)+' km':(d.race==='aucune'?t('ob2RaceNone'):trRace(d.race));
  const ageDe=b=>{ if(!b) return 0; const x=new Date(b+'T00:00:00'); return Math.floor((ikNow()-x)/31557600000); };
  const dateLisible=s=>{ try{ return new Date(s+'T12:00:00').toLocaleDateString(curLang()==='ar'?'ar':curLang()==='en'?'en-GB':'fr-FR',{day:'numeric',month:'long',year:'numeric'}); }catch(e){ return s; } };
  const dk=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');

  /* ---------- état ---------- */
  function neuf(){
    return {name:'', username:'', unameAuto:true, sex:null, bday:'', level:null, km:null, kmUnknown:false,
      race:null, raceKm:15, date:'', terrain:'Plate', goal:'Finir', target:0, cal:null,
      perfs:[], refM:5000, noRef:false, mode:null};
  }

  /* ---------- briques ---------- */
  function liste(opts,estSel,surChoix,multi){
    const L=mk(opts.map(o=>`<button type="button" class="ikob-opt${o.ic?' ico':''}" role="${multi?'checkbox':'radio'}" data-v="${E_(o.v)}" aria-checked="${!!estSel(o.v)}">${o.ic?tile(o.ic,38):''}<span class="ikob-opt-t"><b>${o.t}</b>${o.s?`<small>${o.s}</small>`:''}</span><span class="ikob-coche">${CHECK}</span></button>`).join(''),'ikob-liste'+(multi?' ikob-multi':''));
    L.setAttribute('role',multi?'group':'radiogroup');
    L.addEventListener('click',e=>{ const b=e.target.closest('.ikob-opt'); if(!b) return; tic(); surChoix(b.dataset.v);
      L.querySelectorAll('.ikob-opt').forEach(x=>x.setAttribute('aria-checked',String(!!estSel(x.dataset.v)))); maj(); });
    return L;
  }
  function seg(opts,estSel,surChoix,cols){
    const S=mk(opts.map(o=>`<button type="button" role="radio" data-v="${E_(o.v)}" aria-checked="${!!estSel(o.v)}">${o.t}</button>`).join(''),'ikob-seg'+(cols?' grille':''));
    if(cols) S.style.gridTemplateColumns='repeat('+cols+',1fr)';
    S.setAttribute('role','radiogroup');
    S.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; try{ haptic(); }catch(_){} surChoix(b.dataset.v);
      S.querySelectorAll('button').forEach(x=>x.setAttribute('aria-checked',String(!!estSel(x.dataset.v)))); maj(); });
    return S;
  }
  /* champ réglable : ouvre la roue de l'app (la même que partout ailleurs) */
  function champs(defs){
    const L=mk(defs.map((x,i)=>`<button type="button" class="ikob-val" data-i="${i}"><span>${x.t}${x.s?`<small>${x.s}</small>`:''}</span><b class="${x.vide&&x.vide()?'vide':''}">${x.aff()}</b>${CHEV_D}</button>`).join(''),'ikob-liste');
    L.addEventListener('click',e=>{ const b=e.target.closest('.ikob-val'); if(!b) return; const x=defs[+b.dataset.i]; try{ haptic(); }catch(_){}
      x.ouvre(()=>{ b.querySelector('b').innerHTML=x.aff(); b.querySelector('b').classList.toggle('vide',!!(x.vide&&x.vide())); if(x.apres) x.apres(); maj(); }); });
    return L;
  }
  /* roue façon iPhone, en ligne (date de naissance) */
  function roue(vals,val,fmt,surCh,etiq){
    const r=document.createElement('div'); r.className='ikob-roue'; r.tabIndex=0; r.setAttribute('role','listbox'); if(etiq) r.setAttribute('aria-label',etiq);
    r.innerHTML='<div></div>'+vals.map(v=>`<span role="option">${fmt(v)}</span>`).join('')+'<div></div>';
    let i0=vals.indexOf(val); if(i0<0) i0=0;
    let ci=i0, raf=0, pret=false;
    const peindre=()=>{ raf=0; const c=r.scrollTop/44, it=r.children;
      const a=Math.max(0,Math.floor(c-5)), b=Math.min(vals.length-1,Math.ceil(c+5));
      for(let i=a;i<=b;i++){ const e=it[i+1], dd=i-c, ad=Math.abs(dd);
        e.style.transform=`perspective(500px) rotateX(${(-dd*17).toFixed(1)}deg) scale(${(1-Math.min(.22,ad*.06)).toFixed(3)})`; e.style.opacity=String(Math.max(.18,1-ad*.27)); }
      const n=Math.round(c); if(pret&&n!==ci&&n>=0&&n<vals.length){ ci=n; try{ haptic(); }catch(_){} surCh(vals[n]); maj(); } };
    r.addEventListener('scroll',()=>{ if(!raf) raf=requestAnimationFrame(peindre); },{passive:true});
    r.addEventListener('keydown',e=>{ if(e.key==='ArrowDown'||e.key==='ArrowUp'){ r.scrollBy({top:e.key==='ArrowDown'?44:-44,behavior:'smooth'}); e.preventDefault(); } });
    r.addEventListener('click',e=>{ const s=e.target.closest('span'); if(!s) return; const i=[...r.children].indexOf(s)-1; r.scrollTo({top:i*44,behavior:'smooth'}); });
    r._monter=()=>{ r.scrollTop=i0*44; peindre(); pret=true; };
    return r;
  }
  const bloc=(etiq,...enfants)=>{ const B=mk(etiq?`<div class="ikob-etiq">${etiq}</div>`:'','ikob-bloc'); enfants.forEach(x=>x&&B.appendChild(x)); return B; };
  const note=h=>mk(h,'ikob-note');
  const range_=(a,b)=>{ const o=[]; for(let i=a;i<=b;i++) o.push(i); return o; };
  function choisirDate(titre,val,min,max,cb){
    // roue jour / mois / année de l'app ; le jour est recalé sur la longueur du mois
    const mo=range_(0,11), y0=min.getFullYear(), y1=max.getFullYear(), ys=range_(y0,y1);
    const v=val?new Date(val+'T12:00:00'):new Date(min.getTime()+(max-min)/2);
    const mn=i=>{ try{ return new Date(2020,i,1).toLocaleDateString(curLang()==='ar'?'ar':curLang(),{month:'short'}); }catch(e){ return String(i+1); } };
    openPicker({title:titre,cols:[{values:range_(1,31),sel:v.getDate()-1},{values:mo,sel:v.getMonth(),fmt:mn,wide:true},{values:ys,sel:Math.max(0,ys.indexOf(v.getFullYear()))}],seps:[null,null],
      onOk:idx=>{ const y=ys[idx[2]], m=idx[1], nj=new Date(y,m+1,0).getDate(); let x=new Date(y,m,Math.min(idx[0]+1,nj),12);
        if(x<min) x=new Date(min); if(x>max) x=new Date(max); cb(dk(x)); }});
  }

  /* ---------- les écrans ---------- */
  const course=()=>!!d.race&&d.race!=='aucune';
  const SEC={toi:()=>t('ob2SecYou'),course:()=>t('ob2SecRun'),app:()=>t('ob2SecApp'),recap:()=>t('ob2SecRecap')};
  const E=[
    {id:'nom',sec:'toi',titre:()=>t('ob2NameT'),sous:()=>t('ob2NameS'),
      corps(c){ const i=document.createElement('input'); i.className='ikob-champ'; i.type='text'; i.maxLength=30; i.autocomplete='given-name'; i.autocapitalize='words'; i.enterKeyHint='next';
        i.placeholder=t('firstNamePh'); i.value=d.name; i.dir='auto';
        i.addEventListener('input',()=>{ d.name=i.value.trim(); maj(); }); i.addEventListener('keydown',e=>{ if(e.key==='Enter'&&d.name){ e.preventDefault(); suivant(true); } });
        c.appendChild(i); setTimeout(()=>{ try{ i.focus({preventScroll:true}); }catch(e){} },420); },
      ok:()=>d.name.length>0},
    {id:'pseudo',sec:'toi',titre:()=>t('ob2UserT'),sous:()=>t('ob2UserS'),
      corps(c){
        const W=mk(`<div class="ikob-at"><span>@</span><input class="ikob-champ" id="ikobUser" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="20" dir="ltr"></div><div class="uname-status" id="ikobUserSt"></div>`);
        c.appendChild(W);
        const i=W.querySelector('input'), st=W.querySelector('#ikobUserSt'); i.placeholder=t('usernamePh'); i.value=d.username;
        let deb=null;
        const verifier=()=>{ clearTimeout(deb); i._uname={v:i.value.trim(),ok:null}; maj(); deb=setTimeout(()=>checkUsernameLive(i.value,st,i).then(()=>maj()),380); };
        i.addEventListener('input',()=>{ d.unameAuto=false; d.username=i.value.trim(); verifier(); });
        i.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); suivant(true); } });
        if(d.unameAuto && d.name){
          st.textContent=t('checkingLab'); st.className='uname-status checking'; i._uname={v:'',ok:null};
          suggestAvailableUsername(d.name).then(u=>{ if(!el||cur!=='pseudo'||!d.unameAuto) return; d.username=u; i.value=u; checkUsernameLive(u,st,i).then(()=>maj()); });
        } else if(d.username) checkUsernameLive(d.username,st,i).then(()=>maj());
        else st.textContent=t('usernameFormatHint');
      },
      avant:async()=>{ // attend le verdict de LA valeur affichée (comme l'ancienne étape)
        const i=el&&el.querySelector('#ikobUser'); if(!i) return false; const v=i.value.trim();
        if(!usernameFormatOk(v)){ toast(t('usernameFormatHint')); return false; }
        let s=i._uname; if(!s||s.v!==v||s.ok===null){ await checkUsernameLive(v,el.querySelector('#ikobUserSt'),i); s=i._uname; }
        if(!(s&&s.v===v&&(s.ok===true||s.ok==='error'))){ toast(t('usernameUnavailable')); return false; }
        d.username=v; return true; },
      ok:()=>usernameFormatOk(d.username)},
    {id:'sexe',sec:'toi',auto:true,titre:()=>t('ob2SexT'),sous:()=>t('ob2SexS'),
      corps(c){ c.appendChild(liste([{v:'Homme',t:t('maleLab')},{v:'Femme',t:t('femaleLab')}],v=>d.sex===v,v=>{ d.sex=v; })); },
      ok:()=>!!d.sex},
    {id:'naissance',sec:'toi',titre:()=>t('ob2BdayT'),sous:()=>t('ob2BdayS'),
      corps(c){ const now=ikNow(); if(!d.bday) d.bday=dk(new Date(now.getFullYear()-25,0,1,12));
        const b=new Date(d.bday+'T12:00:00'); let D=b.getDate(), M=b.getMonth(), Y=b.getFullYear();
        const poser=()=>{ const nj=new Date(Y,M+1,0).getDate(); d.bday=dk(new Date(Y,M,Math.min(D,nj),12)); lab.innerHTML=tp('ob2AgeYears',ageDe(d.bday)); };
        const mn=i=>{ try{ return new Date(2020,i,1).toLocaleDateString(curLang()==='ar'?'ar':curLang(),{month:'long'}); }catch(e){ return String(i+1); } };
        const W=mk('','ikob-roues'); W.dir='ltr';
        W.appendChild(roue(range_(1,31),D,v=>v,v=>{ D=v; poser(); },t('ob2Day')));
        W.appendChild(roue(range_(0,11),M,mn,v=>{ M=v; poser(); },t('ob2Month')));
        W.appendChild(roue(range_(now.getFullYear()-100,now.getFullYear()-6).reverse(),Y,v=>v,v=>{ Y=v; poser(); },t('ob2Year')));
        c.appendChild(W); const lab=mk('','ikob-age'); c.appendChild(lab); poser(); },
      ok:()=>{ const a=ageDe(d.bday); return a>=6&&a<=100; }},
    /* course */
    {id:'niveau',sec:'course',auto:true,titre:()=>t('ob2LevelT'),sous:()=>t('ob2LevelS'),
      corps(c){ c.appendChild(liste(LEVELS.map(l=>({v:l[0],ic:l[3],t:t(l[1]),s:t(l[2])})),v=>d.level===v,v=>{ if(d.level!==v&&!d.kmUnknown) d.km=null; d.level=v; })); },
      ok:()=>!!d.level},
    {id:'volume',sec:'course',titre:()=>t('ob2KmT'),sous:()=>t('ob2KmS'),
      corps(c){ if(d.km==null) d.km=kmWeekFromLevel(d.level);
        c.appendChild(champs([{t:t('ob2KmLab'),aff:()=>d.kmUnknown?t('ob2KmUnknown'):tp('ob2KmVal',d.km),vide:()=>d.kmUnknown,
          ouvre:fin=>pickInt(t('ob2KmLab'),0,160,Math.round(d.km/5)*5,'km',v=>{ d.km=v; d.kmUnknown=false; fin(); },5)}]));
        c.appendChild(note(t('ob2KmNote'))); },
      lien:{t:()=>t('ob2KmDontKnow'),f:()=>{ d.kmUnknown=true; d.km=kmWeekFromLevel(d.level); suivant(true); }},
      ok:()=>true},
    {id:'chrono',sec:'course',titre:()=>t('ob2RefT'),sous:()=>t('ob2RefS'),
      corps(c){ const zone=document.createElement('div');
        const defS=m=>Math.round(predictTime(VDOT_NIV[d.level]||40,m)/5)*5;
        const dessiner=()=>{ zone.innerHTML='';
          let p=d.perfs.find(x=>x.m===d.refM);
          zone.appendChild(bloc(t('ob2Dist'),seg(REF.map(r=>({v:String(r[0]),t:refLab(r[0])})),v=>String(d.refM)===v,v=>{ d.refM=+v; dessiner(); },3)));
          zone.appendChild(bloc('',champs([{t:tp('ob2RefTimeFor',refLab(d.refM)),vide:()=>!p,aff:()=>p?fmtTime(p.s):t('chooseWord'),
            ouvre:fin=>pickTime(tp('timeForLab',refLab(d.refM)),p?p.s:defS(d.refM),v=>{ const g=recordGuard(d.refM,v); if(!g.ok){ toast(g.msg); return; }
              p=d.perfs.find(x=>x.m===d.refM); if(p) p.s=v; else d.perfs.push(p={m:d.refM,s:v}); d.noRef=false; fin(); dessiner(); },d.refM>=15000)}])));
          const autres=d.perfs.filter(x=>x!==p);
          if(autres.length){
            const L=mk(autres.map(x=>`<div class="ikob-perf"><span>${refLab(x.m)}</span><b>${fmtTime(x.s)}</b><button type="button" data-m="${x.m}" aria-label="${E_(t('deleteLab2'))}">${ICN('close',15)}</button></div>`).join(''),'ikob-perfs');
            L.addEventListener('click',e=>{ const b=e.target.closest('button[data-m]'); if(!b) return; tic(); d.perfs=d.perfs.filter(x=>x.m!==+b.dataset.m); dessiner(); maj(); });
            zone.appendChild(bloc(t('ob2RefOthers'),L));
          }
          zone.appendChild(note(d.perfs.length?(d.perfs.length<REF.length?t('ob2RefMoreNote'):''):t('ob2RefWhy')));
        };
        dessiner(); c.appendChild(zone); },
      lien:{t:()=>t('ob2RefNone'),f:()=>{ d.noRef=true; d.perfs=[]; toast(t('ob2RefNoneToast')); suivant(true); }},
      ok:()=>d.perfs.length>0},
    {id:'course',sec:'course',auto:true,titre:()=>t('ob2RaceT'),sous:()=>t('ob2RaceS'),
      corps(c){ c.appendChild(liste(RACES(),v=>d.race===v,v=>{ if(d.race!==v) d.cal=null; d.race=v; })); },
      lien:{t:()=>t('racePickFromCal'),f:()=>{ try{ openRaces({pick:'onboarding'}); }catch(e){} }},
      ok:()=>!!d.race},
    {id:'detail',sec:'course',si:course,titre:()=>d.cal?E_(d.cal.r.name):t('ob2RaceDetT'),sous:()=>t('ob2RaceDetS'),
      corps(c){ const min=new Date(minRaceDate()+'T12:00:00'), max=new Date(min.getFullYear()+3,11,31,12);
        const F=[{t:t('ob2RaceDate'),vide:()=>!d.date,aff:()=>d.date?dateLisible(d.date):t('chooseWord'),
          ouvre:fin=>choisirDate(t('ob2RaceDate'),d.date||dk(new Date(min.getTime()+77*864e5)),min,max,v=>{ if(d.cal&&v!==d.cal.r.date) d.cal=null; d.date=v; fin(); })}];
        if(d.race==='Autre') F.push({t:t('ob2Dist'),aff:()=>fmtKmShort(d.raceKm)+' km',ouvre:fin=>pickDistance(t('ob2Dist'),d.raceKm,km=>{ if(km>=1){ d.raceKm=km; fin(); } })});
        c.appendChild(champs(F));
        c.appendChild(bloc(t('ob2Terrain'),seg([{v:'Plate',t:t('ob2Flat')},{v:'Vallonnée',t:t('ob2Hilly')},{v:'Montagne',t:t('ob2Mountain')}],v=>d.terrain===v,v=>{ d.terrain=v; })));
        const zone=document.createElement('div');
        const dessiner=()=>{ zone.innerHTML=''; if(d.goal!=='Record personnel') return;
          if(!d.target){ const v=d.noRef?VDOT_NIV[d.level]:(vdotPerfs()||VDOT_NIV[d.level]||40); d.target=Math.round(predictTime(v||40,raceMetersOf(d.race,d.raceKm))/30)*30; }
          zone.appendChild(bloc('',champs([{t:t('ob2Target'),aff:()=>fmtTime(d.target),ouvre:fin=>pickTime(t('ob2Target'),d.target,v=>{ if(v>0){ d.target=v; fin(); } },true)}]))); };
        c.appendChild(bloc(t('ob2GoalLab'),liste([{v:'Finir',t:t('ob2GoalFinish'),s:t('ob2GoalFinishS')},{v:'Record personnel',t:t('ob2GoalTime'),s:t('ob2GoalTimeS')}],v=>d.goal===v,v=>{ d.goal=v; dessiner(); })));
        c.appendChild(zone); dessiner(); },
      ok:()=>!!d.date&&d.date>=minRaceDate()},
    /* ton app */
    {id:'affichage',sec:'app',auto:true,titre:()=>t('obModeTitle'),sous:()=>t('ob2ModeS'),
      corps(c){ c.appendChild(liste([{v:'complet',ic:'chart',t:t('obModeFullT'),s:t('obModeFullD')},{v:'simple',ic:'target',t:t('obModeSimpleT'),s:t('obModeSimpleD')}],v=>d.mode===v,v=>{ d.mode=v; }));
        if(!d.mode){ const a=ageDe(d.bday); if(a) c.appendChild(note(tp('obModeSuggestion',t(a>26?'obModeSimpleT':'obModeFullT')))); } },
      ok:()=>!!d.mode},
    {id:'style',sec:'app',titre:()=>t('ob2StyleT'),sous:()=>t('ob2StyleS'),
      corps(c){ const W=mk(`<div class="ikob-ligne"><span>${t('theme')}<small>${t('ob2ThemeS')}</small></span><div id="ikobTheme">${pfThemeSwitchHTML()}</div></div>
          <div class="ikob-ligne col"><span>${t('colorLab')}</span><div id="ikobAccent">${pfAccentPickerHTML()}</div></div>`,'ikob-liste');
        // les deux fonctions de l'app s'appliquent en direct ; on redessine juste leurs contrôles
        W.addEventListener('click',e=>{ if(!e.target.closest('.theme-switch,.accent-dot')) return; setTimeout(()=>{ const a=W.querySelector('#ikobAccent'); if(a) a.innerHTML=pfAccentPickerHTML(); const th=W.querySelector('#ikobTheme'); if(th) th.innerHTML=pfThemeSwitchHTML(); },260); },true);
        c.appendChild(W); },
      ok:()=>true},
    /* récapitulatif */
    {id:'recap',sec:'recap',titre:()=>d.name?tp('ob2RecapT',E_(d.name)):t('ob2RecapT0'),sous:()=>t('ob2RecapS'),
      corps(c){
        const sx=d.sex==='Femme'?t('femaleLab'):t('maleLab'), lv=LEVELS.find(l=>l[0]===d.level);
        const R=[{ic:'user',t:t('ob2SecYou'),v:[d.name,'@'+d.username,sx,tp('ob2AgeYears',ageDe(d.bday))].join(' · '),go:'nom'},
          {ic:'run',t:t('ob2SecRun'),v:[lv?t(lv[1]):'',d.kmUnknown?'':tp('ob2KmVal',d.km)].filter(Boolean).join(' · '),go:'niveau'},
          {ic:'flag',t:t('ob2RowGoal'),v:course()?[d.cal?d.cal.r.name:raceNom(),dateLisible(d.date),d.goal==='Record personnel'&&d.target?tp('ob2Aim',fmtTime(d.target)):t('ob2GoalFinish')].join(' · '):t('ob2RaceNone'),go:'course'},
          {ic:'stopwatch',t:t('ob2RowPerf'),v:d.noRef?t('ob2RefEstimated'):d.perfs.map(x=>refLab(x.m)+' '+fmtTime(x.s)).join(' · '),go:'chrono'},
          {ic:'palette',t:t('ob2SecApp'),v:t(d.mode==='simple'?'obModeSimpleT':'obModeFullT'),go:'affichage'}];
        const L=mk(R.map(r=>`<button type="button" class="ikob-rl" data-go="${r.go}">${tile(r.ic,38)}<span><b>${r.t}</b><em dir="auto">${E_(r.v)}</em></span>${CHEV_D}</button>`).join(''),'ikob-recap');
        L.addEventListener('click',e=>{ const b=e.target.closest('.ikob-rl'); if(!b) return; tic(); depuisRecap=true; aller(b.dataset.go,1); });
        c.appendChild(L); c.appendChild(note(t('ob2RecapNote'))); },
      ok:()=>true, final:true}
  ];
  const visibles=()=>E.filter(e=>!e.si||e.si());
  /* entre deux parties : la liste des parties, celle qu'on vient de finir se coche */
  const ICS={toi:'user',course:'run',app:'palette'};
  const ET={id:'__et',sec:'toi',prev:null,next:null,
    titre:()=>{ const n=etape(ET.next); return ({course:t('ob2EtRun'),app:t('ob2EtApp')})[n&&n.sec]||t('ob2EtNice'); },
    sous:()=>{ const f=etape(ET.prev); return (f&&f.sec==='toi'&&d.name)?tp('ob2EtThanks',E_(d.name)):t('ob2EtNext'); },
    corps(c){ const secs=['toi','course','app'];
      const iPrev=secs.indexOf(etape(ET.prev).sec), iNext=secs.indexOf(etape(ET.next).sec);
      const resume={toi:()=>[d.name,tp('ob2AgeYears',ageDe(d.bday))].join(' · '),course:()=>course()?raceNom():t('ob2RaceNone'),app:()=>''};
      const nb={toi:'',course:t('ob2EtRunSub'),app:t('ob2EtAppSub')};
      const L=mk(secs.map((s,i)=>{ const etat=i<=iPrev?'ok':(i===iNext?'next':'');
        return `<div class="ikob-et ${etat}${i===iPrev?' juste':''}" style="--i:${i}"><i>${CHECK}</i>${tile(ICS[s],34)}<span><b>${SEC[s]()}</b><small>${etat==='ok'?E_(resume[s]()):(etat==='next'?t('ob2UpNext'):nb[s])}</small></span></div>`; }).join(''),'ikob-ets');
      c.appendChild(L); setTimeout(()=>{ try{ sfx('tick'); }catch(_){} },520); },
    ok:()=>true};
  const etape=id=>id==='__et'?ET:E.find(e=>e.id===id);
  function vdotPerfs(){ let b=0; d.perfs.forEach(p=>{ const v=vdotFromRace(p.m,p.s); if(v>b) b=v; }); return b?clampVdot(b):0; }

  /* ---------- squelette ---------- */
  function monter(){
    el=$('#ob'); el.innerHTML='';
    el.classList.add('ikob');
    el.innerHTML=`<div class="ikob-haut"><button type="button" class="ikob-rond" id="ikobRetour"></button><div class="ikob-barre"><i id="ikobBarre"></i></div><span class="ikob-pas" id="ikobPas"></span></div>
      <div class="ikob-scene" id="ikobScene"></div>
      <div class="ikob-bas"><button type="button" class="btn ikob-go" id="ikobGo"></button><button type="button" class="ikob-lien" id="ikobLien" hidden></button></div>`;
    el.querySelector('#ikobRetour').addEventListener('click',retour);
    el.querySelector('#ikobGo').addEventListener('click',async()=>{ const e=etape(cur); if(e&&e.final) finir(); else suivant(true); });
    el.querySelector('#ikobLien').addEventListener('click',()=>{ const e=etape(cur); if(e&&e.lien){ tic(); e.lien.f(); } });
  }
  function maj(){
    if(!el||!cur) return; const e=etape(cur); if(!e) return;
    const V=visibles(), i=cur==='__et'?Math.max(0,V.indexOf(etape(ET.next))-1):V.indexOf(e);
    el.querySelector('#ikobBarre').style.width=Math.round((i+1)/V.length*100)+'%';
    el.querySelector('#ikobPas').textContent=(i+1)+'/'+V.length;
    const go=el.querySelector('#ikobGo'); go.disabled=cur!=='__et'&&!e.ok();
    if(cur==='pseudo'){ const u=el.querySelector('#ikobUser'); if(u&&u._uname&&u._uname.ok===false) go.disabled=true; }
    go.textContent=e.final?t('ob2Create'):(depuisRecap&&finSection()?t('ob2Done'):t('continueLab'));
    const L=el.querySelector('#ikobLien'); if(e.lien){ L.hidden=false; L.textContent=e.lien.t(); } else L.hidden=true;
    const rt=el.querySelector('#ikobRetour'); rt.innerHTML=CHEV_G; rt.setAttribute('aria-label',i<=0?t('ob2BackWelcome'):t('backLab'));
  }
  function finSection(){ const V=visibles(), e=etape(cur), i=V.indexOf(e), n=V[i+1]; return !n||n.sec!==e.sec||n.id==='recap'; }
  function aller(id,dir){
    const e=etape(id); if(!e) return; clearTimeout(autoT);
    const scene=el.querySelector('#ikobScene'), ancien=scene.querySelector('.ikob-ecran:not(.part)');
    if(ancien){ ancien.classList.add('part'); if(dir<0) ancien.classList.add('arr'); setTimeout(()=>ancien.remove(),330); }
    const c=document.createElement('div'); c.className='ikob-ecran entre'+(dir<0?' arr':'');
    cur=id;
    const fr=curLang()==='fr', nb=s=>fr?s.replace(/ ([?!:])/g,' $1'):s;
    c.innerHTML=`<div class="ikob-sur">${SEC[e.sec]()}</div><h1 class="ikob-titre">${nb(e.titre())}</h1><p class="ikob-sous">${nb(e.sous())}</p>`;
    e.corps(c); scene.appendChild(c);
    requestAnimationFrame(()=>c.querySelectorAll('.ikob-roue').forEach(r=>{ if(r._monter&&!r.scrollTop) r._monter(); }));
    // choix simple : on passe tout seul à la suite
    if(e.auto) c.addEventListener('click',ev=>{ if(!ev.target.closest('.ikob-opt')) return; clearTimeout(autoT); autoT=setTimeout(()=>{ if(cur===id&&e.ok()) suivant(true); },320); });
    try{ ikTrack('ob_step',{id}); }catch(_){}
    maj();
  }
  async function suivant(sonore){
    if(occupe) return;
    const V=visibles(), e=etape(cur), i=V.indexOf(e); if(!e||!e.ok()) return;
    if(e.avant){ occupe=true; const go=el.querySelector('#ikobGo'), lab=go.textContent; go.disabled=true; go.textContent=t('checkingEllipsis');
      let ok=false; try{ ok=await e.avant(); }catch(_){} occupe=false; if(!el) return; go.textContent=lab; maj(); if(!ok) return; }
    if(sonore){ try{ haptic(); }catch(_){} }
    if(cur==='__et'){ aller(ET.next,1); return; }
    if(depuisRecap&&finSection()){ depuisRecap=false; aller('recap',-1); return; }
    const n=V[i+1]; if(!n) return;
    if(n.sec!==e.sec&&n.id!=='recap'){ ET.prev=e.id; ET.next=n.id; ET.sec=n.sec; aller('__et',1); return; }
    aller(n.id,1);
  }
  function retour(){
    if(occupe) return;
    if(cur==='__et'){ try{ haptic(); }catch(_){} aller(ET.prev,-1); return; }
    const V=visibles(), e=etape(cur), i=V.indexOf(e);
    if(depuisRecap){ const p=V[i-1]; if(!p||p.sec!==e.sec){ depuisRecap=false; aller('recap',-1); return; } }
    if(i>0){ try{ haptic(); }catch(_){} aller(V[i-1].id,-1); return; }
    accueil();
  }

  /* ---------- accueil (langue, ce qu'on va construire, le temps que ça prend) ---------- */
  function accueil(){
    cur=null; el=$('#ob'); el.classList.add('ikob'); el.classList.remove('ikob-q');
    const n=visibles().length, min=Math.max(2,Math.round(n*12/60));
    const li=(ic,a,b)=>`<li>${tile(ic,40)}<div><b>${a}</b><small>${b}</small></div></li>`;
    el.innerHTML=`<div class="ikob-acc">
      <div class="ikob-langs" role="radiogroup" aria-label="${E_(t('langLab'))}">${LANGS.map(l=>`<button type="button" role="radio" data-l="${l[0]}" aria-checked="${curLang()===l[0]}">${l[1]}</button>`).join('')}</div>
      <div class="ikh ikh-ob-big ikob-hero"><i class="ikh-fx" aria-hidden="true"></i><div class="login-brand man" role="img" aria-label="IKORUN">IKO<span>RUN</span></div><div class="ikh-sub">Elite Athletic Intelligence</div></div>
      <h1 class="ikob-titre c">${t('ob2Welcome')}</h1>
      <p class="ikob-sous c">${t('ob2WelcomeSub')}</p>
      <div class="ikob-chip">${ICN('timer',15)} ${tp('ob2Chip',min,n)}</div>
      <ul class="ikob-promo">${li('stopwatch',t('ob2Li1T'),t('ob2Li1S'))}${li('calendar',t('ob2Li2T'),t('ob2Li2S'))}${li('heart',t('ob2Li3T'),t('ob2Li3S'))}</ul>
      <div class="ikob-acc-bas"><button type="button" class="btn ikob-go" id="ikobStart">${t('ob2Start')}</button><p class="ikob-note c">${t('ob2Note')}</p></div></div>`;
    el.querySelector('.ikob-langs').addEventListener('click',e=>{ const b=e.target.closest('button[data-l]'); if(!b) return; const l=b.dataset.l; if(l===curLang()) return; tic();
      ikLangEnsure(l).then(ok=>{ if(!ok){ toast(t('offlineLangToast')); return; } setLang(l); if(!cur) accueil(); }); });
    el.querySelector('#ikobStart').addEventListener('click',()=>{ tic(); try{ sfx('start'); }catch(_){}
      el.classList.add('ikob-q'); monter(); depuisRecap=false; aller('nom',1); });
  }

  /* ---------- fin : construction de l'espace, puis enregistrement ---------- */
  async function finir(){
    if(occupe) return; occupe=true;
    const etapes=[t('ob2B1'),d.noRef?t('ob2B2e'):t('ob2B2'),t('ob2B3'),t('ob2B4')];
    const scene=el.querySelector('#ikobScene'); scene.innerHTML='';
    el.querySelector('.ikob-bas').style.visibility='hidden'; el.querySelector('#ikobRetour').style.visibility='hidden'; el.querySelector('#ikobBarre').style.width='100%';
    const c=document.createElement('div'); c.className='ikob-ecran entre';
    c.innerHTML=`<div class="ikob-cons"><div class="ikob-anneau"><svg viewBox="0 0 132 132"><circle class="f" cx="66" cy="66" r="58"/><circle class="p" cx="66" cy="66" r="58"/></svg><b>0%</b></div>
      <h2>${t('ob2BuildT')}</h2><ul>${etapes.map(x=>`<li><i>${CHECK}</i>${x}</li>`).join('')}</ul></div>`;
    scene.appendChild(c);
    const li=[...c.querySelectorAll('li')], anneau=c.querySelector('.p'), pc=c.querySelector('.ikob-anneau b');
    const att=ms=>new Promise(r=>setTimeout(r,ms));
    for(let k=0;k<li.length;k++){
      li[k].classList.add('en'); await att(k===li.length-1?420:600);
      li[k].classList.remove('en'); li[k].classList.add('ok'); try{ haptic(); sfx('tick'); }catch(_){}
      const pr=(k+1)/li.length; anneau.style.strokeDashoffset=String(364*(1-pr)); pc.textContent=Math.round(pr*100)+'%';
    }
    c.querySelector('h2').innerHTML=d.name?tp('ob2Ready',E_(d.name)):t('ob2Ready0');
    try{ sfx('goal'); }catch(_){}
    await att(650); occupe=false;
    enregistrer();
  }
  function enregistrer(){
    const perfs=d.noRef?[]:d.perfs.slice().sort((a,b)=>a.m-b.m);
    RECORDS=dedupeRecords(perfs.map(p=>{ const r=REF.find(x=>x[0]===p.m); return {dist:r?r[2]:fmtKmShort(p.m/1000)+' km',meters:p.m,time:fmtTime(p.s),date:todayKey()}; }));
    const find=m=>{ const r=perfs.find(x=>x.m===m); return r?fmtTime(r.s):''; };
    const chosenLang=P.lang, chosenMode=P.mode||'dark', chosenTheme=P.theme||'blue', tx=P.tx;
    const avecCourse=course();
    const goalTxt=avecCourse?((d.cal?d.cal.r.name:raceNom())+(d.goal==='Record personnel'&&d.target?' · '+tp('ob2Aim',fmtTime(d.target)):'')):t('ob2GoalProgress');
    P={
      setupDone:true, joinedAt:Date.now(), lang:chosenLang, mode:chosenMode,
      name:d.name, username:d.username, bday:d.bday, sex:d.sex,
      level:d.level, kmWeek:d.kmUnknown?kmWeekFromLevel(d.level):d.km,
      goal:goalTxt, compDate:avecCourse?d.date:'',
      t5k:find(5000), t3k:find(3000), t1500:find(1500), t10k:find(10000),
      theme:chosenTheme, pb5k:find(5000), pb1500:find(1500), pb10k:find(10000),
      easyMode:d.mode==='simple'
    };
    if(tx) P.tx=tx;
    if(avecCourse){
      Object.assign(P,{objRace:d.race, objRaceKm:d.race==='Autre'?d.raceKm:null, objProfile:d.terrain, objGoal:d.goal,
        objTime:d.goal==='Record personnel'&&d.target?fmtTime(d.target):''});
      if(d.cal && d.cal.r.date===d.date){ const o=raceToObjective(d.cal.r,d.cal.km); P.objRaceId=o.objRaceId; P.objRaceName=o.objRaceName; P.raceFollows=[]; try{ raceFollowSet(d.cal.r,true); }catch(_){} }
    }
    P.vdot=d.noRef?clampVdot(VDOT_NIV[d.level]||40):(computeVDOTfromRecords()||computeVDOT());
    if(d.noRef) P.vdotEstimated=true;
    try{ ikTrack('ob_done',{simple:d.mode==='simple',cal:!!d.cal,guest:!!window.isGuestUser,race:avecCourse,noRef:!!d.noRef}); }catch(_){}
    DB.save('profile',P); DB.save('records',RECORDS); DB.save('xp',XP);
    try{ burst(); }catch(_){}
    if(P.username) claimUsername(P.username).then(ok=>{ if(!ok) toast(t('usernameTakenMeanwhile')); });
    window._launchTourAfterInit=true;
    setTimeout(()=>{ fermer(); initApp(); },300);
  }
  function fermer(){ const o=$('#ob'); if(o){ o.classList.remove('ikob','ikob-q'); } el=null; cur=null; }

  /* course choisie dans le calendrier : elle remplit l'objectif, puis on montre sa fiche */
  function racePicked(r,km){
    if(!el||!d) return false;
    const o=raceToObjective(r,km);
    d.cal={r,km}; d.race=o.objRace; if(o.objRaceKm) d.raceKm=o.objRaceKm; d.date=r.date>=minRaceDate()?r.date:''; d.terrain=o.objProfile||'Plate';
    if(!d.date) toast(t('psDateSoon'));
    aller('detail',1); return true;
  }
  function ouvrir(){ d=neuf(); depuisRecap=false; occupe=false; $('#ob').classList.add('on'); accueil(); }
  return {ouvrir, racePicked, ouvert:()=>!!el||!!(d&&$('#ob.on'))};
})();
