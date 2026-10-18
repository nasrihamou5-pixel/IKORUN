/* ============================================================================
   IKORUN — Blessure confirmée, adaptation de la muscu, rééducation  (plan/injury.js)
   À charger APRÈS plan/adapt.js et plan/strength-adapt.js (même bundle).

   1. Journal des douleurs (P.adapt.painLog) : chaque signalement, par zone + côté.
   2. Blessure confirmée : même zone signalée au moins 7 fois, ou pendant plus de 14 jours (3 signalements
      au moins), sans trou de plus de 10 jours. P.injury suit 3 étapes : 1 Calmer, 2 Reconstruire, 3 Reprendre.
      Le plan de course ET le plan de muscu s'adaptent seuls ; la muscu reçoit des exercices de rééducation.
   3. Muscu : douleur, maladie, fatigue, séances sautées et longue pause l'allègent — comme la course.
      SENS UNIQUE : une séance de course dure n'allège jamais la muscu (la règle inverse, jambes → course,
      est dans plan/strength-adapt.js).
   Tout passe par les mêmes garde-fous que la course : copie, validation, journal (ADAPT_LOG), « Annuler »
   quand ce n'est pas une mesure de sécurité.
   ============================================================================ */
const INJ_MIN_REPORTS = 7, INJ_MIN_DAYS = 14, INJ_GAP_DAYS = 10;
const INJ_HORIZON = {1:21, 2:14, 3:10};          // jours de séances adaptées d'avance, selon l'étape
const INJ_ZONE_GROUPS = {
  hip:['Fessiers','Adducteurs','Abducteurs','Quadriceps'], thighF:['Quadriceps'], knee:['Quadriceps','Ischios'],
  shin:['Mollets'], ankle:['Mollets'], foot:['Mollets'], calf:['Mollets'], achilles:['Mollets'],
  lowBack:['Lombaires'], thighB:['Ischios','Fessiers'], other:[]
};
const INJ_AXIAL = /Soulevé|Deadlift|Good Morning|Squat barre|Back Squat|Front Squat|buste penché|Hyperextension|Rowing barre|Bent Over/i;   // dos lourd

/* ---------- état ---------- */
function injBase(zid){ return String(zid||'other').split('_')[0]; }
function injActive(){ return !!(P && P.injury && P.injury.status==='active'); }
function injDaysSince(k){ return adDaysBetweenKeys(k, todayKey()); }
function injLogArr(){ const st=adState(); st.painLog=st.painLog||[]; return st.painLog; }
function injLog(zid, level, gait, date){
  const st=adState(), k=date||todayKey(), arr=injLogArr();
  const ex=arr.find(x=>x.date===k && x.zone===zid);
  if(ex){ ex.level=Math.max(ex.level||0,level||0); ex.gait=ex.gait||!!gait; }
  else arr.push({date:k, zone:zid, level:level||0, gait:!!gait});
  const lim=adKeyAdd(todayKey(),-120);
  st.painLog=arr.filter(x=>x.date>=lim).slice(-200);
}
// Signalements de la zone qui forment l'épisode en cours : après le dernier « plus mal », sans trou de plus de 10 jours.
function injEpisode(zid){
  const st=adState(), h=(P.injuryHist&&P.injuryHist[0]&&P.injuryHist[0].zone===zid)?(P.injuryHist[0].resolved||''):'';
  const cut=(st.painClearedAt||'')>h?(st.painClearedAt||''):h;
  const list=injLogArr().filter(x=>x.zone===zid && (!cut || x.date>cut)).sort((a,b)=>a.date<b.date?-1:1);
  const ep=[];
  for(let i=list.length-1;i>=0;i--){
    if(i<list.length-1 && adDaysBetweenKeys(list[i].date,list[i+1].date)>INJ_GAP_DAYS) break;
    ep.unshift(list[i]);
  }
  if(!ep.length || injDaysSince(ep[ep.length-1].date)>INJ_GAP_DAYS) return [];
  return ep;
}
function injIsConfirmed(ep){
  if(!ep.length) return false;
  const span=adDaysBetweenKeys(ep[0].date, ep[ep.length-1].date);
  return ep.length>=INJ_MIN_REPORTS || (span>=INJ_MIN_DAYS && ep.length>=3);
}

