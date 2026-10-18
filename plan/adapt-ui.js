/* ============================================================================
   IKORUN — TRANSPARENCE DU MOTEUR D'ADAPTATION (V3.15.0)
   · carte « Ton coach a ajusté ton plan » (Accueil et Sport) : ce qui change, pourquoi,
     « Annuler » si l'ajustement ne touche pas à la sécurité ; pour la sécurité, « Je n'ai plus
     mal » / « Je vais mieux », avec confirmation ;
   · historique des ajustements (date, séance, raison, avant → après) ;
   · check du matin (sommeil, courbatures, humeur : 3 gestes, jamais imposé) ;
   · outil Charge (ACWR) branché sur loadModel(), la même source que le moteur.
   ============================================================================ */
const AD_ICON={pain:'warning',painRepeat:'warning',blockKeep:'warning',painLight:'warning',ill:'health',illKeep:'health',
  gap3:'moon',gap7:'refresh',acwrRisk:'warning',acwrHigh:'gauge',acwrLow:'trend',monotony:'shuffle',ready:'battery',readyNote:'battery',
  fastOnce:'bolt',fastInfo:'bolt',vdotUp:'trend',vdotDown:'trend',slowTrend:'gauge',slowOnce:'gauge',slowExplained:'sun',slowTaper:'flag',
  good:'check',short:'check',race:'flag',missKey:'calendar',missKeyDropped:'calendar',missEasy:'calendar',missTaper:'flag',missFatigue:'moon',safetyBack:'check',legs:'bolt',
  strPain:'warning',strIll:'health',strFatigue:'moon',strMiss:'calendar',strGap:'refresh',injury:'health',injuryOn:'health',injuryP1:'health',injuryP2:'health',injuryP3:'health',injuryDone:'check',injuryRelapse:'warning'};
