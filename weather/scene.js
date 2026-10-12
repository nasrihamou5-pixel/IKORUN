/* ============================================================================
   IKORUN — SCÈNES MÉTÉO ANIMÉES (V4.0.0, chargé à la demande par ikLoad('scene'))
   ----------------------------------------------------------------------------
   Canvas 2D, une scène par carte (data-wx sur le parent) : soleil et miroitement de chaleur,
   nuages en parallaxe, pluie (angle selon le vent, densité selon les mm/h), orage et éclairs,
   vent, brouillard, nuit étoilée et lune, neige, sirocco (poussière).
   · 60 images/s visées ; le nombre de particules suit la taille de la carte et la puissance
     de l'appareil, et baisse tout seul si les images prennent plus de 20 ms.
   · En pause hors écran (IntersectionObserver) et quand l'app passe en arrière-plan.
   · Couleurs du thème (--e, --e2) mêlées au ciel ; profondeur selon l'inclinaison si les
     reflets d'inclinaison sont activés (Profil › Apparence).
   · « Réduire les animations » : une image fixe, dessinée une fois.
   ============================================================================ */
(function(){
  const scenes=new Set();
  const reduce=()=>{ try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } };
  const power=(()=>{ const c=navigator.hardwareConcurrency||4, m=navigator.deviceMemory||4; return (c>=8?1:c>=4?0.75:0.5)*(m<=2?0.6:1); })();
  let tiltX=0, tiltY=0, tiltOn=false;
  function tiltListen(){
    if(tiltOn || !(typeof tiltActive==='function' && tiltActive())) return;
    tiltOn=true;
    window.addEventListener('deviceorientation',e=>{ if(e.gamma==null) return; tiltX=Math.max(-1,Math.min(1,e.gamma/30)); tiltY=Math.max(-1,Math.min(1,(e.beta-45)/30)); },{passive:true});
  }
  function css(name,fb){ const v=getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v||fb; }
  function rgb(c){ const d=document.createElement('canvas').getContext('2d'); d.fillStyle=c; const s=d.fillStyle; if(s[0]==='#'){ const n=parseInt(s.slice(1),16); return [n>>16&255,n>>8&255,n&255]; } const m=s.match(/\d+(\.\d+)?/g)||[0,0,0]; return m.slice(0,3).map(Number); }
  const mix=(a,b,k)=>a.map((x,i)=>Math.round(x+(b[i]-x)*k));
  const rgba=(c,a)=>'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';
  // nuage pré-rendu : bouffées de dégradés radiaux, dessiné une fois par scène
  function cloudSprite(w,h,col,alpha,seed){
    const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d');
    let r=seed||1; const rnd=()=>{ r=(r*16807)%2147483647; return r/2147483647; };
    for(let i=0;i<9;i++){
      const x=w*(0.15+0.7*rnd()), y=h*(0.45+0.25*rnd()), rad=h*(0.28+0.22*rnd());
      const gr=g.createRadialGradient(x,y,0,x,y,rad); gr.addColorStop(0,rgba(col,alpha)); gr.addColorStop(1,rgba(col,0));
      g.fillStyle=gr; g.beginPath(); g.arc(x,y,rad,0,Math.PI*2); g.fill();
    }
    return c;
  }
  // croissant de lune pré-rendu (fond transparent : la découpe ne touche pas le ciel)
  function moonSprite(r){
    const c=document.createElement('canvas'); c.width=c.height=Math.ceil(r*2+4); const g=c.getContext('2d');
    g.fillStyle='#EEF1FF'; g.beginPath(); g.arc(r+2,r+2,r,0,6.283); g.fill();
    g.globalCompositeOperation='destination-out'; g.beginPath(); g.arc(r+2+r*0.45,r+2-r*0.2,r*0.92,0,6.283); g.fill();
    return {c,r};
  }
  function Scene(cv){
    const host=cv.parentElement, ds=host.dataset;
    this.cv=cv; this.g=cv.getContext('2d',{alpha:false}); this.k=ds.wx||'cloudy'; this.night=ds.night==='1';
    this.mm=+ds.mm||0; this.wind=+ds.wind||0; this.wdir=ds.wdir!=null?+ds.wdir:270;
    this.running=false; this.visible=true; this.t0=performance.now(); this.slow=0; this.q=1;
    this.resize(); this.build();
    this.io=new IntersectionObserver(es=>{ this.visible=es[0].isIntersecting; this.visible?this.start():this.stop(); },{threshold:0.01});
    this.io.observe(cv);
    this.ro=new ResizeObserver(()=>{ this.resize(); this.build(); if(!this.running) this.frame(performance.now()); }); this.ro.observe(host);
    tiltListen();
    if(reduce()){ this.frame(this.t0+4000,true); } else this.start();
  }
  // image fixe de secours avant le chargement du module : dégradé posé en CSS (data-wx)
  Scene.prototype.resize=function(){
    const r=this.cv.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1);
    this.w=Math.max(1,r.width); this.h=Math.max(1,r.height); this.dpr=dpr;
    this.cv.width=Math.round(this.w*dpr); this.cv.height=Math.round(this.h*dpr);
    this.g.setTransform(dpr,0,0,dpr,0,0);
  };
  Scene.prototype.build=function(){
    const W=this.w,H=this.h, area=W*H/1e5, k=this.k, n=this.night;
    const acc=rgb(css('--e','#3B82F6')), acc2=rgb(css('--e2','#7DD3FC'));
    const light=document.documentElement.getAttribute('data-mode')==='light';
    // ciel : teinte du temps, mêlée à la couleur du thème
    const SKY={clear:n?[[10,14,40],[26,32,70]]:[[38,120,214],[132,196,246]],partly:n?[[12,16,38],[32,38,68]]:[[54,128,206],[150,198,236]],
      cloudy:n?[[16,18,28],[36,40,52]]:[[92,108,130],[160,172,188]],fog:n?[[24,26,34],[52,56,66]]:[[150,158,168],[204,208,214]],
      drizzle:n?[[16,20,32],[40,46,60]]:[[86,102,124],[140,154,172]],rain:n?[[10,14,24],[30,36,52]]:[[60,74,96],[112,126,148]],
      storm:[[14,14,26],[44,40,64]],snow:n?[[24,30,48],[60,68,90]]:[[176,190,208],[222,230,240]],
      wind:n?[[12,18,36],[34,44,70]]:[[62,138,206],[160,206,236]],dust:n?[[40,24,12],[80,50,24]]:[[186,118,54],[230,180,110]]}[k]||[[40,60,90],[90,110,140]];
    const tint=light?0.10:0.18;
    this.top=mix(SKY[0],acc,tint); this.bot=mix(SKY[1],acc2,tint*0.8);
    this.acc=acc; this.acc2=acc2;
    const f=Math.max(0.3,power*this.q);
    const R=(a,b)=>a+Math.random()*(b-a);
    // nuages
    const nC={clear:0,partly:3,cloudy:7,fog:2,drizzle:6,rain:7,storm:8,snow:6,wind:3,dust:2}[k]||0;
    const cCol=k==='storm'||k==='rain'?[70,76,92]:k==='dust'?[210,160,100]:n?[90,96,120]:[255,255,255];
    this.clouds=[]; for(let i=0;i<nC;i++){ const z=i%3, s=(0.6+z*0.35); const cw=W*R(0.45,0.8)*s, ch=cw*0.42;
      this.clouds.push({x:R(-cw,W),y:R(-ch*0.3,H*0.45),z,w:cw,h:ch,v:(6+z*7)*(1+this.wind/25),spr:cloudSprite(Math.ceil(cw),Math.ceil(ch),cCol,k==='cloudy'||k==='rain'||k==='storm'?0.55:0.42,i*977+3)}); }
    // pluie, bruine, orage
    const wsign=Math.sin((this.wdir||270)*Math.PI/180)<0?1:-1; // vent d'ouest (270°) → la pluie penche vers l'est
    this.slant=Math.min(0.9,this.wind/45)*wsign;
    this.drops=[];
    if(k==='rain'||k==='storm'||k==='drizzle'){
      const mm=Math.max(this.mm,k==='drizzle'?0.3:1.2), base=k==='drizzle'?40:70;
      const nD=Math.round(Math.min(520,(base+mm*55)*area*f));
      for(let i=0;i<nD;i++) this.drops.push({x:R(-W*0.2,W*1.2),y:R(-H,H),l:k==='drizzle'?R(5,9):R(10,20)*(1+mm/12),v:k==='drizzle'?R(260,380):R(620,900)*(1+mm/20),a:R(0.25,0.6)});
    }
    this.splash=[];
    // neige
    this.flakes=[]; if(k==='snow'){ const nF=Math.round(Math.min(260,120*area*f)); for(let i=0;i<nF;i++) this.flakes.push({x:R(0,W),y:R(-H,H),r:R(1,3.2),v:R(18,48),ph:R(0,6.28),sw:R(8,26)}); }
    // étoiles
    this.stars=[]; if(n && (k==='clear'||k==='partly'||k==='wind')){ const nS=Math.round(Math.min(160,90*area*f)); for(let i=0;i<nS;i++) this.stars.push({x:R(0,W),y:R(0,H*0.75),r:R(0.4,1.4),ph:R(0,6.28),sp:R(0.6,2.2)}); }
    // vent : filets
    this.gusts=[]; if(k==='wind'||this.wind>=30){ const nG=Math.round(Math.min(26,14*area*f)); for(let i=0;i<nG;i++) this.gusts.push({x:R(-W,W),y:R(H*0.1,H*0.9),l:R(60,180),v:R(220,420)*(0.6+this.wind/50),amp:R(4,12),ph:R(0,6.28),a:R(0.12,0.3)}); }
    // poussière (sirocco)
    this.dust=[]; if(k==='dust'){ const nP=Math.round(Math.min(300,160*area*f)); for(let i=0;i<nP;i++) this.dust.push({x:R(0,W),y:R(0,H),r:R(0.6,2),v:R(30,90),a:R(0.15,0.5)}); }
    // brouillard
    this.fog=k==='fog'?[0,1,2].map(i=>({y:H*(0.35+i*0.22),v:(8+i*5)*(i%2?-1:1),o:Math.random()*W})):[];
    this.bolt=null; this.flash=0; this.nextBolt=performance.now()+R(1500,4000);
  };
  Scene.prototype.start=function(){ if(this.running||reduce()||!this.visible||document.hidden) return; this.running=true; this.last=performance.now(); const loop=t=>{ if(!this.running) return; this.frame(t); this.raf=requestAnimationFrame(loop); }; this.raf=requestAnimationFrame(loop); };
  Scene.prototype.stop=function(){ this.running=false; cancelAnimationFrame(this.raf); };
  Scene.prototype.dispose=function(){ this.stop(); try{ this.io.disconnect(); this.ro.disconnect(); }catch(e){} scenes.delete(this); };
  Scene.prototype.frame=function(now,still){
    if(!this.cv.isConnected){ this.dispose(); return; }
    const g=this.g, W=this.w, H=this.h, k=this.k, n=this.night;
    const dt=still?0:Math.min(0.05,(now-(this.last||now))/1000); this.last=now;
    const T=(now-this.t0)/1000;
    // adaptation : si les images coûtent trop, moins de particules
    if(!still && dt>0.02){ if(++this.slow>40 && this.q>0.4){ this.q*=0.75; this.slow=0; this.build(); } } else this.slow=Math.max(0,this.slow-1);
    const px=tiltX*8, py=tiltY*5;
    // ciel
    const sky=g.createLinearGradient(0,0,0,H); sky.addColorStop(0,rgba(this.top,1)); sky.addColorStop(1,rgba(this.bot,1));
    g.fillStyle=sky; g.fillRect(0,0,W,H);
    // étoiles
    if(this.stars.length){ this.stars.forEach(s=>{ const a=0.45+0.55*Math.sin(T*s.sp+s.ph); g.fillStyle='rgba(255,255,255,'+(0.25+0.6*a*a).toFixed(3)+')'; g.beginPath(); g.arc(s.x+px*0.3,s.y+py*0.3,s.r,0,6.283); g.fill(); }); }
    // astre
    const sx=W*0.78+px*0.5, sy=H*0.32+py*0.5;
    if(n && k!=='storm' && k!=='rain' && k!=='fog'){
      const glow=g.createRadialGradient(sx,sy,0,sx,sy,H*0.5); glow.addColorStop(0,'rgba(220,226,255,.28)'); glow.addColorStop(1,'rgba(220,226,255,0)');
      g.fillStyle=glow; g.fillRect(0,0,W,H);
      const r=Math.min(W,H)*0.11;
      if(!this.moon || this.moon.r!==r) this.moon=moonSprite(r);
      g.drawImage(this.moon.c,sx-r-2,sy-r-2);
    } else if(!n && (k==='clear'||k==='partly'||k==='wind'||k==='dust')){
      const r=Math.min(W,H)*(k==='dust'?0.12:0.14);
      const glow=g.createRadialGradient(sx,sy,r*0.3,sx,sy,Math.max(W,H)*0.7);
      glow.addColorStop(0,k==='dust'?'rgba(255,226,170,.55)':'rgba(255,240,190,.6)'); glow.addColorStop(1,'rgba(255,240,190,0)');
      g.fillStyle=glow; g.fillRect(0,0,W,H);
      if(k==='clear'){ // rayons lents
        g.save(); g.translate(sx,sy); g.rotate(T*0.05); g.fillStyle='rgba(255,246,210,.07)';
        for(let i=0;i<12;i++){ g.rotate(Math.PI/6); g.beginPath(); g.moveTo(0,0); g.lineTo(Math.max(W,H),-18); g.lineTo(Math.max(W,H),18); g.closePath(); g.fill(); }
        g.restore();
      }
      g.beginPath(); g.arc(sx,sy,r,0,6.283); g.fillStyle=k==='dust'?'rgba(255,236,200,.75)':'#FFF6D8'; g.fill();
    }
    // nuages (parallaxe : les plus proches vont plus vite et suivent plus l'inclinaison)
    this.clouds.forEach(c=>{ c.x+=c.v*dt; if(c.x>W+20) c.x=-c.w-20; g.globalAlpha=k==='fog'?0.5:1; g.drawImage(c.spr,c.x+px*(c.z+1)*0.6,c.y+py*(c.z+1)*0.4,c.w,c.h); });
    g.globalAlpha=1;
    // miroitement de chaleur (soleil fort, journée)
    if(!n && k==='clear' && (this.cv.parentElement.dataset.hot==='1' || (typeof wxNow==='function' && (wxNow()||{}).t>=30))){
      for(let i=0;i<6;i++){ const y=H*(0.72+i*0.045), a=0.05+0.04*Math.sin(T*2+i);
        g.fillStyle='rgba(255,236,190,'+a.toFixed(3)+')'; g.beginPath(); g.moveTo(0,y);
        for(let x=0;x<=W;x+=12) g.lineTo(x,y+Math.sin(x/28+T*3+i)*2.2); g.lineTo(W,y+8); g.lineTo(0,y+8); g.closePath(); g.fill(); }
    }
    // brouillard
    this.fog.forEach((f,i)=>{ f.o=(f.o+f.v*dt+W*2)%(W*2); const gr=g.createLinearGradient(0,f.y-H*0.2,0,f.y+H*0.2);
      gr.addColorStop(0,'rgba(235,238,242,0)'); gr.addColorStop(0.5,'rgba(235,238,242,'+(n?0.18:0.38)+')'); gr.addColorStop(1,'rgba(235,238,242,0)');
      g.save(); g.translate(-f.o,0); g.fillStyle=gr; g.fillRect(0,f.y-H*0.2,W*3,H*0.4); g.restore(); });
    // pluie
    if(this.drops.length){
      g.strokeStyle=n||k==='storm'?'rgba(190,205,235,1)':'rgba(225,235,250,1)'; g.lineCap='round'; g.lineWidth=k==='drizzle'?0.8:1.1;
      const sl=this.slant;
      this.drops.forEach(d=>{ d.y+=d.v*dt; d.x+=d.v*dt*sl;
        if(d.y>H){ if(this.splash.length<60 && Math.random()<0.25) this.splash.push({x:d.x,y:H-2,t:0}); d.y=-d.l-Math.random()*H*0.3; d.x=Math.random()*W*1.4-W*0.2; }
        g.globalAlpha=d.a; g.beginPath(); g.moveTo(d.x,d.y); g.lineTo(d.x-d.l*sl,d.y-d.l); g.stroke(); });
      g.globalAlpha=1;
      this.splash=this.splash.filter(s=>{ s.t+=dt; if(s.t>0.25) return false; g.strokeStyle='rgba(225,235,250,'+(0.5-s.t*2).toFixed(3)+')'; g.beginPath(); g.ellipse(s.x,s.y,2+s.t*22,1+s.t*4,0,0,6.283); g.stroke(); return true; });
    }
    // neige
    this.flakes.forEach(f=>{ f.y+=f.v*dt; if(f.y>H+4){ f.y=-4; f.x=Math.random()*W; } const x=f.x+Math.sin(T*1.2+f.ph)*f.sw*0.3+px*0.4;
      g.fillStyle='rgba(255,255,255,.9)'; g.beginPath(); g.arc(x,f.y,f.r,0,6.283); g.fill(); });
    // vent
    if(this.gusts.length){ g.lineWidth=1.2; g.lineCap='round';
      this.gusts.forEach(s=>{ s.x+=s.v*dt; if(s.x>W+s.l){ s.x=-s.l-Math.random()*W*0.5; s.y=H*(0.1+Math.random()*0.8); }
        g.strokeStyle='rgba(255,255,255,'+s.a+')'; g.beginPath();
        for(let i=0;i<=10;i++){ const x=s.x+s.l*i/10, y=s.y+Math.sin(x/40+T*2+s.ph)*s.amp; i?g.lineTo(x,y):g.moveTo(x,y); } g.stroke(); }); }
    // sirocco
    if(this.dust.length){ const haze=g.createLinearGradient(0,0,0,H); haze.addColorStop(0,'rgba(210,150,80,.12)'); haze.addColorStop(1,'rgba(190,120,60,.38)'); g.fillStyle=haze; g.fillRect(0,0,W,H);
      this.dust.forEach(p=>{ p.x+=p.v*dt; p.y+=Math.sin(T+p.x/50)*0.2; if(p.x>W+2){ p.x=-2; p.y=Math.random()*H; } g.fillStyle='rgba(240,200,140,'+p.a+')'; g.beginPath(); g.arc(p.x,p.y,p.r,0,6.283); g.fill(); }); }
    // orage : éclairs ramifiés et lueur
    if(k==='storm' && !still){
      if(now>this.nextBolt){ this.bolt=this.makeBolt(); this.flash=1; this.nextBolt=now+1800+Math.random()*5200; }
      if(this.flash>0){ g.fillStyle='rgba(220,226,255,'+(this.flash*0.35).toFixed(3)+')'; g.fillRect(0,0,W,H); this.flash=Math.max(0,this.flash-dt*3.2); }
      if(this.bolt && this.flash>0.55){ g.save(); g.strokeStyle='rgba(245,248,255,.95)'; g.shadowColor=rgba(this.acc2,0.9); g.shadowBlur=14; g.lineWidth=2;
        this.bolt.forEach((seg,i)=>{ g.lineWidth=i?1:2.2; g.beginPath(); seg.forEach((p,j)=>j?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.stroke(); }); g.restore(); }
    }
    // voile bas pour la lisibilité du texte (couleur du fond de l'app)
    // texte blanc par-dessus, en clair comme en sombre : voile sombre neutre en bas et à gauche
    const veil=g.createLinearGradient(0,0,0,H); veil.addColorStop(0,'rgba(6,10,20,.04)'); veil.addColorStop(1,'rgba(6,10,20,.5)'); g.fillStyle=veil; g.fillRect(0,0,W,H);
    const side=g.createLinearGradient(0,0,W*0.7,0); side.addColorStop(0,'rgba(6,10,20,.28)'); side.addColorStop(1,'rgba(6,10,20,0)'); g.fillStyle=side; g.fillRect(0,0,W,H);
  };
  Scene.prototype.makeBolt=function(){
    const W=this.w,H=this.h, segs=[], main=[]; let x=W*(0.2+Math.random()*0.6), y=0;
    main.push([x,y]); while(y<H*0.85){ x+=(Math.random()-0.5)*26; y+=8+Math.random()*16; main.push([x,y]);
      if(Math.random()<0.18){ const br=[[x,y]]; let bx=x,by=y; for(let i=0;i<5;i++){ bx+=(Math.random()-0.3)*22*(Math.random()<0.5?-1:1); by+=8+Math.random()*12; br.push([bx,by]); } segs.push(br); } }
    return [main].concat(segs);
  };
  document.addEventListener('visibilitychange',()=>{ scenes.forEach(s=>document.hidden?s.stop():s.start()); });
  window.wxSceneMount=function(cv){ if(!cv || cv._wxScene) return; try{ cv._wxScene=new Scene(cv); scenes.add(cv._wxScene); }catch(e){ console.warn('[IKORUN] scène météo',e); } };
  window.wxSceneCount=function(){ return scenes.size; };
})();