/* ---------- exercices de rééducation (lignes légères de exercises/exdb.js) ---------- */
function injRehabFor(zid, phase, max){
  const z=injBase(zid);
  if(typeof EXD_ROWS==='undefined') return [];
  const rows=EXD_ROWS.filter(r=>r[7]==='rehab' && r[9] && r[9].indexOf(z)>=0);
  let pick=rows.filter(r=>r[12] && r[12][0]===phase);
  for(let p=phase-1;!pick.length && p>=1;p--) pick=rows.filter(r=>r[12] && r[12][0]===p);
  // la marche-course (étape 3) sert à toutes les zones mais ne passe jamais avant un exercice propre à la zone
  pick.sort((a,b)=>(a[9].length-b[9].length)||(a[0]<b[0]?-1:1));
  return pick.slice(0,max).map(r=>{ const o=ex(r[1], r[12][1], r[12][2]); o.rehab=true; o.rid=r[0]; return o; });
}
function injExAffected(e, zid){
  if(!e || e.rehab) return false;
  const z=injBase(zid), groups=INJ_ZONE_GROUPS[z]||[];
  if(!groups.length) return false;
  const g=typeof exGroupOf==='function'?exGroupOf(e.name):null;
  if(g && groups.indexOf(g)>=0) return true;
  if((e.muscles||[]).some(m=>groups.indexOf(m)>=0)) return true;
  return z==='lowBack' && INJ_AXIAL.test(e.name||'');
}

/* ---------- muscu : outils sur une copie du plan ---------- */
function strSessSnap(s){ if(!s) return null; const o={}; ['id','date','title','kind','duration','skipped','done','ex','adj','inj','exOrig'].forEach(f=>{ if(s[f]!==undefined) o[f]=s[f]; }); return JSON.parse(JSON.stringify(o)); }
function strUpcoming(pl, k, days){ const end=adKeyAdd(k,days); return pl.sessions.filter(s=>!s.done && !s.skipped && s.date>=k && s.date<end).sort((a,b)=>a.date<b.date?-1:1); }
function strDuration(s){ s.duration=Math.round(s.ex.reduce((a,e)=>a+(+e.sets||0),0)*1.8)+8; }
function strStash(s){ if(!s.exOrig) s.exOrig=JSON.parse(JSON.stringify(s.ex)); }
function strUnstash(s){ if(s.exOrig){ s.ex=s.exOrig; delete s.exOrig; } delete s.inj; if(s.adj){ delete s.adj; } strDuration(s); }
function strLight(s, rule, minus){            // une série de moins par exercice (2 au minimum)
  strStash(s); let n=0;
  s.ex.forEach(e=>{ const ns=Math.max(2,(+e.sets||0)-(minus||1)); if(ns<(+e.sets||0)){ e.sets=ns; n++; } });
  if(!n){ delete s.exOrig; return 0; }
  s.adj={r:rule}; strDuration(s); return 1;
}
function strApply(rule, safety, mutate, msg, extra){
  if(!STRENGTH || !STRENGTH.sessions) return null;
  const k=todayKey(), pl=JSON.parse(JSON.stringify(STRENGTH));
  let n=0; try{ n=mutate(pl,k)||0; }catch(err){ console.error('[IKORUN] muscu',rule,err); return null; }
  if(!n) return null;
  const chk=p=>validateStrengthPlan({sessions:p.sessions.filter(s=>!s.done && !s.skipped && s.date>=k), perWeek:p.perWeek, raceDate:p.raceDate}, PLAN&&PLAN.sessions||[]);
  const base=new Set(chk(STRENGTH).errors), added=chk(pl).errors.filter(x=>!base.has(x) && !/^emptySession/.test(x));
  if(added.length){ console.warn('[IKORUN] ajustement muscu refusé ('+rule+') :',added); return null; }
  const A={}, B={}; STRENGTH.sessions.forEach(s=>{ A[s.id]=s; }); pl.sessions.forEach(s=>{ B[s.id]=s; });
  const ids=Object.keys(B).filter(id=>JSON.stringify(strSessSnap(A[id]))!==JSON.stringify(strSessSnap(B[id])));
  if(!ids.length) return null;
  STRENGTH=pl;
  if(!window.__ikSim){ try{ DB.save('strength_plan',STRENGTH); }catch(e){} }
  if(extra && extra.quiet) return {quiet:true};
  return adLog(Object.assign({rule,safety:!!safety,str:true,sessIds:ids,before:ids.map(id=>strSessSnap(A[id])),after:ids.map(id=>strSessSnap(B[id])),msg,seen:false,status:'applied'},extra||{}));
}
function strUndo(e){
  if(!STRENGTH) return {ok:false,why:'adUndoNothing'};
  const k=todayKey(); let n=0;
  e.before.forEach(b=>{ const s=STRENGTH.sessions.find(x=>x.id===b.id); if(!s || s.done || s.date<k) return;
    ['ex','adj','inj','exOrig','skipped','duration'].forEach(f=>{ if(b[f]===undefined) delete s[f]; else s[f]=JSON.parse(JSON.stringify(b[f])); }); n++; });
  if(!n) return {ok:false,why:'adUndoNothing'};
  e.status='undone'; e.ut=adNowTs(); adFired(e.rule);
  if(!window.__ikSim){ try{ DB.save('strength_plan',STRENGTH); }catch(x){} }
  adPersist();
  return {ok:true};
}

