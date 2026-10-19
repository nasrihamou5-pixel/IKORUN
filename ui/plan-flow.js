/* ============================================================================
   IKORUN — CRÉATION DES PLANS « UNE QUESTION PAR ÉCRAN » (V4.11.0)
   ----------------------------------------------------------------------------
   Même logique que l'inscription (moteur commun : ui/flow.js) pour :
   1. « Configurer mon plan » (course) : situation → course → objectif → jours →
      récapitulatif → construction. Remplit setupTmp puis confirmPlanSetup() : le
      calcul du plan ne change pas. Ce que l'inscription a déjà donné (1re génération)
      n'est pas redemandé : il apparaît au récap, une ligne touchée le rouvre.
   2. « Nouveau plan » (course + muscu) : quoi → plan de course actuel → comment →
      jours de muscu → matériel → récapitulatif → construction. Remplit wiz puis
      wizGenerate() : la génération de la muscu ne change pas.
   ============================================================================ */
let _psFlow=null, _wzFlow=null;

/* ---------------- 1. PLAN DE COURSE ---------------- */
// jours : P.days compte 0 = dimanche (Date.getDay) ; les pastilles, 0 = lundi
const pfJs=i=>(i+1)%7, pfMon=d=>(d+6)%7;
// chronos (V4.11.1 : demandés à la création du plan, plus à l'inscription)
const PF_REF=[[1500,'1 500 m','1500 m'],[3000,'3 000 m','3000 m'],[5000,'5 km','5000 m'],[10000,'10 km','10 km'],[21097,'semi','Semi-marathon'],[42195,'marathon','Marathon']];
function pfRefLab(m){ const r=PF_REF.find(x=>x[0]===m); if(!r) return fmtKmShort(m/1000)+' km'; return r[1]==='semi'?t('ob2Half'):r[1]==='marathon'?t('ob2Marathon'):r[1]; }
function pfRecs(){ return [...(RECORDS||[])].filter(r=>r&&r.time&&r.meters>=VDOT_MIN_M).sort((a,b)=>(a.meters||0)-(b.meters||0)); }
function pfHasRec(){ return pfRecs().length>0; }
function pfSaveRec(m,sec){
  const r=PF_REF.find(x=>x[0]===m), dist=r?r[2]:fmtKmShort(m/1000)+' km', tk=todayKey();
  RECORDS=dedupeRecords((RECORDS||[]).filter(x=>!(x&&x.meters===m&&x.date===tk)).concat([{dist,meters:m,time:fmtTime(sec),date:tk}]));
  const k={5000:'t5k',3000:'t3k',1500:'t1500',10000:'t10k'}[m]; if(k) P[k]=fmtTime(sec);
  const v=computeVDOTfromRecords(); if(v){ P.vdot=v; delete P.vdotEstimated; }
  DB.save('records',RECORDS); saveAll();
}

