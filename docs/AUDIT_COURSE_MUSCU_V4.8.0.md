# Audit des liens course ↔ muscu (V4.8.0)

## Cartographie
| Sens | Qui lit | Qui écrit | Où |
|---|---|---|---|
| course → muscu | `strengthBuild` lit `PLAN.sessions` (phase et décharge de chaque semaine → schéma de séries ; jours durs → placement des jambes ; date de course → affûtage et fin) | `STRENGTH.sessions` | plan/strength.js (`runWeekInfo`, `placeWeek`, `validateStrengthPlan`) |
| course → muscu | `strengthRelink` (nouveau plan de course), `strengthCheckRun` (après chaque ajustement, `adPersist`) | `STRENGTH.sessions` (séances futures seulement) | ui/sport-combo.js |
| muscu → course | `adaptAfterMuscu` (via `strengthAfterLive`, après une séance live ou « Je l'ai faite ») lit `legsHeavy` | `PLAN.sessions` par `adaptApply` (copie, validation, journal, « Annuler ») | plan/strength-adapt.js |
| muscu → course (**nouveau**) | `planBuild` lit les jours de jambes de `STRENGTH` (ou `wiz.days` pendant l'assistant) | `assignWeek` évite ces jours pour les séances dures et la sortie longue | app.js |
| blessure | `injuryDaily`, `injApplyAll` | muscu (rééducation) et course (étapes) | plan/injury.js |

## Défauts trouvés et corrigés
1. **Qualité sacrifiée en continu** : le placement interdit les jambes la veille d'une séance dure, mais `adaptAfterMuscu` surveillait 2 jours — une séance dure à J+2 d'une séance de jambes (autorisé) devenait un footing de 8 km à chaque fois. Fenêtre ramenée à 1 jour, au plus une fois tous les 4 jours.
2. **Course aveugle à la muscu** : `planBuild` ne lisait jamais `STRENGTH` ; seul le sens muscu → course existait. Ajout du sens inverse (pénalité de placement).
3. **Rééducation perdue au recalage** : `strengthRelink` recréait les séances futures sans réappliquer la blessure en cours.
4. **Muscu indifférente au niveau** : le niveau ne filtrait que le catalogue ; il règle maintenant aussi les séries des exercices principaux. Effort visé et repos ajoutés par exercice.

## Vérifié (harnais, 261 plans liés, 1 921 séances de jambes lourdes)
- a) jamais de jambes lourdes un jour de séance clé ni la veille : **0**
- b) aucune séance de muscu après la veille de la course ; aucune jambe lourde à J-5 ou moins : **0**
- c) un allègement par `adaptAfterMuscu` apparaît toujours au journal : **0 silencieux** ; qualité sacrifiée à J+2 : **0** (avant : 6)
- d) régénération du plan de course : séances faites et passées conservées (**0 perdue**), pas de doublon de date, plan de muscu valide
- e) deux sens : séances dures sur un jour de jambes ou le lendemain 22 % → 13 %
