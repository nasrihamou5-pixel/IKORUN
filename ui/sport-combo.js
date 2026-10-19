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

/* ---------- mode de l'onglet Sport ----------
   P.sportMode === 'integrated' : course + muscu dans UN programme, une seule page (pas d'onglets).
   Sinon (« séparé ») : les trois onglets Programme / Course / Musculation.
   Dans le mode intégré, « Plan de course » et « Muscu » s'ouvrent en sous-page avec un retour. */
function sportIntegrated(){ return !!(P && P.sportMode==='integrated' && !P.easyMode); }
function sportSetMode(m){ P.sportMode = m; DB.save('profile', P); sportTab = 'combo'; renderSport(); }
function sportSplitAsk(){
  customConfirm(t('sportSplitConfirm'), function(){ if(STRENGTH){ STRENGTH.linkedRun=false; DB.save('strength_plan',STRENGTH); } sportSetMode('split'); });
}

/* ---------- onglet / page Programme ---------- */
function cbEmptyHTML(){
  return '<div class="card"><div class="empty"><div class="em-ic">'+ICN('bolt',36,'currentColor')+'</div>'+
    '<div style="font-weight:700;margin-bottom:6px;color:var(--snow)">'+t('comboEmptyTitle')+'</div>'+
    '<div style="font-size:13px;color:var(--muted);margin-bottom:14px">'+t('comboEmptyText')+'</div>'+
    '<button class="btn" onclick="openWizard()">+ '+t('comboCreate')+'</button></div></div>';
}
function cbWeekData(){
  const tk = todayKey(), wk = cbWeekKeys();
  const runW = PLAN ? PLAN.sessions.filter(function(s){ return wk.indexOf(s.date)>=0 && s.km>0; }) : [];
  const strW = STRENGTH ? STRENGTH.sessions.filter(function(s){ return wk.indexOf(s.date)>=0; }) : [];
  return { tk:tk, wk:wk, runW:runW, strW:strW };
}
function cbHeroHTML(d){
  const done = d.runW.filter(function(s){ return s.done; }).length + d.strW.filter(function(s){ return s.done; }).length;
  const total = d.runW.length + d.strW.length;
  const wn = cbWeekNumber(), wTotal = STRENGTH ? STRENGTH.weeks : (PLAN ? PLAN.weeks : 0);
  const title = (PLAN && STRENGTH) ? planRaceTitle()+' + '+t('strengthWord') : (PLAN ? planRaceTitle() : t('strengthWord'));
  const linked = PLAN && STRENGTH && STRENGTH.linkedRun;
  return '<div class="ik-combo-hero">'+
    '<div class="ik-combo-top"><span class="ik-tag">'+t('comboTitle')+'</span>'+(wn?'<span class="ik-tag plain">'+tp('comboWeekOf',Math.min(wn,wTotal||wn),wTotal)+'</span>':'')+'</div>'+
    '<div class="ik-combo-title">'+escHtml(title)+'</div>'+
    (linked?'<div class="ik-combo-sub">'+t('comboGenTogether')+'</div>':'')+
    '<div class="ik-stats3">'+
      '<div><b>'+d.runW.length+'</b><span>'+t('comboRunWord')+'</span></div>'+
      '<div><b>'+d.strW.length+'</b><span>'+t('comboMuscuWord')+'</span></div>'+
      '<div><b>'+done+'/'+total+'</b><span>'+t('comboDoneWord')+'</span></div>'+
    '</div></div>';
}
// bande de la semaine : point course (accent), point muscu (--maitre), anneau = séance ajustée
function cbStripHTML(d){
  const L = t('dowShort').split(',');
  return '<div class="ik-wk">'+d.wk.map(function(k,i){
    const r = d.runW.filter(function(s){ return s.date===k; })[0], m = d.strW.filter(function(s){ return s.date===k; })[0];
    const adapted = r && r.adj && r.adj.r;
    return '<div class="'+(k===d.tk?'td':'')+'"><em>'+escHtml(L[i]||'')+'</em>'+
      (r?'<i class="ik-dot run'+(adapted?' adapted':'')+'"></i>':'')+(m?'<i class="ik-dot mu"></i>':'')+(!r&&!m?'<i class="ik-dot rest"></i>':'')+'</div>';
  }).join('')+'</div>'+
  '<div class="ik-legend"><span><i class="ik-dot run"></i>'+t('comboRun')+'</span><span><i class="ik-dot mu"></i>'+t('comboMuscu')+'</span><span><i class="ik-dot run adapted"></i>'+t('comboAdapted')+'</span></div>';
}
// une séance de muscu du plan, présentée comme une ligne du plan de course
function cbStrRowHTML(s, tk){
  const qb = s.done ? '<div class="qbadge done">'+t('doneTag')+'</div>'
    : s.skipped ? '<div class="qbadge missed">'+t('notDone')+'</div>'
    : (s.date<tk ? '<div class="qbadge pend">'+t('toConfirmTag')+'</div>'
    : '<div class="chrome-chip" style="color:var(--maitre)">'+t('comboMuscu')+'</div>');
  const act = (!s.done && s.date===tk) ? ' onclick="startLive(\''+s.id+'\')"' : ' onclick="cbStrOpen(\''+s.id+'\')"';
  return '<div class="sess'+(s.done?' done':'')+(s.date===tk?' today':'')+'" style="--sess-c:var(--maitre)"'+act+'>'+
    '<div class="row"><div><div class="sess-t">'+escHtml(s.title)+'</div>'+
    '<div class="sess-m">'+escHtml(fmtDate(s.date)+' · '+s.duration+' min · ')+tp('exercisesCount',s.ex.length)+(s.deload?' · '+t('deloadWord'):'')+'</div></div>'+qb+'</div></div>';
}
// séances course + muscu triées par date (une seule liste, comme un seul programme)
function cbMergedRows(run, str, tk){
  const items = run.map(function(s){ return { d:s.date, k:0, s:s }; }).concat(str.map(function(s){ return { d:s.date, k:1, s:s }; }));
  items.sort(function(a,b){ return a.d<b.d?-1:(a.d>b.d?1:a.k-b.k); });
  return items.map(function(x){ return x.k ? cbStrRowHTML(x.s, tk) : renderPlanRows([x.s], tk, {flat:true}); }).join('');
}
/* ---------- séances passées sans réponse : « À confirmer » ----------
   Avant, l'appli ouvrait directement « Pas faite » pour toute séance passée non cochée : une séance
   oubliée devenait « manquée ». Maintenant elle attend une réponse, sur cette carte (Sport et Accueil). */
