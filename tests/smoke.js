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
      CHECKINS:(typeof CHECKINS!=='undefined')?CHECKINS:null, ADAPT_LOG:(typeof ADAPT_LOG!=='undefined')?ADAPT_LOG:null,
      Pjson:JSON.stringify(P),
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
    if(SNAP.CHECKINS) CHECKINS=SNAP.CHECKINS; if(SNAP.ADAPT_LOG) ADAPT_LOG=SNAP.ADAPT_LOG;
    if(SNAP.Pjson){ var p0=JSON.parse(SNAP.Pjson); Object.keys(P).forEach(function(k){ if(!(k in p0)) delete P[k]; }); Object.assign(P,p0); }
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
    // V3.15.0 : le cœur est assemblé de plusieurs sources (tools/bundle.json)
    return fetch('tools/bundle.json?selftest='+Date.now()).then(function(r){return r.json();}).then(function(b){
      return Promise.all(b['app.min.js'].map(function(f){ return fetch(f+'?selftest='+Date.now()).then(function(r){return r.text();}); }));
    }).then(function(parts){ return parts.join('\n'); }).then(function(src){
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
        // V3.15.0 : un allègement du moteur d'adaptation (3 jours à −15 %) repasse par planSettle
        P.adapt={}; ADAPT_LOG=[];
        adaptApply('smoke',false,function(pl,pc,k){ var n=0; adWindow(pl,k,7,false).forEach(function(s){ if(adLighten(s,0.85,pc,'smoke')) n++; }); return n; },{k:'adMsgAcwrHigh',p:['1,40']});
        var apres={}; PLAN.sessions.forEach(function(s){ apres[s.week]=(apres[s.week]||0)+(s.baseType==='COURSE'?0:(s.km||0)); });
        Object.keys(apres).forEach(function(w){ if(apres[w]>sc[3]+1) bilan.regen.push(nom+' S'+w+' '+Math.round(apres[w])+' km'); });
      });
      chk(c,'aucune semaine de charge au-delà de +10 %', !bilan.saut.length, bilan.saut.slice(0,4).join(' | ')||'3 plans types vérifiés');
      chk(c,'une décharge pèse au plus 80 % du pic', !bilan.decharge.length, bilan.decharge.slice(0,4).join(' | '));
      chk(c,'jamais deux séances dures d\'affilée ni dure le lendemain d\'une sortie longue', !bilan.enchaine.length, bilan.enchaine.slice(0,3).join(' | '));
      chk(c,'aucune semaine au-dessus du km/sem maxi', !bilan.max.length, bilan.max.slice(0,4).join(' | '));
      chk(c,'un ajustement du moteur ne dépasse pas le km/sem maxi', !bilan.regen.length, bilan.regen.slice(0,4).join(' | ')||'3 plans allégés');
      // V3.14.0 : contrôle complet (distance × allure = durée, zones, sortie longue, ordre, progression)
      var tous=[]; SC.forEach(function(sc){
        var d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+sc[4]*7-1);
        P.compDate=dateKey(d); P.days=sc[1]; P.objRace=sc[0]; P.kmWeekMin=sc[2]; P.kmWeekMax=sc[3]; SESSLOG=[]; SESS=[];
        generatePlan(); var v=validatePlan(PLAN); v.errors.forEach(function(e){ tous.push(sc[0]+' : '+e); });
        P.adapt={}; adaptApply('smoke',false,function(pl,pc,k){ var n=0; adWindow(pl,k,7,false).forEach(function(s){ if(adLighten(s,0.8,pc,'smoke')) n++; }); return n; },{k:'adMsgAcwrHigh',p:['1,40']});
        v=validatePlan(PLAN); v.errors.forEach(function(e){ tous.push(sc[0]+' (ajusté) : '+e); });
      });
      chk(c,'validatePlan : chaque séance et chaque semaine sont cohérentes', !tous.length, tous.slice(0,3).join(' | ')||'3 plans + un ajustement chacun');
      chk(c,'la semaine 1 est visible juste après la génération', PLAN.sessions[0] && PLAN.sessions[0].week===1, PLAN.sessions[0]&&('1re séance en semaine '+PLAN.sessions[0].week));
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
    var sc=document.querySelector('script[src*="app.min.js"],script[src*="app.js"]');
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
        if(/P\.glass\s*=\s*["']clay["']/.test(String(setAccent))) throw new Error('la couleur Guimauve impose encore sa matière');
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
        // V3.14.0 : indépendant des guillemets (la version minifiée réécrit \' en ")
        if(/openProfileSection\(\\?["']color\\?["']\)/.test(src)) throw new Error('le Profil garde une ligne Couleur séparée');
        if(!/openProfileSection\(\\?["']appearance\\?["']\)/.test(src)) throw new Error('ligne Apparence absente du Profil');
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
    // V3.12.3 : une séance cochée depuis l'Accueil redessinait Sport en arrière-plan, et
    // renderSport() posait « Sport » dans l'en-tête : bannière Sport au-dessus de l'Accueil.
    essaie(c,'redessiner Sport en arrière-plan ne change pas l\'en-tête',function(){
      var scr=document.body.dataset.scr, tt=document.getElementById('tbTitle'), avant=tt?tt.textContent:'';
      if(!scr||scr==='sport'||scr==='calendrier') return 'Sport affiché, rien à vérifier';
      renderSport();
      if(document.body.dataset.scr!==scr) throw new Error('écran devenu '+document.body.dataset.scr);
      if(tt && tt.textContent!==avant) throw new Error('titre devenu '+tt.textContent);
      return 'en-tête « '+avant+' » conservé';
    });
  }


  /* ======================= 7g. BLESSURE, MUSCU ET RÉÉDUCATION (V4.6.0) ======= */
  function planDeTest(){            // plan de course jetable : la suite restaure PLAN, RECORDS, SESS et P à la fin
    var vt=window.toast, vb=window.burst, vr=window.renderSport;
    try{
      window.toast=function(){}; window.burst=function(){}; window.renderSport=function(){};
      if(!getUserVDOT()) RECORDS=[{dist:'5000 m',meters:5000,time:'21:00',date:todayKey()}];
      var d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+10*7-1);
      P.compDate=dateKey(d); P.days=[1,3,5,6]; P.objRace='10 km'; P.kmWeekMin=30; P.kmWeekMax=45; SESSLOG=[]; SESS=[];
      generatePlan();
    } finally { window.toast=vt; window.burst=vb; window.renderSport=vr; }
  }
  function testBlessureMuscu(){
    var c='7g. Blessure et muscu';
    if(!PLAN) planDeTest();
    essaie(c,'bibliothèque : 6 types, noms et tutos en 3 langues, images valides',function(){
      var all=allExercises(), k={}; all.forEach(function(e){ k[e.kind]=(k[e.kind]||0)+1; });
      ['force','etirement','mobilite','cardio','plyo','rehab'].forEach(function(x){ if(!k[x]) throw new Error('type absent : '+x); });
      EXD_ROWS.forEach(function(r){ if(!r[1]||!r[10]||!r[11]) throw new Error('nom manquant : '+r[0]); if(r[7]==='rehab' && !(r[12]&&r[12][1])) throw new Error('dose absente : '+r[0]); if(r[7]!=='rehab' && !r[8]) throw new Error('image absente : '+r[0]); });
      return all.length+' exercices · '+JSON.stringify(k);
    });
    essaie(c,'un plan de muscu ne contient jamais étirement, cardio, pliométrie ni rééducation',function(){
      var r=strengthRun({perWeek:3,days:[],equip:'both',level:'Intermédiaire',linked:false,seed:7},todayKey());
      if(r.err) throw new Error(r.err);
      r.plan.sessions.forEach(function(s){ s.ex.forEach(function(e){ var m=allExercises().find(function(x){ return x.name===e.name; }); if(m && m.kind!=='force') throw new Error(e.name+' = '+m.kind); }); });
      return r.plan.sessions.length+' séances, 100 % force';
    });
    essaie(c,'blessure confirmée : 7 signalements, ou 3 sur plus de 14 jours — pas avant',function(){
      var sv={P:JSON.stringify(P.adapt||null),I:P.injury,H:P.injuryH,L:ADAPT_LOG.slice(),S:STRENGTH,now:window.__ikSimNow,PL:JSON.stringify(PLAN)};
      try{
        var at=function(n){ var d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); window.__ikSimNow=d.getTime(); };
        P.adapt={}; P.injury=null; at(0);
        var rep=function(day,z){ at(day); adaptAfterPainReport({zone:z,side:'R',level:2,gait:false}); };
        [0,1,2,3,4,5].forEach(function(d){ rep(d,'knee'); });
        if(injActive()) throw new Error('confirmée trop tôt (6 signalements en 6 jours)');
        rep(6,'knee'); if(!injActive()||P.injury.phase!==1) throw new Error('7e signalement : blessure non confirmée');
        P.adapt={}; P.injury=null; P.injuryHist=[];
        rep(20,'achilles'); rep(28,'achilles'); if(injActive()) throw new Error('confirmée avec 2 signalements');
        rep(35,'achilles'); if(!injActive()) throw new Error('3 signalements sur 15 jours : non confirmée');
        return 'étape '+P.injury.phase+' · '+P.injury.zone;
      } finally { P.adapt=JSON.parse(sv.P); P.injury=sv.I; P.injuryHist=sv.H; ADAPT_LOG=sv.L; STRENGTH=sv.S; PLAN=JSON.parse(sv.PL); window.__ikSimNow=sv.now; }
    });
    essaie(c,'même zone mais trou de plus de 10 jours : épisode séparé, pas de blessure',function(){
      var sv={P:JSON.stringify(P.adapt||null),I:P.injury,L:ADAPT_LOG.slice(),S:STRENGTH,now:window.__ikSimNow,PL:JSON.stringify(PLAN)};
      try{
        var at=function(n){ var d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); window.__ikSimNow=d.getTime(); };
        P.adapt={}; P.injury=null;
        [0,1,2,3,4,5,40].forEach(function(d){ at(d); adaptAfterPainReport({zone:'calf',side:'L',level:2,gait:false}); });
        if(injActive()) throw new Error('blessure confirmée à tort');
        return 'ancien épisode ignoré';
      } finally { P.adapt=JSON.parse(sv.P); P.injury=sv.I; ADAPT_LOG=sv.L; STRENGTH=sv.S; PLAN=JSON.parse(sv.PL); window.__ikSimNow=sv.now; }
    });
    essaie(c,'blessure : la muscu reçoit de la rééducation, la zone sort, tout revient à la fin',function(){
      var sv={P:JSON.stringify(P.adapt||null),I:P.injury,L:ADAPT_LOG.slice(),S:STRENGTH,now:window.__ikSimNow,PL:JSON.stringify(PLAN)};
      try{
        var at=function(n){ var d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); window.__ikSimNow=d.getTime(); };
        var r=strengthRun({perWeek:3,days:[],equip:'both',level:'Intermédiaire',linked:true,seed:11},todayKey()); if(r.err) throw new Error(r.err);
        STRENGTH=r.plan; STRENGTH.linkedRun=true; var avant=JSON.stringify(STRENGTH.sessions.map(function(s){ return s.ex.map(function(e){ return e.name+e.sets; }); }));
        P.adapt={}; P.injury=null;
        [0,1,2,3,4,5,6].forEach(function(d){ at(d); adaptAfterPainReport({zone:'knee',side:'R',level:2,gait:false}); });
        if(!injActive()) throw new Error('blessure non confirmée');
        var lim=dateKey(new Date(window.__ikSimNow+21*864e5)), fut=STRENGTH.sessions.filter(function(s){ return s.date>=todayKey() && s.date<lim; });
        if(!fut.some(function(s){ return s.ex.some(function(e){ return e.rehab; }); })) throw new Error('aucun exercice de rééducation dans la muscu');
        fut.forEach(function(s){ s.ex.forEach(function(e){ if(!e.rehab && injExAffected(e,'knee_R')) throw new Error('exercice du genou encore présent : '+e.name); }); });
        var v=validateStrengthPlan({sessions:fut,perWeek:STRENGTH.perWeek,raceDate:STRENGTH.raceDate},PLAN.sessions); if(!v.ok && v.errors.some(function(x){ return /^emptySession|^tooMany|^twoOnSameDay/.test(x); })) throw new Error('plan muscu invalide : '+v.errors.join(','));
        [8,16,24].forEach(function(n){ for(var d=0;d<8;d++){ at(n+d); adState().dayRun=null; adaptDaily(); } });
        for(var d=25;d<45;d++){ at(d); adState().dayRun=null; adaptDaily(); }
        if(injActive()) throw new Error('blessure non terminée après 5 semaines sans douleur : étape '+P.injury.phase);
        var rest=STRENGTH.sessions.filter(function(s){ return s.date>=todayKey() && (s.inj||s.exOrig); }).length;
        if(rest && STRENGTH.sessions.some(function(s){ return s.date>=todayKey() && s.inj; })) throw new Error('séances encore marquées blessure');
        return 'confirmée → étapes 1-2-3 → terminée, '+fut.length+' séances adaptées puis rendues';
      } finally { P.adapt=JSON.parse(sv.P); P.injury=sv.I; ADAPT_LOG=sv.L; STRENGTH=sv.S; PLAN=JSON.parse(sv.PL); window.__ikSimNow=sv.now; }
    });
    essaie(c,'sens unique : une séance de course manquée ne touche jamais la muscu',function(){
      var sv={L:ADAPT_LOG.slice(),S:STRENGTH,PL:JSON.stringify(PLAN),A:JSON.stringify(P.adapt||null)};
      try{
        var r=strengthRun({perWeek:3,days:[],equip:'both',level:'Intermédiaire',linked:true,seed:5},todayKey()); if(r.err) throw new Error(r.err);
        STRENGTH=r.plan; var avant=JSON.stringify(STRENGTH.sessions);
        var dure=PLAN.sessions.find(function(s){ return planIsHard(s)&&!s.done&&s.date>=todayKey(); });
        if(dure) adaptAfterMissed([dure.id],'Fatigue');
        if(JSON.stringify(STRENGTH.sessions)!==avant) throw new Error('la muscu a bougé');
        return dure?'séance dure manquée : muscu intacte':'aucune séance dure à tester';
      } finally { ADAPT_LOG=sv.L; STRENGTH=sv.S; PLAN=JSON.parse(sv.PL); P.adapt=JSON.parse(sv.A); }
    });
    essaie(c,'muscu sautée : fatigue = une série de moins, maladie = pause, tout est annulable',function(){
      var sv={L:ADAPT_LOG.slice(),S:STRENGTH,PL:JSON.stringify(PLAN),A:JSON.stringify(P.adapt||null)};
      try{
        var r=strengthRun({perWeek:3,days:[],equip:'both',level:'Intermédiaire',linked:false,seed:9},todayKey()); if(r.err) throw new Error(r.err);
        STRENGTH=r.plan; var sess=STRENGTH.sessions.filter(function(s){ return s.date>=todayKey(); });
        var tot=function(s){ return s.ex.reduce(function(a,e){ return a+(+e.sets||0); },0); };
        var t1=tot(sess[1]); var out=strAfterMissed(sess[0].id,'Fatigue'); var f=STRENGTH.sessions.find(function(s){ return s.id===sess[1].id; });
        if(!out.length || tot(f)>=t1) throw new Error('fatigue : séance suivante non allégée');
        var u=adaptUndo(out[0].id); if(!u.ok) throw new Error('annulation refusée : '+u.why); f=STRENGTH.sessions.find(function(s){ return s.id===sess[1].id; });
        if(tot(f)!==t1) throw new Error('annulation : séries non rendues');
        return 'fatigue allège puis s\'annule';
      } finally { ADAPT_LOG=sv.L; STRENGTH=sv.S; PLAN=JSON.parse(sv.PL); P.adapt=JSON.parse(sv.A); }
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
        blSetStatus('modified');
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
        blSetStatus('modified');
        if(!document.querySelector('#progBody .wheel[data-key="DB.km.i"]')) throw new Error('molettes absentes en « Modifié »');
        debriefWheel('DB.km.i',12); debriefWheel('DB.km.d',5); debriefWheel('DB.dur.h',1); debriefWheel('DB.dur.m',2);
        if(debriefData.distance!==12.5 || debriefData.duration!==62) throw new Error(debriefData.distance+' km '+debriefData.duration+' min');
        if(debriefData.pace!=='4:58') throw new Error('allure '+debriefData.pace);
        if(debriefAdherence()!=='faster') throw new Error('respect de l\'allure : '+debriefAdherence());
        return '12,5 km en 1 h 02';
      } finally { window.openOv=avO; debriefCtx=null; try{ closeOv('ovProg'); }catch(e){} }
    });
    // V3.15.0 : cas simple en 3 gestes — « comme prévu », effort, Valider ; aucune molette affichée.
    essaie(c,'bilan simple : comme prévu, sans molette, valeurs prévues',function(){
      var avO=window.openOv; window.openOv=function(){};
      try{
        openSessionDebrief({date:todayKey(),title:'Test',km:8,pace:'5:00',type:'EF',duration:40});
        if(debriefData.status!=='done') throw new Error('statut '+debriefData.status);
        if(document.querySelector('#progBody .wheel')) throw new Error('une molette est affichée');
        if(!document.querySelector('#progBody .bl-range')) throw new Error('curseur d\'effort absent');
        if(debriefData.distance!==8 || debriefData.duration!==40) throw new Error('valeurs '+debriefData.distance+' / '+debriefData.duration);
        blSetStatus('missed');
        if(!document.querySelectorAll('#progBody .bl-reason').length) throw new Error('raisons absentes');
        if(!document.getElementById('blSubmit').disabled) throw new Error('Valider actif sans raison');
        return '3 gestes · « pas fait » = 1 question';
      } finally { window.openOv=avO; debriefCtx=null; try{ closeOv('ovProg'); }catch(e){} }
    });
    essaie(c,'douleur : silhouette, zone et côté',function(){
      var avO=window.openOv; window.openOv=function(){};
      try{
        openSessionDebrief({date:todayKey(),title:'Test',km:8,pace:'5:00',type:'EF',duration:40});
        debriefStep=2; debriefData.pain.on=true; renderDebrief();
        var z=document.querySelectorAll('#progBody .bl-z'); if(z.length<15) throw new Error(z.length+' zones');
        blPainZone('knee','L'); if(debriefData.pain.zone!=='knee'||debriefData.pain.side!=='L') throw new Error('zone non retenue');
        if(!document.querySelector('#progBody .bl-z.on')) throw new Error('zone non surlignée');
        return z.length+' zones';
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

  /* ======================= 7g. MOTEUR D'ADAPTATION (V3.15.0) ============= */
  function testAdaptation(){
    var c='7g. Moteur d\'adaptation';
    photographie();
    try{
      var rows=simulateAll({});
      rows.forEach(function(r){ chk(c,'simulateAthlete · '+r.scénario, r.ok==='✔', r['échecs']||(r.ajustements+' ajustement(s)')); });
      chk(c,'Daniels : 14 jours d\'arrêt = 0,973, 28 jours = 0,931', Math.abs(danielsBreakFactor(14)-0.973)<1e-9 && Math.abs(danielsBreakFactor(28)-0.931)<1e-9 && danielsBreakFactor(4)===1, '');
      var e=adaptExec({baseType:'SEUIL',status:'modified',rpe:7,planned:{paceS:270,dur:50},real:{paceS:283,dur:50,km:10},wx:{corr:0.05},date:todayKey()});
      chk(c,'chaleur : 5 % plus lent par +5 % de correction reste « dans la cible »', e.verdict==='ok' && e.rawVerdict!=='ok', e.verdict+' / brut '+e.rawVerdict);
      // V4.0.0 : table de Hadley (T°F + rosée °F) : 30 °C / 20 °C = 154 → 4,5–6 % ; 20 °C / 10 °C = 118 → 0,5–1 % ; 40 °C / 28 °C > 180 → pas d'effort dur
      var h1=heatCorr(30,20), h2=heatCorr(20,10), h3=heatCorr(40,28), h0=heatCorr(15,5);
      chk(c,'météo : correction de chaleur selon la table de Hadley', h1.sum===154 && h1.corr>0.045 && h1.corr<0.06 && h2.corr>0.005 && h2.corr<=0.01 && h3.noHard && h0.corr===0, h1.sum+' → '+(h1.corr*100).toFixed(2)+' %');
      chk(c,'météo : 58 wilayas, coordonnées en Algérie', WILAYAS.length===58 && WILAYAS.every(function(w,i){ return w[0]===i+1 && w[2]>18.9 && w[2]<37.2 && w[3]>-8.7 && w[3]<12; }), '');
      // V4.0.0 : Ramadan 1448 (8 février – 8 mars 2027 selon Umm al-Qura) : actif TOUT le mois, Aïd le 9 mars
      var sv=window.__ikSimNow, vis=P.ramadanVisual, fe=P.fetes, adj=P.hijriAdj;
      try{
        P.ramadanVisual=true; P.fetes=true; P.hijriAdj=0;
        var at=function(k){ window.__ikSimNow=new Date(k+'T10:00:00').getTime(); _rmMemo={}; _hijriMemo=null; };
        at('2027-02-08'); var f1=feteToday(); at('2027-02-21'); var f2=feteToday(); var inf=ramadanInfo(); at('2027-03-08'); var f3=feteToday(); at('2027-03-09'); var f4=feteToday(); at('2027-03-20'); var f5=feteToday();
        chk(c,'Ramadan : actif du 1er jour à la veille de l\'Aïd, puis l\'Aïd', f1==='ramadan'&&f2==='ramadan'&&f3==='ramadan'&&f4==='eidFitr'&&f5!=='ramadan'&&inf.day===14&&inf.end==='2027-03-08', [f1,f2,f3,f4,f5].join(' / ')+' · jour '+inf.day);
        var T=ramadanTimes('2027-02-21'); chk(c,'Ramadan : imsak = Fajr − 10 min, créneau après l\'iftar 1 h 30 – 2 h', T.imsakMin===((+T.fajr.slice(0,2))*60+(+T.fajr.slice(3)))-10 && T.after[0]>T.iftar, 'imsak '+T.imsak+' · iftar '+T.iftar+' · '+T.after.join('–'));
      } finally { window.__ikSimNow=sv; P.ramadanVisual=vis; P.fetes=fe; P.hijriAdj=adj; _rmMemo={}; _hijriMemo=null; }
      var lm=loadModel(); chk(c,'charge : une seule source (outil ACWR = moteur)', typeof lm.acute==='number' && 'acwr' in lm && 'monotony' in lm, '');
    }catch(err){ ko(c,'exécution',err&&err.message); }
    finally{ restaure(); }
  }

  /* ======================= 7j. DONNÉES DES INVITÉS (V4.0.0) ============== */
  // V4.0.0 : image de partage (module chargé à la demande)
  function testPartage(){
    var c='7k. Image de partage';
    return ikLoad('share').then(function(){
      var reps=[78,76,77,75,79,76,74,77,80,73].map(function(x,i){ return {n:i+1,dist:400,timeS:x,respected:x<=79}; });
      var ctx=shareCtxFromBilan({title:'10 × 400 m',date:todayKey(),distance:8.4,duration:42,pace:'4:58',deniv:35,rpe:7,hr:{avg:162},reps:reps,baseType:'VMAc'});
      chk(c,'contenu du bilan repris (distance, allure, FC, répétitions)', ctx.km===8.4 && ctx.pace==='4:58' && ctx.hr===162 && ctx.reps.length===10 && ctx.kind==='session', JSON.stringify({km:ctx.km,hr:ctx.hr}));
      var rec=shareCtxFromRecord({dist:'10 km',meters:10000,time:'41:32',date:'2026-09-20'});
      chk(c,'record : temps, allure calculée, record perso', rec.raceTime==='41:32' && rec.pace===spkToStr(2492/10) && rec.pb && rec.kind==='race', rec.pace);
      var sizes=[], worst=0, blank=[];
      ['story','square'].forEach(function(f){ ['sober','big','detail','progress','race'].forEach(function(tp){
        var t0=performance.now(), cv=shareRenderTo(ctx,{fmt:f,tpl:tp}); worst=Math.max(worst,performance.now()-t0);
        sizes.push(cv.width+'×'+cv.height);
        // le texte est bien dessiné : des pixels clairs au milieu de l'image
        var px=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data, light=0;
        for(var i=0;i<px.length;i+=4*97) if(px[i]+px[i+1]+px[i+2]>600) light++;
        if(light<20) blank.push(f+'/'+tp);
      }); });
      chk(c,'formats 1080 × 1920 et 1080 × 1080', sizes.slice(0,5).every(function(x){return x==='1080×1920';}) && sizes.slice(5).every(function(x){return x==='1080×1080';}), sizes[0]+' · '+sizes[5]);
      chk(c,'5 modèles dessinés, aucun vide', !blank.length, blank.join(', ')||'10/10');
      chk(c,'rendu en moins d\'une seconde', worst<1000, Math.round(worst)+' ms au pire');
      var a=shareRenderTo(Object.assign({},ctx,{name:'Nasri'}),{tpl:'sober',show:{name:false}}), b=shareRenderTo(Object.assign({},ctx,{name:'Nasri'}),{tpl:'sober'});
      chk(c,'prénom masquable', a.toDataURL()!==b.toDataURL(), 'image différente sans le prénom');
    }).catch(function(e){ ko(c,'chargement du module',e&&e.message); });
  }
  // V4.0.0 : calendrier des courses (module chargé à la demande, données de test locales)
  function testCourses(){
    var c='7l. Courses';
    var saveF=P.raceFollows;
    return ikLoad('races').then(function(){
      var r={id:'11111111-1111-4111-8111-111111111111',name:'Semi-marathon test, édition; spéciale d’Alger',date:adKeyAdd(todayKey(),20),start_time:'09:00',city:'Alger',wilaya:16,lat:36.75,lon:3.06,kind:'route',distances:[10,21.097],organizer:'',url:'',reg_url:'https://example.org/i',status:'published'};
      chk(c,'objectif du plan depuis une course (semi, 10 km, cross, autre)', raceToObjective(r,21.097).objRace==='Semi-marathon' && raceToObjective(r,10).objRace==='10 km' && raceToObjective({kind:'cross',date:r.date},4).objRace==='Cross' && raceToObjective(r,15).objRace==='Autre' && raceToObjective(r,15).objRaceKm===15 && raceToObjective(r,10).compDate===r.date, raceToObjective(r,21.097).objRace);
      var ics=raceIcsText(r,new Date('2026-10-12T10:00:00Z')), lines=ics.split('\r\n'), enc=new TextEncoder(), long=lines.filter(function(l){ return enc.encode(l).length>75; });
      var unf=ics.replace(/\r\n /g,'');
      chk(c,'export .ics : lignes ≤ 75 octets, texte échappé, 3 rappels', !long.length && /SUMMARY:Semi-marathon test\\, édition\\; spéciale/.test(unf) && (unf.match(/BEGIN:VALARM/g)||[]).length===3 && /TRIGGER:-P7D/.test(unf) && /DTSTART;TZID=Africa\/Algiers:/.test(unf), long.length+' ligne(s) trop longue(s)');
      var allDay=raceIcsText(Object.assign({},r,{start_time:null}));
      chk(c,'export .ics journée entière : rappels à 9 h', /DTSTART;VALUE=DATE:/.test(allDay) && /TRIGGER:-PT15H/.test(allDay.replace(/\r\n /g,'')), 'veille 9 h');
      chk(c,'contrôle du formulaire (mêmes règles que le serveur)', raceCheck(r)===null && raceCheck(Object.assign({},r,{url:'javascript:alert(1)'}))==='url' && raceCheck(Object.assign({},r,{date:'2026-13-01'}))==='date' && raceCheck(Object.assign({},r,{wilaya:59}))==='wilaya' && raceCheck(Object.assign({},r,{lat:48.8,lon:2.3}))==='coords' && raceCheck(Object.assign({},r,{distances:[5,'x']}))==='distances', 'url · date · wilaya · coords · distances');
      chk(c,'distances saisies « 10 ; 21,1 »', JSON.stringify(raceParseDists('10 ; 21,1'))==='[10,21.1]' && JSON.stringify(raceParseDists('4|8 km'))==='[4,8]' && raceParseDists('')===null, JSON.stringify(raceParseDists('10 ; 21,1')));
      var rows=raceParseImport('nom;date;heure;ville;wilaya;type;distances;site\n"Cross ""FAA"" test";10/01/2027;9h30;Oran;Oran;cross;4|8;https://example.org\nSemi;2027-02-01;;Alger;16;route;21,1;');
      chk(c,'import CSV (guillemets, dates JJ/MM/AAAA, wilaya par nom, heure 9h30)', rows.length===2 && rows[0].name==='Cross "FAA" test' && rows[0].date==='2027-01-10' && rows[0].wilaya===31 && rows[0].start_time==='09:30' && rows[0].kind==='cross' && JSON.stringify(rows[0].distances)==='[4,8]' && rows[1].distances[0]===21.1, JSON.stringify(rows[0]));
      var js=raceParseImport('[{"name":"Course","date":"2027-03-01","city":"Sétif","distance":"10"}]');
      chk(c,'import JSON', js.length===1 && js[0].city==='Sétif' && js[0].distances[0]===10 && raceParseImport('[oops').err==='rcImpBadJson', JSON.stringify(js[0]));
      P.raceFollows=[]; raceFollowSet(r,true);
      var card=raceCountdownHTML();
      chk(c,'suivi : compte à rebours sur l\'accueil (≤ 30 jours)', raceIsFollowed(r.id) && card.indexOf('rc-count')>=0 && card.indexOf('<b>20</b>')>=0, 'J-20');
      P.raceFollows=[{id:r.id,name:'X',date:adKeyAdd(todayKey(),45),city:'Y'}];
      chk(c,'suivi : rien au-delà de 30 jours', raceCountdownHTML()==='', 'J-45');
      var x=cleanImportedProfile({raceFollows:[{id:r.id,name:'<img src=x>',date:'2027-01-01',city:'A'},{id:"x');alert(1);//",date:'2027-01-01'}],objRaceId:"');alert(1)//",objRaceName:'Semi <b>'});
      chk(c,'import du profil : courses suivies nettoyées', x.raceFollows.length===1 && x.raceFollows[0].name.indexOf('<')<0 && !x.objRaceId && x.objRaceName.indexOf('<')<0, x.raceFollows.length+' gardée(s)');
    }).catch(function(e){ ko(c,'chargement du module',e&&e.message); }).then(function(){ P.raceFollows=saveF; });
  }
  // V4.0.0 : statistiques anonymes (file d'attente, nettoyage, refus) et plans exemples
  function testStatsEtMethode(){
    var c='7m. Statistiques et méthode';
    chk(c,'aucune statistique pendant la suite de fumée', ikAnalyticsOn()===false, 'selftest');
    var keepOn=window.ikAnalyticsOn, keepQ=localStorage.getItem('ik_evq'), keepA=localStorage.getItem('ik_aid'), keepPa=P.analytics;
    try{
      localStorage.removeItem('ik_evq'); window.ikAnalyticsOn=function(){ return true; };
      ikTrack('Bad Name',{}); ikTrack('test_ev',{a:new Array(101).join('x'),n:1.23456,o:{x:1},b:true,u:undefined});
      var q=JSON.parse(localStorage.getItem('ik_evq')||'[]'), e=q[0]||{};
      chk(c,'événement : nom contrôlé, propriétés courtes, identifiant aléatoire', q.length===1 && e.n==='test_ev' && e.p.a.length===40 && e.p.n===1.23 && e.p.b===true && !('o' in e.p) && /^[0-9a-f-]{36}$/.test(e.aid) && ['ios','android','desktop','other'].indexOf(e.pf)>=0, JSON.stringify(e.p));
      chk(c,'aucune donnée de compte dans l\'événement', JSON.stringify(e).indexOf(String(window.currentUserId||'@@'))<0 && JSON.stringify(e).indexOf(String(P.name||'@@'))<0, Object.keys(e).join(','));
      for(var i=0;i<320;i++) ikTrack('test_ev',{});
      chk(c,'file d\'attente hors ligne bornée à 300', JSON.parse(localStorage.getItem('ik_evq')).length===300, '300');
      window.ikAnalyticsOn=keepOn; ikAnalyticsSet(false);
      chk(c,'refus : file et identifiant effacés', !localStorage.getItem('ik_evq') && !localStorage.getItem('ik_aid') && P.analytics===false && ikAnalyticsOn()===false, 'opt-out');
    } finally {
      window.ikAnalyticsOn=keepOn; clearTimeout(_ikEvT); P.analytics=keepPa;
      try{ if(keepQ) localStorage.setItem('ik_evq',keepQ); else localStorage.removeItem('ik_evq'); if(keepA) localStorage.setItem('ik_aid',keepA); }catch(x){}
    }
    var before=JSON.stringify({c:P.compDate,r:P.objRace,d:P.days,p:PLAN&&PLAN.sessions.length});
    return ikLoad('method').then(function(){
      var res=methodSamples.map(function(s){ var o=methodSampleBuild(s); return o?{k:s.k,err:o.valid.errors.length,w:o.weeks.length,race:o.plan.sessions[o.plan.sessions.length-1].baseType}:{k:s.k,err:-1}; });
      chk(c,'4 plans exemples produits par le moteur, sans erreur de contrôle', res.length===4 && res.every(function(r){ return r.err===0 && r.race==='COURSE'; }), res.map(function(r){ return r.k+':'+r.err+'/'+r.w+'s'; }).join(' '));
      chk(c,'le profil et le plan de l\'utilisateur ne bougent pas', JSON.stringify({c:P.compDate,r:P.objRace,d:P.days,p:PLAN&&PLAN.sessions.length})===before, before);
    }).catch(function(e){ ko(c,'chargement du module',e&&e.message); });
  }
  function testInvites(){
    var c='7j. Invités, export, import';
    photographie();
    try{
      // fusion : compte (A) + invité (B), une séance commune modifiée plus tard côté invité
      SESS=[{date:'2026-09-01',type:'EF',km:8,duration:44,ut:100},{date:'2026-09-03',type:'Seuil',km:10,duration:50,ut:100}];
      RECORDS=[{dist:'5000 m',meters:5000,time:'21:00',date:'2026-08-01'}]; PLAN={created:'2026-08-01',sessions:[{id:1,date:'2026-09-10',done:false}]};
      ADAPT_LOG=[{id:'a1',ut:100,status:'applied'}];
      var B={sessions:[{date:'2026-09-01',type:'EF',km:8,duration:44,ut:200,rpe:4},{date:'2026-09-05',type:'Long',km:14,duration:80}],
        records:[{dist:'5000 m',meters:5000,time:'21:00',date:'2026-08-01'},{dist:'10 km',meters:10000,time:'44:00',date:'2026-09-02'}],
        run_plan:{created:'2026-09-02',sessions:[{id:9,date:'2026-09-12',done:false}]}, adapt_log:[{id:'a1',ut:300,status:'undone'}], profile:{name:'X',city:'Oran'}};
      var cityBefore=P.city, nameBefore=P.name; P.city=''; P.name='Moi';
      var add=ikMergeInto(B);
      chk(c,'fusion : sans doublon, la version la plus récente gagne', SESS.length===3 && SESS.filter(function(x){return x.date==='2026-09-01';})[0].rpe===4 && RECORDS.length===2 && ADAPT_LOG.length===1 && ADAPT_LOG[0].status==='undone', SESS.length+' séances · '+RECORDS.length+' records');
      chk(c,'fusion : plan le plus récent, profil complété champ par champ', PLAN.created==='2026-09-02' && P.city==='Oran' && P.name!=='X', 'plan du '+PLAN.created+' · ville '+P.city);
      P.city=cityBefore; P.name=nameBefore;
      // export v3 → import
      var txt=JSON.stringify({app:'IKORUN',exportVersion:3,appVersion:APP_VERSION,date:new Date().toISOString(),keys:IK_KEYS,data:ikSnapshot()});
      var p=ikParseExport(txt);
      chk(c,'export v3 relu par l\'import (format et version vérifiés)', !p.err && p.data.sessions.length===SESS.length && p.data.run_plan && ikParseExport('{"app":"IKORUN","exportVersion":99,"data":{}}').err==='importTooNew' && ikParseExport('{"x":1}').err==='invalidFile', 'v'+p.version);
      var evil=ikParseExport(JSON.stringify({app:'IKORUN',exportVersion:3,data:{sessions:[{date:'2026-09-09',title:'<img src=x onerror=alert(1)>',km:5}]}}));
      chk(c,'import : le HTML d\'un fichier fabriqué est neutralisé', evil.data.sessions[0].title.indexOf('<')<0, evil.data.sessions[0].title);
      // V4.0.0 : détection du navigateur pour le guide d'installation
      var UA={
        iosSafari:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        iosChrome:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1',
        iosChromeOld:'Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/110.0 Mobile/15E148 Safari/604.1',
        andChrome:'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        samsung:'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
        waAnd:'Mozilla/5.0 (Linux; Android 13; M2101K6G Build/TKQ1.221013.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 WhatsApp/2.24.8.85',
        insta:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 327.0.0.32.120 (iPhone14,2; iOS 17_4; fr_FR)',
        fb:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/460.0.0.48.109;]',
        tiktok:'Mozilla/5.0 (Linux; Android 12; SM-A525F) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 trill_340204 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/34.2.4 BytedanceWebview/d8a21c6',
        snap:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/13.20.0.39 (like Safari/8617.1.17.10.12, panda)',
        tg:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Mobile Safari/537.36 Telegram-Android/10.9.1',
        desk:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'};
      var want={iosSafari:'ios-safari',iosChrome:'ios-other',iosChromeOld:'ios-old',andChrome:'android-chrome',samsung:'samsung',waAnd:'inapp',insta:'inapp',fb:'inapp',tiktok:'inapp',snap:'inapp',tg:'inapp',desk:'desktop'};
      var bad=Object.keys(UA).filter(function(k){ return ikPlatform(UA[k]).k!==want[k]; });
      chk(c,'installation : 12 navigateurs reconnus (dont 6 intégrés à une app)', !bad.length, bad.map(function(k){return k+'→'+ikPlatform(UA[k]).k;}).join(', ')||'ok');
      chk(c,'installation : lien intent:// vers Chrome', /^intent:\/\/.+#Intent;scheme=https;package=com\.android\.chrome;/.test(ikIntentUrl()), '');
    }catch(e){ ko(c,'exécution',e&&e.message); }
    finally{ restaure(); }
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

  /* ======================= 7i. ÉDITEUR DE THÈME (V3.14.0) ================= */
  function testTheme(){
    var c='7i. Éditeur de thème';
    essaie(c,'neuf couleurs de base, une par teinte, chaque nuance rattachée',function(){
      if(BASE_HUES.length!==9) throw new Error(BASE_HUES.length+' couleurs de base');
      var all=[]; BASE_HUES.forEach(function(b){ all=all.concat(b[2]); });
      var orph=ACCENTS.filter(function(a){ return all.indexOf(a.key)<0; }).map(function(a){ return a.key; });
      if(orph.length) throw new Error('nuances sans couleur de base : '+orph.join(', '));
      return '9 couleurs, '+all.length+' nuances';
    });
    essaie(c,'contraste garanti sur 300 réglages au hasard (accent, texte du bouton, textes secondaires)',function(){
      var bad=0;
      for(var i=0;i<300;i++){
        var B=txBuild({on:true,base:'blue',h:Math.random()*360,s:Math.random()*100,l:Math.random()*100,bg:Math.random()*100,tint:Math.random()*100});
        ['dark','light'].forEach(function(m){ var o=B[m], f=function(k){ return okFromHex(o[k]); }, g=/,(#[0-9A-F]{6}) 55%/.exec(o['--grad-btn'])[1];
          if(okCR(f('--e'),f('--bg'))<4.5 || okCR(okFromHex(o['--accent-ink']),okFromHex(g))<4.5 || okCR(f('--muted'),f('--s2'))<4.5 || okCR(f('--dim'),f('--s2'))<4.5) bad++; });
      }
      if(bad) throw new Error(bad+' thèmes sous 4,5:1');
      return '600 thèmes (sombre + clair) vérifiés';
    });
    essaie(c,'le thème perso est posé avant la première image, une couleur prédéfinie le remplace',function(){
      var av=P.tx, avT=P.theme;
      try{
        P.tx=txDefaults('green'); P.tx.h=300; applyTheme();
        var tp=JSON.parse(localStorage.getItem('ik_theme_prefs')||'{}');
        var re=/^html:not\(#ik-tx\):not\(#ik-tx2\)\{[-\w\s:;#,.()%]*\}html:not\(#ik-tx\):not\(#ik-tx2\)\[data-mode="light"\]\{[-\w\s:;#,.()%]*\}$/;
        if(!tp.css || !re.test(tp.css)) throw new Error('miroir absent ou refusé par le filtre d’index.html');
        if(!document.getElementById('ikTx')) throw new Error('feuille du thème absente');
        P.theme='red'; P.tx.on=false; applyTheme();
        if(document.getElementById('ikTx')) throw new Error('la couleur prédéfinie ne remplace pas le thème perso');
        return 'miroir de '+tp.css.length+' caractères';
      } finally { P.tx=av; P.theme=avT; applyTheme(); }
    });
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
    testTheme();
    testPetitsEcrans();
    testBilanMolette();
    testBlessureMuscu();
    testAdaptation();
    testInvites();
    testSelecteursEtPlan();
    testModifierSeance();
    Promise.resolve(testI18nUsage())
      .then(function(){ return testHorsLigne(); })
      .then(function(){ return testSon(); })
      .then(function(){ return testPartage(); })
      .then(function(){ return testCourses(); })
      .then(function(){ return testStatsEtMethode(); })
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
