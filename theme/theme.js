/* ============================================================================
   IKORUN — APPARENCE (V4.0.0 : sorti d'app.js)
   ----------------------------------------------------------------------------
   Mode clair / sombre, couleurs de l'app (ACCENTS), fibre de carbone et
   carbone forgé, matière Covering (WRAPS), couleurs du mode simple, et
   l'éditeur de thème (couleurs OKLCH, contraste WCAG vérifié, verre, reflets).
   Chargé avant app.js dans app.min.js : rien ici ne s'exécute au chargement
   en dehors de constantes ; tout est appelé par app.js une fois le profil lu.
   ============================================================================ */
/* ---------- THEME ---------- */
function effectiveMode(){ return P.mode==='light' ? 'light' : 'dark'; }
function applyTheme(){
  const mode=effectiveMode();
  document.documentElement.setAttribute('data-mode',mode);
  // Covering (V3.10.0) : la teinte du film remplace la couleur de l'app (data-wrap) ; en
  // mode simplifié, le Covering se met en veille et la couleur choisie revient.
  if(P.theme==='clay') P.theme='red'; // couleur « Guimauve » retirée (V3.10.3) : le rouge corail est le plus proche
  const wrap=wrapOn(), acc=wrap?'wrap':P.theme==='forged'?'carbon':(P.theme||'blue'); // le carbone forgé partage les couleurs du carbone
  document.documentElement.setAttribute('data-accent',acc);
  if(wrap) document.documentElement.setAttribute('data-wrap',wrapKey()); else document.documentElement.removeAttribute('data-wrap');
  document.documentElement.classList.toggle('easy-mode',!!P.easyMode);
  if(P.easyMode) document.documentElement.setAttribute('data-ez',ezKey()); else document.documentElement.removeAttribute('data-ez');
  // molettes (V3.5.0) : un réglage posé ailleurs (bascule soleil/lune) les recale
  if(typeof matValue==='function'){
    if(matNearest(matValue())!==(P.glass||'std')) P.mat=Math.max(0,MAT_ANCHORS.indexOf(P.glass||'std'));
    if((lumValue()>=50)!==(mode==='light')) P.lum=mode==='light'?100:0;
  }
  document.documentElement.setAttribute('data-glass',wrap?'wrap':P.glass==='max'?'max':'std'); // matière : Liquid Glass (std), Ultime (max) ou Covering (wrap)
  { const k=(typeof feteOn==='function' && feteOn())?feteToday():null;
    if(k) document.documentElement.setAttribute('data-fete',k); else document.documentElement.removeAttribute('data-fete');
    if(document.body) feteSync(); }
  if(document.body && typeof carbonApply==='function') carbonApply();
  const txCss=(typeof txApply==='function')?txApply():null; // éditeur de thème (V3.14.0)
  if(typeof tiltActive==='function'){ if(tiltActive()) document.documentElement.setAttribute('data-tilt',''); else document.documentElement.removeAttribute('data-tilt'); glareK(); }
  if(typeof lumApply==='function'){ lumApply(); matApply(); }
  if(typeof ikhCompact==='function') ikhCompact();
  // la couleur de la barre d'état suit le fond (voir lumApply)
  // Miroir en clair (mode/accent/easyMode ne sont pas des données sensibles) pour que
  // le script tout en haut de <head> puisse réappliquer le thème avant le premier
  // paint au prochain chargement, sans attendre le déchiffrement async du profil.
  // + les couleurs de l'intro, qui s'affiche avant app.css (voir <style id="ikiCss">)
  try{ const cs=getComputedStyle(document.documentElement), v=n=>cs.getPropertyValue(n).trim();
    localStorage.setItem('ik_theme_prefs', JSON.stringify({mode, accent:acc, easyMode:!!P.easyMode, ez:P.easyMode?ezKey():null, glass:wrap?'wrap':P.glass==='max'?'max':'std',wrap:wrap?wrapKey():null,
      iki:{e:v('--e'),e2:v('--e2'),er:v('--e-rgb'),bg:v('--bg'),mu:v('--muted')}, css:txCss||null,
      fete:document.documentElement.getAttribute('data-fete')||null, feteDay:todayKey()})); }catch(e){}
}
/* ---------- FIBRE DE CARBONE (V3.5.0) ----------
   L'ancien « carbone » n'était qu'une trame de 6 px presque invisible : on voyait du mono.
   Le vrai : une plaque de carbone tressé (sergé 2×2) ou forgé, calculée une fois sur un
   canevas (une tuile sans raccord), posée en fond fixe sous un vernis. Les cartes sont du
   verre fumé par-dessus. Comme une vraie pièce, le tressage ne brille pas partout pareil :
   les mèches parallèles à la lumière s'allument, les autres restent sombres. Deux versions
   de la tuile (lumière à 0° et à 90°) se fondent l'une dans l'autre au défilement ou selon
   l'inclinaison du téléphone : le reflet « bascule » d'une mèche à l'autre. En clair, la
   plaque devient du carbone argent (fibre aluminisée). */
