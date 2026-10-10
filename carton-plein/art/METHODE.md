# CARTON PLEIN — méthode de création des joueurs

Document de travail, à discuter avant de produire la moindre image. Objectif : une base de
départ solide pour que les premières planches soient déjà bonnes, au lieu d'itérer à l'œil.

Référence de rendu : **Barricasse** (le jeu, pas sa bannière). Référence de game design :
Nintendo World Cup. On veut des **joueurs Kunio dessinés comme des meubles de Barricasse**.

---

## 1. Ce qui fait le rendu de Barricasse (et qu'on reprend)

Observé sur une capture de jeu et dans `barricasse/sprites.js` :

1. **Des boîtes, pas des sphères.** Presque tout est un cuboïde vu de trois quarts
   (`Pix.box`) : face du dessus éclairée, arête gauche claire, arête droite et pied sombres,
   coin bas-droit en encre. L'armoire, la palette, le frigo, le canapé, les barrières :
   la même règle partout, et c'est elle qui donne la cohérence.
2. **4 à 5 tons par matière**, du bois au métal, dans Endesga 32. Le tramage n'apparaît que
   dans une bande étroite entre deux tons, jamais en motif.
3. **Contour sélectif** : encre en bas et à droite, un ton plus foncé de la matière en haut et
   à gauche. La silhouette tient sans être cernée de noir.
4. **Un sol sombre et grainé** (asphalte `slateD`/`slate` avec un pixel sur vingt plus clair)
   : les objets colorés se détachent sans effort. Le fond ne se bat jamais avec le jeu.
5. **Des ombres portées** décalées en bas à droite, assombrissement du sol (pas de noir
   posé dessus).
6. **Taille de jeu = taille de dessin.** Chaque sprite est dessiné à 1:1, ses pixels
   opaques sont sa hitbox (`test/sprite-bounds.js`). Pas de mise à l'échelle, pas de flou.
7. **Personnages en cartes de pixels** écrites à la main (le CRS, les manifestants) avec une
   légende lettre → couleur : chaque pixel est décidé, rien n'est calculé par une ellipse.
