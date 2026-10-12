/* ============================================================================
   IKORUN — DONNÉES DES INVITÉS (V4.0.0)
   ----------------------------------------------------------------------------
   Un invité est un compte anonyme Supabase : ses données sont copiées sur le serveur, mais
   personne ne peut se reconnecter à un compte anonyme. Si l'app est effacée, si le stockage
   du navigateur est vidé ou si on change de téléphone, elles sont perdues. D'où :
   · navigator.storage.persist() — demandé après le 1er bilan validé et à l'installation ;
     état affiché dans Profil › Compte (« stockage protégé ») ;
   · invitation à créer un compte : après 3 séances validées ou 3 jours d'usage, puis au plus
     une fois tous les 3 jours ; jamais pendant une séance ni avec une fenêtre ouverte ;
   · conversion qui garde le même identifiant (updateUser, linkIdentity — app.js) et, si
     l'adresse ou le compte Google existe déjà, FUSION : une copie chiffrée complète des
     données de l'invité est gardée sur l'appareil, on ouvre le compte existant, on fusionne
     date par date (listes par identifiant ou par date et type, la version modifiée le plus
     récemment gagne, sans doublon ; profil champ par champ ; plan le plus récent), on envoie
     le résultat au serveur puis on efface la copie ;
   · export / import .json version 3 (toutes les clés), format et version vérifiés, au choix
     « fusionner » ou « remplacer ».
   ============================================================================ */