function carbonRng(seed){ let s=seed>>>0||1; return ()=>((s=Math.imul(s^s>>>15,1|s)+0x6D2B79F5|0,((s^s>>>7)>>>0)%100000)/100000); }
function carbonTwill(phi,light,s,tow){
  const cs=Math.round(tow*s), T=cs*4, cv=document.createElement('canvas'); cv.width=cv.height=T;
  const ctx=cv.getContext('2d'), img=ctx.createImageData(T,T), d=img.data, R=carbonRng(7);
  const nH=new Float32Array(T), nV=new Float32Array(T); for(let i=0;i<T;i++){ nH[i]=R()*2-1; nV[i]=R()*2-1; }
  const lum=a=>Math.pow(Math.abs(Math.cos(a)),1.6);
  const pH=lum(phi), pV=lum(phi-Math.PI/2);
  const base=light?185:5, lo=light?205:22, hi=light?248:118;
  const sm=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
  for(let py=0;py<T;py++) for(let px=0;px<T;px++){
    const cx=(px/cs)|0, cy=(py/cs)|0, lx=(px%cs+.5)/cs, ly=(py%cs+.5)/cs, m=(cx+cy)&3, vert=m<2;
    const u=vert?lx:ly, v=vert?(m===0?ly*.5:.5+ly*.5):(m===2?lx*.5:.5+lx*.5);
    const prof=.2+.8*Math.pow(Math.sin(Math.PI*u),.85), end=.38+.62*sm(v/.22)*sm((1-v)/.22);
    const fib=vert?nV[px]:nH[py], peak=lo+(hi-lo)*(vert?pV:pH);
    let g=base+(peak-base)*prof*end*(1+fib*.22)+fib*(light?7:7);
    g+=(light?10:22)*Math.pow(Math.max(0,1-Math.abs(u-.4)*3.2),2)*end*(.3+.7*(vert?pV:pH));
    g=Math.max(0,Math.min(255,g));
    const k=(py*T+px)*4; d[k]=g*.97; d[k+1]=g*.985; d[k+2]=Math.min(255,g*1.05+(light?0:2)); d[k+3]=255;
  }
  ctx.putImageData(img,0,0); return cv;
}
// « Carbone forgé » : des éclats anguleux de mèche broyée, pressés au moule — pas des
// taches rondes (l'ancienne version ressemblait à des microbes) mais une mosaïque à
// arêtes nettes, striée dans le sens de chaque éclat, avec un joint sombre entre eux et
// quelques paillettes qui accrochent la lumière, comme le vrai carbone forgé automobile.
function carbonForged(phi,light,s,size){
  const T=Math.round(size*s), cv=document.createElement('canvas'); cv.width=cv.height=T;
  const ctx=cv.getContext('2d'), R=carbonRng(11);
  ctx.fillStyle=light?'#e6e9ec':'#050506'; ctx.fillRect(0,0,T,T);
  const lum=a=>Math.pow(Math.abs(Math.cos(a)),2.4), N=Math.round(240*(size/150)*(size/150));
  const col=c=>{ c=Math.max(0,Math.min(255,c)); return 'rgb('+(c*.97|0)+','+(c*.985|0)+','+(Math.min(255,c*1.05)|0)+')'; };
  for(let i=0;i<N;i++){
    const x=R()*T, y=R()*T, a=R()*Math.PI*2;
    const R0=(9+Math.pow(R(),1.25)*24)*s, nv=5+((R()*4)|0);
    const pts=[]; for(let j=0;j<nv;j++){ const ang=j/nv*Math.PI*2+(R()-.5)*.55, rr=R0*(.5+.55*R()); pts.push([Math.cos(ang)*rr,Math.sin(ang)*rr*(.66+.34*R())]); }
    const b=lum(a-phi), sparkle=b>.9 && R()<.45;
    let c0=light?(148+b*104):(9+b*98); if(sparkle) c0=light?252:200+R()*45;
    c0+=(R()-.5)*(light?14:12);
    for(const ox of [-T,0,T]) for(const oy of [-T,0,T]){
      const X=x+ox, Y=y+oy; if(X<-R0-4||X>T+R0+4||Y<-R0-4||Y>T+R0+4) continue;
      ctx.save(); ctx.translate(X,Y); ctx.rotate(a);
      ctx.beginPath(); pts.forEach(([px,py],j)=>j?ctx.lineTo(px,py):ctx.moveTo(px,py)); ctx.closePath();
      ctx.fillStyle=col(c0); ctx.fill();
      ctx.save(); ctx.clip(); ctx.globalAlpha=light?.16:.24; ctx.strokeStyle=sparkle?(light?'#fff':'#e8ecf0'):(light?'#5a6068':'#b0b8c2'); ctx.lineWidth=.6*s;
      for(let k=-R0;k<R0;k+=1.35*s){ ctx.beginPath(); ctx.moveTo(-R0*1.4,k); ctx.lineTo(R0*1.4,k+(R()-.5)*2*s); ctx.stroke(); }
      ctx.restore();
      ctx.globalAlpha=1; ctx.lineWidth=.9*s; ctx.strokeStyle=light?'rgba(90,96,104,.55)':'rgba(0,0,0,.75)';
      ctx.beginPath(); pts.forEach(([px,py],j)=>j?ctx.lineTo(px,py):ctx.moveTo(px,py)); ctx.closePath(); ctx.stroke();
      ctx.restore();
    }
  }
  return cv;
}

