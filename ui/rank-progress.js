/* ============================================================================
   IKORUN — Écran « Progression » (héros du rang + progression + grille des 8 rangs)
   ui/rank-progress.js — dépend de ui/rank-badges.js, BADGE_TIERS, badgeProgress,
   badgeHintText, unlockedBadges. Insérer le résultat en tête de renderBadgeGallery()
   (patch dans PATCHES.md). Données réelles : rien n'est codé en dur.
   ============================================================================ */
function rankProgressHTML(){
  const unlocked = unlockedBadges(), ukeys = new Set(unlocked.map(function(u){ return u.key; }));
  let curIdx = 0; BADGE_TIERS.forEach(function(b,i){ if(ukeys.has(b.key)) curIdx = i; });
  const cur = BADGE_TIERS[curIdx], next = BADGE_TIERS[curIdx+1] || null;
  let h = '<div class="ik-rank-hero '+cur.cls+'">'+
    '<div class="ik-rank-halo"></div><div class="ik-rank-badge">'+ikRankSVG(cur.key,{size:150})+'</div>'+
    '<div class="ik-rank-name">'+escHtml(cur.name)+'</div><div class="ik-rank-desc">'+escHtml(cur.desc)+'</div>';
  if(next){
    const prog = badgeProgress(next);
    h += '<div class="ik-rank-next"><div class="row" style="justify-content:space-between;margin-bottom:7px">'+
      '<span style="font-size:12px;color:var(--muted)">'+tp('nextBadgeLab',escHtml(next.name))+'</span>'+
      '<span class="mono" style="font-size:12px;color:var(--et,var(--e))">'+prog.pct+'%</span></div>'+
      '<div class="pbar" style="height:7px"><div style="width:'+prog.pct+'%"></div></div>'+
      '<div class="ik-conds">'+prog.parts.map(function(p){
        const ok = p.have>=p.need;
        return '<div class="ik-cond"><span>'+escHtml(p.label)+'</span><span>'+(ok?'<b class="ok">'+fmtN(p.have,0)+' / '+fmtN(p.need,0)+' '+p.unit+' ✓</b>':'<b>'+fmtN(p.have,0)+'</b> / '+fmtN(p.need,0)+' '+p.unit)+'</span></div>';
      }).join('')+'</div>'+
      '<div style="font-size:11.5px;color:var(--muted);margin-top:7px;line-height:1.4">'+badgeHintText(prog)+'</div></div>';
  }
  h += '</div><div class="hv7-sec-lab" style="margin:14px 0 8px">'+t('ranksAll')+'</div><div class="ik-rank-grid">'+
    BADGE_TIERS.map(function(b,i){
      const lk = i>curIdx;
      return '<div class="ik-rk '+b.cls+(i===curIdx?' cur':'')+(lk?' lk':'')+'" onclick="openBadgeQuick(\''+b.key+'\')">'+
        (lk?'<div class="ik-rk-lock">'+ICN('lock',10)+'</div>':'')+ikRankSVG(b.key,{size:58})+'<span>'+escHtml(b.name)+'</span></div>';
    }).join('')+'</div>';
  return h;
}