function adIcon(rule){ const n=AD_ICON[rule]||'gear'; return ICN((typeof ICONS!=='undefined'&&ICONS[n])?n:'gear',16); }
function adSessLine(s,o){
  if(!s) return '—';
  const rest=!s.km||s.baseType==='Repos';
  const lab=rest?t('restTag'):(planSessLabel(s)||s.type||'');
  // même type et même distance : c'est l'allure qui a changé (VDOT), on la montre
  const showPace=!rest && o && o.baseType===s.baseType && Math.abs((+o.km||0)-(+s.km||0))<0.05 && o.pace!==s.pace && s.pace;
  return escHtml(lab)+(rest?'':' · '+hKm(s.km)+' km')+(showPace?' · '+escHtml(s.pace)+'/km':'');
}
function adDiffHTML(e){
  if(!e.before||!e.before.length) return '';
  const A={}; e.after.forEach(s=>{ A[s.id]=s; });
  const rows=e.before.map(b=>{
    const a=A[b.id];
    const moved=a && a.date!==b.date;
    // séance retouchée seulement pour garder la semaine équilibrée (sortie longue la plus longue, +10 %)
    const side=a && !(a.adj && a.adj.r===e.rule) && !(e.rule==='vdotUp'||e.rule==='vdotDown');
    return '<li'+(side?' class="side"':'')+'><span class="ad-d">'+escHtml(fmtDate(b.date))+'</span><span class="ad-b">'+adSessLine(b,a)+'</span><span class="ad-arr" aria-hidden="true">→</span><span class="ad-a">'+(moved?escHtml(fmtDate(a.date))+' · ':'')+adSessLine(a,b)+(side?' <small>'+t('adBalance')+'</small>':'')+'</span></li>';
  });
  const max=5, more=rows.length-max;
  return '<ul class="ad-diff">'+rows.slice(0,max).join('')+'</ul>'+(more>0?'<p class="ad-sub">'+tp('adMoreSessions',more)+'</p>':'');
}
function adEntryHTML(e){
  if(!e) return '';
  const st=e.status;
  let h='<div class="ad-item ad-'+st+(e.safety?' safe':'')+'" data-id="'+escHtml(e.id)+'"><div class="ad-ic">'+adIcon(e.rule)+'</div><div class="ad-body">';
  h+='<p class="ad-msg">'+escHtml(adMsg(e.msg))+'</p>';
  if(e.rebuild && e.vdot) h+='<p class="ad-sub">'+tp('adRebuildSub',fmt1(e.vdot[0]),fmt1(e.vdot[1]))+'</p>';
  h+=e.str?strDiffHTML(e):adDiffHTML(e);
  if(st==='rejected') h+='<p class="ad-sub">'+t('adRejected')+'</p>';
  if(st==='undone') h+='<p class="ad-sub">'+t('adUndoneTag')+'</p>';
  const acts=[];
  if(st==='proposal'){
    acts.push('<button type="button" class="ad-btn main" onclick="adAcceptClick(\''+e.id+'\')">'+tp('adAcceptVdot',(e.step>0?'+':'−')+fmt1(Math.abs(e.step)))+'</button>');
    if(e.rule==='vdotUp') acts.push('<button type="button" class="ad-btn" onclick="adTestClick(\''+e.id+'\')">'+t('adDoTest')+'</button>');
    acts.push('<button type="button" class="ad-btn ghost" onclick="adDeclineClick(\''+e.id+'\')">'+t('adLater')+'</button>');
  } else if(st==='applied'){
    if(e.safety){
      const kind=/^(ill|strIll)/.test(e.rule)?'ill':/^(pain|painRepeat|blockKeep|strPain|injury)/.test(e.rule)?'pain':null;
      if(kind && (kind==='pain'?(adBlockActive(todayKey())||injActive()):adIllActive(todayKey()))) acts.push('<button type="button" class="ad-btn" onclick="adSafetyClick(\''+kind+'\')">'+t(kind==='pain'?'adNoMorePain':'adFeelBetter')+'</button>');
    } else if(e.before&&e.before.length||e.rebuild||e.vdot) acts.push('<button type="button" class="ad-btn ghost" onclick="adUndoClick(\''+e.id+'\')">'+t('adUndo')+'</button>');
  }
  if(acts.length) h+='<div class="ad-acts">'+acts.join('')+'</div>';
  return h+'</div></div>';
}
// Muscu : « 5 → 4 exercices » par séance (la liste détaillée est dans la séance elle-même).
function strDiffHTML(e){
  if(!e.before||!e.before.length) return '';
  const A={}; (e.after||[]).forEach(s=>{ A[s.id]=s; });
  const rows=e.before.map(b=>{ const a=A[b.id]||b; const reh=(a.ex||[]).filter(x=>x.rehab).length;
    return '<li><span class="ad-d">'+escHtml(fmtDate(b.date))+'</span><span class="ad-b">'+escHtml(b.title||'')+'</span><span class="ad-arr" aria-hidden="true">→</span><span class="ad-a">'+(a.skipped&&!b.skipped?escHtml(t('restTag')):escHtml(tp('adStrDiff',(b.ex||[]).length,(a.ex||[]).length)+(reh?' · '+tp('adStrRehab',reh):'')))+'</span></li>'; });
  const max=5, more=rows.length-max;
  return '<ul class="ad-diff">'+rows.slice(0,max).join('')+'</ul>'+(more>0?'<p class="ad-sub">'+tp('adMoreSessions',more)+'</p>':'');
}
function adMarkSeen(){ let n=0; (ADAPT_LOG||[]).forEach(e=>{ if(!e.seen && e.status!=='proposal'){ e.seen=true; e.ut=adNowTs(); n++; } }); if(n) DB.save('adapt_log',ADAPT_LOG); }
function adRefresh(){ try{ refreshScreen(); }catch(e){}
  const pb=document.getElementById('progBody'); if(pb && pb.querySelector('.ik-inj-hero')){ if(injActive()) renderInjury(); else closeOv('ovProg'); } const h=document.getElementById('adHistBody'); if(h && document.getElementById('ovProg').classList.contains('on')) openAdaptHistory(); }