/* ---------- muscu : douleur ponctuelle (étape 0), blessure (étapes 1 à 3) ---------- */
// Applique l'étape `phase` de la blessure sur la zone `zid` à une séance. Rend 1 si elle a changé.
function strInjuryApply(s, zid, phase){
  if(s.inj && s.inj.phase===phase && s.inj.zone===zid) return 0;
  const base=s.exOrig?JSON.parse(JSON.stringify(s.exOrig)):s.ex.slice();       // contenu d'origine de la séance
  const aff=base.filter(e=>injExAffected(e,zid));
  const rehab=injRehabFor(zid, phase||1, phase===0?1:phase===1?3:phase===2?2:1);
  if(phase===0 ? !aff.length : (!aff.length && !rehab.length)) return 0;       // douleur ponctuelle : seulement les séances qui sollicitent la zone
  let next;
  if(phase===0||phase===1||phase===2) next=base.filter(e=>!injExAffected(e,zid)).concat(rehab);
  else next=base.map(e=>{ if(injExAffected(e,zid)){ const c=Object.assign({},e); c.sets=Math.max(2,(+c.sets||0)-1); return c; } return e; }).concat(rehab);
  if(!next.length) return 0;
  if(!s.exOrig) s.exOrig=JSON.parse(JSON.stringify(s.ex));
  s.ex=next; s.inj={phase,zone:zid}; s.adj={r:phase?'injury':'strPain',phase}; strDuration(s);
  return 1;
}
function strAdAcute(zid, level, gait, repeat, quiet){
  if(injActive() && P.injury.zone===zid) return null;                          // la blessure s'en charge
  const days=repeat?14:((level>=4||gait)?4:0); if(!days) return null;
  return strApply('strPain', true, (pl,k)=>{ let n=0; strUpcoming(pl,k,days).forEach(s=>{ if(!(s.inj && s.inj.phase>=1)) n+=strInjuryApply(s,zid,0); }); return n; },
    {k:'adMsgStrPain',p:[{z:zid}]}, {quiet:!!quiet});
}
function strRestorePhase(phase0){              // « Je n'ai plus mal » : les séances reprennent leur contenu d'origine
  if(!STRENGTH) return 0; const k=todayKey(); let n=0;
  STRENGTH.sessions.forEach(s=>{ if(!s.done && s.date>=k && s.inj && (phase0 ? s.inj.phase>=0 : s.inj.phase===0)){ strUnstash(s); n++; } });
  if(n && !window.__ikSim){ try{ DB.save('strength_plan',STRENGTH); }catch(e){} }
  return n;
}

