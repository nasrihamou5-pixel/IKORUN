/* ============================================================================
   IKORUN — INSCRIPTION (V4.10.0), sur le modèle de l'assistant de KORE
   ----------------------------------------------------------------------------
   Une question par écran (moteur commun : ui/flow.js, ikFlow). Tout s'affiche dans
   #ob (les gardes « #ob.on » du reste de l'app restent valables).
   Parties : Toi (prénom, pseudo, sexe, naissance) → Course (niveau, km/sem, chrono,
   course visée, date et objectif) → Ton app (affichage, couleur) → récapitulatif →
   construction de l'espace. Les données sont écrites dans P comme avant, plus ce que
   l'inscription demande désormais ; « Configurer mon plan » reprend tout à la 1re génération.
   ============================================================================ */
const IKOB=(()=>{
  let d=null, F=null;
  const E_=ikfEsc, tile=ikfTile;
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
  const course=()=>!!d.race&&d.race!=='aucune';
  function neuf(){
    return {name:'', username:'', unameAuto:true, sex:null, bday:'', level:null, km:null, kmUnknown:false,
      race:null, raceKm:15, date:'', terrain:'Plate', goal:'Finir', target:0, cal:null,
      perfs:[], refM:5000, noRef:false, mode:null};
  }
  function vdotPerfs(){ let b=0; d.perfs.forEach(p=>{ const v=vdotFromRace(p.m,p.s); if(v>b) b=v; }); return b?clampVdot(b):0; }

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
      corps(c,F){ c.appendChild(F.liste(LEVELS.map(l=>({v:l[0],ic:l[3],t:t(l[1]),s:t(l[2])})),v=>d.level===v,v=>{ if(d.level!==v&&!d.kmUnknown) d.km=null; d.level=v; })); },
      ok:()=>!!d.level},
    {id:'volume',sec:'course',titre:()=>t('ob2KmT'),sous:()=>t('ob2KmS'),
      corps(c,F){ if(d.km==null) d.km=kmWeekFromLevel(d.level);
        c.appendChild(F.champs([{t:t('ob2KmLab'),aff:()=>d.kmUnknown?t('ob2KmUnknown'):tp('ob2KmVal',d.km),vide:()=>d.kmUnknown,
          ouvre:fin=>pickInt(t('ob2KmLab'),0,160,Math.round(d.km/5)*5,'km',v=>{ d.km=v; d.kmUnknown=false; fin(); },5)}]));
        c.appendChild(F.note(t('ob2KmNote'))); },
      lien:{t:()=>t('ob2KmDontKnow'),f:()=>{ d.kmUnknown=true; d.km=kmWeekFromLevel(d.level); F.suivant(true); }},
      ok:()=>true},
    {id:'chrono',sec:'course',titre:()=>t('ob2RefT'),sous:()=>t('ob2RefS'),
      corps(c,F){ const zone=document.createElement('div');
        const defS=m=>Math.round(predictTime(VDOT_NIV[d.level]||40,m)/5)*5;
        const dessiner=()=>{ zone.innerHTML='';
          let p=d.perfs.find(x=>x.m===d.refM);
          zone.appendChild(F.bloc(t('ob2Dist'),F.seg(REF.map(r=>({v:String(r[0]),t:refLab(r[0])})),v=>String(d.refM)===v,v=>{ d.refM=+v; dessiner(); },3)));
          zone.appendChild(F.bloc('',F.champs([{t:tp('ob2RefTimeFor',refLab(d.refM)),vide:()=>!p,aff:()=>p?fmtTime(p.s):t('chooseWord'),
            ouvre:fin=>pickTime(tp('timeForLab',refLab(d.refM)),p?p.s:defS(d.refM),v=>{ const g=recordGuard(d.refM,v); if(!g.ok){ toast(g.msg); return; }
              p=d.perfs.find(x=>x.m===d.refM); if(p) p.s=v; else d.perfs.push(p={m:d.refM,s:v}); d.noRef=false; fin(); dessiner(); },d.refM>=15000)}])));
          const autres=d.perfs.filter(x=>x!==p);
          if(autres.length){
            const L=ikfMk(autres.map(x=>`<div class="ikob-perf"><span>${refLab(x.m)}</span><b>${fmtTime(x.s)}</b><button type="button" data-m="${x.m}" aria-label="${E_(t('deleteLab2'))}">${ICN('close',15)}</button></div>`).join(''),'ikob-perfs');
            L.addEventListener('click',e=>{ const b=e.target.closest('button[data-m]'); if(!b) return; ikfTic(); d.perfs=d.perfs.filter(x=>x.m!==+b.dataset.m); dessiner(); F.maj(); });
            zone.appendChild(F.bloc(t('ob2RefOthers'),L));
          }
          zone.appendChild(F.note(d.perfs.length?(d.perfs.length<REF.length?t('ob2RefMoreNote'):''):t('ob2RefWhy')));
        };
        dessiner(); c.appendChild(zone); },
      lien:{t:()=>t('ob2RefNone'),f:()=>{ d.noRef=true; d.perfs=[]; toast(t('ob2RefNoneToast')); F.suivant(true); }},
      ok:()=>d.perfs.length>0},
    {id:'course',sec:'course',auto:true,titre:()=>t('ob2RaceT'),sous:()=>t('ob2RaceS'),
      corps(c,F){ c.appendChild(F.liste(RACES(),v=>d.race===v,v=>{ if(d.race!==v) d.cal=null; d.race=v; })); },
      lien:{t:()=>t('racePickFromCal'),f:()=>{ try{ openRaces({pick:'onboarding'}); }catch(e){} }},
      ok:()=>!!d.race},
    {id:'detail',sec:'course',si:course,titre:()=>d.cal?E_(d.cal.r.name):t('ob2RaceDetT'),sous:()=>t('ob2RaceDetS'),
      corps(c,F){ const min=new Date(minRaceDate()+'T12:00:00'), max=new Date(min.getFullYear()+3,11,31,12);
        const L=[{t:t('ob2RaceDate'),vide:()=>!d.date,aff:()=>d.date?ikfDate(d.date):t('chooseWord'),
          ouvre:fin=>ikfPickDate(t('ob2RaceDate'),d.date||ikfDk(new Date(min.getTime()+77*864e5)),min,max,v=>{ if(d.cal&&v!==d.cal.r.date) d.cal=null; d.date=v; fin(); })}];
        if(d.race==='Autre') L.push({t:t('ob2Dist'),aff:()=>fmtKmShort(d.raceKm)+' km',ouvre:fin=>pickDistance(t('ob2Dist'),d.raceKm,km=>{ if(km>=1){ d.raceKm=km; fin(); } })});
        c.appendChild(F.champs(L));
        c.appendChild(F.bloc(t('ob2Terrain'),F.seg([{v:'Plate',t:t('ob2Flat')},{v:'Vallonnée',t:t('ob2Hilly')},{v:'Montagne',t:t('ob2Mountain')}],v=>d.terrain===v,v=>{ d.terrain=v; })));
        const zone=document.createElement('div');
        const dessiner=()=>{ zone.innerHTML=''; if(d.goal!=='Record personnel') return;
          if(!d.target){ const v=d.noRef?VDOT_NIV[d.level]:(vdotPerfs()||VDOT_NIV[d.level]||40); d.target=Math.round(predictTime(v||40,raceMetersOf(d.race,d.raceKm))/30)*30; }
          zone.appendChild(F.bloc('',F.champs([{t:t('ob2Target'),aff:()=>fmtTime(d.target),ouvre:fin=>pickTime(t('ob2Target'),d.target,v=>{ if(v>0){ d.target=v; fin(); } },true)}]))); };
        c.appendChild(F.bloc(t('ob2GoalLab'),F.liste([{v:'Finir',t:t('ob2GoalFinish'),s:t('ob2GoalFinishS')},{v:'Record personnel',t:t('ob2GoalTime'),s:t('ob2GoalTimeS')}],v=>d.goal===v,v=>{ d.goal=v; dessiner(); })));
        c.appendChild(zone); dessiner(); },
      ok:()=>!!d.date&&d.date>=minRaceDate()},
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
          {ic:'run',t:t('ob2SecRun'),v:[lv?t(lv[1]):'',d.kmUnknown?'':tp('ob2KmVal',d.km)].filter(Boolean).join(' · '),go:'niveau'},
          {ic:'flag',t:t('ob2RowGoal'),v:course()?[d.cal?d.cal.r.name:raceNom(),ikfDate(d.date),d.goal==='Record personnel'&&d.target?tp('ob2Aim',fmtTime(d.target)):t('ob2GoalFinish')].join(' · '):t('ob2RaceNone'),go:'course'},
          {ic:'stopwatch',t:t('ob2RowPerf'),v:d.noRef?t('ob2RefEstimated'):d.perfs.map(x=>refLab(x.m)+' '+fmtTime(x.s)).join(' · '),go:'chrono'},
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
      resume:{toi:()=>[d.name,tp('ob2AgeYears',ageDe(d.bday))].join(' · '),course:()=>course()?raceNom():t('ob2RaceNone'),app:()=>''},
      nb:{course:()=>t('ob2EtRunSub'),app:()=>t('ob2EtAppSub')}},
    finalLabel:()=>t('ob2Create'),
    onFirstBack:()=>accueil(),
    build:{titre:()=>t('ob2BuildT'), steps:()=>[t('ob2B1'),d.noRef?t('ob2B2e'):t('ob2B2'),t('ob2B3'),t('ob2B4')],
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
    setTimeout(()=>{ if(F) F.fermer(); initApp(); },300);
  }

  /* course choisie dans le calendrier : elle remplit l'objectif, puis on montre sa fiche */
  function racePicked(r,km){
    if(!F||!F.ouvert()||!d) return false;
    const o=raceToObjective(r,km);
    d.cal={r,km}; d.race=o.objRace; if(o.objRaceKm) d.raceKm=o.objRaceKm; d.date=r.date>=minRaceDate()?r.date:''; d.terrain=o.objProfile||'Plate';
    if(!d.date) toast(t('psDateSoon'));
    F.aller('detail',1); return true;
  }
  function ouvrir(){ d=neuf(); F=null; $('#ob').classList.add('on'); accueil(); }
  return {ouvrir, racePicked};
})();