const IK_KEYS=['profile','sessions','muscu_sessions','custom_progs','run_plan','daily_goals','agenda','xp','records','prefs','weightlog','tracker','sesslog','muscu_pr','checkins','adapt_log'];
const IK_EXPORT_VERSION=3;
function ikSnapshot(){
  const g={profile:P,sessions:SESS,muscu_sessions:MSESS,custom_progs:CUSTOM,run_plan:PLAN,daily_goals:GOALS,agenda:AGENDA,xp:XP,records:RECORDS,prefs:PREFS,
    weightlog:WEIGHTLOG,tracker:TRACKER,sesslog:SESSLOG,muscu_pr:MUSCU_PR,checkins:CHECKINS,adapt_log:ADAPT_LOG};
  return JSON.parse(JSON.stringify(g));
}
function ikApplySnapshot(d){
  P=d.profile||P; SESS=d.sessions||[]; MSESS=d.muscu_sessions||[]; CUSTOM=d.custom_progs||[]; PLAN=d.run_plan||null; GOALS=d.daily_goals||{};
  AGENDA=d.agenda||[]; XP=d.xp||XP; RECORDS=dedupeRecords(d.records||[]); PREFS=d.prefs||{}; WEIGHTLOG=d.weightlog||[]; TRACKER=d.tracker||null;
  SESSLOG=d.sesslog||[]; MUSCU_PR=d.muscu_pr||{}; CHECKINS=d.checkins||[]; ADAPT_LOG=d.adapt_log||[];
}
/* ---------- fusion de deux jeux de données ---------- */
// Signature d'une entrée : son identifiant, sinon la date et ce qui la distingue dans sa liste.
function ikSig(key,x){
  if(!x || typeof x!=='object') return JSON.stringify(x);
  if(x.id!=null) return 'id:'+x.id;
  if(key==='sessions') return [x.date,x.type,Math.round((+x.km||0)*10),Math.round(+x.duration||0)].join('|');
  if(key==='muscu_sessions') return [x.date,x.progName||'',Math.round(+x.duration||0),Math.round(+x.tonnage||0)].join('|');
  if(key==='records') return [x.meters||x.dist,x.time,x.date].join('|');
  if(key==='weightlog') return [x.date,x.w].join('|');
  if(key==='sesslog') return [x.date,x.title||'',x.ts||''].join('|');
  return (x.date||'')+'|'+(x.type||'')+'|'+JSON.stringify(x).length;
}
function ikMergeList(key,a,b){
  const out=[], at=new Map();
  (a||[]).concat(b||[]).forEach(x=>{
    const s=ikSig(key,x);
    if(!at.has(s)){ at.set(s,out.length); out.push(x); }
    else { const i=at.get(s); if((+(x&&x.ut)||0)>(+(out[i]&&out[i].ut)||0)) out[i]=x; }
  });
  if(out.every(x=>x && x.date)) out.sort((p,q)=>p.date<q.date?-1:p.date>q.date?1:0);
  return out;
}
// Fusionne src (invité, fichier) dans les données courantes ; rend le nombre d'entrées ajoutées.
function ikMergeInto(src){
  const cur=ikSnapshot(), added={};
  const lists=['sessions','muscu_sessions','custom_progs','agenda','records','weightlog','sesslog','checkins','adapt_log'];
  lists.forEach(k=>{ if(!Array.isArray(src[k])) return; const before=(cur[k]||[]).length; cur[k]=ikMergeList(k,cur[k]||[],src[k]); added[k]=cur[k].length-before; });
  // profil : le compte garde ses valeurs, l'invité complète ce qui manque
  if(src.profile && typeof src.profile==='object'){
    const p=cur.profile||{};
    Object.keys(src.profile).forEach(f=>{ const v=p[f]; if(v==null || v==='' || (Array.isArray(v)&&!v.length)) p[f]=src.profile[f]; });
    p.setupDone=!!(p.setupDone||src.profile.setupDone);
    cur.profile=p;
  }
  // plan : le plus récent (date de création, puis nombre de séances faites)
  const pa=cur.run_plan, pb=src.run_plan;
  if(pb && pb.sessions && (!pa || !pa.sessions || (pb.created||'')>(pa.created||'') || ((pb.created||'')===(pa.created||'') && pb.sessions.filter(s=>s.done).length>pa.sessions.filter(s=>s.done).length))) { cur.run_plan=pb; added.plan=1; }
  if(src.xp && (+src.xp.total||0)>(+(cur.xp&&cur.xp.total)||0)) cur.xp=src.xp;
  ['prefs','tracker','daily_goals'].forEach(k=>{ if(src[k] && (!cur[k] || !Object.keys(cur[k]).length)) cur[k]=src[k]; });
  if(src.muscu_pr && typeof src.muscu_pr==='object'){ cur.muscu_pr=cur.muscu_pr||{}; Object.keys(src.muscu_pr).forEach(ex=>{ const a=cur.muscu_pr[ex], b=src.muscu_pr[ex]; if(a==null || (+((b&&b.w)||b)||0)>(+((a&&a.w)||a)||0)) cur.muscu_pr[ex]=b; }); }
  ikApplySnapshot(cur);
  return added;
}
/* ---------- stockage protégé ---------- */
let _persistState=null;
async function ikStoragePersist(ask){
  try{
    if(!navigator.storage || !navigator.storage.persisted) { _persistState='unsupported'; return _persistState; }
    let ok=await navigator.storage.persisted();
    if(!ok && ask && navigator.storage.persist) ok=await navigator.storage.persist();
    _persistState=ok?'yes':'no';
  }catch(e){ _persistState='unsupported'; }
  return _persistState;
}
function guestAfterBilan(){
  ikStoragePersist(true);
  P.validated=(+P.validated||0)+1; DB.save('profile',P);
}
window.addEventListener('appinstalled',()=>{ try{ ikStoragePersist(true); }catch(e){} });
function storageStatusHTML(){
  if(_persistState===null){ ikStoragePersist(false).then(()=>{ const el=document.getElementById('ikPersist'); if(el) el.outerHTML=storageStatusHTML(); }); }
  const st=_persistState||'…';
  return '<div class="ik-persist '+(st==='yes'?'ok':'')+'" id="ikPersist">'+ICN(st==='yes'?'shield':'warning',15)+'<span><b>'+t(st==='yes'?'persistYes':st==='unsupported'?'persistUnsupported':'persistNo')+'</b>'+
    (st==='no'?'<button type="button" class="ad-link" onclick="ikStoragePersist(true).then(s=>{ toast(t(s===\'yes\'?\'persistYes\':\'persistRefused\')); refreshPfSheet(); })">'+t('persistAsk')+'</button>':'')+'</span></div>';
}
// « Données liées à ce téléphone » (compte invité) — Profil › Compte.
function guestLocalBadgeHTML(){ return window.isGuestUser?'<div class="ik-local">'+ICN('lock',14)+'<span>'+t('guestLocalOnly')+'</span></div>':''; }
/* ---------- invitation à créer un compte ---------- */
function guestNudgeDue(){
  if(!window.isGuestUser || !P || !P.setupDone || P.pendingEmail) return false;
  if(typeof LIVE!=='undefined' && LIVE) return false;
  if(document.querySelector('.ov.on')) return false;
  const days=P.joinedAt?Math.floor((Date.now()-P.joinedAt)/864e5):0, sessions=(SESS||[]).length+(MSESS||[]).length;
  if(!((+P.validated||0)>=3 || sessions>=3 || days>=3)) return false;
  return !(P.guestNudgeAt && Date.now()-P.guestNudgeAt<3*864e5);
}
function guestNudgeHTML(){
  if(!guestNudgeDue()) return '';
  const n=(SESS||[]).length+(MSESS||[]).length;
  return '<section class="gn-card" role="region" aria-label="'+t('gnTitle')+'"><div class="gn-ic">'+ICN('shield',20)+'</div><div class="gn-b"><b>'+t('gnTitle')+'</b><span>'+tp('gnSub',n)+'</span>'+
    '<div class="gn-a"><button type="button" class="ad-btn main" onclick="guestNudgeLater(true);openProfileSection(\'account\')">'+t('gnCreate')+'</button><button type="button" class="ad-btn ghost" onclick="guestNudgeLater()">'+t('adLater')+'</button></div></div></section>';
}
function guestNudgeLater(go){ P.guestNudgeAt=Date.now(); DB.save('profile',P); if(!go) refreshScreen(); try{ if(typeof ikTrack==='function') ikTrack(go?'guest_nudge_accept':'guest_nudge_later',{}); }catch(e){} }