const _cfCache={};
function carbonKind(){ return !P || wrapOn() ? null : P.theme==='carbon' ? 'twill' : P.theme==='forged' ? 'forged' : null; }
function carbonApply(){
  const root=document.documentElement, k=(P && !P.easyMode)?carbonKind():null;
  let L=document.getElementById('ikCarbon');
  if(!k){ root.removeAttribute('data-carbon'); if(L) L.remove(); return; }
  const light=effectiveMode()==='light', s=Math.min(3,Math.max(2,Math.round(window.devicePixelRatio||2))), key=k+(light?'L':'D')+s;
  if(!_cfCache[key]){
    try{
      const tw=k==='twill', mk=phi=>'url("'+(tw?carbonTwill(phi,light,s,7).toDataURL('image/png'):carbonForged(phi,light,2,150).toDataURL('image/jpeg',.92))+'")';
      _cfCache[key]={a:mk(0),b:mk(Math.PI/2),sz:tw?'28px':'150px'};
    }catch(e){ root.removeAttribute('data-carbon'); return; }
  }
  const C=_cfCache[key];
  if(root.dataset.cfKey!==key){ root.style.setProperty('--cf-a',C.a); root.style.setProperty('--cf-b',C.b); root.style.setProperty('--cf-sz',C.sz); root.dataset.cfKey=key; }
  root.setAttribute('data-carbon',k);
  if(!L){ L=document.createElement('div'); L.id='ikCarbon'; L.setAttribute('aria-hidden','true'); L.innerHTML='<i class="a"></i><i class="b"></i><b></b>'; document.body.insertBefore(L,document.body.firstChild); }
}
/* Couleurs de l'app (V3.4.0 : quinze, V3.13.0 : vingt et une, rangées en familles de variantes). Chacune a son
   fond teinté en sombre et son accent assombri en clair : voir app.css, « COULEURS ». */
const ACCENTS=[
  {key:'blue',name:'accentBlue',fam:'cool'},{key:'navy',name:'accentNavy',fam:'cool'},{key:'ocean',name:'accentOcean',fam:'cool'},{key:'indigo',name:'accentIndigo',fam:'cool'},{key:'violet',name:'accentViolet',fam:'cool'},{key:'lavender',name:'accentLavender',fam:'cool'},
  {key:'pink',name:'accentPink',fam:'warm'},{key:'sakura',name:'accentSakura',fam:'warm'},{key:'coral',name:'accentCoral',fam:'warm'},{key:'red',name:'accentRed',fam:'warm'},{key:'bordeaux',name:'accentBordeaux',fam:'warm'},{key:'orange',name:'accentOrange',fam:'warm'},{key:'yellow',name:'accentYellow',fam:'warm'},
  {key:'green',name:'accentGreen',fam:'nature'},{key:'emerald',name:'accentEmerald',fam:'nature'},{key:'mint',name:'accentMint',fam:'nature'},{key:'teal',name:'accentTeal',fam:'nature'},{key:'brown',name:'accentBrown',fam:'nature'},
  {key:'carbon',name:'accentCarbon',fam:'neutral'},{key:'forged',name:'accentForged',fam:'neutral'},{key:'mono',name:'accentMono',fam:'neutral'}];
function accentName(k){ const a=ACCENTS.find(x=>x.key===k); return a?t(a.name):t('accentBlue'); }
/* Teintes COVERING (V3.10.0) : avec la matière Covering, le menu Couleurs propose des
   teintes de film. Chacune est une configuration complète — le film, le noir brillant et
   UNE seule couleur d'étriers (ou de jantes) qui va avec ; leurs valeurs sont dans app.css
   (html[data-wrap], contrastes vérifiés). La couleur choisie hors Covering (P.theme) est
   gardée de côté et revient si on repasse au Liquid Glass. */
// V3.10.2 : quatre teintes seulement, toutes sur le modèle du Noir Satiné rouge (un film
// profond, UNE couleur vive qui brille). Les teintes retirées (V3.10.0 et V3.10.1) sont
// recalées sur la plus proche.
const WRAPS=[
  {key:'noir',name:'wrapNoir',det:'wrapCalRed'},{key:'mat',name:'wrapMat',det:'wrapCalYellow'},
  {key:'stealth',name:'wrapStealth',det:'wrapTrimSilver'},{key:'anthracite',name:'wrapAnthracite',det:'wrapCalBlue'},
  {key:'nuit',name:'wrapNuit',det:'wrapCalOrange'}];
const WRAP_OLD={militaire:'noir',craie:'noir',graphite:'anthracite',grenat:'noir',nardo:'noir',bordeaux:'mat',glacier:'anthracite'};
function wrapOn(){ return !!P && P.glass==='wrap' && !P.easyMode; }
function wrapKey(){ if(P && WRAP_OLD[P.wrap]) P.wrap=WRAP_OLD[P.wrap]; return WRAPS.some(w=>w.key===P.wrap) ? P.wrap : 'noir'; }
function wrapName(k){ const w=WRAPS.find(x=>x.key===k)||WRAPS[0]; return t(w.name); }
function colorNameNow(){ return P.easyMode ? t('ezCol_'+ezKey()) : wrapOn() ? wrapName(wrapKey()) : accentName(P.theme); }
function colorDotNow(){ return P.easyMode ? '<i class="ez-dot mini" data-ez="'+ezKey()+'"></i>' : wrapOn() ? '<i class="wrap-sw mini" data-w="'+wrapKey()+'"></i>'
  : '<i class="accent-dot" data-a="'+(P.theme||'blue')+'" style="display:inline-block;width:14px;height:14px;vertical-align:-2px;margin-inline-end:6px;box-shadow:none"></i>'; }
