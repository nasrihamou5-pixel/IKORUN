/* ============================================================================
   IKORUN — BILAN DE SÉANCE (V3.15.0, refonte)
   ----------------------------------------------------------------------------
   Écran 1, le cas simple en 3 gestes et moins de 10 s : « Comme prévu » → effort (RPE) →
   Valider. Les valeurs prévues sont déjà là ; les molettes n'apparaissent qu'en choisissant
   « Modifié ». « Pas fait » pose UNE question : la raison.
   Écran 2, facultatif (« Ajouter des détails ») : temps de chaque répétition (ou « toutes à
   X »), FC moyenne et max, jambes, sommeil, humeur, note, douleur (silhouette, intensité,
   foulée changée).
   Le bilan (version 2, voir docs/DESIGN_P2.md) part dans SESSLOG ; les anciens champs
   (fatigue, feel, sleep sur 5, pain en texte) restent remplis pour les écrans qui les lisent.
   Puis le moteur d'adaptation (plan/adapt.js) juge la séance et ajuste le plan si besoin.
   Les noms debriefCtx / debriefData / debriefReps / debriefWheel sont gardés : la suite de
   fumée et les molettes (setWheelVal) les utilisent.
   ============================================================================ */
let debriefData=null, debriefCtx=null, debriefReps=[], debriefRepSel=0, debriefStep=1;
const BL_REASONS=['Fatigue','Douleur','Maladie','Manque de temps','Météo','Autre'];
const BL_REASON_ICONS={'Fatigue':'moon','Douleur':'warning','Maladie':'health','Manque de temps':'timer','Météo':'rain','Autre':'edit'};
const RPE_LAB=[null,'rpeL1','rpeL1','rpeL3','rpeL3','rpeL5','rpeL5','rpeL7','rpeL7','rpeL9','rpeL10'];
const RPE_FACE=[null,'😌','😌','🙂','🙂','😐','😤','😣','😫','🥵','🤯'];
const MOOD_FACE=['😞','😕','😐','🙂','😄'];
function fmtDurMin(min){ min=Math.round(+min||0); const h=Math.floor(min/60); return h?h+' h '+String(min%60).padStart(2,'0'):min+' min'; }
function blPlanSess(){ return (debriefCtx && debriefCtx.planSessionId && PLAN && PLAN.sessions)?PLAN.sessions.find(s=>s.id===debriefCtx.planSessionId)||null:null; }
function blBaseType(){ const s=blPlanSess(); return (s&&s.baseType)||(debriefCtx&&debriefCtx.baseType)||adBaseTypeOfSess({type:debriefCtx&&debriefCtx.type})||null; }
// ctx : {date, title, km, pace, type, duration, plannedRpe, planSessionId, sessRef, series, perso:{pid,sid}}
function openSessionDebrief(ctx,mode){
  debriefCtx=ctx; debriefRepSel=0; debriefStep=1;
  const bt=blBaseType(), exp=rpeExpOf(bt);
  const rpe0=Math.round(exp?(exp[0]+exp[1])/2:(+ctx.plannedRpe||5));
  debriefData={ status:mode||'done', duration:+ctx.duration||0, distance:+ctx.km||0, pace:ctx.pace||'', deniv:ctx.deniv||'',
    rpe:Math.max(1,Math.min(10,rpe0)), rpeTouched:false, hrAvg:'', hrMax:'', legs:0, sleepQ:0, mood:0, note:'',
    pain:{on:false,zone:null,side:null,level:3,gait:false}, reason:null, illSince:0, repl:null, replData:null, ids:ctx.ids||null };
  const sr=ctx.series;
  debriefReps=(sr&&sr.reps&&sr.dist&&sr.paceSecPerKm)?Array.from({length:sr.reps},(_,i)=>{
    const target=Math.round(splitSecFromPace(sr.paceSecPerKm,sr.dist));
    return { n:i+1, dist:sr.dist, target, timeS:target, respected:true };
  }):[];
  if(debriefReps.length) syncDebriefFromReps(); else debriefAutoPace();
  openOv('ovProg'); $('#ovProgTitle').textContent=t(mode==='missed'?'missedSessionTitle':'debriefTitle');
  renderDebrief();
}
function debriefRepOk(r){ return r.timeS<=Math.round(r.target*1.06); }
function syncDebriefFromReps(){
  if(!debriefReps.length) return;
  const totKm=debriefReps.reduce((a,r)=>a+r.dist,0)/1000;
  const totSec=debriefReps.reduce((a,r)=>a+r.timeS,0);
  debriefReps.forEach(r=>{ r.respected=debriefRepOk(r); });
  debriefData.distance=+totKm.toFixed(2);
  debriefData.duration=Math.max(1,Math.round(totSec/60));
  debriefData.pace=fmtSplit(Math.round(totSec/totKm));
}
function debriefAutoPace(){
  const d=debriefData; if(!d) return;
  const dur=+d.duration, km=+d.distance;
  d.pace=(dur>0 && km>0)?fmtSplit(Math.round(dur*60/km)):'';
}
// Allure réelle comparée à l'allure prévue (le moteur fait le vrai calcul, corrigé de la chaleur).
function debriefAdherence(){
  const spk=v=>{ const m=/^(\d+):(\d{2})/.exec(String(v||'')); return m?(+m[1])*60+(+m[2]):0; };
  const real=spk(debriefData.pace), plan=spk(debriefCtx&&debriefCtx.pace);
  if(!real || !plan || debriefReps.length) return null;
  const k=real/plan;
  return k<.97?'faster':k<=1.04?'asPlanned':k<=1.12?'slower':'muchSlower';
}
function dbRepChips(){
  return debriefReps.map((r,i)=>'<button type="button" class="db-rep'+(i===debriefRepSel?' on':'')+(r.respected?' ok':' slow')+'" onclick="debriefPickRep('+i+')"><b>'+r.n+'</b><span>'+fmtSplit(r.timeS)+'</span></button>').join('');
}
function dbRepWheels(){
  const r=debriefReps[debriefRepSel], mmax=Math.max(9,Math.ceil(r.target/60)*2);
  return '<div class="db-wlab">'+tp('dbRepOf',r.n,debriefReps.length,r.dist)+' · '+tp('targetColon',fmtSplit(r.target))+'</div>'+
    '<div class="db-repnav"><button type="button" class="db-arrow" aria-label="'+t('dbPrev')+'" onclick="debriefPickRep(debriefRepSel-1)"'+(debriefRepSel?'':' disabled')+'>'+ICN('chevronR',18).replace('<path','<path transform="rotate(180 12 12)"')+'</button>'+
    '<div class="wheels">'+wheel('DB.rep.m',0,mmax,Math.min(mmax,Math.floor(r.timeS/60)),1)+'<span class="wheel-sep">:</span>'+wheel('DB.rep.s',0,59,r.timeS%60)+'</div>'+
    '<button type="button" class="db-arrow" aria-label="'+t('dbNext')+'" onclick="debriefPickRep(debriefRepSel+1)"'+(debriefRepSel<debriefReps.length-1?'':' disabled')+'>'+ICN('chevronR',18)+'</button></div>'+
    (debriefReps.length>1?'<button type="button" class="bl-all" onclick="debriefAllReps()">'+tp('blAllRepsAt',fmtSplit(r.timeS))+'</button>':'');
}
function debriefAllReps(){ const v=debriefReps[debriefRepSel].timeS; debriefReps.forEach(r=>{ r.timeS=v; }); syncDebriefFromReps(); debriefData.status=debriefData.status==='missed'?'missed':'modified'; renderDebrief(); haptic(); }
function dbSummary(){
  const d=debriefData, reps=debriefReps.length;
  const tile=(v,l)=>'<div class="db-tile"><b>'+v+'</b><span>'+l+'</span></div>';
  let h=tile(fmt1(d.distance||0)+' <small>km</small>',reps?t('dbTileWork'):t('dbDistLab'))+
    tile(fmtDurMin(d.duration),reps?t('dbTileWorkTime'):t('dbDurLab'))+
    tile(escHtml(d.pace||'—')+' <small>/km</small>',t('dbTilePace'));
  if(reps){ const ok=debriefReps.filter(r=>r.respected).length;
    h+='<div class="db-okchip'+(ok===reps?' all':'')+'">'+ICN(ok===reps?'check':'timer',13)+' '+tp('respectedCount',ok,reps)+'</div>'; }
  return h;
}
function debriefRefresh(){
  const s=document.getElementById('dbSum'); if(s) s.innerHTML=dbSummary();
  const c=document.getElementById('dbRepChips'); if(c) c.innerHTML=dbRepChips();
}
function debriefPickRep(i){
  debriefRepSel=Math.max(0,Math.min(debriefReps.length-1,i));
  const w=document.getElementById('dbRepW'); if(w){ w.innerHTML=dbRepWheels(); setTimeout(attachWheels,30); }
  debriefRefresh();
  const on=document.querySelector('#dbRepChips .db-rep.on'); if(on) on.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});
}
function debriefWheel(key,val){
  const d=debriefData; if(!d) return;
  if(key==='DB.rep.m'||key==='DB.rep.s'){
    const r=debriefReps[debriefRepSel]; if(!r) return;
    r.timeS=key==='DB.rep.m'?val*60+r.timeS%60:Math.floor(r.timeS/60)*60+val;
    syncDebriefFromReps();
  } else if(key==='DB.km.i'||key==='DB.km.d'){
    const i=Math.floor(+d.distance||0), dec=Math.round(((+d.distance||0)-i)*10);
    d.distance=key==='DB.km.i'?val+dec/10:i+val/10; debriefAutoPace();
  } else if(key==='DB.dur.h'||key==='DB.dur.m'){
    const dur=+d.duration||0;
    d.duration=key==='DB.dur.h'?val*60+dur%60:Math.floor(dur/60)*60+val; debriefAutoPace();
  }
  debriefRefresh();
}
// Effort ressenti : curseur 1–10, visage et libellé (échelle CR-10).
function dbRpeHTML(v){
  const exp=rpeExpOf(blBaseType());
  return '<div class="bl-rpe" style="--h:'+Math.round(140-v*13)+'"><div class="bl-rpe-top"><span class="bl-rpe-face" aria-hidden="true">'+RPE_FACE[v]+'</span><b>'+v+'<small>/10</small></b><span class="bl-rpe-lab" id="dbRpeLab">'+t(RPE_LAB[v])+'</span></div>'+
    '<input type="range" class="bl-range" min="1" max="10" step="1" value="'+v+'" aria-label="'+t('dbEffortLab')+'" aria-valuetext="'+v+' — '+escHtml(t(RPE_LAB[v]))+'" oninput="debriefSetRpe(+this.value,1)">'+
    '<div class="bl-rpe-ends"><span>'+t('rpeL1')+'</span>'+(exp?'<span class="bl-rpe-exp">'+tp('blRpeExpected',exp[0]===exp[1]?exp[0]:exp[0]+'–'+exp[1])+'</span>':'')+'<span>'+t('rpeL10')+'</span></div></div>';
}
function debriefSetRpe(n,live){
  debriefData.rpe=n; debriefData.rpeTouched=true;
  const w=document.getElementById('dbRpeW');
  if(w){ if(live){ const box=w.querySelector('.bl-rpe'); if(box){ box.style.setProperty('--h',Math.round(140-n*13)); box.querySelector('.bl-rpe-face').textContent=RPE_FACE[n]; box.querySelector('b').innerHTML=n+'<small>/10</small>'; box.querySelector('#dbRpeLab').textContent=t(RPE_LAB[n]); const r=box.querySelector('input'); if(r) r.setAttribute('aria-valuetext',n+' — '+t(RPE_LAB[n])); } }
    else w.innerHTML=dbRpeHTML(n); }
  haptic();
}
function blSetStatus(s){ debriefData.status=s; if(s==='done'){ blResetToPlan(); } renderDebrief(); haptic(); }
function blResetToPlan(){
  const c=debriefCtx; debriefData.distance=+c.km||0; debriefData.duration=+c.duration||0; debriefData.pace=c.pace||'';
  debriefReps.forEach(r=>{ r.timeS=r.target; }); if(debriefReps.length) syncDebriefFromReps(); else debriefAutoPace();
}
function blSeg(name,cur,opts){ return '<div class="seg-ctrl sub bl-seg" role="radiogroup">'+opts.map(([v,l])=>'<div class="seg-btn'+(cur===v?' on':'')+'" role="radio" aria-checked="'+(cur===v)+'" tabindex="0" onclick="blSet(\''+name+'\','+v+')">'+l+'</div>').join('')+'</div>'; }
function blSet(name,v){ debriefData[name]=v; renderDebrief(); haptic(); }
/* ---- écran 1 ---- */
function renderDebrief(){
  const d=debriefData, c=debriefCtx; if(!d||!c) return;
  if(debriefStep===2) return renderDebriefDetails();
  const ps=blPlanSess(), sc=document.getElementById('progBody');
  let h='<div class="bl-head"><b>'+escHtml(ps?planSessTitle(ps):(c.title||''))+'</b><span>'+(d.ids&&d.ids.length>1?tp('blMissedMany',d.ids.length,fmtDate(c.date)):fmtDate(c.date))+'</span></div>';
  if(!(d.ids&&d.ids.length>1)){
    h+='<div class="bl-q">'+t('blHowWent')+'</div><div class="bl-status" role="radiogroup">'+
      [['done','check','blAsPlanned'],['modified','edit','blModified'],['missed','close','blNotDone']].map(([k,ic,lab])=>
        '<button type="button" class="bl-st bl-st-'+k+(d.status===k?' on':'')+'" role="radio" aria-checked="'+(d.status===k)+'" onclick="blSetStatus(\''+k+'\')">'+ICN(ic,20)+'<span>'+t(lab)+'</span></button>').join('')+'</div>';
  }
  if(d.status==='missed'){ h+=blMissedHTML(); }
  else {
    h+='<div class="db-sec">'+t('dbEffortLab')+'</div><div id="dbRpeW">'+dbRpeHTML(d.rpe)+'</div>';
    h+='<div class="db-sum" id="dbSum">'+dbSummary()+'</div>';
    if(d.status==='modified'){
      if(debriefReps.length){
        h+='<div class="db-card"><div class="db-card-h">'+ICN('timer',15)+' '+tp('repByRepSummary',debriefReps.length,debriefReps[0].dist)+'</div>'+
          '<div class="db-reps" id="dbRepChips">'+dbRepChips()+'</div><div id="dbRepW">'+dbRepWheels()+'</div></div>';
      } else {
        const km=+d.distance||0, ki=Math.min(99,Math.floor(km)), kd=Math.round((km-Math.floor(km))*10)%10, dur=Math.round(+d.duration||0);
        h+='<div class="db-card"><div class="db-two">'+
          '<div><div class="db-wlab">'+t('dbDistLab')+'</div><div class="wheels">'+wheel('DB.km.i',0,99,ki,1)+'<span class="wheel-sep">,</span>'+wheel('DB.km.d',0,9,kd,1)+'<span class="wheel-sep u">km</span></div></div>'+
          '<div><div class="db-wlab">'+t('dbDurLab')+'</div><div class="wheels">'+wheel('DB.dur.h',0,9,Math.min(9,Math.floor(dur/60)),1)+'<span class="wheel-sep u">h</span>'+wheel('DB.dur.m',0,59,dur%60)+'<span class="wheel-sep u">min</span></div></div>'+
          '</div></div>';
      }
    }
    const det=blDetailsCount();
    h+='<button type="button" class="db-more" onclick="debriefStep=2;renderDebrief()">'+ICN('plus',15)+' '+t('blAddDetails')+(det?' · '+tp('blDetailsN',det):'')+'</button>';
  }
  h+='<div class="ik-cta-bar"><button class="btn" id="blSubmit" onclick="submitDebrief()"'+(d.status==='missed'&&!d.reason?' disabled':'')+'>'+ICN('check',18)+' '+t('validate')+'</button></div>';
  $('#progBody').innerHTML=h;
  if(sc && sc.closest) { const s=sc.closest('.ov-body-scroll'); if(s && debriefStep===1 && !renderDebrief._keep) s.scrollTop=0; }
  setTimeout(attachWheels,30);
}
function blDetailsCount(){ const d=debriefData; return [d.hrAvg,d.hrMax,d.legs,d.sleepQ,d.mood,d.note,d.pain.on,d.deniv].filter(Boolean).length; }
function blMissedHTML(){
  const d=debriefData;
  let h='<div class="bl-q">'+t('missedReasonPrompt')+'</div><div class="bl-reasons">'+BL_REASONS.map(r=>
    '<button type="button" class="bl-reason'+(d.reason===r?' on':'')+'" aria-pressed="'+(d.reason===r)+'" onclick="blSet(\'reason\',\''+r.replace(/'/g,"\\'")+'\')">'+ICN(BL_REASON_ICONS[r],18)+'<span>'+trReason(r)+'</span></button>').join('')+'</div>';
  if(d.reason==='Douleur'){ d.pain.on=true; h+='<div class="db-card bl-pain-card">'+blPainHTML(true)+'</div>'; }
  if(d.reason==='Maladie'){
    h+='<div class="db-sec">'+t('blIllSince')+'</div>'+blSeg('illSince',d.illSince,[[0,t('blIllToday')],[2,t('blIll2')],[4,t('blIll4')]])+
      '<div class="bl-note">'+ICN('health',14)+'<span>'+t('blIllAdvice')+'</span></div>';
  }
  if(d.reason){
    h+='<button type="button" class="db-more" onclick="blOpenReplacement()">'+ICN('plus',15)+' '+(d.repl?tp('blDidInstead',trActivity(d.repl)):t('blDidOther'))+'</button>';
  }
  return h;
}
// « J'ai fait autre chose à la place » : les formulaires de remplacement existants (app.js).
function blOpenReplacement(){
  missedCtx={sessionId:(debriefCtx&&debriefCtx.planSessionId)||null,reason:debriefData.reason,replacement:null,replData:null,muscuCat:null,fromBilan:true};
  renderMissedReplacement();
}
/* ---- douleur : silhouette à zones ---- */
// Zones cliquables, vue de face (F) et de dos (B). Côté de l'athlète : sur la vue de face, sa droite est à gauche.
const BL_BODY=[
  ['F','hip',41,116,'R'],['F','hip',59,116,'L'],['F','thighF',42,142,'R'],['F','thighF',58,142,'L'],['F','knee',42,170,'R'],['F','knee',58,170,'L'],
  ['F','shin',42,198,'R'],['F','shin',58,198,'L'],['F','ankle',42,228,'R'],['F','ankle',58,228,'L'],['F','foot',40,249,'R'],['F','foot',60,249,'L'],
  ['B','lowBack',50,86,null],['B','thighB',42,144,'L'],['B','thighB',58,144,'R'],['B','calf',42,194,'L'],['B','calf',58,194,'R'],
  ['B','achilles',42,228,'L'],['B','achilles',58,228,'R']];
// Silhouette neutre faite de formes pleines (sans trait intérieur), jambes séparées : chaque zone
// tombe sur la partie du corps qu'elle désigne.
const BL_SIL='<circle cx="50" cy="19" r="11"/><rect x="45" y="28" width="10" height="9" rx="3"/><rect x="33" y="35" width="34" height="62" rx="13"/>'+
  '<rect x="22" y="38" width="10" height="52" rx="5" transform="rotate(8 27 38)"/><rect x="68" y="38" width="10" height="52" rx="5" transform="rotate(-8 73 38)"/>'+
  '<rect x="35" y="88" width="30" height="30" rx="11"/><rect x="36" y="108" width="12" height="66" rx="6"/><rect x="52" y="108" width="12" height="66" rx="6"/>'+
  '<rect x="37" y="166" width="10" height="66" rx="5"/><rect x="53" y="166" width="10" height="66" rx="5"/><ellipse cx="40" cy="248" rx="8" ry="5"/><ellipse cx="60" cy="248" rx="8" ry="5"/>';
function blBodySVG(view){
  const p=debriefData.pain;
  let h='<svg class="bl-body" viewBox="0 0 100 260" role="group" aria-label="'+t(view==='F'?'blFront':'blBack')+'"><g class="bl-sil">'+BL_SIL+'</g>';
  BL_BODY.filter(z=>z[0]===view).forEach(([v,z,x,y,side])=>{
    const on=p.zone===z && (p.side||null)===side;
    h+='<circle class="bl-z'+(on?' on':'')+'" cx="'+x+'" cy="'+y+'" r="'+(z==='lowBack'?10:7)+'" role="button" tabindex="0" aria-pressed="'+on+'" aria-label="'+escHtml(adZoneName(z+(side?'_'+side:'')))+'" onclick="blPainZone(\''+z+'\','+(side?'\''+side+'\'':'null')+')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.onclick();}"></circle>';
  });
  return h+'</svg>';
}
function blPainZone(z,side){ const p=debriefData.pain; p.on=true; p.zone=z; p.side=side; renderDebrief(); haptic(); }
function blPainHTML(forced){
  const p=debriefData.pain;
  let h='';
  if(!forced) h+='<div class="db-sec">'+t('painLabel')+'</div>'+blSegPain();
  if(!p.on) return h;
  h+='<div class="bl-body-wrap"><div><span>'+t('blFront')+'</span>'+blBodySVG('F')+'</div><div><span>'+t('blBack')+'</span>'+blBodySVG('B')+'</div></div>'+
    '<div class="bl-zone-row"><b>'+(p.zone?escHtml(adZoneName(p.zone+(p.side?'_'+p.side:''))):t('blPickZone'))+'</b>'+
    '<button type="button" class="chip-btn'+(p.zone==='other'?' on':'')+'" onclick="blPainZone(\'other\',null)">'+t('adZone_other')+'</button></div>'+
    '<div class="db-wlab">'+tp('blPainLevel',p.level)+'</div><input type="range" class="bl-range pain" min="0" max="10" step="1" value="'+p.level+'" aria-label="'+t('blPainLevelLab')+'" oninput="debriefData.pain.level=+this.value;this.previousElementSibling.textContent=tp(\'blPainLevel\',this.value)">'+
    '<div class="ap-opt bl-gait"><div><b>'+t('blGait')+'</b><span>'+t('blGaitSub')+'</span></div><div class="toggle'+(p.gait?' on':'')+'" role="switch" aria-checked="'+!!p.gait+'" aria-label="'+t('blGait')+'" onclick="debriefData.pain.gait=!debriefData.pain.gait;renderDebrief()"></div></div>';
  return h;
}
function blSegPain(){ const p=debriefData.pain; return '<div class="seg-ctrl sub bl-seg" role="radiogroup"><div class="seg-btn'+(!p.on?' on':'')+'" role="radio" aria-checked="'+!p.on+'" onclick="debriefData.pain.on=false;renderDebrief()">'+t('blNo')+'</div><div class="seg-btn'+(p.on?' on':'')+'" role="radio" aria-checked="'+p.on+'" onclick="debriefData.pain.on=true;renderDebrief()">'+t('blYes')+'</div></div>'; }
/* ---- écran 2 ---- */
function renderDebriefDetails(){
  const d=debriefData;
  let h='<button type="button" class="cm-back" onclick="debriefStep=1;renderDebrief()">'+ICN('chevronR',16).replace('<path','<path transform="rotate(180 12 12)"')+' '+t('backLab')+'</button>';
  if(debriefReps.length){
    h+='<div class="db-sec">'+tp('repByRepSummary',debriefReps.length,debriefReps[0].dist)+'</div><div class="db-card"><div class="db-reps" id="dbRepChips">'+dbRepChips()+'</div><div id="dbRepW">'+dbRepWheels()+'</div></div>';
    h+='<div class="db-sum" id="dbSum">'+dbSummary()+'</div>';
  }
  h+='<div class="db-sec">'+t('blHr')+'</div><div class="bl-hr"><label><span>'+t('blHrAvg')+'</span><input class="inp" type="number" inputmode="numeric" min="60" max="230" value="'+(d.hrAvg||'')+'" placeholder="—" oninput="debriefData.hrAvg=+this.value||\'\'"></label>'+
    '<label><span>'+t('blHrMax')+'</span><input class="inp" type="number" inputmode="numeric" min="60" max="240" value="'+(d.hrMax||'')+'" placeholder="—" oninput="debriefData.hrMax=+this.value||\'\'"></label></div>';
  h+='<div class="db-sec">'+t('blLegs')+'</div>'+blSeg('legs',d.legs,[[1,t('blLegsFresh')],[2,t('blLegsNormal')],[3,t('blLegsHeavy')]]);
  h+='<div class="db-sec">'+t('blSleep')+'</div>'+blSeg('sleepQ',d.sleepQ,[[1,t('blSleepBad')],[2,t('blSleepMid')],[3,t('blSleepGood')]]);
  h+='<div class="db-sec">'+t('blMood')+'</div><div class="bl-moods" role="radiogroup">'+MOOD_FACE.map((f,i)=>'<button type="button" class="bl-mood'+(d.mood===i+1?' on':'')+'" role="radio" aria-checked="'+(d.mood===i+1)+'" aria-label="'+t('blMood'+(i+1))+'" onclick="blSet(\'mood\','+(i+1)+')">'+f+'</button>').join('')+'</div>';
  h+=blPainHTML(false);
  h+='<div class="db-sec">'+t('elevationGainLabel')+'</div><input class="inp" type="number" inputmode="numeric" value="'+(d.deniv||'')+'" oninput="debriefData.deniv=+this.value" placeholder="0">';
  h+='<div class="db-sec">'+t('freeCommentLabel')+'</div><textarea class="inp" rows="2" maxlength="500" oninput="debriefData.note=this.value" placeholder="'+t('howDidYouFeelPlaceholder')+'">'+escHtml(d.note||'')+'</textarea>';
  h+='<div class="ik-cta-bar"><button class="btn" onclick="submitDebrief()">'+ICN('check',18)+' '+t('validate')+'</button></div>';
  $('#progBody').innerHTML=h;
  setTimeout(attachWheels,30);
}
/* ---- validation ---- */
function blLegacyPain(p){ if(!p||!p.on) return 'Aucune'; const l=+p.level||0; return l>=7?'Importantes':l>=4?'Gênantes':'Légères'; }
function blWeather(date){ try{ return (typeof wxForBilan==='function')?wxForBilan(date):null; }catch(e){ return null; } }
function blFasting(date){ try{ return (typeof ramadanFastingOn==='function')?!!ramadanFastingOn(date):false; }catch(e){ return false; } }
// Enregistre un bilan fait / modifié : SESSLOG (version 2) et l'historique réel SESS. Partagé par
// l'écran de bilan et simulateAthlete() (plan/simulate.js), pour que la simulation passe par le même code.
function blRecord(c,d,reps0,bt){
  const exp=rpeExpOf(bt);
  const reps=reps0&&reps0.length?reps0.map(r=>({n:r.n,dist:r.dist,target:r.target,timeS:r.timeS,respected:r.respected})):null;
  const e={
    id:'b'+adNowTs().toString(36)+Math.random().toString(36).slice(2,6), v:2, ut:adNowTs(), ts:adNowTs(),
    date:c.date, title:c.title, type:c.type, baseType:bt, planSessionId:c.planSessionId||null, sessRef:c.sessRef||null,
    status:d.status, rpe:+d.rpe||5, rpeExp:exp||null, plannedRpe:c.plannedRpe||null,
    planned:{km:+c.km||0,dur:+c.duration||0,paceS:parseTime(c.pace)||null},
    real:{km:+d.distance||0,dur:+d.duration||0,paceS:parseTime(d.pace)||null},
    reps, hr:(d.hrAvg||d.hrMax)?{avg:+d.hrAvg||null,max:+d.hrMax||null}:null,
    legs:d.legs||null, sleepQ:d.sleepQ||null, mood:d.mood||null, note:String(d.note||'').slice(0,500),
    pain:d.pain&&d.pain.on?{on:true,zone:d.pain.zone||'other',side:d.pain.side||null,level:+d.pain.level||0,gait:!!d.pain.gait}:{on:false},
    deniv:+d.deniv||0, wx:d.wx!==undefined?d.wx:blWeather(c.date), fast:d.fast!==undefined?!!d.fast:blFasting(c.date),
    // anciens champs, lus par Santé, Stats et l'ancienne analyse
    done:true, duration:+d.duration||0, distance:+d.distance||0, pace:d.pace||'—', repsLog:reps,
    fatigue:d.legs?({1:2,2:3,3:4})[d.legs]:3, feel:d.mood||3, sleep:d.sleepQ?({1:2,2:3,3:4})[d.sleepQ]:3, nutrition:3,
    paceAdherence:(!reps&&parseTime(d.pace)&&parseTime(c.pace))?(()=>{ const k=parseTime(d.pace)/parseTime(c.pace); return k<.97?'faster':k<=1.04?'asPlanned':k<=1.12?'slower':'muchSlower'; })():null
  };
  e.pain.txt=blLegacyPain(e.pain);
  e.load=Math.round(e.real.dur*e.rpe);
  e.exec=adaptExec(e);
  SESSLOG.push(e);
  // Historique réel : on remplace l'entrée provisoire (valeurs du plan) par les valeurs du bilan.
  const real={ ut:adNowTs(), date:c.date, title:c.title, type:c.type, baseType:bt||undefined,
    km:+d.distance||0, pace:d.pace||'—', duration:+d.duration||0, rpe:+d.rpe||5, deniv:+d.deniv||0,
    planSessionId:c.planSessionId||null, repsLog:reps };
  const idx=c.sessRef?SESS.findIndex(s=>s.sessRef===c.sessRef):-1;
  const longest=SESS.reduce((m,s,i)=>i===idx?m:Math.max(m,+s.km||0),0);
  if(idx>=0) SESS[idx]=real; else SESS.push(real);
  if(!window.__ikSim && real.date===todayKey() && longest>=3 && real.km>longest) feteRecord(tp('recLongestRun',Math.round(real.km*10)/10));
  if(!window.__ikSim){ DB.save('sesslog',SESSLOG); DB.save('sessions',SESS); }
  return e;
}
function submitDebrief(){
  try{
    if(!debriefCtx||!debriefData){ toast(t('genericErrorRetry')); return; }
    if(debriefData.status==='missed') return blSubmitMissed();
    const d=debriefData, c=debriefCtx;
    const guard=sessionGuard(+d.distance||0,+d.duration||0,c.date);
    if(!guard.ok){ toast(guard.msg); return; }
    const e=blRecord(c,d,debriefReps,blBaseType());
    refreshXP({animate:true});
    const entries=adaptAfterBilan(e);
    saveAll();
    try{ if(typeof guestAfterBilan==='function') guestAfterBilan(); }catch(x){}
    try{ if(typeof ikTrack==='function') ikTrack('bilan_done',{status:e.status,type:e.baseType||'',verdict:e.exec.verdict}); }catch(x){}
    renderCoachAnalysis(coachAnalyze(e),entries);
  }catch(err){
    console.error('submitDebrief a échoué :',err);
    toast(t('genericErrorRetry'));
  }
}
// Séances du plan ratées : marquées, notées dans SESSLOG, puis le moteur (partagé avec simulateAthlete).
function blRecordMissed(ids,reason,pain,repl,replData,illSince){
  ids.forEach((id,i)=>{
    const s=PLAN&&PLAN.sessions.find(x=>x.id===id); if(!s) return;
    s.done=false; s.missed=true; s.missedReason=reason; s.missedReplacement=i===0?(repl||'Aucune activité'):'Aucune activité'; s.missedReplData=i===0?(replData||null):null;
    SESSLOG.push({id:'m'+adNowTs().toString(36)+i+Math.random().toString(36).slice(2,5), v:2, ut:adNowTs(), ts:adNowTs(), date:s.date, title:planSessTitle(s), type:s.type, baseType:s.baseType,
      planSessionId:s.id, status:'missed', reason, done:false, pain:pain||{on:false}});
  });
  return ids.length?adaptAfterMissed(ids,reason,{pain,since:illSince?adKeyAdd(todayKey(),-illSince):null}):[];
}
// « Pas fait » : une ou plusieurs séances du plan (ou une séance perso).
function blSubmitMissed(repl,replData){
  const d=debriefData, c=debriefCtx;
  if(!d.reason){ toast(t('missedReasonPrompt')); return; }
  const ids=(d.ids&&d.ids.length)?d.ids:(c.planSessionId?[c.planSessionId]:[]);
  repl=repl||d.repl||'Aucune activité'; replData=replData||d.replData||null;
  // Séance cochée « faite » juste avant (markRunDone) : on défait l'entrée provisoire et l'XP.
  if(c.sessRef){ const i=SESS.findIndex(s=>s.sessRef===c.sessRef); if(i>=0) SESS.splice(i,1); }
  if(c.perso){ const p=(CUSTOM||[]).find(x=>x.id===c.perso.pid), s=p&&p.sessions.find(x=>x.id===c.perso.sid); if(s) s.done=false; }
  const pain=d.reason==='Douleur'&&d.pain.on?{on:true,zone:d.pain.zone||'other',side:d.pain.side||null,level:+d.pain.level||0,gait:!!d.pain.gait}:null;
  const entries=blRecordMissed(ids,d.reason,pain,repl,replData,d.illSince);
  saveAll(); refreshXP();
  try{ if(typeof ikTrack==='function') ikTrack('bilan_missed',{reason:d.reason}); }catch(x){}
  if(entries.length) renderAdaptResult(entries,{missed:true});
  else { closeOv('ovProg'); toast(t('sessionNotedToast')); }
  debriefCtx=null; debriefData=null;
  renderSport(); if(document.body.dataset.scr==='home') renderHome();
  setTimeout(checkMissedSessions,600);
}
// Fin d'un formulaire de remplacement (app.js) ouvert depuis le bilan.
function finalizeMissedSession(){
  if(!missedCtx){ closeOv('ovProg'); return; }
  const repl=missedCtx.replacement, data=missedCtx.replData;
  missedCtx=null;
  if(debriefData){ debriefData.repl=repl; debriefData.replData=data; renderDebrief(); return; }
  closeOv('ovProg');
}
/* ---- séances passées sans réponse : UNE question pour toutes ---- */
function checkMissedSessions(){
  if(!PLAN || !PLAN.sessions || document.getElementById('ovProg').classList.contains('on')) return;
  const tk=todayKey();
  const pending=PLAN.sessions.filter(s=>s.date<tk && !s.done && !s.missed && s.type!=='Repos' && s.baseType!=='Repos' && (s.km||0)>0);
  if(!pending.length) return;
  openMissedFlow(pending.map(s=>s.id));
}
function openMissedFlow(sid){
  const ids=Array.isArray(sid)?sid:[sid];
  const s=PLAN&&PLAN.sessions.find(x=>x.id===ids[0]); if(!s) return;
  openSessionDebrief({date:s.date,title:s.title,km:s.km,pace:s.pace,type:s.type,duration:s.duration,plannedRpe:s.rpe,planSessionId:s.id,series:s.series||null,ids},'missed');
}
/* ---- analyse après le bilan ---- */
function coachAnalyze(e){
  const pos=[],errs=[],tips=[];
  const x=e.exec||{};
  if(e.done!==false) pos.push(t('coach_pos_completed'));
  if((e.mood||e.feel)>=4) pos.push(t('coach_pos_feel'));
  if(e.sleepQ===3||(!e.sleepQ&&e.sleep>=4)) pos.push(t('coach_pos_sleep'));
  const painOn=e.pain&&typeof e.pain==='object'?e.pain.on:(e.pain&&e.pain!=='Aucune');
  if(!painOn) pos.push(t('coach_pos_nopain'));
  if(x.hard) errs.push(tp('blHarderThanExpected',e.rpe,e.rpeExp?(e.rpeExp[0]===e.rpeExp[1]?e.rpeExp[0]:e.rpeExp[0]+'–'+e.rpeExp[1]):'—'));
  if(painOn) errs.push(t('blPainNoted'));
  if(e.sleepQ===1||(!e.sleepQ&&e.sleep<=2)) { errs.push(t('coach_err_sleep')); tips.push(t('coach_tip_sleep')); }
  if(e.legs===3||(!e.legs&&e.fatigue>=4)) errs.push(t('coach_err_fatigue'));
  if(e.wx && e.wx.corr>=0.01) tips.push(tp('blHeatTip',Math.round(e.wx.corr*1000)/10));
  tips.push(t('coach_tip_hydrate'));
  const motivKeys=['coach_motiv1','coach_motiv2','coach_motiv3','coach_motiv4'];
  return {pos,errs,tips,motiv:t(motivKeys[Math.floor(Math.random()*4)]),e,adjust:[]};
}
function renderCoachAnalysis(a,entries){
  entries=entries||[];
  const e=a.e, x=e.exec||{};
  const warn=entries.some(z=>z.safety) || x.verdict==='verySlow';
  const mid=!warn && (a.errs.length || x.verdict==='slow' || x.verdict==='fast' || x.hard);
  const tone=warn?'warn':mid?'mid':'ok';
  const vKey={fast:'blVerdictFast',ok:'blVerdictOk',slow:'blVerdictSlow',verySlow:'blVerdictVerySlow',race:'blVerdictRace'}[x.verdict]||(tone==='ok'?'caVerdictOk':tone==='mid'?'caVerdictMid':'caVerdictWarn');
  let h='<div class="ca-hero ca-'+tone+'"><div class="ca-ic">'+ICN(tone==='ok'?'check':'warning',22)+'</div><div><b>'+t(vKey)+'</b><span>'+escHtml(e.title||'')+'</span></div></div>';
  if(+e.distance>0) h+='<div class="db-sum ca-sum"><div class="db-tile"><b>'+fmt1(e.distance)+' <small>km</small></b><span>'+t('dbDistLab')+'</span></div><div class="db-tile"><b>'+fmtDurMin(e.duration)+'</b><span>'+t('dbDurLab')+'</span></div><div class="db-tile"><b>'+escHtml(e.pace||'—')+' <small>/km</small></b><span>'+t('dbTilePace')+'</span></div></div>';
  if(x.tgt && x.real) h+='<div class="ca-rpe"><span>'+t('blVsTarget')+'</span><b><bdi dir="ltr">'+spkToStr(x.real)+' / '+spkToStr(x.tgt)+(x.dev!=null?' · '+(x.dev>0?'−':'+')+Math.abs(Math.round(x.devS))+' s/km':'')+'</bdi></b></div>';
  h+='<div class="ca-rpe"><span>'+t('dbEffortLab')+'</span><b style="--h:'+Math.round(140-(+e.rpe||5)*13)+'">'+(+e.rpe||5)+'/10 · '+t(RPE_LAB[+e.rpe||5])+'</b></div>';
  if(entries.length) h+='<div class="ca-block"><div class="ca-h e">'+ICN('gear',15)+' '+t('adCoachTitle')+'</div>'+entries.map(adEntryHTML).join('')+'</div>';
  const list=(icon,cls,title,items)=>items.length?'<div class="ca-block"><div class="ca-h '+cls+'">'+ICN(icon,15)+' '+title+'</div><ul class="ca-list">'+items.map(z=>'<li>'+z+'</li>').join('')+'</ul></div>':'';
  h+=list('check','ok',t('positivePointsTitle'),a.pos);
  h+=list('warning','warn',t('constructiveCriticismTitle'),a.errs);
  h+=list('bulb','e',t('adviceLabel'),a.tips);
  h+='<blockquote class="ca-quote">'+a.motiv+'</blockquote>';
  h+='<div class="ik-cta-bar"><button class="btn" onclick="adMarkSeen();closeOv(\'ovProg\');renderSport();nav(\'home\')">'+t('notedCoachBtn')+'</button></div>';
  $('#progBody').innerHTML=h; $('#ovProgTitle').textContent=t('ikorunAnalysisTitle');
  const sc=$('#progBody').closest('.ov-body-scroll'); if(sc) sc.scrollTop=0;
  debriefCtx=null;
}
// Résultat d'un « pas fait » ou d'un check du matin qui a ajusté le plan.
function renderAdaptResult(entries,opts){
  let h='<div class="ca-hero ca-'+(entries.some(z=>z.safety)?'warn':'mid')+'"><div class="ca-ic">'+ICN('gear',22)+'</div><div><b>'+t('adCoachTitle')+'</b><span>'+t(opts&&opts.missed?'sessionNotedToast':'adCheckinNoted')+'</span></div></div>';
  h+=entries.map(adEntryHTML).join('');
  h+='<div class="ik-cta-bar"><button class="btn" onclick="adMarkSeen();closeOv(\'ovProg\');renderSport();if(document.body.dataset.scr===\'home\')renderHome()">'+t('notedCoachBtn')+'</button></div>';
  if(!document.getElementById('ovProg').classList.contains('on')) openOv('ovProg');
  $('#progBody').innerHTML=h; $('#ovProgTitle').textContent=t('ikorunAnalysisTitle');
}
