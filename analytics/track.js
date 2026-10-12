/* ============================================================================
   IKORUN — STATISTIQUES D'USAGE ANONYMES (V4.0.0, partie toujours chargée)
   ----------------------------------------------------------------------------
   ikTrack(nom, props) met un événement en file d'attente (localStorage, 300 au
   plus) ; la file part par lots de 50 vers ikorun_track (Supabase) quand le
   réseau est là : 20 s après le dernier événement, au retour en ligne et quand
   l'app passe en arrière-plan. Hors ligne, rien n'est perdu.
   Ce qui part : le nom de l'événement, 2–3 propriétés sans donnée personnelle,
   la langue, la plateforme, « app installée ou non », la version, l'heure, et un
   identifiant ALÉATOIRE de l'installation (jamais le compte, jamais l'email).
   Refus : Profil › Compte et données › Statistiques anonymes (l'identifiant et
   la file sont effacés). Le signal « Global Privacy Control » du navigateur
   vaut refus tant que l'utilisateur n'a pas choisi lui-même.
   Pas de statistiques pendant la suite de fumée ni les simulations.
   ============================================================================ */
const IK_EVQ='ik_evq', IK_AID='ik_aid';
let _ikEvT=0, _ikEvBusy=false;
function ikAnalyticsOn(){
  if(window.__ikSim || /selftest=1/.test(location.search)) return false;
  if(P && P.analytics===false) return false;
  if(P && P.analytics===true) return true;
  try{ if(navigator.globalPrivacyControl===true) return false; }catch(e){}
  return true;
}
function ikAid(){
  try{
    let a=localStorage.getItem(IK_AID);
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(a||'')){
      a=(crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)));
      localStorage.setItem(IK_AID,a);
    }
    return a;
  }catch(e){ return null; }
}
function ikEvPlatform(){
  const p=typeof ikPlatform==='function'?((ikPlatform()||{}).k||''):'';
  if(/^ios/.test(p)) return 'ios';
  if(/^android|^samsung/.test(p)) return 'android';
  if(p==='desktop') return 'desktop';
  const ua=navigator.userAgent||''; return /iphone|ipad|ipod/i.test(ua)?'ios':/android/i.test(ua)?'android':/windows|macintosh|linux|cros/i.test(ua)?'desktop':'other';
}
function ikEvStandalone(){ try{ return !!(matchMedia('(display-mode: standalone)').matches||navigator.standalone); }catch(e){ return false; } }
function ikEvRead(){ try{ const q=JSON.parse(localStorage.getItem(IK_EVQ)||'[]'); return Array.isArray(q)?q:[]; }catch(e){ return []; } }
function ikEvWrite(q){ try{ localStorage.setItem(IK_EVQ,JSON.stringify(q.slice(-300))); }catch(e){} }
// props : uniquement des valeurs courtes (texte ≤ 40, nombres, booléens), 6 clés au plus.
function ikTrack(name,props){
  if(!/^[a-z][a-z0-9_]{1,39}$/.test(name||'') || !ikAnalyticsOn()) return;
  const aid=ikAid(); if(!aid) return;
  let p=null;
  if(props && typeof props==='object'){ p={}; Object.keys(props).slice(0,6).forEach(k=>{ const v=props[k]; if(typeof v==='number'&&isFinite(v)) p[k]=Math.round(v*100)/100; else if(typeof v==='boolean') p[k]=v; else if(typeof v==='string'&&v) p[k]=v.slice(0,40); }); if(!Object.keys(p).length) p=null; }
  const q=ikEvRead();
  q.push({aid,n:name,p,ts:new Date().toISOString(),l:typeof curLang==='function'?curLang():'fr',pf:ikEvPlatform(),st:ikEvStandalone(),v:typeof APP_VERSION!=='undefined'?APP_VERSION:''});
  ikEvWrite(q);
  clearTimeout(_ikEvT); _ikEvT=setTimeout(ikEvFlush,20000);
}
function ikEvFlush(){
  if(_ikEvBusy || !navigator.onLine || !window.supabaseClient || !ikAnalyticsOn()) return Promise.resolve(0);
  const q=ikEvRead(); if(!q.length) return Promise.resolve(0);
  const batch=q.slice(0,50); _ikEvBusy=true;
  return Promise.resolve(window.supabaseClient.rpc('ikorun_track',{p_events:batch})).then(r=>{
    if(r && r.error) return 0;
    // on retire exactement les événements envoyés (d'autres ont pu s'ajouter entre-temps)
    const sent=new Set(batch.map(e=>e.ts+e.n)); ikEvWrite(ikEvRead().filter(e=>!sent.has(e.ts+e.n)));
    return batch.length;
  }).catch(()=>0).finally(()=>{ _ikEvBusy=false; if(ikEvRead().length && navigator.onLine) setTimeout(ikEvFlush,1500); });
}
// Une ouverture par jour suffit pour les actifs (DAU/WAU/MAU) et la rétention.
function ikTrackOpen(){
  try{ const d=todayKey(); if(localStorage.getItem('ik_ev_open')===d) return; localStorage.setItem('ik_ev_open',d); }catch(e){}
  ikTrack('open',{guest:!!window.isGuestUser,plan:!!(typeof PLAN!=='undefined'&&PLAN)});
}
function ikAnalyticsSet(on){
  P.analytics=!!on; DB.save('profile',P);
  if(!on){ try{ localStorage.removeItem(IK_EVQ); localStorage.removeItem(IK_AID); localStorage.removeItem('ik_ev_open'); }catch(e){} }
  else ikTrackOpen();
  toast(t(on?'anOnToast':'anOffToast')); if(typeof refreshPfSheet==='function') refreshPfSheet();
}
function ikAnalyticsCardHTML(){
  const on=ikAnalyticsOn();
  return '<div class="card" style="padding:16px;margin-top:12px"><div class="ap-opt"><div><b>'+t('anTitle')+'</b><span>'+t('anDesc')+'</span></div>'+
    '<div class="toggle'+(on?' on':'')+'" role="switch" tabindex="0" aria-checked="'+on+'" aria-label="'+t('anTitle')+'" onclick="ikAnalyticsSet('+(!on)+')"></div></div></div>';
}
// Admin de l'app (calendrier, statistiques) : vérifié une fois par session.
let _ikAdmin=null;
function ikIsAdmin(){
  if(_ikAdmin!==null) return Promise.resolve(_ikAdmin);
  const c=window.supabaseClient, uid=window.currentUserId;
  if(!c||!uid||window.isGuestUser) return Promise.resolve(false);
  return Promise.resolve(c.from('app_admins').select('user_id').eq('user_id',uid).maybeSingle()).then(r=>{ _ikAdmin=!!(r&&r.data); return _ikAdmin; }).catch(()=>false);
}
function openAppStats(){ ikLoad('stats').then(()=>statsOpen()).catch(()=>toast(t('genericErrorRetry'))); }
window.addEventListener('online',()=>setTimeout(ikEvFlush,2000));
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') ikEvFlush(); });
window.addEventListener('appinstalled',()=>ikTrack('install_done',{}));