/* ---------- invité → compte EXISTANT : copie chiffrée, connexion, fusion ---------- */
const GM_DB='ikorun_merge', GM_STORE='snap';
function gmIdb(){ return new Promise((ok,ko)=>{ const r=indexedDB.open(GM_DB,1); r.onupgradeneeded=()=>r.result.createObjectStore(GM_STORE); r.onsuccess=()=>ok(r.result); r.onerror=()=>ko(r.error); }); }
async function gmPut(v){ const db=await gmIdb(); await new Promise((ok,ko)=>{ const q=db.transaction(GM_STORE,'readwrite').objectStore(GM_STORE).put(v,'pending'); q.onsuccess=()=>ok(); q.onerror=()=>ko(q.error); }); }
async function gmGet(){ const db=await gmIdb(); return new Promise((ok,ko)=>{ const q=db.transaction(GM_STORE,'readonly').objectStore(GM_STORE).get('pending'); q.onsuccess=()=>ok(q.result||null); q.onerror=()=>ko(q.error); }); }
async function gmDel(){ try{ const db=await gmIdb(); await new Promise(ok=>{ const q=db.transaction(GM_STORE,'readwrite').objectStore(GM_STORE).delete('pending'); q.onsuccess=()=>ok(); q.onerror=()=>ok(); }); }catch(e){} }
// Chiffrée avec la clé de l'appareil (AES-GCM, non exportable, celle des données locales).
async function guestMergePrepare(){
  const key=await VVVCrypto.ready(), iv=crypto.getRandomValues(new Uint8Array(12));
  const body=new TextEncoder().encode(JSON.stringify({uid:window.currentUserId,ts:Date.now(),data:ikSnapshot()}));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,body);
  await gmPut({iv,ct,ts:Date.now(),uid:window.currentUserId});
}
// Appelée par finishLogin, juste après la lecture des données du compte.
async function guestMergeResume(uid,isAnon){
  if(isAnon) return 0;
  let rec=null; try{ rec=await gmGet(); }catch(e){ return 0; }
  if(!rec) return 0;
  if(rec.uid===uid || Date.now()-rec.ts>30*864e5){ await gmDel(); return 0; }
  let snap;
  try{ const key=await VVVCrypto.ready(); snap=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:rec.iv},key,rec.ct))); }
  catch(e){ console.error('[IKORUN] fusion invité : copie illisible',e); return 0; }
  const added=ikMergeInto(snap.data||{});
  saveAll(); // envoyé au serveur sous le compte existant
  await gmDel();
  const n=(added.sessions||0)+(added.muscu_sessions||0);
  setTimeout(()=>toast(tp('gmDone',n)),1200);
  try{ if(typeof ikTrack==='function') ikTrack('guest_merged',{n}); }catch(e){}
  return n;
}
// Écran : l'adresse (ou le compte Google) a déjà un compte.
function guestExistingHTML(email){
  return '<div class="card gm-card"><b>'+t('gmTitle')+'</b><p>'+t('gmSub')+'</p>'+
    '<div class="field"><label>'+t('emailLabel')+'</label><input class="inp" id="gmEmail" type="email" autocomplete="email" autocapitalize="off" value="'+escHtml(email||'')+'"></div>'+
    '<div class="field"><label>'+t('passwordLabel')+'</label><input class="inp" id="gmPass" type="password" autocomplete="current-password"></div>'+
    '<div class="uname-status" id="gmStatus"></div>'+
    '<button class="btn" onclick="guestMergeLogin()">'+t('gmLoginBtn')+'</button>'+
    '<div class="login-or">'+t('orDividerLabel')+'</div>'+
    '<button class="gbtn" onclick="guestMergeGoogle()"><span class="gicon">'+GOOGLE_ICON_SVG+'</span>'+t('gmGoogleBtn')+'</button></div>';
}
function openGuestExisting(email){ openOv('ovProg'); $('#ovProgTitle').textContent=t('gmTitle'); $('#progBody').innerHTML=guestExistingHTML(email); }
async function guestMergeLogin(){
  const email=(($('#gmEmail')||{}).value||'').trim(), pass=(($('#gmPass')||{}).value)||'';
  const st=$('#gmStatus'), say=(m,k)=>{ if(st){ st.textContent=m; st.className='uname-status'+(k?' '+k:''); } };
  if(!isEmailValid(email)) return say(t('invalidEmailToast'),'bad');
  if(!pass) return say(t('passwordTooShortToast'),'bad');
  say(t('gmSaving'),'checking');
  try{
    await flushSaveSoon(); await guestMergePrepare();
    const { error } = await withAuthTimeout(window.supabaseClient.auth.signInWithPassword({email,password:pass}));
    if(error){ await gmDel(); return say(/invalid/i.test(error.message||'')?t('gmBadLogin'):isAuthRateLimit(error)?t('emailRateLimitToast'):t('authGenericErrorToast'),'bad'); }
    say(t('gmMerging'),'checking');
    // le compte change : on redémarre l'app, qui lit le compte puis fusionne (finishLogin)
    setTimeout(()=>location.reload(),300);
  }catch(e){ await gmDel(); say(e&&e.message==='auth_timeout'?t('authTimeoutToast'):t('authGenericErrorToast'),'bad'); }
}
async function guestMergeGoogle(){
  try{ await flushSaveSoon(); await guestMergePrepare(); }catch(e){ toast(t('genericErrorRetry')); return; }
  signInWithGoogle(); // retour sur l'app, puis finishLogin → guestMergeResume
}