8. **Lecture d'abord** : les silhouettes sont simples, les aplats larges, un seul détail par
   objet (l'autocollant du frigo, la rayure du canapé).

### Le CRS, modèle de construction des joueurs

Le CRS de Barricasse est le personnage qui marche le mieux, et sa recette est simple :

- **Une carte de pixels écrite à la main**, 20 × 23, une lettre par pixel, légende lettre →
  couleur. Chaque pixel est voulu. Rien n'est calculé.
- **Deux tons par matière, plus un point de lumière** : casque `slateD`/`slate` avec deux
  pixels `grey2` en haut à gauche, corps `slateD`/`slate`, visage `skinL`/`skin`. La rampe de
  4 existe, mais sur une zone on en pose deux ; le troisième fait l'arête, le quatrième le
  reflet. C'est ça qui donne le côté net et massif.
- **Une silhouette rectangulaire** : casque en dalle, épaules carrées, jambes en deux colonnes,
  bouclier en boîte. Les seuls arrondis sont des coins coupés d'un pixel.
- **Un accent par personnage** : la visière `cyan`/`blue`, la bande blanche sur le torse, la
  boucle `amber` de la ceinture. Trois points de couleur vive sur un personnage sombre : il se
  lit de loin.
- **Le bob d'un pixel** pour l'animation d'attente, les jambes redessinées pour la marche.

Les joueurs de Carton Plein suivent cette recette, à 32 px au lieu de 23, avec les maillots à
la place de l'accent.

Ce qu'on **ne reprend pas** : la taille des personnages (16×22, tête de 6 px). Pour ce jeu il
faut lire les visages et les cartons : 32 px, tête Kunio.

Ce qu'on **abandonne** du prototype précédent (`proto.mjs`, planche v0.3) : les têtes en
ellipse ombrée et les membres en cylindre. C'est ça le « trop rond ». Le prototype reste
utile pour une chose : il a validé les proportions 32 px et la densité à treize joueurs.

---

## 2. Palette : profondeur et rampes

**Palette unique Endesga 32.** Pas de couleur hors palette, y compris pour le feu et les
effets.

**4 tons par matière** (décision), numérotés 1 (ombre) à 4 (lumière). Le ton 1 ne sert
jamais d'aplat sur un personnage : il sert aux arêtes sombres et au contour haut-gauche.
Le ton 4 ne sert qu'aux faces du dessus et aux arêtes gauches. **L'aplat, c'est le ton 2 ou 3.**
Dit autrement : sur un joueur, on voit surtout deux tons, les deux autres dessinent le volume.

### Rampes du jeu

| Matière | 1 ombre | 2 | 3 | 4 lumière | Usage |
|---|---|---|---|---|---|
| peau claire | clay | skin | skinL | cream | |
| peau mate | brown | clay | skin | skinL | |
| peau foncée | plum | brown | clay | skin | |
| cheveux bruns | plum | brown | clay | tan | |
| cheveux noirs | ink | slateD | slate | grey3 | |
| cheveux blonds | clay | tan | amber | yellow | |
| cheveux roux | brown | rust | tan | amber | |
| cheveux gris | grey3 | grey2 | grey1 | white | arbitre, staff |
| bleu France | slateD | blueD | blue | cyan | maillot |
| blanc | grey3 | grey2 | grey1 | white | short France, rayures Paraguay, lignes |
| rouge Paraguay | plum | redD | red | pink | maillot, chaussettes France |
| bleu Paraguay | slateD | blueD | blue | cyan | short (même rampe que France : à trancher, voir §8) |
| noir | ink | slateD | slate | grey3 | arbitre, crampons |
| jaune | rust | orange | amber | yellow | gardien, carton, brassard arbitre |
| pelouse | teal | greenD | greenM | green | voir §6 |
| feu | redD | red | orange | amber | + yellow et white en cœur : 6 tons, seule exception (§7) |

Règle de contraste : les trois maillots qui se croisent (France, Paraguay, arbitre) doivent
rester distincts **en niveaux de gris**. Bleu France (blue, clair), rouge Paraguay rayé de
blanc (moyen, cassé par les rayures), arbitre noir avec brassard et col jaunes (sombre, point
chaud). Test à faire sur la première planche : la convertir en gris.

---

## 3. Le gabarit du joueur : des briques

Hauteur **32 px**, largeur **24 px** bras compris, ancre aux pieds, 2 px de marge pour le
contour. Vue de face légèrement de dessus : on voit le dessus de la tête et des épaules
(c'est là que vont les faces éclairées), les pieds sont courts.

Toutes les parties sont des **rectangles aux coins coupés d'un pixel**, jamais des ellipses.

| Partie | Taille | Position (depuis le sol) | Remarques |
|---|---|---|---|
| Tête | 14 × 11 | rangées 21 à 31 | Coins coupés de 1 px en haut, de 1 px en bas. Elle mord d'un pixel sur le buste. |
| Cheveux | 14 × 4 + frange | rangées 28 à 31 | Une **dalle** posée sur la tête, pas une calotte : face du dessus éclairée (ton 4), frange en zigzag d'un pixel sur la rangée 27, pattes de 1 × 3 sur les côtés. |
| Buste | 12 × 7 | rangées 13 à 19 | Épaules carrées. Rangée du haut = face du dessus des épaules (ton 4). |
| Bras | 3 × 6 chacun | rangées 13 à 18, collés au buste | Mains : 3 × 2 en peau, ton 2. |
| Short | 12 × 4 | rangées 9 à 12 | Même largeur que le buste. Pas de taille marquée. |
| Jambes | 4 × 7 chacune | rangées 3 à 9, espacées de 2 px | Cuisse en peau sur 3 rangées sous le short, chaussette sur 4. |
| Crampons | 5 × 2 chacun | rangées 0 à 2 | Dépassent d'un pixel devant la jambe. Ton 2 dessus, ton 1 dessous. |

Proportions : tête 45 % de la hauteur, buste + short 35 %, jambes 20 %. La largeur de la
tête dépasse celle du buste de 1 px de chaque côté : c'est ce qui fait « Kunio ».

### La règle d'éclairage de la brique

Pour **chaque** rectangle de matière, sans exception, les mêmes quatre règles (reprise de
`Pix.box` de Barricasse) :

1. **Rangée du haut** : ton 4. C'est la face du dessus, vue de trois quarts.
2. **Colonne de gauche** : ton 3 (si la brique fait au moins 3 px de large).
3. **Colonne de droite et rangée du bas** : ton 1.
4. **Intérieur** : ton 2 avec un dégradé vertical vers le ton 3 dans le tiers supérieur,
   tramé seulement sur la rangée de transition.
5. Coin bas-droit : encre. Coins hauts : coupés (transparents) si la brique fait 6 px ou plus.

Quand deux briques de la même matière se touchent (short sous buste, deux jambes), l'arête
entre elles reste : c'est elle qui sépare les volumes. Quand une brique est devant une autre
(bras devant buste), la brique de derrière reçoit une **ombre portée** d'un pixel, un ton plus
foncé, à droite et en dessous de la brique de devant.

### Le visage

- Yeux : 2 × 2 en encre, 1 px blanc en haut à gauche. Espacés de 4 px, sur la rangée 25.
- Bouche : 2 × 1 en redD, rangée 22. Ouverte (2 × 2 avec ink) quand le joueur crie.
- Pas de nez. Sourcils : 1 rangée de la matière cheveux au-dessus des yeux, seulement pour
  les expressions (colère de l'arbitre, douleur).
- Barbe : la moitié basse de la tête repasse en matière cheveux, ton 2, en gardant la bouche.
- Bandeau du n°4 : rangée 27 entière en rouge ton 3, par-dessus la frange.

---

## 4. Méthode d'écriture : deux calques écrits à la main

C'est le cœur de la méthode, calée sur le CRS : **chaque pixel est décidé à la main**. Ce qu'on
ajoute au CRS, c'est la possibilité de changer de maillot et de peau sans redessiner, parce
qu'il y a onze Français, un gardien, un arbitre, un Paraguayen et des remplaçants de fortune
qui partagent les mêmes poses.

Pour ça, une pose n'est pas une carte mais **deux calques alignés**, de même taille
(28 × 36 : 24 × 32 plus marges) :

### 4.1 Calque A : les matières

Une lettre par pixel, qui dit **de quoi** est fait le pixel, pas sa couleur. La couleur est
résolue au rendu par le look (peau, cheveux) et le kit (maillot, short, chaussettes).

| Lettre | Matière | Résolue par |
|---|---|---|
| `H` | cheveux | look |
| `S` | peau | look |
| `J` | maillot | kit |
| `R` | short | kit |
| `C` | chaussettes | kit |
| `B` | crampons | kit (toujours noir en V1) |
| `E` | œil (encre) | fixe |
| `W` | reflet d'œil (blanc) | fixe |
| `M` | bouche | fixe |
| `.` | transparent | |

### 4.2 Calque B : les tons

Un chiffre par pixel, de `1` (ombre) à `4` (lumière), qui dit **quel ton de la rampe** de sa
matière prend ce pixel. C'est le calque qui fait le CRS : deux tons dominants, les arêtes en
`1`, les points de lumière en `4`, et c'est l'auteur qui les place.

Le code **propose** un calque B de départ en appliquant la règle de la brique (§3) à chaque
zone du calque A : rangée du haut `4`, colonne gauche `3`, droite et bas `1`, intérieur `2`.
L'auteur **corrige** ensuite à la main, pixel par pixel, et c'est le calque corrigé qui est
versionné. Le code ne recalcule jamais un calque B existant.

Exemple, la tête de face (14 px, rangées 31 à 21), les deux calques côte à côte :

```
matières            tons
..HHHHHHHHHHHH..    ..444444444443..
.HHHHHHHHHHHHHH.    .32222222222221.
.HHHHHHHHHHHHHH.    .32222222222221.
.HHHHHHHHHHHHHH.    .32222222222221.
.HSHSHSHSHSHSHH.    .33333333333331.    <- frange en zigzag, peau ton 3
.HSSSSSSSSSSSSH.    .23333333333221.    <- pattes
.HSSSSSSSSSSSSH.    .23333333333221.
..SSEESSSSEESS..    ..331133331132..
..SSEESSSSEESS..    ..331133331132..
..SSSSSSSSSSSS..    ..333333333322..
..SSSSSMMSSSSS..    ..333321123322..
...SSSSSSSSSS...    ...2222222221...
```

Sur la peau, deux tons (`3` aplat, `2` côté droit et menton) et des `1` seulement sous les
yeux et à l'arête : exactement le visage du CRS.

### 4.3 Calque C : les détails

Certains pixels ont une couleur fixe quel que soit le kit : rayures du
maillot Paraguay, numéro, bandeau, col de l'arbitre, reflets. Ils vont dans une **seconde
carte** de même taille, avec des lettres explicites `ton` : `j1`…`j4` n'étant pas écrivables
en une lettre, on utilise une légende locale par carte (`a`, `b`, `c`… → couleur précise),
exactement comme Barricasse. Ce calque est posé après la résolution des deux premiers, avant le contour.

### 4.4 Le contour

Sélectif, comme Barricasse : encre en bas et à droite de la silhouette, ton 1 de la matière
touchée en haut et à gauche. Pas de contour noir complet (testé sur la planche v0.3 : il
« gagne » sur la pelouse claire, mais il va contre le rendu Barricasse ; on gagne la lecture
autrement, avec une pelouse plus sombre, §6).

### 4.5 Les orientations

Quatre, comme Nintendo World Cup : **face, dos, profil droit, profil gauche** (miroir du
droit, sauf le numéro et le bandeau qui sont recalculés, pas miroités). Le dos est la vue
la plus fréquente : les Français courent vers ton but, tu les poursuis. Le dos porte le
numéro, grand (5 × 7), c'est là qu'on lit qui est qui.

Pour chaque orientation, les poses :

| Pose | Images | Note |
|---|---|---|
| idle | 2 | respiration : la tête descend d'un pixel |
| course | 4 | foulée Kunio : jambes très écartées sur 1 et 3, bras en opposition |
| poing | 2 | armé, tendu |
| coude | 1 | |
| projection | 3 | saisie, bascule, lâcher |
| tacle | 2 | glissade jambe tendue, puis à plat |
| étourdi | 2 | étoiles au-dessus, yeux en croix |
| au sol | 1 | profil, par quart de tour de la carte « étourdi » puis retouche à la main |
| porté sur civière | 1 | |
| poignée de main | 2 | |

Français et n°4 partagent toutes les cartes ; le n°4 a en plus **en feu** (§7), qui n'est pas
une pose mais une couche derrière lui.

---

## 5. Ombres

Ombre portée **rectangulaire** aux coins coupés, 12 × 4 sous les pieds, décalée de 2 px à
droite et 1 px en bas, obtenue en assombrissant la pelouse d'un ton (jamais une tache posée
dessus). Quand un joueur vole après un tacle, l'ombre reste au sol et rétrécit : c'est ce qui
donne la hauteur. Comme les meubles livrés de Barricasse.

---

## 6. La pelouse

C'est le sol de Barricasse transposé : **plus sombre que ce qu'on attend d'une pelouse**, pour
que les maillots portent.

- Bandes de tonte de 24 px : `greenD` et `greenM` en alternance (et non `greenM`/`green`
  comme sur la planche v0.3, trop claire).
- Grain : un pixel sur vingt un ton plus clair, réparti par hachage fixe (pas de bruit animé).
- Lignes du terrain en `grey1`, pas en blanc pur : le blanc est réservé aux shorts, aux
  rayures et aux yeux.
- Mottes arrachées par les tacles : briques 3 × 2 en `brown`/`clay`, face du dessus `sand`,
  qui restent au sol jusqu'à la fin du match.

À valider sur la première planche : la densité du grain à 1:1, et le contraste du bleu
France sur `greenD`.

---

## 7. Le FUEGO : une vraie flamme derrière le joueur

Ce qu'il y avait sur la planche v0.3 (quelques pixels orange au-dessus de la tête) n'est pas
une flamme. Le modèle est **l'aura de puissance de Dragon Ball Z** : une flamme qui enveloppe
tout le corps, part des pieds, monte au-dessus de la tête, et se détache en langues.
(Si tu as une référence précise de style de flamme en pixel art, elle m'intéresse ; pour la
forme DBZ, c'est clair.)

### Forme

- Une **couche derrière le joueur**, dessinée avant lui, de 40 × 52 px : 1,6 fois sa hauteur,
  1,7 fois sa largeur.
- Silhouette en **goutte renversée**, large aux pieds (toute la largeur), qui se resserre à
  mi-corps puis se divise au-dessus de la tête en **trois à cinq langues** de hauteurs
  différentes, la centrale la plus haute.
- Dessinée **en briques** elle aussi : chaque langue est un empilement de rectangles de
  largeur décroissante, par paliers de 2 px. Pas de courbe. C'est ce qui l'accorde au reste.

### Couleurs, de l'extérieur vers le cœur

| Couche | Ton | Épaisseur |
|---|---|---|
| bord | redD | 1 px |
| extérieur | red | 2 à 3 px |
| milieu | orange | 3 à 4 px |
| intérieur | amber | 3 px |
| cœur, collé au corps | yellow | ce qui reste |
| étincelles | white | pixels isolés, 4 à 6 par image |

Six tons : la seule matière du jeu à en avoir plus de quatre, parce qu'elle doit se lire
comme de la lumière, pas comme de la matière.

### Animation

- **4 images à 12 images par seconde.** D'une image à l'autre, les langues montent de 2 px et
  les plus hautes se détachent en **particules** (briques 2 × 2 puis 1 × 1, amber puis red)
  qui s'éteignent au-dessus.
- La flamme **penche à l'opposé du déplacement** (4 px de décalage de la pointe), et se
  couche vers l'arrière pendant le tacle enflammé.
- Le joueur lui-même change : son contour bas-droit passe de l'encre à `redD`, sa face du
  dessus (cheveux, épaules) passe au ton 4 de la matière + 1 px `yellow` aux coins : il est
  éclairé par en dessous et par derrière.
- Au sol : un **halo** sur la pelouse, deux tons plus clairs dans un rectangle 20 × 6 sous les
  pieds, et une **traînée** de pelouse brûlée (`brown`, puis `plum` quand elle refroidit) qui
  reste jusqu'à la fin du match.
- Déclenchement : 6 images d'allumage où la flamme jaillit des pieds vers le haut avant de
  prendre sa forme ; extinction en 6 images où elle s'effondre en particules.

### Lecture

À 1:1, un joueur en feu doit être identifiable **au premier coup d'œil sur tout l'écran**,
même dans un tas. La flamme est l'élément le plus lumineux du jeu : rien d'autre n'utilise
`yellow` en aplat, sauf le gardien, qu'on changera de couleur si ça gêne (§8).

---

## 8. Le carton jaune : un marqueur de cible

Le carton rouge **n'a pas de design** : le joueur sort, il n'est plus là. Son seul moment est
l'animation de sortie (il part en protestant vers la touche, le remplaçant entre).

Le carton jaune est un **élément d'interface posé dans le monde**, pas un détail du sprite :

- Dessiné dans une passe au-dessus de tous les joueurs (sinon le joueur du rang précédent le
  cache, constaté sur la planche v0.3).
- Brique 6 × 8 en `yellow` avec face du dessus `white`, arête droite `amber`, contour encre
  complet (le seul contour noir complet du jeu, justement parce que c'est de l'interface).
- Il **flotte** 4 px au-dessus de la tête et rebondit d'un pixel toutes les demi-secondes.
- Quand le n°4 est à portée de ce joueur, le carton **clignote** entre `yellow` et `white` :
  c'est lui qu'il faut frapper.
- Sur le joueur au sol, le carton reste au-dessus de lui, couché.

---

## 9. Protocole de validation, dans l'ordre

Chaque étape produit une planche nommée, regardée à 1:1 **et** à 3×, et comparée côte à côte
avec la capture de Barricasse. On ne passe à l'étape suivante que si la précédente est validée.

| Étape | Planche | Ce qu'on valide | Critère |
|---|---|---|---|
| 1 | `01-palette.png` | Les rampes du §2 en pavés, plus la version en gris | Les trois maillots distincts en gris |
| 2 | `02-brique.png` | Un seul Français, idle de face, calques A/B/C écrits à la main, avec le CRS à côté | Posé à côté du CRS de Barricasse, même famille |
| 3 | `03-kits.png` | Le même, en France, Paraguay, arbitre, gardien, staff | Lecture à 1:1 sur `greenD` |
| 4 | `04-looks.png` | Onze Français différents, idle | Reconnaissables sans numéro |
| 5 | `05-orientations.png` | Face, dos, profil, un look | Le numéro dans le dos se lit |
| 6 | `06-course.html` | Cycle de course animé, dans le navigateur | Pas de glissement des pieds |
| 7 | `07-scene.png` | Demi-terrain, treize joueurs, cartons jaunes, ombres, mottes | Densité d'un coup franc lisible |
| 8 | `08-fuego.html` | La flamme animée derrière le n°4, immobile puis en course | Visible d'un coup d'œil sur tout l'écran |
| 9 | `09-mma.png` | Poing, coude, projection, tacle, étourdi, au sol | Chaque pose lisible sans popup |

L'outil : `carton-plein/art/sheet.mjs` (à écrire, remplaçant `proto.mjs`), qui prend le numéro
d'étape en argument et rend la planche en Node, comme `cons-de-mime/test/sheet.mjs`.

---

## 10. Questions à trancher ensemble

1. **Short du Paraguay** : bleu comme le maillot français, c'est la vraie tenue, mais ça
   brouille à 1:1. Option : short noir ou blanc pour le Paraguay en V1.
2. **Gardien français en jaune** : entre en concurrence avec le feu et le carton. Option :
   gardien en vert `green`/`cyan`, ou en violet `purple`/`magenta` (rampe libre).
3. **Face du dessus de la tête** : la dalle de cheveux au ton 4 sur toute la rangée fait un
   casque. Option : ton 4 sur la moitié gauche seulement, ton 3 à droite.
4. **Contour** : sélectif (Barricasse) ou noir complet (planche v0.3) pour les personnages.
   Je propose sélectif + pelouse sombre, à confirmer à l'étape 3.
5. **Flamme** : purement en briques (paliers de 2 px) ou avec des diagonales d'un pixel sur
   les bords des langues. Les briques sont plus cohérentes, les diagonales plus vivantes.
   À trancher à l'étape 8 avec les deux versions côte à côte.
