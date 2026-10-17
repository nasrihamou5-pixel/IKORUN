/* ============================================================================
   IKORUN — GÉNÉRATEUR DE PLAN DE MUSCU  (plan/strength.js)
   strengthBuild(opts) -> {plan} | {err, errors?}      (pur, déterministe, sans effet de bord)
   validateStrengthPlan(plan, runSessions) -> {ok, errors[]}
   Script classique (globales), comme plan/adapt.js. Aucune dépendance obligatoire :
   le catalogue d'exercices et la fabrique d'exercice sont PASSÉS en options
   (en app : catalog = allExercises(), exFactory = ex).

   opts = {
     startDate : 'YYYY-MM-DD'   (défaut : 1re séance de course, sinon aujourd'hui)
     weeks     : nombre de semaines (défaut : durée du plan de course lié, sinon 12 ; max 28)
     perWeek   : 1 | 2 | 3      séances de muscu par semaine
     days      : [0..6]         jours autorisés (0 = lundi). Vide = tous
     level     : 'Débutant' | 'Intermédiaire' | 'Avancé'
     equip     : 'salle' | 'maison' | 'both'
     seed      : entier         (même entrée + même graine = même plan)
     raceDate  : 'YYYY-MM-DD'   optionnel
     runSessions : PLAN.sessions (optionnel) — active l'accord course/muscu
     catalog   : [{name,group,equip,level,primary}]   (allExercises())
     exFactory : (name,sets,reps) => objet exercice de l'appli (ex())
     titles    : {UPPER,LOWER,FULL}  libellés traduits
   }
   ============================================================================ */
