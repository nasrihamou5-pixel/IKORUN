# IKORUN — Partie 2 : plan de conception

Chaque section précise : les données, les écrans, les règles, les cas limites. Les modules nouveaux sont des
scripts classiques, assemblés par `tools/build.mjs` dans `app.min.js` (cœur) ou dans des fichiers chargés
à la demande (`*.min.js`, précachés par le service worker).

## 1. Moteur d'adaptation (`plan/adapt.js`)

### Données
- **Bilan** (`SESSLOG`, clé `sesslog`, version 2) : `{id, v:2, ut, date, planSessionId, sessRef, baseType,
  status: done|modified|missed, reason?, rpe, rpeExp:[lo,hi], planned:{km,dur,paceS}, real:{km,dur,paceS},
  reps:[{n,dist,target,timeS}], hr:{avg,max}, legs:1-3, sleep:1-3, mood:1-5, note, pain:{on,zone,level,gait},
  wx:{t,dew,corr,src}, fast:bool, load, exec:{dev,devS,durDev,rpeDev,verdict,causes[]}}`.
  Les anciens champs (`fatigue`, `feel`, `sleep` sur 5, `pain` en texte) restent remplis : les outils et les
  stats qui les lisent continuent de marcher.
- **Check du matin** (`checkins`) : `{id, ut, date, sleep:1-3, sore:1-3, mood:1-5}`.
- **Ajustements** (`adapt_log`) : `{id, ut, ts, date, rule, safety, sessIds, before[], after[], msg:{k,p},
  status: applied|undone|rejected|proposal, seen}`. `before` et `after` sont des copies des séances touchées.
- **État** (`PLAN.adapt`) : délais de recharge par règle, blocage d'intensité (`block:{until,zone,src}`),
  zones douloureuses récentes, proposition de VDOT en attente, reprise en cours.
- **Statut partagé** (table `athlete_status`) : charge aiguë/chronique, ACWR, monotonie, forme, douleur
  oui/non (zone/intensité seulement si l'athlète l'a accepté). Visible des encadrants de ses clubs seulement
  si `share_club = true`.

### Calculs (une seule source de vérité : `loadModel()`)
- Charge d'une séance = durée (min) × RPE (sRPE de Foster). Course, musculation et activités de
  remplacement comptent. RPE manquant → RPE attendu du type, sinon 5.
