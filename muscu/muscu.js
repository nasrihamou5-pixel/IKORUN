/* ============================================================================
   IKORUN — MUSCULATION (muscu/muscu.js) — V4.14.0
   Logique reprise de KORE 3.110 et posée sur la séance en direct d'IKORUN (LIVE) :
   · historique réel des séries par exercice (PREFS.exSets) : colonne « Précédent » et
     pré-remplissage avec ce que tu as vraiment fait la dernière fois ;
   · objectif de la prochaine séance (double progression : +1 rep jusqu'au haut de la
     fourchette, puis + charge et on repart du bas) et bouton « Remplir » ;
   · types de série (échauffement, dégressive, échec) et RPE par série ;
   · superset : l'exercice suivant du groupe s'enchaîne sans repos, le repos vient à la fin du tour ;
   · records sur le 1RM estimé (Epley) des séries réellement faites, annoncés en direct ;
   · générateur de programme (objectif, niveau, matériel, jours, durée) et programmes tout faits.
   Script classique : partage l'environnement global d'app.js (P, PREFS, CUSTOM, LIVE, t, tp…).
   ============================================================================ */

/* ---------- petit menu de choix (même matière que les autres fenêtres) ---------- */
function ikPick(title,opts,sub,grid){
  const old=document.getElementById('ikPickOv'); if(old) old.remove();
  const ov=document.createElement('div'); ov.className='ov on'; ov.id='ikPickOv'; ov.style.zIndex=topZ();
  let h='<div class="ov-card ik-pick"><div class="card-t" style="justify-content:center;margin-bottom:'+(sub?'4px':'12px')+'">'+title+'</div>';
  if(sub) h+='<div class="ik-pick-sub">'+sub+'</div>';
  if(grid) h+='<div class="ik-pick-grid c'+grid+'">'+opts.map((o,i)=>'<div class="ik-tile'+(o.on?' on':'')+'" role="button" data-pk="'+i+'">'+(o.ic?'<span class="ik-tile-ic">'+o.ic+'</span>':'')+'<b>'+o.label+'</b></div>').join('')+'</div>';
  else h+='<div class="ik-grp ik-pick-l">'+opts.map((o,i)=>'<div class="ik-row ik-link'+(o.on?' on':'')+(o.danger?' bad':'')+'" role="button" data-pk="'+i+'">'+(o.ic?'<span class="ik-pick-ic">'+o.ic+'</span>':'')+'<div class="ik-row-t"><b>'+o.label+'</b>'+(o.sub?'<small>'+o.sub+'</small>':'')+'</div>'+(o.on?ICN('check',16,'var(--e)'):'')+'</div>').join('')+'</div>';
  h+='<button class="btn btn-soft" data-pk="x">'+t('cancelLab')+'</button></div>';
  ov.innerHTML=h;
  ov.addEventListener('click',e=>{
    const b=e.target.closest('[data-pk]');
    if(!b){ if(e.target===ov) ov.remove(); return; }
    ov.remove(); if(b.dataset.pk==='x') return;
    const o=opts[+b.dataset.pk]; if(o&&o.cb) o.cb(); try{ haptic(); }catch(_){}
  });
  document.body.appendChild(ov);
}

/* ---------- historique réel des séries ---------- */
function ikExHist(name){ return (PREFS.exSets&&PREFS.exSets[name])||[]; }
function ikExLast(name){ const h=ikExHist(name); return h.length?h[h.length-1]:null; }
function ikSaveExSets(live){
  if(!PREFS.exSets) PREFS.exSets={};
  live.prog.ex.forEach((e,i)=>{
    const st=live.state[i]; if(!st||!st.log) return;
    const sets=st.log.map((s,j)=>st.sets[j]?{kg:+s.kg||0,reps:+s.reps||0,t:s.t||undefined,rpe:s.rpeU?s.rpe:undefined}:null).filter(Boolean);
    if(!sets.length) return;
    const L=PREFS.exSets[e.name]||(PREFS.exSets[e.name]=[]);
    L.push({date:todayKey(),sets}); if(L.length>20) L.splice(0,L.length-20);
  });
}
// fourchette de reps d'un exercice : « 8-12 » -> [8,12], « 10 » -> [10,10]
function ikRepRange(e){
  const m=String(e.reps||'').match(/(\d+)\s*[-–à]\s*(\d+)/); if(m) return [+m[1],+m[2]];
  const n=parseInt(e.reps); return n>0?[n,n]:[8,12];
}
function ikIsBodyweight(name){ const f=(typeof exMeta==='function')?exMeta(name):null; return !!(f&&/Poids du corps/.test(f.equip||'')); }
function ikIsLower(name){ const f=(typeof exMeta==='function')?exMeta(name):null; return !!(f&&(f.primary||[]).some(m=>/Quadriceps|Ischios|Fessiers/.test(m))); }
// pas de charge : 2 kg aux haltères, 5 kg sur les gros mouvements du bas du corps, 2,5 kg sinon
function ikLoadStep(name){ const f=(typeof exMeta==='function')?exMeta(name):null, eq=(f&&f.equip)||''; if(/Haltères|Kettlebell/.test(eq)) return 2; return (ikIsLower(name)&&/Barre|Machine/.test(eq))?5:2.5; }
/* Objectif de la prochaine séance (double progression, repris de KORE) :
   toutes les séries de travail au haut de la fourchette -> on ajoute de la charge et on repart du bas ;
   au-dessus du bas -> +1 rep ; en dessous -> même charge, viser le bas sur chaque série. */
