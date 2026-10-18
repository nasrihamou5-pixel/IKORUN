/* ============================================================================
   IKORUN — Écrans de la blessure et de la douleur  (plan/injury-ui.js)
   · carte « Blessure suivie » (Accueil et Sport) → programme de rééducation (étape, exercices, conseils,
     signes d'alerte, critères de reprise) ;
   · feuille « Où as-tu mal ? » (fin de séance de muscu, ou à tout moment), même silhouette que le bilan ;
   · feuille « Pourquoi pas de muscu ? » quand une séance de muscu n'est pas faite.
   ============================================================================ */
let _psCtx=null, _psPrev=null, _pshRender=null, _injList=[];
function adaptAfterPainReport(pain){
  _lmCache=null; let out=[];
  try{ out=adRulePain({date:todayKey(),pain:Object.assign({on:true,level:3},pain)}); }catch(err){ console.error('[IKORUN] pain',err); }
  adPersist();
  return out.filter(Boolean);
}
function blPainRerender(){ if(_pshRender && document.getElementById('psheet')) _pshRender(); else renderDebrief(); }

/* ---------- feuille « Où as-tu mal ? » ---------- */
function openPainSheet(ctx){
  _psCtx=ctx||{}; _psPrev=debriefData;
  const z=String(_psCtx.zid||'').split('_');
  debriefData={pain:{on:true,zone:z[0]||null,side:z[1]||null,level:3,gait:false}};
  _pshRender=renderPainSheet;
  $('#ovProgTitle').textContent=t('psTitle');
  renderPainSheet(); if(!$('#ovProg').classList.contains('on')) openOv('ovProg');
}
function renderPainSheet(){
  $('#progBody').innerHTML='<div id="psheet"><p class="ad-sub" style="margin:0 0 10px">'+t('psIntro')+'</p>'+blPainHTML(true)+
    '<button type="button" class="btn" style="margin-top:14px" onclick="painSheetSave()">'+t('psSave')+'</button></div>';
}
function painSheetSave(){
  const p=debriefData&&debriefData.pain; if(!p||!p.zone){ toast(t('psNeedZone')); return; }
  const ctx=_psCtx||{}, pain={on:true,zone:p.zone,side:p.side,level:p.level,gait:p.gait};
  debriefData=_psPrev; _pshRender=null; _psPrev=null;
  const out=ctx.missId?strAfterMissed(ctx.missId,'Douleur',{pain}):adaptAfterPainReport(pain);
  saveAll(); closeOv('ovProg');
  toast(out.length&&out[0].msg?adMsg(out[0].msg):t('psSaved'));
  try{ refreshScreen(); }catch(e){}
}

/* ---------- feuille « Pourquoi pas de muscu ? » ---------- */
function openStrMiss(id){
  $('#ovProgTitle').textContent=t('msTitle');
  const R=[['Douleur','msPain','warning'],['Maladie','msIll','health'],['Fatigue','msFatigue','moon'],['Temps','msTime','stopwatch'],['Autre','msOther','help']];
  $('#progBody').innerHTML='<p class="ad-sub" style="margin:0 0 10px">'+t('msIntro')+'</p><div class="ik-miss">'+R.map(function(r){
    return '<button type="button" class="ik-miss-b" onclick="strMissPick(\''+id+'\',\''+r[0]+'\')">'+ICN((typeof ICONS!=='undefined'&&ICONS[r[2]])?r[2]:'gear',18)+'<span>'+t(r[1])+'</span></button>'; }).join('')+'</div>';
  openOv('ovProg');
}
function strMissPick(id,reason){
  if(reason==='Douleur'){ openPainSheet({missId:id}); return; }
  const out=strAfterMissed(id,reason);
  saveAll(); closeOv('ovProg'); toast(out.length&&out[0].msg?adMsg(out[0].msg):t('sessionNotedToast'));
  try{ refreshScreen(); }catch(e){}
}

/* ---------- carte « Blessure suivie » ---------- */
function injuryCardHTML(){
  const I=(typeof injInfo==='function')?injInfo():null; if(!I) return '';
  const dots=[1,2,3].map(function(n){ return '<i class="'+(n<I.phase?'done':n===I.phase?'cur':'')+'"></i>'; }).join('');
  return '<section class="ik-inj" onclick="openInjury()" role="button" tabindex="0" onkeydown="if(event.key===\'Enter\'){openInjury()}">'+
    '<div class="ik-inj-ic">'+ICN('health',20)+'</div><div class="ik-inj-b"><b>'+escHtml(tp('injCardTitle',adZoneName(I.zone)))+'</b>'+
    '<span>'+escHtml(tp('injCardSub',I.phase,t('injPhase'+I.phase),I.daysIn+1))+'</span><div class="ik-inj-steps" aria-hidden="true">'+dots+'</div></div>'+
    ICN('chevronR',16)+'</section>';
}