function setWrap(k){
  if(!WRAPS.some(w=>w.key===k)) return;
  P.wrap=k; saveAll(); applyTheme();
  if($('#s-profil')&&$('#s-profil').classList.contains('on')) renderProfile();
  refreshPfSheet(); sfx&&sfx('tap'); toast(t('colorApplied'));
}
// Profil › Couleur de l'app : une fiche par familles, chaque variante avec son nom.
function pfColorHTML(){
  if(P.easyMode){
    const cur=ezKey();
    return '<div class="acc-grid ez-colors">'+EZ_COLORS.map(k=>{ const a=ACCENTS.find(x=>x.key===k);
      return '<div class="acc-sw'+(cur===k?' on':'')+'" role="button" onclick="setEzColor(\''+k+'\')"><i class="ez-dot" data-ez="'+k+'"></i><span>'+t('ezCol_'+k)+'</span></div>'; }).join('')+'</div>';
  }
  if(wrapOn()){
    const cw=wrapKey();
    return '<div class="acc-grid wrap-grid">'+WRAPS.map(w=>'<div class="acc-sw'+(cw===w.key?' on':'')+'" role="button" onclick="setWrap(\''+w.key+'\')"><i class="wrap-sw" data-w="'+w.key+'"></i><span>'+t(w.name)+'</span><small>'+t(w.det)+'</small></div>').join('')+'</div>'+
      '<div class="wrap-note">'+t('wrapColorsNote')+'</div>';
  }
  // V3.14.0 : neuf couleurs de base, les nuances de celle choisie et l'éditeur (voir pfBaseColorsHTML)
  return pfBaseColorsHTML();
}
/* Couleur du MODE SIMPLE (V3.12.1) : retour du 05/10 « les couleurs ne marchent pas dans le
   mode simple » — le vert mat était imposé, et toucher une couleur dans Apparence ne changeait
   rien. Le mode simple a désormais sa propre couleur (vert par défaut), parmi huit teintes
   mates construites sur le même modèle que le vert (contrastes vérifiés). La couleur du mode
   normal (P.theme) n'est pas touchée. */
const EZ_COLORS=['green','teal','blue','violet','red','orange','brown','mono'];
function ezKey(){ return (P && EZ_COLORS.includes(P.ezTheme)) ? P.ezTheme : 'green'; }
function setEzColor(k){
  if(!EZ_COLORS.includes(k)) return;
  P.ezTheme=k; saveAll(); applyTheme();
  if($('#s-profil')&&$('#s-profil').classList.contains('on')) renderProfile();
  refreshPfSheet(); sfx&&sfx('tap'); toast(t('colorApplied'));
}
/* ===== ÉDITEUR DE THÈME (V3.14.0) =====
   Couleurs de base : une par teinte (bleu, vert, rouge, orange, violet, rose, jaune / or, marron,
   gris / carbone) ; chacune garde ses nuances d'avant (Bleu nuit, Océan…). « Personnaliser »
   ouvre un éditeur : teinte 0–360, saturation, luminosité, niveau du fond (noir OLED →
   anthracite, et l'équivalent en clair), teinte du fond, verre (flou, opacité, brillance, ou
   coupé) et reflets selon l'inclinaison. Le thème est CALCULÉ (couleurs OKLCH, comme les teintes
   de V3.13.0) et écrit dans une feuille <style id="ikTx"> dont la priorité passe devant les
   couleurs prédéfinies ; un miroir en clair (ik_theme_prefs.css) la repose avant la première
   image au lancement suivant — pas de flash. Garde-fous de contraste : accent ≥ 5:1 sur le fond,
   textes secondaires ≥ 4,5:1 sur les surfaces, texte du bouton blanc ou foncé selon ce qui se
   lit le mieux (≥ 4,5:1). Rangé dans P.tx (profil), donc synchronisé comme le reste du profil,
   y compris en invité. Sans effet en mode simplifié et en Covering, qui ont leurs propres teintes. */
const BASE_HUES=[['blue','hue_blue',['blue','navy','ocean','indigo']],['green','hue_green',['green','emerald','mint','teal']],['red','hue_red',['red','coral','bordeaux']],
  ['orange','hue_orange',['orange']],['violet','hue_violet',['violet','lavender']],['pink','hue_pink',['pink','sakura']],['yellow','hue_gold',['yellow']],
  ['brown','hue_brown',['brown']],['carbon','hue_grey',['carbon','forged','mono']]];