function ikExObjective(e){
  const last=ikExLast(e.name); if(!last) return null;
  const work=last.sets.filter(s=>s.t!=='w'&&(+s.reps||0)>0); if(!work.length) return null;
  const [lo,hi]=ikRepRange(e), pc=ikIsBodyweight(e.name);
  const W=Math.max(...work.map(s=>+s.kg||0)), top=work.filter(s=>(+s.kg||0)===W), rmin=Math.min(...top.map(s=>+s.reps||0));
  if(pc&&!W){
    if(rmin>=hi) return {kg:0,reps:hi+1,up:true,txt:tp('objRepsUp',hi+1)};
    const r=Math.min(hi,rmin+1); return {kg:0,reps:r,up:false,txt:tp('objRepsEach',r)};
  }
  const inc=ikLoadStep(e.name);
  if(rmin>=hi) return {kg:Math.round((W+inc)*4)/4,reps:lo,up:true,txt:tp('objLoadUp',fmtKgI(W+inc),lo+(hi>lo?'-'+hi:''),fmtKgI(inc))};
  if(rmin>=lo){ const r=Math.min(hi,rmin+1); return {kg:W,reps:r,up:false,txt:tp('objPlusRep',fmtKgI(W),r)}; }
  return {kg:W,reps:lo,up:false,txt:tp('objHold',fmtKgI(W),lo)};
}
function fmtKgI(v){ v=Math.round((+v||0)*100)/100; return String(v).replace('.',curLang()==='en'?'.':','); }
// valeurs de départ d'une série de la séance : la même série la dernière fois, sinon la routine
function ikStartSet(e,j){
  const last=ikExLast(e.name), o=ikExObjective(e);
  if(o && (!last||!last.sets[j]||last.sets[j].t!=='w')) return {kg:o.kg||(last&&last.sets[j]?last.sets[j].kg:(e.weight||0)),reps:o.reps};
  if(last&&last.sets[j]) return {kg:last.sets[j].kg,reps:last.sets[j].reps,t:last.sets[j].t};
  return null;
}
function ikPrevCell(e,j){
  const last=ikExLast(e.name), s=last&&last.sets[j];
  if(!s) return '—';
  return (s.kg?fmtKgI(s.kg)+'×':'')+s.reps;
}

/* ---------- 1RM estimé et records ---------- */
function ikE1(kg,reps){ kg=+kg||0; reps=+reps||0; if(!kg||!reps) return 0; return reps<=1?kg:kg*(1+reps/30); }
function ikBestE1(name){ return (PREFS.e1rm&&PREFS.e1rm[name])||null; }
// record battu en direct (série de travail cochée)
function ikLivePR(i,j){
  try{
    const e=LIVE.prog.ex[i], s=LIVE.state[i].log[j]; if(!s||s.t==='w') return;
    const best=ikBestE1(e.name), v=ikE1(s.kg,s.reps);
    if(best&&v>best.e1+0.01&&!LIVE.state[i]._prSeen){ LIVE.state[i]._prSeen=1; toast(tp('livePrToast',trExName(e.name),fmtKgI(s.kg)+' × '+s.reps)); try{ sfx('finish'); }catch(_){} }
  }catch(_){}
}
// fin de séance : records sur le 1RM estimé des séries réellement faites (avant : la dernière charge tapée, cochée ou non)
function ikRecordsAfter(live){
  if(!PREFS.e1rm) PREFS.e1rm={};
  const out=[];
  live.prog.ex.forEach((e,i)=>{
    const st=live.state[i]; let best=null;
    (st.log||[]).forEach((s,j)=>{ if(!st.sets[j]||s.t==='w') return; const v=ikE1(s.kg,s.reps); if(v>0&&(!best||v>best.e1)) best={e1:v,kg:+s.kg,reps:+s.reps}; });
    if(!best) return;
    const prev=PREFS.e1rm[e.name];
    if(!prev||best.e1>prev.e1+0.01){ PREFS.e1rm[e.name]=Object.assign({date:todayKey()},best); out.push({name:e.name,kg:best.kg,reps:best.reps,e1:best.e1,first:!prev}); }
    if(typeof MUSCU_PR!=='undefined'){ const mx=Math.max(0,...(st.log||[]).filter((s,j)=>st.sets[j]&&s.t!=='w').map(s=>+s.kg||0)); if(mx>(MUSCU_PR[e.name]||0)) MUSCU_PR[e.name]=mx; }
  });
  return out;
}

/* ---------- types de série et RPE ---------- */
const IK_SET_TYPES={w:['É','setTypeWarm'],d:['D','setTypeDrop'],f:['F','setTypeFail']};
function ikSetBadge(s,j){
  const ty=s&&s.t&&IK_SET_TYPES[s.t];
  return ty?'<b class="st-l st-'+s.t+'">'+(curLang()==='en'?({w:'W',d:'D',f:'F'})[s.t]:ty[0])+'</b>':(j+1);
}
function ikSetMenu(i,j){
  const s=LIVE.state[i].log[j]; if(!s) return;
  const set=ty=>{ if(ty) s.t=ty; else delete s.t; persistLive(); ikReLiveEx(i); };
  ikPick(tp('setNumLab',j+1),[
    {label:t('setTypeNormal'),on:!s.t,cb:()=>set('')},
    {label:t('setTypeWarm'),sub:t('setTypeWarmSub'),on:s.t==='w',ic:'<b class="st-l st-w">'+(curLang()==='en'?'W':'É')+'</b>',cb:()=>set('w')},
    {label:t('setTypeDrop'),sub:t('setTypeDropSub'),on:s.t==='d',ic:'<b class="st-l st-d">D</b>',cb:()=>set('d')},
    {label:t('setTypeFail'),sub:t('setTypeFailSub'),on:s.t==='f',ic:'<b class="st-l st-f">F</b>',cb:()=>set('f')},
    {label:'RPE'+(s.rpe&&s.rpeU?' · '+String(s.rpe).replace('.',','):''),sub:t('rpeSetSub'),cb:()=>ikRpeMenu(i,j)}
  ]);
}
function ikRpeMenu(i,j){
  const s=LIVE.state[i].log[j];
  const help={10:'rpeH10',9:'rpeH9',8:'rpeH8',7:'rpeH7',6:'rpeH6'};
  ikPick('RPE',[{label:t('noneLab'),on:!s.rpeU,cb:()=>{ delete s.rpeU; persistLive(); ikReLiveEx(i); }}].concat([10,9.5,9,8.5,8,7.5,7,6].map(v=>({label:String(v).replace('.',','),sub:help[v]?t(help[v]):'',on:!!s.rpeU&&s.rpe===v,cb:()=>{ s.rpe=v; s.rpeU=1; persistLive(); ikReLiveEx(i); }}))));
}
// redessine seulement le corps de l'exercice ouvert (plus léger qu'un renderLive complet)
function ikReLiveEx(i){ const b=document.getElementById('exBody'+i); if(b&&!b.dataset.lazy){ b.innerHTML=liveExBodyHTML(i); } else renderLive(); }

