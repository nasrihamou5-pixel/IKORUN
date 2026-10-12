/* ============================================================================
   IKORUN — GUIDE D'INSTALLATION (V4.0.0)
   ----------------------------------------------------------------------------
   Détection précise du navigateur :
   · iOS Safari ; iOS Chrome / Edge / Firefox (depuis iOS 16.4 ils savent ajouter à l'écran
     d'accueil par leur menu Partager ; avant, il faut ouvrir la page dans Safari) ;
   · Android Chrome (vraie invite d'installation, beforeinstallprompt), Samsung Internet,
     Firefox Android, autres ;
   · navigateurs intégrés à une app (WhatsApp, Instagram, Facebook, Messenger, TikTok,
     Telegram, Snapchat, LINE) : l'installation y est impossible → aide visuelle pour ouvrir
     le vrai navigateur, lien intent:// vers Chrome sur Android, « Copier le lien » partout ;
   · app déjà installée (standalone) : jamais de guide.
   Étapes illustrées et animées (schémas du bon téléphone, couleur du thème), sans animation
   en « mouvement réduit ». Moments : juste après le premier plan, puis un rappel discret au
   plus tous les 7 jours sur l'Accueil ; toujours accessible dans Profil.
   ============================================================================ */
const INAPP=[['WhatsApp',/WhatsApp/i],['Instagram',/Instagram/i],['Messenger',/FBAN\/Messenger|MessengerForiOS|Orca-Android|FB_IAB\/Orca/i],
  ['Facebook',/FBAN|FBAV|FB_IAB|FBIOS/i],['TikTok',/musical_ly|BytedanceWebview|TikTok|trill/i],['Telegram',/Telegram/i],['Snapchat',/Snapchat/i],['LINE',/\bLine\//i]];
function ikPlatform(ua){
  ua=ua||navigator.userAgent||'';
  const ios=/iphone|ipad|ipod/i.test(ua) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1 && !ua.includes('Android'));
  const android=/android/i.test(ua);
  const ipad=/ipad/i.test(ua) || (ios && !/iphone|ipod/i.test(ua));
  const m=ua.match(/OS (\d+)[_.](\d+)/), iosV=m?(+m[1]+(+m[2])/100):(ios?17:0);
  if(typeof isStandalone==='function' && isStandalone()) return {k:'installed',ios,android};
  const inapp=INAPP.find(x=>x[1].test(ua));
  if(inapp) return {k:'inapp',app:inapp[0],ios,android,ipad};
  if(ios){
    const other=/CriOS/.test(ua)?'Chrome':/FxiOS/.test(ua)?'Firefox':/EdgiOS/.test(ua)?'Edge':/OPiOS|OPT\//.test(ua)?'Opera':null;
    if(!other) return {k:'ios-safari',ios,ipad,iosV};
    return {k:iosV>=16.4?'ios-other':'ios-old',browser:other,ios,ipad,iosV};
  }
  if(android){
    if(/SamsungBrowser/i.test(ua)) return {k:'samsung',android};
    if(/Firefox/i.test(ua)) return {k:'android-firefox',android};
    if(/Chrome\//.test(ua) && !/EdgA|OPR|YaBrowser|MiuiBrowser|HuaweiBrowser|UCBrowser/i.test(ua)) return {k:'android-chrome',android};
    return {k:'android-other',android};
  }
  return {k:'desktop'};
}
function canOfferInstall(){ return ikPlatform().k!=='installed'; }
// Lien pour ouvrir la page dans Chrome depuis un navigateur intégré (Android).
function ikIntentUrl(){ const u=new URL(location.href); return 'intent://'+u.host+u.pathname+'#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url='+encodeURIComponent(u.origin+u.pathname)+';end'; }
async function installApp(){
  const pf=ikPlatform();
  try{ if(typeof ikTrack==='function') ikTrack('install_open',{pf:pf.k}); }catch(e){}
  if(_installPrompt && (pf.k==='android-chrome'||pf.k==='samsung'||pf.k==='desktop'||pf.k==='android-other')){
    _installPrompt.prompt();
    const choice=await _installPrompt.userChoice;
    _installPrompt=null; refreshInstallUI();
    if(choice && choice.outcome==='accepted'){ toast(t('installAcceptedToast')); try{ ikStoragePersist(true); }catch(e){} try{ if(typeof ikTrack==='function') ikTrack('install_accepted',{pf:pf.k}); }catch(e){} }
    return;
  }
  showInstallGuide(pf);
}
/* ---------- schémas : un téléphone et le geste à faire ---------- */
// Écran de l'app en miniature, et l'élément à toucher qui pulse (classe ig-hit).
function igPhone(inner,o){
  o=o||{};
  return '<svg class="ig-ph" viewBox="0 0 120 220" aria-hidden="true"><rect x="6" y="4" width="108" height="212" rx="20" class="ig-body"/><rect x="12" y="12" width="96" height="196" rx="14" class="ig-scr"/>'+
    (o.notch!==false?'<rect x="44" y="16" width="32" height="7" rx="3.5" class="ig-notch"/>':'')+
    '<g class="ig-app"><rect x="20" y="34" width="56" height="7" rx="3.5"/><rect x="20" y="48" width="80" height="34" rx="8" class="ig-card"/><rect x="20" y="88" width="38" height="24" rx="7"/><rect x="62" y="88" width="38" height="24" rx="7"/></g>'+inner+'</svg>';
}
const IG={
  safariBar:hit=>'<rect x="12" y="176" width="96" height="32" rx="0" class="ig-bar"/><rect x="26" y="182" width="68" height="9" rx="4.5" class="ig-url"/>'+
    '<g transform="translate(57 196)"><path d="M-4 3h8v-6M0 -6v8M-3 -3l3-3 3 3" class="ig-ico'+(hit?' ig-hit':'')+'"/></g>'+(hit?'<circle cx="60" cy="196" r="10" class="ig-ring"/>':''),
  shareSheet:hit=>'<rect x="12" y="96" width="96" height="112" rx="12" class="ig-sheet"/><rect x="20" y="106" width="80" height="12" rx="4" class="ig-row"/><rect x="20" y="124" width="80" height="12" rx="4" class="ig-row"/>'+
    '<rect x="20" y="142" width="80" height="14" rx="4" class="ig-row'+(hit?' ig-on':'')+'"/><path d="M26 149h6M29 146v6" class="ig-ico"/><rect x="38" y="147" width="40" height="4" rx="2" class="ig-txt"/>'+(hit?'<rect x="18" y="140" width="84" height="18" rx="6" class="ig-ring"/>':''),
  addDialog:hit=>'<rect x="12" y="12" width="96" height="60" rx="12" class="ig-sheet"/><rect x="18" y="20" width="22" height="22" rx="6" class="ig-icon"/><rect x="46" y="24" width="40" height="5" rx="2.5" class="ig-txt"/><rect x="46" y="34" width="28" height="4" rx="2" class="ig-txt dim"/>'+
    '<rect x="78" y="52" width="24" height="12" rx="5" class="ig-btn'+(hit?' ig-on':'')+'"/>'+(hit?'<rect x="75" y="49" width="30" height="18" rx="7" class="ig-ring"/>':''),
  homeIcon:()=>'<g class="ig-home"><rect x="22" y="40" width="18" height="18" rx="5"/><rect x="51" y="40" width="18" height="18" rx="5"/><rect x="80" y="40" width="18" height="18" rx="5"/><rect x="22" y="70" width="18" height="18" rx="5" class="ig-icon ig-pop"/></g>',
  topMenu:(hit,x)=>'<rect x="12" y="12" width="96" height="24" rx="0" class="ig-bar"/><rect x="20" y="18" width="62" height="10" rx="5" class="ig-url"/>'+
    '<g transform="translate('+(x||96)+' 23)"><circle cx="0" cy="-5" r="1.6" class="ig-dot"/><circle cx="0" cy="0" r="1.6" class="ig-dot"/><circle cx="0" cy="5" r="1.6" class="ig-dot"/></g>'+(hit?'<circle cx="'+(x||96)+'" cy="23" r="9" class="ig-ring"/>':''),
  dropMenu:hit=>'<rect x="46" y="36" width="58" height="76" rx="8" class="ig-sheet"/><rect x="52" y="44" width="46" height="9" rx="3" class="ig-row"/><rect x="52" y="58" width="46" height="9" rx="3" class="ig-row"/>'+
    '<rect x="52" y="72" width="46" height="11" rx="3" class="ig-row'+(hit?' ig-on':'')+'"/><rect x="52" y="88" width="46" height="9" rx="3" class="ig-row"/>'+(hit?'<rect x="49" y="69" width="52" height="17" rx="5" class="ig-ring"/>':''),
  bottomMenu:hit=>'<rect x="12" y="186" width="96" height="22" class="ig-bar"/><g transform="translate(96 197)"><path d="M-5 -4h10M-5 0h10M-5 4h10" class="ig-ico'+(hit?' ig-hit':'')+'"/></g>'+(hit?'<circle cx="96" cy="197" r="9" class="ig-ring"/>':''),
  inappMenu:hit=>'<rect x="12" y="12" width="96" height="22" class="ig-bar"/><path d="M20 23h8" class="ig-ico"/><g transform="translate(98 23)"><circle cx="-5" cy="0" r="1.6" class="ig-dot"/><circle cx="0" cy="0" r="1.6" class="ig-dot"/><circle cx="5" cy="0" r="1.6" class="ig-dot"/></g>'+(hit?'<circle cx="98" cy="23" r="10" class="ig-ring"/>':'')
};
function igStep(n,svg,txt){ return '<li class="ig-step"><div class="ig-fig">'+svg+'</div><div class="ig-txt-b"><span class="ig-n">'+n+'</span><p>'+txt+'</p></div></li>'; }
function installStepsHTML(pf){
  const S=[], k=pf.k;
  if(k==='ios-safari'){
    S.push(igStep(1,igPhone(pf.ipad?IG.topMenu(true,92):IG.safariBar(true)),t(pf.ipad?'igIosShareTop':'igIosShare')));
    S.push(igStep(2,igPhone(IG.shareSheet(true)),t('igIosAddHome')));
    S.push(igStep(3,igPhone(IG.addDialog(true)),t('igIosAdd')));
  } else if(k==='ios-other'){
    S.push(igStep(1,igPhone(pf.browser==='Chrome'?IG.topMenu(true,92):IG.bottomMenu(true)),tp('igIosOtherShare',pf.browser)));
    S.push(igStep(2,igPhone(IG.shareSheet(true)),t('igIosAddHome')));
    S.push(igStep(3,igPhone(IG.addDialog(true)),t('igIosAdd')));
  } else if(k==='ios-old'){
    S.push(igStep(1,igPhone(IG.topMenu(true,92)),tp('igIosOld',pf.browser)));
    S.push(igStep(2,igPhone(IG.safariBar(true)),t('igIosShare')));
    S.push(igStep(3,igPhone(IG.shareSheet(true)),t('igIosAddHome')));
  } else if(k==='android-chrome'||k==='android-other'){
    S.push(igStep(1,igPhone(IG.topMenu(true),{notch:false}),t('igAndMenu')));
    S.push(igStep(2,igPhone(IG.topMenu(false)+IG.dropMenu(true),{notch:false}),t('igAndInstall')));
    S.push(igStep(3,igPhone(IG.addDialog(true),{notch:false}),t('igAndConfirm')));
  } else if(k==='samsung'){
    S.push(igStep(1,igPhone(IG.bottomMenu(true),{notch:false}),t('igSamMenu')));
    S.push(igStep(2,igPhone(IG.shareSheet(true),{notch:false}),t('igSamAdd')));
    S.push(igStep(3,igPhone(IG.addDialog(true),{notch:false}),t('igSamHome')));
  } else if(k==='android-firefox'){
    S.push(igStep(1,igPhone(IG.bottomMenu(true),{notch:false}),t('igFfMenu')));
    S.push(igStep(2,igPhone(IG.shareSheet(true),{notch:false}),t('igFfInstall')));
  } else if(k==='inapp'){
    S.push(igStep(1,igPhone(IG.inappMenu(true),{notch:!pf.android}),tp(pf.ios?'igInappIos':'igInappAnd',pf.app)));
    S.push(igStep(2,igPhone(IG.inappMenu(false)+IG.dropMenu(true),{notch:!pf.android}),t(pf.ios?'igInappIos2':'igInappAnd2')));
  } else {
    S.push(igStep(1,igPhone(IG.topMenu(true,88),{notch:false}),t('igDesk')));
  }
  S.push(igStep(S.length+1,igPhone(IG.homeIcon(),{notch:!pf.android}),t('igDone')));
  return '<ol class="ig-steps">'+S.join('')+'</ol>';
}
function showInstallGuide(pf){
  pf=pf&&pf.k?pf:ikPlatform();
  if(pf.k==='installed'){ toast(t('igAlready')); return; }
  let h='<div class="ig-hero"><div class="ig-logo"><div class="ik-logo-mark" role="img" aria-label="IKORUN"></div></div><div><b>'+t('igTitle')+'</b><span>'+t('igBenefits')+'</span></div></div>';
  if(pf.k==='inapp'){
    h+='<div class="ig-warn">'+ICN('warning',15)+'<span>'+tp('igInappWarn',pf.app)+'</span></div>';
    if(pf.android) h+='<a class="btn" style="display:flex;justify-content:center;margin:12px 0 4px" href="'+escHtml(ikIntentUrl())+'">'+t('igOpenChrome')+'</a>';
  }
  if(_installPrompt && pf.k!=='inapp' && !pf.ios) h+='<button class="btn" style="margin:12px 0 4px" onclick="installApp()">'+ICN('download',16)+' '+t('installAppBtn')+'</button><p class="ad-foot" style="margin-top:2px">'+t('igOrManual')+'</p>';
  h+=installStepsHTML(pf);
  h+='<div class="ig-acts"><button type="button" class="btn ghost sm" onclick="installCopyLink()">'+ICN('copy',15)+' '+t('igCopyLink')+'</button><button type="button" class="btn sm" onclick="closeOv(\'ovProg\')">'+t('understoodLab')+'</button></div>';
  if(!document.getElementById('ovProg').classList.contains('on')) openOv('ovProg');
  $('#ovProgTitle').textContent=t('installAppBtn'); $('#progBody').innerHTML=h; $('#ovProg').style.zIndex=topZ();
}
function installCopyLink(){ const u=location.origin+'/'; try{ navigator.clipboard.writeText(u).then(()=>toast(t('igLinkCopied')),()=>toast(u)); }catch(e){ toast(u); } }
// Juste après le premier plan généré : une fois.
function installAfterPlan(){
  if(P.installShown1 || !canOfferInstall()) return;
  P.installShown1=Date.now(); P.installNudgeAt=Date.now(); DB.save('profile',P);
  setTimeout(()=>{ if(!document.querySelector('.ov.on')) showInstallGuide(); },3200);
}
// Rappel discret sur l'Accueil, au plus tous les 7 jours, jamais pendant une séance.
function installNudgeHTML(){
  if(!P || !canOfferInstall() || !P.installShown1) return '';
  if(typeof LIVE!=='undefined' && LIVE) return '';
  if(P.installNudgeAt && Date.now()-P.installNudgeAt<7*864e5) return '';
  const pf=ikPlatform();
  return '<section class="gn-card ig-nudge"><div class="gn-ic">'+ICN('download',20)+'</div><div class="gn-b"><b>'+t(pf.k==='inapp'?'igNudgeInapp':'igNudgeTitle')+'</b><span>'+t('igBenefits')+'</span>'+
    '<div class="gn-a"><button type="button" class="ad-btn main" onclick="installNudgeLater();installApp()">'+t(pf.k==='inapp'?'igOpenBrowser':'installAppBtn')+'</button><button type="button" class="ad-btn ghost" onclick="installNudgeLater();refreshScreen()">'+t('adLater')+'</button></div></div></section>';
}
function installNudgeLater(){ P.installNudgeAt=Date.now(); DB.save('profile',P); }
