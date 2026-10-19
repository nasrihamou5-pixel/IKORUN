/* ============================================================================
   IKORUN — COURSES : partie toujours chargée (V4.0.0)
   ----------------------------------------------------------------------------
   L'écran Courses (liste, calendrier, fiche, propositions, admin) est dans
   races/races.js, chargé à la demande. Ici, seulement ce dont l'accueil, le
   plan et l'inscription ont besoin sans attendre le module :
   · les courses suivies (P.raceFollows : id, nom, date, ville), gardées dans le
     profil chiffré et recopiées dans race_follows pour les rappels serveur ;
   · le compte à rebours de l'accueil (J-30 → jour J) ;
   · la conversion d'une course du calendrier en objectif de plan.
   ============================================================================ */
function openRaces(opts){ ikLoad('races').then(()=>racesOpen(opts||{})).catch(()=>toast(t('genericErrorRetry'))); }
function openRace(id){ ikLoad('races').then(()=>raceOpen(id)).catch(()=>toast(t('genericErrorRetry'))); }
function raceFollows(){ return Array.isArray(P&&P.raceFollows)?P.raceFollows:[]; }
function raceIsFollowed(id){ return raceFollows().some(f=>f.id===id); }
// Jours entiers entre aujourd'hui et la date de la course (heure locale).
function raceDaysTo(date){ return Math.round((new Date(date+'T12:00:00')-new Date(todayKey()+'T12:00:00'))/86400000); }
// Suivre / ne plus suivre. Le serveur ne reçoit que l'identifiant de la course (donnée publique).
function raceFollowSet(r,on){
  const list=raceFollows().filter(f=>f.id!==r.id);
  if(on) list.push({id:r.id,name:String(r.name||'').slice(0,140),date:r.date,city:String(r.city||'').slice(0,80)});
  P.raceFollows=list.sort((a,b)=>a.date<b.date?-1:1).slice(-50); DB.save('profile',P);
  if(window.currentUserId && window.supabaseClient){
    const q=on?window.supabaseClient.from('race_follows').upsert({user_id:window.currentUserId,race_id:r.id,remind:true},{onConflict:'user_id,race_id'})
              :window.supabaseClient.from('race_follows').delete().eq('user_id',window.currentUserId).eq('race_id',r.id);
    Promise.resolve(q).then(res=>{ if(res&&res.error) console.warn('[IKORUN] suivi course',res.error.message); }).catch(()=>{});
  }
}
// Accueil : la course suivie la plus proche, à 30 jours ou moins (jusqu'au jour J inclus).
function raceCountdownHTML(){
  const tk=todayKey(), next=raceFollows().filter(f=>f.date>=tk).sort((a,b)=>a.date<b.date?-1:1)[0];
  if(!next) return '';
  const n=raceDaysTo(next.date); if(n>30) return '';
  const lab=n===0?t('raceToday'):n===1?t('raceTomorrow'):tp('raceInDays',n);
  const tip=n===0?t('raceTipDay'):n===1?t('raceTipJ1'):n<=7?t('raceTipJ7'):t('raceTipJ30');
  return '<div class="card rc-count" onclick="openRace(\''+escHtml(next.id)+'\')" role="button" tabindex="0">'+
    '<div class="rc-count-n" aria-hidden="true">'+(n===0?ICN('flag',22):'<b>'+n+'</b><small>'+t('raceDaysShort')+'</small>')+'</div>'+
    '<div class="rc-count-t"><span>'+lab+'</span><b dir="auto">'+escHtml(next.name)+'</b><small>'+escHtml(next.city)+' · '+tip+'</small></div>'+
    '<div class="rc-count-go">'+ICN('chevronR',16)+'</div></div>';
}
// Course du calendrier → objectif du plan (mêmes valeurs que « Configurer mon plan »).
function raceToObjective(r,km){
  const k=+km||0, near=(a,b,tol)=>Math.abs(a-b)<=tol;
  let objRace='Autre';
  if(r.kind==='cross') objRace='Cross';
  else if(r.kind==='trail') objRace='Trail';
  else if(r.kind==='ultra' || k>43) objRace='Ultra';
  else if(near(k,5,0.2)) objRace='5 km';
  else if(near(k,10,0.3)) objRace='10 km';
  else if(near(k,21.1,0.3)) objRace='Semi-marathon';
  else if(near(k,42.2,0.4)) objRace='Marathon';
  return {objRace, objRaceKm:objRace==='Autre'&&k>0?k:null, compDate:r.date,
    objProfile:r.kind==='trail'?'Vallonnée':'Plate', objRaceId:r.id, objRaceName:String(r.name||'').slice(0,140)};
}
// « Préparer cette course » : la configuration du plan s'ouvre avec la course déjà remplie.
function racePrepare(r,km){
  const o=raceToObjective(r,km);
  if(o.compDate<minRaceDate()){ toast(t('psDateSoon')); return; }
  raceFollowSet(r,true);
  window._psRacePreset=o; openPlanSetup();
}
// Inscription : la course choisie remplit la date (et l'objectif s'il est vide) ; elle devient
// l'objectif du plan à la fin de l'inscription si la date n'a pas été changée entre-temps.
function racePickedForOnboarding(r,km){
  if(typeof IKOB!=='undefined' && IKOB.racePicked(r,km)){ toast(tp('racePickedToast',r.name)); return; }
  window._obRace={r,km};
  const d=$('#ob_compdate'); if(d) d.value=r.date;
  const g=$('#ob_goal'); if(g && !g.value.trim()) g.value=r.name+(km?' · '+fmtKmShort(km)+' km':'');
  toast(tp('racePickedToast',r.name));
}
