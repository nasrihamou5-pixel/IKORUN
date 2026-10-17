/* ============================================================================
   IKORUN — Onglet « Programme » (course + muscu) et assistant « Nouveau plan »
   (ui/sport-combo.js). Dépend de : plan/strength.js, plan/strength-adapt.js,
   et des globales de l'appli (PLAN, P, CUSTOM, t, tp, ICN, DB, toast, openOv/closeOv,
   renderSport, startLive, allExercises, ex, openPlanSetup, openCreate, addPersoPlan…).
   État : STRENGTH (plan de muscu, déclaré dans app.js) — chargé dans reloadState(), sauvé dans saveAll().
   Choix de conception : course et muscu = DEUX plans LIÉS (PLAN existant intact, aucune
   migration) ; le lien est fait à la génération (runSessions) puis par adaptAfterMuscu().
   ============================================================================ */
/* STRENGTH est déclaré dans app.js (ligne `let P, SESS, … , STRENGTH;`) pour exister avant reloadState(). */
let wiz = null, wizAfterRun = false;

/* ---------- séances de muscu du plan, vues comme des routines pour startLive() ---------- */
function strengthProgs(){
  if(!STRENGTH || !STRENGTH.sessions) return [];
  return STRENGTH.sessions.map(function(s){
    return { id:s.id, name:s.title, color:'--e', icon:'dumbbell', objective:'Force', ex:s.ex, _strengthId:s.id };
  });
}
function strengthMarkDone(id){
  const s = STRENGTH && STRENGTH.sessions.find(function(x){ return x.id===id; });
  if(!s) return null;
  s.done = true; DB.save('strength_plan', STRENGTH);
  return s;
}
// Appelée à la fin d'une séance live (patch dans finishLive) : marque faite + déclenche l'accord course.
function strengthAfterLive(live, entry){
  const sid = live && live.prog && live.prog._strengthId;
  const s = sid ? strengthMarkDone(sid) : null;
  if(s){ entry.legsHeavy = !!s.legsHeavy; }
  try{ if(typeof adaptAfterMuscu==='function') adaptAfterMuscu(entry); }catch(e){ console.error(e); }
}

