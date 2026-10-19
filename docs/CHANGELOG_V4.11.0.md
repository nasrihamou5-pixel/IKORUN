# IKORUN v4.11.0 — Création des plans « une question par écran »

La création du plan de course et l'assistant « Nouveau plan » (course + muscu) suivent la même logique que l'inscription (v4.10.0, style KORE).

## Configurer mon plan (course)
Ta situation → (pause depuis… / niveau) → ta course → date, distance, terrain → objectif (finir / chrono, allure au km et prédiction) → tes jours (+ jour de sortie longue, volume automatique) → récapitulatif → construction.
- 1re génération : ce que l'inscription a donné (course, date, objectif, niveau) n'est pas redemandé ; il apparaît au récap, une ligne touchée le rouvre.
- Nouveau : choix du jour de la sortie longue (Auto par défaut).
- Croix en haut à droite pour quitter sans rien changer.

## Nouveau plan (course + muscu)
Quoi (les deux ensemble / séparément / running / muscu) → plan de course actuel (nouveau / garder) → comment (générateur / moi-même) → jours de muscu → matériel → récapitulatif → construction.
- « Les deux » avec un nouveau plan de course : enchaîne sur « Configurer mon plan », puis la muscu se génère dans la même construction.
- « Modifier » la muscu ouvre directement sur les jours.

## Technique
- Nouveau moteur commun `ui/flow.js` (ikFlow) ; l'inscription (`ui/onboarding.js`) l'utilise aussi.
- `ui/plan-flow.js` : `psFlowOpen()` (appelé par `openPlanSetup`) et `wzFlowOpen()` (appelé par `openWizard`). Le calcul des plans ne change pas (`confirmPlanSetup`, `wizGenerate`).
- 70 nouvelles clés `pf2*` FR / EN / AR.
- Versions : app 4.11.0, `app.min.js?v=160`, `app.min.css?v=68`, langues `v=15`, cache `ikorun-v146`.