function adUndoClick(id){
  const e=adEntry(id); if(!e) return;
  customConfirm(t('adUndoConfirm'),()=>{
    const r=adaptUndo(id);
    toast(r.ok?t('adUndoDone'):t(r.why||'adUndoNothing'));
    adRefresh();
  },{title:t('adUndo'),yesLabel:t('adUndo')});
}
function adAcceptClick(id){ const r=adaptAcceptVdot(id); toast(r.ok?adMsg(r.entry.msg):t('adRejected')); adRefresh(); }
function adDeclineClick(id){ adaptDecline(id); adRefresh(); }
function adTestClick(id){ adaptDecline(id); toast(t('adTestHint')); try{ openRecords(); }catch(e){} }
function adSafetyClick(kind){
  customConfirm(t(kind==='pain'?(injActive()?'injNextConfirm':'adNoMorePainConfirm'):'adFeelBetterConfirm'),()=>{
    const n=adaptClearSafety(kind);
    toast(t(n?'adSafetyCleared':'adSafetyClearedNone'));
    adRefresh();
  },{title:t(kind==='pain'?'adNoMorePain':'adFeelBetter'),yesLabel:t('adConfirmYes')});
}
function openAdaptHistory(){
  const list=(ADAPT_LOG||[]).filter(e=>e.status!=='note').slice().reverse();
  let h='<div id="adHistBody">';
  if(!list.length) h+='<div class="empty"><div class="em-ic">'+ICN('gear',32,'currentColor')+'</div><div>'+t('adHistoryEmpty')+'</div></div>';
  let day=null;
  list.forEach(e=>{
    if(e.date!==day){ day=e.date; h+='<div class="ad-hday">'+escHtml(fmtDate(day))+'</div>'; }
    h+=adEntryHTML(e);
  });
  h+='<p class="ad-foot">'+t('adHistoryFoot')+'</p></div>';
  if(!document.getElementById('ovProg').classList.contains('on')) openOv('ovProg');
  $('#ovProgTitle').textContent=t('adHistory');
  $('#progBody').innerHTML=h;
  adMarkSeen();
}

/* ---------- CHECK DU MATIN ---------- */
let _mc={};
function morningCheckDue(){
  if(!P||!PLAN||P.morningCheck===false||P.easyMode) return false;
  const k=todayKey(); if(P.mcHide===k || adCheckinOf(k)) return false;
  return ikNow().getHours()<14;
}
function morningCheckHTML(){
  if(!morningCheckDue()) return '';
  const row=(f,lab,opts)=>'<div class="mc-row"><span>'+lab+'</span><div class="mc-opts" role="radiogroup" aria-label="'+escHtml(lab)+'">'+opts.map(([v,txt,aria])=>'<button type="button" class="mc-o'+(_mc[f]===v?' on':'')+'" role="radio" aria-checked="'+(_mc[f]===v)+'"'+(aria?' aria-label="'+escHtml(aria)+'"':'')+' onclick="mcSet(\''+f+'\','+v+')">'+txt+'</button>').join('')+'</div></div>';
  return '<section class="mc-card" aria-label="'+t('mcTitle')+'"><div class="mc-h"><b>'+t('mcTitle')+'</b><button type="button" class="ad-link" onclick="mcHide()">'+t('mcLater')+'</button></div>'+
    row('sleep',t('mcSleep'),[[1,t('blSleepBad')],[2,t('blSleepMid')],[3,t('blSleepGood')]])+
    row('sore',t('mcSore'),[[1,t('mcSore1')],[2,t('mcSore2')],[3,t('mcSore3')]])+
    row('mood',t('blMood'),MOOD_FACE.map((f,i)=>[i+1,f,t('blMood'+(i+1))]))+'</section>';
}
function mcHide(){ P.mcHide=todayKey(); _mc={}; DB.save('profile',P); refreshScreen(); }
function mcSet(f,v){
  _mc[f]=v; haptic();
  if(_mc.sleep && _mc.sore && _mc.mood){
    ikTrack('morning_check',{});
    CHECKINS=(CHECKINS||[]).filter(c=>c.date>=adKeyAdd(todayKey(),-60)).concat({id:'c'+todayKey(),ut:adNowTs(),date:todayKey(),sleep:_mc.sleep,sore:_mc.sore,mood:_mc.mood});
    _mc={};
    DB.save('checkins',CHECKINS);
    const rd=adaptReadiness();
    const entries=adaptAfterCheckin();
    try{ if(typeof athleteStatusSync==='function') athleteStatusSync(); }catch(e){}
    if(entries.some(e=>e.status==='applied')) renderAdaptResult(entries,{});
    else toast(rd?tp('mcThanks',rd.score):t('adCheckinNoted'));
    refreshScreen();
    return;
  }
  const card=document.querySelector('.mc-card'); if(card) card.outerHTML=morningCheckHTML();
}
// Petite pastille de forme (Accueil), seulement s'il y a des données du jour.