/* ---------- semaine en cours ---------- */
function cbMonday(k){ const d=new Date(k+'T12:00:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); return dateKey(d); }
function cbAdd(k,n){ const d=new Date(k+'T12:00:00'); d.setDate(d.getDate()+n); return dateKey(d); }
function cbWeekKeys(){ const m=cbMonday(todayKey()); return [0,1,2,3,4,5,6].map(function(i){ return cbAdd(m,i); }); }
function cbWeekNumber(){
  const base = STRENGTH ? STRENGTH.startDate : (PLAN && PLAN.sessions[0] ? cbMonday(PLAN.sessions[0].date) : null);
  if(!base) return null;
  const n = Math.floor((new Date(cbMonday(todayKey())+'T12:00:00') - new Date(base+'T12:00:00'))/604800000)+1;
  return Math.max(1, n);
}

/* ---------- onglet Programme ---------- */
function renderCombo(){
  if(!PLAN && !STRENGTH){
    return '<div class="card"><div class="empty"><div class="em-ic">'+ICN('bolt',36,'currentColor')+'</div>'+
      '<div style="font-weight:700;margin-bottom:6px;color:var(--snow)">'+t('comboEmptyTitle')+'</div>'+
      '<div style="font-size:13px;color:var(--muted);margin-bottom:14px">'+t('comboEmptyText')+'</div>'+
      '<button class="btn" onclick="openWizard()">＋ '+t('comboCreate')+'</button></div></div>';
  }
  const tk = todayKey(), wk = cbWeekKeys();
  const runW = PLAN ? PLAN.sessions.filter(function(s){ return wk.indexOf(s.date)>=0 && s.km>0; }) : [];
  const strW = STRENGTH ? STRENGTH.sessions.filter(function(s){ return wk.indexOf(s.date)>=0; }) : [];
  const done = runW.filter(function(s){ return s.done; }).length + strW.filter(function(s){ return s.done; }).length;
  const total = runW.length + strW.length;
  const wn = cbWeekNumber(), wTotal = STRENGTH ? STRENGTH.weeks : (PLAN ? PLAN.weeks : 0);
  const title = (PLAN && STRENGTH) ? planRaceTitle()+' + '+t('strengthWord') : (PLAN ? planRaceTitle() : t('strengthWord'));
  let h = '<div class="card ik-combo-head">'+
    '<div class="lab">'+t('comboTitle')+(wn?' · '+tp('comboWeekOf',Math.min(wn,wTotal||wn),wTotal):'')+'</div>'+
    '<div class="man" style="font-weight:800;font-size:19px;margin-top:2px">'+escHtml(title)+'</div>'+
    ((PLAN && STRENGTH)?'<div style="font-size:12.5px;color:var(--muted);margin-top:4px">'+t('comboGenTogether')+'</div>':'')+
    '<div class="ik-stats3">'+
      '<div><b>'+runW.length+'</b><span>'+t('comboRunWord')+'</span></div>'+
      '<div><b>'+strW.length+'</b><span>'+t('comboMuscuWord')+'</span></div>'+
      '<div><b>'+done+'/'+total+'</b><span>'+t('comboDoneWord')+'</span></div>'+
    '</div></div>';

  // bande de la semaine : point course (accent), point muscu (--maitre), anneau = séance adaptée
  const L = t('dowShort').split(',');
  h += '<div class="ik-wk">'+wk.map(function(k,i){
    const r = runW.filter(function(s){ return s.date===k; })[0], m = strW.filter(function(s){ return s.date===k; })[0];
    const adapted = r && r.adj && r.adj.r;
    return '<div class="'+(k===tk?'td':'')+'"><em>'+escHtml(L[i]||'')+'</em>'+
      (r?'<i class="ik-dot run'+(adapted?' adapted':'')+'"></i>':'')+(m?'<i class="ik-dot mu"></i>':'')+'</div>';
  }).join('')+'</div>';
  h += '<div class="ik-legend"><span><i class="ik-dot run"></i>'+t('comboRun')+'</span><span><i class="ik-dot mu"></i>'+t('comboMuscu')+'</span><span><i class="ik-dot run adapted"></i>'+t('comboAdapted')+'</span></div>';

  h += adaptCardHTML('combo');   // « Ton coach a ajusté ton plan » : montre aussi les allègements dus aux jambes

  // aujourd'hui : séance de muscu du plan
  const todayM = strW.filter(function(s){ return s.date===tk; })[0];
  if(todayM){
    h += '<div class="hv7-sec-lab" style="margin:14px 0 8px">'+t('comboToday')+'</div>'+
      '<div class="card ik-today"><div class="rs-ic" style="background:rgba(var(--e-rgb),.12);color:var(--e2)">'+ICN('dumbbell',18)+'</div>'+
      '<div class="rs-row-body"><div class="rs-row-t">'+t('comboMuscu')+' · '+escHtml(todayM.title)+'</div>'+
      '<div class="rs-row-m">'+todayM.duration+' min · '+tp('exercisesCount',todayM.ex.length)+'</div></div>'+
      (todayM.done?'<span class="chrome-chip" style="color:var(--ok)">'+t('sessionCompleted')+'</span>'
        :'<button class="btn sm" onclick="startLive(\''+todayM.id+'\')">'+t('comboStart')+'</button>')+'</div>';
  }

  // mes plans
  h += '<div class="hv7-sec-lab" style="margin:16px 0 8px">'+t('comboMyPlans')+'</div>';
  if(PLAN) h += cbPlanRow(planRaceTitle(), t('comboGeneratedBy'), t('comboFollowed'), "sportTab='run';runSub='ikorun';renderSport()");
  if(STRENGTH) h += cbPlanRow(t('strengthWord')+' · '+tp('comboPerWeek',STRENGTH.perWeek), t('comboGeneratedBy')+(STRENGTH.linkedRun?' · '+t('comboLinked'):''), t('comboFollowed'), "sportTab='muscu';renderSport()", 'delStrength()');
  CUSTOM.forEach(function(p){
    const isM = p.kind==='muscu';
    h += cbPlanRow(p.name, t('comboCreatedByMe')+' · '+(isM?t('comboMuscu'):t('comboRun')).toLowerCase(), t('comboFollow'),
      isM ? "sportTab='muscu';renderSport()" : "sportTab='run';runSub='perso';openPerso('"+p.id+"')");
  });
  h += '<button class="btn ghost" style="width:100%;margin-top:6px" onclick="openWizard()">＋ '+t('comboCreate')+'</button>';
  return h;
}
function cbPlanRow(name, sub, action, onclick, onDelete){
  return '<div class="ik-plan-row"><div class="ik-plan-b" onclick="'+onclick+'"><b>'+escHtml(name)+'</b><span>'+escHtml(sub)+'</span></div>'+
    '<button class="btn sm ghost" onclick="'+onclick+'">'+action+'</button>'+
    (onDelete?'<button class="tb-gear" style="width:30px;height:30px" aria-label="'+t('strengthDeleteLab')+'" onclick="'+onDelete+'">'+ICN('trash',15)+'</button>':'')+'</div>';
}
function delStrength(){
  customConfirm(t('strengthDelete'), function(){ STRENGTH=null; DB.save('strength_plan',null); renderSport(); }, {danger:true});
}

/* ---------- assistant « Nouveau plan » (3 étapes sur un seul écran) ---------- */
// Jours proposés par défaut (0 = lundi) : ceux où une séance de jambes gêne le moins le plan de course,
// c.-à-d. ni le jour d'une séance dure ni la veille. Sans plan : lundi, mercredi, vendredi.
function wizDefaultDays(){
  if(!PLAN || !PLAN.sessions || !PLAN.sessions.length) return [0,2,4];
  const hardDow = [0,0,0,0,0,0,0];
  PLAN.sessions.forEach(function(s){
    if(!(s.km>0) || !(planIsHard(s)||planIsLong(s))) return;
    const d = (new Date(s.date+'T12:00:00').getDay()+6)%7;
    hardDow[d]++; hardDow[(d+6)%7]++;   // le jour même et la veille
  });
  const order = [0,1,2,3,4,5,6].sort(function(a,b){ return hardDow[a]-hardDow[b] || a-b; });
  return order.slice(0,3).sort();
}
function openWizard(){
  wiz = { what:'both', how:'gen', days:wizDefaultDays(), perWeek:2, equip:'both', needRun:false };
  const h2 = $('#ovWizard h2'); if(h2) h2.textContent = t('wizTitle');
  renderWizard(); openOv('ovWizard');
}
function wizSet(k,v){ wiz[k]=v; renderWizard(); }
function wizDay(i){ const a=wiz.days, p=a.indexOf(i); if(p>=0) a.splice(p,1); else a.push(i); a.sort(); renderWizard(); }
function wizOpt(sel,key,title,sub,icn,badge){
  return '<div class="ik-opt'+(sel?' sel':'')+'" onclick="'+key+'"><div class="ik-opt-ic">'+ICN(icn,20)+'</div><div style="flex:1"><b>'+title+'</b><span class="s">'+sub+'</span></div>'+(badge?'<em class="ik-badge">'+badge+'</em>':'')+'</div>';
}
function renderWizard(){
  const w = wiz, L = t('dowShort').split(',');
  let h = '<div class="hv7-sec-lab" style="margin:4px 0 8px">'+t('wizWhat')+'</div>'+
    wizOpt(w.what==='run',"wizSet('what','run')",t('wizRun'),t('wizRunSub'),'run')+
    wizOpt(w.what==='muscu',"wizSet('what','muscu')",t('wizMuscu'),t('wizMuscuSub'),'dumbbell')+
    wizOpt(w.what==='both',"wizSet('what','both')",t('wizBoth'),t('wizBothSub'),'refresh',t('wizAdvised'));
  h += '<div class="hv7-sec-lab" style="margin:14px 0 8px">'+t('wizHow')+'</div>'+
    wizOpt(w.how==='gen',"wizSet('how','gen')",t('wizGen'),t('wizGenSub'),'bolt')+
    wizOpt(w.how==='self',"wizSet('how','self')",t('wizSelf'),t('wizSelfSub'),'edit');
  if(w.how==='gen' && w.what!=='run'){
    h += '<div class="hv7-sec-lab" style="margin:14px 0 8px">'+t('wizDays')+'</div><div class="ik-days">'+
      L.map(function(l,i){ return '<div class="'+(w.days.indexOf(i)>=0?'on':'')+'" onclick="wizDay('+i+')">'+escHtml(l)+'</div>'; }).join('')+'</div>'+
      '<div class="lab" style="margin:12px 0 6px">'+t('wizPerWeek')+'</div><div class="ik-days">'+
      [1,2,3].map(function(n){ return '<div class="'+(w.perWeek===n?'on':'')+'" onclick="wizSet(\'perWeek\','+n+')">'+n+'</div>'; }).join('')+'</div>'+
      '<div class="lab" style="margin:12px 0 6px">'+t('wizEquip')+'</div><div class="ik-days">'+
      [['gym','salle','wizEquipGym'],['home','maison','wizEquipHome'],['both','both','wizEquipBoth']].map(function(e){
        return '<div class="'+(w.equip===e[1]?'on':'')+'" onclick="wizSet(\'equip\',\''+e[1]+'\')">'+t(e[2])+'</div>'; }).join('')+'</div>';
  }
  if(w.what==='both' && w.how==='gen'){
    h += '<div class="ik-note"><b>'+t('wizHowTitle')+'</b><span>'+t('wizHowText')+'</span></div>';
  }
  if(w.needRun){
    h += '<div class="ik-note warn"><span>'+t('wizNeedRun')+'</span><button class="btn sm" onclick="wizCreateRun()">'+t('wizNeedRunBtn')+'</button></div>';
  }
  h += '<button class="btn" style="width:100%;margin-top:14px" onclick="wizGenerate()">'+t('wizGenerate')+'</button>'+
    '<div style="text-align:center;margin-top:12px;font-size:13px;color:var(--e2);font-weight:600" onclick="closeOv(\'ovWizard\');sportTab=\'run\';runSub=\'perso\';renderSport()">'+t('wizFollowExisting')+'</div>';
  $('#wizBody').innerHTML = h;
}
function wizCreateRun(){ wizAfterRun = true; closeOv('ovWizard'); sportTab='run'; runSub='ikorun'; renderSport(); openPlanSetup(); }
// Appelée depuis generatePlan() quand l'utilisateur est venu de l'assistant « les deux ensemble ».
function wizResume(){ if(!wizAfterRun) return; wizAfterRun=false; sportTab='combo'; renderSport(); if(wiz){ wiz.needRun=false; renderWizard(); openOv('ovWizard'); wizGenerate(); } }

function wizGenerate(){
  const w = wiz; if(!w) return;
  if(w.how==='self'){
    closeOv('ovWizard');
    if(w.what==='run'){ sportTab='run'; runSub='perso'; renderSport(); addPersoPlan(); }
    else { sportTab='muscu'; renderSport(); openCreate(); }
    return;
  }
  if(w.what==='run'){ closeOv('ovWizard'); sportTab='run'; runSub='ikorun'; renderSport(); openPlanSetup(); return; }
  if(w.what==='both' && !PLAN){ w.needRun=true; renderWizard(); return; }
  const lvl = (typeof LEVELS!=='undefined' && LEVELS.indexOf(P.level)>=0) ? P.level : 'Intermédiaire';
  const r = strengthBuild({
    perWeek:w.perWeek, days:w.days, equip:w.equip, level:lvl,
    seed:((P.joinedAt||1)%100000)+(PLAN?PLAN.sessions.length:0),
    raceDate:(w.what==='both' && P.compDate)?P.compDate:null,
    runSessions:(w.what==='both' && PLAN)?PLAN.sessions:null,
    startDate:(w.what==='both')?null:todayKey(),
    catalog:allExercises(), exFactory:ex,
    titles:{ UPPER:t('strUpper'), LOWER:t('strLower'), FULL:t('strFull') }
  });
  if(r.err){ toast(t('strengthErr_'+r.err)||r.err); return; }
  STRENGTH = r.plan; DB.save('strength_plan', STRENGTH);
  const skipped = (STRENGTH.warnings||[]).filter(function(x){ return x.indexOf('skipped:')===0; }).length;
  toast(tp('strengthGenerated', STRENGTH.sessions.length, STRENGTH.weeks)+(skipped?' '+tp('strengthSkipped', skipped):''));
  closeOv('ovWizard'); sportTab='combo'; burst(); renderSport();
}