function psFlowOpen(){
  if(_psFlow&&_psFlow.ouvert()) _psFlow.fermer();
  const s=setupTmp;
  if(s.longDay==null) s.longDay=(PREFS.longDay!==''&&PREFS.longDay!=null&&s.days.includes(+PREFS.longDay))?+PREFS.longDay:'';
  const raceVue=()=>!s.knownRace||s.editRace, goalVue=()=>!s.knownGoal||s.editGoal;
  const sitLab=v=>t({continue:'pf2SitCont',reprise:'pf2SitRep',autre:'pf2SitOth'}[v]||'pf2SitOth');
  const lvlLab=v=>t({deb:'lvlDeb',int:'lvlInt',conf:'lvlConf'}[v]||'lvlInt');
  const gapLab=v=>t({lt1:'gapLt1',m1_3:'gap13',m3_6:'gap36',gt6:'gapGt6'}[v]||'gap13');
  const semaines=()=>planCalendar(s.compDate||psDefaultDate(),s.days).weeks;
  const goalTxt=()=>trGoal(s.objGoal)+(s.objGoal==='Record personnel'&&s.timeS?' · '+fmtTime(s.timeS):'');
  const joursTxt=()=>{ const L=t('dowShort').split(','); return s.days.map(pfMon).sort((a,b)=>a-b).map(i=>L[i]).join(' '); };
  const allureNote=()=>{ const m=raceMetersOf(s.objRace,s.raceKm), pr=psPredicted(s);
    return (s.timeS?tp('psTimePace',fmtSplit(Math.round(s.timeS/(m/1000)))):'')+(pr?' · '+tp('psTimePred',fmtTime(pr)):''); };
  const SC=[
    {id:'p-sit',sec:'sit',auto:true,titre:()=>t('pf2SitT'),sous:()=>t('pf2SitS'),
      corps(c,F){ c.appendChild(F.liste([{v:'continue',ic:'run',t:t('pf2SitCont'),s:t('pf2SitContS')},{v:'reprise',ic:'refresh',t:t('pf2SitRep'),s:t('pf2SitRepS')},
        {v:'autre',ic:'seedling',t:t('pf2SitOth'),s:t('pf2SitOthS')}],v=>s.situation===v,v=>{ s.situation=v; })); },
      ok:()=>!!s.situation},
    {id:'p-gap',sec:'sit',auto:true,si:()=>s.situation==='reprise',titre:()=>t('pf2GapT'),sous:()=>t('psRepHint'),
      corps(c,F){ c.appendChild(F.liste(['lt1','m1_3','m3_6','gt6'].map(v=>({v,t:gapLab(v)})),v=>s.gap===v,v=>{ s.gap=v; })); },
      ok:()=>!!s.gap},
    {id:'p-lvl',sec:'sit',auto:true,si:()=>s.situation==='continue'&&(!s.knownLevel||s.editLevel),titre:()=>t('pf2LvlT'),sous:()=>t('pf2LvlS'),
      corps(c,F){ c.appendChild(F.liste([{v:'deb',ic:'seedling',t:t('lvlDeb'),s:t('pf2LvlDebS')},{v:'int',ic:'run',t:t('lvlInt'),s:t('pf2LvlIntS')},{v:'conf',ic:'bolt',t:t('lvlConf'),s:t('pf2LvlConfS')}],
        v=>s.level===v,v=>{ s.level=v; })); },
      ok:()=>!!s.level},
    /* V4.11.1 : les chronos ne sont plus demandés à l'inscription. Sans chrono enregistré, on le demande ici
       (il fixe toutes les allures) ; « Je n'ai pas de chrono » garde l'estimation selon le niveau. */
    {id:'p-chrono',sec:'sit',si:()=>!pfHasRec()||s.editChrono,titre:()=>t('ob2RefT'),sous:()=>t('ob2RefS'),
      corps(c,F){ if(!s.refM) s.refM=5000; s.editChrono=true;   // reste affiché une fois le 1er chrono posé
        const zone=document.createElement('div');
        const dessiner=()=>{ zone.innerHTML='';
          const recs=pfRecs(), p=recs.find(r=>r.meters===s.refM);
          // V4.11.2 : « Autre » = distance exacte (15 km, 8 km…), choisie à la roue ; 1 500 m minimum (VDOT)
          const std=PF_REF.some(r=>r[0]===s.refM);
          zone.appendChild(F.bloc(t('ob2Dist'),F.seg(PF_REF.map(r=>({v:String(r[0]),t:r[1]==='semi'?t('pf2SemiShort'):pfRefLab(r[0])})).concat([{v:'autre',t:std?t('pf2OtherShort'):pfRefLab(s.refM)}]),
            v=>v==='autre'?!std:String(s.refM)===v,
            v=>{ if(v!=='autre'){ s.refM=+v; dessiner(); return; }
              pickDistance(t('customDistance'),std?15:s.refM/1000,km=>{ const m=Math.round(km*1000); if(m<VDOT_MIN_M){ toast(t('perfMin1500')); return; } s.refM=m; dessiner(); F.maj(); }); dessiner(); },4)));
          zone.appendChild(F.bloc('',F.champs([{t:tp('ob2RefTimeFor',pfRefLab(s.refM)),vide:()=>!p,aff:()=>p?ikfEsc(p.time):t('chooseWord'),
            ouvre:fin=>pickTime(tp('timeForLab',pfRefLab(s.refM)),p?parseTime(p.time):Math.round(predictTime(getUserVDOT()||40,s.refM)/5)*5,v=>{
              const poser=()=>{ pfSaveRec(s.refM,v); s.noRef=false; if(!s.knownGoal||s.editGoal) s.timeS=psPredicted(s); fin(); dessiner(); F.maj(); };
              const g=recordGuard(s.refM,v);
              if(!g.ok){ if(g.soft) customConfirm(tp('recordBigJumpConfirm',Math.round(g.current*10)/10,Math.round(g.implied*10)/10),poser); else toast(g.msg); return; }
              poser(); },s.refM>=15000)}])));
          const autres=recs.filter(r=>r.meters!==s.refM);
          if(autres.length) zone.appendChild(F.bloc(t('ob2RefOthers'),ikfMk(autres.map(r=>`<div class="ikob-perf"><span>${ikfEsc(PF_REF.some(x=>x[0]===r.meters)?pfRefLab(r.meters):r.dist)}</span><b>${ikfEsc(r.time)}</b></div>`).join(''),'ikob-perfs')));
          zone.appendChild(F.note(recs.length?t('ob2RefMoreNote'):t('ob2RefWhy')));
        };
        dessiner(); c.appendChild(zone); },
      lien:{si:()=>!pfHasRec(),t:()=>t('ob2RefNone'),f:()=>{ s.noRef=true; toast(t('ob2RefNoneToast')); _psFlow.suivant(true); }},
      ok:()=>pfHasRec()||!!s.noRef},
    {id:'p-race',sec:'race',auto:true,si:raceVue,titre:()=>t('pf2RaceT'),sous:()=>t('pf2RaceS'),
      corps(c,F){ c.appendChild(F.liste(PS_RACES.map(r=>({v:r,t:trRace(r),s:r==='Semi-marathon'?'21,1 km':r==='Marathon'?'42,2 km':r==='Autre'?t('pf2OtherS'):''})),v=>s.objRace===v,
        v=>{ if(s.objRace!==v){ s.objRace=v; s.timeS=psPredicted(s); } })); },
      lien:{t:()=>t('racePickFromCal'),f:()=>{ try{ openRaces({pick:'plan'}); }catch(e){} }},
      ok:()=>!!s.objRace},
    {id:'p-detail',sec:'race',si:raceVue,titre:()=>psFromRace(s)?ikfEsc(s.raceName):t('ob2RaceDetT'),sous:()=>t('ob2RaceDetS'),
      corps(c,F){ const min=new Date(minRaceDate()+'T12:00:00'), max=new Date(min.getFullYear()+2,11,31,12);
        const zn=F.note('');
        const majNote=()=>{ zn.innerHTML=s.compDate<minRaceDate()?'<span style="color:var(--warn)">'+t('psDateSoon')+'</span>':tp('psDateIn',semaines()); };
        const L=[{t:t('raceDateLabel'),aff:()=>ikfDate(s.compDate),ouvre:fin=>ikfPickDate(t('raceDateLabel'),s.compDate,min,max,v=>{ s.compDate=v; fin(); majNote(); })}];
        if(s.objRace==='Autre') L.push({t:t('psDistLab'),aff:()=>fmtKmShort(s.raceKm)+' km',ouvre:fin=>pickDistance(t('psDistLab'),s.raceKm,km=>{ if(km>=1){ s.raceKm=Math.round(km*10)/10; s.timeS=psPredicted(s); fin(); } })});
        c.appendChild(F.champs(L)); c.appendChild(zn); majNote();
        if(!P.easyMode) c.appendChild(F.bloc(t('courseProfileLabel'),F.seg(['Plate','Vallonnée','Montagne'].map(p=>({v:p,t:trProfile(p)})),v=>s.objProfile===v,v=>{ s.objProfile=v; }))); },
      ok:()=>!!s.compDate&&s.compDate>=minRaceDate()},
    {id:'p-goal',sec:'goal',si:goalVue,titre:()=>t('pf2GoalT'),sous:()=>t('pf2GoalS'),
      corps(c,F){ const zone=document.createElement('div');
        const dessiner=()=>{ zone.innerHTML=''; if(s.objGoal!=='Record personnel') return;
          if(!s.timeS) s.timeS=psPredicted(s);
          const n=F.note(allureNote());
          zone.appendChild(F.bloc('',F.champs([{t:t('psTimeLab'),aff:()=>s.timeS?fmtTime(s.timeS):t('chooseWord'),vide:()=>!s.timeS,
            ouvre:fin=>pickTime(t('psTimeLab'),s.timeS||psPredicted(s),v=>{ if(v>0){ s.timeS=v; fin(); n.innerHTML=allureNote(); } },true)}]),n)); };
        c.appendChild(F.liste([{v:'Finir',ic:'flag',t:trGoal('Finir'),s:t('ob2GoalFinishS')},{v:'Record personnel',ic:'stopwatch',t:trGoal('Record personnel'),s:t('ob2GoalTimeS')}],
          v=>s.objGoal===v,v=>{ s.objGoal=v; dessiner(); }));
        c.appendChild(zone); dessiner(); },
      ok:()=>s.objGoal!=='Record personnel'||s.timeS>0},
    {id:'p-days',sec:'week',titre:()=>t('pf2DaysT'),sous:()=>t('pf2DaysS'),
      corps(c,F){ const zone=document.createElement('div');
        const dessiner=()=>{ zone.innerHTML='';
          if(s.longDay!==''&&!s.days.includes(+s.longDay)) s.longDay='';
          zone.appendChild(F.jours(i=>s.days.includes(pfJs(i)),i=>{ const d=pfJs(i), k=s.days.indexOf(d); if(k>=0) s.days.splice(k,1); else s.days.push(d); dessiner(); F.maj(); },
            s.longDay===''?-1:pfMon(+s.longDay)));
          const vol=planAutoVolume(s);
          zone.appendChild(F.note('<b>'+tp('pf2DaysN',s.days.length)+'</b>'+(s.days.length?' · '+tp('psDateIn',semaines()):'')));
          if(s.days.length>1){ const L=t('dowShort').split(','), ds=s.days.map(pfMon).sort((a,b)=>a-b);
            zone.appendChild(F.bloc(t('pf2LongLab'),F.seg([{v:'',t:t('pf2Auto')}].concat(ds.map(i=>({v:String(pfJs(i)),t:L[i]}))),v=>String(s.longDay)===v,v=>{ s.longDay=v===''?'':+v; dessiner(); }))); }
          if(s.days.length) zone.appendChild(F.note(ICN('shield',14)+' '+tp('psVolume',vol.min,vol.max)));
        };
        dessiner(); c.appendChild(zone); },
      ok:()=>s.days.length>0},
    {id:'p-recap',sec:'recap',final:true,titre:()=>t('pf2RecapT'),sous:()=>t('ob2RecapS'),
      corps(c,F){
        const sit=sitLab(s.situation)+(s.situation==='reprise'?' · '+gapLab(s.gap):s.situation==='continue'?' · '+lvlLab(s.level):'');
        const recs=[...(RECORDS||[])].filter(r=>r&&r.time).sort((a,b)=>(a.meters||0)-(b.meters||0)).slice(0,3);
        const vol=planAutoVolume(s);
        c.appendChild(F.recap([
          {ic:'user',t:t('psSitLab'),v:sit,go:'p-sit',pre:()=>{ s.editLevel=true; }},
          {ic:'flag',t:t('psCardRace'),v:psRaceName(s)+' · '+ikfDate(s.compDate)+' · '+tp('psDateIn',semaines()),go:'p-race',pre:()=>{ s.editRace=true; }},
          {ic:'target',t:t('psCardGoal'),v:goalTxt(),go:'p-goal',pre:()=>{ s.editGoal=true; }},
          {ic:'calendar',t:t('psCardWeek'),v:joursTxt()+' · '+vol.min+'→'+vol.max+' km',go:'p-days'},
          {ic:'stopwatch',t:t('psRecLab'),v:recs.length?recs.map(r=>r.dist+' '+r.time).join(' · '):t('ob2RefEstimated'),go:'p-chrono',pre:()=>{ s.editChrono=true; }}]));
        if(s.knownRace&&!s.editRace) c.appendChild(F.note(ICN('check',13)+' '+t(psFromRace(s)?'psFromCalendar':'psFromSignup')));
        const m=ikfMk(`<button type="button" class="ikob-lien">${ICN('bulb',14)} ${t('mtLink')}</button>`,'ikob-bloc c');
        m.querySelector('button').onclick=()=>{ try{ openMethod(); }catch(e){} }; c.appendChild(m); },
      ok:()=>true}
  ];
  _psFlow=ikFlow({screens:SC, closable:true, track:'ps_step',
    secs:{sit:()=>t('psSitLab'),race:()=>t('psCardRace'),goal:()=>t('psCardGoal'),week:()=>t('psCardWeek'),recap:()=>t('ob2SecRecap')},
    finalLabel:()=>t('generateMyPlanBtn'),
    onCancel:()=>{ try{ if(typeof wizAfterRun!=='undefined') wizAfterRun=false; }catch(e){} },
    build:()=>({titre:()=>t('pf2BuildT'),
      steps:()=>{ const a=[t('pf2B1'),t('pf2B2'),t('pf2B3'),t('pf2B4')]; if(typeof wizAfterRun!=='undefined'&&wizAfterRun) a.push(t('pf2BM')); return a.concat([t('pf2B5')]); },
      run:()=>{ PREFS.longDay=s.longDay; const avant=PLAN; const r=confirmPlanSetup(); return r!==false && PLAN!==avant; },
      pret:()=>t('pf2Ready')}),
    onFinish:()=>{ try{ nav('sport'); }catch(e){} }
  }).start();
  return _psFlow;
}
// course choisie dans le calendrier pendant la configuration : on montre sa fiche
function psFlowRacePicked(){ if(!_psFlow||!_psFlow.ouvert()) return false; setupTmp.editRace=true; _psFlow.aller('p-detail',1); return true; }