(function(){
  'use strict';

  /* ---------- constantes ---------- */
  var HOME_EQUIP = ['Poids du corps','Haltères','Élastique','Kettlebell'];
  var LEVEL_RANK = {'Débutant':0,'Intermédiaire':1,'Avancé':2};
  var SLOTS = {
    UPPER: [['Pectoraux',1],['Dos',2],['Épaules',1],['Biceps',1],['Triceps',1],['Abdominaux',1]],
    LOWER: [['Quadriceps',1],['Ischios',1],['Fessiers',1],['Mollets',1],['Abdominaux',1]],
    FULL:  [['Quadriceps',1],['Ischios',1],['Pectoraux',1],['Dos',1],['Épaules',1],['Abdominaux',1]]
  };
  var KINDS_BY_COUNT = { 1:['FULL'], 2:['LOWER','UPPER'], 3:['LOWER','UPPER','FULL'] };
  var SCHEMES = {
    ADAPT: { sets:3, reps:'12-15', rpe:6 },   // endurance de force
    HYPER: { sets:3, reps:'8-12',  rpe:7 },   // volume
    FORCE: { sets:4, reps:'4-6',   rpe:8 },   // force
    MAINT: { sets:2, reps:'6-8',   rpe:7 },   // entretien (phase de pic)
    TAPER: { sets:2, reps:'8',     rpe:5 }    // affûtage : léger
  };
  var RUN_PHASE_TO_SCHEME = { PG:'ADAPT', AERO:'HYPER', VO2:'FORCE', SPE:'FORCE', PIC:'MAINT', TAPER:'TAPER' };
  var STANDALONE_CYCLE = ['ADAPT','HYPER','FORCE'];            // un bloc = 4 semaines
  var HARD_FALLBACK = ['TEMPO','TEMPO_SPE','FARTLEK','PROGRESSIF','COTES','SPE','SPE_COURT','SEUIL','DBLSEUIL','VMAc','VMAl','VO2','INTERVAL','COURSE'];
  var LONG_FALLBACK = ['LONG','LONG_COURT'];
  var DEFAULT_TITLES = { UPPER:'Haut du corps', LOWER:'Jambes', FULL:'Corps entier' };
  var MAX_WEEKS = 28;

  /* ---------- utilitaires purs ---------- */
  function hashStr(s){ var h=2166136261; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
  function rng(seed){ var a=seed>>>0; return function(){ a=(a+0x6D2B79F5)>>>0; var t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
  function parseKey(k){ var p=k.split('-'); return new Date(+p[0],+p[1]-1,+p[2],12,0,0); }
  function keyOf(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function addDays(k,n){ var d=parseKey(k); d.setDate(d.getDate()+n); return keyOf(d); }
  function mondayOf(k){ var d=parseKey(k); d.setDate(d.getDate()-((d.getDay()+6)%7)); return keyOf(d); }
  function diffDays(a,b){ return Math.round((parseKey(b)-parseKey(a))/86400000); }

  function isHardRun(s){
    if(!s || !(s.km>0) || s.baseType==='Repos') return false;
    if(typeof planIsHard==='function' && planIsHard(s)) return true;
    if(typeof planIsLong==='function' && planIsLong(s)) return true;
    return HARD_FALLBACK.indexOf(s.baseType)>=0 || LONG_FALLBACK.indexOf(s.baseType)>=0;
  }

  /* ---------- semaines du plan de course (phases + décharges) ---------- */
  function runWeekInfo(runSessions){
    var info = {}, order = [];
    (runSessions||[]).forEach(function(s){
      if(!s || !s.date) return;
      var m = mondayOf(s.date), w = info[m];
      if(!w){ w = info[m] = { km:0, phaseKey:null }; order.push(m); }
      w.km += +s.km||0;
      if(!w.phaseKey && s.phaseKey) w.phaseKey = s.phaseKey;
    });
    order.sort();
    order.forEach(function(m,i){            // décharge = semaine nettement plus légère que la précédente
      var prev = i>0 ? info[order[i-1]].km : 0;
      info[m].deload = i>0 && prev>0 && info[m].km < prev*0.85 && info[m].phaseKey!=='TAPER';
    });
    return info;
  }

  /* ---------- choix des exercices ---------- */
  function filterCatalog(catalog, group, o){
    function pass(e, strictLevel, strictEquip){
      if(e.group!==group) return false;
      if(strictLevel && (LEVEL_RANK[e.level]==null ? 1 : LEVEL_RANK[e.level]) > o.levelRank) return false;
      if(strictEquip && o.equip==='maison' && HOME_EQUIP.indexOf(e.equip)<0) return false;
      return true;
    }
    var list = catalog.filter(function(e){ return pass(e,true,true); });
    if(!list.length) list = catalog.filter(function(e){ return pass(e,false,true); });
    if(!list.length) list = catalog.filter(function(e){ return pass(e,false,false); });
    return list.sort(function(a,b){ return a.name<b.name?-1:(a.name>b.name?1:0); });
  }
  function pickExercise(list, used, seedKey){
    var pool = list.filter(function(e){ return used.indexOf(e.name)<0; });
    if(!pool.length) return null;
    return pool[Math.floor(rng(hashStr(seedKey))()*pool.length)];
  }

  function schemeForWeek(w, runInfo, mondayKey, weeksTotal, raceDate){
    var linked = !!runInfo, ri = linked ? runInfo[mondayKey] : null, key, deload=false, phaseKey=null;
    if(ri){
      phaseKey = ri.phaseKey;
      key = RUN_PHASE_TO_SCHEME[phaseKey] || 'HYPER';
      deload = !!ri.deload;
    } else {
      key = STANDALONE_CYCLE[Math.floor(w/4) % STANDALONE_CYCLE.length];
      deload = (w+1)%4===0;
    }
    if(raceDate){                                // les 2 dernières semaines avant la course = affûtage
      var d = diffDays(mondayKey, raceDate);
      if(d>=0 && d<14){ key='TAPER'; phaseKey='TAPER'; deload=false; }
    }
    return { scheme:key, deload:deload, phaseKey:phaseKey||(deload?'DELOAD':key) };
  }

  function buildExercises(kind, w, ctx, sc){
    var block = Math.floor(w/4), posInBlock = w%4, S = SCHEMES[sc.scheme], out = [], used = [];
    SLOTS[kind].forEach(function(slot, si){
      for(var n=0;n<slot[1];n++){
        var list = filterCatalog(ctx.catalog, slot[0], ctx);
        var e = pickExercise(list, used, ctx.seed+'|'+block+'|'+kind+'|'+slot[0]+'|'+n);   // stable pendant un bloc de 4 semaines
        if(!e) continue;
        used.push(e.name);
        var main = (si===0 && n===0) || (kind==='FULL' && si<4);    // exercices principaux = séries pleines
        var sets = main ? S.sets : Math.max(2, S.sets-1);
        if(main && posInBlock===2 && sc.scheme!=='TAPER' && !sc.deload) sets = Math.min(5, sets+1);   // surcharge progressive
        if(sc.deload) sets = Math.max(2, Math.round(sets*0.6));
        var reps = S.reps;
        out.push(ctx.exFactory ? ctx.exFactory(e.name, sets, reps) : { name:e.name, sets:sets, reps:reps, muscles:e.primary||[e.group] });
      }
    });
    return out;
  }

  /* ---------- placement des séances dans la semaine ---------- */
  function placeWeek(mondayKey, kinds, ctx, w){
    var placed = [], skipped = [], r = rng(hashStr(ctx.seed+'|place|'+w));
    var order = kinds.slice().sort(function(a,b){ return (b!=='UPPER') - (a!=='UPPER'); });   // jambes d'abord : ce sont les plus contraintes
    order.forEach(function(kind){
      var legs = (kind==='LOWER' || kind==='FULL'), best = null;
      for(var d=0; d<7; d++){
        if(ctx.days.length && ctx.days.indexOf(d)<0) continue;
        var dk = addDays(mondayKey,d);
        if(ctx.raceDate && dk>=addDays(ctx.raceDate,-1)) continue;                 // jamais la veille / le jour de la course
        var today = ctx.runByDate[dk], next = ctx.runByDate[addDays(dk,1)], prev = ctx.runByDate[addDays(dk,-1)], score = 0;
        if(legs){
          if(isHardRun(today) || isHardRun(next)) continue;                          // règle dure : pas de jambes avant/pendant une séance dure
          if(ctx.raceDate && diffDays(dk,ctx.raceDate)<=5) continue;                 // affûtage : pas de jambes lourdes
          if(isHardRun(prev)) score += 1;                                            // idéalement ≥ 48 h après une séance dure
        } else if(isHardRun(today)) score += 1;
        if(today && !isHardRun(today)) score += 0.5;                                 // préférer un jour sans course
        var clash=false;
        placed.forEach(function(p){
          var gap = Math.abs(diffDays(p.date,dk));
          if(gap===0) clash=true;
          else if(gap===1) score += (legs && p.kind!=='UPPER') ? 8 : 3;                // deux jours de jambes d'affilée : à éviter fortement
        });
        if(clash) continue;
        score += r()*0.4;                                                            // départage reproductible
        if(!best || score<best.score) best = { date:dk, dow:d, score:score };
      }
      if(best) placed.push({ kind:kind, date:best.date, dow:best.dow }); else skipped.push(kind);
    });
    placed.sort(function(a,b){ return a.date<b.date?-1:1; });
    return { placed:placed, skipped:skipped };
  }

  /* ---------- validation ---------- */
  function validateStrengthPlan(plan, runSessions){
    var errors = [], byDate = {}, seenDay = {}, seenId = {};
    (runSessions||[]).forEach(function(s){ if(s && s.date && s.baseType!=='Repos' && s.km>0) byDate[s.date]=s; });
    var perWeek = {};
    (plan.sessions||[]).forEach(function(s){
      if(seenId[s.id]) errors.push('dupId:'+s.id); seenId[s.id]=1;
      if(seenDay[s.date]) errors.push('twoOnSameDay:'+s.date); seenDay[s.date]=1;
      if(s.legsHeavy && (isHardRun(byDate[s.date]) || isHardRun(byDate[addDays(s.date,1)]))) errors.push('legsBeforeHard:'+s.date);
      if(plan.raceDate && s.date>=addDays(plan.raceDate,-1)) errors.push('afterRace:'+s.date);
      var m = mondayOf(s.date); perWeek[m]=(perWeek[m]||0)+1;
      if(!s.ex || !s.ex.length) errors.push('emptySession:'+s.date);
    });
    Object.keys(perWeek).forEach(function(m){ if(perWeek[m]>plan.perWeek) errors.push('tooMany:'+m); });
    return { ok:errors.length===0, errors:errors };
  }

  /* ---------- générateur ---------- */
  function strengthBuild(opts){
    opts = opts || {};
    var perWeek = +opts.perWeek; if(!(perWeek>=1 && perWeek<=3)) return { err:'perWeek' };
    var catalog = opts.catalog; if(!catalog || !catalog.length) return { err:'noCatalog' };
    var runSessions = (opts.runSessions||[]).filter(function(s){ return s && s.date; });
    var linked = runSessions.length>0;
    var firstRun = linked ? runSessions.map(function(s){return s.date;}).sort()[0] : null;
    var startDate = opts.startDate || firstRun || keyOf(new Date());
    var startMonday = mondayOf(startDate);
    var weeks = +opts.weeks;
    if(!weeks){
      if(linked){ var lastRun = runSessions.map(function(s){return s.date;}).sort().pop(); weeks = Math.ceil((diffDays(startMonday,lastRun)+1)/7); }
      else weeks = 12;
    }
    weeks = Math.max(1, Math.min(MAX_WEEKS, weeks));
    var seed = (opts.seed!=null ? opts.seed : 1)|0;
    var ctx = {
      catalog: catalog, seed: seed, exFactory: opts.exFactory||null,
      levelRank: LEVEL_RANK[opts.level]==null ? 1 : LEVEL_RANK[opts.level],
      equip: opts.equip||'both', days: (opts.days||[]).filter(function(d){return d>=0&&d<=6;}),
      raceDate: opts.raceDate||null, runByDate:{}
    };
    runSessions.forEach(function(s){ if(s.baseType!=='Repos' && s.km>0) ctx.runByDate[s.date]=s; });
    var runInfo = linked ? runWeekInfo(runSessions) : null;
    var titles = Object.assign({}, DEFAULT_TITLES, opts.titles||{});
    var sessions = [], warnings = [], uid = 0;

    for(var w=0; w<weeks; w++){
      var mk = addDays(startMonday, 7*w);
      if(ctx.raceDate && mk>ctx.raceDate) break;
      var sc = schemeForWeek(w, runInfo, mk, weeks, ctx.raceDate);
      var count = perWeek;
      if(sc.scheme==='TAPER') count = Math.min(count, 2);
      else if(sc.deload) count = Math.max(1, count-1);                    // muscu réduite en décharge
      var kinds = KINDS_BY_COUNT[count] || KINDS_BY_COUNT[1];
      var pl = placeWeek(mk, kinds, ctx, w);
      pl.skipped.forEach(function(k){ warnings.push('skipped:'+k+':'+mk); });
      pl.placed.forEach(function(p){
        var exs = buildExercises(p.kind, w, ctx, sc);
        var sets = exs.reduce(function(a,e){ return a+(e.sets||0); },0);
        sessions.push({
          id:'st'+(++uid), date:p.date, dow:p.dow, week:w+1, phaseKey:sc.phaseKey, scheme:sc.scheme,
          kind:p.kind, title:titles[p.kind], deload:sc.deload,
          legsHeavy:(p.kind==='LOWER' || p.kind==='FULL') && !sc.deload && sc.scheme!=='TAPER',
          duration:Math.round(sets*1.8)+8, ex:exs, done:false
        });
      });
    }
    if(!sessions.length) return { err:'noSession' };
    var plan = {
      v:1, kind:'strength', seed:seed, created:startDate, startDate:startMonday, weeks:weeks, perWeek:perWeek,
      level:opts.level||'Intermédiaire', equip:ctx.equip, days:ctx.days, raceDate:ctx.raceDate,
      linkedRun:linked, warnings:warnings, sessions:sessions
    };
    var v = validateStrengthPlan(plan, runSessions);
    if(!v.ok) return { err:'invalid', errors:v.errors };
    return { plan:plan };
  }

  window.strengthBuild = strengthBuild;
  window.validateStrengthPlan = validateStrengthPlan;
  window.strengthIsLegMuscle = function(name){ return /quadri|ischio|fessier|mollet|cuisse|adducteur|abducteur|jamb|leg|hip|glute|hamstring|calf/i.test(String(name||'')); };
})();
