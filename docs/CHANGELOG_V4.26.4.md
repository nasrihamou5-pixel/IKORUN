# V4.26.4

## Bibliothèque — l'app redémarrait en y entrant

- La liste construisait ses 887 exercices d'un seul bloc : 540 Ko de HTML et 887 images posées
  d'un coup dans la page. Sur iPhone, le pic de mémoire faisait tuer l'onglet par iOS — l'app
  « redémarrait » à l'entrée dans la bibliothèque (et en boucle hors connexion, les 887 images
  échouant ensemble). La liste affiche maintenant 60 exercices, la suite arrive au défilement.
  Au départ : 35 Ko de HTML et 60 images au lieu de 540 Ko et 887.
- Le bouton « vue liste », à côté de la vue grille, n'avait pas d'icône : il est maintenant visible.

## Gestes des fenêtres

- Les menus de choix (Matériel, Type, Niveau) et les confirmations se ferment maintenant en les
  glissant vers le bas ou en glissant depuis le bord gauche, comme les autres fenêtres de l'app.
  Avant, aucun des deux gestes ne marchait sur ces fenêtres.
- Le geste « retour » depuis le bord gauche, qui ne fonctionnait que sur les pages plein écran,
  ferme aussi les fenêtres du bas.
- Les formulaires (profil, programme, réglage d'exercice, saisie) restent volontairement exclus :
  fermeture volontaire uniquement, pour ne jamais perdre une saisie.
