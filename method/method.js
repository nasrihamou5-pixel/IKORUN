/* ============================================================================
   IKORUN — « LA MÉTHODE IKORUN » ET PLANS EXEMPLES (V4.0.0, ikLoad('method'))
   ----------------------------------------------------------------------------
   · Une page qui explique, sans jargon, comment le plan est construit et ajusté,
     avec les sources (livres et articles) et les limites de la méthode.
   · Quatre plans exemples IMPRIMABLES, produits par le VRAI générateur
     (planBuild) à partir de profils types : rien n'est écrit à la main, ce que
     l'on montre est exactement ce que l'app produirait pour ce profil.
     Le profil de l'utilisateur est mis de côté le temps du calcul, puis rétabli
     tel quel (planBuild n'enregistre rien).
   ============================================================================ */
(function(){
  // Profils types : course, VDOT (niveau), jours d'entraînement (0 = dimanche), semaines.
  const SAMPLES=[
    {k:'s5k', race:'5 km', vdot:34, level:'deb', days:[2,4,6], weeks:10},
    {k:'s10k', race:'10 km', vdot:44, level:'int', days:[1,3,5,6], weeks:12},
    {k:'sSemi', race:'Semi-marathon', vdot:46, level:'int', days:[1,3,5,6], weeks:14},
    {k:'sMar', race:'Marathon', vdot:52, level:'conf', days:[1,2,4,5,6], weeks:18}];
  // allures du générateur (planPaces) → zones de Daniels E, M, T, I, R
  const ZONES=[['EF','E'],['MAR','M'],['SEUIL','T'],['VMAl','I'],['VMAc','R']];
  const E=s=>escHtml(String(s==null?'':s));
  let _cache={};
  // Même volume de départ que « Configurer mon plan » pour un coureur sans historique.
  function sampleVolume(s){
    const base={deb:18,int:32,conf:50}[s.level], km=RACE_M[s.race]/1000, mult=km<=5?.85:km<=10?1:km<=21.2?1.25:km<=42.3?1.55:1.75, ref=base*mult;
    const min=Math.round(Math.min(160,Math.max(8,ref*.8))); return {min,max:Math.round(Math.min(180,Math.max(min+4,ref*1.4)))};
  }
  // Dimanche de course : le lundi qui suit aujourd'hui + N semaines − 1 jour.
  function sampleDate(weeks){ const d=ikNow(); d.setHours(12,0,0,0); d.setDate(d.getDate()+((8-d.getDay())%7||7)+weeks*7-1); return dateKey(d); }
  function build(s){
    const key=s.k+'|'+curLang()+'|'+todayKey(); if(_cache[key]) return _cache[key];
    const keepP=P, keepLiked=PREFS.likedTypes, vol=sampleVolume(s);
    let out=null;
    try{
      P=Object.assign({},keepP,{compDate:sampleDate(s.weeks),days:s.days.slice(),objRace:s.race,objRaceKm:null,objGoal:'Record personnel',
        planSituation:'autre',planLevel:s.level,planGap:'lt1',kmWeek:vol.min,kmWeekMin:vol.min,kmWeekMax:vol.max,objRaceId:null,objRaceName:null});
      PREFS.likedTypes=[];
      const r=planBuild({vdot:s.vdot,seed:7});
      if(!r.err){
        const pl=r.plan, weeks={};
        pl.sessions.forEach(x=>{ (weeks[x.week]=weeks[x.week]||{n:x.week,phase:x.phaseKey,km:0,list:[]}); const w=weeks[x.week]; if(x.km>0){ w.km+=x.km; w.list.push({date:x.date,title:planSessTitle(x),km:x.km,pace:x.pace,dow:new Date(x.date+'T12:00:00').getDay(),hard:HARD_TYPES.includes(x.baseType),deload:!!x.deload}); } if(x.deload) w.deload=true; });
        out={plan:pl,weeks:Object.values(weeks).sort((a,b)=>a.n-b.n),vdot:s.vdot,days:s.days,race:s.race,vol,
          valid:(typeof validatePlan==='function')?validatePlan(pl,{}):null};
      }
    } finally { P=keepP; PREFS.likedTypes=keepLiked; }
    _cache[key]=out; return out;
  }
  window.methodSampleBuild=build;
  window.methodSamples=SAMPLES;

  /* ---------- la page ---------- */
  const SECTIONS=[['level','gauge'],['zones','trend'],['structure','calendar'],['load','shield'],['adapt','gear'],['heat','sun'],['ramadan','moon'],['limits','warning']];
  window.methodOpen=function(tab){
    openOv('ovRace'); $('#ovRaceTitle').textContent=t('mtTitle');
    let h='<div class="mt-hero"><p>'+t('mtIntro')+'</p></div>';
    SECTIONS.forEach(([k,ic])=>{ h+='<section class="card mt-sec"><h3>'+ICN(ic,17)+' '+t('mtH_'+k)+'</h3><p>'+t('mtP_'+k)+'</p></section>'; });
    h+='<div class="db-sec">'+t('mtSamples')+'</div><p class="rc-lead">'+t('mtSamplesLead')+'</p><div class="mt-samples">'+
      SAMPLES.map(s=>{ const o=build(s); return '<button type="button" class="rc-item" onclick="methodSample(\''+s.k+'\')"><span class="rc-date"><b>'+(o?o.weeks.length:s.weeks)+'</b><small>'+t('mtWeeksShort')+'</small></span><span class="rc-main"><b>'+E(t('mtS_'+s.k))+'</b><small>'+E(tp('mtSampleSub',s.days.length,s.vdot))+'</small></span></button>'; }).join('')+'</div>';
    h+='<div class="db-sec">'+t('mtSources')+'</div><ol class="mt-src">'+
      ['daniels','seiler','gabbett','foster','hadley','ramadan'].map(k=>'<li>'+t('mtSrc_'+k)+'</li>').join('')+'</ol>';
    h+='<p class="ad-foot">'+t('mtNoAi')+'</p>';
    $('#raceBody').innerHTML=h;
    const sc=$('#raceBody').closest('.ov-body-scroll'); if(sc) sc.scrollTop=0;
    try{ if(typeof ikTrack==='function') ikTrack('method_open',{}); }catch(e){}
  };
  function dayName(d){ return ikDate(new Date(2023,0,1+d),'{weekday:short}',{weekday:'short'}).replace('.',''); }
  function tableHTML(s,o){
    let h='<table class="mt-tab"><thead><tr><th>'+t('mtWeek')+'</th>'+o.days.map(d=>'<th>'+E(dayName(d))+'</th>').join('')+'<th>km</th></tr></thead><tbody>';
    o.weeks.forEach(w=>{
      h+='<tr class="'+(w.deload?'dl':'')+(w.phase==='TAPER'?' tp':'')+'"><th scope="row"><b>'+w.n+'</b><small>'+E(phaseName(w.phase))+(w.deload?' · '+t('mtDeload'):'')+'</small></th>';
      o.days.forEach(d=>{ const x=w.list.find(z=>z.dow===d); h+='<td>'+(x?'<span class="mt-s'+(x.hard?' hard':'')+'">'+E(x.title)+'</span><small><bdi dir="ltr">'+fmt1(x.km)+' km · '+E(x.pace||'')+'</bdi></small>':'<span class="mt-rest">—</span>')+'</td>'; });
      h+='<td class="km"><bdi dir="ltr">'+Math.round(w.km)+'</bdi></td></tr>';
    });
    return h+'</tbody></table>';
  }
  window.methodSample=function(k){
    const s=SAMPLES.find(x=>x.k===k); if(!s) return;
    const o=build(s);
    if(!o){ toast(t('genericErrorRetry')); return; }
    const pc=planPaces(s.vdot);
    let h='<div class="mt-hero"><h3>'+E(t('mtS_'+k))+'</h3><p>'+E(tp('mtSampleSub',s.days.length,s.vdot))+' · '+E(tp('mtSampleVol',o.vol.min,o.vol.max))+'</p></div>';
    h+='<div class="rc-acts2"><button type="button" class="btn sm" onclick="methodPrint(\''+k+'\')">'+ICN('download',15)+' '+t('mtPrint')+'</button><button type="button" class="btn ghost sm" onclick="methodOpen()">'+t('mtBack')+'</button></div>';
    h+='<p class="ad-foot">'+t('mtSampleNote')+(o.valid?' '+tp('mtValid',o.valid.errors.length):'')+'</p>';
    h+='<div class="mt-wrap">'+tableHTML(s,o)+'</div>';
    h+='<div class="db-sec">'+t('mtPaces')+'</div><div class="card mt-paces">'+ZONES.map(z=>'<div class="rc-r"><span class="rc-r-ic">'+z[1]+'</span><span class="rc-r-l">'+t('mtZone_'+z[1])+'</span><span class="rc-r-v"><bdi dir="ltr">'+spkToStr(pc[z[0]])+' /km</bdi></span></div>').join('')+'</div>';
    $('#ovRaceTitle').textContent=t('mtSamples'); $('#raceBody').innerHTML=h;
    const sc=$('#raceBody').closest('.ov-body-scroll'); if(sc) sc.scrollTop=0;
  };
  // Impression : une page dédiée (en-tête, tableau, allures, sources), le reste de l'app masqué.
  window.methodPrint=function(k){
    const s=SAMPLES.find(x=>x.k===k), o=s&&build(s); if(!o) return;
    const pc=planPaces(s.vdot);
    let el=document.getElementById('ikPrint'); if(!el){ el=document.createElement('div'); el.id='ikPrint'; document.body.appendChild(el); }
    el.setAttribute('dir',curLang()==='ar'?'rtl':'ltr');
    el.innerHTML='<header><b>IKORUN</b><span>'+E(t('mtS_'+k))+'</span></header>'+
      '<p>'+E(tp('mtSampleSub',s.days.length,s.vdot))+' · '+E(tp('mtSampleVol',o.vol.min,o.vol.max))+'</p>'+tableHTML(s,o)+
      '<p class="pz">'+ZONES.map(z=>'<b>'+z[1]+'</b> '+E(t('mtZone_'+z[1]))+' : <bdi dir="ltr">'+spkToStr(pc[z[0]])+' /km</bdi>').join(' · ')+'</p>'+
      '<p class="nt">'+E(t('mtSampleNote'))+'</p><footer>ikorun.pages.dev · '+E(t('mtTitle'))+'</footer>';
    document.body.classList.add('ik-printing');
    const done=()=>{ document.body.classList.remove('ik-printing'); window.removeEventListener('afterprint',done); };
    window.addEventListener('afterprint',done);
    setTimeout(()=>{ try{ window.print(); }catch(e){} setTimeout(done,1500); },60);
  };
})();