/* ---------- remplir avec l'objectif ---------- */
function ikFillObjective(i){
  const e=LIVE.prog.ex[i], st=LIVE.state[i], o=ikExObjective(e); if(!o) return;
  let n=0;
  st.log.forEach((s,j)=>{ if(st.sets[j]||s.t==='w') return; if(o.kg) s.kg=o.kg; s.reps=o.reps; n++; });
  persistLive(); ikReLiveEx(i); try{ haptic(); }catch(_){}
  toast(n?t('objFilledToast'):t('objNothingToast'));
}

/* ---------- superset ---------- */
function ikSupersetToggle(i){
  const ex=LIVE.prog.ex;
  if(i>=ex.length-1 && !ex[i].ss){ toast(t('ssNeedNext')); return; }
  ex.forEach((e,k)=>{ if(ex[k]===ex[i]) ex[k]=Object.assign({},e); });
  const a=ex[i];
  if(a.ss){ const g=a.ss; ex.forEach((e,k)=>{ if(e.ss===g){ ex[k]=Object.assign({},e); delete ex[k].ss; } }); toast(t('ssRemoved')); }
  else { const b=ex[i+1]; const g=b.ss||('s'+Date.now()); ex[i]=Object.assign({},a,{ss:g}); ex[i+1]=Object.assign({},b,{ss:g}); toast(tp('ssLinked',trExName(a.name),trExName(b.name))); }
  // retenu dans la routine (programme perso) : le superset revient à la prochaine séance
  try{ const cp=CUSTOM.find(p=>p.id===LIVE.prog.id); if(cp&&cp.ex.length===ex.length&&cp.ex.every((x,k)=>x.name===ex[k].name)){ cp.ex=cp.ex.map((x,k)=>{ const y=Object.assign({},x); if(ex[k].ss) y.ss=ex[k].ss; else delete y.ss; return y; }); saveAll(); } }catch(_){}
  persistLive(); renderLive();
}
// après une série cochée : superset -> on enchaîne ; sinon repos (rendu par toggleSet)
// retourne true si le repos doit être sauté (l'exercice suivant du superset attend)
function ikAfterSet(i,j){
  ikLivePR(i,j);
  const e=LIVE.prog.ex[i], st=LIVE.state[i];
  if(e.ss){
    const grp=LIVE.prog.ex.map((x,k)=>k).filter(k=>LIVE.prog.ex[k].ss===e.ss);
    const done=k=>LIVE.state[k].sets.filter(Boolean).length;
    const n=done(i), pos=grp.indexOf(i);
    const next=grp.slice(pos+1).concat(grp.slice(0,pos)).find(k=>done(k)<n&&done(k)<LIVE.state[k].sets.length);
    if(next!=null){ toast(tp('ssNext',trExName(LIVE.prog.ex[next].name))); ikOpenLiveEx(next); return {skipRest:true}; }
    return {skipRest:false,rest:Math.max(...grp.map(k=>LIVE.prog.ex[k].rest||90))};
  }
  // exercice terminé : on ouvre le suivant pas encore fini
  if(st.sets.every(Boolean)){
    const nx=LIVE.prog.ex.findIndex((x,k)=>k>i&&!LIVE.state[k].sets.every(Boolean));
    if(nx>=0) setTimeout(()=>{ if(LIVE&&liveOpenEx!==nx) ikOpenLiveEx(nx); },650);
  }
  return {skipRest:false};
}
function ikOpenLiveEx(k){
  if(liveOpenEx===k) return;
  toggleLiveEx(k);
  setTimeout(()=>{ const c=document.querySelector('.ex-swipe-card[data-i="'+k+'"]'); if(c) try{ c.scrollIntoView({behavior:'smooth',block:'start'}); }catch(_){} },140);
}

/* ============================================================================
   GÉNÉRATEUR DE PROGRAMME (KORE) — objectif, niveau, matériel, jours, durée
   ============================================================================ */