/* ---------------- 2. NOUVEAU PLAN (course + muscu) ---------------- */
function wzFlowOpen(start){
  if(_wzFlow&&_wzFlow.ouvert()) _wzFlow.fermer();
  const w=wiz;
  const two=()=>w.what==='both'||w.what==='split';
  const muscuGen=()=>w.what!=='run'&&(two()||w.how==='gen');
  const runFirst=()=>(w.what==='run'&&w.how==='gen')||(two()&&(!PLAN||w.runNew));
  const whatLab=v=>t({both:'wizBoth',split:'wizSplit',run:'wizRun',muscu:'wizMuscu'}[v]);
  const equipLab=v=>t({salle:'wizEquipGym',maison:'wizEquipHome',both:'wizEquipBoth'}[v]||'wizEquipBoth');
  const SC=[
    {id:'w-what',sec:'prog',auto:true,titre:()=>t('pf2WhatT'),sous:()=>t('pf2WhatS'),
      corps(c,F){ c.appendChild(F.liste([{v:'both',ic:'plus',t:t('wizBoth'),s:t('wizBothSub'),tag:t('wizAdvised')},{v:'split',ic:'shuffle',t:t('wizSplit'),s:t('wizSplitSub')},
        {v:'run',ic:'run',t:t('wizRun'),s:t('wizRunSub')},{v:'muscu',ic:'dumbbell',t:t('wizMuscu'),s:t('wizMuscuSub')}],v=>w.what===v,v=>{ w.what=v; if(two()) w.how='gen'; })); },
      lien:{t:()=>t('wizFollowExisting').replace(/\s*›\s*$/,''),f:()=>{ _wzFlow.fermer(); sportTab='run'; runSub='perso'; renderSport(); }},
      ok:()=>!!w.what},
    {id:'w-runnew',sec:'prog',auto:true,si:()=>two()&&!!PLAN,titre:()=>t('pf2RunNewT'),sous:()=>ikfEsc(planRaceTitle()),
      corps(c,F){ c.appendChild(F.liste([{v:'new',ic:'refresh',t:t('wizRunNew'),s:t('pf2RunNewS')},{v:'keep',ic:'check',t:t('wizRunKeep'),s:t('pf2RunKeepS')}],
        v=>(v==='new')===!!w.runNew,v=>{ w.runNew=v==='new'; })); },
      ok:()=>true},
    {id:'w-how',sec:'prog',auto:true,si:()=>!two(),titre:()=>t('pf2HowT'),sous:()=>t('pf2HowS'),
      corps(c,F){ c.appendChild(F.liste([{v:'gen',ic:'bolt',t:t('wizGen'),s:t('wizGenSub')},{v:'self',ic:'edit',t:t('wizSelf'),s:t('wizSelfSub')}],v=>w.how===v,v=>{ w.how=v; })); },
      ok:()=>!!w.how},
    {id:'w-days',sec:'muscu',si:muscuGen,titre:()=>t('pf2MDaysT'),sous:()=>t('pf2MDaysS'),
      corps(c,F){ const zone=document.createElement('div');
        const dessiner=()=>{ zone.innerHTML='';
          zone.appendChild(F.jours(i=>w.days.includes(i),i=>{ const p=w.days.indexOf(i); if(p>=0) w.days.splice(p,1); else if(w.days.length>=3){ toast(t('wizMax3')); return; } else w.days.push(i);
            w.days.sort((a,b)=>a-b); w.perWeek=Math.max(1,w.days.length); dessiner(); F.maj(); }));
          zone.appendChild(F.note('<b>'+tp('wizDaysCount',w.days.length)+'</b>'+(two()?'<br>'+t('wizHowText'):'')));
        };
        dessiner(); c.appendChild(zone); },
      ok:()=>w.days.length>0},
    {id:'w-equip',sec:'muscu',auto:true,si:muscuGen,titre:()=>t('pf2EquipT'),sous:()=>t('pf2EquipS'),
      corps(c,F){ c.appendChild(F.liste([{v:'salle',ic:'dumbbell',t:t('wizEquipGym'),s:t('pf2GymS')},{v:'maison',ic:'user',t:t('wizEquipHome'),s:t('pf2HomeS')},{v:'both',ic:'shuffle',t:t('wizEquipBoth'),s:t('pf2BothS')}],
        v=>w.equip===v,v=>{ w.equip=v; })); },
      ok:()=>!!w.equip},
    {id:'w-recap',sec:'recap',final:true,si:muscuGen,titre:()=>t('pf2WRecapT'),sous:()=>t('ob2RecapS'),
      corps(c,F){ const L=t('dowShort').split(',');
        const rows=[{ic:'target',t:t('pf2RowProg'),v:whatLab(w.what),go:'w-what'}];
        if(two()) rows.push({ic:'run',t:t('pf2RowRun'),v:PLAN?(w.runNew?t('wizRunNew'):t('wizRunKeep')+' · '+planRaceTitle()):t('wizRunNew'),go:PLAN?'w-runnew':'w-what'});
        rows.push({ic:'calendar',t:t('pf2RowDays'),v:w.days.map(i=>L[i]).join(' ')+' · '+tp('comboPerWeek',w.days.length),go:'w-days'},
          {ic:'dumbbell',t:t('wizEquip'),v:equipLab(w.equip),go:'w-equip'});
        c.appendChild(F.recap(rows));
        const rep=wizReplaceNote(w).replace(/<[^>]+>/g,''); if(rep) c.appendChild(F.note(ikfEsc(rep)));
        if(runFirst()) c.appendChild(F.note(ICN('run',14)+' '+t('wizNeedRun'))); },
      ok:()=>true}
  ];
  _wzFlow=ikFlow({screens:SC, closable:true, track:'wz_step',
    secs:{prog:()=>t('pf2SecProg'),muscu:()=>t('pf2SecMuscu'),recap:()=>t('ob2SecRecap')},
    finalLabel:()=>(!two()&&w.how==='self')?t('continueLab'):t(runFirst()?'wizNeedRunBtn':(wizHasPlans(w)?'wizReplaceBtn':'wizGenerate')),
    // muscu générée tout de suite : construction mise en scène ; sinon on passe la main au plan de course
    build:()=>(muscuGen()&&!runFirst())?{titre:()=>t('pf2MBuildT'),
      steps:()=>[t('pf2MB1')].concat(w.what==='both'?[t('pf2MB2')]:[]).concat([t('pf2MB3'),t('pf2MB4')]),
      run:()=>{ const avant=STRENGTH; wizGenerate(); return STRENGTH!==avant; },
      pret:()=>t('pf2MReady')}:null,
    onFinish:()=>{ if(!(muscuGen()&&!runFirst())) setTimeout(wizGenerate,0); }
  }).start(start);
  return _wzFlow;
}

