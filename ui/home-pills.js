/* ============================================================================
   IKORUN — Accueil à pastilles  (ui/home-pills.js)
   Remplace la pile de cartes Prière / Check / Ramadan / Météo / Course par une rangée
   de pastilles ; une seule carte est dépliée à la fois. Aucun rendu n'est réécrit :
   chaque pastille affiche le HTML des fonctions existantes. Une pastille dont la carte
   est vide (pas de course suivie, check déjà fait…) n'apparaît pas.
   Les « nudges » (invité, installation, fête, permission notifs) restent au-dessus.
   ============================================================================ */
let homePillSel = null;
function homePillDefs(){ return [
  { k:'pray',  icn:'moon',  lab:t('homePillPray'),  html:function(){ return homePrayerCardHTML()+ramadanCardHTML(); } },
  { k:'wx',    icn:'sun',   lab:t('homePillWx'),    html:function(){ return wxHomeCardHTML(); } },
  { k:'check', icn:'check', lab:t('homePillCheck'), html:function(){ return morningCheckHTML(); } },
  { k:'race',  icn:'flag',  lab:t('homePillRace'),  html:function(){ return raceCountdownHTML(); } }
]; }
function homePillsHTML(){
  const items = [];
  homePillDefs().forEach(function(d){
    let h=''; try{ h = d.html() || ''; }catch(e){ console.error('[IKORUN] pill', d.k, e); }
    if(h.trim()) items.push({ d:d, h:h });
  });
  if(!items.length) return '';
  let sel = homePillSel;
  if(!items.some(function(x){ return x.d.k===sel; })){
    try{ sel = localStorage.getItem('ik_home_pill'); }catch(e){}
  }
  if(!items.some(function(x){ return x.d.k===sel; })) sel = items[0].d.k;
  const bar = items.map(function(x){
    return '<button type="button" class="ik-pill'+(x.d.k===sel?' on':'')+'" onclick="homePillPick(\''+x.d.k+'\')">'+ICN(x.d.icn,15)+'<span>'+x.d.lab+'</span>'+
      (x.d.k==='check' && x.d.k!==sel ? '<i class="ik-pill-dot" aria-hidden="true"></i>' : '')+'</button>';   // check du matin pas encore fait
  }).join('');
  const cur = items.find(function(x){ return x.d.k===sel; });
  return '<div class="ik-pills" role="tablist">'+bar+'</div>'+cur.h;
}
function homePillPick(k){
  homePillSel = k;
  try{ localStorage.setItem('ik_home_pill', k); }catch(e){}
  renderHome();
}