/* ---------- muscu : maladie, fatigue, séances sautées, longue pause ---------- */
function strAdIll(restUntil, easyUntil, quiet){
  return strApply('strIll', true, (pl,k)=>{ let n=0;
    pl.sessions.filter(s=>!s.done && !s.skipped && s.date>=k && s.date<=easyUntil).forEach(s=>{
      if(s.adj && s.adj.r==='strIll') return;
      if(s.date<=restUntil){ strStash(s); s.skipped=true; s.adj={r:'strIll',rest:1}; n++; }
      else n+=strLight(s,'strIll',1);
    }); return n; }, {k:'adMsgStrIll',p:[{d:restUntil},{d:easyUntil}]}, {quiet:!!quiet});
}
function strRestoreIll(){
  if(!STRENGTH) return 0; const k=todayKey(); let n=0;
  STRENGTH.sessions.forEach(s=>{ if(!s.done && s.date>=k && s.adj && s.adj.r==='strIll'){ if(s.skipped && s.adj.rest) s.skipped=false; strUnstash(s); n++; } });
  if(n && !window.__ikSim){ try{ DB.save('strength_plan',STRENGTH); }catch(e){} }
  return n;
}
function strLastActivity(){
  let last='';
  (MSESS||[]).forEach(m=>{ if(m && m.date && m.date<=todayKey() && m.date>last) last=m.date; });
  return last;
}
// Chaque jour : trou de plus de 10 jours sans muscu → reprise avec moins de séries.
function strRuleGaps(){
  if(!STRENGTH || !STRENGTH.sessions || adCool('strGap',10)) return [];
  const last=strLastActivity(); if(!last) return [];
  const gap=injDaysSince(last); if(gap<10) return [];
  if(injActive() || adIllActive(todayKey())) return [];
  const minus=gap>=21?2:1;
  const r=strApply('strGap', false, (pl,k)=>{ let n=0; strUpcoming(pl,k,10).slice(0,2).forEach(s=>{ if(!s.inj && !(s.adj&&s.adj.r)) n+=strLight(s,'strGap',minus); }); return n; },
    {k:'adMsgStrGap',p:[gap]});
  adFired('strGap');
  return r?[r]:[];
}
// Séance de muscu « pas faite » + raison (feuille de Sport / Accueil). reason : Douleur | Maladie | Fatigue | Temps | Autre
function strAfterMissed(id, reason, extra){
  const out=[];
  try{
    const s=STRENGTH && STRENGTH.sessions.find(x=>x.id===id); if(!s) return out;
    s.skipped=true; s.missReason=reason||'Autre';
    if(reason==='Maladie'){ out.push.apply(out, adRuleIll(extra&&extra.since)); }
    else if(reason==='Douleur' && extra && extra.pain && extra.pain.on){ out.push.apply(out, adRulePain({date:todayKey(),pain:extra.pain})); }
    else if(reason==='Fatigue'){
      const r=strApply('strFatigue', false, (pl,k)=>{ const nx=strUpcoming(pl,k,5).find(x=>!x.adj); return nx?strLight(nx,'strFatigue',1):0; }, {k:'adMsgStrFatigue',p:[]});
      if(r) out.push(r);
    } else {
      // deux séances ou plus sautées en 14 jours sans reprise : la suivante est allégée
      const lim=adKeyAdd(todayKey(),-14), sk=STRENGTH.sessions.filter(x=>x.skipped && x.date>=lim && x.date<=todayKey()).length;
      if(sk>=2 && !adCool('strMiss',7)){
        const r=strApply('strMiss', false, (pl,k)=>{ const nx=strUpcoming(pl,k,5).find(x=>!x.adj); return nx?strLight(nx,'strMiss',1):0; }, {k:'adMsgStrMiss',p:[]});
        adFired('strMiss'); if(r) out.push(r);
      }
    }
  }catch(err){ console.error('[IKORUN] strAfterMissed',err); }
  adPersist();
  if(!window.__ikSim){ try{ DB.save('strength_plan',STRENGTH); }catch(e){} }
  return out.filter(Boolean);
}

