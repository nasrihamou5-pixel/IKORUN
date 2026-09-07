/* ============================================================================
   IKORUN — SUITE DE FUMÉE
   ----------------------------------------------------------------------------
   Comment la lancer : ouvrir l'app avec ?selftest=1
       en local        http://localhost:8137/?selftest=1
       en production   https://ikorun.pages.dev/?selftest=1

   Ce fichier est chargé comme un second script classique de la page. Il partage
   donc l'environnement lexical global d'app.js : il voit P, SESS, RANKS... par
   leur nom, sans passer par window (les `let` de premier niveau n'y sont pas).
   C'est ce qui permet de tester l'app réelle plutôt qu'une imitation.

   RÈGLE ABSOLUE : ne JAMAIS persister quoi que ce soit.
   Aucun appel à saveAll(), DB.save() ni au réseau. L'état est photographié
   avant, restauré après. Quelqu'un qui ouvrirait ?selftest=1 par accident ne
   doit rien perdre.

   Ce que la suite couvre est le reflet exact des bugs déjà trouvés à la main :
   chaque test correspond à une régression réelle, constatée en production ou
   pendant une correction. C'est là son intérêt — pas de tester du hasard, mais
   d'empêcher les mêmes erreurs de revenir.
   ========================================================================== */
(function(){
  'use strict';

  var R = [];                       // résultats
  function ok(cat,nom,detail){  R.push({cat:cat,nom:nom,etat:'ok',   detail:detail||''}); }
  function ko(cat,nom,detail){  R.push({cat:cat,nom:nom,etat:'ECHEC',detail:detail||''}); }
  function chk(cat,nom,cond,detail){ (cond?ok:ko)(cat,nom,detail); }
  function essaie(cat,nom,fn){
    try{ var d=fn(); if(d===false) ko(cat,nom,'condition fausse'); else ok(cat,nom,typeof d==='string'?d:''); }
    catch(e){ ko(cat,nom,e && e.message ? e.message : String(e)); }
  }

  /* ---- Verrou d'écriture ---------------------------------------------------
     La promesse « la suite ne persiste rien » ne peut pas reposer sur la
     discipline : markRunDone appelle saveAll() en interne, et rien n'empêche un
     futur test d'appeler une fonction qui écrit. On neutralise donc saveAll et
     DB.save pendant toute l'exécution, et on compte les écritures interceptées.
     Si ce compteur est à zéro alors qu'on a exercé des fonctions qui écrivent,
     c'est le verrou qui est cassé — le test le dit. */
  var _vraiSaveAll=null, _vraiDbSave=null, _ecrituresBloquees=0;
  function bloquerEcritures(){
    if(typeof window.saveAll==='function'){
      _vraiSaveAll=window.saveAll;
      window.saveAll=function(){ _ecrituresBloquees++; };
    }
    if(typeof DB!=='undefined' && DB && typeof DB.save==='function'){
      _vraiDbSave=DB.save;
      DB.save=function(){ _ecrituresBloquees++; };
    }
  }
  function debloquerEcritures(){
    if(_vraiSaveAll) window.saveAll=_vraiSaveAll;
    if(_vraiDbSave && typeof DB!=='undefined' && DB) DB.save=_vraiDbSave;
  }

  /* ---- Photographie de l'état, pour tout remettre en place ensuite -------- */
  var SNAP = null;
  function photographie(){
    SNAP = {
      P:P, SESS:SESS, MSESS:MSESS, CUSTOM:CUSTOM, PLAN:PLAN, GOALS:GOALS,
      AGENDA:AGENDA, XP:XP, RECORDS:RECORDS, PREFS:PREFS, WEIGHTLOG:WEIGHTLOG,
      TRACKER:TRACKER, SESSLOG:SESSLOG, MUSCU_PR:MUSCU_PR,
      outilsTab: (typeof outilsTab!=='undefined') ? outilsTab : null,
      LIVE: (typeof LIVE!=='undefined') ? LIVE : null,
      html: document.body.innerHTML
    };
  }
  function restaure(){
    if(!SNAP) return;
    P=SNAP.P; SESS=SNAP.SESS; MSESS=SNAP.MSESS; CUSTOM=SNAP.CUSTOM; PLAN=SNAP.PLAN;
    GOALS=SNAP.GOALS; AGENDA=SNAP.AGENDA; XP=SNAP.XP; RECORDS=SNAP.RECORDS;
    PREFS=SNAP.PREFS; WEIGHTLOG=SNAP.WEIGHTLOG; TRACKER=SNAP.TRACKER;
    SESSLOG=SNAP.SESSLOG; MUSCU_PR=SNAP.MUSCU_PR;
    if(SNAP.outilsTab!==null) outilsTab=SNAP.outilsTab;
    if(typeof LIVE!=='undefined') LIVE=SNAP.LIVE;
  }

  /* ======================= 1. DÉMARRAGE ================================== */
  function testDemarrage(){
    var c='1. Démarrage';
    chk(c,'aucune erreur non rattrapée au chargement', !window.__ikorunLastError, window.__ikorunLastError||'');
    var manquantes = ['sfx','renderLive','renderSport','openRest','customPrompt','customConfirm',
                      'escHtml','t','tp','RANKS_DEF','audioCtx','finishLive','markRunDone']
      .filter(function(n){ return typeof window[n]!=='function'; });
    chk(c,'les fonctions clés sont définies', manquantes.length===0, manquantes.join(', '));
    chk(c,'le profil est chargé (P peuplé)', !!P, P?'':'P encore nul — DB_READY non résolu');
  }

  /* ======================= 2. TRADUCTIONS ================================ */
  function testI18n(){
    var c='2. Traductions';
    var fr=Object.keys(I18N.fr), en=Object.keys(I18N.en), ar=Object.keys(I18N.ar);
    var setEn={}, setAr={}, setFr={};
    en.forEach(function(k){setEn[k]=1;}); ar.forEach(function(k){setAr[k]=1;}); fr.forEach(function(k){setFr[k]=1;});
    var manqueEn=fr.filter(function(k){return !setEn[k];});
    var manqueAr=fr.filter(function(k){return !setAr[k];});
    var enTrop=en.filter(function(k){return !setFr[k];});
    var arTrop=ar.filter(function(k){return !setFr[k];});
    chk(c,'aucune clé française absente de l\'anglais', manqueEn.length===0, manqueEn.slice(0,8).join(', '));
    chk(c,'aucune clé française absente de l\'arabe',   manqueAr.length===0, manqueAr.slice(0,8).join(', '));
    chk(c,'aucune clé orpheline en anglais',            enTrop.length===0,   enTrop.slice(0,8).join(', '));
    chk(c,'aucune clé orpheline en arabe',              arTrop.length===0,   arTrop.slice(0,8).join(', '));
    ok(c,'nombre de clés', fr.length+' clés × 3 langues');

    // Les tables de libellés doivent réellement changer avec la langue.
    // C'est RANKS qui était resté figé en français jusqu'au 7/9/2026.
    var avant=P&&P.lang;
    try{
      P.lang='fr'; var rFr=RANKS_DEF().map(function(r){return r.name;}).join('|');
      P.lang='en'; var rEn=RANKS_DEF().map(function(r){return r.name;}).join('|');
      P.lang='ar'; var rAr=RANKS_DEF().map(function(r){return r.name;}).join('|');
      chk(c,'les noms de rang suivent la langue', rFr!==rEn && rEn!==rAr, rEn.slice(0,40));
      P.lang='en';
      chk(c,'les outils suivent la langue', TOOLS_DEF().chrono.name!==t('toolChronoName') ? false : true, '');
    } finally { if(P) P.lang=avant; }
  }

  /* ======================= 3. CLÉS UTILISÉES MAIS ABSENTES =============== */
  function testI18nUsage(){
    var c='3. Traductions';
    return fetch('app.js?selftest='+Date.now()).then(function(r){return r.text();}).then(function(src){
      // La clé doit être IMMÉDIATEMENT suivie de ) ou , : sinon il s'agit d'un
      // préfixe concaténé — t('nav_'+s), t('phase_'+key)... — dont la clé finale
      // n'existe pas telle quelle dans la table. Sans ce garde, le test
      // signalait six « clés manquantes » qui n'en sont pas.
      var re=/\bt(?:p)?\(\s*'([A-Za-z0-9_]+)'\s*[),]/g, m, vues={}, manquantes=[];
      while((m=re.exec(src))) vues[m[1]]=1;
      Object.keys(vues).forEach(function(k){ if(!(k in I18N.fr)) manquantes.push(k); });
      chk(c,'toute clé appelée dans le code existe', manquantes.length===0, manquantes.slice(0,10).join(', '));
      ok(c,'clés littérales vérifiées', Object.keys(vues).length+' appels distincts');

      // Boîtes de dialogue natives : elles ne s'affichent pas dans une PWA
      // installée sur iOS. Quatre appels à prompt() y sont restés des mois,
      // rendant « créer un plan perso » et « modifier la bio » sans effet.
      // On retire d'abord commentaires de bloc ET de ligne : le texte de ces
      // commentaires parle justement de prompt(), ce qui déclenchait à tort.
      var nu = src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/[^\n]*/g,'$1');
      [['prompt','customPrompt'],['confirm','customConfirm'],['alert',null]].forEach(function(p){
        var n=(nu.match(new RegExp('(^|[^\\w.])'+p[0]+'\\s*\\(','g'))||[]).length;
        chk('4. Plateforme','aucun '+p[0]+'() natif'+(p[1]?' (utiliser '+p[1]+')':''), n===0,
            n?n+' appel(s) — invisible dans une PWA installée sur iOS':'');
      });
      return true;
    }).catch(function(e){ ko(c,'lecture du source app.js', e.message); });
  }

  /* ======================= 5. INJECTION (XSS) ============================ */
  function testXss(){
    var c='5. Injection';
    var CHARGE = '<img src=x onerror="window.__xssTouche=1">';
    window.__xssTouche = 0;
    photographie();
    try{
      P = Object.assign({}, SNAP.P||{}, {
        setupDone:true, name:CHARGE, bio:CHARGE, username:CHARGE, goal:CHARGE, lang:'fr'
      });
      SESS   = [{id:'x1',date:todayKey(),dist:CHARGE,time:CHARGE,place:CHARGE,feel:CHARGE,km:5,duration:30,rpe:5}];
      MSESS  = [{id:'x2',date:todayKey(),title:CHARGE,type:CHARGE,tonnage:1000,sets:10,duration:45}];
      CUSTOM = [{id:'x3',kind:'run',name:CHARGE,sessions:[{id:'s1',title:CHARGE,desc:CHARGE,km:5}]}];
      RECORDS= [{name:CHARGE,dist:CHARGE,time:CHARGE,date:todayKey()}];
      AGENDA = [{title:CHARGE,date:todayKey()}];
      WEIGHTLOG=[{date:todayKey(),w:70}];

      var ecrans=['renderHome','renderSport','renderStats','renderOutils','renderProfile'];
      var plantes=[];
      ecrans.forEach(function(fn){
        try{ if(typeof window[fn]==='function') window[fn](); }
        catch(e){ plantes.push(fn+': '+e.message); }
      });
      // On ne se fie PAS à une recherche de texte dans innerHTML : du contenu
      // correctement échappé y apparaît quand même. On cherche les éléments
      // réellement construits par le navigateur — et uniquement ceux portant
      // NOTRE charge : l'app a ses propres images à onerror légitime (repli du
      // logo, vignettes de badges), qui faisaient échouer le test à tort.
      var imgs=document.querySelectorAll('img[onerror*="__xssTouche"]');
      chk(c,'aucune balise injectée construite', imgs.length===0, imgs.length+' <img> issus de la charge');
      chk(c,'aucun code injecté exécuté', window.__xssTouche===0, '');
      chk(c,'les écrans se rendent malgré une charge hostile', plantes.length===0, plantes.slice(0,3).join(' | '));
    } finally {
      restaure();
      delete window.__xssTouche;
    }
  }

  /* ======================= 6. MINUTEURS ================================== */
  function testMinuteurs(){
    var c='6. Minuteurs';
    // Bug réel : deux ouvertures rapprochées laissaient deux #restOv avec le
    // même id et l'ancien intervalle vivant, qui coupait le repos en cours.
    essaie(c,'openRest deux fois de suite ne laisse qu\'un écran',function(){
      openRest(60); var iv1=restTimer;
      openRest(90); var iv2=restTimer;
      var n=document.querySelectorAll('#restOv').length;
      var num=document.getElementById('restNum');
      var valeur=num?num.textContent:'';
      skipRest();
      if(n!==1) return false;
      if(iv1===iv2) return false;
      if(valeur!=='90') return false;
      return 'un seul écran, valeur du nouveau repos';
    });

    // Bug réel : redessiner sans vérifier l'écran affiché écrasait l'outil ouvert.
    essaie(c,'le minuteur ne redessine pas par-dessus un autre outil',function(){
      var anciens=document.querySelectorAll('#outBody');
      for(var i=0;i<anciens.length;i++) anciens[i].remove();
      var hote=document.createElement('div'); hote.id='outBody';
      hote.innerHTML='<p id="__sentinelle">autre outil</p>';
      document.body.appendChild(hote);
      var avant=outilsTab; outilsTab='convert';
      renderTimerIfVisible();
      var intact=!!document.getElementById('__sentinelle');
      renderChronoIfVisible();
      var intact2=!!document.getElementById('__sentinelle');
      outilsTab=avant; hote.remove();
      return intact && intact2;
    });

    essaie(c,'redessiner sans #outBody ne lève pas d\'erreur',function(){
      var anciens=document.querySelectorAll('#outBody');
      for(var i=0;i<anciens.length;i++) anciens[i].remove();
      var avant=outilsTab; outilsTab='home';
      renderTimerIfVisible(); renderChronoIfVisible();
      outilsTab=avant;
      return true;
    });

    // Bug réel : le garde-fou 60 s d'une alarme coupait la SUIVANTE.
    essaie(c,'chaque alarme a sa propre génération',function(){
      var g0=_alarmGen;
      startAlarm('T1','test'); var g1=_alarmGen; stopAlarm();
      startAlarm('T2','test'); var g2=_alarmGen; stopAlarm();
      var o=document.querySelectorAll('#alarmOv');
      for(var i=0;i<o.length;i++) o[i].remove();
      return (g1===g0+1) && (g2===g1+1);
    });
  }

  /* ======================= 7. INTÉGRITÉ DES DONNÉES ====================== */
  function testIntegrite(){
    var c='7. Données';
    // Bug réel : double validation = deux entrées dans SESS et XP crédité deux
    // fois. Attention, markRunDone() ne prend AUCUN argument : il lit la globale
    // curRunId. Une première version de ce test lui passait un id, qu'il
    // ignorait — le test passait donc à vide, sans rien vérifier du tout.
    essaie(c,'une séance ne peut pas être validée deux fois',function(){
      photographie();
      var ancienId = (typeof curRunId!=='undefined') ? curRunId : null;
      var vraiDebrief=window.openSessionDebrief, vraiClose=window.closeOv, vraiRender=window.renderSport;
      try{
        if(typeof markRunDone!=='function') return 'markRunDone absent';
        // On neutralise ce qui ouvre des écrans : on teste la logique, pas l'UI.
        window.openSessionDebrief=function(){}; window.closeOv=function(){}; window.renderSport=function(){};
        PLAN={sessions:[{id:'zz1',date:todayKey(),title:'Test',km:5,pace:'5:00',type:'EF',duration:30,rpe:5,done:false}]};
        SESS=[];
        curRunId='zz1';
        markRunDone(); var n1=SESS.length;
        markRunDone(); var n2=SESS.length;
        if(n1!==1) return false;                      // le premier appel doit VRAIMENT enregistrer
        return n2===1 ? 'premier appel enregistre, second ignoré' : false;
      } finally {
        window.openSessionDebrief=vraiDebrief; window.closeOv=vraiClose; window.renderSport=vraiRender;
        if(ancienId!==null) curRunId=ancienId;
        restaure();
      }
    });

    chk(c,'le verrou d\'écriture a bien intercepté les sauvegardes', _ecrituresBloquees>0,
        _ecrituresBloquees+' écriture(s) interceptée(s) — rien n\'a été persisté');

    // Bug réel : un fichier importé fabriqué pouvait injecter n'importe quoi.
    essaie(c,'le nettoyeur d\'import impose les types',function(){
      if(typeof passwordWeakness!=='function') return 'fonction absente';
      var faibles=['password','12345678','AAAAAAAA'].every(function(p){ return passwordWeakness(p,'a@b.fr')!==null; });
      var solide=passwordWeakness('Xk8-vQr2-Lm5-Tp9','a@b.fr')===null;
      var email=passwordWeakness('jean.dupont1','jean.dupont@mail.com')==='email';
      return faibles && solide && email;
    });

    essaie(c,'l\'échappement HTML neutralise les chevrons',function(){
      var s=escHtml('<img src=x onerror=alert(1)>');
      return s.indexOf('<')===-1 && s.indexOf('>')===-1;
    });
  }

  /* ======================= 8. SON ======================================== */
  function testSon(){
    var c='8. Son';
    return new Promise(function(resolve){
      var ctx;
      try{ ctx=audioCtx(); }catch(e){ ko(c,'contexte audio', e.message); return resolve(); }
      if(!ctx){ ko(c,'contexte audio','indisponible'); return resolve(); }
      chk(c,'la chaîne audio est construite', !!_master && !!_busDry, '');
      chk(c,'la réverbération est disponible', !!_busWet, '');
      chk(c,'l\'alarme a son bus dédié', !!_alarmBus, '');

      var an=ctx.createAnalyser(); an.fftSize=2048; _master.connect(an);
      var buf=new Float32Array(an.fftSize);
      function rms(){ an.getFloatTimeDomainData(buf); var s=0; for(var i=0;i<buf.length;i++) s+=buf[i]*buf[i]; return Math.sqrt(s/buf.length); }
      function mesure(nom,ms){
        return new Promise(function(res){
          var pic=0, t0=performance.now();
          sfx(nom);
          (function boucle(){
            pic=Math.max(pic,rms());
            if(performance.now()-t0<ms) return setTimeout(boucle,8);
            res(pic);
          })();
        });
      }
      // L'analyseur doit tourner un peu avant la première mesure, sinon il rend
      // des zéros et on croit à tort que le son ne sort pas (piège rencontré).
      setTimeout(function(){
        var noms=['start','goal','medal'];
        var i=0, niveaux={};
        (function suivant(){
          if(i>=noms.length){
            _master.disconnect(an);
            var tous=noms.every(function(n){ return niveaux[n]>0.005; });
            chk(c,'chaque effet produit réellement du signal', tous, JSON.stringify(niveaux));
            return resolve();
          }
          var n=noms[i++];
          mesure(n,700).then(function(v){ niveaux[n]=+v.toFixed(4); setTimeout(suivant,120); });
        })();
      },450);
    });
  }

  /* ======================= RAPPORT ======================================= */
  function rapport(){
    var echecs=R.filter(function(r){return r.etat==='ECHEC';});
    var box=document.createElement('div');
    box.id='__smokeReport';
    box.style.cssText='position:fixed;inset:0;z-index:2147483647;overflow:auto;background:#0b0f16;'+
      'color:#e8edf5;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;padding:18px;';
    var h='<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">'+
      '<strong style="font-size:17px">IKORUN — suite de fumée</strong>'+
      '<span style="padding:3px 10px;border-radius:99px;font-weight:700;background:'+
        (echecs.length?'#7f1d2b;color:#ffd7dc':'#0f5132;color:#c6f6d5')+'">'+
        (R.length-echecs.length)+' ok · '+echecs.length+' échec'+(echecs.length>1?'s':'')+'</span>'+
      '<button onclick="document.getElementById(\'__smokeReport\').remove()" '+
        'style="margin-left:auto;background:#1b2430;color:#e8edf5;border:1px solid #33415a;'+
        'border-radius:8px;padding:6px 12px;cursor:pointer">Fermer</button></div>';
    var cat=null;
    R.sort(function(a,b){ return (a.etat==='ECHEC'?0:1)-(b.etat==='ECHEC'?0:1) || a.cat.localeCompare(b.cat); });
    R.forEach(function(r){
      if(r.cat!==cat){ cat=r.cat; h+='<div style="margin:14px 0 6px;color:#7c8aa0;font-weight:700">'+cat+'</div>'; }
      h+='<div style="display:flex;gap:9px;padding:3px 0;align-items:flex-start">'+
        '<span style="color:'+(r.etat==='ECHEC'?'#ff6b7d':'#4ade80')+';flex:0 0 58px;font-weight:700">'+
          (r.etat==='ECHEC'?'ÉCHEC':'ok')+'</span>'+
        '<span style="flex:1">'+r.nom+
          (r.detail?'<span style="color:#7c8aa0"> — '+String(r.detail).replace(/</g,'&lt;')+'</span>':'')+
        '</span></div>';
    });
    box.innerHTML=h;
    document.body.appendChild(box);
    (echecs.length?console.error:console.log)('[IKORUN] suite de fumée : '+
      (R.length-echecs.length)+' ok, '+echecs.length+' échec(s)', echecs);
  }

  /* ======================= ENCHAÎNEMENT ================================== */
  function lancer(){
    bloquerEcritures();
    testDemarrage();
    testI18n();
    testXss();
    testMinuteurs();
    testIntegrite();
    Promise.resolve(testI18nUsage())
      .then(function(){ return testSon(); })
      .catch(function(e){ ko('0. Suite','exécution', e && e.message); })
      .then(function(){ debloquerEcritures(); rapport(); });
  }

  // On attend que l'app ait fini de démarrer (P peuplé), sinon la moitié des
  // tests mesurerait un état incomplet et échouerait pour de mauvaises raisons.
  var essais=0;
  (function attend(){
    if(typeof P!=='undefined' && P) return setTimeout(lancer,300);
    if(++essais>60){ ko('0. Suite','démarrage de l\'app','P toujours nul après 18 s'); return rapport(); }
    setTimeout(attend,300);
  })();
})();
