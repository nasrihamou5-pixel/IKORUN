/* ============================================================================
   IKORUN — ASSISTANT « UNE QUESTION PAR ÉCRAN » (V4.11.0), le moteur commun
   ----------------------------------------------------------------------------
   Repris de l'assistant de KORE, partagé par l'inscription (ui/onboarding.js), la
   création du plan de course et l'assistant « Nouveau plan » (ui/plan-flow.js) :
   - un grand titre, une phrase qui dit pourquoi, des réponses qu'on touche ;
   - les choix simples (auto:true) passent tout seuls à l'écran suivant ;
   - entre deux parties, un écran d'étapes où celle qu'on vient de finir se coche ;
   - un récapitulatif dont chaque ligne se touche (F.corriger(id)) ;
   - à la fin, la construction étape par étape (anneau + coches), puis onFinish.
   ikFlow(cfg) monte l'assistant dans cfg.host (ex. #ob) ou dans sa propre couche plein écran.
   Écrans : {id, sec, titre(), sous(), corps(c,F), ok(), auto, si(), lien:{t(),f()}, avant: async()=>bool, final}
   ============================================================================ */
const IKF_SVG=(p,s=22,w=2.4)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IKF_CHECK=IKF_SVG('<path d="M5 12.5l4.5 4.5L19 7.5"/>',15,3.4), IKF_CHEV_G=IKF_SVG('<path d="M15 5l-7 7 7 7"/>',22,2.6),
  IKF_CHEV_D=IKF_SVG('<path d="M9 5l7 7-7 7"/>',18,2.4), IKF_CROIX=IKF_SVG('<path d="M6 6l12 12M18 6L6 18"/>',19,2.6);
function ikfTile(ic,s){ return `<span class="ikob-tile" style="width:${s}px;height:${s}px">${ICN(ic,Math.round(s*.52),'currentColor')}</span>`; }
function ikfMk(h,cls){ const x=document.createElement('div'); if(cls) x.className=cls; x.innerHTML=h; return x; }
function ikfEsc(s){ return escHtml(String(s==null?'':s)); }
function ikfRange(a,b){ const o=[]; for(let i=a;i<=b;i++) o.push(i); return o; }
function ikfDk(x){ return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); }
function ikfLoc(){ return curLang()==='ar'?'ar':curLang()==='en'?'en-GB':'fr-FR'; }
function ikfDate(s,o){ try{ return new Date(s+'T12:00:00').toLocaleDateString(ikfLoc(),o||{day:'numeric',month:'long',year:'numeric'}); }catch(e){ return s; } }
function ikfTic(){ try{ haptic(); }catch(e){} try{ sfx('tap'); }catch(e){} }
/* roue jour / mois / année de l'app ; le jour est recalé sur la longueur du mois */
function ikfPickDate(titre,val,min,max,cb){
  const ys=ikfRange(min.getFullYear(),max.getFullYear());
  const v=val?new Date(val+'T12:00:00'):new Date(min.getTime()+(max-min)/2);
  const mn=i=>{ try{ return new Date(2020,i,1).toLocaleDateString(curLang()==='ar'?'ar':curLang(),{month:'short'}); }catch(e){ return String(i+1); } };
  openPicker({title:titre,cols:[{values:ikfRange(1,31),sel:v.getDate()-1},{values:ikfRange(0,11),sel:v.getMonth(),fmt:mn,wide:true},{values:ys,sel:Math.max(0,ys.indexOf(v.getFullYear()))}],seps:[null,null],
    onOk:idx=>{ const y=ys[idx[2]], m=idx[1], nj=new Date(y,m+1,0).getDate(); let x=new Date(y,m,Math.min(idx[0]+1,nj),12);
      if(x<min) x=new Date(min); if(x>max) x=new Date(max); cb(ikfDk(x)); }});
}