const IK_SPLITS={
  1:[{k:'FULL',g:['jambes','pec','dos','epaule','biceps','abdos']}],
  2:[{k:'UPPER',g:['pec','dos','epaule','triceps','biceps','pec']},{k:'LOWER',g:['jambes','fessiers','jambes','mollets','abdos','jambes']}],
  3:[{k:'PUSH',g:['pec','pec','epaule','triceps','triceps','epaule']},{k:'PULL',g:['dos','dos','biceps','biceps','avantbras','dos']},{k:'LEGS',g:['jambes','jambes','fessiers','mollets','abdos','jambes']}],
  4:[{k:'CHEST_TRI',g:['pec','pec','pec','triceps','triceps','triceps']},{k:'BACK_BI',g:['dos','dos','dos','biceps','biceps','avantbras']},{k:'LEGS_GLUTES',g:['jambes','jambes','jambes','fessiers','fessiers','mollets']},{k:'SHOULDERS_ABS',g:['epaule','epaule','epaule','epaule','abdos','abdos']}],
  5:[{k:'PUSH',g:['pec','pec','epaule','epaule','triceps','triceps']},{k:'PULL',g:['dos','dos','dos','biceps','biceps','avantbras']},{k:'LEGS',g:['jambes','jambes','fessiers','fessiers','mollets','abdos']},{k:'UPPER',g:['pec','dos','epaule','biceps','triceps','abdos']},{k:'LOWER',g:['jambes','fessiers','jambes','mollets','abdos','fessiers']}],
  6:[{k:'PUSH',x:'A',g:['pec','pec','epaule','triceps','triceps','epaule']},{k:'PULL',x:'A',g:['dos','dos','biceps','biceps','avantbras','dos']},{k:'LEGS',x:'A',g:['jambes','jambes','fessiers','mollets','abdos','jambes']},
     {k:'PUSH',x:'B',g:['pec','epaule','epaule','pec','triceps','triceps']},{k:'PULL',x:'B',g:['dos','dos','biceps','avantbras','biceps','abdos']},{k:'LEGS',x:'B',g:['jambes','fessiers','jambes','fessiers','mollets','abdos']}]
};
const IK_MG2GROUPS={pec:['Pectoraux'],dos:['Dos','Trapèzes'],epaule:['Épaules'],biceps:['Biceps'],triceps:['Triceps'],jambes:['Quadriceps','Ischios'],fessiers:['Fessiers'],mollets:['Mollets'],abdos:['Abdominaux'],avantbras:['Avant-bras']};
const IK_EQUIP_TIERS={poids:['Poids du corps','Élastique'],maison:['Poids du corps','Élastique','Haltères','Kettlebell'],limitee:['Poids du corps','Élastique','Haltères','Kettlebell','Barre'],complete:null};
const IK_COMPOUND=/squat|soulevé|développé|rowing|traction|dips|fente|presse|hip thrust|thruster|clean|tirage|pompes|press|row|deadlift|pull-?up|chin|lunge|step|good morning|swing/i;
function ikSetsReps(goal,compound,level){
  let sr;
  if(goal==='force') sr=compound?{sets:5,reps:'3-5'}:{sets:3,reps:'8-10'};
  else if(goal==='seche') sr=compound?{sets:3,reps:'12-15'}:{sets:3,reps:'12-20'};
  else if(goal==='forme') sr={sets:3,reps:'10-12'};
  else sr=compound?{sets:4,reps:'6-10'}:{sets:3,reps:'10-12'};
  if(level==='avance'&&compound) sr={sets:sr.sets+1,reps:sr.reps};
  if(level==='debutant'&&sr.sets>4) sr={sets:4,reps:sr.reps};
  return sr;
}
function ikGenMuscu(o){
  const goal=o.goal||'muscle', level=o.level||'debutant', eqOk=IK_EQUIP_TIERS[o.equip||'complete'];
  const per={courte:4,moyenne:6,longue:8}[o.duration]||6, nDays=Math.min(6,Math.max(1,o.days||3));
  const tpl=IK_SPLITS[nDays];
  const lvlRank={'Débutant':0,'Intermédiaire':1,'Avancé':2}, maxLv=level==='debutant'?1:2;
  const all=allExercises().filter(x=>(!x.kind||x.kind==='force')&&(!eqOk||eqOk.includes(x.equip))&&(lvlRank[x.level]==null||lvlRank[x.level]<=maxLv));
  const jambesTurn={i:0};
  return tpl.map(sess=>{
    let groups=[]; while(groups.length<per) groups=groups.concat(sess.g); groups=groups.slice(0,per);
    const used=new Set(), ex=[];
    groups.forEach((mg,idx)=>{
      let gs=IK_MG2GROUPS[mg]||[];
      if(mg==='jambes'){ gs=[gs[jambesTurn.i++%2]].concat(gs); }
      const wantC=idx<2;
      let pool=[];
      gs.forEach(g=>{ all.forEach(x=>{ if(x.group===g&&!used.has(x.name)) pool.push(x); }); });
      if(!pool.length) return;
      const pick=(wantC&&pool.find(x=>IK_COMPOUND.test(x.name)))||pool.find(x=>!IK_COMPOUND.test(x.name))||pool[0];
      used.add(pick.name);
      const sr=ikSetsReps(goal,wantC&&IK_COMPOUND.test(pick.name),level);
      ex.push(Object.assign(ex_(pick.name,sr.sets,sr.reps),{rest:goal==='force'&&wantC?180:goal==='seche'?60:90}));
    });
    return {key:sess.k,suffix:sess.x||'',ex};
  });
}
function ex_(name,sets,reps){ return (typeof ex==='function')?ex(name,sets,reps):{name,sets,reps}; }
let ikGen={goal:'muscle',level:'debutant',equip:'complete',days:3,duration:'moyenne'};
function openMuscuGen(){ renderMuscuGen(); openOv('ovProg'); }
function renderMuscuGen(){
  $('#ovProgTitle').textContent=t('genTitle');
  const seg=(key,vals)=>'<div class="seg-ctrl sub">'+vals.map(([v,k])=>'<div class="seg-btn'+(ikGen[key]===v?' on':'')+'" role="button" onclick="ikGen.'+key+'='+JSON.stringify(v).replace(/"/g,'&quot;')+';renderMuscuGen()">'+t(k)+'</div>').join('')+'</div>';
  let h='<p class="ap-hint" style="margin:0 2px 14px">'+t('genIntro')+'</p>';
  h+='<div class="lab ap-lab">'+t('genGoal')+'</div><div class="ik-grp">'+[['muscle','genGoalMuscle','genGoalMuscleSub'],['force','genGoalForce','genGoalForceSub'],['seche','genGoalCut','genGoalCutSub'],['forme','genGoalFit','genGoalFitSub']].map(([v,k,s])=>'<div class="ik-row ik-link'+(ikGen.goal===v?' on':'')+'" role="button" onclick="ikGen.goal=\''+v+'\';renderMuscuGen()"><div class="ik-row-t"><b>'+t(k)+'</b><small>'+t(s)+'</small></div>'+(ikGen.goal===v?ICN('check',16,'var(--e)'):'')+'</div>').join('')+'</div>';
  h+='<div class="lab ap-lab">'+t('genLevel')+'</div>'+seg('level',[['debutant','lvlBeginner'],['intermediaire','lvlIntermediate'],['avance','lvlAdvanced']]);
  h+='<div class="lab ap-lab">'+t('genEquip')+'</div>'+seg('equip',[['poids','genEqBody'],['maison','genEqHome'],['limitee','genEqBar'],['complete','genEqGym']]);
  h+='<div class="lab ap-lab">'+t('genDays')+'</div><div class="seg-ctrl sub">'+[1,2,3,4,5,6].map(n=>'<div class="seg-btn'+(ikGen.days===n?' on':'')+'" role="button" onclick="ikGen.days='+n+';renderMuscuGen()">'+n+'</div>').join('')+'</div>';
  h+='<div class="ap-hint" style="margin:8px 2px 0">'+t('genSplit_'+ikGen.days)+'</div>';
  h+='<div class="lab ap-lab">'+t('genDuration')+'</div>'+seg('duration',[['courte','genDurShort'],['moyenne','genDurMid'],['longue','genDurLong']]);
  // aperçu
  const prev=ikGenMuscu(ikGen);
  h+='<div class="lab ap-lab">'+t('genPreview')+'</div><div class="ik-grp">'+prev.map(s=>'<div class="ik-row"><div class="ik-row-t"><b>'+t('gen_'+s.key)+(s.suffix?' '+s.suffix:'')+'</b><small>'+s.ex.map(e=>escHtml(trExName(e.name))).join(' · ')+'</small></div></div>').join('')+'</div>';
  h+='<button class="btn" onclick="ikGenApply()">'+tp('genCreateBtn',prev.length)+'</button>';
  $('#progBody').innerHTML=h;
}
function ikGenApply(){
  const prev=ikGenMuscu(ikGen), grp='G'+Date.now();
  const obj={muscle:'Masse',force:'Force',seche:'Perte poids',forme:'Maintien'}[ikGen.goal];
  const plId='PL'+Date.now(); CUSTOM.push({id:plId,kind:'muscuplan',name:t('planDefaultName')+' '+(CUSTOM.filter(x=>x.kind==='muscuplan').length+1)});
  prev.forEach((s,i)=>{ CUSTOM.push({id:'C'+Date.now()+'_'+i,kind:'muscu',name:t('gen_'+s.key)+(s.suffix?' '+s.suffix:''),description:t('genDescAuto'),objective:obj,color:'--e',icon:'dumbbell',ex:s.ex,gen:grp,plan:plId}); });
  saveAll(); closeOv('ovProg'); renderSport(); toast(tp('genDoneToast',prev.length)); try{ sfx('finish'); }catch(_){}
}

/* ============================================================================
   PROGRAMMES TOUT FAITS (KORE) — plusieurs séances, ajoutées d'un coup à « Mes programmes »
   ============================================================================ */
function IK_PTF(){ return [
  {id:'fb-deb',lv:1,days:3,eq:'genEqGym',goal:'ptfGoalBase',s:[
    ['Full body A',[['Squat barre',3,'8-10'],['Développé couché barre',3,'8-10'],['Rowing poulie basse',3,'10-12'],['Développé haltères assis',3,'10-12'],['Planche',3,'30-45']]],
    ['Full body B',[['Soulevé de terre roumain',3,'8-10'],['Tirage vertical poulie',3,'10-12'],['Développé incliné haltères',3,'10-12'],['Presse à cuisses',3,'10-12'],['Relevé de jambes suspendu',3,'10-12']]]]},
  {id:'ppl',lv:2,days:3,eq:'genEqGym',goal:'genGoalMuscle',s:[
    ['Push',[['Développé couché barre',4,'6-8'],['Développé incliné haltères',3,'8-10'],['Développé militaire barre',3,'6-8'],['Élévations latérales',4,'12-15'],['Extension poulie corde',3,'10-12'],['Extension nuque haltère',3,'10-12']]],
    ['Pull',[['Soulevé de terre',3,'5'],['Tractions pronation',4,'6-10'],['Rowing barre buste penché',3,'8-10'],['Face Pull poulie',3,'12-15'],['Curl barre EZ',3,'8-10'],['Curl marteau',3,'10-12']]],
    ['Legs',[['Squat barre',4,'6-8'],['Soulevé de terre roumain',3,'8-10'],['Presse à cuisses',3,'10-12'],['Leg Curl allongé',3,'10-12'],['Mollets debout',4,'12-15'],['Relevé de jambes suspendu',3,'12-15']]]]},
  {id:'hb',lv:2,days:4,eq:'genEqGym',goal:'ptfGoalMuscleForce',s:[
    ['Haut A',[['Développé couché barre',4,'6-8'],['Rowing barre buste penché',4,'6-8'],['Développé haltères assis',3,'8-10'],['Tirage vertical poulie',3,'10-12'],['Curl barre EZ',3,'10-12'],['Barre au front (Skull Crusher)',3,'10-12']]],
    ['Bas A',[['Squat barre',4,'6-8'],['Soulevé de terre roumain',3,'8-10'],['Leg Extension',3,'12-15'],['Leg Curl allongé',3,'12-15'],['Mollets debout',4,'12-15']]],
    ['Haut B',[['Développé incliné haltères',4,'8-10'],['Rowing poulie basse',4,'8-10'],['Élévations latérales',4,'12-15'],['Tractions supination',3,'6-10'],['Curl marteau',3,'10-12'],['Extension poulie haute',3,'10-12']]],
    ['Bas B',[['Soulevé de terre',3,'5'],['Presse à cuisses',4,'10-12'],['Fentes marchées',3,'10-12'],['Hip Thrust barre',3,'8-12'],['Mollets assis',4,'12-15'],['Crunch poulie',3,'12-15']]]]},
  {id:'5x5',lv:2,days:3,eq:'genEqBar',goal:'genGoalForce',s:[
    ['5×5 A',[['Squat barre',5,'5'],['Développé couché barre',5,'5'],['Rowing barre buste penché',5,'5']]],
    ['5×5 B',[['Squat barre',5,'5'],['Développé militaire barre',5,'5'],['Soulevé de terre',1,'5']]]]},
  {id:'pdc',lv:1,days:3,eq:'genEqBody',goal:'genGoalFit',s:[
    ['Maison A',[['Squat poids du corps',4,'15-20'],['Pompes',4,'8-15'],['Rowing inversé (corps suspendu)',4,'8-12'],['Fentes marchées au poids du corps',3,'10-12'],['Planche',3,'30-60'],['Pont fessier',3,'15-20']]],
    ['Maison B',[['Pompes mains écartées',4,'8-15'],['Tractions pronation',4,'5-10'],['Fentes bulgares',3,'10-12'],['Dips entre bancs',3,'10-15'],['Mountain Climbers',3,'30-45'],['Relevé de jambes au sol',3,'12-15']]]]},
  {id:'halt',lv:1,days:3,eq:'genEqHome',goal:'genGoalMuscle',s:[
    ['Haltères A',[['Goblet Squat',4,'10-12'],['Développé couché haltères',4,'8-12'],['Rowing haltère unilatéral',4,'8-12'],['Développé haltères assis',3,'10-12'],['Curl haltères',3,'10-12'],['Kickback haltère',3,'12-15']]],
    ['Haltères B',[['Fentes avant',3,'10-12'],['Soulevé jambes tendues haltères',3,'10-12'],['Développé incliné haltères',3,'8-12'],['Rowing deux haltères buste penché',3,'10-12'],['Élévations latérales',3,'12-15'],['Curl marteau',3,'10-12']]]]},
  {id:'fess',lv:2,days:3,eq:'genEqGym',goal:'ptfGoalLower',s:[
    ['Fessiers A',[['Hip Thrust barre',4,'8-12'],['Squat barre',4,'8-10'],['Soulevé de terre roumain',3,'10-12'],['Abduction machine',3,'15-20'],['Kickback poulie',3,'12-15']]],
    ['Fessiers B',[['Squat fendu avec haltères',3,'10-12'],['Presse à cuisses',4,'12-15'],['Leg Curl allongé',3,'12-15'],['Pont fessier une jambe',3,'12-15'],['Mollets debout',3,'15-20']]],
    ['Fessiers C',[['Squat sumo avec haltère',3,'6-8'],['Montées sur banc avec haltères',3,'10-12'],['Leg Extension',3,'12-15'],['Marche du monstre (élastique)',3,'20'],['Crunch poulie',3,'15']]]]}
]; }
/* V4.25.0 — les programmes par défaut et les programmes tout faits deviennent de vrais programmes
   (copiés une fois dans CUSTOM, marqués def) : on peut les ouvrir, modifier, renommer, supprimer.
   « Restaurer » remet ceux qui ont été supprimés. */
// V4.25.3 : les séances de base (Poitrine & Triceps, Dos & Biceps…) sont rangées dans deux programmes
const IK_DEFSETS=[{id:'split3',days:3,lv:2,eq:'genEqGym',s:['A','B','C']},{id:'split4',days:4,lv:2,eq:'genEqGym',s:['A','D','F','E']}];
function ikDefCount(){ return IK_DEFSETS.reduce((a,p)=>a+1+p.s.length,0)+IK_PTF().reduce((a,p)=>a+1+p.s.length,0); }
function ikSeedDefaults(force){
  if(!PREFS) return;
  // séances de base restées seules (avant V4.25.3) : retirées si tu ne les as pas modifiées
  if(!PREFS.defSets){ const P0={}; PROGS_DEF().forEach(p=>{ P0['prog:'+p.id]=JSON.stringify(p.ex); });
    CUSTOM=CUSTOM.filter(x=>!(x.def&&/^prog:/.test(x.def)&&!x.plan&&P0[x.def]===JSON.stringify(x.ex)));
    PREFS.defSets=1; if(PREFS.defSeeded) force=true; }
  if(PREFS.defSeeded&&!force){ try{ DB.save('prefs',PREFS); }catch(_){} return; }
  const have=new Set(CUSTOM.filter(x=>x.def).map(x=>x.def)), PD=PROGS_DEF();
  IK_DEFSETS.forEach(d=>{ const k='set:'+d.id, pid='D_'+d.id;
    if(!have.has(k)) CUSTOM.push({id:pid,kind:'muscuplan',name:t('defSet_'+d.id),def:k});
    d.s.forEach((sid,i)=>{ const ks=k+':'+i, p=PD.find(x=>x.id===sid); if(have.has(ks)||!p) return;
      CUSTOM.push(Object.assign(JSON.parse(JSON.stringify(p)),{id:pid+'_'+i,kind:'muscu',plan:pid,def:ks})); }); });
  IK_PTF().forEach(p=>{ const k='ptf:'+p.id, pid='D_'+p.id, obj={genGoalForce:'Force',genGoalFit:'Maintien'}[p.goal]||'Masse';
    if(!have.has(k)) CUSTOM.push({id:pid,kind:'muscuplan',name:t('ptf_'+p.id),def:k});
    p.s.forEach(([title,xs],i)=>{ const ks=k+':'+i; if(have.has(ks)) return;
      CUSTOM.push({id:pid+'_'+i,kind:'muscu',name:title,description:t('ptf_'+p.id),objective:obj,color:'--e',icon:'dumbbell',ex:xs.map(([n,s,r])=>ex_(n,s,r)),plan:pid,def:ks}); }); });
  PREFS.defSeeded=1; try{ DB.save('prefs',PREFS); }catch(_){} saveAll();
}
function ikRestoreDefaults(){ ikSeedDefaults(true); renderSport(); toast(t('defRestoredToast')); }
function openPtfList(){
  $('#ovProgTitle').textContent=t('ptfTitle');
  let h='<p class="ap-hint" style="margin:0 2px 14px">'+t('ptfIntro')+'</p>';
  IK_PTF().forEach(p=>{
    const nEx=p.s.reduce((a,s)=>a+s[1].length,0), sets=p.s.reduce((a,s)=>a+s[1].reduce((b,x)=>b+x[1],0),0);
    h+='<div class="ik-grp ptf-card" role="button" onclick="openPtf(\''+p.id+'\')"><div class="ik-row ik-link"><div class="ik-row-t"><b>'+t('ptf_'+p.id)+'</b><small>'+t('ptfDesc_'+p.id)+'</small>'+
      '<div class="ptf-tags"><span>'+tp('ptfDaysWk',p.days)+'</span><span>'+t(p.eq)+'</span><span>'+t(['','lvlBeginner','lvlIntermediate','lvlAdvanced'][p.lv])+'</span><span>'+tp('ptfSessions',p.s.length)+'</span></div></div>'+ICN('chevronR',16)+'</div></div>';
  });
  $('#progBody').innerHTML=h; openOv('ovProg');
}
function openPtf(id){
  const p=IK_PTF().find(x=>x.id===id); if(!p) return;
  $('#ovProgTitle').textContent=t('ptf_'+p.id);
  let h='<p class="ap-hint" style="margin:0 2px 12px">'+t('ptfDesc_'+p.id)+'</p>';
  h+='<div class="ptf-tags" style="margin:0 2px 14px"><span>'+tp('ptfDaysWk',p.days)+'</span><span>'+t(p.eq)+'</span><span>'+t(p.goal)+'</span></div>';
  h+='<div id="ptfBody"></div>';
  p.s.forEach(([title,xs])=>{
    h+='<div class="lab ap-lab">'+escHtml(title)+' · ~'+Math.round(xs.reduce((a,x)=>a+x[1]*1.8,0))+' min</div><div class="ik-grp">'+xs.map(([n,s,r])=>'<div class="ik-row"><div style="flex:none">'+exThumb(n,42)+'</div><div class="ik-row-t"><b>'+escHtml(trExName(n))+'</b><small>'+tp('setsRepsLine',s,r)+'</small></div></div>').join('')+'</div>';
  });
  h+='<button class="btn" onclick="ikPtfAdd(\''+p.id+'\')">'+tp('ptfAddBtn',p.s.length)+'</button>';
  h+='<button class="btn btn-soft" style="margin-top:10px" onclick="openPtfList()">‹ '+t('back')+'</button>';
  $('#progBody').innerHTML=h; openOv('ovProg');
  // corps 2D : ce que le programme travaille sur une semaine
  ikLoad('anat').then(()=>{
    const box=document.getElementById('ptfBody'); if(!box) return;
    const z=ikZonesSum([].concat(...p.s.map(s=>s[1].map(x=>x[0]))));
    box.innerHTML='<div class="lab ap-lab">'+t('c2dWeekLab')+'</div>'+ikBody2DHTML(z,{compact:true})+ikZoneChips(z,8);
    ikBody2DMount(box,z,{auto:false});
  }).catch(()=>{});
}
function ikPtfAdd(id){
  const p=IK_PTF().find(x=>x.id===id); if(!p) return;
  const grp='P'+Date.now(), obj={genGoalForce:'Force',genGoalFit:'Maintien'}[p.goal]||'Masse';
  const plId='PL'+Date.now(); CUSTOM.push({id:plId,kind:'muscuplan',name:t('ptf_'+p.id)});
  p.s.forEach(([title,xs],i)=>{ CUSTOM.push({id:'C'+Date.now()+'_'+i,kind:'muscu',name:title,description:t('ptf_'+p.id),objective:obj,color:'--e',icon:'dumbbell',ex:xs.map(([n,s,r])=>ex_(n,s,r)),gen:grp,plan:plId}); });
  saveAll(); closeOv('ovProg'); renderSport(); toast(tp('genDoneToast',p.s.length)); try{ sfx('finish'); }catch(_){}
}


/* ============================================================================
   PROGRAMME › SÉANCES › EXERCICES (V4.19.0)
   Un programme (« Prise de masse ») contient ses séances (Push, Pull, Legs…), chaque séance
   contient ses exercices. Une séance est un programme de musculation ordinaire marqué plan:<id> :
   tout ce qui existait (lancer, modifier, historique, records) marche donc tel quel.
   Les programmes créés avant restent seuls, comme des programmes à une séance.
   ============================================================================ */
let curPlan=null;
function planSessions(id){ return CUSTOM.filter(p=>p.kind==='muscu'&&p.plan===id); }
// les séances générées avant la 4.19 (champ gen) sont regroupées en un programme
function ikMigratePlans(){
  try{
    const lone=CUSTOM.filter(p=>p.kind==='muscu'&&p.gen&&!p.plan); if(!lone.length) return;
    const by={}; lone.forEach(p=>{ (by[p.gen]=by[p.gen]||[]).push(p); });
    let n=CUSTOM.filter(x=>x.kind==='muscuplan').length;
    Object.keys(by).forEach(g=>{ const id='PL'+g.replace(/\D/g,'')+Math.floor(Math.random()*1000); n++;
      CUSTOM.push({id,kind:'muscuplan',name:t('planDefaultName')+' '+n}); by[g].forEach(p=>{ p.plan=id; }); });
    saveAll();
  }catch(e){}
}
// V4.25.1 : programme par défaut — jours par semaine, niveau, matériel
function ikDefPlanInfo(pl){ if(!pl||!pl.def) return null; if(/^ptf:[^:]+$/.test(pl.def)) return IK_PTF().find(p=>'ptf:'+p.id===pl.def)||null; if(/^set:[^:]+$/.test(pl.def)) return IK_DEFSETS.find(p=>'set:'+p.id===pl.def)||null; return null; }
function ikDefPlanTags(pl){ const p=ikDefPlanInfo(pl); if(!p) return '';
  return '<div class="ptf-tags def-tags"><span>'+tp('ptfDaysWk',p.days)+'</span><span>'+t(['','lvlBeginner','lvlIntermediate','lvlAdvanced'][p.lv])+'</span><span>'+t(p.eq)+'</span></div>'; }
function planCardHTML(pl){
  const ss=planSessions(pl.id), nEx=ss.reduce((a,s)=>a+(s.ex||[]).length,0);
  return '<div class="mus-card" onclick="openPlan(\''+pl.id+'\')"><div class="mus-card-b">'+
    '<div class="mus-name">'+escHtml(pl.name)+'</div>'+
    (ss.length?'<div class="mus-tags">'+ss.slice(0,5).map(s=>'<span>'+escHtml(s.name)+'</span>').join('')+(ss.length>5?'<span>+'+(ss.length-5)+'</span>':'')+'</div>':'')+
    '<div class="mus-meta">'+tp('seancesCount',ss.length)+' · '+tp('exercisesCount',nEx)+'</div>'+ikDefPlanTags(pl)+'</div>'+
    '<button class="x mus-del" onclick="event.stopPropagation();delPlan(\''+pl.id+'\')">'+ICN('trash',16)+'</button></div>';
}
function openCreatePlan(){
  customPrompt(t('planNameLabel'),'',n=>{
    const name=(n||'').trim().slice(0,60)||(t('planDefaultName')+' '+(CUSTOM.filter(x=>x.kind==='muscuplan').length+1));
    const id='PL'+Date.now(); CUSTOM.push({id,kind:'muscuplan',name}); saveAll(); renderSport(); openPlan(id);
  },{maxLength:60,placeholder:t('planNamePh')});
}
function openPlan(id){
  const pl=CUSTOM.find(x=>x.id===id&&x.kind==='muscuplan'); if(!pl) return; curPlan=id;
  const bx=document.querySelector('#ovProg .ov-head .x'); if(bx) bx.onclick=function(){ closeOv('ovProg'); };
  $('#ovProgTitle').textContent=t('planTitle');
  const ss=planSessions(id);
  let h='<div class="np-name-t">'+escHtml(pl.name)+'</div><div class="pl-sub">'+tp('seancesCount',ss.length)+'</div>';
  if(!ss.length) h+='<div class="np-empty ik-in">'+ICN('dumbbell',30,'var(--e)')+'<b>'+t('planEmptyTitle')+'</b><span>'+t('planEmptySub')+'</span></div>';
  else ss.forEach(s=>{ h+=muscuCardHTML(s,{del:true}); });
  h+='<button class="btn'+(ss.length?' btn-soft':'')+'" style="margin:4px 0 14px" onclick="planAddSession()">＋ '+t('addSeance')+'</button>';
  h+='<div class="ik-grp"><div class="ik-row ik-link" role="button" onclick="renamePlan()"><span class="tx-open-ic">'+ICN('edit',19,'currentColor')+'</span><div class="ik-row-t"><b>'+t('renamePlan')+'</b></div>'+ICN('chevronR',16)+'</div>'+
    '<div class="ik-row ik-link" role="button" onclick="delPlan(\''+id+'\',true)"><span class="tx-open-ic">'+ICN('trash',19,'currentColor')+'</span><div class="ik-row-t"><b>'+t('deletePlan')+'</b></div>'+ICN('chevronR',16)+'</div></div>';
  $('#progBody').innerHTML=h; openOv('ovProg');
}
function planAddSession(){
  const id=curPlan; if(!id) return;
  customPrompt(t('seanceNameLabel'),'',n=>{
    const k=planSessions(id).length+1;
    newProg={name:(n||'').trim().slice(0,60)||(t('seanceDefaultName')+' '+k),description:'',objective:'Masse',color:'--e',icon:'dumbbell',ex:[],plan:id};
    renderCreate(); openOv('ovCreate');
  },{maxLength:60,placeholder:t('seanceNamePh')});
}
function renamePlan(){ const pl=CUSTOM.find(x=>x.id===curPlan); if(!pl) return;
  customPrompt(t('planNameLabel'),pl.name,n=>{ pl.name=((n||'').trim()||pl.name).slice(0,60); saveAll(); renderSport(); openPlan(pl.id); },{maxLength:60}); }
function delPlan(id,fromPage){
  customConfirm(t('confirmDeletePlanM'),()=>{
    CUSTOM=CUSTOM.filter(x=>x.id!==id&&!(x.kind==='muscu'&&x.plan===id)); curPlan=null; saveAll();
    if(fromPage) closeOv('ovProg'); renderSport();
  },{danger:true});
}
