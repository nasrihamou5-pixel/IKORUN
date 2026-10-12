/* ============================================================================
   IKORUN — MOTEUR D'ADAPTATION DU PLAN (V3.15.0)
   ----------------------------------------------------------------------------
   Script classique assemblé après app.js dans app.min.js (tools/bundle.json) : il partage
   le même environnement global (P, PLAN, SESS, SESSLOG, CHECKINS, ADAPT_LOG, t(), tp()…).
   Aucune IA : des règles explicites, écrites comme un entraîneur les appliquerait.

   1. Charges (une seule source de vérité : loadModel)
      · charge d'une séance = durée (min) × RPE (sRPE de Foster) — course, musculation, vélo,
        natation… RPE manquant : RPE attendu du type de séance, sinon 5 ;
      · aiguë = moyenne des 7 derniers jours, chronique = moyenne des 28 derniers ;
        ACWR = aiguë / chronique, seulement après 21 jours d'historique (avant, des semaines
        « vides » feraient croire à une surcharge) ;
      · monotonie = moyenne / écart-type des charges quotidiennes sur 7 jours, contrainte
        (strain) = charge de la semaine × monotonie. L'outil ACWR lit ce même calcul.
   2. Exécution d'une séance (adaptExec) : allure réelle vs cible corrigée de la chaleur
      (section météo) et du jeûne (Ramadan), durée, RPE vs RPE attendu du type.
   3. Indice de forme du jour (adaptReadiness), à partir du check du matin ou du dernier bilan.
   4. Règles, par priorité (une règle de sécurité désactive les règles de progression) :
      e. douleur, maladie · d. coupures · f. charge (ACWR, monotonie) · g. forme du jour ·
      a. trop vite · b. trop lent / trop dur · c. bien fait · d. séance ratée.
   5. Garde-fous (h) : chaque ajustement est fait sur une COPIE du plan, repassée par
      planSettle (forme des semaines, +10 %/semaine) puis validatePlan. S'il crée une erreur
      qui n'existait pas, il est refusé (noté « refusé » dans le journal) et le plan ne bouge
      pas. Jamais deux séances dures d'affilée, l'affûtage et la course ne sont jamais
      supprimés, délais de recharge par règle (hystérésis), jamais deux fois la même action
      sur la même séance.
   6. Transparence : chaque ajustement est noté dans ADAPT_LOG (clé « adapt_log ») avec la
      raison et les séances avant → après ; ceux qui ne touchent pas à la sécurité
      s'annulent d'un geste (plan/adapt-ui.js).
   ============================================================================ */

/* ---------- 1. CHARGES ---------- */
// RPE attendu par type de séance (échelle de Borg CR-10).
const RPE_EXP={EF:[3,4],RECUP:[2,3],LONG:[4,5],LONG_COURT:[4,5],LIGNES:[4,5],PROGRESSIF:[5,6],FARTLEK:[6,7],
  TEMPO:[6,7],SEUIL:[7,7],DBLSEUIL:[7,7],TEMPO_SPE:[7,7],SPE:[7,8],SPE_COURT:[7,8],COTES:[7,8],
  VMAl:[8,9],VO2:[8,9],VMAc:[8,9],INTERVAL:[8,9],COURSE:[9,10]};
