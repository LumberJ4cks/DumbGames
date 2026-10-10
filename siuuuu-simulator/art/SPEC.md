# Planches de sprites — spécification pour SIUUUU SIMULATOR

Le jeu dessine Ronaldo et les supporters au code (`sprites.js`). Dès qu'une planche image est
présente dans ce dossier, il l'utilise à la place, pose par pose, et garde le dessin au code
pour les poses manquantes. Rien à changer dans le jeu : déposer les images, lancer le script.

## Procédure

1. Produire une image **par pose** (générateur d'images ou pixel artist), nommée comme
   ci-dessous, dans `art/sources/`.
2. Lancer `python3 art/ingest.py` (Python 3 + Pillow). Le script détoure le fond uni, recadre,
   réduit à la hauteur du jeu, quantifie la palette, ajoute le contour et écrit
   `ronaldo.png` + `ronaldo.json` et `fans.png` + `fans.json`.
3. Ouvrir le jeu : les planches sont chargées automatiquement. `?art=0` force le dessin au code
   pour comparer.

Si tu me donnes les images sources, je lance l'ingestion et je règle la palette et les ancres.

## Contraintes communes aux images sources

- Fond **uni et saturé** (vert `#00FF00` ou magenta `#FF00FF`), sans dégradé ni ombre portée
  au sol : le détourage se fait par la couleur des coins.
- Personnage **entier, centré, sans recadrage**, pieds vers le bas de l'image. Pour Ronaldo
  les pieds touchent le sol sur une même ligne (l'ancre est le milieu du bas de l'image).
- Un **seul** personnage par image, pas de texte, pas de cadre.
- Lumière venant **d'en haut à gauche**, identique sur toutes les images.
- Résolution libre (512 à 1024 px de haut va bien) : le script réduit à la taille du jeu.
  Le style doit déjà être « pixel art propre » (aplats, contours nets, peu de dégradés) pour
  que la réduction reste lisible. Pas de flou, pas d'anti-aliasing fort.
- Même **design** sur toutes les images : maillot blanc numéro 7 avec RONALDO dans le dos,
  short blanc, chaussettes blanches, crampons noirs, cheveux bruns courts gominés, tête un
  peu grosse (caricature), peau mate.

## Ronaldo (12 poses, `ronaldo-<pose>.png`)

Hauteur dans le jeu : 96 px debout. Vue de trois quarts arrière, caméra légèrement au-dessus.

| Fichier | Pose |
|---|---|
| `ronaldo-siuuu.png` | **Le SIUUU** : de dos, jambes écartées, bras tendus vers le bas et l'extérieur, tête légèrement baissée (référence : l'image pixel art de Ronaldo de dos). |
| `ronaldo-good.png` | Même pose, moins ample : bras à 45°, jambes moins écartées. |
| `ronaldo-bad.png` | Réception bancale : penché sur le côté, un bras en l'air, une jambe pliée. |
| `ronaldo-jumpback.png` | En l'air, de dos, bras levés, genoux repliés. |
| `ronaldo-jumpside.png` | En l'air, de profil (face à gauche), bras levés, genoux repliés. |
| `ronaldo-jumpfront.png` | En l'air, de face, bouche grande ouverte (il crie), bras levés. |
| `ronaldo-run1.png` | Course vers la droite, foulée ouverte (jambe avant tendue). |
| `ronaldo-run2.png` | Course vers la droite, jambes croisées (passage). |
| `ronaldo-crouch.png` | Accroupi avant le saut, bras en arrière, face à droite. |
| `ronaldo-fail1.png` | À plat ventre dans l'herbe, une jambe en l'air (image large, moitié de hauteur). |
| `ronaldo-fail2.png` | Sur le dos, jambes en l'air (image large, moitié de hauteur). |
| `ronaldo-idle.png` | Debout de dos, bras le long du corps (écran titre). |

Prompt de départ (à adapter à l'outil) :

> Pixel art sprite of a caricatured footballer seen from behind, white kit with number 7 and
> "RONALDO" printed on the back, white shorts, white socks, black boots, short dark slicked
> hair, slightly oversized head, standing with legs apart and both arms stretched down and
> outwards in the famous celebration pose, full body, centered, feet at the bottom, flat
> bright green background #00FF00, clean 16-bit pixel art, crisp outlines, flat shading,
> light from the top left, no text, no shadow on the ground.

Garder le même prompt et ne changer que la description de la pose pour les onze autres.

## Supporters (`fan-<nn>-idle.png` et `fan-<nn>-up.png`)

Hauteur dans le jeu : 36 px (tête et buste ; les jambes sont cachées par la rangée devant).
De 12 à 24 variantes numérotées `01`, `02`… Chaque variante a deux images : `idle` (bras
baissés, bouche fermée) et `up` (bras levés, bouche ouverte, même personnage). Vue de face,
cadrage de la taille au sommet de la tête. Varier fortement : âge, sexe, carnation,
coiffures, chapeaux, lunettes, barbes, maillots unis ou rayés, écharpes, drapeaux, bières,
vuvuzelas, tambours, et quelques déguisements (canard, Charlie, magicien, robot, banane…).

> Pixel art bust of a football supporter seen from the front, waist up, [description],
> arms down and mouth closed, centered, flat bright green background #00FF00, clean 16-bit
> pixel art, crisp outlines, flat shading, light from the top left, no text.

Puis la même description avec « both arms raised, mouth open, cheering » pour l'image `up`.

## Ce que fait le jeu avec les planches

- `ronaldo.json` donne, pour chaque pose, le rectangle dans `ronaldo.png` et l'ancre des
  pieds. Les poses de profil sont retournées horizontalement par le jeu quand il faut.
- `fans.json` liste les variantes ; chaque supporter du stade tire une variante au hasard
  (graine fixe par partie) et alterne `idle` / `up` quand il saute.
- Taille maximale raisonnable : 2048 px de large par planche.