function pendingRun(){
  if(!PLAN || !PLAN.sessions) return [];
  const tk = todayKey(), lim = cbAdd(tk,-21);
  return PLAN.sessions.filter(function(s){ return s.date<tk && s.date>=lim && !s.done && !s.missed && s.type!=='Repos' && s.baseType!=='Repos' && (s.km||0)>0; });
}
function pendingStr(){
  if(!STRENGTH) return [];
  const tk = todayKey(), lim = cbAdd(tk,-21);
  return STRENGTH.sessions.filter(function(s){ return s.date<tk && s.date>=lim && !s.done && !s.skipped; });
}
function pendingCardHTML(){
  const run = pendingRun(), str = pendingStr();
  if(!run.length && !str.length) return '';
  const items = run.map(function(s){ return {d:s.date, k:0, s:s}; }).concat(str.map(function(s){ return {d:s.date, k:1, s:s}; }))
    .sort(function(a,b){ return a.d<b.d?1:-1; });
  const shown = items.slice(0,4);
  let h = '<section class="ik-pend"><div class="ik-pend-h"><b>'+ICN('help',16)+' '+tp('pendTitle', items.length)+'</b><span>'+t('pendSub')+'</span></div>';
  shown.forEach(function(x){
    const s = x.s, isM = x.k===1;
    const meta = fmtDate(s.date)+' · '+(isM ? s.duration+' min' : hKm(s.km)+' km');
    h += '<div class="ik-pend-row"><div class="ik-sq '+(isM?'mu':'')+'" style="width:34px;height:34px">'+ICN(isM?'dumbbell':'run',16)+'</div>'+
      '<div class="ik-pend-b"><b>'+escHtml(isM ? s.title : planSessTitle(s))+'</b><span>'+escHtml(meta)+'</span></div>'+
      '<button type="button" class="ik-pbtn ok" onclick="'+(isM?"strConfirm('"+s.id+"',true)":'pendDone('+s.id+')')+'">'+t('pendDid')+'</button>'+
      '<button type="button" class="ik-pbtn" onclick="'+(isM?"strConfirm('"+s.id+"',false)":'openMissedFlow('+s.id+')')+'">'+t('notDone')+'</button></div>';
  });
  if(items.length>shown.length) h += '<div class="ik-pend-more">'+tp('pendMore', items.length-shown.length)+'</div>';
  return h+'</section>';
}
function pendDone(id){ curRunId=id; markRunDone(); }
function strConfirm(id, did){
  const s = STRENGTH && STRENGTH.sessions.find(function(x){ return x.id===id; }); if(!s) return;
  if(!did){ openStrMiss(id); return; }                  // pas fait : on demande pourquoi (douleur, maladie, fatigue…)
  if(did){
    s.done = true; s.skipped = false;
    // trace dans l'historique muscu (valeurs prévues, comme une séance cochée après coup)
    MSESS.push({date:s.date, progName:s.title, tonnage:0, sets:s.ex.reduce(function(a,e){ return a+(+e.sets||0); },0), reps:0, duration:s.duration, calories:0,
      muscles:[].concat.apply([], s.ex.map(function(e){ return e.muscles||[]; })), late:true});
    try{ strengthAfterLive({prog:{_strengthId:null}}, {date:s.date, legsHeavy:!!s.legsHeavy, muscles:[]}); }catch(e){}
  } else { s.skipped = true; }
  DB.save('strength_plan', STRENGTH); saveAll(); haptic();
  toast(t(did?'pendSavedDone':'sessionNotedToast'));
  refreshScreen();
}
// Accueil : la séance de muscu du jour, à la place de « Jour de repos » — avec la silhouette des
// muscles travaillés et les premiers exercices, pour qu'on voie la séance d'un coup d'œil.
function strengthTodayHeroHTML(wdShort){
  const tk = todayKey(), s = STRENGTH && STRENGTH.sessions.find(function(x){ return x.date===tk; });
  if(!s) return '';
  const sets = s.ex.reduce(function(a,e){ return a+(+e.sets||0); }, 0);
  const prog = { id:s.id, ex:s.ex };
  const tags = (typeof progTopMuscles==='function') ? progTopMuscles(prog,3) : [];
  const fig = (typeof progBodyMini==='function') ? progBodyMini(prog) : '';
  let h = '<div class="hv7-day ik-mday" onclick="cbStrOpen(\''+s.id+'\')">'+
    '<div class="hv7-day-top"><span class="hv7-day-chip" style="color:var(--maitre)">'+escHtml(t('comboMuscu').toUpperCase())+'</span>'+
      '<span class="hv7-day-when">'+t('today')+' · '+escHtml(wdShort)+'</span></div>'+
    '<div class="ik-mday-g"><div class="ik-mday-l">'+
      '<div class="hv7-day-title">'+escHtml(s.title)+'</div>'+
      (tags.length?'<div class="mus-tags">'+tags.map(function(m){ return '<span>'+escHtml(m)+'</span>'; }).join('')+'</div>':'')+
      '<ul class="ik-mday-ex">'+s.ex.slice(0,4).map(function(e){ return '<li><span>'+escHtml(trExName(e.name))+'</span><em>'+e.sets+' × '+escHtml(String(e.reps))+'</em></li>'; }).join('')+
        (s.ex.length>4?'<li class="more">'+tp('exMore', s.ex.length-4)+'</li>':'')+'</ul>'+
    '</div><div class="ik-mday-fig">'+fig+'</div></div>'+
    '<div class="hv7-day-targets"><div><b>'+s.duration+'</b><span>min</span></div><div><b>'+s.ex.length+'</b><span>'+t('exercisesWord')+'</span></div><div><b>'+sets+'</b><span>'+t('setsWord')+'</span></div></div>';
  h += s.done ? '<div class="hv7-day-state ok">'+t('sessionCompleted')+'</div>'
    : '<div class="hv7-day-acts" onclick="event.stopPropagation()"><button class="hv7-act main" onclick="startLive(\''+s.id+'\')">'+t('comboStart')+'</button></div>';
  return h+'</div>';
}
// Accueil, jour sans séance : la semaine en points + la prochaine séance, au lieu d'une carte vide
function homeRestWeekHTML(){
  if(!PLAN && !STRENGTH) return '';
  const d = cbWeekData(), L = t('dowShort').split(',');
  return '<div class="ik-rest-wk">'+d.wk.map(function(k,i){
    const r = d.runW.filter(function(s){ return s.date===k; })[0], m = d.strW.filter(function(s){ return s.date===k; })[0];
    const done = (r&&r.done)||(m&&m.done);
    return '<div class="'+(k===d.tk?'td':'')+(done?' ok':'')+'"><em>'+escHtml(L[i]||'')+'</em><span>'+
      (r?'<i class="ik-dot run"></i>':'')+(m?'<i class="ik-dot mu"></i>':'')+(!r&&!m?'<i class="ik-dot rest"></i>':'')+'</span></div>';
  }).join('')+'</div>';
}
function cbStrOpen(id){
  const s = STRENGTH && STRENGTH.sessions.find(function(x){ return x.id===id; }); if(!s) return;
  openProg(id);   // fiche de la séance (exercices, démarrer), comme une routine
}
function renderCombo(){
  if(!PLAN && !STRENGTH) return cbEmptyHTML();
  return sportIntegrated() ? renderIntegrated() : renderComboSplit();
}
// mode séparé : vue d'ensemble de la semaine + mes plans (chaque plan garde son onglet)
function renderComboSplit(){
  const d = cbWeekData();
  let h = injuryCardHTML() + pendingCardHTML() + cbHeroHTML(d) + cbStripHTML(d);
  const todayM = d.strW.filter(function(s){ return s.date===d.tk; })[0];
  if(todayM){
    h += '<div class="hv7-sec-lab" style="margin:14px 0 8px">'+t('comboToday')+'</div>'+
      '<div class="ik-today"><div class="ik-sq mu">'+ICN('dumbbell',18)+'</div>'+
      '<div class="ik-today-b"><b>'+t('comboMuscu')+' · '+escHtml(todayM.title)+'</b>'+
      '<span>'+todayM.duration+' min · '+tp('exercisesCount',todayM.ex.length)+'</span></div>'+
      (todayM.done?'<span class="chrome-chip" style="color:var(--ok)">'+t('sessionCompleted')+'</span>'
        :'<button class="btn sm" onclick="startLive(\''+todayM.id+'\')">'+t('comboStart')+'</button>')+'</div>';
  }
  h += cbPlansHTML();
  return h;
}
// mode intégré : une seule page, la semaine course + muscu en une liste
function renderIntegrated(){
  const d = cbWeekData();
  let h = injuryCardHTML() + pendingCardHTML() + (PLAN && typeof planHeroHTML==='function' ? planHeroHTML() : cbHeroHTML(d)) + cbStripHTML(d);
  h += '<div class="hv7-sec-lab" style="margin:16px 0 8px">'+t('thisWeek')+'</div>';
  const rows = cbMergedRows(d.runW, d.strW, d.tk);
  h += rows || '<div class="sess-m" style="padding:6px 2px">'+t('comboNothingThisWeek')+'</div>';
  h += '<div class="ik-int-acts">'+
    (PLAN?'<button type="button" class="btn ghost" onclick="openFullIntegrated()">'+t('comboSeeAll')+'</button>':'')+
    '<button type="button" class="btn ghost" onclick="openWizard()">+ '+t('comboCreate')+'</button></div>';
  h += cbPlansHTML(true);
  const links = [];
  if((ADAPT_LOG||[]).some(function(e){ return e.status!=='note'; })) links.push('<button type="button" class="ad-histlink" onclick="openAdaptHistory()">'+ICN('gear',15)+' '+t('adHistory')+'</button>');
  links.push('<button type="button" class="ad-histlink" onclick="sportSplitAsk()">'+ICN('shuffle',15)+' '+t('sportSplitLink')+'</button>');
  h += '<div class="ik-int-links">'+links.join('')+'</div>';
  return h;
}
// tout le programme intégré, semaine par semaine (lundi → dimanche)
function openFullIntegrated(){
  if(!PLAN) return;
  const tk = todayKey(), weeks = {};
  PLAN.sessions.forEach(function(s){ const m=cbMonday(s.date); (weeks[m]=weeks[m]||{run:[],str:[]}).run.push(s); });
  (STRENGTH?STRENGTH.sessions:[]).forEach(function(s){ const m=cbMonday(s.date); (weeks[m]=weeks[m]||{run:[],str:[]}).str.push(s); });
  let h = '', n = 0;
  Object.keys(weeks).sort().forEach(function(m){
    n++; const w = weeks[m];
    h += '<div class="lab" style="margin:12px 0 6px">'+tp('weekN',n)+'</div>'+cbMergedRows(w.run.filter(function(s){ return s.km>0; }), w.str, tk);
  });
  $('#fullPlanBody').innerHTML = h; cbFullTitle(t('comboSeeAll'));
  openOv('ovFullPlan');
}
// « Mes plans » : en mode intégré, les deux plans liés ouvrent leur sous-page
// « Mes plans » : chaque plan avec ce qu'il est et trois actions claires (Voir · Modifier · Supprimer).
function cbPlanCard(o){
  const acts = o.acts.map(function(a){ return '<button type="button" class="ik-pact'+(a[2]?' '+a[2]:'')+'" onclick="'+a[1]+'">'+a[0]+'</button>'; }).join('');
  return '<div class="ik-plan-card"><div class="ik-plan-top"><div class="ik-sq'+(o.mu?' mu':'')+'">'+ICN(o.icn,18)+'</div>'+
    '<div class="ik-plan-b"><b>'+escHtml(o.name)+'</b><span>'+escHtml(o.sub)+'</span></div>'+
    (o.chip?'<span class="ik-tag ok plain-ok">'+o.chip+'</span>':'')+'</div>'+
    '<div class="ik-plan-acts">'+acts+'</div></div>';
}
function cbPlansHTML(integrated){
  let h = '<div class="hv7-sec-lab" style="margin:16px 0 8px">'+t('comboMyPlans')+'</div>';
  const V=t('planActView'), M=t('planActEdit'), D=t('planActDelete');
  if(PLAN){
    const wk = PLAN.weeks||0, last = PLAN.sessions.length ? PLAN.sessions[PLAN.sessions.length-1].date : null;
    h += cbPlanCard({ icn:'run', name:planRaceTitle(), chip:t('planActive'),
      sub:t('comboRun')+' · '+tp('planWeeksN',wk)+' · '+tp('psDaysPerWeek',(P.days||[]).length)+(last?' · '+t('planUntil')+' '+fmtDate(last):''),
      acts:[[V,"sportTab='run';runSub='ikorun';renderSport()"],[M,'openPlanSetup()'],[D,'delRunPlan()','bad']] });
  }
  if(STRENGTH){
    h += cbPlanCard({ icn:'dumbbell', mu:true, name:t('strengthWord')+' · '+tp('comboPerWeek',STRENGTH.perWeek), chip:t('planActive'),
      sub:t('comboMuscu')+' · '+tp('planWeeksN',STRENGTH.weeks)+' · '+(STRENGTH.linkedRun?t('comboLinked'):t('planIndependent')),
      acts:[[V,'openStrengthPlan()'],[M,'editStrength()'],[D,'delStrength()','bad']] });
  }
  CUSTOM.forEach(function(p){
    const isM = p.kind==='muscu';
    h += cbPlanCard({ icn:isM?'dumbbell':'edit', mu:isM, name:p.name,
      sub:t('comboCreatedByMe')+' · '+(isM ? tp('exercisesCount',(p.ex||[]).length) : tp('planSessionsN',(p.sessions||[]).length)),
      acts: isM ? [[V,"openProg('"+p.id+"')"],[D,"delProg('"+p.id+"')",'bad']]
                : [[V,"sportTab='run';runSub='perso';openPerso('"+p.id+"')"],[D,"delPerso('"+p.id+"')",'bad']] });
  });
  if(!integrated) h += '<button class="btn" style="width:100%;margin-top:4px" onclick="openWizard()">+ '+t('comboCreate')+'</button>';
  return h;
}
function cbFullTitle(s){ const h2=$('#ovFullPlan h2'); if(h2) h2.textContent=s; }
function delRunPlan(){
  customConfirm(t('runPlanDelete'), function(){
    PLAN=null; DB.save('run_plan',null);
    if(STRENGTH){ STRENGTH.linkedRun=false; DB.save('strength_plan',STRENGTH); }
    if(P.sportMode==='integrated'){ P.sportMode='split'; DB.save('profile',P); }
    sportTab='combo'; renderSport(); toast(t('planDeletedToast'));
  }, {danger:true});
}
// le plan de muscu, semaine par semaine (séances faites, à venir, à confirmer)
function openStrengthPlan(){
  if(!STRENGTH) return;
  const tk = todayKey(), weeks = {};
  STRENGTH.sessions.forEach(function(s){ const m=cbMonday(s.date); (weeks[m]=weeks[m]||[]).push(s); });
  let h = '', n = 0;
  Object.keys(weeks).sort().forEach(function(m){ n++; h += '<div class="lab" style="margin:12px 0 6px">'+tp('weekN',n)+'</div>'+weeks[m].map(function(s){ return cbStrRowHTML(s,tk); }).join(''); });
  $('#fullPlanBody').innerHTML = h; cbFullTitle(t('strengthPlanTitle')); openOv('ovFullPlan');
}
// « Modifier » le plan de muscu : l'assistant rouvert sur la muscu, avec ses réglages actuels
function editStrength(){
  const o = (STRENGTH && STRENGTH.opts) || {};
  openWizard({ what:'muscu', days:(o.days||STRENGTH.days||[0,2,4]).slice(), perWeek:o.perWeek||STRENGTH.perWeek||2, equip:o.equip||STRENGTH.equip||'both' });
}
function delStrength(){
  customConfirm(t('strengthDelete'), function(){ STRENGTH=null; DB.save('strength_plan',null); if(P.sportMode==='integrated'){ P.sportMode='split'; DB.save('profile',P); } renderSport(); }, {danger:true});
}