function rpeExpOf(bt){ return RPE_EXP[bt]||null; }
function rpeExpMid(bt){ const r=RPE_EXP[bt]; return r?(r[0]+r[1])/2:null; }
// Type stable d'une séance de l'historique : baseType du plan s'il est connu, sinon son libellé.
function adBaseTypeOfSess(s){
  if(!s) return null;
  if(s.baseType) return s.baseType;
  if(s.planSessionId && PLAN && PLAN.sessions){ const ps=PLAN.sessions.find(x=>x.id===s.planSessionId); if(ps) return ps.baseType; }
  return (typeof SESS_TYPE_TO_KEY!=='undefined' && SESS_TYPE_TO_KEY[s.type])||null;
}
function adKeyAdd(k,n){ const d=new Date(k+'T12:00:00'); d.setDate(d.getDate()+n); return dateKey(d); }
function adMondayKey(k){ const d=new Date(k+'T12:00:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); return dateKey(d); }
function adSameWeek(a,b){ return adMondayKey(a)===adMondayKey(b); }
function adDaysBetweenKeys(a,b){ return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000); }
let _lmCache=null;
function loadModel(endKey){
  endKey=endKey||todayKey();
  const sig=endKey+'|'+(SESS||[]).length+'|'+(MSESS||[]).length+'|'+((PLAN&&PLAN.sessions)||[]).filter(s=>s.missedReplData).length+'|'+(SESSLOG||[]).length;
  if(_lmCache && _lmCache.sig===sig) return _lmCache.m;
  const daily={}; let first=null, last=null;
  const add=(d,v)=>{ if(!d||d>endKey||!(v>0)) return; daily[d]=(daily[d]||0)+v; if(!first||d<first) first=d; if(!last||d>last) last=d; };
  (SESS||[]).forEach(s=>{
    let dur=+s.duration||0;
    if(!dur && +s.km>0){ const pk=parseTime(s.pace); dur=+s.km*(pk>0?pk:360)/60; }
    add(s.date, dur*((+s.rpe)||rpeExpMid(adBaseTypeOfSess(s))||5));
  });
  (MSESS||[]).forEach(m=>add(m.date,(+m.duration||0)*((+m.rpe)||5)));
  // activités de remplacement (vélo, natation, mobilité…) notées à la place d'une séance ratée
  ((PLAN&&PLAN.sessions)||[]).forEach(s=>{ const r=s.missedReplData; if(s.missed && r && r.kind && r.dur) add(s.date,(+r.dur)*((+r.rpe)||4)); });
  const days=[]; for(let i=27;i>=0;i--){ const k=adKeyAdd(endKey,-i); days.push({d:k,l:daily[k]||0}); }
  const hist=first?adDaysBetweenKeys(first,endKey)+1:0;
  const sum=a=>a.reduce((x,y)=>x+y.l,0);
  const wk=days.slice(-7);
  // Moyennes mobiles EXPONENTIELLES (Williams et al., 2017) : λ = 2/(N+1), N = 7 et 28 jours. Les
  // moyennes simples « couplées » faisaient bondir l'ACWR au-dessus de 1,3 la semaine qui suit une
  // décharge prévue, sans aucune surcharge réelle.
  let acute=0, chronic=0;
  if(first){
    const la=2/8, lc=2/29, n=Math.min(hist,180), d0=adKeyAdd(endKey,-(n-1));
    const seed=[]; for(let i=0;i<Math.min(7,n);i++) seed.push(daily[adKeyAdd(d0,i)]||0);
    acute=chronic=seed.reduce((a,b)=>a+b,0)/Math.max(1,seed.length);
    for(let i=0;i<n;i++){ const l=daily[adKeyAdd(d0,i)]||0; acute=la*l+(1-la)*acute; chronic=lc*l+(1-lc)*chronic; }
  }
  const acwr=(hist>=21 && chronic>0)?acute/chronic:null;
  const mean=acute, sd=Math.sqrt(wk.reduce((x,y)=>x+Math.pow(y.l-mean,2),0)/7);
  const active=wk.filter(x=>x.l>0).length;
  const monotony=(active>=3 && sd>0)?mean/sd:null;
  const weekLoad=sum(wk);
  const m={acute,chronic,acwr,monotony,strain:monotony!=null?weekLoad*monotony:null,weekLoad,hist,days,daily,last,first,active7:active};
  _lmCache={sig,m};
  return m;
}
// Dernier jour avec une activité réelle (course, musculation, remplacement) avant ou le jour donné.
function adLastActivity(beforeKey){
  let last=null;
  const consider=d=>{ if(d && d<=beforeKey && (!last||d>last)) last=d; };
  (SESS||[]).forEach(s=>{ if((+s.km||0)>0||(+s.duration||0)>0) consider(s.date); });
  (MSESS||[]).forEach(m=>consider(m.date));
  ((PLAN&&PLAN.sessions)||[]).forEach(s=>{ if(s.done) consider(s.date); if(s.missed && s.missedReplData && s.missedReplData.dur) consider(s.date); });
  return last;
}

/* ---------- 2. EXÉCUTION D'UNE SÉANCE ---------- */
// Correction d'allure du jeûne (Ramadan) : 3 % d'allure en plus sont attendus, sans faute.
const AD_FAST_CORR=0.03;
function adaptExec(e){
  const bt=e.baseType, exp=rpeExpOf(bt);
  const out={dev:null,devS:null,durDev:null,rpeDev:0,verdict:'none',rawVerdict:'none',causes:[],corr:0,tgt:null,real:null};
  const corr=Math.max(0,(+((e.wx&&e.wx.corr)||0)))+(e.fast?AD_FAST_CORR:0);
  out.corr=corr;
  let tgt=null, real=null;
  const reps=(e.reps||[]).filter(r=>r && r.timeS>0 && r.target>0 && r.dist>0);
  if(reps.length){
    const km=reps.reduce((a,r)=>a+r.dist,0)/1000;
    tgt=reps.reduce((a,r)=>a+r.target,0)/km; real=reps.reduce((a,r)=>a+r.timeS,0)/km;
  } else if(e.planned && e.real && e.planned.paceS>0 && e.real.paceS>0){ tgt=e.planned.paceS; real=e.real.paceS; }
  if(e.planned && e.real && e.planned.dur>0 && e.real.dur>0) out.durDev=e.real.dur/e.planned.dur-1;
  if(exp && e.rpe){ out.rpeDev=e.rpe>exp[1]?e.rpe-exp[1]:e.rpe<exp[0]?e.rpe-exp[0]:0; }
  const quality=PLAN_HARD_Q.includes(bt);
  const judge=d=>{
    if(bt==='COURSE') return 'race';
    if(quality) return d>=0.04?'fast':d>=-0.03?'ok':d>=-0.08?'slow':'verySlow';
    return d>=0.06?'fast':'ok'; // footing, sortie longue : la lenteur n'est jamais une faute
  };
  if(tgt>0 && real>0){
    const tgtC=tgt*(1+corr);
    out.tgt=tgtC; out.real=real;
    out.dev=(tgtC-real)/tgtC; out.devS=tgtC-real;
    out.verdict=judge(out.dev); out.rawVerdict=judge((tgt-real)/tgt);
  } else if(bt) out.verdict='ok';
  // Séance nettement raccourcie (choix « modifié ») : notée, jamais jugée comme une contre-performance.
  if(e.status==='modified' && out.durDev!=null && out.durDev<-0.2) out.short=true;
  if(out.rpeDev>=2) out.hard=true;
  // Causes extérieures possibles d'une séance lente ou dure.
  const c=out.causes;
  if(corr>0 && e.wx && e.wx.corr>=0.01) c.push('heat');
  if(e.wx && e.wx.wind>=25) c.push('wind');
  if(+e.deniv>0 && e.real && e.real.km>0 && e.deniv/e.real.km>=15) c.push('hills');
  if(e.fast) c.push('fasting');
  if(e.sleepQ===1) c.push('sleep');
  if(e.legs===3) c.push('legs');
  if(e.ill) c.push('ill');
  if(e.pain && e.pain.on) c.push('pain');
  const m=loadModel(e.date); if(m.acwr!=null && m.acwr>1.3) c.push('load');
  return out;
}

/* ---------- 3. FORME DU JOUR ---------- */
function adCheckinOf(k){ return (CHECKINS||[]).filter(c=>c.date===k).sort((a,b)=>(b.ut||0)-(a.ut||0))[0]||null; }
function adState(){
  P.adapt=P.adapt||{};
  const st=P.adapt; st.cd=st.cd||{}; st.pains=st.pains||[];
  return st;
}
function adBlockActive(k){ const b=adState().block; return !!(b && (!b.until || b.until>=k)); }
function adIllActive(k){ const i=adState().ill; return !!(i && i.easyUntil && i.easyUntil>=k); }
function adaptReadiness(k){
  k=k||todayKey();
  const ci=adCheckinOf(k);
  const nowTs=(window.__ikSimNow!=null?window.__ikSimNow:Date.now());
  const lastB=(SESSLOG||[]).filter(e=>e.v===2 && e.date<=k && e.date>=adKeyAdd(k,-1) && (nowTs-(e.ts||0))<=36*3600e3+86400e3).sort((a,b)=>(b.ts||0)-(a.ts||0))[0];
  if(!ci && !lastB) return null;
  const parts=[]; let s=75;
  const push=(key,v)=>{ if(v){ s+=v; parts.push([key,v]); } };
  const sleep=ci?ci.sleep:lastB.sleepQ, legs=ci?ci.sore:lastB.legs, mood=ci?ci.mood:lastB.mood;
  if(sleep) push('rdSleep',sleep===1?-15:sleep===2?-5:5);
  if(legs) push('rdLegs',legs===3?-15:legs===1?5:0);
  if(mood) push('rdMood',(mood-3)*5);
  const pain=(SESSLOG||[]).filter(e=>e.v===2 && e.pain && e.pain.on && e.date>=adKeyAdd(k,-3) && e.date<=k).sort((a,b)=>(b.ts||0)-(a.ts||0))[0];
  if(pain && !(adState().painClearedAt>=pain.date)) push('rdPain',(pain.pain.level>=4||pain.pain.gait)?-30:-10);
  if(adIllActive(k)) push('rdIll',-40);
  const m=loadModel(k);
  if(m.acwr!=null) push('rdLoad',m.acwr>1.5?-20:m.acwr>1.3?-10:0);
  const y=adKeyAdd(k,-1);
  const hardY=(SESS||[]).some(x=>x.date===y && PLAN_HARD_Q.includes(adBaseTypeOfSess(x)));
  if(hardY) push('rdHardYday',-5);
  let streak=0; for(let i=1;i<=7;i++){ if((m.daily[adKeyAdd(k,-i)]||0)>0) streak++; else break; }
  if(streak>5) push('rdStreak',-5);
  s=Math.max(0,Math.min(100,Math.round(s)));
  return {score:s,level:s<45?'low':s<60?'caution':s>=80?'good':'ok',parts,src:ci?'checkin':'bilan'};
}

/* ---------- 4. OUTILS SUR LES SÉANCES (appliqués à une copie du plan) ---------- */
function adEd(s,k,safety){
  return !!s && !s.done && !s.missed && s.date>=k && s.baseType!=='COURSE' && s.baseType!=='Repos' && (s.km||0)>0 && (safety || !s.customized);
}
function adTag(s,rule,light){ const km0=(s.adj&&s.adj.km0!=null)?s.adj.km0:(+s.km||0); s.adj=Object.assign({},s.adj||{},{r:rule,km0,light:!!(light||(s.adj&&s.adj.light))}); s.adjHist=(s.adjHist||[]).concat(rule); }
function adKeepKm0(s){ if(!(s.adj && s.adj.km0!=null)) s.adj=Object.assign({},s.adj||{},{km0:+s.km||0}); }
function adDone(s,rule){ return !!(s && s.adjHist && s.adjHist.includes(rule)); }
function adToEasy(s,km,pc,rule){
  adKeepKm0(s);
  const L=PLAN_EASY_FLOOR.EF;
  Object.assign(s,{baseType:'EF',type:t('sessLabel_EF'),title:t('sessTitle_EF'),rpe:3,desc:t('bs_ef_objectif'),detail:null,series:null,genParams:null,
    km:Math.max(L,Math.round(Math.min(s.km,km||s.km)))});
  planApplySegs(s,pc); adTag(s,rule,true); return true;
}
function adToRest(s,rule){
  adKeepKm0(s);
  Object.assign(s,{type:'Repos',baseType:'Repos',title:t('restTag'),km:0,duration:0,pace:null,desc:'',series:null,detail:null,genParams:null});
  adTag(s,rule,true); return true;
}
// Allège une séance d'un facteur f : footings et sortie longue en distance ; qualité d'un ou
// plusieurs crans (même type, même intensité), jusqu'à atteindre le volume voulu.
function adLighten(s,f,pc,rule){
  const km0=s.km, keep=s.adj; adKeepKm0(s);
  if(planIsHard(s)){
    for(let i=0;i<4 && s.km>km0*f+0.05;i++){ if(!planShrinkQuality(s,pc)) break; }
    if(s.km>=km0-0.05){ s.adj=keep; if(!keep) delete s.adj; return false; }
  } else {
    const fl=PLAN_EASY_FLOOR[s.baseType]||3, nk=Math.max(fl,Math.round(km0*f*10)/10);
    if(nk>=km0-0.05){ s.adj=keep; if(!keep) delete s.adj; return false; }
    s.km=nk; planApplySegs(s,pc);
  }
  adTag(s,rule,true); return true;
}
function adByDate(pl){ const m={}; pl.sessions.forEach(s=>{ if(s.baseType!=='Repos' && (s.km||0)>0) m[s.date]=s; }); return m; }
function adClash(a,b){ return !!a && !!b && ((planIsHard(a)&&planIsHard(b)) || (planIsLong(a)&&(planIsHard(b)||planIsLong(b))) || (planIsHard(a)&&planIsLong(b)) || (b.baseType==='COURSE'&&(planIsHard(a)||planIsLong(a)))); }
function adClashAround(pl,d){ const m=adByDate(pl); return adClash(m[adKeyAdd(d,-1)],m[d]) || adClash(m[d],m[adKeyAdd(d,1)]); }
// Échange les contenus de deux séances (dates gardées) ; rend faux et rétablit si ça crée un enchaînement dur.
function adSwapContent(pl,a,b){
  const F=['type','baseType','title','km','duration','pace','rpe','series','desc','detail','genParams'];
  const ka=+a.km||0, kb=+b.km||0;
  const ca={}, cb={}; F.forEach(f=>{ ca[f]=a[f]; cb[f]=b[f]; });
  Object.assign(a,cb); Object.assign(b,ca);
  if(adClashAround(pl,a.date)||adClashAround(pl,b.date)){ Object.assign(a,ca); Object.assign(b,cb); return false; }
  if(!(a.adj&&a.adj.km0!=null)) a.adj=Object.assign({},a.adj||{},{km0:ka});
  if(!(b.adj&&b.adj.km0!=null)) b.adj=Object.assign({},b.adj||{},{km0:kb});
  return true;
}
function adSessSnap(s){
  if(!s) return null;
  const o={}; ['id','date','week','baseType','type','title','km','duration','pace','rpe','series','genParams','deload','phaseKey','phase','color','desc','adj','adjHist','customized','ramp','done','missed'].forEach(f=>{ if(s[f]!==undefined) o[f]=s[f]; });
  return JSON.parse(JSON.stringify(o));
}

/* ---------- 5. APPLIQUER UN AJUSTEMENT (copie → règles → planSettle → validatePlan) ---------- */
function adUid(){ return 'ad'+(window.__ikSimNow!=null?window.__ikSimNow:Date.now()).toString(36)+Math.random().toString(36).slice(2,7); }
function adNowTs(){ return window.__ikSimNow!=null?window.__ikSimNow:Date.now(); }
function adLog(entry){
  entry.id=entry.id||adUid(); entry.ut=adNowTs(); entry.ts=entry.ts||entry.ut; entry.date=entry.date||todayKey();
  ADAPT_LOG=(ADAPT_LOG||[]).concat(entry);
  // Journal borné : 150 entrées, 180 jours (les propositions en attente restent).
  const lim=adKeyAdd(todayKey(),-180);
  if(ADAPT_LOG.length>150) ADAPT_LOG=ADAPT_LOG.filter(x=>x.status==='proposal'||x.date>=lim).slice(-150);
  return entry;
}
/* rule : nom de la règle · safety : ajustement de sécurité · mutate(pl,pc,k) modifie la copie et
   rend le nombre de séances touchées · msg : {k,p} message (clé i18n + paramètres). */
function adaptApply(rule,safety,mutate,msg,extra){
  if(!PLAN||!PLAN.sessions) return null;
  const k=todayKey();
  const pl=JSON.parse(JSON.stringify(PLAN));
  const pc=planPaces(pl.vdot||getUserVDOT()||45);
  let n=0; try{ n=mutate(pl,pc,k)||0; }catch(err){ console.error('[IKORUN] adapt',rule,err); return null; }
  if(!n) return null;
  planSettle(pl,planPaces(pl.vdot||getUserVDOT()||45));
  const since=pl.created;
  const v0=validatePlan(PLAN,{since}), v1=validatePlan(pl,{since});
  const base=new Set(v0.errors), added=v1.errors.filter(x=>!base.has(x));
  const byId=o=>{ const m={}; o.sessions.forEach(s=>{ m[s.id]=s; }); return m; };
  const A=byId(PLAN), B=byId(pl), ids=[];
  new Set([...Object.keys(A),...Object.keys(B)]).forEach(id=>{ if(JSON.stringify(adSessSnap(A[id]))!==JSON.stringify(adSessSnap(B[id]))) ids.push(+id); });
  const entry=Object.assign({rule,safety:!!safety,sessIds:ids,before:ids.map(id=>adSessSnap(A[id])).filter(Boolean),after:ids.map(id=>adSessSnap(B[id])).filter(Boolean),msg,seen:false},extra||{});
  if(added.length){
    entry.status='rejected'; entry.why=added.slice(0,3); entry.before=[]; entry.after=[];
    adLog(entry); console.warn('[IKORUN] ajustement refusé ('+rule+') :',added);
    return null;
  }
  if(!ids.length) return null;
  entry.status='applied';
  PLAN=pl;
  return adLog(entry);
}
// Message seul (validation, explication) : noté dans le journal, sans toucher au plan.
function adaptNote(rule,msg,extra){ return adLog(Object.assign({rule,safety:false,sessIds:[],before:[],after:[],msg,status:'note',seen:false},extra||{})); }
function adCool(rule,days){ const d=adState().cd[rule]; return !!(d && adDaysBetweenKeys(d,todayKey())<days); }
function adFired(rule){ adState().cd[rule]=todayKey(); }
// Séances concernées par une fenêtre [k, k+n[ (non faites, modifiables).
function adWindow(pl,k,n,safety){ const end=adKeyAdd(k,n); return pl.sessions.filter(s=>adEd(s,k,safety) && s.date<end); }

/* ---------- 6. RÈGLES ---------- */
/* e. Douleur et maladie — jamais de diagnostic, toujours le conseil de consulter si ça dure. */
function adRulePain(e){
  let p=e.pain; if(!p||!p.on) return [];
  const st=adState(), k=todayKey(), out=[];
  // zone + côté : le genou gauche et le genou droit ne sont pas la même douleur
  const zid=(p.zone||'other')+(p.side?'_'+p.side:'');
  st.pains=(st.pains||[]).filter(x=>x.date>=adKeyAdd(k,-14)).concat({date:e.date,zone:zid,level:+p.level||0,gait:!!p.gait});
  const same=st.pains.filter(x=>x.zone===zid && x.date>=adKeyAdd(k,-6)).length;
  p={zone:zid,level:p.level,gait:p.gait,on:true};
  if(same>=3){
    // même zone trois fois en sept jours : plus d'intensité jusqu'à « je n'ai plus mal »
    st.block={since:k,until:null,zone:p.zone||'other',src:'painRepeat'};
    const r=adaptApply('painRepeat',true,(pl,pc)=>{ let n=0; adWindow(pl,k,14,true).forEach(s=>{ if(planIsHard(s)||planIsLong(s)){ adToEasy(s,Math.min(s.km,6),pc,'painRepeat'); n++; } }); return n; },
      {k:'adMsgPainRepeat',p:[{z:p.zone||'other'}]});
    out.push(r||adaptNote('painRepeat',{k:'adMsgPainRepeat',p:[{z:p.zone||'other'}]},{safety:true}));
  } else if((+p.level||0)>=4 || p.gait){
    st.block={since:k,until:adKeyAdd(k,3),zone:p.zone||'other',src:'pain'};
    const r=adaptApply('pain',true,(pl,pc)=>{ let n=0; adWindow(pl,k,4,true).forEach(s=>{
        if(planIsHard(s)||planIsLong(s)){ adToEasy(s,Math.min(s.km,5),pc,'pain'); n++; }
        else if(adLighten(s,0.7,pc,'pain')) n++; }); return n; },
      {k:'adMsgPain',p:[+p.level||0,{z:p.zone||'other'}]});
    out.push(r||adaptNote('pain',{k:'adMsgPain',p:[+p.level||0,{z:p.zone||'other'}]},{safety:true}));
  } else {
    out.push(adaptNote('painLight',{k:'adMsgPainLight',p:[+p.level||0,{z:p.zone||'other'}]}));
  }
  return out.filter(Boolean);
}
function adRuleIll(startKey){
  const st=adState(), k=todayKey();
  const restUntil=adKeyAdd(k,1), easyUntil=adKeyAdd(k,6);
  st.ill={start:startKey||k,restUntil,easyUntil};
  const r=adaptApply('ill',true,(pl,pc)=>{ let n=0;
    adWindow(pl,k,7,true).forEach(s=>{
      if(s.date<=restUntil){ adToRest(s,'ill'); n++; }
      else if(planIsHard(s)||planIsLong(s)){ adToEasy(s,Math.min(s.km,6),pc,'ill'); n++; }
      else if(adLighten(s,0.7,pc,'ill')) n++;
    }); return n; },{k:'adMsgIll',p:[{d:restUntil},{d:easyUntil}]});
  return [r||adaptNote('ill',{k:'adMsgIll',p:[{d:restUntil},{d:easyUntil}]},{safety:true})];
}
// Blocage en cours (douleur répétée) ou retour de maladie : la fenêtre glisse avec les jours.
function adRuleKeepBlocks(){
  const st=adState(), k=todayKey(), out=[];
  if(st.block && st.block.until && st.block.until<k) st.block=null;
  if(st.ill && st.ill.easyUntil<k) st.ill=null;
  if(adBlockActive(k)){
    const end=st.block.until?adKeyAdd(st.block.until,1):adKeyAdd(k,7);
    const r=adaptApply('blockKeep',true,(pl,pc)=>{ let n=0; pl.sessions.filter(s=>adEd(s,k,true) && s.date<end && (planIsHard(s)||planIsLong(s))).forEach(s=>{ adToEasy(s,Math.min(s.km,6),pc,'blockKeep'); n++; }); return n; },
      {k:'adMsgBlockKeep',p:[{z:st.block.zone}]});
    if(r) out.push(r);
  }
  if(adIllActive(k)){
    const r=adaptApply('illKeep',true,(pl,pc)=>{ let n=0; pl.sessions.filter(s=>adEd(s,k,true) && s.date<=st.ill.easyUntil && planIsHard(s)).forEach(s=>{ adToEasy(s,Math.min(s.km,6),pc,'illKeep'); n++; }); return n; },
      {k:'adMsgIllKeep',p:[{d:st.ill.easyUntil}]});
    if(r) out.push(r);
  }
  return out;
}

/* d. Coupures — d'après le retour d'entraînement de Daniels (VDOT O2) pour la VDOT ; volume de
   reprise selon la règle IKORUN (50 % puis 75 % ; au-delà de 28 jours, 33 %, 50 %, 75 %). */
const DANIELS_OFF=[[5,1],[6,0.997],[14,0.973],[28,0.931],[72,0.8]];
const DANIELS_OFF_X=[[5,1],[6,0.998],[14,0.986],[28,0.965],[72,0.9]]; // avec activité croisée ; 72 j : moitié de la perte, extrapolation IKORUN
function danielsBreakFactor(days,cross){
  const T=cross?DANIELS_OFF_X:DANIELS_OFF;
  if(days<=T[0][0]) return 1;
  if(days>=T[T.length-1][0]) return T[T.length-1][1];
  for(let i=1;i<T.length;i++) if(days<=T[i][0]){ const [d0,f0]=T[i-1],[d1,f1]=T[i]; return f0+(f1-f0)*(days-d0)/(d1-d0); }
  return 1;
}
// Volume habituel avant la coupure : moyenne des 4 semaines qui la précèdent (historique réel),
// sinon le volume prévu par le plan, sinon le volume déclaré.
function adPreGapWeeklyKm(lastAct){
  const from=adKeyAdd(lastAct,-27);
  const km=(SESS||[]).filter(s=>s.date>=from && s.date<=lastAct).reduce((a,s)=>a+(+s.km||0),0);
  if(km>0) return Math.max(10,km/4);
  const w=PLAN&&PLAN.sessions.find(s=>s.date<=lastAct&&s.date>=from);
  if(w && PLAN.wkKm && PLAN.wkKm[w.week]) return PLAN.wkKm[w.week];
  return P.kmWeek||25;
}
function adRuleGaps(reason){
  if(!PLAN||!PLAN.sessions) return [];
  const st=adState(), k=todayKey();
  const lastAct=adLastActivity(adKeyAdd(k,-1));
  const from=lastAct||PLAN.created;
  if(!from) return [];
  const gap=adDaysBetweenKeys(from,k)-1;
  // une même coupure peut s'aggraver : 5 jours (allègement) puis 10 (reconstruction)
  const lvl=gap>=7?7:3;
  if(gap<3 || (st.gapFrom===from && (st.gapLvl||3)>=lvl)) return [];
  // Il faut que des séances aient été RATÉES (réponse donnée), pas seulement non cochées.
  const missed=PLAN.sessions.filter(s=>s.missed && s.date>from && s.date<k);
  if(missed.length<2) return [];
  st.gapFrom=from; st.gapLvl=lvl;
  const cross=PLAN.sessions.some(s=>s.missed && s.date>from && s.missedReplData && s.missedReplData.dur>0);
  if(gap<7){
    const r=adaptApply('gap3',false,(pl,pc)=>{ let n=0; adWindow(pl,k,7,false).forEach(s=>{ if(s.phaseKey==='TAPER') return; if(adLighten(s,0.8,pc,'gap3')) n++; }); return n; },
      {k:'adMsgGap3',p:[gap]});
    return [r||adaptNote('gap3',{k:'adMsgGap3',p:[gap]})];
  }
  // ≥ 7 jours : VDOT réduite (Daniels) et plan reconstruit de la reprise à la course.
  const v0=getUserVDOT(), f=danielsBreakFactor(gap,cross), v1=clampVdot(v0*f);
  const baseKm=adPreGapWeeklyKm(lastAct||PLAN.created);
  const ramp=gap>28?[0.33,0.5,0.75]:[0.5,0.75];
  const prevPlan=JSON.parse(JSON.stringify(PLAN)), prevAdj=P.vdotAdj?Object.assign({},P.vdotAdj):null;
  const r=planBuild({vdot:v1,ramp,rampEasy:gap>28?2:1,baseKm,keep:PLAN});
  if(r.err || !r.plan){
    // course trop proche : on allège seulement
    const x=adaptApply('gap7',false,(pl,pc)=>{ let n=0; adWindow(pl,k,7,true).forEach(s=>{ if(s.phaseKey==='TAPER'){ if(planIsHard(s)&&adLighten(s,0.85,pc,'gap7')) n++; return; } if(adLighten(s,0.6,pc,'gap7')) n++; }); return n; },
      {k:'adMsgGap7Light',p:[gap]});
    return [x||adaptNote('gap7',{k:'adMsgGap7Light',p:[gap]})];
  }
  const v=validatePlan(r.plan,{since:r.plan.created});
  const vPrev=validatePlan(PLAN,{since:PLAN.created});
  const base=new Set(vPrev.errors), added=v.errors.filter(x=>!base.has(x));
  const msg={k:'adMsgGap7',p:[gap,fmt1(v0),fmt1(v1),Math.round(ramp[0]*100),Math.round(ramp[ramp.length-1]*100)]};
  if(added.length){ adLog({rule:'gap7',safety:false,status:'rejected',why:added.slice(0,3),msg,sessIds:[],before:[],after:[]}); console.warn('[IKORUN] reconstruction refusée',added); return []; }
  P.vdotAdj={v:v1,date:k,why:'break',days:gap};
  st.rebuildAt=k;
  PLAN=r.plan;
  // L'ancien plan est gardé pour pouvoir annuler (clé locale, synchronisée comme le reste).
  if(!window.__ikSim) DB.save('plan_prev',{plan:prevPlan,vdotAdj:prevAdj,ts:adNowTs()});
  else window.__ikSimPrev={plan:prevPlan,vdotAdj:prevAdj};
  return [adLog({rule:'gap7',safety:false,status:'applied',rebuild:true,vdot:[v0,v1],sessIds:[],before:[],after:[],msg,seen:false})];
}

/* f. Charge : ACWR et monotonie, avec hystérésis (réarmement sous un seuil plus bas). */
function adRuleLoad(){
  const st=adState(), k=todayKey(), out=[];
  // Mesuré le matin, sur les jours écoulés (jusqu'à la veille) : une sortie longue faite hier soir
  // ne doit pas, seule, déclencher un allègement.
  const m=loadModel(adKeyAdd(k,-1));
  if(m.acwr==null) return out;
  const a=m.acwr;
  if(a<1.35) st.armRisk=true; if(a<1.2) st.armHigh=true;
  // Tendance confirmée : au-dessus du seuil deux matins de suite.
  st.acwrSeen=st.acwrSeen||{};
  const yday=adKeyAdd(k,-1), prevHigh=st.acwrSeen.d===yday && st.acwrSeen.a>1.3, prevRisk=st.acwrSeen.d===yday && st.acwrSeen.a>1.5;
  if(st.acwrSeen.d!==k) st.acwrSeen={d:k,a};
  // Reprise après une coupure : le volume est déjà dosé (50 %, 75 %…) ; la chronique, elle, a fondu
  // pendant l'arrêt, ce qui gonfle l'ACWR sans surcharge réelle.
  const inRamp=(st.rebuildAt && adDaysBetweenKeys(st.rebuildAt,k)<28) || (PLAN.sessions||[]).some(s=>s.ramp && s.date>=adKeyAdd(k,-7) && s.date<=adKeyAdd(k,7));
  if(inRamp) return out;
  if(a>1.5 && prevRisk && st.armRisk!==false){
    st.armRisk=false; st.armHigh=false;
    let hard=0;
    const r=adaptApply('acwrRisk',true,(pl,pc)=>{ let n=0;
      adWindow(pl,k,7,true).forEach(s=>{
        if(planIsHard(s) && hard<2 && s.phaseKey!=='TAPER'){ adToEasy(s,s.km*0.7,pc,'acwrRisk'); hard++; n++; }
        else if(adLighten(s,0.7,pc,'acwrRisk')) n++;
      }); return n; },{k:'adMsgAcwrRisk',p:[fmtN(a,2)]});
    out.push(r||adaptNote('acwrRisk',{k:'adMsgAcwrRisk',p:[fmtN(a,2)]},{safety:true}));
  } else if(a>1.3 && prevHigh && st.armHigh!==false){
    st.armHigh=false;
    const r=adaptApply('acwrHigh',false,(pl,pc)=>{ let n=0; adWindow(pl,k,3,false).forEach(s=>{ if(adLighten(s,0.85,pc,'acwrHigh')) n++; }); return n; },
      {k:'adMsgAcwrHigh',p:[fmtN(a,2)]});
    if(r) out.push(r);
  }
  // Sous-charge prolongée : +5 % sur les footings, jamais au-delà des +10 % hebdomadaires.
  // Sous-charge seulement chez un athlète qui court (au moins 4 séances en 14 jours) : quelqu'un
  // qui s'est arrêté relève des coupures, jamais d'une hausse de volume.
  const runs14=(SESS||[]).filter(x=>x.date>adKeyAdd(k,-14) && x.date<k && (+x.km||0)>0).length;
  if(a<0.8 && runs14>=4){ if(!st.lowSince) st.lowSince=k; } else if(a>=0.85 || runs14<4) st.lowSince=null;
  if(st.lowSince && adDaysBetweenKeys(st.lowSince,k)>=14 && !adCool('acwrLow',14) && !adBlockActive(k) && !adIllActive(k)){
    adFired('acwrLow');
    const r=adaptApply('acwrLow',false,(pl,pc)=>{ let n=0; adWindow(pl,k,7,false).forEach(s=>{ if((s.baseType==='EF') && s.phaseKey!=='TAPER' && !s.deload){ adKeepKm0(s); s.km=Math.round(s.km*1.05*10)/10; planApplySegs(s,pc); adTag(s,'acwrLow',false); n++; } }); return n; },
      {k:'adMsgAcwrLow',p:[fmtN(a,2)]});
    if(r) out.push(r);
  }
  // Monotonie : on varie la longueur des footings, volume total inchangé.
  if(m.monotony!=null && m.monotony>2 && m.active7>=4 && !adCool('monotony',14)){
    adFired('monotony');
    const r=adaptApply('monotony',false,(pl,pc)=>{
      const ef=adWindow(pl,k,7,false).filter(s=>s.baseType==='EF').sort((x,y)=>y.km-x.km);
      if(ef.length<2) return 0;
      const L=adWindow(pl,k,7,false).filter(planIsLong)[0];
      const big=ef[0], small=ef[ef.length-1], cut=Math.min(Math.round(small.km*0.3*10)/10,Math.max(0,small.km-4));
      if(cut<0.5) return 0;
      const cap=L?L.km-1:Infinity, add=Math.min(cut,Math.max(0,cap-big.km));
      if(add<0.5) return 0;
      adKeepKm0(small); adKeepKm0(big);
      small.km=Math.round((small.km-add)*10)/10; big.km=Math.round((big.km+add)*10)/10;
      planApplySegs(small,pc); planApplySegs(big,pc); adTag(small,'monotony',false); adTag(big,'monotony',false);
      return 2; },{k:'adMsgMonotony',p:[fmtN(m.monotony,1)]});
    if(r) out.push(r);
  }
  return out;
}

/* g. Forme du jour : séance dure prévue aujourd'hui et forme basse → échange ou footing. */
function adRuleReadiness(){
  const k=todayKey(), rd=adaptReadiness(k);
  if(!rd || !PLAN) return [];
  const s=PLAN.sessions.find(x=>x.date===k && adEd(x,k,false));
  if(!s || !planIsHard(s) || adDone(s,'ready') || adDone(s,'readyNote')) return [];
  if(rd.level==='caution'){ s.adjHist=(s.adjHist||[]).concat('readyNote'); return [adaptNote('readyNote',{k:'adMsgReadyCaution',p:[rd.score]})]; }
  if(rd.level!=='low') return [];
  let how='easy';
  const r=adaptApply('ready',false,(pl,pc)=>{
    const x=pl.sessions.find(y=>y.id===s.id);
    const swaps=pl.sessions.filter(y=>y.week===x.week && y.date>k && adEd(y,k,false) && (y.baseType==='EF'||y.baseType==='RECUP'));
    for(const y of swaps){ if(adSwapContent(pl,x,y)){ adTag(x,'ready',true); adTag(y,'ready',false); how='swap'; return 2; } }
    adToEasy(x,Math.min(x.km,6),pc,'ready'); return 1;
  },{k:'adMsgReadyLow',p:[rd.score]});
  if(r){ r.msg={k:how==='swap'?'adMsgReadySwap':'adMsgReadyLow',p:[rd.score]}; return [r]; }
  return [];
}

/* a, b, c. Exécution d'une séance clé. */
function adRecentKey(days){
  const k=todayKey(), from=adKeyAdd(k,-days);
  return (SESSLOG||[]).filter(e=>e.v===2 && e.status!=='missed' && e.date>=from && PLAN_HARD_Q.includes(e.baseType) && e.exec).sort((a,b)=>a.date<b.date?-1:1);
}
function adRuleExec(e){
  const out=[], x=e.exec, k=todayKey(), st=adState();
  if(!x || e.status==='missed') return out;
  const exp=rpeExpOf(e.baseType)||[5,6];
  const fmtP=v=>v>0?spkToStr(v):'—';
  const safetyOn=adBlockActive(k)||adIllActive(k);
  // Séance d'affûtage ou course : on informe, on ne touche jamais au plan.
  const sess=PLAN&&PLAN.sessions.find(s=>s.id===e.planSessionId);
  const taper=!!(sess && sess.phaseKey==='TAPER') || (P.compDate && adDaysBetweenKeys(e.date,P.compDate)<=10);
  const raceSoon=!!(P.compDate && adDaysBetweenKeys(k,P.compDate)<21); // allures figées avant la course
  if(x.verdict==='race') return [adaptNote('race',{k:'adMsgRace',p:[]})];
  if(x.verdict==='fast'){
    const pct=Math.round(x.dev*100);
    // a. une fois : la prochaine séance dure à moins de 48 h est protégée
    let moved=null;
    const r=(!taper && PLAN_HARD_Q.includes(e.baseType))?adaptApply('fastOnce',false,(pl,pc)=>{
      const lim=adKeyAdd(e.date,3);
      const nh=pl.sessions.filter(s=>adEd(s,k,false) && s.date>e.date && s.date<lim && planIsHard(s) && s.phaseKey!=='TAPER' && !adDone(s,'fastOnce')).sort((a,b)=>a.date<b.date?-1:1)[0];
      if(!nh) return 0;
      const next=adKeyAdd(nh.date,1), occ=pl.sessions.find(s=>s.date===next);
      // décalée d'un jour si le lendemain est libre, dans la même semaine, et sans enchaînement dur
      if(!occ && next<(P.compDate||'9999') && adSameWeek(nh.date,next)){ const d0=nh.date; nh.date=next; if(!adClashAround(pl,next)){ adTag(nh,'fastOnce',false); planSortSessions(pl); moved=next; return 1; } nh.date=d0; }
      if(adLighten(nh,0.85,pc,'fastOnce')) return 1;
      return 0; },{k:'adMsgFastOnce',p:[fmtP(x.real),fmtP(x.tgt),pct]}):null;
    if(r){ r.msg={k:moved?'adMsgFastMoved':'adMsgFastOnce',p:[fmtP(x.real),fmtP(x.tgt),pct]}; out.push(r); }
    else out.push(adaptNote('fastInfo',{k:'adMsgFastInfo',p:[fmtP(x.real),fmtP(x.tgt),pct]}));
    // a. répété avec un RPE ≤ attendu : PROPOSITION de VDOT +0,5 / +1 ou d'un test
    const rec=adRecentKey(28).slice(-3);
    const fastLow=rec.filter(y=>y.exec.verdict==='fast' && y.rpe<=((rpeExpOf(y.baseType)||[5,6])[1]));
    if(!safetyOn && !taper && !raceSoon && fastLow.length>=2 && !adCool('vdotProp',21) && !adPendingProposal()){
      adFired('vdotProp');
      const avg=fastLow.reduce((a,y)=>a+y.exec.dev,0)/fastLow.length, step=avg>=0.07?1:0.5;
      out.push(adLog({rule:'vdotUp',safety:false,status:'proposal',step,sessIds:[],before:[],after:[],seen:false,
        msg:{k:'adMsgVdotUp',p:[fastLow.length,fmt1(getUserVDOT()),fmt1(clampVdot(getUserVDOT()+step))]}}));
    }
    return out;
  }
  const slow=(x.verdict==='slow'||x.verdict==='verySlow'), hard=!!x.hard;
  if(slow||hard){
    // b. on cherche d'abord une cause extérieure (chaleur, vent, dénivelé, jeûne, maladie). Une
    // mauvaise nuit isolée explique une séance ; répétée, c'est de la fatigue, pas une excuse.
    // Des jambes lourdes ou une charge élevée ne l'expliquent jamais : ce sont des signaux.
    const causes=adExplains(e);
    if(causes.length){ out.push(adaptNote('slowExplained',{k:'adMsgSlowExplained',p:[{c:causes}]})); return out; }
    if(taper){ out.push(adaptNote('slowTaper',{k:'adMsgSlowTaper',p:[]})); return out; }
    const rec=adRecentKey(21).slice(-3);
    // « trop dur » ne compte que dans la cible : couru trop vite ET dur, c'est l'allure, pas la forme
    const bad=y=>((y.exec.verdict==='slow'||y.exec.verdict==='verySlow'||(y.exec.hard&&y.exec.verdict==='ok')) && !adExplains(y).length);
    if(rec.filter(bad).length>=2 && !adCool('slowTrend',10)){
      adFired('slowTrend');
      const r=adaptApply('slowTrend',false,(pl,pc)=>{ let n=0; adWindow(pl,k,7,false).forEach(s=>{ if(s.phaseKey==='TAPER') return; if(adLighten(s,planIsHard(s)?0.85:0.9,pc,'slowTrend')) n++; }); return n; },
        {k:'adMsgSlowTrend',p:[]});
      if(r) out.push(r);
    } else out.push(adaptNote('slowOnce',{k:hard&&!slow?'adMsgHardOnce':'adMsgSlowOnce',p:[fmtP(x.real),fmtP(x.tgt),e.rpe,exp[0]===exp[1]?exp[0]:exp[0]+'–'+exp[1]]}));
    // On allège d'abord ; la baisse de VDOT n'est proposée que si, une semaine après cet allègement,
    // les séances clés restent trop dures (au moins 2 des 3 dernières) — et jamais sur des signes de
    // fatigue (jambes lourdes, mauvaises nuits) : là, c'est la charge qu'il faut baisser, pas le niveau.
    const lt=st.cd.slowTrend, since=lt?adRecentKey(35).filter(y=>y.date>adKeyAdd(lt,6)).slice(-3):[];
    const tired=since.filter(y=>y.legs===3||y.sleepQ===1).length>=2;
    if(!raceSoon && lt && adDaysBetweenKeys(lt,k)>=7 && since.length>=3 && since.filter(bad).length>=2 && !tired && !adCool('vdotPropDown',28) && !adPendingProposal()){
      const rec6=since;
      adFired('vdotPropDown');
      const devs=rec6.filter(bad).map(y=>y.exec.dev).filter(d=>d!=null);
      const avg=devs.length?devs.reduce((a,b)=>a+b,0)/devs.length:-0.05, step=avg<=-0.08?1:0.5;
      out.push(adLog({rule:'vdotDown',safety:false,status:'proposal',step:-step,sessIds:[],before:[],after:[],seen:false,
        msg:{k:'adMsgVdotDown',p:[fmt1(getUserVDOT()),fmt1(clampVdot(getUserVDOT()-step))]}}));
    }
    return out;
  }
  // c. bien fait
  if(x.short) out.push(adaptNote('short',{k:'adMsgShort',p:[]}));
  else if(PLAN_HARD_Q.includes(e.baseType) && x.tgt) out.push(adaptNote('good',{k:x.rawVerdict!=='ok'&&x.verdict==='ok'&&x.corr>0?'adMsgGoodHeat':'adMsgGood',p:[fmtP(x.real),fmtP(x.tgt)]}));
  else out.push(adaptNote('good',{k:'adMsgGoodEasy',p:[]}));
  return out;
}
const AD_EXTERNAL=['heat','wind','hills','fasting','ill'];
function adExplains(e){
  const c=(e.exec&&e.exec.causes)||[];
  const ext=c.filter(x=>AD_EXTERNAL.includes(x));
  if(ext.length) return ext;
  if(c.includes('sleep')){
    const badNights=(SESSLOG||[]).filter(y=>y.v===2 && y.sleepQ===1 && y.date>=adKeyAdd(e.date,-10) && y.date<=e.date).length;
    if(badNights<=1) return ['sleep'];
  }
  return [];
}
function adPendingProposal(){ return (ADAPT_LOG||[]).find(x=>x.status==='proposal'); }

/* d. Séances ratées (bilan « pas fait »). */
function adRuleMissed(ids,reason){
  const out=[], k=todayKey();
  if(!PLAN) return out;
  ids.forEach(id=>{
    const s=PLAN.sessions.find(x=>x.id===id); if(!s) return;
    if(!(planIsHard(s)||planIsLong(s))){ out.push(adaptNote('missEasy',{k:'adMsgMissEasy',p:[{bt:s.baseType}]})); return; }
    if(s.phaseKey==='TAPER'){ out.push(adaptNote('missTaper',{k:'adMsgMissTaper',p:[{bt:s.baseType}]})); return; }
    if(reason==='Douleur'||reason==='Maladie') return; // la sécurité passe avant le rattrapage
    let to=null;
    const r=adaptApply('missKey',false,(pl,pc)=>{
      const src=pl.sessions.find(x=>x.id===id);
      const cands=pl.sessions.filter(y=>y.week===src.week && y.date>=k && adEd(y,k,false) && (y.baseType==='EF'||y.baseType==='RECUP') && adKeyAdd(y.date,1)!==(P.compDate||''))
        .sort((a,b)=>a.date<b.date?-1:1);
      const F=['type','baseType','title','km','duration','pace','rpe','series','desc','detail','genParams'];
      for(const y of cands){
        const keep={}; F.forEach(f=>{ keep[f]=y[f]; }); keep.adj=y.adj;
        adKeepKm0(y);
        F.forEach(f=>{ y[f]=JSON.parse(JSON.stringify(src[f]===undefined?null:src[f])); });
        if(!adClashAround(pl,y.date)){ planApplySegs(y,pc); adTag(y,'missKey',false); to=y.date; return 1; }
        Object.assign(y,keep); if(!keep.adj) delete y.adj;
      }
      return 0; },{k:'adMsgMissKeyMoved',p:[{bt:s.baseType}]});
    if(r){ r.msg={k:'adMsgMissKeyMoved',p:[{bt:s.baseType},{d:to}]}; out.push(r); }
    else out.push(adaptNote('missKeyDropped',{k:'adMsgMissKeyDropped',p:[{bt:s.baseType}]}));
  });
  // Fatigue déclarée : la prochaine séance dure est allégée (comme avant, désormais tracé).
  if(reason==='Fatigue'){
    const r=adaptApply('missFatigue',false,(pl,pc)=>{ const nh=pl.sessions.filter(s=>adEd(s,k,false) && planIsHard(s) && s.phaseKey!=='TAPER').sort((a,b)=>a.date<b.date?-1:1)[0];
      return nh && adLighten(nh,0.8,pc,'missFatigue')?1:0; },{k:'adMsgMissFatigue',p:[]});
    if(r) out.push(r);
  }
  return out;
}

/* ---------- 7. POINTS D'ENTRÉE ---------- */
function adPersist(){
  if(window.__ikSim) return;
  _lmCache=null;
  try{ DB.save('run_plan',PLAN); DB.save('profile',P); DB.save('adapt_log',ADAPT_LOG); DB.save('checkins',CHECKINS); DB.save('sesslog',SESSLOG); }catch(e){ console.error('[IKORUN] adPersist',e); }
  try{ if(typeof athleteStatusSync==='function') athleteStatusSync(); }catch(e){}
}
// Après un bilan validé (fait ou modifié).
function adaptAfterBilan(e){
  if(!PLAN||!PLAN.sessions) return [];
  _lmCache=null;
  let out=[];
  try{
    out=out.concat(adRulePain(e));
    const safety=out.some(x=>x&&x.safety);
    if(!safety) out=out.concat(adRuleExec(e));
  }catch(err){ console.error('[IKORUN] adaptAfterBilan',err); }
  adPersist();
  return out.filter(Boolean);
}
// Après un bilan « pas fait » (une ou plusieurs séances).
function adaptAfterMissed(ids,reason,extra){
  if(!PLAN||!PLAN.sessions) return [];
  _lmCache=null;
  let out=[];
  try{
    if(reason==='Maladie') out=out.concat(adRuleIll(extra&&extra.since));
    if(reason==='Douleur' && extra && extra.pain && extra.pain.on) out=out.concat(adRulePain({date:todayKey(),pain:extra.pain}));
    out=out.concat(adRuleGaps(reason));
    if(!out.some(x=>x && x.rule==='gap7')) out=out.concat(adRuleMissed(ids,reason));
  }catch(err){ console.error('[IKORUN] adaptAfterMissed',err); }
  adPersist();
  return out.filter(Boolean);
}
// Au lancement et à chaque changement de jour.
function adaptDaily(){
  if(!PLAN||!PLAN.sessions||!P) return [];
  const st=adState(), k=todayKey();
  if(st.dayRun===k && !window.__ikSim) return [];
  st.dayRun=k;
  _lmCache=null;
  let out=[];
  try{
    out=out.concat(adRuleKeepBlocks());
    if(typeof ramadanDaily==='function') out=out.concat(ramadanDaily());
    out=out.concat(adRuleGaps());
    out=out.concat(adRuleLoad());
    out=out.concat(adRuleReadiness());
  }catch(err){ console.error('[IKORUN] adaptDaily',err); }
  adPersist();
  return out.filter(Boolean);
}
// Après le check du matin.
function adaptAfterCheckin(){
  let out=[];
  try{ out=adRuleReadiness(); }catch(err){ console.error('[IKORUN] adaptAfterCheckin',err); }
  adPersist();
  return out.filter(Boolean);
}

/* ---------- 8. ANNULER, ACCEPTER, LEVER UN BLOCAGE ---------- */
function adEntry(id){ return (ADAPT_LOG||[]).find(x=>x.id===id); }
// Remet les séances « avant » d'un ajustement, si elles ne sont pas déjà faites ou passées.
function adRestore(entry,minDate){
  const k=minDate||todayKey(), pl=JSON.parse(JSON.stringify(PLAN));
  const blocked=entry.after.filter(a=>{ const s=pl.sessions.find(x=>x.id===a.id); return s && (s.done || s.missed || s.date<k); });
  let n=0;
  entry.before.forEach(b=>{
    const s=pl.sessions.find(x=>x.id===b.id); if(!s || s.done || s.missed || s.date<k || b.date<k) return;
    Object.keys(b).forEach(f=>{ s[f]=JSON.parse(JSON.stringify(b[f])); });
    ['adj','adjHist','ramp'].forEach(f=>{ if(!(f in b)) delete s[f]; });
    s.detail=null; n++;
  });
  if(!n) return {ok:false,why:'adUndoNothing'};
  // une date restaurée peut en croiser une autre : jamais deux séances le même jour
  const seen={}; for(const s of pl.sessions){ if(seen[s.date]) return {ok:false,why:'adUndoConflict'}; seen[s.date]=1; }
  planSortSessions(pl);
  const v0=validatePlan(PLAN,{since:PLAN.created}), v1=validatePlan(pl,{since:pl.created});
  const base=new Set(v0.errors), added=v1.errors.filter(x=>!base.has(x));
  if(added.length) return {ok:false,why:'adUndoUnsafe'};
  return {ok:true,plan:pl,partial:blocked.length>0};
}
function adaptUndo(id,opts){
  const e=adEntry(id); if(!e || e.status!=='applied') return {ok:false,why:'adUndoNothing'};
  if(e.safety && !(opts&&opts.safetyOk)) return {ok:false,why:'adUndoSafety'};
  if(e.rebuild){
    const prev=window.__ikSim?window.__ikSimPrev:DB.load('plan_prev');
    if(!prev||!prev.plan) return {ok:false,why:'adUndoNothing'};
    PLAN=prev.plan; P.vdotAdj=prev.vdotAdj||null;
    if(!window.__ikSim) DB.remove('plan_prev');
  } else if(e.rule==='vdotUp'||e.rule==='vdotDown'){
    const r=adRestore(e); if(!r.ok) return r;
    PLAN=r.plan; PLAN.vdot=e.vdot[0]; P.vdotAdj=e.prevAdj||null;
  } else {
    const r=adRestore(e); if(!r.ok) return r;
    PLAN=r.plan;
  }
  e.status='undone'; e.ut=adNowTs();
  adFired(e.rule); // hystérésis : la même règle ne revient pas aussitôt
  adPersist();
  return {ok:true};
}
// Proposition de VDOT acceptée : nouvelles allures pour toutes les séances à venir.
function adaptAcceptVdot(id){
  const e=adEntry(id); if(!e || e.status!=='proposal') return {ok:false};
  ikTrack('adapt_vdot',{step:e.step||0});
  const v0=getUserVDOT(), v1=clampVdot(v0+(e.step||0));
  const prevAdj=P.vdotAdj?Object.assign({},P.vdotAdj):null;
  const r=adaptApply(e.rule,false,(pl,pc0,k)=>{
    pl.vdot=v1; const pc=planPaces(v1); let n=0;
    pl.sessions.forEach(s=>{ if(!s.done && !s.missed && s.date>=k && s.km>0 && s.baseType!=='Repos'){ planApplySegs(s,pc); s.detail=null; n++; } });
    return n; },e.msg,{vdot:[v0,v1],prevAdj});
  if(!r){ return {ok:false}; }
  P.vdotAdj={v:v1,date:todayKey(),why:e.rule};
  e.status='accepted'; e.ut=adNowTs(); e.seen=true;
  r.msg={k:e.step>0?'adMsgVdotUpDone':'adMsgVdotDownDone',p:[fmt1(v0),fmt1(v1)]};
  adPersist();
  return {ok:true,entry:r};
}
function adaptDecline(id){ const e=adEntry(id); if(!e) return; e.status='declined'; e.ut=adNowTs(); e.seen=true; adPersist(); }
// « Je n'ai plus mal » / « Je vais mieux » : on lève le blocage, l'intensité revient d'abord allégée.
function adaptClearSafety(kind){
  const st=adState(), k=todayKey();
  if(kind==='pain'){ st.block=null; st.painClearedAt=k; st.pains=[]; }
  if(kind==='ill'){ st.ill=null; }
  const recent=(ADAPT_LOG||[]).filter(e=>e.status==='applied' && e.safety && (kind==='pain'?/^(pain|painRepeat|blockKeep)$/.test(e.rule):/^(ill|illKeep)$/.test(e.rule)));
  let restored=0;
  recent.slice().reverse().forEach(e=>{
    const r=adRestore(e,adKeyAdd(k,1)); // jamais aujourd'hui : reprise progressive
    if(r.ok){ PLAN=r.plan; e.status='undone'; e.ut=adNowTs(); restored++; }
  });
  // première séance dure retrouvée : un cran plus courte
  if(restored){
    adaptApply('safetyBack',false,(pl,pc)=>{ const s=pl.sessions.filter(x=>adEd(x,k,true) && planIsHard(x)).sort((a,b)=>a.date<b.date?-1:1)[0]; return s && adLighten(s,0.85,pc,'safetyBack')?1:0; },
      {k:'adMsgSafetyBack',p:[]});
  }
  adPersist();
  return restored;
}

/* ---------- 9. TEXTES (rendus dans la langue du moment) ---------- */
function adParam(p){
  if(p==null) return '';
  if(typeof p!=='object') return p;
  if(p.d) return fmtDate(p.d);
  if(p.bt) return t('sessLabel_'+p.bt)||p.bt;
  if(p.z) return adZoneName(p.z);
  if(p.c) return p.c.map(c=>t('adCause_'+c)).join(', ');
  return '';
}
// « Genou droit », « Cheville droite » : nom de zone et côté accordés dans chaque langue.
function adZoneName(zid){ const [z,side]=String(zid||'other').split('_'); const k='adZone_'+z+(side?'_'+side:''); const v=t(k); return v!==k?v:t('adZone_'+z); }
// Une date abrégée (« 15 oct. ») en fin de phrase donnait « oct.. » : un seul point.
function adMsg(m){ if(!m||!m.k) return ''; return tp(m.k,...(m.p||[]).map(adParam)).replace(/([^.])\.\.(?!\.)/g,'$1.'); }
