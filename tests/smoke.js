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
    if(!P){ ok(c,'bascule de langue','ignorée — profil non chargé'); return; }
    var avant=P&&P.lang;
    try{
      P.lang='fr'; var rFr=RANKS_DEF().map(function(r){return r.name;}).join('|');
      P.lang='en'; var rEn=RANKS_DEF().map(function(r){return r.name;}).join('|');
      P.lang='ar'; var rAr=RANKS_DEF().map(function(r){return r.name;}).join('|');
      chk(c,'les noms de rang suivent la langue', rFr!==rEn && rEn!==rAr, rEn.slice(0,40));
      P.lang='en';
      chk(c,'les outils suivent la langue', TOOLS_DEF().chrono.name!==t('toolChronoName') ? false : true, '');
      // Pluriels (27/09) : « {0} membre(s) », « 1 days », et en arabe la forme 3-10 partout.
      P.lang='fr'; var pFr=[1,2].map(function(n){return tp('clubMembersCount',n);});
      P.lang='en'; var pEn=[1,5].map(function(n){return tp('clubMembersCount',n);});
      P.lang='ar'; var pAr=[2,3,11].map(function(n){return tp('clubMembersCount',n);});
      chk(c,'les pluriels suivent le nombre et la langue',
        pFr[0]!==pFr[1] && pEn[0]!==pEn[1] && pAr[0]!==pAr[1] && pAr[1]!==pAr[2] && pFr.concat(pEn,pAr).every(function(x){return x.indexOf('(s)')===-1;}),
        pFr.concat(pEn).join(' · '));
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
  /* ======================= 9. AUDIT DU 24/09 ============================
     Chaque test encode un bug réel trouvé en forçant l'app ce jour-là. */
  function testAudit2409(){
    var c='9. Audit 24/09';
    // Les heures de prière sortaient toutes négatives (« Fajr -19:03 ») dès fin
    // mars : angles jamais ramenés à [0,360[. Même bug côté serveur, où plus
    // aucune notification de prière ne partait.
    essaie(c,'heures de prière valides et dans l\'ordre',function(){
      var p=prayerTimes(), ordre=['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'], prev=-1;
      for(var i=0;i<ordre.length;i++){
        var v=p[ordre[i]]; if(!/^\d\d:\d\d$/.test(v)) return false;
        var m=+v.slice(0,2)*60+ +v.slice(3); if(m<=prev) return false; prev=m;
      }
      return 'Fajr '+p.Fajr+' · Isha '+p.Isha;
    });
    // Un fichier de sauvegarde fabriqué pouvait injecter du HTML via le profil
    // (taille, poids, objectif…) ou les rubriques jusque-là non importées.
    essaie(c,'l\'import neutralise le HTML et ne garde que les champs connus',function(){
      var d=cleanImportedDeep({a:'<img src=x onerror=1>',b:['<b>ok</b>',3],c:{d:'"x'}});
      if(JSON.stringify(d).indexOf('<')>=0 || d.c.d.indexOf('"')>=0) return false;
      var p=cleanImportedProfile({height:'<img>',weight:'72',pendingEmail:'a@b.c',inconnu:1,name:'A<b>'});
      if('height' in p || 'pendingEmail' in p || 'inconnu' in p || p.weight!==72 || p.name!=='Ab') return false;
      // un identifiant finit dans un onclick="openPerso('…')" : ni apostrophe ni parenthèse
      var cu=cleanImportedDeep([{id:"x');alert(1);('",progId:"p'+1",name:"L'allure"}]);
      if(cu[0].id!=='xalert1' || cu[0].progId!=='p1' || cu[0].name!=="L'allure") return false;
      return true;
    });
    essaie(c,'la course visée est déduite de l\'objectif',function(){
      var ancien=P.goal;
      try{ P.goal='Semi de Béjaïa sous 2h'; return inferRaceFromGoal()==='Semi-marathon'; }
      finally{ P.goal=ancien; }
    });
    // Le Jour J tombait sur « le dernier jour d'entraînement de la dernière
    // semaine » (un samedi pour une course un jeudi), suivi d'autres séances.
    essaie(c,'le Jour J est posé exactement à la date de la course',function(){
      photographie();
      var saved={compDate:P.compDate,days:P.days,objRace:P.objRace,kmWeekMin:P.kmWeekMin,kmWeekMax:P.kmWeekMax};
      var vraiToast=window.toast, vraiBurst=window.burst, vraiRender=window.renderSport;
      try{
        window.toast=function(){}; window.burst=function(){}; window.renderSport=function(){};
        // Profil vide (compte neuf, pas encore de chrono) : sans VDOT, generatePlan
        // refuse à juste titre — on prête un record le temps du test (restaure()
        // remet RECORDS en place ensuite).
        if(!getUserVDOT()) RECORDS=[{dist:'5000 m',meters:5000,time:'25:00',date:todayKey()}];
        var d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+60); while(d.getDay()!==4) d.setDate(d.getDate()+1);
        var cible=dateKey(d);
        P.compDate=cible; P.days=[1,3,5,6]; P.objRace='Semi-marathon'; P.kmWeekMin=35; P.kmWeekMax=56;
        generatePlan();
        var course=PLAN.sessions.filter(function(s){ return s.baseType==='COURSE'; });
        var apres=PLAN.sessions.filter(function(s){ return s.date>cible; });
        if(course.length!==1 || course[0].date!==cible || apres.length) return false;
        return 'course le '+cible+', aucune séance après';
      } finally {
        window.toast=vraiToast; window.burst=vraiBurst; window.renderSport=vraiRender;
        P.compDate=saved.compDate; P.days=saved.days; P.objRace=saved.objRace; P.kmWeekMin=saved.kmWeekMin; P.kmWeekMax=saved.kmWeekMax;
        restaure();
      }
    });
  }

  /* ======================= 9. PLAN — GARDE-FOU DE CHARGE ================== */
  // Audit du 27/09 : +29 % d'une semaine à l'autre, décharges à 100-114 % du pic,
  // VMA le lendemain d'une sortie longue, et une régénération hebdomadaire qui
  // gonflait le volume même à charge stable (S9 : 59 → 78 → 89 km pour un max de 60).
  function testGardeFou(){
    var c='10. Plan — garde-fou de charge';
    var SC=[['10 km',[1,2,4,5,6],40,60,14],['Semi-marathon',[1,3,5,0],35,56,16],['Marathon',[1,2,4,5,0],50,80,18]];
    photographie();
    var saved={compDate:P.compDate,days:P.days,objRace:P.objRace,kmWeekMin:P.kmWeekMin,kmWeekMax:P.kmWeekMax};
    var vraiToast=window.toast, vraiBurst=window.burst, vraiRender=window.renderSport;
    var bilan={saut:[],decharge:[],enchaine:[],max:[],regen:[]};
    try{
      window.toast=function(){}; window.burst=function(){}; window.renderSport=function(){};
      if(!getUserVDOT()) RECORDS=[{dist:'5000 m',meters:5000,time:'21:00',date:todayKey()}];
      SC.forEach(function(sc){
        var d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+sc[4]*7-1);
        P.compDate=dateKey(d); P.days=sc[1]; P.objRace=sc[0]; P.kmWeekMin=sc[2]; P.kmWeekMax=sc[3];
        SESSLOG=[]; SESS=[];
        generatePlan();
        var nom=sc[0];
        var semaines={}; PLAN.sessions.forEach(function(s){ (semaines[s.week]=semaines[s.week]||[]).push(s); });
        var ws=Object.keys(semaines).map(Number).sort(function(a,b){return a-b;});
        var derniere=null, pic=0;
        ws.forEach(function(w,i){
          var l=semaines[w], km=planWeekKm(l);
          var affut=l.some(function(s){return s.phaseKey==='TAPER'||s.baseType==='COURSE';});
          var dech=l.some(function(s){return s.deload;});
          var partielle=(i===0 && l.length<sc[1].length);
          if(km>sc[3]+1) bilan.max.push(nom+' S'+w+' '+Math.round(km)+' km');
          if(affut||dech){ if(dech && pic && km>pic*0.8+0.5) bilan.decharge.push(nom+' S'+w+' '+Math.round(km/pic*100)+' %'); pic=0; return; }
          if(!partielle){ if(derniere && km>derniere*1.1+0.5) bilan.saut.push(nom+' S'+w+' +'+Math.round((km/derniere-1)*100)+' %'); derniere=km; pic=Math.max(pic,km); }
        });
        var parDate={}; PLAN.sessions.forEach(function(s){ if(s.km>0) parDate[s.date]=s; });
        PLAN.sessions.forEach(function(s){
          var n=parDate[addDaysKey(s.date,1)]; if(!n) return;
          if((planIsHard(s)&&planIsHard(n))||(planIsLong(s)&&(planIsHard(n)||planIsLong(n)))) bilan.enchaine.push(nom+' '+s.date+' '+s.baseType+'→'+n.baseType);
        });
        weeklyAdaptiveRegen(true); weeklyAdaptiveRegen(true);
        var apres={}; PLAN.sessions.forEach(function(s){ apres[s.week]=(apres[s.week]||0)+(s.baseType==='COURSE'?0:(s.km||0)); });
        Object.keys(apres).forEach(function(w){ if(apres[w]>sc[3]+1) bilan.regen.push(nom+' S'+w+' '+Math.round(apres[w])+' km'); });
      });
      chk(c,'aucune semaine de charge au-delà de +10 %', !bilan.saut.length, bilan.saut.slice(0,4).join(' | ')||'3 plans types vérifiés');
      chk(c,'une décharge pèse au plus 80 % du pic', !bilan.decharge.length, bilan.decharge.slice(0,4).join(' | '));
      chk(c,'jamais deux séances dures d\'affilée ni dure le lendemain d\'une sortie longue', !bilan.enchaine.length, bilan.enchaine.slice(0,3).join(' | '));
      chk(c,'aucune semaine au-dessus du km/sem maxi', !bilan.max.length, bilan.max.slice(0,4).join(' | '));
      chk(c,'la régénération hebdomadaire ne dépasse pas le km/sem maxi', !bilan.regen.length, bilan.regen.slice(0,4).join(' | ')||'2 régénérations par plan');
    }catch(e){ ko(c,'exécution',e&&e.message); }
    finally{
      window.toast=vraiToast; window.burst=vraiBurst; window.renderSport=vraiRender;
      P.compDate=saved.compDate; P.days=saved.days; P.objRace=saved.objRace; P.kmWeekMin=saved.kmWeekMin; P.kmWeekMax=saved.kmWeekMax;
      restaure();
    }
  }

  /* ======================= 11. HORS LIGNE ================================ */
  // Bugs réels du 27/09 : (1) une modification SUR PLACE (P.bio=…, SESS.push(…)) ne
  // partait jamais au serveur — DB.save comparait l'objet… à lui-même ; (2) une
  // modification sans réseau n'était jamais renvoyée ; (3) app.js n'était pas en
  // cache, l'app ne s'ouvrait pas sans connexion.
  function testHorsLigne(){
    var c='11. Hors ligne';
    var hAvant=localStorage.getItem(SYNC_HASH_KEY), fAvant=localStorage.getItem(DIRTY_KEY);
    var memo=JSON.stringify(_hashes());
    var uid=window.currentUserId, off=window._offlineBoot, pull=window._cloudPulling;
    try{
      essaie(c,'une modification sur place est détectée comme à envoyer',function(){
        var o={a:1}; markSynced('__smoke',o);
        if(differsFromSynced('__smoke',o)) return false;     // identique : rien à envoyer
        o.a=2;                                               // même objet, modifié sur place
        if(!differsFromSynced('__smoke',o)) return false;
        markSynced('__smoke',o);
        return !differsFromSynced('__smoke',{a:2}) && 'modifiée → à envoyer, identique → rien';
      });
      essaie(c,'sans réseau, la modification est mise en file (et y reste)',function(){
        window.currentUserId='smoke-test'; window._offlineBoot=true; window._cloudPulling=false;
        cloudPush('__smoke',{a:3});
        return _dirtyGet().indexOf('__smoke')>=0 && 'en file jusqu\'au retour du réseau';
      });
      essaie(c,'sans compte connecté, rien n\'est mis en file',function(){
        clearDirty('__smoke'); window.currentUserId=null;
        cloudPush('__smoke',{a:4});
        return _dirtyGet().indexOf('__smoke')<0 && 'une valeur par défaut n\'écrase pas le serveur';
      });
    } finally {
      window.currentUserId=uid; window._offlineBoot=off; window._cloudPulling=pull;
      _syncHash=JSON.parse(memo);
      try{
        if(hAvant===null) localStorage.removeItem(SYNC_HASH_KEY); else localStorage.setItem(SYNC_HASH_KEY,hAvant);
        if(fAvant===null) localStorage.removeItem(DIRTY_KEY); else localStorage.setItem(DIRTY_KEY,fAvant);
      }catch(e){}
    }
    // Ce que l'utilisateur peut vérifier sur iPhone : l'app est-elle prête sans réseau ?
    if(!('serviceWorker' in navigator) || !window.caches){ ok(c,'l\'app est enregistrée sur le téléphone','service worker indisponible ici (navigation privée ?)'); return Promise.resolve(); }
    var sc=document.querySelector('script[src*="app.js"]');
    var appSrc=sc ? new URL(sc.getAttribute('src'), location.href).href : null;
    var fin=Date.now()+15000;
    return new Promise(function(resolve){
      (function verifie(){
        Promise.all([caches.match(appSrc||'app.js'), caches.match(new URL('./',location.href).href), caches.match(new URL('badges/rank_elite.png',location.href).href)])
          .then(function(r){
            if((r[0]&&r[1]&&r[2]) || Date.now()>fin){
              chk(c,'l\'app s\'ouvre sans connexion (page, '+(appSrc?appSrc.split('/').pop():'app.js')+' et images en cache)', !!(r[0]&&r[1]&&r[2]),
                  'page '+(r[1]?'oui':'NON')+' · script '+(r[0]?'oui':'NON')+' · images '+(r[2]?'oui':'NON'));
              return resolve();
            }
            setTimeout(verifie,500);
          }).catch(function(e){ ko(c,'l\'app s\'ouvre sans connexion',e&&e.message); resolve(); });
      })();
    });
  }

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

  /* ======================= 7b. MODE SIMPLIFIÉ ============================ */
  // Bugs réels (V3.3.1) : sous zoom:1.16, 100vh débordait de l'écran (la page entière
  // défilait sous la barre du bas) et la pastille partait hors de la barre sur la page
  // Outils, qui n'a pas d'onglet en mode simplifié. On pose la classe seule, sans
  // applyTheme() qui recopierait le réglage dans le stockage.
  function testModeSimple(){
    var c='7b. Mode simplifié', h=document.documentElement, avant=h.classList.contains('easy-mode');
    var entreeAvant=(typeof _outilsEntry!=='undefined')?_outilsEntry:null;
    // html.easy-mode * raccourcit TOUTES les transitions à 0,15 s : mesurée aussitôt après
    // la pose de la classe, la hauteur était encore en train de glisser depuis l'ancienne.
    var fige=document.createElement('style'); fige.textContent='html.easy-mode *{transition:none !important;}';
    try{
      document.head.appendChild(fige);
      h.classList.add('easy-mode');
      essaie(c,'la page ne déborde pas de l\'écran',function(){
        var d=h.scrollHeight-innerHeight; if(d>1) throw new Error('dépasse de '+d+' px'); return 'au pixel près';
      });
      // V3.12.0 : plus de zoom CSS (Safari l'appliquait mal : pages qui glissaient, barre du
      // bas qui choisissait le mauvais onglet), et la palette vert mat est bien posée.
      essaie(c,'aucun zoom CSS, palette vert mat',function(){
        var z=parseFloat(getComputedStyle(h).zoom)||1; if(Math.abs(z-1)>0.001) throw new Error('zoom '+z);
        var bg=getComputedStyle(h).getPropertyValue('--bg').trim().toUpperCase(), ez=h.getAttribute('data-ez');
        if((!ez||ez==='green') && bg!=='#0F1612' && bg!=='#E9EFE9') throw new Error('fond '+bg);
        return 'zoom 1 · fond '+bg;
      });
      // V3.12.1 : huit teintes au choix. Chacune, en sombre comme en clair : texte blanc lisible
      // sur les boutons, boutons et icônes visibles sur le fond, accent écrit (--et) lisible.
      essaie(c,'les huit couleurs du mode simple restent lisibles',function(){
        if(typeof EZ_COLORS==='undefined') throw new Error('EZ_COLORS absent');
        var ezAvant=h.getAttribute('data-ez'), modeAvant=h.getAttribute('data-mode'), faibles=[];
        var rgb=function(v){ var m=String(v).trim().match(/^#([0-9a-f]{6})$/i); if(!m) return null; var n=parseInt(m[1],16); return [n>>16&255,n>>8&255,n&255]; };
        var L=function(c){ return c.reduce(function(s,x,i){ x/=255; x=x<=0.04045?x/12.92:Math.pow((x+0.055)/1.055,2.4); return s+x*[.2126,.7152,.0722][i]; },0); };
        var cr=function(a,b){ var x=L(a),y=L(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
        try{
          ['dark','light'].forEach(function(m){ h.setAttribute('data-mode',m);
            EZ_COLORS.forEach(function(k){ h.setAttribute('data-ez',k); var s=getComputedStyle(h);
              var bg=rgb(s.getPropertyValue('--bg')), e=rgb(s.getPropertyValue('--e')), et=rgb(s.getPropertyValue('--et'));
              if(!bg||!e||!et){ faibles.push(k+'/'+m+' variables'); return; }
              if(cr([255,255,255],e)<4.5) faibles.push(k+'/'+m+' bouton '+cr([255,255,255],e).toFixed(1));
              if(cr(e,bg)<3) faibles.push(k+'/'+m+' accent '+cr(e,bg).toFixed(1));
              if(cr(et,bg)<4.5) faibles.push(k+'/'+m+' texte '+cr(et,bg).toFixed(1));
            });
          });
        } finally {
          if(ezAvant==null) h.removeAttribute('data-ez'); else h.setAttribute('data-ez',ezAvant);
          if(modeAvant==null) h.removeAttribute('data-mode'); else h.setAttribute('data-mode',modeAvant);
        }
        if(faibles.length) throw new Error(faibles.join(', '));
        return EZ_COLORS.length+' teintes × 2 modes';
      });
      essaie(c,'la pastille reste dans la barre quand l\'onglet Outils est masqué',function(){
        var outils=document.querySelector('.nb[data-s="outils"]'), pf=document.querySelector('.nb[data-s="profil"]'), pill=document.getElementById('nav-pill');
        if(!outils||!pf||!pill) return 'barre absente';
        if(outils.offsetWidth) return false; // l'onglet devrait être masqué
        _outilsEntry='profil';
        if(navPillTarget(outils)!==pf) throw new Error('cible '+(navPillTarget(outils)||{}).dataset);
        positionNavPill(outils); // (la pastille peut s'étirer 160 ms avant de se poser : on vérifie la cible et les bornes)
        var l=parseFloat(pill.style.left), w=parseFloat(pill.style.width), bar=document.getElementById('nav').clientWidth;
        if(!(l>=0 && l+w<=bar+1)) throw new Error('hors de la barre : '+Math.round(l)+' + '+Math.round(w)+' px');
        return pf.classList.contains('on-alt') && 'sous Profil, onglet Profil allumé';
      });
      essaie(c,'le facteur des rects suit le moteur (1 ou le zoom)',function(){
        var z=uiZoomFactor(), k=uiRectFactor(); return (k===1||k===z) && ('zoom '+z+', rects '+k);
      });
    } finally {
      if(!avant) h.classList.remove('easy-mode');
      fige.remove();
      if(entreeAvant!==null) _outilsEntry=entreeAvant;
      document.querySelectorAll('.nb.on-alt').forEach(function(b){ b.classList.remove('on-alt'); });
      positionNavPill(document.querySelector('.nb.on'));
    }
  }

  /* ======================= 7c. ÎLOT ET JOURS SPÉCIAUX (V3.4.0, V3.5.0) === */
  function testIlotEtFete(){
    var c='7c. Îlot et jours spéciaux';
    // L'îlot lit l'état réel des activités : un chrono en pause doit y figurer, rien sinon.
    essaie(c,'un chrono en pause apparaît dans l\'îlot',function(){
      if(typeof ikActivities!=='function') throw new Error('îlot absent');
      var avant=chrono;
      try{
        chrono={running:false,start:0,elapsed:0,laps:[],raf:null};
        if(ikActivities().some(function(a){ return a.k==='chrono'; })) throw new Error('chrono à zéro affiché');
        chrono={running:false,start:0,elapsed:65000,laps:[],raf:null};
        var a=ikActivities().filter(function(x){ return x.k==='chrono'; })[0];
        if(!a) throw new Error('chrono en pause absent');
        return 'affiché « '+a.time+' »';
      } finally { chrono=avant; }
    });
    // Un 29 février se fête le 28 les années non bissextiles ; une date vide ne fête rien.
    essaie(c,'le jour d\'anniversaire est bien reconnu (29 février compris)',function(){
      if(typeof isBirthdayToday!=='function') throw new Error('fonction absente');
      var avant=P.bday, d=new Date(), y=d.getFullYear();
      try{
        P.bday='1990-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
        if(!isBirthdayToday()) throw new Error('aujourd\'hui non reconnu');
        P.bday=''; if(isBirthdayToday()) throw new Error('date vide fêtée');
        var bis=(y%4===0&&y%100!==0)||y%400===0;
        if(!bis && d.getMonth()===1 && d.getDate()===28){ P.bday='2000-02-29'; if(!isBirthdayToday()) throw new Error('29 février non fêté le 28'); }
        return 'ok';
      } finally { P.bday=avant; }
    });
    // Le calendrier hégirien du téléphone donne un mois et un jour plausibles (ou rien).
    essaie(c,'la date hégirienne est lue correctement',function(){
      if(typeof hijriToday!=='function') throw new Error('fonction absente');
      var h=hijriToday();
      if(h===null) return 'calendrier islamique indisponible sur cet appareil';
      if(!(h.m>=1&&h.m<=12&&h.d>=1&&h.d<=30)) throw new Error('date incohérente '+JSON.stringify(h));
      return h.d+'/'+h.m;
    });
    // Table Umm al-Qura embarquée : indépendante du navigateur (Safari/iOS n'a pas
    // toujours les calendriers islamiques d'Intl, et aucune fête musulmane n'y apparaissait).
    essaie(c,'la table hégirienne donne les bonnes dates sans Intl',function(){
      if(typeof hijriOf!=='function') throw new Error('fonction absente');
      var cas=[['2027-02-08',1448,9,1],['2027-03-09',1448,10,1],['2027-05-16',1448,12,10],['2027-06-06',1449,1,1],['2027-08-14',1449,3,12],['2023-07-19',1445,1,1],['2026-10-03',1448,4,22]];
      var D=Intl.DateTimeFormat;
      try{
        Intl.DateTimeFormat=function(){ throw new Error('Intl coupé'); };
        cas.forEach(function(x){ var p=x[0].split('-'), h=hijriOf(new Date(+p[0],+p[1]-1,+p[2],12));
          if(!h || h.y!==x[1] || h.m!==x[2] || h.d!==x[3]) throw new Error(x[0]+' → '+JSON.stringify(h)); });
      } finally { Intl.DateTimeFormat=D; }
      return cas.length+' dates';
    });
    essaie(c,'le décalage d\'un jour (annonce du pays) est appliqué',function(){
      var av=P.hijriAdj, d=new Date(); d.setHours(12,0,0,0);
      try{
        var ref=hijriOf(d); d.setDate(d.getDate()-1); var veille=hijriOf(d);
        P.hijriAdj=-1; var h=hijriToday();
        if(JSON.stringify(h)!==JSON.stringify(veille)) throw new Error('−1 jour ignoré');
        P.hijriAdj=0; if(JSON.stringify(hijriToday())!==JSON.stringify(ref)) throw new Error('retour à 0 ignoré');
        P.hijriAdj=7; if(hijriAdj()!==0) throw new Error('valeur hors bornes acceptée');
        return 'ok';
      } finally { P.hijriAdj=av; _hijriMemo=null; }
    });
    // L'anniversaire passe avant les autres fêtes ; « Mes couleurs » la coupe pour la journée.
    essaie(c,'la fête du jour est reconnue et se coupe pour la journée',function(){
      var avB=P.bday, avO=P.feteOff, avF=P.fetes, avP=_fetePreview, d=new Date();
      try{
        _fetePreview=null; P.fetes=true; P.feteOff=null;
        P.bday='1990-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
        if(feteToday()!=='bday') throw new Error('anniversaire non prioritaire : '+feteToday());
        if(!feteOn()) throw new Error('fête éteinte');
        P.feteOff=todayKey(); if(feteOn()) throw new Error('« Mes couleurs » sans effet');
        P.feteOff=null; P.fetes=false; if(feteOn()) throw new Error('réglage désactivé ignoré');
        return 'ok';
      } finally { P.bday=avB; P.feteOff=avO; P.fetes=avF; _fetePreview=avP; }
    });
    // Chaque fête a sa carte (titre, texte, bouton) et chaque scène se joue sans erreur.
    essaie(c,'chaque fête a sa carte et ses scènes',function(){
      var avP=_fetePreview, avR=PREFS.recDay, n=0;
      try{
        PREFS.recDay={d:todayKey(),txt:'Squat · 100 kg'};
        FETE_KEYS.forEach(function(k){
          _fetePreview=k; var h=feteCardHTML();
          if(h.indexOf('fete-card fc-'+k)<0 || /undefined|\{0\}/.test(h)) throw new Error('carte '+k+' incomplète');
          if(!FETE_FX[k]) throw new Error('décor '+k+' absent');
        });
        var L=feteLayer();
        Object.keys(FX_ACTS).forEach(function(a){ if(a.charAt(0)==='_') return; FX_ACTS[a](L); n++; });
        L.querySelectorAll('.fx').forEach(function(e){ e.remove(); });
        return FETE_KEYS.length+' fêtes, '+n+' scènes';
      } finally { _fetePreview=avP; PREFS.recDay=avR; applyTheme(); }
    });
    // Les jours spéciaux se découvrent le jour même : ni l'aperçu, ni le paramètre
    // d'URL ne doivent fonctionner pour un compte normal — seulement pour le compte
    // de développement (nasrihamou5@gmail.com).
    essaie(c,'l\'aperçu des jours spéciaux est réservé au compte de développement',function(){
      var avE=window.currentUserEmail, avP=_fetePreview;
      try{
        window.currentUserEmail='quelquun.d.autre@example.com';
        if(feteDevMode()) throw new Error('compte normal reconnu comme développeur');
        _fetePreview=null; feteTry('xmas');
        if(_fetePreview!==null) throw new Error('feteTry a fonctionné pour un compte normal');
        if(typeof pfAppearanceHTML==='function' && pfAppearanceHTML().indexOf('fete-try')>=0) throw new Error('la pastille d\'aperçu reste visible');
        window.currentUserEmail='nasrihamou5@gmail.com';
        if(!feteDevMode()) throw new Error('le compte de développement n\'est pas reconnu');
        feteTry('xmas');
        if(_fetePreview!=='xmas') throw new Error('feteTry ne fonctionne plus pour le compte de développement');
        return 'ok';
      } finally { window.currentUserEmail=avE; _fetePreview=avP; applyTheme(); }
    });
  }

  /* ======================= 7d. MATIÈRES (V3.5.0) ========================= */
  function testMatieres(){
    var c='7d. Matières';
    // La tuile de carbone doit être un vrai tressage : sans raccord (période de 4 mèches)
    // et contrastée (mèches allumées et éteintes), pas un aplat.
    essaie(c,'le tressage de carbone est contrasté et sans raccord',function(){
      var cv=carbonTwill(0,false,2,7), x=cv.getContext('2d'), d=x.getImageData(0,0,cv.width,cv.height).data, mn=255, mx=0;
      for(var i=0;i<d.length;i+=4){ if(d[i+1]<mn) mn=d[i+1]; if(d[i+1]>mx) mx=d[i+1]; }
      if(cv.width!==56) throw new Error('taille '+cv.width);
      if(mx-mn<50) throw new Error('trop plat ('+mn+'–'+mx+')');
      return 'niveaux '+mn+'–'+mx;
    });
    essaie(c,'le carbone et le carbone forgé posent leur plaque, les autres couleurs non',function(){
      var av=P.theme, avE=P.easyMode;
      try{
        P.easyMode=false; P.theme='carbon'; applyTheme();
        if(document.documentElement.dataset.carbon!=='twill' || !document.getElementById('ikCarbon')) throw new Error('plaque absente (carbone)');
        P.theme='forged'; applyTheme();
        if(document.documentElement.dataset.carbon!=='forged' || document.documentElement.dataset.accent!=='carbon') throw new Error('carbone forgé mal appliqué');
        P.theme='blue'; applyTheme();
        if(document.getElementById('ikCarbon') || document.documentElement.dataset.carbon) throw new Error('plaque restée en bleu');
        return 'ok';
      } finally { P.theme=av; P.easyMode=avE; applyTheme(); }
    });
    // V3.9.0 : Guimauve, Papier et Épure sont retirées : un réglage enregistré sur une
    // ancienne échelle revient au Liquid Glass, ou garde l'Ultime (et l'entre-deux) s'il y était.
    // V3.10.0 : 3e cran, le Covering.
    essaie(c,'matières, anciens réglages recalés',function(){
      var av={mat:P.mat,matV:P.matV,glass:P.glass,easy:P.easyMode};
      try{
        if(MAT_ANCHORS.join()!=='std,max,wrap') throw new Error('matières '+MAT_ANCHORS.join());
        P.matV=2; P.mat=0; P.glass='clay'; if(matNearest(matValue())!=='std' || P.glass!=='std') throw new Error('Guimauve mal recalée : '+P.mat+' '+P.glass);
        P.matV=2; P.mat=1; P.glass='paper'; if(matNearest(matValue())!=='std' || P.glass!=='std') throw new Error('Papier mal recalé : '+P.mat+' '+P.glass);
        P.matV=2; P.mat=2; P.glass='flat'; if(matNearest(matValue())!=='std' || P.glass!=='std') throw new Error('Épure mal recalée : '+P.mat+' '+P.glass);
        P.matV=2; P.mat=4; P.glass='max'; if(matNearest(matValue())!=='max' || P.glass!=='max') throw new Error('Maximal (V3.8.0) mal recalé : '+P.mat);
        P.matV=2; P.mat=3.5; P.glass='max'; if(Math.abs(matValue()-.5)>.001) throw new Error('entre-deux mal recalé : '+P.mat);
        P.matV=undefined; P.mat=1; P.glass='flat'; if(matNearest(matValue())!=='std' || P.glass!=='std') throw new Error('ancien « Sobre » mal recalé : '+P.mat);
        P.matV=undefined; P.mat=3; P.glass='max'; if(matNearest(matValue())!=='max') throw new Error('ancien « Maximal » mal recalé : '+P.mat);
        P.easyMode=false;
        MAT_ANCHORS.forEach(function(k,i){ P.mat=i; P.glass=k; applyTheme();
          if(document.documentElement.getAttribute('data-glass')!==k) throw new Error(k+' non appliquée'); });
        P.glass='clay'; applyTheme();
        if(document.documentElement.getAttribute('data-glass')!=='std') throw new Error('matière retirée encore appliquée');
        if(/P\.glass\s*=\s*'clay'/.test(String(setAccent))) throw new Error('la couleur Guimauve impose encore sa matière');
        ['glassClay','glassPaper','glassFlat','clayOn'].forEach(function(k){ if(k in I18N.fr || k in I18N.en || k in I18N.ar) throw new Error('texte restant : '+k); });
        var css=document.getElementById('ikCss'), restes=0;
        if(css && css.sheet) [].forEach.call(css.sheet.cssRules,function(r){ if(/data-glass="(clay|paper|flat)"/.test(r.cssText||'')) restes++; });
        if(restes) throw new Error(restes+' règles CSS de matières retirées');
        return MAT_ANCHORS.map(function(k){ return t(MAT_LABS[k][0]); }).join(' · ');
      } finally { P.mat=av.mat; P.matV=av.matV; P.glass=av.glass; P.easyMode=av.easy; applyTheme(); }
    });
    // V3.10.0 : Covering — la teinte du film remplace la couleur de l'app, avec une seule
    // couleur d'accent assortie ; la couleur choisie hors Covering revient ensuite.
    essaie(c,'Covering : teintes, couleurs assorties, retour à la couleur choisie',function(){
      var av={mat:P.mat,matV:P.matV,glass:P.glass,easy:P.easyMode,theme:P.theme,wrap:P.wrap}, h=document.documentElement;
      try{
        P.easyMode=false; P.theme='violet'; P.glass='wrap'; P.mat=2; P.wrap='mat'; applyTheme();
        if(h.getAttribute('data-glass')!=='wrap' || h.dataset.wrap!=='mat' || h.dataset.accent!=='wrap') throw new Error('Covering non appliqué : '+h.getAttribute('data-glass')+' '+h.dataset.wrap+' '+h.dataset.accent);
        var e=getComputedStyle(h).getPropertyValue('--e').trim().toUpperCase();
        if(e!=='#FFC400') throw new Error('Noir Mat sans ses étriers jaunes : '+e);
        var html=pfColorHTML();
        if(html.indexOf('setWrap(')<0 || html.indexOf('setAccent(')>=0) throw new Error('le menu Couleurs propose encore les couleurs');
        if(WRAPS.length!==5 || WRAPS.some(function(w){ return !t(w.name) || t(w.name)===w.name || !t(w.det) || t(w.det)===w.det; })) throw new Error('teinte sans nom');
        setWrap('anthracite'); if(h.dataset.wrap!=='anthracite') throw new Error('changement de teinte ignoré');
        P.wrap='militaire'; applyTheme(); if(h.dataset.wrap!=='noir' || P.wrap!=='noir') throw new Error('ancienne teinte verte non recalée');
        P.wrap='nuit'; applyTheme(); if(h.dataset.wrap!=='nuit') throw new Error('le Bleu nuit est revenu mais n\'est pas appliqué');
        P.wrap='glacier'; applyTheme(); if(h.dataset.wrap!=='anthracite') throw new Error('ancienne teinte blanc glacier non recalée');
        P.wrap='bordeaux'; applyTheme(); if(h.dataset.wrap!=='mat') throw new Error('ancienne teinte bordeaux non recalée');
        if(document.getElementById('ikCarbon')) throw new Error('plaque carbone sous le Covering');
        P.wrap='inconnue'; applyTheme(); if(h.dataset.wrap!=='noir') throw new Error('teinte inconnue non recalée');
        var tp=JSON.parse(localStorage.getItem('ik_theme_prefs')||'{}'); if(tp.glass!=='wrap' || tp.wrap!=='noir') throw new Error('démarrage rapide sans le Covering');
        P.easyMode=true; applyTheme();
        if(h.getAttribute('data-glass')==='wrap' || h.dataset.accent!=='violet') throw new Error('mode simplifié : la couleur choisie ne revient pas');
        P.easyMode=false; P.glass='std'; P.mat=0; applyTheme();
        if(h.dataset.wrap || h.dataset.accent!=='violet' || pfColorHTML().indexOf('setAccent(')<0) throw new Error('retour au Liquid Glass sans la couleur choisie');
        // molette : de l'Ultime au Covering, d'un cran à l'autre (pas de mélange verre / film)
        var el={value:'160'}; matInput(el); if(P.glass!=='wrap' || P.mat!==2) throw new Error('molette : Covering non atteint '+P.mat);
        el.value='130'; matInput(el); if(P.glass!=='max' || P.mat!==1) throw new Error('molette : retour à l’Ultime raté '+P.mat);
        return WRAPS.map(function(w){ return t(w.name); }).join(' · ');
      } finally { P.mat=av.mat; P.matV=av.matV; P.glass=av.glass; P.easyMode=av.easy; P.theme=av.theme; P.wrap=av.wrap; applyTheme(); }
    });
    // V3.10.2 : couleur et matière sur une seule fiche (Profil › Couleur et matière)
    essaie(c,'couleur et matière réunies sur une seule fiche',function(){
      var av={glass:P.glass,mat:P.mat,easy:P.easyMode};
      try{
        P.easyMode=false; P.glass='std'; P.mat=0; applyTheme();
        var html=pfAppearanceHTML();
        if(html.indexOf('matInput(')<0 || html.indexOf('setAccent(')<0 || html.indexOf('lumInput(')<0) throw new Error('la fiche ne réunit pas matière, couleur et thème');
        if(pfSectionHTML('color')!=='' ) throw new Error('fiche Couleur séparée encore présente');
        P.glass='wrap'; P.mat=2; applyTheme();
        if(pfAppearanceHTML().indexOf('setWrap(')<0) throw new Error('teintes de film absentes de la fiche');
        var src=String(renderProfile);
        if(src.indexOf("openProfileSection(\\'color\\')")>=0) throw new Error('le Profil garde une ligne Couleur séparée');
        if(src.indexOf("openProfileSection(\\'appearance\\')")<0) throw new Error('ligne Apparence absente du Profil');
        // V3.10.3 : plus de doublons dans le Profil
        ["openProfileSection(\\'data\\')","openProfileSection(\\'terms\\')","openProfileSection(\\'privacy\\')","t('manageProfile')","nav(\\'stats\\')"].forEach(function(k){
          if(src.indexOf(k)>=0) throw new Error('doublon encore dans le Profil : '+k); });
        if(pfSectionHTML('legal').indexOf('seg-ctrl')<0 || pfSectionHTML('account').indexOf('exportData()')<0) throw new Error('fiches fusionnées incomplètes');
        return t('appearance')+' · '+t('accountDataLab')+' · '+t('legalLab');
      } finally { P.glass=av.glass; P.mat=av.mat; P.easyMode=av.easy; applyTheme(); }
    });
  }

  /* ======================= 7e. PETITS ÉCRANS (V3.5.4) ===================== */
  // Android avec police agrandie ou iPhone en « Zoom de l'affichage » : 256 à 320 px
  // utiles. Une grille en 1fr ne rétrécit pas sous son contenu et débordait à droite.
  function testPetitsEcrans(){
    var c='7e. Petits écrans';
    essaie(c,'les grilles à 3 colonnes tiennent dans 200 px',function(){
      var box=document.createElement('div'); box.style.cssText='position:fixed;left:0;top:0;width:200px;visibility:hidden';
      box.innerHTML='<div class="bd-grid">'+[1,2,3].map(function(){ return '<div class="bd-cell"><div class="bd-icon"></div><div class="bd-name">Première course</div></div>'; }).join('')+'</div>'+
        '<div class="krow3">'+[1,2,3].map(function(){ return '<div class="ktile"><div class="ktile-val">32,0 km</div></div>'; }).join('')+'</div>';
      document.body.appendChild(box);
      try{
        var R=box.getBoundingClientRect().right, trop=[];
        box.querySelectorAll('.bd-cell,.ktile').forEach(function(e){ if(e.getBoundingClientRect().right>R+1) trop.push(e.className); });
        if(trop.length) throw new Error('débordent : '+trop.join(', '));
        return 'ok';
      } finally { box.remove(); }
    });
    essaie(c,'la page ne défile jamais de côté',function(){
      var se=document.scrollingElement;
      if(se.scrollWidth>innerWidth+1) throw new Error('largeur '+se.scrollWidth+' > '+innerWidth);
      return innerWidth+' px';
    });
  }

  /* ======================= 7f. BILAN À LA MOLETTE, INTRO (V3.5.5) ========== */
  function testBilanMolette(){
    var c='7f. Bilan et intro';
    // Fractionné : une molette par passage, pré-réglée sur la cible ; durée et allure en découlent.
    essaie(c,'fractionné : les passages donnent durée, distance et allure',function(){
      var avO=window.openOv; window.openOv=function(){};
      try{
        openSessionDebrief({date:todayKey(),title:'Test',km:8,pace:'4:30',type:'VMA',duration:40,series:{reps:4,dist:400,paceSecPerKm:225}});
        if(debriefReps.length!==4 || debriefReps[0].timeS!==90) throw new Error('passages mal pré-réglés '+JSON.stringify(debriefReps[0]));
        debriefRepSel=2; debriefWheel('DB.rep.s',40); // 1:30 → 1:40
        if(debriefReps[2].timeS!==100 || debriefReps[2].respected) throw new Error('passage 3 : '+JSON.stringify(debriefReps[2]));
        if(debriefData.distance!==1.6 || debriefData.duration!==6) throw new Error('total '+debriefData.distance+' km '+debriefData.duration+' min');
        if(debriefData.pace!=='3:51') throw new Error('allure '+debriefData.pace);
        if(document.querySelector('#progBody input.inp[type="number"]')) throw new Error('un champ à taper reste affiché');
        return '4 × 400 m → '+debriefData.pace+' /km';
      } finally { window.openOv=avO; debriefCtx=null; try{ closeOv('ovProg'); }catch(e){} }
    });
    essaie(c,'sortie : km + durée à la molette, respect de l\'allure déduit',function(){
      var avO=window.openOv; window.openOv=function(){};
      try{
        openSessionDebrief({date:todayKey(),title:'Test',km:10,pace:'5:30',type:'Long',duration:55});
        debriefWheel('DB.km.i',12); debriefWheel('DB.km.d',5); debriefWheel('DB.dur.h',1); debriefWheel('DB.dur.m',2);
        if(debriefData.distance!==12.5 || debriefData.duration!==62) throw new Error(debriefData.distance+' km '+debriefData.duration+' min');
        if(debriefData.pace!=='4:58') throw new Error('allure '+debriefData.pace);
        if(debriefAdherence()!=='faster') throw new Error('respect de l\'allure : '+debriefAdherence());
        return '12,5 km en 1 h 02';
      } finally { window.openOv=avO; debriefCtx=null; try{ closeOv('ovProg'); }catch(e){} }
    });
    // La molette retient la valeur affichée au centre (réglé sur 05, le minuteur partait de 6:00).
    essaie(c,'une molette retient la valeur affichée au centre',function(){
      var box=document.createElement('div'); box.style.cssText='position:fixed;left:0;top:0;visibility:hidden';
      box.innerHTML='<div class="wheels">'+wheel('ZZ',0,59,5)+'</div>'; document.body.appendChild(box);
      try{
        var w=box.querySelector('.wheel'), sel=w.querySelector('.wi.sel'), ih=sel.offsetHeight||40;
        w.scrollTop=sel.offsetTop-(w.clientHeight-ih)/2;
        var pad=w.firstElementChild.offsetHeight, idx=Math.round((w.scrollTop+w.clientHeight/2-pad-ih/2)/ih);
        if(idx!==5) throw new Error('lu '+idx+' pour 05 affiché');
        return 'ok';
      } finally { box.remove(); }
    });
    // L'intro ne s'arrête plus à heure fixe : elle attend le signal de l'app.
    essaie(c,'l\'intro attend que l\'app soit prête',function(){
      if(!window.__ikReady) throw new Error('signal « app prête » jamais envoyé');
      if(!document.getElementById('ikiCss')) throw new Error('style de l\'intro absent d\'index.html');
      var l=document.getElementById('ikCss'); if(!l || l.media!=='all') throw new Error('app.css pas appliquée : '+(l&&l.media));
      return 'ok';
    });
  }

  /* ======================= 7g. SÉLECTEURS ET PLAN (V3.6.0) ================= */
  function testSelecteursEtPlan(){
    var c='7g. Sélecteurs et plan';
    // Chaque sélecteur visible reçoit sa pastille, posée sous le choix actif.
    essaie(c,'les sélecteurs ont une pastille sous le choix actif',function(){
      var avant=sportTab, n=0;
      try{
        nav('sport'); segSync();
        var segs=[].slice.call(document.querySelectorAll('#s-sport .seg-ctrl')).filter(function(s){ return s.offsetParent; });
        if(!segs.length) throw new Error('aucun sélecteur dans Sport');
        segs.forEach(function(s){
          var th=s.querySelector('.seg-thumb'), on=segBtns(s).filter(function(b){ return b.classList.contains('on'); })[0];
          if(!th || !on) throw new Error('pastille absente : '+s.textContent.slice(0,30));
          if(th._x!==on.offsetLeft || th._w!==on.offsetWidth) throw new Error('pastille mal placée');
          n++;
        });
        return n+' sélecteurs';
      } finally { sportTab=avant; }
    });
    // Configurer mon plan : plus rien à taper, km/semaine calculés, « Autre » = distance exacte.
    essaie(c,'configurer mon plan : molettes, volume automatique, distance exacte',function(){
      var avO=window.openOv, avP=JSON.stringify({objRace:P.objRace,objRaceKm:P.objRaceKm,vdot:P.vdot}), avS=setupTmp;
      window.openOv=function(){};
      try{
        if(!getUserVDOT()) P.vdot=45; // profil neuf : un niveau plausible, restauré ensuite
        if(!getUserVDOT()) return 'pas de VDOT : non testé';
        openPlanSetup();
        if(document.querySelector('#progBody input[type="number"],#progBody input[type="date"]')) throw new Error('un champ à taper reste affiché');
        setupTmp.objRace='Autre'; setupTmp.raceKm=15; psWheel('PS.kmd',5);
        if(setupTmp.raceKm!==15.5) throw new Error('distance '+setupTmp.raceKm);
        if(raceMetersOf('Autre',15.5)!==15500) throw new Error('mètres « Autre »');
        setupTmp.compDate='2027-01-31'; psWheel('PS.mo',2);
        if(setupTmp.compDate!=='2027-02-28') throw new Error('31 → février : '+setupTmp.compDate);
        var v1=planAutoVolume({situation:'reprise',gap:'gt6',objRace:'10 km'}), v2=planAutoVolume({situation:'reprise',gap:'lt1',objRace:'10 km'});
        if(!(v1.min<v2.min)) throw new Error('reprise après 6 mois pas plus douce : '+v1.min+' / '+v2.min);
        if(!(v1.min>=8 && v1.max>v1.min)) throw new Error('bornes '+JSON.stringify(v1));
        if(trProfile('Plate')!=='Plat' && curLang()==='fr') throw new Error('« Plate » au lieu de « Plat »');
        return 'reprise '+v1.min+'→'+v1.max+' km/sem';
      } finally { window.openOv=avO; Object.assign(P,JSON.parse(avP)); setupTmp=avS; try{ closeOv('ovProg'); }catch(e){} }
    });
  }

  /* ======================= 7h. MODIFIER UNE SÉANCE (V3.7.0) ============== */
  function testModifierSeance(){
    var c='7h. Modifier une séance';
    essaie(c,'réglages concrets : répétitions, distance, récup, déplacement, réinitialisation',function(){
      var planAvant=PLAN, demain=new Date(); demain.setDate(demain.getDate()+1);
      // profil de test sans plan : une semaine synthétique, restaurée à la fin
      if(!PLAN || !PLAN.sessions || !PLAN.sessions.some(function(x){ return cmKind(x)==='reps' && !x.done && x.date>=todayKey(); }))
        PLAN={vdot:45,sessions:[{id:9001,week:1,date:dateKey(demain),type:'Seuil',baseType:'SEUIL',title:'Seuil',km:10,duration:52,pace:'4:30',rpe:7,
          series:{reps:5,dist:1000,paceSecPerKm:270,recoverySec:60,recoveryLabel:t('recovLabel_1minTrot')},done:false}]};
      var s=PLAN.sessions.filter(function(x){ return cmKind(x)==='reps' && !x.done && x.date>=todayKey(); })[0];
      var avant=JSON.stringify(PLAN.sessions), avSave=window.saveAll, avSport=window.renderSport, avSheet=document.getElementById('sheetBody').innerHTML;
      window.saveAll=function(){}; window.renderSport=function(){};
      try{
        planCustomId=s.id; renderPlanCustomizeHTML();
        if(/[+-]\s?\d+\s?%/.test(document.getElementById('sheetBody').textContent)) throw new Error('des pourcentages restent affichés');
        var km0=s.km, n0=s.series.reps;
        cmSet('reps',n0+1); if(s.series.reps!==n0+1 || !(s.km>km0)) throw new Error('répétition en plus sans effet');
        cmSet('dist',400); if(s.series.dist!==400 || (liveDetail(s).body||'').indexOf('400')<0) throw new Error('distance de répétition');
        cmSet('rec',(s.series.recoverySec||60)+15); if(liveDetail(s).recovery!==s.series.recoveryLabel) throw new Error('récupération non reportée');
        resetPlanSessionCustom(s.id);
        if(s.series.reps!==n0 || s.km!==km0 || s.customized) throw new Error('réinitialisation incomplète');
        var dups=0, seen={}; PLAN.sessions.forEach(function(x){ if(seen[x.date]) dups++; seen[x.date]=1; });
        if(dups) throw new Error(dups+' jours en double');
        return n0+' → '+(n0+1)+' rép., puis réinitialisée';
      } finally { PLAN.sessions=JSON.parse(avant); PLAN=planAvant; window.saveAll=avSave; window.renderSport=avSport; document.getElementById('sheetBody').innerHTML=avSheet; planCustomId=null; }
    });
    essaie(c,'l\'analyse du coach affiche un verdict et les chiffres',function(){
      var html=document.getElementById('progBody').innerHTML, tit=document.getElementById('ovProgTitle').textContent;
      try{
        renderCoachAnalysis(coachAnalyze({done:true,title:'Test',type:'EF',distance:10,duration:55,pace:'5:30',rpe:4,pain:'Aucune',fatigue:3,feel:4,sleep:3,nutrition:3,weather:'sunny',plannedRpe:4}));
        var b=document.getElementById('progBody');
        if(!b.querySelector('.ca-hero') || !b.querySelector('.db-tile')) throw new Error('verdict ou chiffres absents');
        return 'ok';
      } finally { document.getElementById('progBody').innerHTML=html; document.getElementById('ovProgTitle').textContent=tit; }
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
      chk(c,'les sons Signature ont leur sortie', !!_studioOut, '');
      // V3.12.0 : « Sobre » est l'ambiance par défaut, Signature reste au choix
      chk(c,'ambiance Sobre par défaut, Signature au choix', (P.sndPack==='signature'||sndPack()==='soft') && typeof SOFT.medal==='function' && typeof setSndPack==='function', sndPack());

      var an=ctx.createAnalyser(); an.fftSize=2048; _master.connect(an); if(_studioOut) _studioOut.connect(an);
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
      // Le test mesure le moteur audio, pas le réglage de l'utilisateur : avec
      // « Sons » désactivé dans le Profil, sfx() se tait et le test échouait à tort
      // (faux positif constaté le 24/09). On force le son le temps de la mesure.
      var sonsAvant=P && P.sounds;
      if(P) P.sounds=true;
      // Ambiance Signature (V3.11.0) : on attend son calcul (hors ligne, quelques secondes)
      // pour mesurer les vrais sons, pas la voix marimba de secours.
      var calcul=SIG.supported() ? Promise.race([SIG.render(), new Promise(function(r){ setTimeout(r,30000); })]) : Promise.resolve();
      calcul.then(function(){
        var prets=SIG.names();
        chk(c,'l\'ambiance Signature est calculée (10 sons)', !SIG.supported() || prets.length===10, prets.join(', ')||'non pris en charge ici');
      }).then(function(){ return new Promise(function(r){ setTimeout(r,450); }); }).then(function(){
        var noms=['start','goal','medal'], fen={start:1500,goal:900,medal:2600};
        var i=0, niveaux={};
        (function suivant(){
          if(i>=noms.length){
            if(P) P.sounds=sonsAvant;
            _master.disconnect(an); if(_studioOut) _studioOut.disconnect(an);
            var tous=noms.every(function(n){ return niveaux[n]>0.005; });
            chk(c,'chaque effet produit réellement du signal', tous, JSON.stringify(niveaux));
            return resolve();
          }
          var n=noms[i++];
          mesure(n,fen[n]).then(function(v){ niveaux[n]=+v.toFixed(4); setTimeout(suivant,120); });
        })();
      });
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
    window.__smokeState='en cours';
    bloquerEcritures();
    testDemarrage();
    testI18n();
    testXss();
    testMinuteurs();
    testIntegrite();
    testAudit2409();
    testGardeFou();
    testModeSimple();
    testIlotEtFete();
    testMatieres();
    testPetitsEcrans();
    testBilanMolette();
    testSelecteursEtPlan();
    testModifierSeance();
    Promise.resolve(testI18nUsage())
      .then(function(){ return testHorsLigne(); })
      .then(function(){ return testSon(); })
      .catch(function(e){ ko('0. Suite','exécution', e && e.message); })
      .then(function(){ debloquerEcritures(); window.__smokeState='terminé'; rapport(); });
  }

  // On laisse à l'app le temps de finir son démarrage (P peuplé), sinon la
  // moitié des tests mesurerait un état incomplet. Mais on lance la suite DANS
  // TOUS LES CAS au bout du délai : une première version restait muette quand P
  // n'arrivait jamais — c'est-à-dire exactement dans la situation où le rapport
  // est le plus utile. C'est ce silence qui a masqué, en production, un
  // DB_READY qui ne se résolvait jamais.
  window.__smokeState='attente du démarrage';
  var essais=0;
  (function attend(){
    if(typeof P!=='undefined' && P){ window.__smokeState='démarrage ok'; return setTimeout(lancer,300); }
    if(++essais>40){
      window.__smokeState='démarrage incomplet — suite lancée quand même';
      ko('0. Suite','l\'app a fini de démarrer','P toujours vide après 12 s — cache local (DB_READY) non résolu');
      return lancer();
    }
    setTimeout(attend,300);
  })();
})();