function baseOfAccent(k){ const b=BASE_HUES.find(x=>x[2].includes(k)); return b?b[0]:'blue'; }
// réglages de l'éditeur qui redonnent chaque couleur prédéfinie : [teinte, saturation, luminosité, fond, teinte du fond]
const TX_SEEDS={blue:[261,76,40,52,20],navy:[266,71,40,50,85],ocean:[233,63,57,52,61],indigo:[279,73,43,50,60],violet:[295,87,37,53,64],lavender:[295,57,65,56,53],pink:[358,84,53,53,49],sakura:[353,50,79,57,34],coral:[32,71,55,50,53],red:[30,85,47,49,44],bordeaux:[8,71,45,50,72],orange:[54,71,62,54,50],yellow:[89,71,85,56,42],green:[134,73,55,56,30],emerald:[158,62,65,50,54],mint:[160,77,79,59,62],teal:[185,55,62,60,49],brown:[63,55,46,55,24],carbon:[256,5,83,40,0],forged:[256,5,83,40,0],mono:[258,2,100,43,0]};
// ---- couleurs : sRGB ↔ OKLCH (Björn Ottosson), contraste WCAG ----
const _okLin=v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4), _okUnlin=v=>v<=0.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-0.055;
function okFromHex(h){ const n=parseInt(h.slice(1),16); return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]; }
function okHex(c){ return '#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v*255))).toString(16).padStart(2,'0')).join('').toUpperCase(); }
function okLum(c){ const [r,g,b]=c.map(_okLin); return .2126*r+.7152*g+.0722*b; }
function okCR(a,b){ const x=okLum(a), y=okLum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
function okLCH(L,C,H){ // → sRGB 0..1 dans le gamut (la saturation baisse jusqu'à rentrer)
  for(let c=C;;c-=0.002){ const k=Math.max(0,c), A=k*Math.cos(H*Math.PI/180), B=k*Math.sin(H*Math.PI/180);
    let l=L+0.3963377774*A+0.2158037573*B, m=L-0.1055613458*A-0.0638541728*B, s=L-0.0894841775*A-1.2914855480*B; l=l*l*l; m=m*m*m; s=s*s*s;
    const lin=[4.0767416621*l-3.3077115913*m+0.2309699292*s,-1.2684380046*l+2.6097574011*m-0.3413193965*s,-0.0041960863*l-0.7034186147*m+1.7076147010*s];
    if(k<=0 || lin.every(v=>v>=-1e-4&&v<=1+1e-4)) return lin.map(v=>_okUnlin(Math.max(0,Math.min(1,v)))); }
}
const _okRGB=c=>c.map(v=>Math.round(Math.max(0,Math.min(1,v))*255)).join(',');
const _okW=[1,1,1], _okInk=okFromHex('#111418');
function txDefaults(base){ const s=TX_SEEDS[base]||TX_SEEDS.blue; return {on:true,base:base,h:s[0],s:s[1],l:s[2],bg:s[3],tint:s[4],gCustom:false,gOn:true,blur:22,op:62,shine:55}; }
function txActive(){ return !!(P && P.tx && P.tx.on && !P.easyMode && !wrapOn()); }
function txNum(v,a,b,d){ v=+v; return Number.isFinite(v)?Math.max(a,Math.min(b,v)):d; }
function txClean(p){ const d=txDefaults(p&&TX_SEEDS[p.base]?p.base:'blue'); p=Object.assign({},d,p||{});
  return {on:!!p.on,base:TX_SEEDS[p.base]?p.base:'blue',h:txNum(p.h,0,360,d.h),s:txNum(p.s,0,100,d.s),l:txNum(p.l,0,100,d.l),bg:txNum(p.bg,0,100,d.bg),tint:txNum(p.tint,0,100,d.tint),
    gCustom:!!p.gCustom,gOn:p.gOn!==false,blur:txNum(p.blur,0,40,22),op:txNum(p.op,15,100,62),shine:txNum(p.shine,0,100,55)}; }
// Le thème complet, en sombre et en clair : { dark:{--var:valeur}, light:{…} }
function txBuild(p){
  p=txClean(p);
  const H=p.h, C=0.24*p.s/100, tk=2.2*p.tint/100, out={};
  // ---- sombre : du noir OLED (0) à l'anthracite (100)
  const b0=0.27*p.bg/100, D={bg:[0,.022],s1:[.05,.030],s2:[.08,.036],s3:[.12,.042],marineL:[.145,.07],hair:[.11,.032],hair2:[.155,.040]}, d={};
  Object.keys(D).forEach(k=>{ d[k]=okLCH(Math.min(.6,b0+D[k][0]),D[k][1]*tk,H); });
  let Le=0.50+0.40*p.l/100; while(Math.min(okCR(okLCH(Le,C,H),d.bg),okCR(okLCH(Le,C,H),d.s2))<4.8 && Le<0.98) Le+=0.01;
  const e=okLCH(Le,C,H), e2=okLCH(Math.min(.97,Le+0.12),C*0.75,H);
  // bouton : comme les couleurs prédéfinies, un dégradé assez foncé pour un texte blanc (≥ 4,8:1) ;
  // les accents très clairs (jaune, gris clair) gardent un bouton clair et un texte foncé
  let Lg=Le; if(Le<0.80) while(okCR(_okW,okLCH(Lg,C*0.95,H))<4.8 && Lg>0.05) Lg-=0.01;
  out.dark=txTokens(d,e,e2,okLCH(Math.min(.98,Lg+0.06),C*0.95,H),okLCH(Lg,C*0.95,H),okLCH(Math.max(0,Lg-0.07),C*0.9,H),false);
  // ---- clair : du blanc pur (0) au gris doux (100)
  const lb=0.985-0.06*p.bg/100, Lt={bg:[0,.010],s1:[.028,0],s2:[-.028,.020],s3:[-.057,.028],marineL:[-.047,.040],hair:[-.067,.024],hair2:[-.132,.036]}, l={};
  Object.keys(Lt).forEach(k=>{ l[k]=okLCH(Math.min(1,lb+Lt[k][0]),Lt[k][1]*1.2*tk,H); });
  let Ll=Math.min(0.62,Le-0.26); const okL=x=>Math.min(okCR(okLCH(x,C,H),_okW),okCR(okLCH(x,C,H),l.bg),okCR(okLCH(x,C,H),l.s2));
  while(okL(Ll)<5 && Ll>0.05) Ll-=0.01;
  const le=okLCH(Ll,C,H), le2=okLCH(Math.max(0,Ll-0.08),C*0.9,H);
  out.light=txTokens(l,le,le2,okLCH(Math.min(.95,Ll+0.06),C,H),le,le2,true);
  // ---- verre (si réglé dans l'éditeur ; sinon la matière choisie garde le sien)
  if(p.gCustom){ [['dark',out.dark,.30],['light',out.light,.95]].forEach(([m,o,a])=>{
    if(!p.gOn){ o['--lg-blur']='none'; o['--glass-blur']='0px'; o['--lg-fill']='rgb(var(--s1-rgb))'; o['--glass-bg']='rgb(var(--s1-rgb))'; o['--glass-bg-2']='rgb(var(--s2-rgb))';
      o['--lg-spec']='linear-gradient(transparent,transparent)'; o['--glass-shine']='linear-gradient(transparent,transparent)'; return; }
    const op=(p.op/100).toFixed(2), sh=(a*p.shine/100).toFixed(3);
    o['--lg-blur']=p.blur<0.5?'none':'blur('+p.blur+'px) saturate(170%)'; o['--glass-blur']=p.blur+'px';
    o['--lg-fill']='rgba(var(--s1-rgb),'+op+')'; o['--glass-bg']='rgba(var(--s1-rgb),'+op+')'; o['--glass-bg-2']='rgba(var(--s2-rgb),'+Math.min(1,+op+.04).toFixed(2)+')';
    o['--lg-spec']='radial-gradient(130% 80% at 10% -18%,rgba(255,255,255,'+sh+'),transparent 55%)';
    o['--glass-shine']='linear-gradient(155deg,rgba(255,255,255,'+sh+') 0%,rgba(255,255,255,'+(sh/4).toFixed(3)+') 22%,rgba(255,255,255,0) 45%)'; }); }
  return out;
}
function txTokens(S,e,e2,g1,g2,g3,light){
  const o={'--e':okHex(e),'--e2':okHex(e2),'--e-rgb':_okRGB(e),'--e2-rgb':_okRGB(e2)};
  ['bg','s1','s2','s3','marineL','hair','hair2'].forEach(k=>{ o['--'+k]=okHex(S[k]); });
  ['bg','s1','s2','s3'].forEach(k=>{ o['--'+k+'-rgb']=_okRGB(S[k]); });
  o['--grad-btn']='linear-gradient(180deg,'+okHex(g1)+','+okHex(g2)+' 55%,'+okHex(g3)+')';
  // texte posé sur l'accent : blanc ou foncé, le plus lisible des deux (≥ 4,5:1 visé)
  const w=okCR(_okW,g2), k=okCR(_okInk,g2);
  if(w>=4.6 || w>=k){ o['--accent-ink']='#FFFFFF'; o['--accent-ink-shadow']='0 1px 2px rgba(0,0,0,.45)'; }
  else { o['--accent-ink']='#111418'; o['--accent-ink-shadow']='none'; }
  // textes secondaires toujours lisibles sur les surfaces (fond anthracite ou gris doux)
  const base=light?{dim:'#5F6675',muted:'#525A68'}:{dim:'#8B94A7',muted:'#97A0B2'};
  Object.keys(base).forEach(k=>{ let c=okFromHex(base[k]), i=0;
    while(Math.min(okCR(c,S.s2),okCR(c,S.bg))<4.6 && i++<40) c=c.map(v=>light?Math.max(0,v-0.02):Math.min(1,v+0.02));
    o['--'+k]=okHex(c); });
  return o;
}
function txCSS(p){
  const T=txBuild(p), sel='html:not(#ik-tx):not(#ik-tx2)', body=o=>Object.keys(o).map(k=>k+':'+o[k]).join(';');
  return sel+'{'+body(T.dark)+'}'+sel+'[data-mode="light"]{'+body(T.light)+'}';
}
function txApply(){
  const root=document.documentElement; let st=document.getElementById('ikTx');
  // V4.0.0 : pendant une fête, ses couleurs passent devant le thème perso, qui revient ensuite tel quel
  if(!txActive() || (typeof feteOn==='function' && feteOn())){ if(st) st.remove(); delete root.dataset.tx; return null; }
  const css=txCSS(P.tx);
  if(!st){ st=document.createElement('style'); st.id='ikTx'; document.head.appendChild(st); }
  if(st.textContent!==css) st.textContent=css;
  root.dataset.tx=String(_fnvTx(css)); // change de clé pour les caches de lumApply / matApply
  return css;
}
function _fnvTx(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }

// ---- interface de l'éditeur (Profil › Apparence › Personnaliser) ----
function txState(){ // réglages en cours : ceux enregistrés, ou ceux de la couleur actuelle
  if(P.tx && P.tx.on) return txClean(P.tx);
  const cur=P.theme||'blue', d=txDefaults(cur), keep=P.tx||{};
  if(keep.gCustom){ d.gCustom=true; d.gOn=keep.gOn!==false; d.blur=keep.blur; d.op=keep.op; d.shine=keep.shine; }
  return txClean(Object.assign(d,{on:false}));
}
function openThemeEditor(){ if(P.easyMode||wrapOn()) return; openProfileSection('theme'); }
function txRow(key,lab,min,max,val,ends,extra){
  return '<div class="tx-row'+(extra&&extra.off?' off':'')+'"><div class="tx-row-h"><label for="tx_'+key+'">'+lab+'</label><b id="txv_'+key+'">'+txValLab(key,val)+'</b></div>'+
    '<input class="tx-range tx-'+key+'" id="tx_'+key+'" type="range" min="'+min+'" max="'+max+'" step="1" value="'+Math.round(val)+'"'+(extra&&extra.off?' disabled':'')+
    ' oninput="txInput(\''+key+'\',this.value)" onchange="txCommit()">'+(ends?'<div class="tx-ends"><span>'+ends[0]+'</span><span>'+ends[1]+'</span></div>':'')+'</div>';
}
function txValLab(key,v){ v=Math.round(+v); return key==='h'?v+'°':key==='blur'?v+' px':v+' %'; }
function pfThemeEditorHTML(){
  const p=txState(), light=effectiveMode()==='light', reduce=(()=>{ try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } })();
  const tiltK=txNum(P.tiltK,0,100,60);
  let h='<div class="tx-ed" id="txEd" style="--tx-hue:'+Math.round(p.h)+'"><div class="tx-prev" aria-hidden="true"><div class="tx-prev-bg"><i></i><i></i></div>'+
    '<div class="card tx-prev-card"><div class="tx-prev-top"><span class="pill on">'+t('today')+'</span><span class="tx-prev-meta">8 km · 5:37/km</span></div>'+
    '<div class="tx-prev-t">'+t('txPreviewTitle')+'</div><div class="pbar"><div style="width:62%"></div></div>'+
    '<button type="button" class="btn sm" tabindex="-1">'+t('txPreviewBtn')+'</button></div></div>';
  h+='<div class="lab ap-lab">'+t('txColorLab')+'</div>'+
    txRow('h',t('txHue'),0,360,p.h)+txRow('s',t('txSat'),0,100,p.s)+txRow('l',t('txLight'),0,100,p.l);
  h+='<div class="lab ap-lab">'+t('txBgLab')+'</div>'+
    txRow('bg',t('txBgLevel'),0,100,p.bg,light?[t('txBgWhite'),t('txBgSoftGrey')]:[t('txBgOled'),t('txBgAnthracite')])+
    txRow('tint',t('txBgTint'),0,100,p.tint,[t('txNeutral'),t('txTinted')]);
  h+='<div class="lab ap-lab">'+t('txGlassLab')+'</div>'+
    '<div class="ap-opt"><div><b>'+t('txGlassOn')+'</b><span>'+t('txGlassDesc')+'</span></div><div class="toggle'+(p.gOn?' on':'')+'" role="switch" aria-checked="'+p.gOn+'" aria-label="'+t('txGlassOn')+'" onclick="txGlassToggle()"></div></div>'+
    txRow('blur',t('txBlur'),0,40,p.blur,null,{off:!p.gOn})+txRow('op',t('txOpacity'),15,100,p.op,null,{off:!p.gOn})+txRow('shine',t('txShine'),0,100,p.shine,null,{off:!p.gOn});
  h+='<div class="lab ap-lab">'+t('txTiltLab')+'</div>'+
    '<div class="ap-opt"><div><b>'+t('txTiltOn')+'</b><span>'+t(reduce?'txTiltReduced':'txTiltDesc')+'</span></div><div class="toggle'+(P.tiltOn?' on':'')+'" role="switch" aria-checked="'+!!P.tiltOn+'" aria-label="'+t('txTiltOn')+'" onclick="txTiltToggle()"></div></div>'+
    txRow('tk',t('txTiltK'),0,100,tiltK,null,{off:!P.tiltOn});
  h+='<div class="tx-acts"><button type="button" class="btn ghost" onclick="txReset()">'+t('txReset')+'</button><button type="button" class="btn" onclick="closeOv(\'ovProg\')">'+t('txDone')+'</button></div></div>';
  return h;
}
let _txRaf=0, _txSave=0;
function txLive(){ cancelAnimationFrame(_txRaf); _txRaf=requestAnimationFrame(()=>{ txApply(); if(typeof lumApply==='function'){ lumApply(); matApply(); } glareK(); }); }
function txInput(key,val){
  val=+val;
  if(key==='tk'){ P.tiltK=val; }
  else{
    const p=txState(); p[key]=val; p.on=true; if(key==='blur'||key==='op'||key==='shine') p.gCustom=true; P.tx=p;
  }
  const v=$('#txv_'+key); if(v) v.textContent=txValLab(key,val);
  if(key==='h'){ const ed=$('#txEd'); if(ed) ed.style.setProperty('--tx-hue',Math.round(val)); }
  txLive(); clearTimeout(_txSave); _txSave=setTimeout(saveAll,500);
}
function txCommit(){ clearTimeout(_txSave); saveAll(); applyTheme(); if(document.body.dataset.scr==='profil') renderProfile(); }
function txGlassToggle(){ const p=txState(); p.gOn=!p.gOn; p.gCustom=true; p.on=true; P.tx=p; saveAll(); applyTheme(); refreshPfSheet(); sfx&&sfx('tap'); }
// L'inclinaison n'arrive sur iPhone qu'après un « oui », demandé ici, au toucher (obligatoire).
function txTiltToggle(){
  P.tiltOn=!P.tiltOn;
  if(P.tiltOn){ const D=window.DeviceOrientationEvent;
    if(D && typeof D.requestPermission==='function') D.requestPermission().then(r=>{ P.glassTilt=(r==='granted'); saveAll(); if(r!=='granted') toast(t('txTiltStatic')); }).catch(()=>toast(t('txTiltStatic')));
    else P.glassTilt=true; }
  saveAll(); applyTheme(); refreshPfSheet(); sfx&&sfx('tap');
}
function txReset(){ const keep=P.theme||'blue'; P.tx=null; P.tiltOn=false; P.tiltK=60; P.theme=keep; saveAll(); applyTheme(); refreshPfSheet(); if(document.body.dataset.scr==='profil') renderProfile(); toast(t('txResetDone')); }
function tiltActive(){ return !!(P && P.tiltOn && !P.easyMode); }
function glareK(){ const g=document.getElementById('ikGlare'); if(g) g.style.opacity=tiltActive()?(0.25+0.75*txNum(P.tiltK,0,100,60)/100).toFixed(2):''; }
// Profil › Couleur : les neuf couleurs de base, les nuances de celle choisie, puis « Personnaliser ».
function pfBaseColorsHTML(){
  const cur=P.theme||'blue', base=baseOfAccent(cur), tx=txActive(), b=BASE_HUES.find(x=>x[0]===base);
  let h='<div class="acc-grid base-grid">'+BASE_HUES.map(([k,lab])=>'<div class="acc-sw'+(!tx&&base===k?' on':'')+'" role="button" aria-pressed="'+(!tx&&base===k)+'" onclick="setAccent(\''+k+'\')"><i class="accent-dot" data-a="'+k+'"></i><span>'+t(lab)+'</span></div>').join('')+'</div>';
  if(b && b[2].length>1) h+='<div class="lab ap-sub">'+tp('txShadesOf',t(b[1]))+'</div><div class="acc-chips">'+b[2].map(k=>'<button type="button" class="acc-chip'+(!tx&&cur===k?' on':'')+'" aria-pressed="'+(!tx&&cur===k)+'" onclick="setAccent(\''+k+'\')"><i class="accent-dot" data-a="'+k+'"></i>'+accentName(k)+'</button>').join('')+'</div>';
  h+='<button type="button" class="tx-open'+(tx?' on':'')+'" onclick="openThemeEditor()"><span class="tx-open-ic">'+ICN('palette',20,'currentColor')+'</span><span><b>'+t('txCustomize')+'</b><small>'+t(tx?'txCustomOn':'txCustomizeSub')+'</small></span>'+ICN('chevronR',16)+'</button>';
  return h;
}

function setAccent(c){
  P.theme=c; if(P.tx) P.tx.on=false; // une couleur prédéfinie remplace le thème personnalisé (gardé de côté)
  saveAll(); applyTheme();
  if($('#s-profil')&&$('#s-profil').classList.contains('on')) renderProfile();
  refreshPfSheet();
  sfx&&sfx('tap');
  toast(t('colorApplied'));
}
function pfAccentPickerHTML(){
  // V3.14.0 : les neuf couleurs de base, comme dans Profil › Apparence (nuances et éditeur y restent)
  const base=baseOfAccent(P.theme||'blue');
  return '<div class="accent-picker">'+BASE_HUES.map(([k,lab])=>
    '<div class="accent-dot'+(base===k?' on':'')+'" data-a="'+k+'" role="button" aria-label="'+t(lab)+'" aria-pressed="'+(base===k)+'" title="'+t(lab)+'" onclick="event.stopPropagation();setAccent(\''+k+'\')"></div>'
  ).join('')+'</div>';
}
function toggleEasyMode(){
  P.easyMode=!P.easyMode; saveAll(); applyTheme();
  if($('#s-profil')&&$('#s-profil').classList.contains('on')) renderProfile();
  if($('#s-home')&&$('#s-home').classList.contains('on')) renderHome();
  // Le mode simplifié masque l'onglet Outils et change le zoom : sans replacement
  // explicite, la pastille de la nav restait sur l'ancienne position/largeur
  // jusqu'au prochain changement d'onglet.
  setTimeout(()=>positionNavPill(document.querySelector('.nb.on')),60);
  toast(P.easyMode?t('easyModeOn'):t('easyModeOff'));
}
// suit le thème du téléphone en mode auto


