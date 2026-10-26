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
/* V4.15.0 : une seule LIGNE fine de pastilles (prière avec l'heure, météo avec la température,
   check, course). Plus de carte dépliée sous la rangée : toucher une pastille ouvre sa carte
   dans une fenêtre. Le Ramadan, saisonnier, garde sa carte sous la ligne pendant le mois. */
function homePillLabel(k){
  try{
    if(k==='pray'){ const np=nextPrayerInfo(); return trPrayer(np.name)+' <small>'+np.time+'</small>'; }
    if(k==='wx'){ const w=(typeof wxNow==='function')?wxNow():null; return w?Math.round(w.t)+'°'+((typeof wxLoc==='function'&&wxLoc())?' <small>'+escHtml(wxLoc().name.split(',')[0])+'</small>':''):t('homePillWx'); }
  }catch(e){}
  return t(k==='pray'?'homePillPray':k==='wx'?'homePillWx':k==='check'?'homePillCheck':'homePillRace');
}
function homePillsHTML(){
  const items=[];
  homePillDefs().forEach(function(d){
    let h=''; try{ h=(d.k==='pray'?homePrayerCardHTML():d.html())||''; }catch(e){ console.error('[IKORUN] pill', d.k, e); }
    if(h.trim()) items.push(d);
  });
  let rm=''; try{ rm=(typeof ramadanCardHTML==='function')?ramadanCardHTML():''; }catch(e){}
  if(!items.length) return rm;
  return '<div class="hm-line">'+items.map(function(d){
    return '<button type="button" class="hm-chip" onclick="homePillPick(\''+d.k+'\')">'+ICN(d.icn,15)+'<span>'+homePillLabel(d.k)+'</span>'+(d.k==='check'?'<i aria-hidden="true"></i>':'')+'</button>';
  }).join('')+'</div>'+rm;
}
function homePillPick(k){
  if(k==='pray'){ openPrayerFromHome(); return; }
  if(k==='wx' && typeof openWeather==='function'){ openWeather(); return; }
  const d=homePillDefs().find(function(x){ return x.k===k; }); if(!d) return;
  let h=''; try{ h=d.html()||''; }catch(e){}
  $('#ovProgTitle').textContent=d.lab; $('#progBody').innerHTML=h; openOv('ovProg');
  try{ haptic(); }catch(e){}
}
