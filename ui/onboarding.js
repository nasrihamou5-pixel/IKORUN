/* ============================================================================
   IKORUN — INSCRIPTION (V4.10.0), sur le modèle de l'assistant de KORE
   ----------------------------------------------------------------------------
   Une question par écran (moteur commun : ui/flow.js, ikFlow). Tout s'affiche dans
   #ob (les gardes « #ob.on » du reste de l'app restent valables).
   Parties : Toi (prénom, pseudo, sexe, naissance) → Course (niveau) → Ton app
   (affichage, couleur) → récapitulatif → construction de l'espace → tutoriel.
   V4.11.1 : PROFIL SEULEMENT. Chronos, course, date, objectif et jours se demandent à la
   création du plan (ui/plan-flow.js), que le tutoriel ouvre à sa dernière étape.
   ============================================================================ */
const IKOB=(()=>{
  let d=null, F=null;
  const E_=ikfEsc, tile=ikfTile;
  const LEVELS=[['Débutant','lvlBeginner','ob2LvlDeb','seedling'],['Intermédiaire','lvlIntermediate','ob2LvlInt','run'],['Confirmé','lvlAdvanced','ob2LvlConf','bolt'],
    ['Très avancé','lvlVeryAdvanced','ob2LvlTa','fire'],['Élite','lvlElite','ob2LvlEl','medal']];
  // VDOT de départ quand on n'a aucun chrono : volontairement prudente, le test de fin de bloc la corrige
  const VDOT_NIV={'Débutant':32,'Intermédiaire':40,'Confirmé':47,'Très avancé':54,'Élite':62};
  const ageDe=b=>{ if(!b) return 0; const x=new Date(b+'T00:00:00'); return Math.floor((ikNow()-x)/31557600000); };
  function neuf(){
    return {name:'', username:'', unameAuto:true, sex:null, bday:'', level:null, mode:null};
  }

  const SCREENS=[
    {id:'nom',sec:'toi',titre:()=>t('ob2NameT'),sous:()=>t('ob2NameS'),
      corps(c,F){ const i=document.createElement('input'); i.className='ikob-champ'; i.type='text'; i.maxLength=30; i.autocomplete='given-name'; i.autocapitalize='words'; i.enterKeyHint='next';
        i.placeholder=t('firstNamePh'); i.value=d.name; i.dir='auto';
        i.addEventListener('input',()=>{ d.name=i.value.trim(); F.maj(); }); i.addEventListener('keydown',e=>{ if(e.key==='Enter'&&d.name){ e.preventDefault(); F.suivant(true); } });
        c.appendChild(i); setTimeout(()=>{ try{ i.focus({preventScroll:true}); }catch(e){} },420); },
      ok:()=>d.name.length>0},
    {id:'pseudo',sec:'toi',titre:()=>t('ob2UserT'),sous:()=>t('ob2UserS'),
      corps(c,F){
        const W=ikfMk(`<div class="ikob-at"><span>@</span><input class="ikob-champ" id="ikobUser" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="20" dir="ltr"></div><div class="uname-status" id="ikobUserSt"></div>`);
        c.appendChild(W);
        const i=W.querySelector('input'), st=W.querySelector('#ikobUserSt'); i.placeholder=t('usernamePh'); i.value=d.username;
        let deb=null;
        i.addEventListener('input',()=>{ d.unameAuto=false; d.username=i.value.trim(); clearTimeout(deb); i._uname={v:d.username,ok:null}; F.maj(); deb=setTimeout(()=>checkUsernameLive(i.value,st,i).then(()=>F.maj()),380); });
        i.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); F.suivant(true); } });
        if(d.unameAuto && d.name){
          st.textContent=t('checkingLab'); st.className='uname-status checking'; i._uname={v:'',ok:null};
          suggestAvailableUsername(d.name).then(u=>{ if(!F.ouvert()||F.cur()!=='pseudo'||!d.unameAuto) return; d.username=u; i.value=u; checkUsernameLive(u,st,i).then(()=>F.maj()); });
        } else if(d.username) checkUsernameLive(d.username,st,i).then(()=>F.maj());
        else st.textContent=t('usernameFormatHint');
      },
      bloque:()=>{ const u=document.getElementById('ikobUser'); return !!(u&&u._uname&&u._uname.ok===false); },
      avant:async()=>{ // attend le verdict de LA valeur affichée (comme l'ancienne étape)
        const i=document.getElementById('ikobUser'); if(!i) return false; const v=i.value.trim();
        if(!usernameFormatOk(v)){ toast(t('usernameFormatHint')); return false; }
        let s=i._uname; if(!s||s.v!==v||s.ok===null){ await checkUsernameLive(v,document.getElementById('ikobUserSt'),i); s=i._uname; }
        if(!(s&&s.v===v&&(s.ok===true||s.ok==='error'))){ toast(t('usernameUnavailable')); return false; }
        d.username=v; return true; },
      ok:()=>usernameFormatOk(d.username)},
    {id:'sexe',sec:'toi',auto:true,titre:()=>t('ob2SexT'),sous:()=>t('ob2SexS'),
      corps(c,F){ c.appendChild(F.liste([{v:'Homme',t:t('maleLab')},{v:'Femme',t:t('femaleLab')}],v=>d.sex===v,v=>{ d.sex=v; })); },
      ok:()=>!!d.sex},
    {id:'naissance',sec:'toi',titre:()=>t('ob2BdayT'),sous:()=>t('ob2BdayS'),
      corps(c,F){ const now=ikNow(); if(!d.bday) d.bday=ikfDk(new Date(now.getFullYear()-25,0,1,12));
        const b=new Date(d.bday+'T12:00:00'); let D=b.getDate(), M=b.getMonth(), Y=b.getFullYear();
        const poser=()=>{ const nj=new Date(Y,M+1,0).getDate(); d.bday=ikfDk(new Date(Y,M,Math.min(D,nj),12)); lab.innerHTML=tp('ob2AgeYears',ageDe(d.bday)); };
        const mn=i=>{ try{ return new Date(2020,i,1).toLocaleDateString(curLang()==='ar'?'ar':curLang(),{month:'long'}); }catch(e){ return String(i+1); } };
        const W=ikfMk('','ikob-roues'); W.dir='ltr';
        W.appendChild(F.roue(ikfRange(1,31),D,v=>v,v=>{ D=v; poser(); },t('ob2Day')));
        W.appendChild(F.roue(ikfRange(0,11),M,mn,v=>{ M=v; poser(); },t('ob2Month')));
        W.appendChild(F.roue(ikfRange(now.getFullYear()-100,now.getFullYear()-6).reverse(),Y,v=>v,v=>{ Y=v; poser(); },t('ob2Year')));
        c.appendChild(W); const lab=ikfMk('','ikob-age'); c.appendChild(lab); poser(); },
      ok:()=>{ const a=ageDe(d.bday); return a>=6&&a<=100; }},
    /* course */
    {id:'niveau',sec:'course',auto:true,titre:()=>t('ob2LevelT'),sous:()=>t('ob2LevelS'),
      corps(c,F){ c.appendChild(F.liste(LEVELS.map(l=>({v:l[0],ic:l[3],t:t(l[1]),s:t(l[2])})),v=>d.level===v,v=>{ d.level=v; })); },
      ok:()=>!!d.level},
    /* ton app */
    {id:'affichage',sec:'app',auto:true,titre:()=>t('obModeTitle'),sous:()=>t('ob2ModeS'),
      corps(c,F){ c.appendChild(F.liste([{v:'complet',ic:'chart',t:t('obModeFullT'),s:t('obModeFullD')},{v:'simple',ic:'target',t:t('obModeSimpleT'),s:t('obModeSimpleD')}],v=>d.mode===v,v=>{ d.mode=v; }));
        if(!d.mode){ const a=ageDe(d.bday); if(a) c.appendChild(F.note(tp('obModeSuggestion',t(a>26?'obModeSimpleT':'obModeFullT')))); } },
      ok:()=>!!d.mode},
    {id:'style',sec:'app',titre:()=>t('ob2StyleT'),sous:()=>t('ob2StyleS'),
      corps(c){ const W=ikfMk(`<div class="ikob-ligne"><span>${t('theme')}<small>${t('ob2ThemeS')}</small></span><div id="ikobTheme">${pfThemeSwitchHTML()}</div></div>
          <div class="ikob-ligne col"><span>${t('colorLab')}</span><div id="ikobAccent">${pfAccentPickerHTML()}</div></div>`,'ikob-liste');
        // les deux fonctions de l'app s'appliquent en direct ; on redessine juste leurs contrôles
        W.addEventListener('click',e=>{ if(!e.target.closest('.theme-switch,.accent-dot')) return; setTimeout(()=>{ const a=W.querySelector('#ikobAccent'); if(a) a.innerHTML=pfAccentPickerHTML(); const th=W.querySelector('#ikobTheme'); if(th) th.innerHTML=pfThemeSwitchHTML(); },260); },true);
        c.appendChild(W); },
      ok:()=>true},
    /* récapitulatif */
    {id:'recap',sec:'recap',final:true,titre:()=>d.name?tp('ob2RecapT',E_(d.name)):t('ob2RecapT0'),sous:()=>t('ob2RecapS'),
      corps(c,F){
        const sx=d.sex==='Femme'?t('femaleLab'):t('maleLab'), lv=LEVELS.find(l=>l[0]===d.level);
        c.appendChild(F.recap([{ic:'user',t:t('ob2SecYou'),v:[d.name,'@'+d.username,sx,tp('ob2AgeYears',ageDe(d.bday))].join(' · '),go:'nom'},
          {ic:'run',t:t('ob2SecRun'),v:lv?t(lv[1]):'',go:'niveau'},
          {ic:'palette',t:t('ob2SecApp'),v:t(d.mode==='simple'?'obModeSimpleT':'obModeFullT'),go:'affichage'}]));
        c.appendChild(F.note(t('ob2RecapNote'))); },
      ok:()=>true}
  ];
  const CFG=()=>({
    host:$('#ob'), screens:SCREENS, track:'ob_step',
    secs:{toi:()=>t('ob2SecYou'),course:()=>t('ob2SecRun'),app:()=>t('ob2SecApp'),recap:()=>t('ob2SecRecap')},
    inter:{secs:()=>['toi','course','app'], ics:{toi:'user',course:'run',app:'palette'},
      titre:n=>({course:t('ob2EtRun'),app:t('ob2EtApp')})[n]||t('ob2EtNice'),
      sous:p=>(p==='toi'&&d.name)?tp('ob2EtThanks',E_(d.name)):t('ob2EtNext'),
      resume:{toi:()=>[d.name,tp('ob2AgeYears',ageDe(d.bday))].join(' · '),course:()=>{ const l=LEVELS.find(x=>x[0]===d.level); return l?t(l[1]):''; },app:()=>''},
      nb:{course:()=>t('ob2EtRunSub'),app:()=>t('ob2EtAppSub')}},
    finalLabel:()=>t('ob2Create'),
    onFirstBack:()=>accueil(),
    build:{titre:()=>t('ob2BuildT'), steps:()=>[t('ob2B1'),t('ob2B2e'),t('ob2B3'),t('ob2B4')],
      pret:()=>d.name?tp('ob2Ready',E_(d.name)):t('ob2Ready0')},
    onFinish:()=>{ enregistrer(); return false; }
  });

  /* ---------- accueil (langue, ce qu'on va construire, le temps que ça prend) ---------- */
  function accueil(){
    if(F&&F.ouvert()) F.fermer();
    const el=$('#ob'); el.classList.add('ikob'); el.classList.remove('ikob-q');
    const n=SCREENS.filter(e=>!e.si||e.si()).length, min=Math.max(2,Math.round(n*12/60));
    const li=(ic,a,b)=>`<li>${tile(ic,40)}<div><b>${a}</b><small>${b}</small></div></li>`;
    el.innerHTML=`<div class="ikob-acc">
      <div class="ikob-langs" role="radiogroup" aria-label="${E_(t('langLab'))}">${LANGS.map(l=>`<button type="button" role="radio" data-l="${l[0]}" aria-checked="${curLang()===l[0]}">${l[1]}</button>`).join('')}</div>
      <div class="ikh ikh-ob-big ikob-hero"><i class="ikh-fx" aria-hidden="true"></i><div class="login-brand man" role="img" aria-label="IKORUN">IKO<span>RUN</span></div><div class="ikh-sub">Elite Athletic Intelligence</div></div>
      <h1 class="ikob-titre c">${t('ob2Welcome')}</h1>
      <p class="ikob-sous c">${t('ob2WelcomeSub')}</p>
      <div class="ikob-chip">${ICN('timer',15)} ${tp('ob2Chip',min,n)}</div>
      <ul class="ikob-promo">${li('stopwatch',t('ob2Li1T'),t('ob2Li1S'))}${li('calendar',t('ob2Li2T'),t('ob2Li2S'))}${li('heart',t('ob2Li3T'),t('ob2Li3S'))}</ul>
      <div class="ikob-acc-bas"><button type="button" class="btn ikob-go" id="ikobStart">${t('ob2Start')}</button><p class="ikob-note c">${t('ob2Note')}</p></div></div>`;
    el.querySelector('.ikob-langs').addEventListener('click',e=>{ const b=e.target.closest('button[data-l]'); if(!b) return; const l=b.dataset.l; if(l===curLang()) return; ikfTic();
      ikLangEnsure(l).then(ok=>{ if(!ok){ toast(t('offlineLangToast')); return; } setLang(l); if(!(F&&F.ouvert())) accueil(); }); });
    el.querySelector('#ikobStart').addEventListener('click',()=>{ ikfTic(); try{ sfx('start'); }catch(_){} F=ikFlow(CFG()).start('nom'); });
  }

  /* V4.11.1 : l'inscription ne crée plus que le profil. La course, la date, l'objectif, les jours
     et les chronos se demandent à la création du plan (ui/plan-flow.js), juste après le tutoriel.
     En attendant un chrono, la VDOT de départ est estimée selon le niveau (prudente). */
  function enregistrer(){
    RECORDS=[];
    const chosenLang=P.lang, chosenMode=P.mode||'dark', chosenTheme=P.theme||'blue', tx=P.tx;
    P={
      setupDone:true, joinedAt:Date.now(), lang:chosenLang, mode:chosenMode,
      name:d.name, username:d.username, bday:d.bday, sex:d.sex,
      level:d.level, kmWeek:kmWeekFromLevel(d.level), goal:'', compDate:'',
      t5k:'', t3k:'', t1500:'', t10k:'', theme:chosenTheme, pb5k:'', pb1500:'', pb10k:'',
      easyMode:d.mode==='simple'
    };
    if(tx) P.tx=tx;
    P.vdot=clampVdot(VDOT_NIV[d.level]||40); P.vdotEstimated=true;
    try{ ikTrack('ob_done',{simple:d.mode==='simple',guest:!!window.isGuestUser}); }catch(_){}
    DB.save('profile',P); DB.save('records',RECORDS); DB.save('xp',XP);
    try{ burst(); }catch(_){}
    if(P.username) claimUsername(P.username).then(ok=>{ if(!ok) toast(t('usernameTakenMeanwhile')); });
    window._launchTourAfterInit=true;
    setTimeout(()=>{ if(F) F.fermer(); initApp(); },300);
  }
  // le choix d'une course se fait désormais à la création du plan
  function racePicked(){ return false; }
  function ouvrir(){ d=neuf(); F=null; $('#ob').classList.add('on'); accueil(); }
  return {ouvrir, racePicked};
})();
