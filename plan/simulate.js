/* ============================================================================
   IKORUN — simulateAthlete(scénario) / simulateAll()   (V3.15.0, console)
   ----------------------------------------------------------------------------
   Simule un athlète jour par jour, avec une horloge simulée (window.__ikSimNow) et SANS RIEN
   ENREGISTRER : profil, plan, historique et journal sont mis de côté puis restaurés, les
   sauvegardes et les messages sont neutralisés. Chaque jour : moteur du jour (adaptDaily),
   check du matin éventuel, puis la séance prévue est faite (bilan, même code que l'écran :
   blRecord + adaptAfterBilan) ou ratée (blRecordMissed). validatePlan est rejoué après chaque
   étape : tout ajustement qui casserait le plan est une erreur de la simulation.
   L'athlète court à « sa » VDOT (vraie forme), qui peut différer de celle du plan : ses allures
   réelles sont celles des segments de la séance (planSegs) à cette VDOT, plus la chaleur ou le
   jeûne. Chaque scénario vérifie ce qu'un entraîneur ferait.
     simulateAthlete('progresseVraiment')       → {ok, checks, weeks, log}
     simulateAll()                               → tableau récapitulatif des 12 scénarios
   ============================================================================ */
const SIM_V=45; // VDOT de départ (5 km en ~22:40)
function simRpe(bt,delta){ const r=rpeExpOf(bt)||[5,6]; return Math.max(1,Math.min(10,Math.round((r[0]+r[1])/2+(delta||0)))); }
const SIM_SCENARIOS={
  parfait:{label:'Parfait',weeks:6,run:()=>({})},
  toujoursTropVite:{label:'Toujours trop vite',weeks:5,
    run:(s)=>planIsHard(s)?{vdotRun:SIM_V+3.5,rpeDelta:+1}:{}},
  progresseVraiment:{label:'Progresse vraiment',weeks:7,accept:true,
    run:(s,c)=>planIsHard(s)?{vdotRun:Math.max(c.planV,SIM_V+3),rpeDelta:-1}:{vdotRun:Math.max(c.planV,SIM_V+1.5)}},
  fatigueSurperforme:{label:'Fatigué qui sur-performe puis s’effondre',weeks:6,
    checkin:(d)=>d>=21?{sleep:1,sore:3,mood:2}:d>=14?{sleep:2,sore:2,mood:3}:null,
    run:(s,c,d)=>{
      if(d<14) return planIsHard(s)?{vdotRun:SIM_V+2.5,rpeDelta:+2,sleepQ:2}:{rpeDelta:+1};
      return planIsHard(s)?{vdotRun:SIM_V-4,rpeDelta:+3,legs:3,sleepQ:1,mood:2}:{rpeDelta:+2,legs:3};
    }},
  seanceCleRatee:{label:'Séance clé ratée',weeks:3,
    run:(s,c,d)=>(d>=7 && d<14 && planIsHard(s) && !c.flag.k)?(c.flag.k=1,{status:'missed',reason:'Manque de temps'}):{}},
  quatreJoursRates:{label:'4 jours ratés',weeks:4,
    run:(s,c,d)=>(d>=15&&d<=18)?{status:'missed',reason:'Fatigue',defer:true}:{}},
  dixJoursArret:{label:'10 jours d’arrêt',weeks:7,
    run:(s,c,d)=>(d>=15&&d<=24)?{status:'missed',reason:'Autre',defer:true}:{}},
  maladie:{label:'Maladie',weeks:4,
    run:(s,c,d)=>(d>=10&&!c.flag.ill)?(c.flag.ill=1,{status:'missed',reason:'Maladie'}):{}},
  douleurRepetee:{label:'Douleur répétée au même endroit',weeks:5,
    run:(s,c,d)=>{
      if(d===30 && !c.flag.cleared){ c.flag.cleared=1; adaptClearSafety('pain'); }
      return (d>=8&&d<=14)?{pain:{on:true,zone:'knee',side:'L',level:3,gait:false}}:{};
    }},
  canicule:{label:'Canicule',weeks:4,heat:0.05,
    run:()=>({wx:{corr:0.05,t:38,dew:22,wind:8},heat:0.05,rpeDelta:+1})},
  ramadan:{label:'Ramadan',weeks:4,
    run:()=>({fast:true,slow:0.03,rpeDelta:+1})},
  affutage:{label:'Semaine d’affûtage',weeks:3,raceInDays:20,
    run:(s,c,d)=>planIsHard(s)?(d%2?{vdotRun:SIM_V+4}:{vdotRun:SIM_V-4,rpeDelta:+2}):{}}
};
function simDate(k,h){ const d=new Date(k+'T00:00:00'); d.setHours(h||7,0,0,0); return d.getTime(); }
// Profil et historique de départ : 6 semaines de course régulière (≈ 30 km/sem, 4 sorties).
function simSetup(sc,start){
  const race=adKeyAdd(start,sc.raceInDays||84);
  P={setupDone:true,lang:(save_lang_for_sim||'fr'),name:'Sim',compDate:race,days:[1,3,5,6],objRace:'10 km',objGoal:'Record personnel',kmWeek:30,kmWeekMin:28,kmWeekMax:45,adapt:{},joinedAt:simDate(adKeyAdd(start,-60))};
  const t5=predictTime(SIM_V,5000);
  RECORDS=[{dist:'5 km',meters:5000,time:Math.floor(t5/60)+':'+String(Math.round(t5%60)).padStart(2,'0'),date:adKeyAdd(start,-40)}];
  SESS=[]; MSESS=[]; SESSLOG=[]; CHECKINS=[]; ADAPT_LOG=[]; CUSTOM=[]; PREFS={};
}
// Historique : l'athlète s'entraînait déjà comme les deux premières semaines du plan (même volume,
// même intensité) pendant les 6 semaines qui précèdent — sinon le plan paraîtrait une surcharge.
function simHistory(start){
  const first=PLAN.sessions.filter(s=>s.date<adKeyAdd(start,14) && s.km>0 && s.baseType!=='COURSE');
  for(let w=3;w>=1;w--) first.forEach(s=>{
    const k=adKeyAdd(s.date,-14*w);
    SESS.push({date:k,title:'Historique',type:s.type,baseType:s.baseType,km:s.km,pace:s.pace,duration:s.duration,rpe:simRpe(s.baseType,0)});
  });
}
let save_lang_for_sim='fr';
function simulateAthlete(name,opts){
  opts=opts||{};
  const sc=SIM_SCENARIOS[name];
  if(!sc){ console.warn('Scénarios :',Object.keys(SIM_SCENARIOS).join(', ')); return null; }
  const keep={P,SESS,MSESS,SESSLOG,PLAN,CHECKINS,ADAPT_LOG,RECORDS,CUSTOM,PREFS,now:window.__ikSimNow,sim:window.__ikSim,prev:window.__ikSimPrev};
  const fns={toast:window.toast,save:DB.save,remove:DB.remove,saveAll:window.saveAll,refreshXP:window.refreshXP,feteRecord:window.feteRecord};
  save_lang_for_sim=(P&&P.lang)||'fr';
  const res={name,label:sc.label,ok:true,checks:[],weeks:[],log:[],violations:[],days:[]};
  try{
    window.__ikSim=true; window.__ikSimPrev=null;
    DB.save=function(){}; DB.remove=function(){}; window.toast=function(){}; window.saveAll=function(){}; window.refreshXP=function(){}; window.feteRecord=function(){};
    // départ un lundi, quatre semaines avant aujourd'hui (dates réalistes, toujours les mêmes jours de semaine)
    const start=opts.start||adMondayKey(adKeyAdd(dateKey(new Date()),-28));
    window.__ikSimNow=simDate(start);
    simSetup(sc,start);
    const built=planBuild({seed:opts.seed||20261012});
    if(built.err) throw new Error('planBuild : '+built.err);
    PLAN=built.plan; simHistory(start); _lmCache=null;
    const v0=getUserVDOT();
    let base=new Set(validatePlan(PLAN).errors);
    const ctx={flag:{},planV:v0};
    const taper0=PLAN.sessions.filter(s=>s.phaseKey==='TAPER'||s.baseType==='COURSE').map(s=>s.id);
    let deferred=[], deferReason=null;
    const nDays=Math.min(sc.weeks*7, adDaysBetweenKeys(start,P.compDate)+1);
    const check=(when)=>{
      const v=validatePlan(PLAN);
      v.errors.forEach(e=>{ if(!base.has(e)) res.violations.push(when+' : '+e); });
      base=new Set(v.errors);
    };
    for(let d=0; d<nDays; d++){
      const k=adKeyAdd(start,d);
      window.__ikSimNow=simDate(k); _lmCache=null;
      ctx.planV=(PLAN&&PLAN.vdot)||v0;
      const s=PLAN.sessions.find(x=>x.date===k && !x.done && !x.missed && x.km>0 && x.baseType!=='Repos');
      const r=s?(sc.run(s,ctx,d)||{}):null;
      // retour d'une absence : la question « pas fait » est posée au retour, une fois pour toutes
      if(deferred.length && r && !(r.status==='missed' && r.defer)){
        const ent=blRecordMissed(deferred,deferReason,null,null,null,0);
        ent.forEach(e=>res.log.push(e)); deferred=[]; check(k+' retour');
      }
      adaptDaily().forEach(e=>res.log.push(e)); check(k+' jour');
      const ci=sc.checkin&&sc.checkin(d,ctx);
      if(ci){ CHECKINS.push(Object.assign({id:'c'+k,ut:adNowTs(),date:k},ci)); adaptAfterCheckin().forEach(e=>res.log.push(e)); check(k+' check'); }
      const s2=PLAN.sessions.find(x=>x.date===k && !x.done && !x.missed && x.km>0 && x.baseType!=='Repos');
      if(!s2) continue;
      const rr=(s2===s)?r:(sc.run(s2,ctx,d)||{});
      if(rr.status==='missed'){
        if(rr.defer){ deferred.push(s2.id); deferReason=rr.reason; continue; }
        window.__ikSimNow=simDate(k,20);
        blRecordMissed([s2.id],rr.reason,rr.pain||null,null,null,0).forEach(e=>res.log.push(e)); check(k+' raté');
        continue;
      }
      window.__ikSimNow=simDate(k,19);
      res.log.push(...simDoSession(s2,rr));
      check(k+' bilan '+s2.baseType);
      if(sc.accept) (ADAPT_LOG||[]).filter(e=>e.status==='proposal').forEach(e=>{ const a=adaptAcceptVdot(e.id); if(a.ok) res.log.push(a.entry); check(k+' accepte'); });
    }
    // semaines
    const weeks={};
    PLAN.sessions.forEach(s=>{ if(s.date<start || s.date>adKeyAdd(start,nDays-1)) return; const w=adMondayKey(s.date); const W=weeks[w]=weeks[w]||{semaine:fmtDate(w),prevuKm:0,faitKm:0,ajustements:0}; if(s.baseType!=='COURSE') W.prevuKm+=+s.km||0; });
    SESS.forEach(s=>{ if(s.date<start) return; const W=weeks[adMondayKey(s.date)]; if(W) W.faitKm+=+s.km||0; });
    res.log.forEach(e=>{ const W=e&&weeks[adMondayKey(e.date)]; if(W && (e.status==='applied'||e.status==='accepted')) W.ajustements++; });
    Object.keys(weeks).sort().forEach(w=>{ const W=weeks[w], m=loadModel(adKeyAdd(w,6)); W.prevuKm=Math.round(W.prevuKm*10)/10; W.faitKm=Math.round(W.faitKm*10)/10; W.acwr=m.acwr!=null?Math.round(m.acwr*100)/100:'—'; res.weeks.push(W); });
    res.vdot=[v0,getUserVDOT()];
    res.taperKept=taper0.every(id=>{ const s=PLAN.sessions.find(x=>x.id===id); return s && s.baseType!=='Repos'; });
    res.plan=PLAN;
    res.checks=simExpect(name,res,start);
    res.checks.push(['aucun ajustement ne casse le plan (validatePlan)',!res.violations.length,res.violations.slice(0,3).join(' | ')]);
    res.ok=res.checks.every(c=>c[1]);
  }catch(err){ res.ok=false; res.checks.push(['exécution',false,String(err&&err.stack||err)]); }
  finally{
    ({P,SESS,MSESS,SESSLOG,PLAN,CHECKINS,ADAPT_LOG,RECORDS,CUSTOM,PREFS}=keep);
    window.__ikSimNow=keep.now; window.__ikSim=keep.sim; window.__ikSimPrev=keep.prev; _lmCache=null;
    DB.save=fns.save; DB.remove=fns.remove; window.toast=fns.toast; window.saveAll=fns.saveAll; window.refreshXP=fns.refreshXP; window.feteRecord=fns.feteRecord;
  }
  if(!opts.quiet){
    console.groupCollapsed('%csimulateAthlete · '+res.label+' : '+(res.ok?'OK':'ÉCHEC'),'font-weight:bold;color:'+(res.ok?'#2a9d5b':'#d33'));
    console.table(res.weeks);
    res.log.filter(e=>e && e.status!=='note').forEach(e=>console.log(e.date,e.rule,e.status,adMsg(e.msg),(e.before||[]).map((b,i)=>b.baseType+' '+b.km+' → '+((e.after||[])[i]||{}).baseType+' '+((e.after||[])[i]||{}).km).join(' ; ')));
    res.checks.forEach(c=>console.log((c[1]?'✔ ':'✘ ')+c[0]+(c[2]?' — '+c[2]:'')));
    console.groupEnd();
  }
  return res;
}
// Une séance faite : allures réelles = segments de la séance à la VDOT de l'athlète (+ chaleur, jeûne).
function simDoSession(s,r){
  const pc=planPaces(PLAN.vdot||getUserVDOT()), pr=planPaces(r.vdotRun||PLAN.vdot||getUserVDOT());
  const slow=1+(r.heat||0)+(r.slow||0)+(r.fast&&!r.slow?0.03:0);
  const segs=planSegs(s,pr);
  let km=0, sec=0; segs.forEach(x=>{ km+=x.km; sec+=x.sec*slow; });
  const sr=s.series;
  const reps=(sr&&sr.reps&&sr.dist&&sr.paceSecPerKm)?Array.from({length:sr.reps},(_,i)=>{
    const target=Math.round(splitSecFromPace(sr.paceSecPerKm,sr.dist));
    const w=segs.find(x=>x.k==='work'), timeS=Math.round(w?w.sec/w.km*sr.dist/1000*slow:target*slow);
    return {n:i+1,dist:sr.dist,target,timeS,respected:timeS<=Math.round(target*1.06)};
  }):[];
  const changed=Math.abs(sec/km-(parseTime(s.pace)||sec/km))>2 || reps.some(x=>x.timeS!==x.target);
  const c={date:s.date,title:planSessTitle(s),km:s.km,pace:s.pace,type:s.type,duration:s.duration,plannedRpe:s.rpe,planSessionId:s.id,series:s.series||null};
  const d={status:changed?'modified':'done',distance:Math.round(km*100)/100,duration:Math.round(sec/60),pace:fmtSplit(Math.round(sec/km)),rpe:r.rpe||simRpe(s.baseType,r.rpeDelta),
    legs:r.legs||null,sleepQ:r.sleepQ||null,mood:r.mood||null,note:'',pain:r.pain||{on:false},deniv:0,wx:r.wx||null,fast:!!r.fast};
  if(reps.length){ d.distance=reps.reduce((a,x)=>a+x.dist,0)/1000; }
  s.done=true;
  const e=blRecord(c,d,reps,s.baseType);
  return adaptAfterBilan(e);
}
function simExpect(name,r,start){
  const L=r.log.filter(Boolean), has=(rule,st)=>L.filter(e=>e.rule===rule && (!st||e.status===st));
  const applied=L.filter(e=>e.status==='applied');
  const hardIn=(from,to)=>r.plan.sessions.filter(s=>s.date>=from && s.date<=to && planIsHard(s) && !s.missed);
  const C=[];
  switch(name){
    case 'parfait':
      C.push(['aucun ajustement du plan',!applied.length,applied.map(e=>e.rule).join(', ')]);
      C.push(['aucune proposition de VDOT',!has('vdotUp').length && !has('vdotDown').length,'']);
      C.push(['des messages de validation',has('good').length>=3,has('good').length+' validations']);
      break;
    case 'toujoursTropVite':
      C.push(['séances trop rapides signalées avec la cible',has('fastOnce').length+has('fastInfo').length>=3,(has('fastOnce').length+has('fastInfo').length)+' messages']);
      C.push(['la séance dure suivante est protégée au moins une fois',has('fastOnce','applied').length>=1,has('fastOnce','applied').length+' fois']);
      C.push(['pas de hausse de VDOT proposée (RPE au-dessus de l’attendu)',!has('vdotUp').length,'']);
      break;
    case 'progresseVraiment':
      C.push(['une hausse de VDOT est proposée',has('vdotUp').length>=1,has('vdotUp').length+' proposition(s)']);
      C.push(['acceptée, la VDOT monte',r.vdot[1]>r.vdot[0],fmt1(r.vdot[0])+' → '+fmt1(r.vdot[1])]);
      C.push(['jamais plus de +1 d’un coup',L.filter(e=>e.rule==='vdotUp'&&e.status==='proposal').every(e=>e.step<=1),'']);
      break;
    case 'fatigueSurperforme':
      C.push(['pas de hausse de VDOT malgré les séances rapides (RPE trop haut)',!has('vdotUp').length,'']);
      C.push(['le plan est allégé quand ça s’effondre',applied.some(e=>/^(slowTrend|ready|acwrHigh|acwrRisk)$/.test(e.rule)),applied.map(e=>e.rule).join(', ')]);
      break;
    case 'seanceCleRatee':
      C.push(['la séance clé est déplacée dans la semaine, ou abandonnée avec un message',has('missKey','applied').length+has('missKeyDropped').length>=1,(has('missKey','applied').length?'déplacée':'abandonnée')]);
      C.push(['pas de rattrapage en plus (volume de la semaine)',!applied.some(e=>e.rule==='missKey' && e.after.some(a=>a.km>(e.before.find(b=>b.id===a.id)||{}).km*3)),'']);
      break;
    case 'quatreJoursRates':
      C.push(['semaine suivante allégée (coupure de 3 à 6 jours)',has('gap3').length>=1,has('gap3').map(e=>e.status).join(', ')]);
      C.push(['pas de baisse de VDOT pour 4 jours',r.vdot[1]===r.vdot[0],fmt1(r.vdot[0])+' → '+fmt1(r.vdot[1])]);
      break;
    case 'dixJoursArret': {
      const g=has('gap7','applied')[0];
      C.push(['plan reconstruit après 10 jours',!!(g&&g.rebuild),g?g.msg.p[0]+' jours':'aucune reconstruction']);
      const want=clampVdot(r.vdot[0]*danielsBreakFactor(g?g.msg.p[0]:10,false));
      C.push(['VDOT réduite selon Daniels',g?Math.abs(r.vdot[1]-want)<=0.15 || r.vdot[1]<r.vdot[0]:false,fmt1(r.vdot[0])+' → '+fmt1(r.vdot[1])+' (attendu ≈ '+fmt1(want)+')']);
      const back=g?g.date:start;
      C.push(['première semaine de reprise sans séance dure',!hardIn(back,adKeyAdd(back,6)).length,hardIn(back,adKeyAdd(back,6)).map(s=>s.date+' '+s.baseType).join(', ')]);
      C.push(['séances de reprise marquées (50 % puis 75 %)',r.plan.sessions.some(s=>s.ramp),'']);
      C.push(['la course est toujours là',r.plan.sessions.some(s=>s.baseType==='COURSE'),'']);
      break; }
    case 'maladie': {
      const g=has('ill')[0];
      C.push(['repos puis reprise progressive',!!g,g?g.status:'']);
      const d0=g?g.date:start;
      C.push(['aucune séance dure dans les 7 jours',!hardIn(d0,adKeyAdd(d0,6)).length,hardIn(d0,adKeyAdd(d0,6)).map(s=>s.date).join(', ')]);
      C.push(['jamais de diagnostic dans le message',!/diagnos|tendinite|fracture|grippe|covid/i.test(adMsg(g&&g.msg)),'']);
      break; }
    case 'douleurRepetee': {
      const g=has('painRepeat')[0];
      C.push(['même zone 3 fois en 7 jours : intensité bloquée',!!g,g?g.date:'']);
      C.push(['conseil médical fort',!!g && /médecin|kiné|professionnel|doctor|طبيب/i.test(adMsg(g.msg)),'']);
      const d0=g?g.date:start;
      C.push(['plus de séance dure jusqu’à « je n’ai plus mal »',!hardIn(adKeyAdd(d0,1),adKeyAdd(start,29)).length,hardIn(adKeyAdd(d0,1),adKeyAdd(start,29)).map(s=>s.date+' '+s.baseType).join(', ')]);
      C.push(['l’intensité revient ensuite',hardIn(adKeyAdd(start,31),adKeyAdd(start,40)).length>=1,'']);
      break; }
    case 'canicule':
      C.push(['ralentissement dû à la chaleur jamais compté comme une contre-performance',!has('slowTrend').length && !has('vdotDown').length,'']);
      C.push(['séances jugées sur l’allure corrigée',L.filter(e=>e.msg&&e.msg.k==='adMsgGoodHeat').length>=2,L.filter(e=>e.msg&&e.msg.k==='adMsgGoodHeat').length+' validations « chaleur »']);
      break;
    case 'ramadan':
      C.push(['jeûne pris en compte : ni allègement ni baisse de VDOT',!has('slowTrend').length && !has('vdotDown').length,'']);
      break;
    case 'affutage':
      C.push(['affûtage et course jamais supprimés',r.taperKept,'']);
      C.push(['aucune proposition de VDOT pendant l’affûtage',!has('vdotUp').length && !has('vdotDown').length,'']);
      break;
  }
  return C;
}
function simulateAll(opts){
  const rows=Object.keys(SIM_SCENARIOS).map(n=>{ const r=simulateAthlete(n,Object.assign({quiet:true},opts||{})); return {scénario:r.label,ok:r.ok?'✔':'✘',ajustements:r.log.filter(e=>e&&(e.status==='applied'||e.status==='accepted')).length,
    'échecs':r.checks.filter(c=>!c[1]).map(c=>c[0]+(c[2]?' ('+c[2]+')':'')).join(' | ')}; });
  console.table(rows);
  return rows;
}