/* ---------- programme de rééducation ---------- */
function openInjury(){
  if(!injActive()) return;
  $('#ovProgTitle').textContent=t('injTitle');
  $('#progBody').innerHTML='<div class="empty"><div>…</div></div>';
  openOv('ovProg');
  ikLoad('exdb').then(renderInjury).catch(renderInjury);
}
function injL(o){ if(!o) return ''; const l=curLang(); return o[l]||o.fr||''; }
function injList(a,cls){ return (a||[]).length?'<ul class="ik-inj-ul'+(cls?' '+cls:'')+'">'+a.map(function(x){ return '<li>'+escHtml(x)+'</li>'; }).join('')+'</ul>':''; }
function injSec(title,body,ic){ return body?'<section class="ik-inj-sec"><h3>'+(ic?ICN(ic,15)+' ':'')+escHtml(title)+'</h3>'+body+'</section>':''; }
function renderInjury(){
  const I=injInfo(); if(!I){ closeOv('ovProg'); return; }
  const Z=(window.EXD_REHAB&&EXD_REHAB.zones&&EXD_REHAB.zones[I.base])||null, C=(window.EXD_REHAB&&EXD_REHAB.common)||null;
  _injList=injRehabFor(I.zone,I.phase,4);
  let h='<div class="ik-inj-hero"><div class="ik-inj-ic big">'+ICN('health',26)+'</div><div><b>'+escHtml(adZoneName(I.zone))+'</b><span>'+escHtml(tp('injHeroSub',I.days+1))+'</span></div></div>';
  h+='<div class="ik-inj-stepper">'+[1,2,3].map(function(n){ return '<div class="'+(n<I.phase?'done':n===I.phase?'cur':'')+'"><i>'+(n<I.phase?'✓':n)+'</i><span>'+escHtml(t('injPhase'+n))+'</span></div>'; }).join('')+'</div>';
  h+='<p class="ik-inj-now"><b>'+escHtml(t('injPhase'+I.phase))+'</b> — '+escHtml(t('injPhaseSub'+I.phase))+'</p>';
  if(I.consult) h+='<div class="ik-inj-warn">'+ICN('warning',16)+'<span>'+escHtml(t('injConsult'))+'</span></div>';
  h+=injSec(t('injSecWhat'), Z?'<p>'+escHtml(injL(Z.what))+'</p>':'<p>'+escHtml(t('injGenericWhat'))+'</p>','help');
  h+=injSec(t('injSecDoing'), injList([t('injRun'+I.phase),t('injStr'+I.phase)]),'gear');
  if(_injList.length){
    h+='<section class="ik-inj-sec"><h3>'+ICN('dumbbell',15)+' '+escHtml(t('injSecEx'))+'</h3><div class="ik-inj-ex">'+_injList.map(function(e,i){
      return '<button type="button" class="ik-inj-exr" onclick="injOpenEx('+i+')">'+exThumb(e.name,48)+'<div><b>'+escHtml(trExName(e.name))+'</b><span>'+e.sets+' × '+escHtml(String(e.reps))+'</span></div>'+ICN('chevronR',14)+'</button>'; }).join('')+'</div></section>';
  }
  h+=injSec(t('injSecAdvice'), injList(Z?injL(Z.advice):[t('injGenericAdvice')]),'check');
  h+=injSec(t('injSecAvoid'), injList(Z?injL(Z.avoid):[],'bad'),'stop');
  h+=injSec(t('injSecCross'), Z?'<p>'+escHtml(injL(Z.cross))+'</p>':'','bike');
  h+=injSec(t('injSecRed'), C?injList(injL(C.red),'bad'):'','warning');
  h+=injSec(t('injSecReturn'), C?injList(injL(C.ret),'ok'):'','flag');
  h+='<div class="ik-inj-acts"><button type="button" class="btn ghost" onclick="openPainSheet({zid:\''+I.zone+'\'})">'+t('injStill')+'</button>'+
     '<button type="button" class="btn" onclick="adSafetyClick(\'pain\')">'+t('adNoMorePain')+'</button></div>';
  h+='<p class="ad-foot">'+escHtml(C?injL(C.disc):t('injDisc'))+'</p>';
  $('#ovProgTitle').textContent=t('injTitle');
  $('#progBody').innerHTML=h;
}
function injOpenEx(i){ const e=_injList[i]; if(!e) return; libCallback=null; libBrowseMode=true; renderLib(); openOv('ovLib'); openFiche(e.name); }
