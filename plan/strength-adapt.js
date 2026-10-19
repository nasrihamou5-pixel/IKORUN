/* ============================================================================
   IKORUN — Accord muscu → course  (plan/strength-adapt.js)
   À charger APRÈS plan/adapt.js (même bundle). Réutilise ses primitives :
   adaptApply, adToEasy, adLighten, adEd, adCool, adFired, adPersist, adKeyAdd.
   Règle « legs » : après une séance de jambes lourde, la séance dure
   (qualité ou sortie longue) du LENDEMAIN est allégée (V4.8 : 24 h, plus 48 h — le placement de la
   muscu et du plan de course interdit déjà jambes la veille d'une séance dure, et une séance dure
   deux jours après était sacrifiée à chaque fois, ce qui dégradait la qualité en continu) :
     · qualité  → footing facile de 8 km max   (ex. Seuil 3×2 km → footing 8 km)
     · longue   → −20 % de distance
   Passe par adaptApply : mêmes garde-fous (validatePlan), même journal, « Annuler » inclus.
   ============================================================================ */
function adaptAfterMuscu(e){
  if(!e || !PLAN || !PLAN.sessions) return [];
  const legs = (e.legsHeavy!=null) ? !!e.legsHeavy
    : (e.muscles||[]).filter(function(m){ return window.strengthIsLegMuscle && strengthIsLegMuscle(m); }).length>=2;
  if(!legs || adCool('legs',4)) return [];
  const k = e.date || todayKey(), out = [];
  try{
    const cand = PLAN.sessions
      .filter(function(s){ return s.date>k && s.date<=adKeyAdd(k,1) && adEd(s,k,false) && (planIsHard(s)||planIsLong(s)); })
      .sort(function(a,b){ return a.date<b.date?-1:1; })[0];
    if(cand){
      const label = planSessLabel(cand);
      const r = adaptApply('legs', false, function(pl,pc){
        const s = pl.sessions.find(function(x){ return x.id===cand.id; });
        if(!s) return 0;
        if(planIsHard(s)) return adToEasy(s, Math.min(s.km,8), pc, 'legs') ? 1 : 0;
        return adLighten(s, 0.8, pc, 'legs') ? 1 : 0;
      }, { k:'adMsgLegs', p:[label] });
      if(r) out.push(r);
      adFired('legs');
    }
  }catch(err){ console.error('[IKORUN] adaptAfterMuscu', err); }
  adPersist();
  return out.filter(Boolean);
}