/* ---------- OUTIL CHARGE (ACWR), même calcul que le moteur ---------- */
function renderLoadTool(){
  const m=loadModel(), r=m.acwr, rd=adaptReadiness();
  let status,col;
  if(r==null){ status=m.hist?tp('acwrNeedHistory',Math.max(0,21-m.hist)):t('noDataLab'); col='--dim'; }
  else if(r<0.8){status=t('acwrUnder');col='--platine';} else if(r<=1.3){status=t('acwrOptimal');col='--ok';} else if(r<=1.5){status=t('acwrHigh');col='--warn';} else {status=t('acwrRisk');col='--bad';}
  let h='<div class="card" style="text-align:center"><div class="man" style="font-size:42px;font-weight:800;color:var('+col+')">'+(r==null?'—':fmtN(r,2))+'</div><div class="lab">'+t('acwrRatioLab')+'</div><div class="badge" style="margin-top:10px;background:color-mix(in srgb,var('+col+') 10%,transparent);color:var('+col+')">'+status+'</div></div>';
  h+='<div class="sgrid"><div class="sbox"><div class="v">'+Math.round(m.acute)+'</div><div class="l">'+t('acwrAcuteLab')+'</div></div><div class="sbox"><div class="v">'+Math.round(m.chronic)+'</div><div class="l">'+t('acwrChronicLab')+'</div></div>'+
    '<div class="sbox"><div class="v">'+(m.monotony!=null?fmtN(m.monotony,1):'—')+'</div><div class="l">'+t('loadMonotony')+'</div></div><div class="sbox"><div class="v">'+(m.strain!=null?Math.round(m.strain):'—')+'</div><div class="l">'+t('loadStrain')+'</div></div></div>';
  // 4 dernières semaines, charge par jour
  const max=Math.max(1,...m.days.map(d=>d.l));
  h+='<div class="card"><div class="card-t">'+t('load28Title')+'</div><div class="ld-bars" role="img" aria-label="'+t('load28Title')+'">'+m.days.map(d=>'<i style="height:'+Math.round(d.l/max*100)+'%" title="'+escHtml(fmtDate(d.d)+' · '+Math.round(d.l))+'"></i>').join('')+'</div><div class="ld-leg"><span>'+escHtml(fmtDate(m.days[0].d))+'</span><span>'+t('today')+'</span></div></div>';
  if(rd) h+='<div class="card"><div class="row"><div class="card-t" style="margin:0">'+t('rdTitle')+'</div><b class="rd-big rd-'+rd.level+'">'+rd.score+'</b></div><div class="lab" style="margin-top:6px">'+t('rdLevel_'+rd.level)+' · '+t(rd.src==='checkin'?'rdFromCheckin':'rdFromBilan')+'</div></div>';
  h+='<div class="tip" style="margin-top:12px">'+t('acwrTip')+'</div>';
  $('#outBody').innerHTML=h;
}

/* ---------- FORME PARTAGÉE AVEC LE CLUB (table athlete_status, consentement) ----------
   Rien ne part sans « Partager ma forme avec l'encadrement » (P.shareClub). La zone et
   l'intensité d'une douleur seulement avec « Inclure le détail des douleurs » (P.shareDetail).
   Retirer le consentement supprime la ligne côté serveur. */
