/* ============================================================================
   IKORUN — MODE RAMADAN (V4.0.0)
   ----------------------------------------------------------------------------
   Défauts corrigés :
   · le décor n'apparaissait que le 1er jour (feteToday testait h.d===1) : il reste maintenant
     du 1er Ramadan à la veille de l'Aïd, au fil des redémarrages, changements de thème, de
     langue, reconnexions et mises à jour — tout est recalculé d'après la date, rien n'est figé ;
   · le thème personnalisé (éditeur de thème) passait devant les couleurs de la fête : pendant
     une fête il est suspendu (txApply), puis revient exactement tel quel (P.tx n'est jamais
     modifié). Le visuel du Ramadan (lanternes, croissant, or et bleu nuit) est gardé.
   Calendrier : Umm al-Qura du téléphone (Intl, islamic-umalqura), décalable de ±1 jour
   (Profil › Apparence › Jours spéciaux) pour suivre l'annonce officielle.
   Sport :
   · imsak (Fajr − 10 min) et iftar (Maghreb), calculés pour la ville choisie (météo) ;
   · deux créneaux : juste avant l'iftar (facile et court seulement) ou 1 h 30 – 2 h après
     (séance de qualité possible) ;
   · baisse automatique du volume (léger −10 %, normal −20 %, fort −30 %) et intensité
     plafonnée au seuil pendant le mois ; reprise sur deux semaines après l'Aïd (−10 %, −5 %) ;
   · rappels d'hydratation entre l'iftar et le shour (carte de l'Accueil) ;
   · le moteur d'adaptation tient compte du jeûne (allure attendue +3 %, plan/adapt.js).
   Tout se désactive séparément, sans insister : décor, adaptation sportive, « je jeûne ».
   ============================================================================ */
const RAMADAN_LEVELS={light:0.10,normal:0.20,strong:0.30};
function hijriOfKey(k){ const d=new Date(k+'T12:00:00'); d.setDate(d.getDate()+hijriAdj()); return hijriOf(d); }
let _rmMemo={};
// {on, day, start, end, eid, year} pendant le mois ; {post, day, eid} les 15 premiers jours de Chawwal.
function ramadanInfo(k){
  k=k||todayKey();
  const id=k+'|'+hijriAdj(); if(_rmMemo[id]) return _rmMemo[id];
  const h=hijriOfKey(k); let r={on:false};
  if(h && h.m===9){
    let start=k, end=k;
    for(let i=1;i<=31;i++){ const hh=hijriOfKey(adKeyAdd(k,-i)); if(!hh||hh.m!==9){ start=adKeyAdd(k,-i+1); break; } }
    for(let i=1;i<=31;i++){ const hh=hijriOfKey(adKeyAdd(k,i)); if(!hh||hh.m!==9){ end=adKeyAdd(k,i-1); break; } }
    r={on:true,day:h.d,start,end,eid:adKeyAdd(end,1),year:h.y,left:adDaysBetweenKeys(k,end)};
  } else if(h && h.m===10 && h.d<=15){
    r={on:false,post:true,day:h.d,eid:adKeyAdd(k,-(h.d-1)),year:h.y};
  }
  const keys=Object.keys(_rmMemo); if(keys.length>60) _rmMemo={};
  return _rmMemo[id]=r;
}
function ramadanSportOn(){ return !!P && P.ramadanSport!==false; }
// Jeûne de ce jour (bilan → moteur d'adaptation) : pendant le Ramadan, sauf « je ne jeûne pas ».
function ramadanFastingOn(k){ const r=ramadanInfo(k); return !!(r.on && P && P.fasting!==false); }
function ramadanLevel(){ return RAMADAN_LEVELS[P&&P.ramadanLevel]!=null?P.ramadanLevel:'normal'; }