- Aiguë = moyenne sur 7 j ; chronique = moyenne sur 28 j ; ACWR = aiguë / chronique (null tant qu'il y a
  moins de 14 jours d'historique). Monotonie = moyenne / écart-type des charges quotidiennes sur 7 j ;
  contrainte (strain) = charge de la semaine × monotonie. L'outil ACWR lit le même calcul.
- **RPE attendu** : EF 3–4, Récup 2–3, Sortie longue 4–5, Lignes 4–5, Progressif 5–6, Fartlek 6–7,
  Tempo 6–7, Seuil 7, Double seuil 7, Tempo spé 7, Allure spé 7–8, Côtes 7–8, VMA longue 8–9,
  VMA courte 8–9, Intervalles 8–9, Course 9–10.
- **Écart d'exécution** : allure réelle vs cible (en % et en s/km). Sur un fractionné, moyenne des
  répétitions vs leur cible ; sinon allure moyenne vs allure moyenne prévue. La cible est d'abord
  corrigée de la chaleur (section 4) et du jeûne (section 5).
  - Séance de qualité : ≥ 4 % plus vite → trop vite ; de 3 % plus lent à 4 % plus vite → dans la cible ;
    plus de 3 % plus lent → lent ; plus de 8 % → beaucoup plus lent.
  - Footing ou sortie longue : ≥ 6 % plus vite → trop vite ; la lenteur n'est jamais une faute.
- **Indice de forme** (0–100) : 75 au départ.
  - Sommeil : mauvais −15, moyen −5, bon +5. Jambes : lourdes −15, fraîches +5. Humeur (1–5) : ±5 par cran.
  - Douleur : intensité ≥ 4 −30, sinon −10. Maladie −40. ACWR : > 1,5 −20, > 1,3 −10.
  - Dure la veille −5. Plus de 5 jours d'affilée −5.
  - Sources : le check du matin, sinon le dernier bilan (≤ 36 h). Sans aucune donnée → pas d'indice,
    pas d'ajustement.

### Règles (ordre de priorité ; une règle de sécurité désactive les règles de progression)
1. **e. Douleur et maladie**
   - Douleur ≥ 4/10, ou douleur qui change la foulée → plus aucune intensité pendant 3 jours (footings
     très légers ou repos) ; conseil de consulter si ça dure.
   - Même zone 3 fois en 7 jours → intensité bloquée jusqu'à « je n'ai plus mal », et avis médical
     fortement conseillé.
   - Maladie → 2 jours de repos, puis reprise progressive (comme une coupure).
   - Aucun diagnostic n'est jamais posé.
2. **d. Coupures**
   - 3 à 6 jours sans courir → semaine suivante allégée (volume × 0,8, qualité raccourcie d'un cran).
   - 7 jours ou plus → VDOT × facteur de Daniels, puis plan reconstruit de la reprise à la course.
     - Facteurs (VDOT O2, d'après Daniels) : 6 j 0,997 · 14 j 0,973 · 28 j 0,931 · 72 j et plus 0,800,
       interpolés entre ces points. Avec activité croisée : 0,998 / 0,986 / 0,965.
     - Volume de reprise (règle IKORUN) : coupure de 6 à 28 jours → 50 % puis 75 % ; plus de 28 jours
       → 33 %, 50 %, 75 %.
3. **f. Charge**
   - ACWR > 1,3 → 3 jours allégés (× 0,85).
   - ACWR > 1,5 → alerte claire, 7 jours à × 0,7, et les deux prochaines séances dures deviennent faciles.
   - ACWR < 0,8 pendant au moins 14 jours → +5 % sur les footings, dans la limite des +10 %.
   - Monotonie > 2 → on alterne footing court et footing plus long, volume total inchangé.
4. **g. Forme du jour** < 45 avec une séance dure prévue → échange avec un footing de la semaine si les
   règles le permettent, sinon la séance devient un footing. Entre 45 et 60 : on garde, avec un message
   de prudence.
5. **a. Trop vite**
   - Une fois : la prochaine séance dure à moins de 48 h est décalée d'un jour (si la place est libre),
     sinon allégée d'un cran ; message pédagogique avec la cible et l'allure réelle.
   - Au moins 2 des 3 dernières séances clés trop vite, en 28 jours, avec un RPE ≤ attendu →
     proposition (jamais imposée) de VDOT +0,5 ou +1, ou un test.
6. **b. Trop lent ou trop dur**
   - On cherche d'abord une cause externe : chaleur, vent > 25 km/h, dénivelé > 15 m/km, jeûne,
     mauvais sommeil, maladie. Si elle explique l'écart, rien ne change et on le dit.
   - Sans cause, au moins 2 des 3 dernières séances clés → 7 jours allégés.
   - Au moins 4 des 6 dernières, en 35 jours → proposition de VDOT −0,5 ou −1.
7. **c. Bien fait** → message de validation court ; la progression prévue continue.
8. **d. Séance ratée**
   - Facile → on ne la rattrape pas.
   - Clé → déplacée dans la semaine à la place d'un footing (même volume, pas de séances dures
     d'affilée, pas la veille de la course), sinon supprimée.

### Garde-fous (h)
- Jamais plus de +10 %/semaine (`planBalanceLoad`).
- L'affûtage (`TAPER`) et la course ne sont jamais supprimés ; seule la sécurité peut les adoucir.
- Jamais deux séances dures d'affilée.
- Hystérésis : seuils, délais de recharge par règle, tendances confirmées sur plusieurs séances, jamais
  deux fois la même action sur la même séance.
- Chaque ajustement est appliqué sur une copie du plan, repassé par `planSettle` puis `validatePlan`.
  S'il crée une erreur qui n'existait pas avant, il est annulé et noté « refusé ».

### Écrans
- **Bilan, écran 1**
  - « Comment ça s'est passé ? » : fait comme prévu / modifié / pas fait.
  - RPE : curseur 1–10 avec visages et libellés.
  - Distance, durée et allure pré-remplies avec les valeurs prévues ; les molettes ne s'ouvrent qu'en
    choisissant « modifié ».
  - Temps à remplir dans le cas simple : 3 taps (« comme prévu », RPE, Valider), moins de 10 s.
- **Bilan, écran 2** (« Ajouter des détails ») :
  - répétitions une par une ou « toutes à X » ;
  - FC moyenne et maximale ;
  - jambes, sommeil, humeur (5 visages), note libre ;
  - douleur : silhouette à zones, intensité 0–10, « ça change ma foulée ».
- **Pas fait** : une seule question, la raison (fatigue, douleur, maladie, manque de temps, météo,
  autre). Douleur ou maladie ouvre la silhouette ou la durée.
- **Check du matin** : carte discrète sur l'Accueil, 3 taps, masquable, jamais imposée.
- **Carte « Ton coach a ajusté ton plan »** (Accueil et Sport) : ce qui change, pourquoi, et
  « Annuler » si l'ajustement ne touche pas à la sécurité. Pour la sécurité : « Je n'ai plus mal »,
  avec confirmation.
- **Historique** des ajustements : date, séance, raison, avant → après.

### Tests
- `simulateAthlete(nom, {semaines})` : simule les bilans jour par jour avec une horloge simulée et sans
  rien enregistrer. Affiche les semaines (prévu/fait, ACWR, forme) et chaque ajustement avec sa raison,
  puis vérifie les attentes du scénario.
- `simulateAll()` lance les 12 scénarios.

## 2. Invités (`core/guest.js`)
- `navigator.storage.persist()` est demandé :
  - après le 1er bilan validé, et à l'installation ;
  - son état (protégé oui/non) est affiché dans Profil › Compte.
- Invitation à créer un compte :
  - après 3 séances validées ou 3 jours d'usage (le premier des deux) ;
  - puis au plus une fois tous les 3 jours, jamais pendant une séance, une fenêtre ouverte ou
    l'inscription.
- Conversion : `updateUser` (email) et `linkIdentity` (Google) gardent le même identifiant. Si l'adresse
  ou le compte Google existe déjà :
  - on chiffre une copie complète des données invité, puis on ouvre le compte existant ;
  - on fusionne date par date : listes par identifiant, dernière modification gagnante, sans doublon ;
    profil champ par champ ; plan le plus récent ;
  - on pousse le résultat, puis on supprime la copie.
- Export / import `.json` v3 : toutes les clés, en-tête `{app, exportVersion, appVersion, date}`,
  vérification du format, choix « remplacer » ou « fusionner ».
- Indicateur « Données uniquement sur ce téléphone » dans le profil invité.

## 3. Installation (`ui/install.js`)
- Détection :
  - iOS Safari, iOS Chrome/Edge/Firefox (iOS ≥ 16.4 : le partage permet l'ajout à l'écran d'accueil ;
    avant : passer par Safari) ;
  - Android Chrome (`beforeinstallprompt`), Samsung Internet, autres navigateurs ;
  - navigateurs intégrés (WhatsApp, Instagram, Facebook, Messenger, TikTok, Telegram, Snapchat, Line) :
    lien `intent://` vers Chrome sur Android, schéma « ouvrir dans Safari » sur iOS ;
  - app déjà installée : jamais de guide.
- Guide en étapes animées, avec des schémas SVG du bon téléphone dans la couleur du thème.
- Moments : après le 1er plan généré, puis au plus un rappel tous les 7 jours ; toujours dans Profil.
- Manifest : icônes `any` et `maskable`, captures d'écran (étroites et larges), `theme_color` mis à jour
  par l'app.

## 4. Météo (`weather/weather.js` + `weather/scene.js` chargé à la demande)
- Un seul module fournisseur : Open-Meteo, gratuit et non commercial ; à remplacer par une edge function le
  jour où l'app devient payante.
  - Prévision horaire : température, ressenti, humidité, rosée, vent, rafales, pluie, nuages, UV, jour/nuit,
    code météo.
  - Lever et coucher du soleil.
  - Poussière (API qualité de l'air) pour détecter le sirocco.
  - Cache de 1 h (localStorage), réutilisable 24 h hors ligne.
- Lieu :
  - géolocalisation demandée seulement au moment voulu (bouton dans la séance ou les réglages) ;
  - sinon les 58 wilayas, plus une recherche (géocodage Open-Meteo) ;
  - ville enregistrée dans le profil.
- Chaleur : T(°F) + rosée(°F), table de Hadley, interpolée dans chaque palier ; au-delà de 180, séance
  dure déconseillée.
  - Les allures de la séance sont multipliées par (1 + correction).
  - Le moteur juge l'exécution sur ces allures corrigées.
- Conseils automatiques : heures les plus fraîches du jour, hydratation, UV ≥ 6, vent ≥ 30 km/h,
  orage → décaler ou faire la séance à l'intérieur.
- Scènes Canvas 2D : soleil, nuages en parallaxe, pluie (angle selon le vent, densité selon les mm/h),
  orage, vent, brouillard, nuit étoilée, neige, sirocco.
  - Nombre de particules adapté à l'appareil ; pause hors écran ; image fixe en mouvement réduit.
  - Couleurs du thème ; profondeur liée à l'inclinaison si les reflets sont activés.

## 5. Ramadan (`ramadan/ramadan.js`)
- Défauts actuels :
  - la fête n'est active que le 1er jour (`h.d===1`) ;
  - le thème personnalisé passe devant les couleurs de la fête.
- Correction :
  - `ramadanState()` utilise le calendrier `islamic-umalqura` et le décalage ±1 j ;
  - le mode est actif du 1er Ramadan à la veille de l'Aïd ;
  - le visuel actuel est gardé (lanternes, croissant, guirlandes, couleurs de la fête) ;
  - pendant le mois, le thème perso est suspendu, puis revient exactement.
- Sport :
  - imsak (Fajr − 10 min) et iftar (Maghreb), calculés pour la ville choisie ;
  - deux créneaux : avant l'iftar (facile et court seulement) ou 1 h 30–2 h après (qualité possible) ;
  - baisse du volume léger / normal / fort (−10 / −20 / −30 %), intensité plafonnée au seuil ;
  - reprise sur 2 semaines après l'Aïd (−10 % puis −5 %) ;
  - rappels d'hydratation entre iftar et shour.
- Le moteur tient compte du jeûne pour juger une séance plus lente.
- Interrupteurs « visuel » et « sport », discrets dans Profil › Apparence et Plan.

## 6. Image de partage (`share/share.js`, à la demande)
- Formats : 1080×1920 et 1080×1080.
- Modèles : sobre, gros chiffres, séance détaillée, progression, course.
- Contenus à cocher.
- Fonds : dégradé, verre ou photo recadrée.
- Couleurs du thème avec contraste vérifié.
- Rendu : après `document.fonts.ready`, arabe en RTL (`ctx.direction`), logo + ikorun.pages.dev.
- Partage : `navigator.share({files})`, sinon téléchargement ; aperçu avant partage ; < 1 s.

## 7. Courses (`races/races.js`, à la demande ; tables `races`, `race_proposals`)
- `races` : lecture publique, écriture par les administrateurs (table `app_admins`).
- Sources : collecte automatique seulement si robots.txt et CGU l'autorisent ; sinon saisie et import
  JSON/CSV par l'admin. Dédoublonnage par nom normalisé + ville + date proche ; contradictions de date
  signalées.
- Propositions des utilisateurs : limitées en débit, publiées après validation par l'admin.
- Écrans :
  - liste, calendrier et filtres ;
  - fiche avec carte OpenStreetMap et météo du jour J ;
  - « Préparer cette course » ;
  - choix dans l'inscription et dans le plan ;
  - rappels J-30, J-7 et la veille ;
  - export `.ics`.

## 8–10. Analytics, crédibilité, sécurité
- `events` : id anonyme aléatoire, événement, propriétés non personnelles, version, langue, plateforme,
  installé.
  - Insertion seulement, limitée en débit ; refus possible ; envoi par lots hors ligne.
  - Vues d'administration (entonnoir, actifs, rétention, fonctions, langues, plateformes) réservées à
    l'admin via des RPC.
- `samplePlans()` : page imprimable de plans d'exemple. Page « La méthode IKORUN ».
- Audit des RLS et des edge functions ; `escHtml` partout ; limites de débit ; liste des réglages manuels.

## 11. Restructuration
- Sources découpées par domaine.
- `tools/build.mjs` assemble le cœur et les modules différés, et les minifie.
- Le service worker précache les modules.
- Mesures avant / après ; tous les tests repassés.