let _asT=null;
function athleteStatusSync(now){
  clearTimeout(_asT);
  if(window.__ikSim || !window.supabaseClient || !window.currentUserId || !navigator.onLine) return;
  _asT=setTimeout(async()=>{
    try{
      if(!P.shareClub){
        if(P.statusShared){ const {error}=await window.supabaseClient.from('athlete_status').delete().eq('user_id',window.currentUserId); if(!error){ P.statusShared=false; DB.save('profile',P); } }
        return;
      }
      const m=loadModel(), rd=adaptReadiness(), k=todayKey();
      const pain=(SESSLOG||[]).filter(e=>e.v===2 && e.pain && e.pain.on && e.date>=adKeyAdd(k,-3)).sort((a,b)=>(b.ts||0)-(a.ts||0))[0];
      const painOn=!!pain && !(adState().painClearedAt>=pain.date) || adBlockActive(k);
      const row={user_id:window.currentUserId,share_club:true,share_detail:!!P.shareDetail,
        acute:Math.round(m.acute*10)/10,chronic:Math.round(m.chronic*10)/10,acwr:m.acwr!=null?Math.round(m.acwr*100)/100:null,
        monotony:m.monotony!=null?Math.round(Math.min(50,m.monotony)*10)/10:null,readiness:rd?rd.score:null,pain_on:painOn,
        pain_zone:(painOn&&P.shareDetail&&pain)?(pain.pain.zone+(pain.pain.side?'_'+pain.pain.side:'')):null,
        pain_level:(painOn&&P.shareDetail&&pain)?Math.max(0,Math.min(10,+pain.pain.level||0)):null};
      const {error}=await window.supabaseClient.from('athlete_status').upsert(row,{onConflict:'user_id'});
      if(error) throw error;
      if(!P.statusShared){ P.statusShared=true; DB.save('profile',P); }
    }catch(e){ console.warn('[IKORUN] athlete_status',e&&e.message); }
  },now?0:3000);
}
function clubShareCardHTML(){
  return '<div class="card cs-card"><div class="ap-opt"><div><b>'+t('csShareTitle')+'</b><span>'+t('csShareSub')+'</span></div>'+
    '<div class="toggle'+(P.shareClub?' on':'')+'" role="switch" aria-checked="'+!!P.shareClub+'" aria-label="'+t('csShareTitle')+'" onclick="clubShareToggle(\'shareClub\')"></div></div>'+
    (P.shareClub?'<div class="ap-opt"><div><b>'+t('csDetailTitle')+'</b><span>'+t('csDetailSub')+'</span></div>'+
    '<div class="toggle'+(P.shareDetail?' on':'')+'" role="switch" aria-checked="'+!!P.shareDetail+'" aria-label="'+t('csDetailTitle')+'" onclick="clubShareToggle(\'shareDetail\')"></div></div>':'')+'</div>';
}
function clubShareToggle(f){
  P[f]=!P[f]; if(f==='shareClub' && !P.shareClub) P.shareDetail=false;
  DB.save('profile',P); athleteStatusSync(true); renderClubTab(); haptic();
  toast(t(f==='shareClub'?(P.shareClub?'csSharedOn':'csSharedOff'):(P.shareDetail?'csDetailOn':'csDetailOff')));
}
// Encadrants (propriétaire, admins) : la forme des membres qui l'ont partagée.
let clubStatusCache={id:null,rows:null,err:null};
async function loadClubStatus(clubId){
  clubStatusCache={id:clubId,rows:null,err:null};
  try{
    const {data,error}=await window.supabaseClient.rpc('ikorun_club_member_status',{p_club_id:clubId});
    if(error) throw error;
    clubStatusCache.rows=data||[];
  }catch(e){ clubStatusCache.err=String(e&&e.message||e); }
  if(clubCache.activeId===clubId) renderClubTab();
}
function clubStatusHTML(c,nMembers){
  if(clubStatusCache.id!==c.id){ loadClubStatus(c.id); return '<div class="sec-lab">'+t('csTeamTitle')+'</div><div class="card"><div class="lab">'+t('loadingLab')+'</div></div>'; }
  let h='<div class="sec-lab">'+t('csTeamTitle')+'</div>';
  if(clubStatusCache.err) return h+'<div class="card"><div class="lab">'+t(/not_admin/.test(clubStatusCache.err)?'csNotAdmin':'friendsLoadError')+'</div></div>';
  const rows=clubStatusCache.rows||[];
  const others=Math.max(0,nMembers-1), hidden=Math.max(0,others-rows.length);
  if(!rows.length) return h+'<div class="card"><div class="lab">'+t('csTeamEmpty')+'</div></div>';
  const lvl=r=>r==null?'':r<45?'low':r<60?'caution':r>=80?'good':'ok';
  const acw=a=>a==null?'dim':a>1.5?'bad':a>1.3?'warn':a<0.8?'platine':'ok';
  h+='<div class="card cs-team">'+rows.map(r=>
    '<div class="cs-row"><div class="cs-who"><b>'+escHtml(r.username||'?')+'</b><span>'+escHtml(ikDate(new Date(r.updated_at),'dm',{day:'numeric',month:'short'}))+'</span></div>'+
    '<div class="cs-m"><span class="cs-k">ACWR</span><b style="color:var(--'+acw(r.acwr)+')">'+(r.acwr!=null?fmtN(r.acwr,2):'—')+'</b></div>'+
    '<div class="cs-m"><span class="cs-k">'+t('rdTitle')+'</span><b class="rd-'+lvl(r.readiness)+'">'+(r.readiness!=null?r.readiness:'—')+'</b></div>'+
    '<div class="cs-m"><span class="cs-k">'+t('csPain')+'</span><b'+(r.pain_on?' style="color:var(--bad)"':'')+'>'+(r.pain_on?(r.pain_zone?escHtml(adZoneName(r.pain_zone))+(r.pain_level!=null?' '+r.pain_level+'/10':''):t('blYes')):t('blNo'))+'</b></div></div>').join('')+'</div>';
  if(hidden) h+='<p class="ad-foot">'+tp('csHiddenN',hidden)+'</p>';
  return h;
}