/* ---------- course : les étapes de la blessure ---------- */
function injApplyRun(zid, phase){
  const rule='injuryP'+phase, k=todayKey(), I=P.injury;
  return adaptApply(rule, true, (pl,pc)=>{ let n=0;
    adWindow(pl,k,INJ_HORIZON[phase],true).forEach(s=>{
      if(adDone(s,rule)) return;
      const hard=planIsHard(s)||planIsLong(s);
      if(phase===1){
        if(I && I.restUntil && s.date<=I.restUntil){ adToRest(s,rule); n++; }
        else if(hard){ adToEasy(s,Math.min(s.km,5),pc,rule); n++; }
        else if(adLighten(s,0.7,pc,rule)) n++;
      } else if(phase===2){
        if(hard){ adToEasy(s,Math.min(s.km,8),pc,rule); n++; }
        else if(s.adj && s.adj.km0!=null && /^injuryP1$/.test(s.adj.r||'')){ const nk=Math.max(planFloor(s.baseType)||3,Math.round(s.adj.km0*0.85*10)/10); if(nk>s.km+0.05){ s.km=nk; planApplySegs(s,pc); adTag(s,rule,true); n++; } }
      } else {
        if(hard){ if(adLighten(s,0.8,pc,rule)) n++; }
        else if(s.adj && s.adj.km0!=null && /^injuryP[12]$/.test(s.adj.r||'')){ const nk=Math.round(s.adj.km0*10)/10; if(nk>s.km+0.05){ s.km=nk; planApplySegs(s,pc); adTag(s,rule,true); n++; } }
      }
    }); return n; }, {k:'adMsgInjuryRun',p:[phase,{z:zid}]});
}
function injApplyAll(quiet){
  if(!injActive()) return [];
  const I=P.injury, out=[];
  const rr=injApplyRun(I.zone,I.phase); if(rr) out.push(rr);
  const rs=strApply('injury', true, (pl,k)=>{ let n=0; strUpcoming(pl,k,INJ_HORIZON[I.phase]).forEach(s=>{ n+=strInjuryApply(s,I.zone,I.phase); }); return n; },
    {k:'adMsgInjuryStr',p:[I.phase,{z:I.zone}]}, {quiet:!!quiet});
  if(rs && !rs.quiet) out.push(rs);
  return out;
}