function ikFlow(cfg){
  let el=null, cur=null, depuisRecap=false, occupe=false, autoT=0, propre=false;
  const E=cfg.screens;
  const F={};
  /* ---------- briques (elles redessinent le bouton du bas à chaque choix) ---------- */
  F.liste=(opts,estSel,surChoix,multi)=>{
    const L=ikfMk(opts.map(o=>`<button type="button" class="ikob-opt${o.ic?' ico':''}" role="${multi?'checkbox':'radio'}" data-v="${ikfEsc(o.v)}" aria-checked="${!!estSel(o.v)}">${o.ic?ikfTile(o.ic,38):''}<span class="ikob-opt-t"><b>${o.t}${o.tag?` <em class="ikob-tag">${o.tag}</em>`:''}</b>${o.s?`<small>${o.s}</small>`:''}</span><span class="ikob-coche">${IKF_CHECK}</span></button>`).join(''),'ikob-liste'+(multi?' ikob-multi':''));
    L.setAttribute('role',multi?'group':'radiogroup');
    L.addEventListener('click',e=>{ const b=e.target.closest('.ikob-opt'); if(!b) return; ikfTic(); surChoix(b.dataset.v);
      L.querySelectorAll('.ikob-opt').forEach(x=>x.setAttribute('aria-checked',String(!!estSel(x.dataset.v)))); F.maj(); });
    return L;
  };
  F.seg=(opts,estSel,surChoix,cols)=>{
    const S=ikfMk(opts.map(o=>`<button type="button" role="radio" data-v="${ikfEsc(o.v)}" aria-checked="${!!estSel(o.v)}">${o.t}</button>`).join(''),'ikob-seg'+(cols?' grille':''));
    if(cols) S.style.gridTemplateColumns='repeat('+cols+',1fr)';
    S.setAttribute('role','radiogroup');
    S.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; try{ haptic(); }catch(_){} surChoix(b.dataset.v);
      S.querySelectorAll('button').forEach(x=>x.setAttribute('aria-checked',String(!!estSel(x.dataset.v)))); F.maj(); });
    return S;
  };
  /* champ réglable : ouvre la roue de l'app ; x.ouvre(fin) appelle fin() une fois la valeur posée */
  F.champs=defs=>{
    const L=ikfMk(defs.map((x,i)=>`<button type="button" class="ikob-val" data-i="${i}"><span>${x.t}${x.s?`<small>${x.s}</small>`:''}</span><b class="${x.vide&&x.vide()?'vide':''}">${x.aff()}</b>${IKF_CHEV_D}</button>`).join(''),'ikob-liste');
    L.addEventListener('click',e=>{ const b=e.target.closest('.ikob-val'); if(!b) return; const x=defs[+b.dataset.i]; try{ haptic(); }catch(_){}
      x.ouvre(()=>{ b.querySelector('b').innerHTML=x.aff(); b.querySelector('b').classList.toggle('vide',!!(x.vide&&x.vide())); if(x.apres) x.apres(); F.maj(); }); });
    return L;
  };
  /* roue façon iPhone, en ligne */
  F.roue=(vals,val,fmt,surCh,etiq)=>{
    const r=document.createElement('div'); r.className='ikob-roue'; r.tabIndex=0; r.setAttribute('role','listbox'); if(etiq) r.setAttribute('aria-label',etiq);
    r.innerHTML='<div></div>'+vals.map(v=>`<span role="option">${fmt(v)}</span>`).join('')+'<div></div>';
    let i0=vals.indexOf(val); if(i0<0) i0=0;
    let ci=i0, raf=0, pret=false;
    const peindre=()=>{ raf=0; const c=r.scrollTop/44, it=r.children;
      const a=Math.max(0,Math.floor(c-5)), b=Math.min(vals.length-1,Math.ceil(c+5));
      for(let i=a;i<=b;i++){ const e=it[i+1], dd=i-c, ad=Math.abs(dd);
        e.style.transform=`perspective(500px) rotateX(${(-dd*17).toFixed(1)}deg) scale(${(1-Math.min(.22,ad*.06)).toFixed(3)})`; e.style.opacity=String(Math.max(.18,1-ad*.27)); }
      const n=Math.round(c); if(pret&&n!==ci&&n>=0&&n<vals.length){ ci=n; try{ haptic(); }catch(_){} surCh(vals[n]); F.maj(); } };
    r.addEventListener('scroll',()=>{ if(!raf) raf=requestAnimationFrame(peindre); },{passive:true});
    r.addEventListener('keydown',e=>{ if(e.key==='ArrowDown'||e.key==='ArrowUp'){ r.scrollBy({top:e.key==='ArrowDown'?44:-44,behavior:'smooth'}); e.preventDefault(); } });
    r.addEventListener('click',e=>{ const s=e.target.closest('span'); if(!s) return; const i=[...r.children].indexOf(s)-1; r.scrollTo({top:i*44,behavior:'smooth'}); });
    r._monter=()=>{ r.scrollTop=i0*44; peindre(); pret=true; };
    return r;
  };
  /* jours de la semaine en pastilles rondes (0 = lundi) */
  F.jours=(estSel,surCh,marque)=>{
    const L=t('dowShort').split(',');
    const J=ikfMk(L.map((l,i)=>`<button type="button" role="checkbox" data-d="${i}" aria-checked="${!!estSel(i)}" class="${marque===i?'long':''}">${ikfEsc(l)}</button>`).join(''),'ikob-jours');
    J.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; ikfTic(); surCh(+b.dataset.d); });
    return J;
  };
  F.bloc=(etiq,...enfants)=>{ const B=ikfMk(etiq?`<div class="ikob-etiq">${etiq}</div>`:'','ikob-bloc'); enfants.forEach(x=>x&&B.appendChild(x)); return B; };
  F.note=h=>ikfMk(h,'ikob-note');
  F.recap=(rows)=>{   // [{ic,t,v,go}] : chaque ligne rouvre son écran, puis on revient ici
    const L=ikfMk(rows.map((r,i)=>`<button type="button" class="ikob-rl" data-i="${i}">${ikfTile(r.ic,38)}<span><b>${r.t}</b><em dir="auto">${ikfEsc(r.v)}</em></span>${IKF_CHEV_D}</button>`).join(''),'ikob-recap');
    L.addEventListener('click',e=>{ const b=e.target.closest('.ikob-rl'); if(!b) return; ikfTic(); const r=rows[+b.dataset.i]; if(r.pre) r.pre(); if(r.go) F.corriger(r.go); });
    return L;
  };

  /* ---------- l'écran d'étapes entre deux parties ---------- */
  const I=cfg.inter;
  const ET={id:'__et',sec:null,prev:null,next:null,
    titre:()=>I.titre(etape(ET.next).sec), sous:()=>I.sous(etape(ET.prev).sec),
    corps(c){ const secs=I.secs(), iPrev=secs.indexOf(etape(ET.prev).sec), iNext=secs.indexOf(etape(ET.next).sec);
      const L=ikfMk(secs.map((s,i)=>{ const etat=i<=iPrev?'ok':(i===iNext?'next':'');
        return `<div class="ikob-et ${etat}${i===iPrev?' juste':''}" style="--i:${i}"><i>${IKF_CHECK}</i>${ikfTile(I.ics[s],34)}<span><b>${cfg.secs[s]()}</b><small>${etat==='ok'?ikfEsc(I.resume[s]()):(etat==='next'?t('ob2UpNext'):(I.nb[s]?I.nb[s]():''))}</small></span></div>`; }).join(''),'ikob-ets');
      c.appendChild(L); setTimeout(()=>{ try{ sfx('tick'); }catch(_){} },520); },
    ok:()=>true};
  const etape=id=>id==='__et'?ET:E.find(e=>e.id===id);
  const visibles=()=>E.filter(e=>!e.si||e.si());
  const finSection=()=>{ const V=visibles(), e=etape(cur), i=V.indexOf(e), n=V[i+1]; return !n||n.sec!==e.sec||!!n.final; };

  /* ---------- squelette ---------- */
  function monter(){
    if(cfg.host){ el=cfg.host; }
    else { el=document.createElement('div'); el.className='ikflow'; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); document.body.appendChild(el); propre=true;
      el.style.zIndex=String(typeof topZ==='function'?topZ():12500); }
    el.classList.add('ikob','ikob-q','on');
    el.innerHTML=`<div class="ikob-haut"><button type="button" class="ikob-rond" id="ikfRetour"></button><div class="ikob-barre"><i id="ikfBarre"></i></div>${cfg.closable?`<button type="button" class="ikob-rond" id="ikfFermer" aria-label="${ikfEsc(t('closeLab')||'×')}">${IKF_CROIX}</button>`:'<span class="ikob-pas" id="ikfPas"></span>'}</div>
      <div class="ikob-scene" id="ikfScene"></div>
      <div class="ikob-bas"><button type="button" class="btn ikob-go" id="ikfGo"></button><button type="button" class="ikob-lien" id="ikfLien" hidden></button></div>`;
    el.querySelector('#ikfRetour').addEventListener('click',retour);
    el.querySelector('#ikfGo').addEventListener('click',()=>{ const e=etape(cur); if(e&&e.final) finir(); else suivant(true); });
    el.querySelector('#ikfLien').addEventListener('click',()=>{ const e=etape(cur); if(e&&e.lien){ ikfTic(); e.lien.f(); } });
    const fx=el.querySelector('#ikfFermer'); if(fx) fx.addEventListener('click',()=>{ ikfTic(); F.fermer(); if(cfg.onCancel) cfg.onCancel(); });
    el._ikfKey=e=>{ if(e.key==='Escape'&&cfg.closable&&!occupe){ F.fermer(); if(cfg.onCancel) cfg.onCancel(); } };
    document.addEventListener('keydown',el._ikfKey);
  }
  F.maj=()=>{
    if(!el||!cur) return; const e=etape(cur); if(!e) return;
    const V=visibles(), i=cur==='__et'?Math.max(0,V.indexOf(etape(ET.next))-1):V.indexOf(e);
    el.querySelector('#ikfBarre').style.width=Math.round((Math.max(0,i)+1)/V.length*100)+'%';
    const ps=el.querySelector('#ikfPas'); if(ps) ps.textContent=(Math.max(0,i)+1)+'/'+V.length;
    const go=el.querySelector('#ikfGo'); go.disabled=cur!=='__et'&&!e.ok();
    el.querySelector('.ikob-bas').classList.toggle('cache',cur==='__et');
    if(e.bloque&&e.bloque()) go.disabled=true;
    const lastAuto=!e.final && !V[i+1] && cfg.finalLabel;
    go.textContent=e.final?cfg.finalLabel():(lastAuto?cfg.finalLabel():(depuisRecap&&finSection()?t('ob2Done'):t('continueLab')));
    const L=el.querySelector('#ikfLien'); if(e.lien&&(!e.lien.si||e.lien.si())){ L.hidden=false; L.textContent=e.lien.t(); } else L.hidden=true;
    const rt=el.querySelector('#ikfRetour'); rt.innerHTML=IKF_CHEV_G; rt.setAttribute('aria-label',t('backLab'));
    rt.style.visibility=(i<=0&&!cfg.onFirstBack&&cur!=='__et'&&!depuisRecap)?'hidden':'';
  };
  F.aller=(id,dir)=>{
    const e=etape(id); if(!e||!el) return; clearTimeout(autoT);
    const scene=el.querySelector('#ikfScene'), ancien=scene.querySelector('.ikob-ecran:not(.part)');
    if(ancien){ ancien.classList.add('part'); if(dir<0) ancien.classList.add('arr'); setTimeout(()=>ancien.remove(),330); }
    const c=document.createElement('div'); c.className='ikob-ecran entre'+(dir<0?' arr':'');
    cur=id;
    const nb=s=>curLang()==='fr'?String(s).replace(/ ([?!:])/g,' $1'):s;
    const sec=e.sec?cfg.secs[e.sec]():'';
    c.innerHTML=`<div class="ikob-sur">${sec}</div><h1 class="ikob-titre">${nb(e.titre())}</h1>${e.sous?`<p class="ikob-sous">${nb(e.sous())}</p>`:''}`;
    e.corps(c,F); scene.appendChild(c);
    requestAnimationFrame(()=>c.querySelectorAll('.ikob-roue').forEach(r=>{ if(r._monter&&!r.scrollTop) r._monter(); }));
    if(e.auto) c.addEventListener('click',ev=>{ if(!ev.target.closest('.ikob-opt')) return; clearTimeout(autoT); autoT=setTimeout(()=>{ if(cur===id&&e.ok()) suivant(true); },320); });
    try{ if(cfg.track) ikTrack(cfg.track,{id}); }catch(_){}
    // V4.11.2 : l'écran d'étapes entre deux parties est une simple animation, il passe tout seul
    // (un toucher n'importe où l'accélère) ; pas de bouton « Continuer » à presser.
    if(id==='__et'){ c.classList.add('ikob-et-auto'); c.addEventListener('click',()=>{ clearTimeout(autoT); if(cur==='__et') suivant(true); });
      autoT=setTimeout(()=>{ if(cur==='__et'&&el) suivant(true); },2100); }
    F.maj();
  };
  F.corriger=id=>{ depuisRecap=true; F.aller(id,1); };
  async function suivant(sonore){
    if(occupe||!el) return;
    const V=visibles(), e=etape(cur), i=V.indexOf(e); if(!e||!e.ok()) return;
    if(e.bloque&&e.bloque()) return;
    if(e.avant){ occupe=true; const go=el.querySelector('#ikfGo'), lab=go.textContent; go.disabled=true; go.textContent=t('checkingEllipsis');
      let ok=false; try{ ok=await e.avant(); }catch(_){} occupe=false; if(!el) return; go.textContent=lab; F.maj(); if(!ok) return; }
    if(sonore){ try{ haptic(); }catch(_){} }
    if(cur==='__et'){ F.aller(ET.next,1); return; }
    const fin=V.find(x=>x.final);
    if(depuisRecap&&finSection()&&fin){ depuisRecap=false; F.aller(fin.id,-1); return; }
    const n=V[i+1]; if(!n){ finir(); return; }
    if(I && n.sec!==e.sec && !n.final && I.secs().includes(n.sec)){ ET.prev=e.id; ET.next=n.id; F.aller('__et',1); return; }
    F.aller(n.id,1);
  }
  F.suivant=suivant;
  function retour(){
    if(occupe) return;
    if(cur==='__et'){ try{ haptic(); }catch(_){} F.aller(ET.prev,-1); return; }
    const V=visibles(), e=etape(cur), i=V.indexOf(e), fin=V.find(x=>x.final);
    if(depuisRecap){ const p=V[i-1]; if(!p||p.sec!==e.sec){ depuisRecap=false; if(fin){ F.aller(fin.id,-1); return; } } }
    if(i>0){ try{ haptic(); }catch(_){} F.aller(V[i-1].id,-1); return; }
    if(cfg.onFirstBack) cfg.onFirstBack();
  }

  /* ---------- fin : construction étape par étape, puis enregistrement ---------- */
  async function finir(){
    if(occupe||!el) return;
    if(cfg.avantFin && !cfg.avantFin()) return;
    occupe=true;
    const B=typeof cfg.build==='function'?cfg.build():cfg.build;
    if(!B){ occupe=false; const r=cfg.onFinish&&cfg.onFinish(); if(r!==false) F.fermer(); return; }
    const etapes=B.steps();
    const scene=el.querySelector('#ikfScene'); scene.innerHTML='';
    el.querySelector('.ikob-bas').style.visibility='hidden'; el.querySelector('#ikfRetour').style.visibility='hidden';
    const fx=el.querySelector('#ikfFermer'); if(fx) fx.style.visibility='hidden';
    el.querySelector('#ikfBarre').style.width='100%';
    const c=document.createElement('div'); c.className='ikob-ecran entre';
    c.innerHTML=`<div class="ikob-cons"><div class="ikob-anneau"><svg viewBox="0 0 132 132"><circle class="f" cx="66" cy="66" r="58"/><circle class="p" cx="66" cy="66" r="58"/></svg><b>0%</b></div>
      <h2>${B.titre()}</h2><ul>${etapes.map(x=>`<li><i>${IKF_CHECK}</i>${x}</li>`).join('')}</ul></div>`;
    scene.appendChild(c);
    const li=[...c.querySelectorAll('li')], anneau=c.querySelector('.p'), pc=c.querySelector('.ikob-anneau b');
    const att=ms=>new Promise(r=>setTimeout(r,ms));
    let ok=true;
    for(let k=0;k<li.length;k++){
      li[k].classList.add('en');
      // le vrai travail tourne pendant l'avant-dernière étape (le reste est la mise en scène)
      if(k===Math.max(0,li.length-2) && B.run){ await att(250); try{ ok=(await B.run())!==false; }catch(err){ console.error('[IKORUN] flow build',err); ok=false; } await att(300); }
      else await att(k===li.length-1?420:560);
      if(!ok) break;
      li[k].classList.remove('en'); li[k].classList.add('ok'); try{ haptic(); sfx('tick'); }catch(_){}
      const pr=(k+1)/li.length; anneau.style.strokeDashoffset=String(364*(1-pr)); pc.textContent=Math.round(pr*100)+'%';
    }
    if(!ok){ occupe=false; el.querySelector('.ikob-bas').style.visibility=''; if(fx) fx.style.visibility='';
      const fin=visibles().find(x=>x.final); F.aller(fin?fin.id:visibles()[0].id,-1); return; }
    if(B.pret) c.querySelector('h2').innerHTML=B.pret();
    try{ sfx('goal'); }catch(_){}
    await att(650); occupe=false;
    const r=cfg.onFinish&&cfg.onFinish(); if(r!==false) F.fermer();
  }
  F.fermer=()=>{
    if(!el) return; const x=el; el=null; cur=null; clearTimeout(autoT);
    document.removeEventListener('keydown',x._ikfKey);
    if(propre){ x.classList.add('sort'); setTimeout(()=>x.remove(),380); }
    else { x.classList.remove('ikob','ikob-q'); x.innerHTML=''; }   // pas d'identifiants en double avec un autre assistant
    if(cfg.onClose) cfg.onClose();
  };
  F.ouvert=()=>!!el;
  F.cur=()=>cur;
  F.start=(id)=>{ monter(); const V=visibles(); F.aller(id||(V[0]&&V[0].id),1); return F; };
  return F;
}