/* ---------- générateur : construire, puis garder la muscu accordée au plan de course ---------- */
function strengthOpts(w){
  const lvl = (typeof LEVELS!=='undefined' && LEVELS.indexOf(P.level)>=0) ? P.level : 'Intermédiaire';
  // liée à la course : « les deux ensemble », ou muscu seule refaite dans un programme intégré
  const linked = !!PLAN && (w.what==='both' || (w.what==='muscu' && sportIntegrated()));
  // graine nouvelle à chaque génération : un nouveau plan = d'autres exercices (stable ensuite, pour le recalage)
  return { perWeek:w.perWeek, days:w.days.slice(), equip:w.equip, level:lvl, linked:linked,
    seed:((Date.now() ^ Math.floor(Math.random()*1e9))>>>0) % 1000000 };
}
function strengthRun(o, startDate){
  return strengthBuild({
    perWeek:o.perWeek, days:o.days, equip:o.equip, level:o.level, seed:o.seed,
    raceDate:(o.linked && P.compDate)?P.compDate:null,
    runSessions:(o.linked && PLAN)?PLAN.sessions:null,
    startDate:startDate, catalog:allExercises(), exFactory:ex,
    titles:{ UPPER:t('strUpper'), LOWER:t('strLower'), FULL:t('strFull') }
  });
}
// Reconstruit les séances À VENIR à partir du plan de course actuel ; garde le passé et ce qui est fait.
function strengthRelink(){
  if(!STRENGTH || !STRENGTH.linkedRun || !STRENGTH.opts || !PLAN) return false;
  const tk = todayKey(), r = strengthRun(Object.assign({}, STRENGTH.opts, {linked:true}), tk);
  if(r.err) return false;
  const kept = STRENGTH.sessions.filter(function(s){ return s.done || s.date<tk; });
  const perWk = {}; kept.forEach(function(s){ const m=cbMonday(s.date); perWk[m]=(perWk[m]||0)+1; });
  const days = new Set(kept.map(function(s){ return s.date; }));
  let uid = STRENGTH.sessions.reduce(function(a,s){ return Math.max(a, +String(s.id).replace(/\D/g,'')||0); }, 0);
  const fresh = r.plan.sessions.filter(function(s){
    if(days.has(s.date)) return false;
    const m = cbMonday(s.date); if((perWk[m]||0) >= STRENGTH.perWeek) return false;
    perWk[m] = (perWk[m]||0)+1; return true;
  }).map(function(s){ return Object.assign({}, s, { id:'st'+(++uid) }); });
  STRENGTH.sessions = kept.concat(fresh).sort(function(a,b){ return a.date<b.date?-1:1; });
  STRENGTH.weeks = Math.max(STRENGTH.weeks||0, r.plan.weeks); STRENGTH.raceDate = r.plan.raceDate;
  DB.save('strength_plan', STRENGTH);
  try{ if(typeof injActive==='function' && injActive()) injApplyAll(true); }catch(e){}   // blessure en cours : les nouvelles séances reprennent leur rééducation
  return true;
}
// Après chaque ajustement du plan de course (adPersist) : si une séance de jambes à venir tombe
// désormais le jour ou la veille d'une séance dure, on recale la muscu.
function strengthCheckRun(){
  if(!STRENGTH || !STRENGTH.linkedRun || !PLAN) return;
  const tk = todayKey();
  const v = validateStrengthPlan({ sessions:STRENGTH.sessions.filter(function(s){ return !s.done && s.date>=tk; }), perWeek:STRENGTH.perWeek, raceDate:STRENGTH.raceDate }, PLAN.sessions);
  if(!v.ok && v.errors.some(function(e){ return /^legsBeforeHard|^afterRace/.test(e); })) strengthRelink();
}
// Nouveau plan de course (generatePlan) : la muscu liée suit le nouveau calendrier.
function strengthAfterRunPlan(){ try{ if(STRENGTH && STRENGTH.linkedRun) strengthRelink(); }catch(e){ console.error('[IKORUN] strengthAfterRunPlan', e); } }

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
function openWizard(preset){
  // jours de course : ceux du plan (P.days, 0 = dimanche comme Date.getDay) ; jours de muscu : 0 = lundi
  // runNew : avec un plan de course existant, « Nouveau » (par défaut) ou « Garder l'actuel »
  wizAfterRun = false;
  wiz = Object.assign({ what:'both', how:'gen', days:wizDefaultDays(), perWeek:2, equip:'both', runNew:true }, preset||{});
  const h2 = $('#ovWizard h2'); if(h2) h2.textContent = t('wizTitle');
  renderWizard(); openOv('ovWizard');
}
function wizSet(k,v){ wiz[k]=v; if(k==='what' && (v==='both'||v==='split')) wiz.how='gen'; renderWizard(); }
function wizDay(i){ const a=wiz.days, p=a.indexOf(i); if(p>=0) a.splice(p,1); else if(a.length>=3){ toast(t('wizMax3')); return; } else a.push(i); a.sort(); wiz.perWeek=Math.max(1,a.length); renderWizard(); }
function wizOpt(sel,key,title,sub,icn,badge){
  return '<div class="ik-opt'+(sel?' sel':'')+'" onclick="'+key+'"><div class="ik-opt-ic">'+ICN(icn,20)+'</div><div style="flex:1"><b>'+title+'</b><span class="s">'+sub+'</span></div>'+(badge?'<em class="ik-tag">'+badge+'</em>':'')+'</div>';
}
function renderWizard(){
  const w = wiz, L = t('dowShort').split(','), two = (w.what==='both'||w.what==='split');
  let h = wizReplaceNote(w) + '<div class="hv7-sec-lab" style="margin:4px 0 8px">'+t('wizWhat')+'</div>'+
    wizOpt(w.what==='both',"wizSet('what','both')",t('wizBoth'),t('wizBothSub'),'plus',t('wizAdvised'))+
    wizOpt(w.what==='split',"wizSet('what','split')",t('wizSplit'),t('wizSplitSub'),'shuffle')+
    wizOpt(w.what==='run',"wizSet('what','run')",t('wizRun'),t('wizRunSub'),'run')+
    wizOpt(w.what==='muscu',"wizSet('what','muscu')",t('wizMuscu'),t('wizMuscuSub'),'dumbbell');
  if(two && PLAN){
    h += '<div class="hv7-sec-lab" style="margin:14px 0 8px">'+t('wizRunPlanLab')+'</div><div class="ik-seg">'+
      '<div class="'+(w.runNew?'on':'')+'" onclick="wizSet(\'runNew\',true)">'+t('wizRunNew')+'</div>'+
      '<div class="'+(!w.runNew?'on':'')+'" onclick="wizSet(\'runNew\',false)">'+t('wizRunKeep')+'</div></div>';
  }
  if(w.how==='gen' && w.what!=='run'){
    h += '<div class="hv7-sec-lab" style="margin:14px 0 8px">'+t(two?'wizDaysMuscu':'wizDays')+'</div><div class="ik-days">'+
      L.map(function(l,i){ return '<div class="'+(w.days.indexOf(i)>=0?'on':'')+'" onclick="wizDay('+i+')">'+escHtml(l)+'</div>'; }).join('')+'</div>'+
      '<div class="ik-wiz-hint">'+tp('wizDaysCount',w.days.length)+'</div>'+
      '<div class="ik-wiz-lab">'+t('wizEquip')+'</div><div class="ik-seg">'+
      [['salle','wizEquipGym'],['maison','wizEquipHome'],['both','wizEquipBoth']].map(function(e){
        return '<div class="'+(w.equip===e[0]?'on':'')+'" onclick="wizSet(\'equip\',\''+e[0]+'\')">'+t(e[1])+'</div>'; }).join('')+'</div>';
  }
  if(w.what==='both') h += '<div class="ik-note"><b>'+t('wizHowTitle')+'</b><span>'+t('wizHowText')+'</span></div>';
  if(w.what==='split') h += '<div class="ik-note"><span>'+t('wizSplitNote')+'</span></div>';
  const runFirst = (w.what==='run' && w.how==='gen') || (two && (!PLAN || w.runNew));
  if(runFirst) h += '<div class="ik-note"><span>'+t(w.what==='run'?'wizRunSetupNote':'wizNeedRun')+'</span></div>';
  h += '<button class="btn" style="width:100%;margin-top:14px" onclick="wizGenerate()">'+t(runFirst ? 'wizNeedRunBtn' : (wizHasPlans(w)?'wizReplaceBtn':'wizGenerate'))+'</button>'+
    '<div style="display:flex;justify-content:center;gap:18px;flex-wrap:wrap;margin-top:12px;font-size:13px;color:var(--e2);font-weight:600">'+
      // V4.9 : l'étape « 2 · Comment ? » (deux grosses cartes) devient un simple lien discret, un seul choix à la fois à l'écran
      (two?'':'<span onclick="wizSet(\'how\',\''+(w.how==='gen'?'self':'gen')+'\')">'+t(w.how==='gen'?'wizSelf':'wizGen')+'</span>')+
      '<span onclick="closeOv(\'ovWizard\');sportTab=\'run\';runSub=\'perso\';renderSport()">'+t('wizFollowExisting')+'</span></div>';
  $('#wizBody').innerHTML = h;
}
function wizCreateRun(){ wizAfterRun = true; closeOv('ovWizard'); sportTab='run'; runSub='ikorun'; renderSport(); openPlanSetup(); }
// Appelée depuis generatePlan() quand l'utilisateur est venu de l'assistant (les deux, ensemble ou séparément).
function wizResume(){ if(!wizAfterRun) return; wizAfterRun=false; if(wiz && PLAN){ wiz.runNew=false; wizGenerate(); } }
// ce que l'assistant va remplacer, dit avant de générer
function wizHasPlans(w){ return (w.what!=='muscu' && !!PLAN && (w.what==='run' || w.runNew)) || (w.what!=='run' && !!STRENGTH); }
function wizReplaceNote(w){
  const r = [];
  if(PLAN && (w.what==='run' || ((w.what==='both'||w.what==='split') && w.runNew))) r.push(planRaceTitle());
  if(STRENGTH && w.what!=='run') r.push(t('strengthWord')+' · '+tp('comboPerWeek',STRENGTH.perWeek));
  return r.length ? '<div class="ik-note" style="margin:0 0 12px"><span>'+tp('wizWillReplace', escHtml(r.join(' + ')))+'</span></div>' : '';
}