/* ---------- horaires : imsak et iftar pour la ville choisie ---------- */
function ramadanTimes(k){
  const loc=wxLocOrDefault(), d=(typeof wxData==='function')?wxData():null;
  const tz=(d && Math.abs(d.lat-loc.lat)<0.02 && Math.abs(d.lon-loc.lon)<0.02 && d.off)?d.off/3600:1;
  const pt=prayerTimesFor(k||todayKey(),loc.lat,loc.lon,tz);
  const mn=s=>{ const [a,b]=s.split(':').map(Number); return a*60+b; }, hm=m=>{ m=((m%1440)+1440)%1440; return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); };
  const fajr=mn(pt.Fajr), magh=mn(pt.Maghrib);
  return {loc,imsak:hm(fajr-10),fajr:pt.Fajr,iftar:pt.Maghrib,isha:pt.Isha,
    before:[hm(magh-60),hm(magh-15)], after:[hm(magh+90),hm(magh+120)], iftarMin:magh, imsakMin:fajr-10};
}
// Heure conseillée d'une séance du plan un jour de jeûne : facile → avant l'iftar, sinon après.
function ramadanRunHour(s){
  if(!s || !ramadanFastingOn(s.date) || !ramadanSportOn()) return null;
  const T=ramadanTimes(s.date), hard=planIsHard(s)||planIsLong(s);
  return Math.min(22,Math.floor((hard?T.iftarMin+105:T.iftarMin-40)/60));
}

/* ---------- plan : volume et intensité pendant le mois, reprise après l'Aïd ---------- */
// Reconstruit une séance en un autre type (même semaine, même phase), avec le générateur.
function adRebuildAs(pl,s,type,pc){
  const vdot=pl.vdot||getUserVDOT()||45, rng=mulberry32(((pl.seed||1)^(s.id*2654435761))>>>0), pick=a=>a[Math.floor(rng()*a.length)];
  const wk=pl.sessions.filter(x=>x.week===s.week);
  const built=buildSessionV2(type,{vdot,pace:pc,wkKm:Math.max(15,planWeekKm(wk)),nDays:pl.nDays||4,phase:{name:s.phase,key:s.phaseKey,color:s.color},rng,pick,isDeload:!!s.deload,goal:pl.goal,w:s.week,weeks:pl.weeks});
  const durMin=built.durMin!=null?built.durMin:(built.pace==='—'?0:Math.round(built.km*parseTime(built.pace)/60));
  Object.assign(s,{type:built.label,baseType:type,title:built.title,km:built.km,duration:durMin,pace:built.pace,rpe:built.rpe,series:built.series||null,desc:built.detail.objectif,detail:built.detail,genParams:built.genParams||null});
  planApplySegs(s,pc);
}
function ramadanPlanSig(){ return PLAN?(PLAN.created+'|'+PLAN.seed):''; }
function ramadanApplyPlan(info){
  const st=adState(), red=RAMADAN_LEVELS[ramadanLevel()], k=todayKey();
  const from=k>info.start?k:info.start;
  const r=adaptApply('ramadan',false,(pl,pc)=>{ let n=0;
    pl.sessions.filter(s=>adEd(s,from,false) && s.date<=info.end && s.phaseKey!=='TAPER').forEach(s=>{
      adKeepKm0(s);
      // intensité plafonnée au seuil : la VMA, les intervalles et le double seuil deviennent du seuil
      if(PLAN_VERY_HARD.includes(s.baseType)){ adRebuildAs(pl,s,'SEUIL',pc); adTag(s,'ramadan',true); n++; }
      if(adLighten(s,1-red,pc,'ramadan')) n++;
      else if(s.adj && s.adj.r==='ramadan') n++;
    }); return n; },{k:'rmMsgPlan',p:[Math.round(red*100),{d:info.end}]});
  st.ramadan={y:info.year,sig:ramadanPlanSig(),lvl:ramadanLevel(),id:r?r.id:null};
  return r;
}
function ramadanApplyBack(info){
  const st=adState(), k=todayKey(), from=k>info.eid?k:info.eid, w1=adKeyAdd(info.eid,7), w2=adKeyAdd(info.eid,14);
  const r=adaptApply('ramadanBack',false,(pl,pc)=>{ let n=0;
    pl.sessions.filter(s=>adEd(s,from,false) && s.date<w2 && s.phaseKey!=='TAPER').forEach(s=>{ if(adLighten(s,s.date<w1?0.9:0.95,pc,'ramadanBack')) n++; }); return n; },
    {k:'rmMsgBack',p:[{d:w2}]});
  st.ramadanBack={y:info.year,sig:ramadanPlanSig()};
  return r;
}
// Appelé par le moteur du jour (adaptDaily) : pose ou retire l'adaptation selon la date et les réglages.
function ramadanDaily(){
  if(!PLAN||!PLAN.sessions) return [];
  const st=adState(), info=ramadanInfo(), out=[];
  if(info.on){
    const cur=st.ramadan;
    const want=ramadanSportOn() && P.fasting!==false;
    const same=cur && cur.y===info.year && cur.sig===ramadanPlanSig();
    if(want && (!same || cur.lvl!==ramadanLevel() || !cur.id)){
      if(same && cur.id){ adaptUndo(cur.id); }
      const r=ramadanApplyPlan(info); if(r) out.push(r);
    } else if(!want && same && cur.id){
      const e=adEntry(cur.id); if(e && e.status==='applied'){ adaptUndo(cur.id); out.push(e); } cur.id=null;
    }
  } else if(info.post){
    const b=st.ramadanBack, was=st.ramadan && st.ramadan.y===info.year;
    if(was && ramadanSportOn() && !(b && b.y===info.year && b.sig===ramadanPlanSig())){ const r=ramadanApplyBack(info); if(r) out.push(r); }
  }
  return out;
}
function ramadanSet(field,val){
  P[field]=val; DB.save('profile',P);
  const r=ramadanDaily(); adPersist();
  if(r.length) toast(adMsg(r[r.length-1].msg));
  if(document.getElementById('rmSheet')) openRamadan(); else refreshScreen();
  haptic();
}