/* ---------- cycle de vie de la blessure ---------- */
function injSetPhase(phase, why){
  const I=P.injury, k=todayKey();
  I.phase=phase; I.phaseSince=k;
  I.hist=(I.hist||[]).concat({date:k,phase,why}).slice(-20);
  if(STRENGTH) STRENGTH.sessions.forEach(s=>{ if(!s.done && s.date>=k && s.inj) strUnstash(s); });   // l'étape suivante repart du contenu d'origine
}
function injConfirm(zid, ep){
  const k=todayKey(), last=ep[ep.length-1];
  const serious=!!(last && (last.gait || last.level>=6));
  P.injury={zone:zid, since:ep[0].date, confirmedAt:k, phase:1, phaseSince:k, status:'active', reports:ep.length, relapses:0, hist:[{date:k,phase:1,why:'confirmed'}],
    restUntil: serious?adKeyAdd(k,2):null};
  const out=[adaptNote('injuryOn',{k:'adMsgInjuryOn',p:[{z:zid}]},{safety:true})];
  return out.concat(injApplyAll());
}
function injResolve(why){
  const I=P.injury; if(!I) return [];
  const k=todayKey();
  I.status='resolved'; I.resolved=k;
  P.injuryHist=[{zone:I.zone,since:I.since,resolved:k,relapses:I.relapses||0,why}].concat(P.injuryHist||[]).slice(0,10);
  if(STRENGTH){ STRENGTH.sessions.forEach(s=>{ if(!s.done && s.date>=k && s.inj) strUnstash(s); }); if(!window.__ikSim){ try{ DB.save('strength_plan',STRENGTH); }catch(e){} } }
  const z=I.zone; P.injury=null;
  const st=adState(); if(st.block && String(st.block.zone||'')===z) st.block=null;      // le blocage « douleur répétée » de cette zone tombe avec la blessure
  st.painClearedAt=k; st.pains=[];
  // le premier effort de qualité qui revient est allégé d'un cran, comme après un blocage de douleur
  adaptApply('safetyBack',false,(pl,pc)=>{ const s=pl.sessions.filter(x=>adEd(x,k,true) && planIsHard(x)).sort((a,b)=>a.date<b.date?-1:1)[0]; return s && adLighten(s,0.85,pc,'safetyBack')?1:0; },{k:'adMsgSafetyBack',p:[]});
  return [adaptNote('injuryDone',{k:'adMsgInjuryDone',p:[{z}]})];
}
// Appelée à chaque signalement de douleur (depuis adRulePain).
function injAfterPain(zid, level, gait, repeat){
  const out=[];
  try{
    if(injActive()){
      const I=P.injury;
      if(I.zone===zid){
        I.reports=(I.reports||0)+1;
        if((level>=4||gait) && I.phase>1){ I.relapses=(I.relapses||0)+1; injSetPhase(1,'relapse'); out.push(adaptNote('injuryRelapse',{k:'adMsgInjuryRelapse',p:[{z:zid}]},{safety:true})); out.push.apply(out,injApplyAll()); }
        else if(level>=6||gait) I.restUntil=adKeyAdd(todayKey(),2);
      }
    } else {
      const ep=injEpisode(zid);
      if(injIsConfirmed(ep)) out.push.apply(out,injConfirm(zid,ep));
    }
    if(!injActive() || P.injury.zone!==zid){
      const r=strAdAcute(zid,level,gait,!!repeat); if(r && !r.quiet) out.push(r);
    }
  }catch(err){ console.error('[IKORUN] injAfterPain',err); }
  return out.filter(Boolean);
}
// Tous les jours : étapes, résolution, épisodes qui franchissent les 14 jours, rappels des mesures en cours.
function injuryDaily(){
  const out=[], k=todayKey();
  try{
    if(injActive()){
      const I=P.injury, rep=injLogArr().filter(r=>r.zone===I.zone && r.date>=I.phaseSince);
      const lastSerious=rep.filter(r=>r.level>=4||r.gait).map(r=>r.date).sort().pop();
      const lastMid=rep.filter(r=>r.level>=3||r.gait).map(r=>r.date).sort().pop();
      const lastAny=rep.map(r=>r.date).sort().pop();
      const dIn=injDaysSince(I.phaseSince);
      if(I.phase===1 && dIn>=7 && injDaysSince(lastSerious||I.phaseSince)>=5){ injSetPhase(2,'auto'); out.push(adaptNote('injuryP2',{k:'adMsgInjuryP2',p:[{z:I.zone}]},{safety:true})); out.push.apply(out,injApplyAll()); }
      else if(I.phase===2 && dIn>=7 && injDaysSince(lastMid||I.phaseSince)>=5){ injSetPhase(3,'auto'); out.push(adaptNote('injuryP3',{k:'adMsgInjuryP3',p:[{z:I.zone}]},{safety:true})); out.push.apply(out,injApplyAll()); }
      else if(I.phase===3 && dIn>=7 && injDaysSince(lastAny||I.phaseSince)>=7) out.push.apply(out,injResolve('auto'));
      else out.push.apply(out,injApplyAll(true));            // nouvelles séances entrées dans l'horizon (silencieux)
    } else {
      const zones=new Set(injLogArr().filter(x=>injDaysSince(x.date)<=INJ_GAP_DAYS).map(x=>x.zone));
      zones.forEach(z=>{ if(injActive()) return; const ep=injEpisode(z); if(injIsConfirmed(ep)) out.push.apply(out,injConfirm(z,ep)); });
      // douleur répétée en cours (blocage) : la muscu suit tant que le blocage dure
      const b=adState().block;
      if(!injActive() && b && b.src==='painRepeat' && adBlockActive(k)){ const r=strAdAcute(b.zone,5,false,true,true); if(r && !r.quiet) out.push(r); }
    }
    const st=adState();
    if(adIllActive(k) && st.ill){ const r=strAdIll(st.ill.restUntil,st.ill.easyUntil,true); if(r && !r.quiet) out.push(r); }
    out.push.apply(out,strRuleGaps());
  }catch(err){ console.error('[IKORUN] injuryDaily',err); }
  return out.filter(Boolean);
}
// « Je n'ai plus mal » / « Je vais mieux » (adaptClearSafety) : une étape de plus, ou retour à la normale.
function injOnClear(kind){
  let n=0;
  if(kind==='ill') n+=strRestoreIll();
  if(kind==='pain'){
    n+=strRestorePhase(false);
    if(injActive()){
      const I=P.injury;
      if(I.phase<3){ const p=I.phase+1; injSetPhase(p,'clear'); adaptNote('injuryP'+p,{k:'adMsgInjuryP'+p,p:[{z:I.zone}]},{safety:true}); injApplyAll(); n++; }
      else { injResolve('clear'); n++; }
    }
  }
  return n;
}
// Rendre la blessure visible à l'écran : étape, jour, exercices.
function injInfo(){
  if(!injActive()) return null;
  const I=P.injury;
  return {zone:I.zone, base:injBase(I.zone), phase:I.phase, days:injDaysSince(I.since), daysIn:injDaysSince(I.phaseSince), relapses:I.relapses||0,
    consult:(I.relapses||0)>=2 || injDaysSince(I.since)>=42};
}
