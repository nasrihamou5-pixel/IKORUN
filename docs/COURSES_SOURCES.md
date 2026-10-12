# Calendrier des courses : sources et collecte automatique

*Vérification du 12 octobre 2026, IKORUN V4.0.0.*

## Ce que le cahier des charges demandait

Une fonction serveur planifiée chaque jour, qui récupère les courses sur les sites suivants, mais **seulement si leur `robots.txt` et leurs conditions d'utilisation l'autorisent** :

- finishers.com/ou-courir/afrique/algerie ;
- ahotu.com/fr/calendrier/algerie ;
- le site de la Fédération algérienne d'athlétisme.

## Ce qui a été vérifié

| Source | `robots.txt` | Conditions d'utilisation | Résultat |
|---|---|---|---|
| finishers.com | Non lisible : le site est injoignable depuis l'environnement de développement (proxy 403, DNS bloqué). | Introuvables par la recherche web. | **Non vérifiable** |
| ahotu.com | Non lisible (même cause). | Introuvables par la recherche web. | **Non vérifiable** |
| FAA | Pas de site officiel identifié avec un calendrier en ligne. | — | **Pas de source exploitable** |

Finishers et Ahotu sont deux agrégateurs commerciaux. Leur valeur tient à leur base de courses, et ce type de site interdit en général l'extraction automatique dans ses conditions d'utilisation. Rien n'a pu prouver le contraire ici.

## Décision

**La collecte automatique n'est pas livrée.** Aucune fonction ne lit ces sites, et aucune tâche planifiée n'est créée pour ça. La règle du cahier des charges (« seulement si autorisé ») n'est pas remplie, puisque l'autorisation n'a pas pu être établie.

Le calendrier se remplit donc par trois voies, toutes livrées :

1. **Saisie admin** : Courses › Gérer le calendrier › Ajouter.
2. **Propositions** des coureurs et des clubs :
   - formulaire réservé aux comptes (pas aux invités), 10 propositions par jour au plus ;
   - chaque proposition est vérifiée par un admin, qui peut l'accepter, la corriger puis l'accepter, ou la refuser avec un motif.
3. **Import CSV ou JSON** (par exemple la saison de cross FAA, à partir du calendrier papier ou PDF de la ligue) :
   - un aperçu montre les nouvelles courses, les doublons, les dates contradictoires et les lignes invalides avant d'écrire quoi que ce soit.

Le dédoublonnage et le signalement des dates contradictoires sont faits par le serveur (`ikorun_race_upsert`), pour les trois voies.

## Si l'autorisation est obtenue plus tard

Il faut une autorisation écrite de l'éditeur, ou des conditions d'utilisation qui permettent explicitement la réutilisation. Ensuite :

1. Lire `https://<site>/robots.txt` et vérifier que les pages du calendrier ne sont pas en `Disallow` pour `User-agent: *`.
2. Garder la preuve (capture des conditions, courriel) dans ce dossier.
3. Ajouter une Edge Function qui :
   - lit les données structurées publiées (JSON-LD `schema.org/Event`), pas la mise en page ;
   - s'identifie (`User-Agent: IKORUN-calendar (+https://ikorun.pages.dev)`), fait une requête par seconde au plus et une passe par jour ;
   - envoie chaque course dans `ikorun_race_upsert(p, 'import')`, qui gère déjà doublons et contradictions.

## Courses repérées, à vérifier puis saisir à la main

Ces courses sont trouvées par une recherche web. **Elles ne sont pas dans l'app**, car leur date n'est pas confirmée par l'organisateur :

- Semi-marathon international d'Alger : annoncé pour le 18 décembre 2026 (10 km et 21,1 km). Inscriptions sur le site de la Ligue algéroise d'athlétisme, date limite 2026 à confirmer.
  - Sources : spart-dz.com, page Facebook « Algiers Half Marathon ».
- Semi-marathon international de la ville de Béjaïa : listé pour le 16 octobre 2026.
  - Source : ahotu.com, listing seulement.
- Sahara Marathon (Tindouf) : marathon, semi, 10 km et 5 km ; date 2026-2027 non trouvée.
  - Source : marathons.com.

## Format d'import

CSV séparé par `;` ou `,`, première ligne = en-têtes. Les en-têtes sont reconnus en français ou en anglais :

```
nom;date;heure;ville;wilaya;type;distances;organisateur;site;inscription;source
Cross de la wilaya;10/01/2027;09:30;Oran;31;cross;4|8;Ligue d'athlétisme;https://…;;https://…
```

- `date` : `AAAA-MM-JJ` ou `JJ/MM/AAAA`.
- `wilaya` : numéro (1 à 58) ou nom.
- `type` : route, cross, trail, piste, ultra, marche, autre.
- `distances` : en km, séparées par `|` dans un fichier.
- Liens : `https://` uniquement.
- 500 lignes au plus par import.

JSON : une liste d'objets avec les mêmes clés (`name`, `date`, `city`, `wilaya`, `kind`, `distances`…).
