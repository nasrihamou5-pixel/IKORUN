/* ============================================================
   IKORUN — Badges de rang (8 paliers), SVG inline
   Fichier : ui/rank-badges.js  (script classique, globales, comme le reste du cœur)
   API     : ikRankSVG(key, opts) -> string SVG
             key  : 'debutant'|'amateur'|'sportif'|'athlete'|'expert'|'elite'|'maitre'|'legende'
             opts : { size:number|null }  (null => 100% du conteneur, pour .bd-glyph)
   Pur, sans dépendance, sans réseau, sans toucher au DOM.
   Les 2 lames sont le VRAI logo IKORUN (mêmes polygones que l'intro, index.html) :
     W (lame claire)  = 160,240 218,160 432,86 376,168
     B (lame accent)  = 92,350 205,258 415,183 296,292     viewBox du logo "80 76 364 284"
   Les couleurs c1/c2 sont EXACTEMENT celles de app.css lignes 932-939 (.bd-*).
   ============================================================ */
(function(){
  var TIERS = {
    debutant:{c1:'#3d434e',c2:'#9aa3b0'},
    amateur :{c1:'#7a4a28',c2:'#d99a63'},
    sportif :{c1:'#2c3f5c',c2:'#cfe0f5'},
    athlete :{c1:'#8a5c0a',c2:'#ffcf5c'},
    expert  :{c1:'#0d5c56',c2:'#4de8d8'},
    elite   :{c1:'#12305c',c2:'#5ea0ff'},
    maitre  :{c1:'#3a1264',c2:'#b57dff'},
    legende :{c1:'#5c4a12',c2:'#fff2d0'}
  };
  var ORDER = ['debutant','amateur','sportif','athlete','expert','elite','maitre','legende'];
  var W = '160,240 218,160 432,86 376,168';
  var B = '92,350 205,258 415,183 296,292';
  var seq = 0; // ids de dégradés uniques : plusieurs badges peuvent coexister dans le DOM

  function arc(a0, a1, r){
    var p = function(a){ return [50 + r*Math.cos(a*Math.PI/180), 50 + r*Math.sin(a*Math.PI/180)]; };
    var s = p(a0), e = p(a1);
    return 'M'+s[0].toFixed(2)+' '+s[1].toFixed(2)+' A'+r+' '+r+' 0 0 1 '+e[0].toFixed(2)+' '+e[1].toFixed(2);
  }

  window.ikRankIndex = function(key){ return ORDER.indexOf(key); };
  window.ikIsRankKey = function(key){ return !!TIERS[key]; };

  window.ikRankSVG = function(key, opts){
    var T = TIERS[key]; if(!T) return '';
    var i = ORDER.indexOf(key), c1 = T.c1, c2 = T.c2;
    var size = opts && opts.size;
    var p = 'ikr' + (++seq) + '_';
    var dim = size ? 'width="'+size+'" height="'+size+'"' : 'width="100%" height="100%"';

    // Anneau de 8 segments : i+1 allumés (Débutant 1 … Légende 8)
    var segs = '';
    for (var k = 0; k < 8; k++){
      var a0 = -90 + k*45 + 4.5, a1 = a0 + 36;
      var col = (k <= i) ? 'url(#'+p+'l)' : 'rgba(255,255,255,.13)';
      segs += '<path d="'+arc(a0,a1,40)+'" fill="none" stroke="'+col+'" stroke-width="5" stroke-linecap="round"/>';
    }

    // Traits de vitesse (comme l'intro) : 0 pour Débutant/Amateur/Sportif … 3 pour Légende
    var nt = i < 3 ? 0 : (i < 5 ? 1 : (i < 7 ? 2 : 3));
    var T3 = [['M-40 300 L100 262',.5],['M-40 352 L70 322',.38],['M-30 236 L110 200',.3]], trails = '';
    for (var t = 0; t < nt; t++){
      trails += '<path d="'+T3[t][0]+'" stroke="'+c2+'" stroke-width="9" stroke-linecap="round" fill="none" opacity="'+T3[t][1]+'"/>';
    }

    var spark = (key === 'legende')
      ? '<path d="M50 -1 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#fff"/>' : '';

    return '<svg class="bd-glyph bd-rank" '+dim+' viewBox="0 0 100 100" role="img" aria-hidden="true" focusable="false"><defs>'+
      '<linearGradient id="'+p+'l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="'+c2+'"/></linearGradient>'+
      '<linearGradient id="'+p+'r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+c2+'"/><stop offset=".55" stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></linearGradient>'+
      '<radialGradient id="'+p+'f" cx=".3" cy=".2" r="1"><stop offset="0" stop-color="'+c1+'"/><stop offset="1" stop-color="#0a0e16"/></radialGradient>'+
      '<linearGradient id="'+p+'w" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#cfd8e8"/><stop offset="1" stop-color="#fff"/></linearGradient>'+
      '<linearGradient id="'+p+'b" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></linearGradient>'+
      '<linearGradient id="'+p+'s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>'+
      '<clipPath id="'+p+'c"><circle cx="50" cy="50" r="33"/></clipPath></defs>'+
      '<circle cx="50" cy="50" r="48" fill="url(#'+p+'r)"/>'+
      '<circle cx="50" cy="50" r="46" fill="#0d121b"/>'+ segs +
      '<circle cx="50" cy="50" r="33" fill="url(#'+p+'f)"/>'+
      '<g clip-path="url(#'+p+'c)"><g transform="translate(50 52) scale(.15) translate(-262 -218)">'+ trails +
        '<polygon points="'+B+'" fill="url(#'+p+'b)" stroke="url(#'+p+'b)" stroke-width="6" stroke-linejoin="round"/>'+
        '<polygon points="'+W+'" fill="url(#'+p+'w)" stroke="url(#'+p+'w)" stroke-width="6" stroke-linejoin="round"/>'+
      '</g></g>'+
      '<circle cx="50" cy="50" r="33" fill="url(#'+p+'s)"/>'+
      '<circle cx="50" cy="50" r="33" fill="none" stroke="'+c2+'" stroke-opacity=".6" stroke-width=".8"/>'+
      spark + '</svg>';
  };
})();