/* ---------- écrans ---------- */
// Accueil : bandeau du jour (horaires, créneau conseillé, hydratation le soir).
// La ligne du moment : shour, créneau du jour, juste avant l'iftar, ou le soir.
function ramadanLine(){
  const T=ramadanTimes(), now=ikNow(), nowMin=now.getHours()*60+now.getMinutes(), B=x=>'\u2066'+x+'\u2069';
  if(nowMin<T.imsakMin) return tp('rmLineNight',B(T.imsak));
  if(nowMin<T.iftarMin-60) return tp('rmLineDay',B(T.iftar),B(T.before[0]),B(T.after[0]));
  if(nowMin<T.iftarMin) return tp('rmLineBefore',B(T.iftar));
  return tp('rmLineEvening',B(T.after[0]),B(T.after[1]));
}
function ramadanHydrateNow(){ const T=ramadanTimes(), n=ikNow(), m=n.getHours()*60+n.getMinutes(); return m>=T.iftarMin || m<T.imsakMin; }
// Carte seule quand le décor est coupé (sinon ces informations sont dans la carte de la fête).
function ramadanCardHTML(){
  const info=ramadanInfo(); if(!info.on || !P) return '';
  if(typeof feteOn==='function' && feteOn() && feteToday()==='ramadan') return '';
  const T=ramadanTimes(), now=ikNow(), nowMin=now.getHours()*60+now.getMinutes();
  let line;
  line=ramadanLine();
  const hydrate=ramadanHydrateNow();
  return '<section class="rm-card" role="button" tabindex="0" onclick="openRamadan()"><div class="rm-h"><b>'+ICN('moon',15)+' '+tp('rmDay',info.day)+'</b><span>'+t('rmImsak')+' <bdi dir="ltr">'+T.imsak+'</bdi> · '+t('rmIftar')+' <bdi dir="ltr">'+T.iftar+'</bdi></span></div>'+
    '<p>'+escHtml(line)+'</p>'+(hydrate?'<p class="rm-hyd">'+ICN('water',13)+' '+t('rmHydrate')+'</p>':'')+'</section>';
}
function openRamadan(){
  const info=ramadanInfo(), T=ramadanTimes(), lvl=ramadanLevel();
  let h='<div id="rmSheet">';
  if(info.on) h+='<div class="rm-hero"><b>'+tp('rmDay',info.day)+'</b><span>'+tp('rmEidOn',fmtDate(info.eid))+'</span></div>';
  else if(info.post) h+='<div class="rm-hero"><b>'+t('rmPostTitle')+'</b><span>'+t('rmPostSub')+'</span></div>';
  h+='<div class="rm-times"><div><span>'+t('rmImsak')+'</span><b>'+T.imsak+'</b></div><div><span>'+t('rmIftar')+'</span><b>'+T.iftar+'</b></div><div><span>'+t('rmCity')+'</span><b>'+escHtml(T.loc.name)+'</b></div></div>';
  h+='<div class="db-sec">'+t('rmSlots')+'</div><div class="rm-slots"><div><b><bdi dir="ltr">'+T.before[0]+' – '+T.before[1]+'</bdi></b><span>'+t('rmSlotBefore')+'</span></div><div><b><bdi dir="ltr">'+T.after[0]+' – '+T.after[1]+'</bdi></b><span>'+t('rmSlotAfter')+'</span></div></div>';
  h+='<div class="db-sec">'+t('rmAdapt')+'</div>';
  h+='<div class="ap-opt"><div><b>'+t('rmSportOn')+'</b><span>'+t('rmSportSub')+'</span></div><div class="toggle'+(ramadanSportOn()?' on':'')+'" role="switch" aria-checked="'+ramadanSportOn()+'" aria-label="'+t('rmSportOn')+'" onclick="ramadanSet(\'ramadanSport\','+(!ramadanSportOn())+')"></div></div>';
  if(ramadanSportOn()){
    h+='<div class="seg-ctrl sub bl-seg" role="radiogroup" style="margin-top:10px">'+['light','normal','strong'].map(x=>'<div class="seg-btn'+(lvl===x?' on':'')+'" role="radio" aria-checked="'+(lvl===x)+'" onclick="ramadanSet(\'ramadanLevel\',\''+x+'\')">'+t('rmLvl_'+x)+'</div>').join('')+'</div>';
    h+='<p class="ad-foot" style="margin-top:6px">'+tp('rmLvlExplain',Math.round(RAMADAN_LEVELS[lvl]*100))+'</p>';
    h+='<div class="ap-opt" style="margin-top:10px"><div><b>'+t('rmFasting')+'</b><span>'+t('rmFastingSub')+'</span></div><div class="toggle'+(P.fasting!==false?' on':'')+'" role="switch" aria-checked="'+(P.fasting!==false)+'" aria-label="'+t('rmFasting')+'" onclick="ramadanSet(\'fasting\','+(P.fasting===false)+')"></div></div>';
  }
  h+='<div class="ap-opt" style="margin-top:10px"><div><b>'+t('rmVisual')+'</b><span>'+t('rmVisualSub')+'</span></div><div class="toggle'+(P.ramadanVisual!==false?' on':'')+'" role="switch" aria-checked="'+(P.ramadanVisual!==false)+'" aria-label="'+t('rmVisual')+'" onclick="P.ramadanVisual=(P.ramadanVisual===false);DB.save(\'profile\',P);applyTheme();openRamadan();refreshScreen()"></div></div>';
  h+='<div class="db-sec">'+t('rmTipsTitle')+'</div><ul class="ca-list rm-tips"><li>'+t('rmTip1')+'</li><li>'+t('rmTip2')+'</li><li>'+t('rmTip3')+'</li><li>'+t('rmTip4')+'</li></ul>';
  h+='<p class="ad-foot">'+t('rmCalendarNote')+'</p></div>';
  if(!document.getElementById('ovProg').classList.contains('on')) openOv('ovProg');
  $('#ovProgTitle').textContent=t('fete_ramadan');
  $('#progBody').innerHTML=h;
}
