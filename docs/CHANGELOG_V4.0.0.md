# IKORUN V4.0.0 — Nouveautés

*12 octobre 2026*

## 1. Un plan qui s'adapte vraiment

**Bilan en deux écrans.** « Comme prévu », « Modifié » ou « Pas fait », puis l'effort ressenti. Les détails sont facultatifs : fréquence cardiaque, jambes, sommeil, humeur, note, et une silhouette pour placer une douleur avec son côté.

**Le coach applique des règles écrites, sans IA :**
- **Allure** : comparée à la cible, en tenant compte de la chaleur, du vent, des côtes et du jeûne.
- **Douleur** : 4/10 ou plus, ou une boiterie, donne 3 jours sans course. La même douleur 3 fois en une semaine bloque les séances dures.
- **Charge** : rapport aigu/chronique.
  - Au-dessus de 1,3 deux matins de suite : les 3 jours suivants sont allégés de 15 %.
  - Au-dessus de 1,5 : la semaine suivante est allégée de 30 %.
- **Monotonie** : les footings sont variés.
- **Coupure** : à la reprise, le plan est reconstruit selon la perte mesurée par Daniels.
- **VDOT** : proposé à la hausse ou à la baisse, jamais pendant l'affûtage.
- **Séance manquée** : déplacée dans la semaine, jamais rattrapée en doublant.

**Transparence.** Chaque changement est expliqué, avec un avant/après et un bouton Annuler. Un historique est dans le plan.

**Check du matin** en 3 gestes (sommeil, courbatures, humeur), désactivable.

**Club (facultatif).** Tu peux partager ta forme avec l'encadrement : charge, forme et « douleur oui/non ». La zone de la douleur n'est montrée que si tu l'acceptes aussi.

## 2. Données des invités

- Stockage protégé sur l'appareil.
- Rappel pour créer un compte, sans être insistant.
- Fusion d'un invité vers un compte existant sans rien perdre.
- Export v3 et import en fusionnant ou en remplaçant.

## 3. Installer l'app

- Guide qui reconnaît le téléphone et le navigateur :
  - iPhone Safari ou autre navigateur ;
  - Android Chrome, Samsung Internet, Firefox ;
  - navigateurs intégrés de WhatsApp, Instagram, Facebook, TikTok.
- Étapes illustrées.
- Bouton « Ouvrir dans Chrome » depuis un navigateur intégré.
- Manifest avec captures d'écran et raccourci « Séance du jour ».

## 4. Météo

- Prévisions Open-Meteo pour la ville, la wilaya (les 58) ou ta position, arrondie à environ 1 km.
- Correction de chaleur (table de Hadley).
- Conseils : heures plus fraîches, eau, UV, vent, sirocco.
- Scènes animées, économes en batterie et respectant « réduire les animations ».

## 5. Ramadan

- Tout le mois, avec les horaires de l'imsak et de l'iftar.
- Ton thème personnalisé est suspendu pendant le mois, puis rétabli à l'identique.
- Plan adapté :
  - volume −10, −20 ou −30 % ;
  - les séances VMA deviennent du seuil ;
  - séances dures après l'iftar ;
  - reprise sur 2 semaines après l'Aïd.

## 6. Image de séance à partager

- Formats story (1080 × 1920) et carré (1080 × 1080).
- Cinq modèles : sobre, gros chiffres, séance détaillée, progression, course.
- Contenu à cocher ; ton prénom peut être masqué.
- Fond dégradé, verre ou ta photo (glisser, zoomer), aux couleurs du thème avec contraste vérifié.
- Arabe en droite-à-gauche.
- Partage direct (ou enregistrement) ; rendu en moins de 120 ms.
- Disponible depuis l'analyse du bilan, une séance faite, un record et les statistiques.

## 7. Calendrier des courses en Algérie

- Liste par mois ou calendrier.
- Recherche sans accents ; filtres par distance, type et wilaya.
- **Fiche de course** :
  - lieu, distances, organisateur ;
  - carte OpenStreetMap, affichée seulement si tu la demandes ;
  - lien d'inscription ;
  - météo du jour J (16 jours avant) avec la correction de chaleur.
- **« Préparer cette course »** : la configuration du plan s'ouvre déjà remplie. On peut aussi choisir une course à l'inscription et dans « Configurer mon plan ».
- **Rappels** à J-30, J-7 et la veille :
  - sur l'accueil (compte à rebours) ;
  - par notification ;
  - dans le calendrier du téléphone (export .ics avec 3 alarmes).
- **Propositions** des coureurs et des clubs, vérifiées par l'administrateur.
- **Administration** : ajout, correction, dates contradictoires, import CSV/JSON (saison de cross FAA…). Les doublons sont reconnus automatiquement.
- **Collecte automatique sur les sites tiers : non activée.** Leurs conditions d'utilisation n'ont pas pu être vérifiées ; voir `docs/COURSES_SOURCES.md`.

## 8. Statistiques d'usage

- Événements anonymes : un identifiant aléatoire par installation, jamais le compte.
- File d'attente hors ligne, envoi groupé.
- Refus possible dans Profil › Compte et données.
- Tableau de bord administrateur : actifs par jour, 7 jours et 30 jours ; parcours ; rétention J1, J7, J30 ; fonctions utilisées ; langues ; plateformes ; taux d'installation ; versions.
- Cloudflare Web Analytics est prêt (à activer, voir les réglages manuels).

## 9. Crédibilité

- Nouvelle page **« La méthode IKORUN »**. Elle explique les règles exactes du moteur, avec les sources (Daniels, Seiler, Gabbett, Foster, Hadley, Chaouachi) et les limites.
- **Quatre plans exemples imprimables** (5 km, 10 km, semi, marathon). Ils sont produits par le vrai générateur et passent le contrôle automatique sans erreur.

## 10. Sécurité et confidentialité

- **RLS strictes** sur toutes les nouvelles tables, avec des limites anti-abus :
  - propositions : 10 par jour ;
  - suivis : 120 par heure ;
  - statut d'entraînement : 120 par heure ;
  - statistiques : 600 par heure par adresse IP, sans enregistrer l'IP.
- **Tests de sécurité** : blocs 11 à 17 dans `tests/security.sql`. Ils ont été rejoués sur une base PostgreSQL 16 locale avec les rôles anon, connecté et admin.
- **Politique de confidentialité mise à jour** : météo, courses, partage avec le club, statistiques, carte, Cloudflare.

## 11. Sous le capot

- **Code réorganisé en dossiers** : `core/`, `plan/`, `ui/`, `theme/`, `weather/`, `ramadan/`, `races/`, `share/`, `analytics/`, `method/`, `i18n/`.
- **Langues à la demande** : l'anglais et l'arabe ne sont chargés que si tu les choisis.
- **Taille du code** : le cœur de l'app passe de 1 240 à 966 Ko (−20 % une fois compressé).
- **Nettoyage** : code mort et 62 textes inutilisés retirés.
- **Correctif** : « J'ai fait autre chose à la place » dans le bilan fonctionne de nouveau (activité et durée).
- **Contrôles** :
  - suite de fumée : 131 ok ;
  - plans : 192 profils sans erreur ;
  - adaptation : 12 scénarios sur 12.