/* ---------- export / import .json (version 3) ---------- */
function exportData(){
  ikTrack('export_data',{});
  const snap=ikSnapshot();
  const data={app:'IKORUN',exportVersion:IK_EXPORT_VERSION,appVersion:APP_VERSION,date:new Date().toISOString(),keys:IK_KEYS,data:snap};
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='ikorun-'+todayKey()+'.json'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
  toast(t('exportGenerated'));
}
// Lit un fichier v3 ({app, exportVersion, data}) ou v2/v1 (champs à plat) ; rend {data} nettoyé, ou {err}.
function ikParseExport(text){
  let d; try{ d=JSON.parse(text); }catch(e){ return {err:'invalidFile'}; }
  if(!d || typeof d!=='object' || Array.isArray(d)) return {err:'invalidFile'};
  let src;
  if(d.app==='IKORUN' && d.data && typeof d.data==='object'){
    if(+d.exportVersion>IK_EXPORT_VERSION) return {err:'importTooNew'};
    src=d.data;
  } else if(d.profile || d.sessions){ // ancien format (V2, V1)
    src={profile:d.profile,sessions:d.sessions,muscu_sessions:d.muscu,custom_progs:d.custom,run_plan:d.plan,daily_goals:d.goals,agenda:d.agenda,xp:d.xp,
      records:d.records,sesslog:d.sesslog,weightlog:d.weightlog,tracker:d.tracker,prefs:d.prefs};
  } else return {err:'invalidFile'};
  const out={};
  if(src.profile && typeof src.profile==='object' && !Array.isArray(src.profile)) out.profile=cleanImportedProfile(src.profile);
  if(Array.isArray(src.sessions)) out.sessions=ikCleanSess(src.sessions);
  if(Array.isArray(src.muscu_sessions)) out.muscu_sessions=ikCleanSess(src.muscu_sessions);
  ['custom_progs','agenda','records','sesslog','weightlog','checkins','adapt_log'].forEach(k=>{ if(Array.isArray(src[k])) out[k]=cleanImportedDeep(src[k]).filter(x=>x&&typeof x==='object'); });
  if(src.run_plan && typeof src.run_plan==='object' && Array.isArray(src.run_plan.sessions)) out.run_plan=cleanImportedDeep(src.run_plan);
  ['daily_goals','tracker','prefs','muscu_pr'].forEach(k=>{ if(src[k] && typeof src[k]==='object' && !Array.isArray(src[k])) out[k]=cleanImportedDeep(src[k]); });
  if(src.xp && typeof src.xp==='object'){ const nx={}; ['total','level','pastGoalXP'].forEach(k=>{ const n=Number(src.xp[k]); if(Number.isFinite(n)&&n>=0) nx[k]=n; }); if(typeof src.xp.name==='string') nx.name=stripHtmlChars(src.xp.name).slice(0,40); out.xp=Object.assign({total:0,level:1,name:'Recrue',pastGoalXP:0},nx); }
  return {data:out,version:+d.exportVersion||2,date:d.date||null};
}
// Les séances d'un fichier : types imposés, longueurs bornées, nombres plausibles (un fichier peut être fabriqué).
function ikCleanSess(arr){
  return arr.filter(x=>x&&typeof x==='object'&&!Array.isArray(x)).slice(0,5000).map(x=>{
    const o={};
    ['date','title','type','baseType','pace','progName','feel','pain'].forEach(k=>{ if(typeof x[k]==='string') o[k]=stripHtmlChars(x[k]).slice(0,120); });
    ['km','duration','rpe','tonnage','sets','reps','calories','deniv','sessRef','ut','planSessionId'].forEach(k=>{ const n=Number(x[k]); if(Number.isFinite(n)) o[k]=n; });
    if(Array.isArray(x.muscles)) o.muscles=x.muscles.filter(m=>typeof m==='string').slice(0,40).map(m=>m.slice(0,40));
    if(typeof x.provisional==='boolean') o.provisional=x.provisional;
    if(o.date && !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) delete o.date;
    return o;
  }).filter(o=>o.date);
}
let _importPending=null;
function importData(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json';
  inp.onchange=e=>{ const f=e.target.files[0]; if(!f) return;
    if(f.size>20*1024*1024){ toast(t('invalidFile')); return; }
    const r=new FileReader();
    r.onload=()=>{ const p=ikParseExport(r.result); if(p.err){ toast(t(p.err)); return; } _importPending=p; openImportChoice(); };
    r.readAsText(f); };
  inp.click();
}
function openImportChoice(){
  const p=_importPending; if(!p) return;
  const n=k=>(p.data[k]||[]).length;
  openOv('ovProg'); $('#ovProgTitle').textContent=t('importTitle');
  $('#progBody').innerHTML='<div class="card"><p class="ad-msg">'+tp('importSummary',n('sessions'),n('muscu_sessions'),n('records'))+(p.date?' · '+escHtml(fmtDate(String(p.date).slice(0,10))):'')+'</p></div>'+
    '<button class="btn" style="margin-top:12px" onclick="applyImport(\'merge\')">'+t('importMerge')+'</button><p class="ad-foot" style="margin-top:6px">'+t('importMergeSub')+'</p>'+
    '<button class="btn ghost" style="margin-top:12px" onclick="applyImport(\'replace\')">'+t('importReplace')+'</button><p class="ad-foot" style="margin-top:6px">'+t('importReplaceSub')+'</p>';
}
function applyImport(mode){
  const p=_importPending; if(!p) return;
  ikTrack('import_data',{mode:mode||''});
  const go=()=>{
    if(mode==='replace'){ const cur=ikSnapshot(); IK_KEYS.forEach(k=>{ if(p.data[k]!==undefined) cur[k]=p.data[k]; }); ikApplySnapshot(cur); }
    else ikMergeInto(p.data);
    _importPending=null;
    P.vdot=computeVDOTfromRecords()||computeVDOT();
    saveAll(); refreshXP(); closeOv('ovProg');
    toast(t('dataImported')); applyTheme(); try{ renderProfile(); }catch(e){}
  };
  if(mode==='replace') customConfirm(t('importReplaceConfirm'),go,{danger:true,yesLabel:t('importReplace')}); else go();
}
