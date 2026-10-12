/* ============================================================================
   IKORUN — IMAGE DE PARTAGE (V4.0.0, chargé à la demande par ikLoad('share'))
   ----------------------------------------------------------------------------
   · Formats : story 1080 × 1920, carré 1080 × 1080.
   · Modèles : sobre, gros chiffres, séance détaillée, progression, course.
   · Contenu à cocher (distance, durée, allure, D+, effort, répétitions, FC, date, nom) ;
     le nom peut être masqué.
   · Fond : dégradé du thème, verre, ou photo (recadrage simple : glisser, zoomer).
   · Couleurs du thème, contraste vérifié (texte clair ou foncé selon le fond).
   · Rendu après document.fonts.ready ; arabe en droite-à-gauche (ctx.direction) ;
     logo IKORUN + ikorun.pages.dev.
   · Partage avec navigator.share({files}) quand c'est possible, sinon téléchargement ;
     aperçu avant ; rendu en moins d'une seconde (mesuré, voir shareBench()).
   ============================================================================ */
(function(){
  const LOGO=[[92,350,205,258,415,183,296,292],[160,240,218,160,432,86,376,168]];
  const TPLS=['sober','big','detail','progress','race'];
  let S=null; // état de l'écran
  const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function rgb(c){ const d=document.createElement('canvas').getContext('2d'); d.fillStyle=c||'#3B82F6'; const s=d.fillStyle; if(s[0]==='#'){ const n=parseInt(s.slice(1),16); return [n>>16&255,n>>8&255,n&255]; } return (s.match(/\d+(\.\d+)?/g)||[59,130,246]).slice(0,3).map(Number); }
  const lum=c=>{ const f=v=>{ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); };
  const contrast=(a,b)=>{ const x=lum(a),y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  const mix=(a,b,k)=>a.map((x,i)=>Math.round(x+(b[i]-x)*k));
  const rgba=(c,a)=>'rgba('+c.join(',')+','+a+')';
  const rtl=()=>curLang()==='ar';
  // Les chiffres et unités restent de gauche à droite dans une phrase arabe.
  const L=s=>'⁦'+s+'⁩';
  function drawLogo(g,x,y,size,col){
    const sc=size/280; g.save(); g.translate(x,y); g.scale(sc,sc); g.translate(-84,-78); g.fillStyle=col; g.strokeStyle=col; g.lineWidth=12; g.lineJoin='round';
    LOGO.forEach(p=>{ g.beginPath(); g.moveTo(p[0],p[1]); for(let i=2;i<p.length;i+=2) g.lineTo(p[i],p[i+1]); g.closePath(); g.fill(); g.stroke(); });
    g.restore();
  }
  // Texte saisi (titre, prénom, distance) : isolé, il garde son propre sens dans une image arabe.
  const I=s=>'⁨'+s+'⁩';
  function palette(){
    const acc=rgb(css('--e')||'#3B82F6'), acc2=rgb(css('--e2')||'#7DD3FC'), light=document.documentElement.dataset.mode==='light', glass=S.bg==='glass';
    let bg1,bg2;
    if(light){ bg1=mix(glass?[236,240,247]:[250,251,253],acc,glass?0.24:0.15); bg2=mix(glass?[226,232,242]:[243,245,249],acc2,glass?0.16:0.08); }
    else { bg1=mix(glass?[18,24,38]:[8,11,18],acc,glass?0.35:0.28); bg2=mix(glass?[28,34,52]:[8,11,18],acc2,glass?0.25:0.12); }
    const mid=mix(bg1,bg2,0.5), ink=contrast([255,255,255],mid)>=contrast([12,14,20],mid)?[255,255,255]:[12,14,20];
    // accent lisible sur les deux bouts du dégradé : rapproché du texte tant que le contraste est < 3
    let a=acc; for(let i=0;i<10 && Math.min(contrast(a,bg1),contrast(a,bg2))<3;i++) a=mix(a,ink,0.15);
    return {acc:a,acc2,bg1,bg2,ink,light};
  }
  function bgPaint(g,W,H,pal){
    if(S.bg==='photo' && S.img){
      const im=S.img, z=S.zoom||1, cover=Math.max(W/im.width,H/im.height)*z, w=im.width*cover, h=im.height*cover;
      const x=(W-w)/2+(S.px||0)*W, y=(H-h)/2+(S.py||0)*H;
      g.drawImage(im,x,y,w,h);
      // voile sombre : le texte blanc reste lisible quelle que soit la photo
      const v=g.createLinearGradient(0,0,0,H); v.addColorStop(0,'rgba(5,7,12,.45)'); v.addColorStop(0.45,'rgba(5,7,12,.3)'); v.addColorStop(1,'rgba(5,7,12,.8)');
      g.fillStyle=v; g.fillRect(0,0,W,H);
      return;
    }
    const gr=g.createLinearGradient(0,0,W*0.35,H); gr.addColorStop(0,rgba(pal.bg1,1)); gr.addColorStop(1,rgba(pal.bg2,1)); g.fillStyle=gr; g.fillRect(0,0,W,H);
    const glow=g.createRadialGradient(W*0.85,H*0.1,0,W*0.85,H*0.1,W*0.9); glow.addColorStop(0,rgba(pal.acc,pal.light?0.22:0.42)); glow.addColorStop(1,rgba(pal.acc,0)); g.fillStyle=glow; g.fillRect(0,0,W,H);
  }
  // plaque de verre autour du contenu : fond translucide, bord lumineux, reflet en biais
  function glassPlate(g,x,y,w,h,light){
    g.save(); g.beginPath(); g.roundRect(x,y,w,h,64); g.fillStyle=light?'rgba(255,255,255,.55)':'rgba(255,255,255,.08)'; g.fill();
    g.lineWidth=3; g.strokeStyle=light?'rgba(255,255,255,.95)':'rgba(255,255,255,.22)'; g.stroke(); g.clip();
    const sh=g.createLinearGradient(x,y,x+w,y+h); sh.addColorStop(0,light?'rgba(255,255,255,.6)':'rgba(255,255,255,.18)'); sh.addColorStop(0.35,'rgba(255,255,255,0)'); g.fillStyle=sh; g.fillRect(x,y,w,h); g.restore();
  }
  function txt(g,s,x,y,font,col,align){ g.font=font; g.fillStyle=col; g.textAlign=align||(rtl()?'right':'left'); g.direction=rtl()?'rtl':'ltr'; g.fillText(s,x,y); }
  const UB='Unbounded, system-ui, sans-serif', IN='Inter, system-ui, sans-serif';
  let CC=null; // calque du contenu, réutilisé
  /* ---------- rendu ----------
     Le contenu est dessiné sur un calque, puis centré verticalement entre l'en-tête et le pied
     (une story courte n'a plus de grand vide en bas) ; la plaque de verre en prend la hauteur. */
  function render(cv){
    const story=S.fmt==='story', W=1080, H=story?1920:1080; cv.width=W; cv.height=H;
    const g=cv.getContext('2d'), pal=palette(), d=S.data, on=k=>S.show[k]!==false && S.has[k], R=rtl();
    const M=96, X0=R?W-M:M, END=R?M:W-M, endAl=R?'left':'right';
    const photo=S.bg==='photo' && !!S.img, inkC=photo?[255,255,255]:pal.ink;
    const ink=rgba(inkC,1), mute=rgba(inkC,0.74), dim=rgba(inkC,0.58), accC=photo?mix(pal.acc,[255,255,255],0.4):pal.acc, acc=rgba(accC,1);
    bgPaint(g,W,H,pal);
    const top=story?300:196, bot=H-(story?230:136);
    if(!CC) CC=document.createElement('canvas'); CC.width=W; CC.height=H;
    const c=CC.getContext('2d'); c.clearRect(0,0,W,H);
    let maxY=top, minY=Infinity;
    const T=(s,x,y,px,w,fam,col,al)=>{ c.font=w+' '+px+'px '+fam; c.fillStyle=col; c.textAlign=al||(R?'right':'left'); c.direction=R?'rtl':'ltr'; c.fillText(s,x,y); maxY=Math.max(maxY,y+px*0.24); minY=Math.min(minY,y-px*0.8); };
    const tw=(s,px,w,fam)=>{ c.font=w+' '+px+'px '+fam; return c.measureText(s).width; };
    const fitPx=(s,w,fam,max,start)=>{ let px=start; while(px>24 && tw(s,px,w,fam)>max) px-=4; return px; };
    // valeur + unité derrière, dans le sens de lecture
    const VU=(v,u,x,y,px,w,col)=>{ T(L(v),x,y,px,w||'800',UB,col||ink); if(u){ const vw=tw(v,px,w||'800',UB); T(L(u),R?x-vw-14:x+vw+14,y,Math.max(28,Math.round(px*0.4)),'700',IN,acc); } };
    const box=(x,y,w,h,r,fill)=>{ c.fillStyle=fill; c.beginPath(); c.roundRect(x,y,w,h,r); c.fill(); maxY=Math.max(maxY,y+h); minY=Math.min(minY,y); };
    const stats=[]; // [valeur, unité, libellé, clé]
    if(on('dist') && d.km) stats.push([fmt1(d.km),'km',t('dbDistLab'),'dist']);
    if(on('dur') && d.dur) stats.push([fmtDurMin(d.dur),'',t('dbDurLab'),'dur']);
    if(on('pace') && d.pace) stats.push([d.pace,'/km',t('dbTilePace'),'pace']);
    if(on('deniv') && d.deniv) stats.push([String(Math.round(d.deniv)),'m',t('shD'),'deniv']);
    if(on('rpe') && d.rpe) stats.push([d.rpe+'/10','',t('dbEffortLab'),'rpe']);
    if(on('hr') && d.hr) stats.push([String(d.hr),'bpm',t('blHrAvg'),'hr']);
    const Tp=S.tpl; let y=top;
    if(Tp!=='progress'){
      const title=d.title||'', px=fitPx(title,'800',UB,W-2*M,story?76:62);
      y+=px*0.8; T(I(title),X0,y,px,'800',UB,ink);
      if(on('date') && d.dateLabel){ y+=50; T(d.dateLabel,X0,y,34,'500',IN,mute); }
      y+=story?110:70;
    }
    if(Tp==='big'){
      const main=stats.shift();
      if(main){
        const px=fitPx(main[0]+'  '+main[1],'900',UB,W-2*M,story?300:220); y+=px*0.74;
        T(L(main[0]),X0,y,px,'900',UB,ink);
        if(main[1]){ const vw=tw(main[0],px,'900',UB); T(L(main[1]),R?X0-vw-20:X0+vw+20,y,Math.round(px*0.3),'800',UB,acc); }
        y+=56; T(main[2],X0,y,30,'600',IN,dim); y+=story?120:80;
      }
      const px=story?88:68;
      stats.slice(0,story?4:2).forEach(s=>{ y+=px*0.8; VU(s[0],s[1],X0,y,px); T(s[2],END,y,30,'600',IN,dim,endAl); y+=story?46:30; });
    } else if(Tp==='progress'){
      const tpx=story?76:60; y+=tpx*0.8; T(t('shProgTitle'),X0,y,tpx,'800',UB,ink); y+=story?90:56;
      const wk=d.weeks||[], max=Math.max(1,...wk.map(w=>w.km)), bh=story?560:300, bw=(W-2*M)/Math.max(1,wk.length);
      y+=40;
      wk.forEach((w,i)=>{ const h=Math.max(8,bh*w.km/max), x=R?W-M-(i+1)*bw:M+i*bw;
        const gr=c.createLinearGradient(0,y+bh-h,0,y+bh); gr.addColorStop(0,acc); gr.addColorStop(1,rgba(accC,0.35));
        box(x+bw*0.16,y+bh-h,bw*0.68,h,18,gr);
        T(L(String(Math.round(w.km))),x+bw/2,y+bh-h-18,30,'700',IN,mute,'center'); });
      y+=bh+56; T(tp('shProgWeeks',wk.length),X0,y,30,'500',IN,dim); y+=story?130:84;
      const tk=d.totalKm||0, tot=[[tk>=100?String(Math.round(tk)):fmt1(tk),'km',t('shTotalKm')],[String(d.sessions||0),'',t('shSessions')]]
        .concat(d.vdot?[[fmt1(d.vdot),'',d.vdotDelta?('VDOT '+(d.vdotDelta>0?'+':'')+fmt1(d.vdotDelta)):'VDOT']]:[]);
      const cw=(W-2*M)/tot.length, px=Math.min(...tot.map(s=>fitPx(s[0]+(s[1]?'  '+s[1]:''),'800',UB,cw-28,story?72:56)));
      tot.forEach((s,i)=>{ const cx=R?W-M-i*cw:M+i*cw; VU(s[0],s[1],cx,y,px); T(s[2],cx,y+48,28,'600',IN,dim); });
    } else if(Tp==='race'){
      const tm=d.raceTime||(d.dur?fmtDurMin(d.dur):'');
      if(tm){ const px=fitPx(tm,'900',UB,W-2*M,story?240:180); y+=px*0.78; T(L(tm),X0,y,px,'900',UB,acc); y+=story?110:64; }
      const px=story?64:54;
      stats.filter(s=>s[3]!=='dur' || !tm).slice(0,3).forEach(s=>{ y+=px*0.8; VU(s[0],s[1],X0,y,px); T(s[2],END,y,30,'600',IN,dim,endAl); y+=story?40:24; });
      if(d.pb){ y+=26; const bw=tw(t('shPb'),34,'800',UB)+56, x=R?W-M-bw:M; box(x,y,bw,62,31,rgba(accC,0.28)); T(t('shPb'),x+bw/2,y+43,34,'800',UB,ink,'center'); }
    } else {
      // sobre / séance détaillée : grille de chiffres sur deux colonnes
      const withReps=Tp==='detail' && on('reps') && d.reps && d.reps.length, n=Math.min(stats.length,withReps&&!story?2:Tp==='detail'?4:(story?6:4)), cw=(W-2*M)/2, rowH=story?196:150;
      const px=Math.min(story?92:76,...stats.slice(0,n).map(s=>fitPx(s[0]+(s[1]?'  '+s[1]:''),'800',UB,cw-28,story?92:76)));
      for(let i=0;i<n;i++){ const s=stats[i], cx=R?W-M-(i%2)*cw:M+(i%2)*cw, by=y+px*0.8+Math.floor(i/2)*rowH;
        VU(s[0],s[1],cx,by,px); T(s[2],cx,by+48,28,'600',IN,dim); }
      y+=Math.ceil(n/2)*rowH;
      if(Tp==='detail' && on('reps') && d.reps && d.reps.length){
        const all=d.reps; y+=6; T(tp('shReps',all.length,all[0].dist),X0,y+34,34,'700',IN,mute); y+=64;
        // la liste tient toujours dans l'image : barres plus fines, puis « +N » si besoin
        const avail=bot-y; let bh=Math.min(story?54:40,Math.floor(avail/all.length*0.74)), n2=all.length;
        if(bh<24){ bh=24; n2=Math.max(1,Math.floor(avail/(bh*1.35))-1); }
        const gap=Math.round(bh*0.35), reps=all.slice(0,n2), ts=reps.map(r=>r.timeS), maxT=Math.max(...ts), minT=Math.min(...ts);
        reps.forEach((r,i)=>{ const yy=y+i*(bh+gap), full=W-2*M-180, w=full*(0.55+0.45*(maxT===minT?1:(maxT-r.timeS)/(maxT-minT))), x=R?W-M-w:M;
          box(x,yy,w,bh,bh/2,r.respected===false?rgba(inkC,0.22):rgba(accC,0.78));
          T(String(i+1),R?W-M-20:M+20,yy+bh*0.7,Math.round(bh*0.55),'800',IN,'rgba(255,255,255,.92)');
          T(L(fmtSplit(r.timeS)),END,yy+bh*0.74,Math.max(26,Math.round(bh*0.7)),'800',IN,ink,endAl); });
        if(n2<all.length) T('+'+(all.length-n2),X0,y+n2*(bh+gap)+bh*0.7,Math.round(bh*0.62),'800',IN,dim);
      }
    }
    if(minY===Infinity) minY=top;
    const dy=Math.max(0,Math.round((bot-maxY)/2));
    if(S.bg==='glass' && !photo){ const py=minY+dy-64; glassPlate(g,W*0.055,py,W*0.89,Math.min(maxY+dy+64,H-(story?170:112))-py,pal.light); }
    g.drawImage(CC,0,dy);
    // en-tête : logo, nom de l'app, prénom
    const hy=story?150:110;
    drawLogo(g,R?W-M-62:M,hy-46,62,acc);
    txt(g,'IKORUN',R?W-M-80:M+80,hy,'800 40px '+UB,ink);
    if(on('name') && d.name) txt(g,I(d.name),END,hy,'600 34px '+IN,mute,endAl);
    // pied : adresse de l'app
    txt(g,'ikorun.pages.dev',W/2,H-(story?110:66),'700 30px '+IN,dim,'center');
  }
  /* ---------- données ---------- */
  function weeksBack(n){
    const out=[], k=todayKey();
    for(let i=n-1;i>=0;i--){ const mon=adMondayKey(adKeyAdd(k,-7*i)), sun=adKeyAdd(mon,6); out.push({mon,km:(SESS||[]).filter(s=>s.date>=mon&&s.date<=sun).reduce((a,s)=>a+(+s.km||0),0)}); }
    return out;
  }
  function baseData(){ return {name:(P.name||'').split(' ')[0]||'', progress:true}; }
  window.shareCtxFromBilan=function(e){
    return Object.assign(baseData(),{title:e.title||'',date:e.date,km:+e.distance||e.real&&e.real.km||0,dur:+e.duration||0,pace:e.pace&&e.pace!=='—'?e.pace:'',deniv:+e.deniv||0,rpe:+e.rpe||0,
      hr:e.hr&&e.hr.avg||0,reps:e.reps||e.repsLog||null,raceTime:e.baseType==='COURSE'?fmtDurMin(e.duration):null,kind:e.baseType==='COURSE'?'race':'session'});
  };
  window.shareCtxFromPlan=function(s){
    const real=(SESS||[]).filter(x=>x.planSessionId===s.id).slice(-1)[0], log=(SESSLOG||[]).filter(x=>x.planSessionId===s.id && x.v===2).slice(-1)[0];
    if(log) return window.shareCtxFromBilan(log);
    return Object.assign(baseData(),{title:planSessTitle(s),date:s.date,km:+(real&&real.km||s.km)||0,dur:+(real&&real.duration||s.duration)||0,pace:(real&&real.pace)||s.pace||'',rpe:+(real&&real.rpe)||0,kind:s.baseType==='COURSE'?'race':'session'});
  };
  window.shareCtxFromRecord=function(r){
    const sec=parseTime(r.time), km=(r.meters||0)/1000;
    return Object.assign(baseData(),{title:r.dist||'',date:r.date,km,pace:km>0&&sec>0?spkToStr(sec/km):'',raceTime:r.time,pb:true,kind:'race'});
  };
  window.shareCtxProgress=function(){
    const wk=weeksBack(8), since=wk[0].mon, list=(SESS||[]).filter(s=>s.date>=since);
    return Object.assign(baseData(),{title:t('shProgTitle'),weeks:wk,totalKm:Math.round(list.reduce((a,s)=>a+(+s.km||0),0)*10)/10,sessions:list.length,vdot:getUserVDOT(),kind:'progress'});
  };
  // Point d'entrée de l'app (openShareCard) : construit le contenu selon l'origine.
  window.shareCtx=function(kind,arg){
    if(kind==='bilan' && window._shareEntry) return window.shareCtxFromBilan(window._shareEntry);
    if(kind==='plan'){ const s=(PLAN&&PLAN.sessions||[]).find(x=>x.id===arg); if(s) return window.shareCtxFromPlan(s); }
    if(kind==='record'){ const r=(window._recSorted||[])[arg]; if(r) return window.shareCtxFromRecord(r); }
    return window.shareCtxProgress();
  };
  function progFill(){ if(S.data.weeks) return; const p=window.shareCtxProgress(); ['weeks','totalKm','sessions','vdot'].forEach(k=>S.data[k]=p[k]); }
  /* ---------- écran ---------- */
  window.shareOpen=function(ctx){
    const d=ctx||window.shareCtxProgress();
    d.dateLabel=d.date?ikDate(new Date(d.date+'T12:00:00'),'dmy',{weekday:'long',day:'numeric',month:'long'}):'';
    const has={name:!!d.name,date:!!d.date,dist:!!d.km,dur:!!d.dur,pace:!!d.pace,deniv:!!d.deniv,rpe:!!d.rpe,hr:!!d.hr,reps:!!(d.reps&&d.reps.length)};
    S={data:d,has,show:{deniv:has.deniv,hr:has.hr},fmt:'story',tpl:d.kind==='race'?'race':d.kind==='progress'?'progress':has.reps?'detail':'sober',bg:'gradient',img:null,zoom:1,px:0,py:0};
    openOv('ovProg'); $('#ovProgTitle').textContent=t('shTitle');
    paint(); document.fonts.ready.then(()=>draw());
    try{ if(typeof ikTrack==='function') ikTrack('share_open',{kind:d.kind}); }catch(e){}
  };
  function chip(group,v,lab,on){ return '<button type="button" class="sh-chip'+(on?' on':'')+'" aria-pressed="'+on+'" onclick="shareSet(\''+group+'\',\''+v+'\')">'+lab+'</button>'; }
  function paint(){
    const has=S.has, opt=['name','date','dist','dur','pace','deniv','rpe','hr','reps'].filter(k=>has[k]);
    let h='<div class="sh-prev'+(S.fmt==='story'?' story':'')+'"><canvas id="shCv" aria-label="'+t('shPreview')+'"></canvas></div>';
    h+='<div class="db-sec">'+t('shFormat')+'</div><div class="sh-row">'+chip('fmt','story',t('shStory'),S.fmt==='story')+chip('fmt','square',t('shSquare'),S.fmt==='square')+'</div>';
    h+='<div class="db-sec">'+t('shTemplate')+'</div><div class="sh-row">'+TPLS.map(k=>chip('tpl',k,t('shTpl_'+k),S.tpl===k)).join('')+'</div>';
    h+='<div class="db-sec">'+t('shContent')+'</div><div class="sh-row">'+opt.map(k=>chip('show',k,t('shShow_'+k),S.show[k]!==false)).join('')+'</div>';
    h+='<div class="db-sec">'+t('shBackground')+'</div><div class="sh-row">'+chip('bg','gradient',t('shBgGradient'),S.bg==='gradient')+chip('bg','glass',t('shBgGlass'),S.bg==='glass')+chip('bg','photo',t('shBgPhoto'),S.bg==='photo')+'</div>';
    if(S.bg==='photo') h+='<div class="sh-photo">'+(S.img?'<label>'+t('shZoom')+'<input type="range" class="bl-range" min="100" max="300" value="'+Math.round(S.zoom*100)+'" oninput="shareZoom(this.value)"></label><p class="ad-foot">'+t('shDragHint')+'</p>':'')+
      '<button type="button" class="btn ghost sm" onclick="sharePickPhoto()">'+ICN('camera',15)+' '+t(S.img?'shChangePhoto':'shPickPhoto')+'</button></div>';
    h+='<div class="ik-cta-bar"><button class="btn" onclick="shareGo()">'+ICN('share',17)+' '+t((navigator.canShare&&typeof File!=='undefined')?'shShare':'shDownload')+'</button></div>';
    $('#progBody').innerHTML=h;
    const cv=document.getElementById('shCv'); drag(cv);
  }
  let _raf=0;
  function draw(){ cancelAnimationFrame(_raf); _raf=requestAnimationFrame(()=>{ const cv=document.getElementById('shCv'); if(!cv) return; const t0=performance.now(); render(cv); S.ms=Math.round(performance.now()-t0); }); }
  window.shareSet=function(group,v){
    if(group==='show') S.show[v]=S.show[v]===false; else S[group]=v;
    if(group==='tpl' && v==='progress') progFill();
    if(group==='bg' && v==='photo' && !S.img){ paint(); draw(); return window.sharePickPhoto(); }
    paint(); draw(); haptic();
  };
  window.shareZoom=function(v){ S.zoom=Math.max(1,+v/100); draw(); };
  window.sharePickPhoto=function(){
    const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
    inp.onchange=e=>{ const f=e.target.files[0]; if(!f) return; const url=URL.createObjectURL(f), im=new Image();
      im.onload=()=>{ S.img=im; S.bg='photo'; S.zoom=1; S.px=0; S.py=0; paint(); draw(); };
      im.onerror=()=>toast(t('invalidFile')); im.src=url; };
    inp.click();
  };
  // Recadrage : glisser la photo dans l'aperçu.
  function drag(cv){
    if(!cv) return; let st=null;
    cv.addEventListener('pointerdown',e=>{ if(S.bg!=='photo'||!S.img) return; st={x:e.clientX,y:e.clientY,px:S.px,py:S.py,w:cv.clientWidth,h:cv.clientHeight}; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove',e=>{ if(!st) return; S.px=Math.max(-0.5,Math.min(0.5,st.px+(e.clientX-st.x)/st.w)); S.py=Math.max(-0.5,Math.min(0.5,st.py+(e.clientY-st.y)/st.h)); draw(); });
    const up=()=>{ st=null; }; cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  }
  window.shareGo=async function(){
    await document.fonts.ready;
    const cv=document.createElement('canvas'); render(cv);
    cv.toBlob(async blob=>{
      if(!blob){ toast(t('genericErrorRetry')); return; }
      const name='ikorun-'+(S.data.date||todayKey())+'-'+S.tpl+'.png', file=new File([blob],name,{type:'image/png'});
      try{ if(typeof ikTrack==='function') ikTrack('share_image',{tpl:S.tpl,fmt:S.fmt,bg:S.bg}); }catch(e){}
      if(navigator.canShare && navigator.canShare({files:[file]})){
        try{ await navigator.share({files:[file],title:'IKORUN',text:'ikorun.pages.dev'}); return; }catch(e){ if(e&&e.name==='AbortError') return; }
      }
      const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),4000); toast(t('shSaved'));
    },'image/png');
  };
  // Rendu hors écran (tests) : ctx = contenu, o = {fmt,tpl,bg}. Rend le canevas.
  window.shareRenderTo=function(ctx,o){
    const keep=S, d=Object.assign({},ctx); d.dateLabel=d.date?ikDate(new Date(d.date+'T12:00:00'),'dmy',{weekday:'long',day:'numeric',month:'long'}):'';
    S={data:d,has:{name:!!d.name,date:!!d.date,dist:!!d.km,dur:!!d.dur,pace:!!d.pace,deniv:!!d.deniv,rpe:!!d.rpe,hr:!!d.hr,reps:!!(d.reps&&d.reps.length)},show:Object.assign({},o&&o.show),fmt:'story',tpl:'sober',bg:'gradient',img:null,zoom:1,px:0,py:0};
    Object.assign(S,o||{}); if(S.tpl==='progress') progFill();
    const cv=document.createElement('canvas'); try{ render(cv); } finally { S=keep; }
    return cv;
  };
  // Mesure : temps de rendu de chaque modèle, en story et en carré (console).
  window.shareBench=async function(){
    await document.fonts.ready; const out=[], keep=S;
    S=Object.assign({},keep||{}, {data:keep?keep.data:window.shareCtxProgress(),has:keep?keep.has:{dist:1,dur:1,pace:1},show:{},bg:'gradient'});
    for(const fmt of ['story','square']) for(const tpl of TPLS){ S.fmt=fmt; S.tpl=tpl; if(tpl==='progress') progFill(); const cv=document.createElement('canvas'), t0=performance.now(); render(cv); await new Promise(r=>cv.toBlob(r,'image/png')); out.push({fmt,tpl,ms:Math.round(performance.now()-t0)}); }
    S=keep; console.table(out); return out;
  };
})();
