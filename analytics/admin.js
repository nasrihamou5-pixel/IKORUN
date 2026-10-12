/* ============================================================================
   IKORUN — TABLEAU DE BORD DES STATISTIQUES (V4.0.0, chargé par ikLoad('stats'))
   ----------------------------------------------------------------------------
   Réservé à l'admin de l'app (ikorun_analytics refuse tout autre compte).
   Tout est agrégé côté serveur : aucun événement individuel n'arrive ici.
   · actifs : jour, 7 jours, 30 jours, et l'histogramme des actifs par jour ;
   · entonnoir : ouverture → inscription → plan créé → premier bilan ;
   · rétention J1 / J7 / J30 (part des nouveaux revenus exactement N jours après) ;
   · fonctionnalités utilisées, langues, plateformes, taux d'installation, versions.
   Une seule couleur (l'accent du thème) : chaque graphique n'a qu'une série,
   les valeurs sont écrites en clair à côté de chaque barre.
   ============================================================================ */
(function(){
  let ST={days:30,data:null,err:null,busy:false};
  const E=s=>escHtml(String(s==null?'':s));
  const pct=(a,b)=>b>0?Math.round(a*1000/b)/10:0;
  const num=n=>ikNum(+n||0,'n0',{maximumFractionDigits:0});
  // nom lisible d'un événement (sinon son nom technique)
  const evLabel=n=>{ const k='stEv_'+n, v=t(k); return v===k?n:v; };
  window.statsOpen=function(){
    openOv('ovRace'); $('#ovRaceTitle').textContent=t('stTitle');
    paint(); load();
  };
  function load(){
    const c=window.supabaseClient; if(!c){ ST.err='rcNeedNetwork'; paint(); return; }
    ST.busy=true; ST.err=null; paint();
    Promise.resolve(c.rpc('ikorun_analytics',{p_days:ST.days})).then(r=>{
      ST.busy=false;
      if(r.error){ ST.err=/not_admin/.test(r.error.message||'')?'stNotAdmin':'genericErrorRetry'; ST.data=null; }
      else ST.data=r.data;
      paint();
    }).catch(()=>{ ST.busy=false; ST.err='genericErrorRetry'; paint(); });
  }
  window.statsDays=function(d){ ST.days=d; load(); };
  function tile(v,lab,sub){ return '<div class="st-tile"><b><bdi dir="ltr">'+v+'</bdi></b><span>'+lab+'</span>'+(sub?'<small>'+sub+'</small>':'')+'</div>'; }
  // barres horizontales : libellé, barre (proportionnelle au max), valeur écrite
  function hbars(rows,fmt){
    const max=Math.max(1,...rows.map(r=>+r[1]||0));
    return '<div class="st-hb">'+rows.map(r=>'<div class="st-hb-r"><span class="st-hb-l">'+E(r[0])+'</span><span class="st-hb-t"><i style="width:'+Math.max(2,Math.round((+r[1]||0)*100/max))+'%"></i></span><span class="st-hb-v"><bdi dir="ltr">'+(fmt?fmt(r):num(r[1]))+'</bdi></span></div>').join('')+'</div>';
  }
  // actifs par jour : colonnes fines arrondies en haut, survol = date et nombre
  function dauChart(dau){
    const W=320,H=132,top=16,pad=18,n=dau.length,max=Math.max(1,...dau.map(d=>d[1])),bw=(W-2)/n;
    let s='<svg class="st-dau" viewBox="0 0 '+W+' '+(H+pad)+'" role="img" aria-label="'+E(t('stDauChart'))+'">';
    s+='<line x1="0" y1="'+H+'" x2="'+W+'" y2="'+H+'" class="st-base"/>';
    dau.forEach((d,i)=>{ const h=Math.max(d[1]?3:0,Math.round(d[1]*(H-top)/max)), x=1+i*bw;
      s+='<g class="st-col"><rect x="'+(x).toFixed(1)+'" y="0" width="'+bw.toFixed(1)+'" height="'+H+'" class="st-hit"/>'+
        (h?'<rect x="'+(x+bw*0.18).toFixed(1)+'" y="'+(H-h)+'" width="'+(bw*0.64).toFixed(1)+'" height="'+h+'" rx="'+Math.min(4,bw*0.3).toFixed(1)+'" class="st-bar"/>':'')+
        '<title>'+E(fmtDate(d[0]))+' : '+num(d[1])+'</title></g>'; });
    s+='<text x="0" y="'+(H+14)+'" class="st-ax">'+E(fmtDate(dau[0][0]))+'</text><text x="'+W+'" y="'+(H+14)+'" text-anchor="end" class="st-ax">'+E(fmtDate(dau[n-1][0]))+'</text>';
    s+='<text x="'+W+'" y="10" text-anchor="end" class="st-ax">max '+num(max)+'</text></svg>';
    return s;
  }
  function paint(){
    const b=$('#raceBody'); if(!b) return;
    let h='<div class="seg-ctrl rc-seg">'+[7,30,90].map(d=>'<div class="seg-btn'+(ST.days===d?' on':'')+'" role="button" tabindex="0" onclick="statsDays('+d+')">'+tp('stDays',d)+'</div>').join('')+'</div>';
    if(ST.err){ b.innerHTML=h+'<div class="rc-empty"><span>'+t(ST.err)+'</span></div>'; return; }
    const D=ST.data;
    if(!D){ b.innerHTML=h+'<div class="rc-empty">'+t('rcLoading')+'</div>'; return; }
    h+='<div class="st-tiles">'+tile(num(D.dau_today),t('stToday'))+tile(num(D.wau),t('stWau'))+tile(num(D.mau),t('stMau'))+
      tile(pct(D.installed,D.active)+' %',t('stInstalled'),tp('stOfActive',num(D.active)))+'</div>';
    h+='<div class="db-sec">'+t('stDauTitle')+'</div><div class="card st-card">'+(D.dau&&D.dau.length?dauChart(D.dau):'')+'</div>';
    const f=D.funnel||[], f0=f.length?+f[0][1]:0;
    h+='<div class="db-sec">'+t('stFunnel')+'</div><div class="card st-card">'+hbars(f.map(r=>[t('stF_'+r[0]),r[1]]),r=>num(r[1])+' · '+pct(r[1],f0)+' %')+'</div>';
    h+='<div class="db-sec">'+t('stRetention')+'</div><div class="st-tiles">'+(D.retention||[]).map(r=>tile(r.cohort?pct(r.kept,r.cohort)+' %':'—','J'+r.n,tp('stCohort',num(r.kept),num(r.cohort)))).join('')+'</div>';
    h+='<p class="ad-foot">'+t('stRetentionNote')+'</p>';
    h+='<div class="db-sec">'+t('stFeatures')+'</div><div class="card st-card">'+((D.features||[]).length?hbars(D.features.map(r=>[evLabel(r[0]),r[1],r[2]]),r=>num(r[1])+' · '+tp('stUsers',num(r[2]))):'<span class="ad-foot">'+t('stNone')+'</span>')+'</div>';
    const langLab={fr:'Français',en:'English',ar:'العربية'}, pfLab={ios:'iPhone / iPad',android:'Android',desktop:t('stDesktop'),other:t('stOther')};
    h+='<div class="db-sec">'+t('stLangs')+'</div><div class="card st-card">'+hbars((D.langs||[]).map(r=>[langLab[r[0]]||r[0],r[1]]),r=>num(r[1])+' · '+pct(r[1],D.active)+' %')+'</div>';
    h+='<div class="db-sec">'+t('stPlatforms')+'</div><div class="card st-card">'+hbars((D.platforms||[]).map(r=>[pfLab[r[0]]||r[0],r[1]]),r=>num(r[1])+' · '+pct(r[1],D.active)+' %')+'</div>';
    h+='<div class="db-sec">'+t('stVersions')+'</div><div class="card st-card">'+hbars((D.versions||[]).map(r=>[r[0],r[1]]))+'</div>';
    h+='<p class="ad-foot">'+t('stPrivacyNote')+' '+t('stCfNote')+'</p>';
    b.innerHTML=h;
  }
})();
