/* IKORUN — harnais des générateurs (V4.8.0). Évalué dans la vraie appli par tests/engine-harness.js.
   Rejoue des milliers de profils et mesure : robustesse, exigence, personnalisation, accord course ↔ muscu. */
(function(){
  function rng(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return((t^t>>>14)>>>0)/4294967296; }; }
  const MUTE=()=>{ window.toast=function(){}; window.burst=function(){}; window.renderSport=function(){}; DB.save=function(){}; DB.remove=function(){}; window.saveAll=function(){}; };
  const RACES=['5 km','10 km','Semi-marathon','Marathon'], RM={'5 km':5000,'10 km':10000,'Semi-marathon':21097,'Marathon':42195};
  const mmss=sec=>{ sec=Math.round(sec); return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0'); };
  function setProfile(o){
    const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+o.weeks*7+3);
    P.compDate=dateKey(d); P.objRace=o.race; P.objRaceKm=null; P.days=o.days.slice(); P.kmWeekMin=o.kmMin; P.kmWeekMax=o.kmMax;
    P.objGoal=o.goal||'Record personnel'; P.objTime=o.objTime||''; P.planSituation=o.situation||'continue'; P.planGap=o.gap||'m1_3';
    PREFS.likedTypes=o.liked||[]; P.vdotAdj=null;
    const tS=predictTime(o.vdot,5000); RECORDS=[{dist:'5000 m',meters:5000,time:mmss(tS),date:todayKey()}];
    SESS=[]; SESSLOG=[]; STRENGTH=o.strength===undefined?null:o.strength; P.adapt={}; ADAPT_LOG=[];
  }
  function randProfile(r,i){
    const race=RACES[Math.floor(r()*4)], nd=3+Math.floor(r()*4), all=[0,1,2,3,4,5,6], days=[];
    while(days.length<nd){ days.push(all.splice(Math.floor(r()*all.length),1)[0]); }
    const vdot=Math.round((32+r()*38)*10)/10, base=Math.round(15+(vdot-30)*1.1+r()*25), weeks=4+Math.floor(r()*21);
    const liked=r()<0.25?['Fartlek','Côtes','Tempo','VMA courte','Seuil'].filter(()=>r()<0.5):[];
    const goalT=r()<0.55?predictTime(vdot+r()*6,RM[race]):0;
    return {i,race,days,vdot,weeks,kmMin:base,kmMax:Math.round(base*(1.4+r()*0.6)),objTime:goalT?mmss(goalT):'',liked,situation:r()<0.12?'reprise':'continue',gap:['lt1','m1_3','m3_6','gt6'][Math.floor(r()*4)]};
  }
  const HARDQ=['VMAc','VMAl','VO2','INTERVAL','DBLSEUIL','SEUIL','SPE','SPE_COURT','TEMPO_SPE','TEMPO','PROGRESSIF','FARTLEK','COTES'], FAST=['VMAc','VMAl','VO2','INTERVAL'];
  const isHard=s=>HARDQ.includes(s.baseType)||s.baseType==='LONG'||s.baseType==='LONG_COURT';
  const fp=s=>s.baseType+'|'+Math.round(s.km)+'|'+(s.series?(s.series.segments?s.series.segments.map(x=>x.dist).join('-'):(s.series.reps+'x'+s.series.dist)):'')+'|'+(s.genParams&&s.genParams.fk?s.genParams.fk.length:(s.genParams&&s.genParams.n)||'');
  const num=v=>typeof v==='number'&&isFinite(v);

  function robust(plan,o){
    const e=[], ss=plan.sessions;
    ss.forEach(s=>{ ['km','duration','rpe'].forEach(k=>{ if(s[k]!=null && !num(+s[k])) e.push('NaN '+k+' '+s.baseType); }); if(s.baseType!=='Repos' && s.km>0 && !(parseTime(s.pace)>0)) e.push('allure invalide '+s.baseType+' '+s.pace);
      if(/NaN|undefined|3:6\d\b/.test(JSON.stringify([s.pace,s.series]))) e.push('texte invalide '+s.baseType); });
    const race=ss.filter(s=>s.baseType==='COURSE'); if(race.length!==1||race[0].date!==P.compDate) e.push('jour J absent ou déplacé');
    if(ss.some(s=>s.date>P.compDate)) e.push('séance après la course');
    const m={}; ss.forEach(s=>{ if(s.km>0&&s.baseType!=='Repos') m[s.date]=s; });
    Object.keys(m).sort().forEach(d=>{ const a=m[d], b=m[addDaysKey(d,1)]; if(b && ((isHard(a)&&isHard(b))||(b.baseType==='COURSE'&&isHard(a)))) e.push('dur→dur '+d); });
    const wk={}; ss.forEach(s=>{ if(s.baseType!=='COURSE') wk[s.week]=(wk[s.week]||0)+(s.km||0); });
    Object.keys(wk).forEach(w=>{ if(wk[w]>o.kmMax+1) e.push('volume S'+w+' '+Math.round(wk[w])+'>'+o.kmMax); });
    const lw={}; ss.forEach(s=>{ (lw[s.week]=lw[s.week]||[]).push(s); });
    Object.keys(lw).forEach(w=>{ const l=lw[w]; if(l.length>=3 && o.days.length>=3 && !l.some(s=>s.baseType==='LONG'||s.baseType==='LONG_COURT'||s.baseType==='COURSE'||s.deload||s.phaseKey==='TAPER'||s.ramp) && !(o.situation==='reprise')) e.push('sans sortie longue S'+w); });
    return e;
  }

  const OUT={};
  /* ---- A. robustesse ---- */
  OUT.robust=function(N,seed){
    MUTE(); const r=rng(seed||1); let ok=0, fail=[], val=0, valErr=0, t0=performance.now(); const kinds={};
    for(let i=0;i<N;i++){
      const o=randProfile(r,i); setProfile(o);
      let res; try{ res=planBuild({seed:i*7919+1}); }catch(x){ fail.push('#'+i+' exception '+x.message); continue; }
      if(res.err){ kinds[res.err]=(kinds[res.err]||0)+1; continue; }
      PLAN=res.plan; const e=robust(PLAN,o); const v=validatePlan(PLAN); val++; if(!v.ok) valErr++;
      if(e.length) fail.push('#'+i+' '+o.race+' '+o.days.length+'j '+o.weeks+'s : '+e.slice(0,3).join(' ; ')); else ok++;
      if(!v.ok && valErr<=3) fail.push('#'+i+' validatePlan : '+v.errors.slice(0,2).join(' ; '));
    }
    return {profils:N,ok,echecs:fail.length,validateurKO:valErr,erreursParType:kinds,ms:Math.round(performance.now()-t0),exemples:fail.slice(0,8)};
  };
  /* ---- B. exigence : 10 km à 32:00, 5 jours, 13 semaines ---- */
  OUT.demand=function(G){
    MUTE(); const r=rng(77); const base={race:'10 km',days:[1,2,4,5,6],weeks:13,kmMin:45,kmMax:90,vdot:61.8,objTime:'32:00',liked:[]};
    const pyr={}, wkNoFast=[], slow=[], vols=[], fastCount=[], tgt=3600/ (10*1000/ (32*60/ 1)) ;
    let goalPace=32*60/10, plans=[], qtot=0;
    for(let g=0;g<G;g++){
      setProfile(base); const res=planBuild({seed:g*104729+3}); PLAN=res.plan; plans.push(PLAN);
      const ss=PLAN.sessions, byW={}; ss.forEach(s=>{ (byW[s.week]=byW[s.week]||[]).push(s); });
      let nf=0; Object.keys(byW).forEach(w=>{ const l=byW[w]; const ph=l[0].phaseKey; if(['VO2','SPE','PIC'].includes(ph)){ const f=l.filter(s=>FAST.includes(s.baseType)).length; nf+=f; if(f<1 && !l.some(s=>s.deload)) wkNoFast.push('g'+g+' S'+w+' '+ph); } });
      fastCount.push(ss.filter(s=>FAST.includes(s.baseType)).length);
      ss.forEach(s=>{ if(s.baseType==='INTERVAL'&&s.series&&s.series.pyr) pyr[s.series.pyr]=(pyr[s.series.pyr]||0)+1;
        if((s.baseType==='VMAl'||s.baseType==='VO2'||s.baseType==='VMAc') && ['VO2','SPE','PIC'].includes(s.phaseKey)){ const w=planSegs(s,planPaces(PLAN.vdot)).filter(x=>x.k==='work'); const pa=w.reduce((a,x)=>a+x.sec,0)/w.reduce((a,x)=>a+x.km,0); if(!(pa<goalPace)) slow.push('g'+g+' '+s.baseType+' '+mmss(pa)+' S'+s.week); } });
      const v=validatePlan(PLAN); vols.push(Math.max(...Object.values(v.weeks).map(x=>x.km)));
    }
    const nq=plans.reduce((a,p)=>a+p.sessions.filter(s=>FAST.includes(s.baseType)).length,0), nn=plans.reduce((a,p)=>a+p.sessions.filter(s=>s.km>0).length,0);
    return {generations:G,rapidesParPlan:{min:Math.min(...fastCount),moy:Math.round(fastCount.reduce((a,b)=>a+b,0)/G*10)/10},part:Math.round(nq/nn*1000)/10+' % des séances',semainesSansRapide:wkNoFast.length,exemplesSansRapide:wkNoFast.slice(0,5),
      structuresPyramide:pyr,nbStructures:Object.keys(pyr).length,vmaPlusLentesQueObjectif:slow.length,exemplesLentes:slow.slice(0,5),volumeMaxMoy:Math.round(vols.reduce((a,b)=>a+b,0)/G),volumeMax:Math.max(...vols),vdotCible:plans[0].vdotT,pvoMax:Math.max(...plans[0].sessions.map(s=>s.pvo||0))};
  };
  /* ---- C. personnalisation ---- */
  const qual=s=>HARDQ.includes(s.baseType);
  function planSim(a,b){   // part des séances alignées identiques (type, km arrondi, structure)
    const A=a.sessions.filter(s=>s.baseType!=='Repos'), B=b.sessions.filter(s=>s.baseType!=='Repos'), n=Math.max(A.length,B.length); let same=0;
    for(let i=0;i<Math.min(A.length,B.length);i++) if(fp(A[i])===fp(B[i])) same++;
    return same/n;
  }
  OUT.perso=function(){
    MUTE(); const r=rng(2024); const res={};
    // (i) même utilisateur, 20 régénérations : part des séances de qualité différentes d'un plan à l'autre
    const base={race:'10 km',days:[1,3,4,5,6],weeks:13,kmMin:45,kmMax:90,vdot:61.8,objTime:'32:00',liked:[]}; const P20=[];
    for(let g=0;g<20;g++){ setProfile(base); P20.push(planBuild({seed:g*7717+11}).plan); }
    const diffs=[]; for(let i=0;i<20;i++) for(let j=i+1;j<20;j++){
      const A=P20[i].sessions.filter(qual), B=P20[j].sessions.filter(qual), n=Math.min(A.length,B.length); let d=0; for(let k=0;k<n;k++) if(fp(A[k])!==fp(B[k])) d++; diffs.push(d/n); }
    diffs.sort((a,b)=>a-b); res.memeUtilisateur={paires:diffs.length,minQualiteDifferente:Math.round(diffs[0]*100)+' %',moyenne:Math.round(diffs.reduce((a,b)=>a+b,0)/diffs.length*100)+' %',sous30:diffs.filter(x=>x<0.30).length};
    // (ii) deux utilisateurs : 1000 paires de profils
    const profs=[]; for(let i=0;i<120;i++){ const o=randProfile(r,i); setProfile(o); const pl=planBuild({seed:i*31+5}).plan; if(pl) profs.push({o,pl}); }
    const sims=[]; let identical=0; const maxPer=profs.map(()=>0);
    for(let k=0;k<1000;k++){ const a=Math.floor(r()*profs.length); let b=Math.floor(r()*profs.length); if(b===a) b=(b+1)%profs.length; const s=planSim(profs[a].pl,profs[b].pl); sims.push(s); if(s>=0.999) identical++; maxPer[a]=Math.max(maxPer[a],s); maxPer[b]=Math.max(maxPer[b],s); }
    sims.sort((a,b)=>a-b); const q=p=>Math.round(sims[Math.floor(p*(sims.length-1))]*100)+' %';
    res.entreUtilisateurs={paires:sims.length,similarite:{p5:q(0.05),mediane:q(0.5),p95:q(0.95),max:q(1)},plansIdentiques:identical,profilsQuiRessemblentATous:maxPer.filter(x=>x>0.9).length};
    // même utilisateur vs deux profils proches (VDOT ±1, mêmes jours) : reste différent ?
    return res;
  };
  OUT.persoStrength=function(){
    MUTE(); const r=rng(99); const out={}; const names=pl=>pl.sessions.flatMap(s=>s.ex.map(e=>e.name));
    const mk=(o,seed)=>{ const x=strengthRun(Object.assign({perWeek:3,days:[0,2,4],equip:'both',level:'Intermédiaire',linked:false,seed},o),todayKey()); return x.plan; };
    // même utilisateur : 20 graines
    const sets=[]; for(let g=0;g<20;g++){ const pl=mk({},g*977+1); sets.push(new Set(names(pl))); }
    let jac=[]; for(let i=0;i<20;i++) for(let j=i+1;j<20;j++){ const a=sets[i], b=sets[j]; let inter=0; a.forEach(x=>{ if(b.has(x)) inter++; }); jac.push(1-inter/(a.size+b.size-inter)); }
    out.memeUtilisateur={exercicesDifferentsMoy:Math.round(jac.reduce((a,b)=>a+b,0)/jac.length*100)+' %',min:Math.round(Math.min(...jac)*100)+' %'};
    // niveau : séries moyennes débutant vs avancé ; équipement maison
    const avgSets=pl=>{ const e=pl.sessions.flatMap(s=>s.ex.filter(x=>!x.rehab)); return e.reduce((a,x)=>a+x.sets,0)/e.length; };
    out.niveau={debutant:Math.round(avgSets(mk({level:'Débutant'},5))*100)/100,intermediaire:Math.round(avgSets(mk({level:'Intermédiaire'},5))*100)/100,avance:Math.round(avgSets(mk({level:'Avancé'},5))*100)/100};
    const home=mk({equip:'maison'},8); const cat=allExercises(); const bad=names(home).filter(n=>{ const e=cat.find(x=>x.name===n); return e && !['Poids du corps','Haltères','Élastique','Kettlebell'].includes(e.equip); });
    out.maison={exercicesHorsMateriel:bad.length,exemples:[...new Set(bad)].slice(0,4)};
    const jours=[]; for(let i=0;i<60;i++){ const nd=1+Math.floor(r()*3), all=[0,1,2,3,4,5,6], dd=[]; while(dd.length<nd) dd.push(all.splice(Math.floor(r()*all.length),1)[0]); const pl=mk({days:dd,perWeek:nd},i*13+1); const off=pl.sessions.filter(s=>!dd.includes(s.dow)).length; jours.push(off); }
    out.joursRespectes={plans:60,seancesHorsJours:jours.reduce((a,b)=>a+b,0)};
    // deux profils muscu différents : séances identiques ?
    const A=mk({level:'Débutant',equip:'maison',perWeek:2,days:[1,4]},3), B=mk({level:'Avancé',equip:'salle',perWeek:3,days:[0,2,4]},3);
    out.profilsDifferents={exercicesCommuns:Math.round([...new Set(names(A))].filter(x=>new Set(names(B)).has(x)).length/new Set(names(A)).size*100)+' %'};
    return out;
  };
  /* ---- D. accord course ↔ muscu ---- */
  OUT.link=function(N){
    MUTE(); const r=rng(31337); const F={legsHardDay:0,legsBeforeHard:0,afterRace:0,taperLegs:0,invalid:0,silentAdapt:0,qualityKilled:0,relinkLost:0,relinkDup:0,bidiBefore:0,bidiAfter:0,bidiHard:0,plans:0,adapts:0,legsSessions:0};
    for(let i=0;i<N;i++){
      const o=randProfile(r,i); if(o.days.length<3) o.days.push(...[0,1,2,3,4,5,6].filter(x=>!o.days.includes(x)).slice(0,3-o.days.length));
      setProfile(o); const res=planBuild({seed:i*53+9}); if(res.err) continue; PLAN=res.plan;
      const nd=1+Math.floor(r()*3), sd=[]; const all=[0,1,2,3,4,5,6]; while(sd.length<nd) sd.push(all.splice(Math.floor(r()*all.length),1)[0]);
      const so={perWeek:nd,days:sd,equip:['salle','maison','both'][Math.floor(r()*3)],level:['Débutant','Intermédiaire','Avancé'][Math.floor(r()*3)],linked:true,seed:i*17+1};
      const st=strengthRun(so,todayKey()); if(st.err) continue; STRENGTH=st.plan; STRENGTH.opts=so; STRENGTH.linkedRun=true; F.plans++;
      const v=validateStrengthPlan({sessions:STRENGTH.sessions,perWeek:STRENGTH.perWeek,raceDate:STRENGTH.raceDate},PLAN.sessions); if(!v.ok) F.invalid++;
      const byD={}; PLAN.sessions.forEach(s=>{ if(s.km>0&&s.baseType!=='Repos') byD[s.date]=s; });
      const keyRun=s=>s&&(HARDQ.includes(s.baseType)||s.baseType==='LONG'||s.baseType==='LONG_COURT');
      STRENGTH.sessions.forEach(s=>{
        if(s.legsHeavy){ F.legsSessions++; if(keyRun(byD[s.date])) F.legsHardDay++; if(keyRun(byD[addDaysKey(s.date,1)])) F.legsBeforeHard++;
          const rc=PLAN.sessions.find(x=>x.baseType==='COURSE'); if(rc && Math.round((new Date(rc.date)-new Date(s.date))/864e5)<=5) F.taperLegs++; }
        if(s.date>=PLAN.sessions.find(x=>x.baseType==='COURSE').date) F.afterRace++; });
      // adaptAfterMuscu : jambes faites la veille d'une séance dure → alléger ET le dire ; jamais ailleurs
      const legs=STRENGTH.sessions.find(s=>s.legsHeavy&&s.date>=todayKey()); if(legs){
        const before=JSON.stringify(PLAN.sessions.map(s=>[s.id,s.baseType,s.km])), logN=ADAPT_LOG.length;
        // on force la situation : une séance dure le lendemain
        const nxt=PLAN.sessions.find(s=>s.date===addDaysKey(legs.date,1));
        const out=adaptAfterMuscu({date:legs.date,legsHeavy:true,muscles:[]});
        const after=JSON.stringify(PLAN.sessions.map(s=>[s.id,s.baseType,s.km]));
        if(after!==before){ F.adapts++; if(ADAPT_LOG.length===logN) F.silentAdapt++;
          const changed=PLAN.sessions.filter((s,ix)=>JSON.stringify([s.id,s.baseType,s.km])!==JSON.parse(before)[ix].join&&false);
          const A=JSON.parse(before); PLAN.sessions.forEach((s,ix)=>{ const a=A[ix]; if(a && (a[1]!==s.baseType||a[2]!==s.km) && s.date>addDaysKey(legs.date,1)) F.qualityKilled++; }); }
      }
      // régénération du plan de course : la muscu liée se recale, passé et faits conservés
      const doneIds=STRENGTH.sessions.filter((s,ix)=>ix<2).map(s=>s.id); STRENGTH.sessions.forEach(s=>{ if(doneIds.includes(s.id)) s.done=true; });
      const keep=STRENGTH.sessions.filter(s=>s.done||s.date<todayKey()).map(s=>s.id+'|'+s.date);
      const res2=planBuild({seed:i*53+10}); if(!res2.err){ PLAN=res2.plan; strengthRelink();
        const now=STRENGTH.sessions.map(s=>s.id+'|'+s.date); keep.forEach(k=>{ if(!now.includes(k)) F.relinkLost++; });
        const dates=STRENGTH.sessions.map(s=>s.date); if(new Set(dates).size!==dates.length) F.relinkDup++;
        const v2=validateStrengthPlan({sessions:STRENGTH.sessions.filter(s=>!s.done&&s.date>=todayKey()),perWeek:STRENGTH.perWeek,raceDate:STRENGTH.raceDate},PLAN.sessions); if(!v2.ok) F.invalid++; }
      // sens muscu → course : part des séances dures sur un jour de jambes ou le lendemain, sans puis avec le plan de muscu
      const legsDow=new Set(STRENGTH.sessions.filter(s=>s.legsHeavy&&!s.done&&s.date>=todayKey()).map(s=>(new Date(s.date+'T12:00:00').getDay()+6)%7)); const bad=new Set(); legsDow.forEach(d=>{ bad.add(d); bad.add((d+1)%7); });
      const hardOn=pl=>pl.sessions.filter(s=>keyRun(s)&&s.baseType!=='COURSE'&&s.date>=todayKey()&&bad.has((new Date(s.date+'T12:00:00').getDay()+6)%7)).length;
      const hardAll=PLAN.sessions.filter(s=>keyRun(s)&&s.baseType!=='COURSE'&&s.date>=todayKey()).length;
      const sv=STRENGTH; STRENGTH=null; const noS=planBuild({seed:i*53+9}); STRENGTH=sv; const withS=planBuild({seed:i*53+9});
      if(!noS.err&&!withS.err){ F.bidiBefore+=hardOn(noS.plan); F.bidiAfter+=hardOn(withS.plan); F.bidiHard+=hardAll; }
    }
    return F;
  };
  window.__ENG=OUT;
})();