/* ---------------- 3. TON CORPS (taille, poids, cœur) — V4.11.3 ----------------
   Même assistant que l'inscription pour « Complète ton profil » (Stats) : une question par écran,
   des roues comme sur iPhone, l'IMC en direct, puis la construction. Écrit P.height, P.weight,
   P.hrRest, P.hrMax comme la fiche « Modifier le profil ». */
let _bfFlow=null;
function bfFlowOpen(){
  if(_bfFlow&&_bfFlow.ouvert()) _bfFlow.fermer();
  const F_=P.sex==='Femme';
  const b={h:Math.round(+P.height||(F_?165:176)), w:+P.weight||(F_?60:72), hr:+P.hrRest||0, hm:+P.hrMax||0};
  b.wi=Math.floor(b.w); b.wd=Math.round((b.w-b.wi)*10)%10;
  const poids=()=>b.wi+b.wd/10;
  const virg=x=>curLang()==='en'?String(x):String(x).replace('.',',');
  const imc=()=>{ const v=poids()/Math.pow(b.h/100,2); return Math.round(v*10)/10; };
  const imcLab=v=>t(v<18.5?'bf2ImcLow':v<25?'bf2ImcOk':v<30?'bf2ImcHigh':'bf2ImcVeryHigh');
  const age=()=>{ if(!P.bday) return 30; return Math.floor((ikNow()-new Date(P.bday+'T00:00:00'))/31557600000); };
  const hmEst=()=>Math.round(208-0.7*age());
  const SC=[
    {id:'b-taille',sec:'corps',titre:()=>t('bf2HeightT'),sous:()=>t('bf2HeightS'),
      corps(c,F){ const W=ikfMk('','ikob-roues'); W.dir='ltr';
        W.appendChild(F.roue(ikfRange(120,220),b.h,v=>v,v=>{ b.h=v; },t('heightCmLab'))); W.appendChild(ikfMk('cm','ikob-roue-u'));
        c.appendChild(W); },
      ok:()=>b.h>=120&&b.h<=220},
    {id:'b-poids',sec:'corps',titre:()=>t('bf2WeightT'),sous:()=>t('bf2WeightS'),
      corps(c,F){ const W=ikfMk('','ikob-roues'); W.dir='ltr';
        const lab=ikfMk('','ikob-age');
        const peindre=()=>{ const v=imc(); lab.innerHTML=tp('bf2Imc',virg(v))+' · '+imcLab(v); };
        W.appendChild(F.roue(ikfRange(30,200),b.wi,v=>v,v=>{ b.wi=v; peindre(); },t('weightKgLab')));
        W.appendChild(ikfMk(curLang()==='en'?'.':',','ikob-roue-sep'));
        W.appendChild(F.roue(ikfRange(0,9),b.wd,v=>v,v=>{ b.wd=v; peindre(); }));
        W.appendChild(ikfMk('kg','ikob-roue-u'));
        c.appendChild(W); c.appendChild(lab); peindre(); },
      ok:()=>poids()>=30&&poids()<=200},
    {id:'b-coeur',sec:'coeur',titre:()=>t('bf2HeartT'),sous:()=>t('bf2HeartS'),
      corps(c,F){
        c.appendChild(F.champs([
          {t:t('hrRestLab'),s:t('bf2HrRestS'),vide:()=>!b.hr,aff:()=>b.hr?b.hr+' bpm':t('bf2Optional'),ouvre:fin=>pickInt(t('hrRestLab'),35,100,b.hr||60,'bpm',v=>{ b.hr=v; fin(); })},
          {t:t('hrMaxLab'),s:t('bf2HrMaxS'),vide:()=>!b.hm,aff:()=>b.hm?b.hm+' bpm':tp('bf2Estimated',hmEst()),ouvre:fin=>pickInt(t('hrMaxLab'),150,220,b.hm||hmEst(),'bpm',v=>{ b.hm=v; fin(); })}]));
        c.appendChild(F.note(t('bf2HeartNote'))); },
      lien:{t:()=>t('bf2Skip'),f:()=>{ _bfFlow.suivant(true); }},
      ok:()=>!(b.hr&&b.hm&&b.hr>=b.hm)},
    {id:'b-recap',sec:'recap',final:true,titre:()=>t('bf2RecapT'),sous:()=>t('ob2RecapS'),
      corps(c,F){ const v=imc();
        c.appendChild(F.recap([
          {ic:'user',t:t('bf2HeightT'),v:b.h+' cm',go:'b-taille'},
          {ic:'scale',t:t('bf2WeightT'),v:virg(poids())+' kg · '+tp('bf2Imc',virg(v))+' ('+imcLab(v)+')',go:'b-poids'},
          {ic:'heart',t:t('bf2HeartT'),v:(b.hr?t('bf2Rest')+' '+b.hr+' bpm':t('bf2RestNone'))+' · '+(b.hm?t('bf2Max')+' '+b.hm+' bpm':tp('bf2MaxEst',hmEst())),go:'b-coeur'}]));
        c.appendChild(F.note(t('bf2Private'))); },
      ok:()=>true}
  ];
  _bfFlow=ikFlow({screens:SC, closable:true, track:'bf_step',
    secs:{corps:()=>t('bf2Sec'),coeur:()=>t('bf2SecHeart'),recap:()=>t('ob2SecRecap')},
    finalLabel:()=>t('saveBtn'),
    build:{titre:()=>t('bf2BuildT'), steps:()=>[t('bf2B1'),t('bf2B2'),t('bf2B3'),t('bf2B4')],
      run:()=>{ P.height=b.h; P.weight=Math.round(poids()*10)/10; if(b.hr) P.hrRest=b.hr; if(b.hm) P.hrMax=b.hm; saveAll(); return true; },
      pret:()=>t('bf2Ready')},
    onFinish:()=>{ try{ const a=document.querySelector('.nb.on'); if(a) nav(a.dataset.s); }catch(e){} toast(t('profileUpdated')); }
  }).start();
  return _bfFlow;
}