function wizGenerate(){
  const w = wiz; if(!w) return;
  const two = (w.what==='both'||w.what==='split');
  if(!two && w.how==='self'){
    closeOv('ovWizard'); if(P.sportMode!=='integrated'){ P.sportMode='split'; DB.save('profile',P); }
    if(w.what==='run'){ sportTab='run'; runSub='perso'; renderSport(); addPersoPlan(); }
    else { sportTab='muscu'; renderSport(); openCreate(); }
    return;
  }
  if(w.what!=='run' && !w.days.length){ toast(t('chooseAtLeastOneDay')); return; }
  if(w.what!=='run') w.perWeek = Math.max(1, Math.min(3, w.days.length));   // les jours choisis fixent le nombre de séances
  // Running seul : nouveau plan de course (configuration pré-remplie) ; la muscu et le mode ne bougent pas
  if(w.what==='run'){ if(!STRENGTH){ P.sportMode='split'; } DB.save('profile',P); closeOv('ovWizard'); sportTab=sportIntegrated()?'combo':'run'; runSub='ikorun'; renderSport(); openPlanSetup(); return; }
  // les deux : d'abord un NOUVEAU plan de course (ou aucun encore), puis l'assistant reprend tout seul pour la muscu
  if(two && (!PLAN || w.runNew)){ wizCreateRun(); return; }
  const o = strengthOpts(w);
  // séparé : muscu indépendante, commence aujourd'hui ; ensemble : calée sur le plan de course
  const r = strengthRun(o, todayKey());
  if(r.err){ toast(t('strengthErr_'+r.err)||r.err); return; }
  STRENGTH = r.plan; STRENGTH.opts = o; DB.save('strength_plan', STRENGTH);
  if(w.what==='both') P.sportMode='integrated'; else if(w.what==='split' || !PLAN) P.sportMode='split';   // muscu seule : le mode reste
  DB.save('profile', P);
  const skipped = (STRENGTH.warnings||[]).filter(function(x){ return x.indexOf('skipped:')===0; }).length;
  toast(tp('strengthGenerated', STRENGTH.sessions.length, STRENGTH.weeks)+(skipped?' '+tp('strengthSkipped', skipped):''));
  closeOv('ovWizard'); sportTab='combo'; burst(); renderSport();
}
