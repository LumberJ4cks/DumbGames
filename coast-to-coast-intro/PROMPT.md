# Prompt complet — intro Coast to Coast (HyperFrames)

> À coller dans une nouvelle conversation, **avec les 5 style frames en pièces jointes, dans cet ordre** :
> 1. MAIS PAS SEUL (Rafa, handball)
> 2. MONT ROYAL (trois bandes photo + lande)
> 3. 40 ans SANS. (lettres photo)
> 4. NEW YORK (Julie et Freddy)
> 5. D'UNE MER À L'AUTRE (galet + Robin Hood's Bay)

---

Crée avec HyperFrames une animatique motion design de l'intro d'un documentaire de voyage père-fils (la Coast to Coast en Angleterre). Format 1920×1080, 30 fps, 118 secondes, sans audio : la voix off et la musique (*Paris*, Else) seront ajoutées au montage.

Avant d'écrire du code, vérifie ton environnement : `node -v` (Node 22 ou plus), `ffmpeg -version`, et accès réseau à npm, jsDelivr et Google Fonts. Initialise le projet avec `npx hyperframes init coast-to-coast-intro` et respecte les conventions HyperFrames :
- un `#root` avec `data-composition-id`, `data-start="0"`, `data-duration="118"`, `data-width="1920"` et `data-height="1080"` ;
- les éléments minutés ont la classe `clip` ainsi que `data-start`, `data-duration` et `data-track-index` ;
- une timeline GSAP créée en `{ paused: true }` et enregistrée dans `window.__timelines["coast-to-coast-intro"]`.

Vérifie ton travail avec `npx hyperframes preview`, puis avec des captures d'images clés (Playwright) à chaque étape, avec les **vraies** polices chargées. Termine par `npx hyperframes render`.

## 1. Références et médias

Les 5 images jointes sont des style frames validés. Reproduis fidèlement leur composition, mais reconstruis tout en calques natifs :
- la typographie en vrai texte HTML ;
- la ligne rouge en élément vectoriel (SVG) ;
- le fond papier en CSS ;
- le ticket, le scotch, le badge et le bord déchiré en CSS.

Les photos de référence font 1672×941 px. Pour passer en 1080p, multiplie par 1,1483.

Pour chaque photo, recadre la zone correspondante de la référence avec Python/PIL et utilise-la comme calque photo provisoire : je la remplacerai par mes vraies photos. Si la photo est inclinée, redresse-la d'abord (rotation inverse autour du centre du cadre), recadre l'intérieur sans la marge blanche, puis réapplique l'inclinaison en CSS. Si une référence montre un objet par-dessus la photo (un badge, par exemple), retouche cette zone pour qu'il ne soit pas imprimé dans la photo.

Les éléments détourés qui débordent des cadres sont des calques séparés nommés `POPOUT_...` : têtes, main, bras et ballon. Recadre-les grossièrement depuis la référence redressée : PNG avec alpha, polygone à main levée et bord adouci de 2 px. Leur partie basse doit rester **opaque sur toute la marge blanche du cadre** ; le fondu vers la transparence ne commence qu'à l'intérieur de la photo, sinon une bande blanche traverse les visages. Positionne chaque POPOUT dans le repère du cadre photo, comme enfant du cadre, pour qu'il suive l'entrée et l'inclinaison de la photo.

Nomme chaque calque clairement, et donne au fichier le même nom que le calque qui l'utilise :

| Calque | Contenu |
|---|---|
| `SCENE_01_photo_escaliers` | escaliers de secours |
| `SCENE_01_photo_couple` | selfie Julie et Freddy |
| `POPOUT_SCENE_01_tetes` | les deux têtes |
| `SCENE_01_photo_nous` | placeholder gris |
| `SCENE_02_photo_gauche` / `_centre` / `_droite` | les trois bandes |
| `POPOUT_SCENE_02_tete_homme` | l'homme qui se retourne |
| `SCENE_02_photo_lande` | la lande déchirée |
| `SCENE_03_photo_gauche` | St Bees, la main et le galet |
| `POPOUT_SCENE_03_main_galet` | la main et le galet |
| `SCENE_03_photo_droite` | Robin Hood's Bay |
| `SCENE_04_interview` | placeholder 16:9, futur `<video>` |
| `SCENE_04_lettre_S1` / `_A` / `_N` / `_S2` | une photo par lettre de SANS ; comble les zones de papier de la référence par diffusion |
| `SCENE_05_photo_rafa` | Rafa |
| `POPOUT_SCENE_05_bras_ballon` | le bras et le ballon |

## 2. Direction artistique

- **Fond** : papier gris chaud `#E9E4DA`. Ajoute de légères variations de ton (grands dégradés radiaux, en multiply, répétés le long de la bande) et un grain fin. Le grain est un bruit SVG `feTurbulence` en data-URI, posé en overlay `mix-blend-mode: multiply` à faible opacité. Il est attaché à la bande du monde : il défile avec le papier.
- **Titres** : Anton, noir `#1C1C1C`, en capitales, avec une texture d'encre imprimée : un `mask-image` de bruit qui ronge légèrement les lettres.
  - Le masque coupe tout ce qui dépasse de la boîte. Agrandis donc la boîte masquée avec `padding: 140px; margin: -140px`, pour ne rogner ni accents ni jambages. Pour un titre centré, la boîte doit faire la largeur du texte, pas celle du calque.
  - Utilise `text-box: trim-both cap alphabetic` pour que la boîte de chaque titre corresponde exactement à la hauteur des capitales. Pour chaque titre, je donne la hauteur de capitale cible : mesure-la à l'écran et ajuste le `font-size`.
- **Petits textes** : Special Elite (machine à écrire) et Courier Prime (légendes), noir, petits.
- **Annotations** : Caveat, noir, avec de fines flèches dessinées au trait (SVG, `stroke` 2,6 px, extrémités rondes, pointe ouverte en V).
- **Photos** : marge blanche `#F7F4EE` de 14 px, ombre portée douce (`0 12px 26px rgba(48,36,22,.22)` + `0 2px 5px rgba(48,36,22,.2)`) et légère inclinaison. Ajoute du scotch kraft semi-transparent (`rgba(196,165,114,.55)`, multiply, bouts déchirés) quand la référence en montre.
- **Couleur d'accent** : une seule, le rouge `#D7261E`, réservé à la ligne.

## 3. La ligne rouge (règle absolue)

Il n'y a qu'**une seule ligne rouge**, de 6 px, au trait net (`butt`). Elle est **toujours exactement à y = 540 px** et ne s'interrompt jamais, du début à la fin. Si une référence la montre à une autre hauteur, recompose la scène.

- **Dessin** : elle se dessine de gauche à droite par `stroke-dashoffset`.
- **Caméra** : toutes les scènes sont posées côte à côte sur une longue bande horizontale (`#world`). La caméra suit la ligne : les transitions sont des travellings latéraux qui suivent sa pointe.
- **Superposition** : la ligne passe sous les photos, qui la masquent, et réapparaît de l'autre côté. Pas de boucle, pas de flèche.
- **Masques** : derrière « SANS. », il n'y a aucune photo pour cacher la ligne ; masque-la avec un `<mask>` SVG sur la zone du mot.
- **Ondulation** : la seule exception à la ligne droite est la carte « prise de conscience ». Petites ondulations irrégulières d'environ 6 px au maximum (somme de 3 sinus sous une enveloppe), sur environ 1 400 px.
- **Dédoublement** : derrière la photo de Rafa, elle se dédouble en deux lignes identiques à y = 520 et y = 560.

## 4. Implémentation (pièges à éviter)

- **Pointe de la ligne** : décris-la par une liste d'images-clés `[temps, x monde, ease]`. Convertis chaque segment en tweens d'attribut `stroke-dashoffset` : un pour la ligne principale, un pour la paire de lignes doublées. La longueur de la ligne principale se calcule le long du chemin (ondulation comprise). Place une image-clé exactement au point de dédoublement.
- **Pas d'`onUpdate`** : la timeline est pilotée par `seek()`, qui supprime les callbacks. Tout doit être un tween direct de propriétés ou d'attributs.
- **`immediateRender`** : chaque tween `fromTo` qui n'est pas le premier sur une propriété prend `immediateRender: false`. L'état initial se pose avec `gsap.set()`.
- **Déterminisme** : pas de `Math.random` (utilise un générateur pseudo-aléatoire avec une graine fixe), pas de `repeat: -1`.
- **Durée** : les flottements ont un nombre de répétitions fini qui ne dépasse pas 118 s. Termine par `tl.set({}, {}, 118)` pour fixer la durée.
- **Structure de chaque calque** :
  - `.layer` : position absolue, porte le flottement en y ;
  - `.in` : porte l'animation d'entrée ;
  - `.photo` : porte l'inclinaison fixe, en CSS uniquement, jamais animée.
  - Pour un calque texte sans taille, `.in` est en `position: relative`, pour que l'échelle des tampons parte du centre du texte.
- **Profondeur** : les sections de scène n'ont ni transform ni opacité (elles ne doivent pas créer de contexte d'empilement). La ligne est en `z-index: 2`, les titres en 3, les photos en 4-5, les annotations en 6-7, le grain en 50.
- **Compteur 0 → 20** : deux colonnes de chiffres (dizaines et unités, 21 lignes chacune) animées en `yPercent` avec `ease: 'steps(20)'`.
- **Machine à écrire** : découpe le texte en `<span>` par caractère, chacun légèrement décalé (±1 px, ±1,2°). Révèle-les avec `tl.set(opacity: 1)` à environ 14 caractères par seconde, avec une cadence irrégulière.
- **Écriture manuscrite** : balayage en `clip-path: inset(-40% 100% -40% -6%)` → `inset(-40% -6% -40% -6%)`.
- **Flèches** : `pathLength="1"`, `stroke-dasharray="1 1.2"`, `dashoffset` de 1,05 à 0 (cette valeur évite qu'un point parasite apparaisse avant le tracé).

## 5. Timecodes en variables

En haut du script, crée deux blocs :
- `TC` : le début de chaque scène, qui commence par son travelling (`TRAVEL = 1.8` s, `power2.inOut`) ;
- `CUE` : les repères internes, exprimés en décalage depuis le début de leur scène, pour que je puisse tout recaler sur la voix off.

```js
const TC = { UN_AN:0, NEW_YORK:3, MONT_ROYAL:15, DEUX_MERS:27, PRISE:45, SANS:63, DECIDE:79, SEUL:84, VINGT_JOURS:96, FINAL:108, FIN:118 };
const CUE = { NY_PRENOMS:5, NY_NOUS:9, MR_REVE:8, MERS_RHB:11, PRISE_INTERVIEW:6, PRISE_PHRASE:11, SANS_STOP:3, SANS_MOT:8, SEUL_FILS:3, VINGT_COMPTEURS:4.5 };
```

Pendant chaque scène, la caméra dérive lentement de 30 px vers la droite (linéaire).

**Positions des scènes sur la bande** (x monde du coin gauche) :

| Scène | x |
|---|---|
| CARTE_UN_AN | 0 |
| SCENE_01 | 2200 |
| SCENE_02 | 4600 |
| SCENE_03 | 7000 |
| CARTE_PRISE | 9400 |
| SCENE_04 | 11800 |
| CARTE_DECIDE | 14200 |
| SCENE_05 | 16600 |
| CARTE_20_JOURS | 19000 |
| TITRE_FINAL | 21400 |

Largeur du monde : environ 24 400 px. Dans la suite, toutes les coordonnées sont locales à la scène (cadre 1920×1080).

## 6. Déroulé détaillé

### 00–03 | CARTE_UN_AN « un an plus tôt »
- **Papier vide.** « un an plus tôt » se tape lettre par lettre au centre (Special Elite, 48 px, haut du texte à y = 452), au-dessus de la ligne, à partir de 0,35 s.
- **Ligne** : elle part du bord gauche à 0 s et atteint x = 1400 à 2,95 s.

### 03–15 | SCENE_01 NEW YORK (réf. 4)
La composition reste celle de la référence : la ligne à y = 540 passe naturellement derrière les photos.

**Mise en page**
- **Titre** : « NEW » et « YORK » sont deux mots séparés d'un espace de 0,13 em, haut des capitales en (52, 34), capitales de 402 px (environ 547 px de corps). Le titre doit couvrir toute la largeur, jusqu'à x ≈ 1880.
- **Escaliers de secours** : cadre 308×535, centre (868, 714), incliné de -7,5°.
- **Couple** : cadre 919×475, centre (1345, 719), incliné de +7,3°, au-dessus des escaliers.
  - POPOUT des têtes : en (63, -270) dans le repère du cadre, 500 px de large.
  - Scotch kraft : 58×122 en (640, -16), incliné de 4°.
- **Ticket** « MONTRÉAL > NEW YORK » :
  - forme : 595×140, centre (359, 855), incliné de +9,4°, papier `#EFE8D8` avec bouts dentelés ;
  - détails : perforation en pointillés près de chaque bout, code-barres à droite ;
  - texte : Courier Prime gras 28 px.
- **Annotations** :
  - « Julie » : Caveat 44 px en (922, 266), incliné de -8°, flèche courbe vers le bas jusqu'à (1004, 376) ;
  - « Freddy » : Caveat 48 px en (1642, 444), incliné de -6°, flèche courbe vers la gauche jusqu'à (1482, 458).
- **Placeholder** `SCENE_01_photo_nous` : 360×230 en (110, 460), incliné de -4°, gris `#B8B2A7` avec étiquette. Il est posé **sur** la ligne.
- **Légende** « New York | été 2025 » : Courier Prime 27 px en (52, 988).

**Timing**
- 4,0 s : le ticket glisse depuis la gauche (x -560, rotation -8°, `power3.out`, 1 s).
- 5,2 s : « NEW » tombe comme un tampon (scale 1,08 → 1 en 120 ms, `power2.in`). 5,8 s : « YORK », de la même façon.
- 6,4 s : la photo des escaliers se pose. 6,9 s : la photo du couple. Elles arrivent de y -70, rotation ±3 à 4°, scale 1,05 → 1, `back.out(1.4)`, 0,75 s.
- 7,6 s : les têtes POPOUT se soulèvent devant le titre (y -12 px). L'ombre `drop-shadow` s'élargit de 2 px à 14 px de décalage, en 0,9 s.
- 8,0 s : « Julie » s'écrit puis sa flèche se dessine. 9,1 s : « Freddy », puis sa flèche.
- 12,0 s (« Et ça, c'est nous ») : le placeholder se pose. 12,7 s : la légende se tape.
- **Ligne** : x = 600 à 4,8 s. Elle attend que les photos soient posées (x = 640 à 7,2 s), passe derrière elles, puis atteint x = 1880 à 14,9 s.

### 15–27 | SCENE_02 MONT ROYAL (réf. 2), recomposée
Pour respecter y = 540 et « la ligne ressort à hauteur de son visage », la ligne court dans la gouttière entre le titre (au-dessus) et les photos (en dessous). Le visage de l'homme qui se retourne est à y ≈ 540.

**Mise en page**
- **Légende** « Montréal | été 2025 » : Courier Prime 26 px en (118, 268).
- **Titre** « MONT ROYAL » : haut des capitales en (116, 327), capitales de 201 px (environ 273 px de corps), bas vers y = 528.
- **Bandes photo** : elles débordent par le bas du cadre ; la photo est calée en haut (`object-position: top`).
  - gauche : 367×712 en (33, 572), -0,8° ;
  - centre : 568×712 en (405, 574), +0,4° ; son POPOUT de tête est en (184, -103), 165 px de large, et chevauche le bas du titre ;
  - droite : 315×712 en (979, 581), -0,6°.
- **Annotation** au-dessus de la ligne, à droite : « et là, je leur » en (1408, 404) et « parle du rêve... » en (1452, 458). Caveat 48 px, -7°.
- **Lande** : 494×511 en (1373, 590), +5,75°. Bord de papier déchiré généré en `clip-path` (polygone dentelé, déterministe), marge blanche de 12 px, ombre portée via `filter: drop-shadow`. Elle reste sous la ligne.

**Timing**
- 15–16,8 s : travelling.
- 16,9 s, 17,3 s, 17,7 s : les trois bandes montent depuis le bas (y +440 → 0, `back.out(1.2)`, 0,9 s).
- 19,0 s : « MONT ROYAL » apparaît derrière (fondu et montée de 50 px, 1 s).
- 20,2 s : la tête POPOUT se soulève devant le titre. 20,8 s : la légende se tape.
- **Ligne** : x = 70 à 16,8 s, x = 600 à 22,6 s. Elle passe derrière la tête et ressort à x = 770 à 23,05 s, à hauteur du visage.
- 23,3 s : l'annotation s'écrit le long de la ligne (deux lignes, environ 1 s chacune). 24,6 s : la lande se pose (rotation 6°, `back.out`).
- **Ligne** : x = 1360 à 25 s, x = 1880 à 26,9 s.

### 27–45 | SCENE_03 D'UNE MER À L'AUTRE (réf. 5), recomposée
Ici le galet doit être exactement à y = 540 : c'est de lui que la ligne repart.

**Mise en page**
- **Photo de gauche** (St Bees) : cadre 446×620 en (80, 86), incliné de +2,6°, à l'échelle 1:1 de la référence. Galet de la référence : à (409, 446) dans le repère du cadre ; poignet : à (178, 198).
- **POPOUT main et galet** : en (150, 160) dans le repère du cadre, 345 px de large, `transform-origin` au poignet. Elle « avance » : scale 1 → 1,05, x +12, y -12,4, pour que le galet glisse vers la droite sans descendre. Le galet finit à cheval sur le bord droit du cadre, à y = 540.
- **Titre** : « D'UNE MER » puis « À L'AUTRE » (deuxième ligne décalée de 66 px). Haut des capitales en (595, 166), capitales d'environ 138 px (188 px de corps). L'interligne de 38 px laisse la place à l'accent du À.
- **« 300 km »** : Courier Prime 30 px, centré en x = 850, haut du texte à y = 494, juste au-dessus de la ligne.
- **Photo de droite** (Robin Hood's Bay) : cadre 476×680 en (1170, 200), +2,9°. Elle couvre la fin du « E » de « À L'AUTRE ».
- **Légendes** :
  - « St Bees | mer d'Irlande » en (84, 736) ;
  - « Robin Hood's Bay | mer du Nord » alignée à droite à x = 1646, y = 906.
  - Courier Prime 24 px.

**Timing**
- 29,1 s : la photo de gauche se pose. 30,0 s : la main avance avec le galet (1 s, `power2.inOut`).
- **Ligne** : elle attend à x = 55 jusqu'à 30,9 s. Elle file derrière la photo et **repart du galet** à x = 520 (31,3 s), puis avance lentement jusqu'à x = 1170 à 38,0 s.
- 32,0 s : « D'UNE MER » tombe en tampon. 33,0 s : « À L'AUTRE ». 32,6 s : la légende de gauche se tape. 33,8 s : « 300 km » se tape.
- 37,5 s : la photo de Robin Hood's Bay se pose au moment où la ligne l'atteint. Dès 37,8 s, le titre glisse de 30 px vers la droite (1,4 s), et sa fin passe derrière la photo. 38,8 s : la légende de droite se tape.
- **Ligne** : elle passe derrière la photo, x = 1660 à 38,7 s, x = 1890 à 44,9 s.

### 45–63 | CARTE_PRISE « la prise de conscience »
**Mise en page**
- **Placeholder** `SCENE_04_interview` : 640×360 en (640, 104), -1,2°, au-dessus de la ligne, avec un « ▶ » et une étiquette.
- **Phrase** « Entre le rêve et l'accomplissement, il y a une date. » : Special Elite 40 px, centrée, haut du texte à y = 596, sous la ligne. Chaque mot est dans son propre `<span>`.

**Timing**
- **Ligne qui hésite**, sur « je ne fais que ça, en parler » : petites poussées puis arrêts.
  - x = 40 à 46,8 s ;
  - x = 210 à 47,6 s, x = 215 à 48,3 s ;
  - x = 380 à 48,9 s, x = 392 à 49,6 s ;
  - x = 520 à 50,1 s, x = 530 à 50,9 s ;
  - x = 700 à 51,6 s, x = 1100 à 56 s, x = 1880 à 62,9 s.
- 51,0 s : l'interview se pose.
- 56,0 s : la phrase se tape (environ 17 caractères par seconde). Une seconde après la fin de la frappe, tous les mots sauf « date » s'effacent un par un (0,7 s chacun, décalés de 0,07 s).

### 63–79 | SCENE_04 SANS (réf. 3)
**Mise en page**
- **« 40 ans »** : Special Elite 50 px en (334, 178).
- **Point rouge** : 22 px de diamètre, centré en (294, 540), à la même profondeur que la ligne et sans flottement.
- **« SANS. »** : coin gauche en (318, 243), capitales d'environ 566 px (770 px de corps), lettres presque collées. Chaque lettre a deux couches :
  - le glyphe noir encré ;
  - le même glyphe rempli de sa photo (`background-clip: text`).
- **Le point final** : un disque noir encré de 112 px, aligné sur la ligne de base.
- **Rature** : « pas de mourir trop jeune. » en Caveat 64 px, en (556, 842). Le trait noir de 3,4 px qui la barre va de x = 540 à 1392, autour de y = 888.
- **Masque** : la ligne est masquée de x = 302 à 1792 dans la scène.

**Timing**
- 63–64,8 s : travelling. 64,6 s : « 40 ans » se tape.
- **Ligne** : elle ralentit (`expo.out`) et s'arrête net à x = 294 à 66,0 s. Le point rouge apparaît en même temps (scale 0 → 1, `back.out(2.2)`, 0,16 s).
- 66,0–67,5 s : silence graphique.
- 67,5 s : « pas de mourir trop jeune. » s'écrit (1,6 s). 69,4 s : le trait noir la barre (0,5 s).
- 71,0 s : « SANS. » tombe en noir plein (tampon, scale 1,06 → 1).
- 72,4 s, 73,5 s, 74,6 s, 75,7 s : chaque lettre s'ouvre sur sa photo. L'ouverture se fait par un balayage de bas en haut (`clip-path` de `inset(100% 0 0 0)` à `inset(0)`, 0,8 s). La photo zoome lentement de 115 % à 104 % de hauteur (`background-size`, 4 s), ce qui revient au 110 % → 100 % demandé, avec une marge pour bien couvrir la lettre.

### 79–84 | CARTE_DECIDE « C'EST DÉCIDÉ »
**Mise en page**
- **« C'EST DÉCIDÉ. »** : centré, haut des capitales à y = 300, capitales d'environ 170 px (231 px de corps).
- **« l'année prochaine, je pars. »** : Special Elite 44 px, centré, haut du texte à y = 600.

**Timing**
- **Ligne** : elle repart du point à 79,0 s, droite et rapide, et atteint x = 1500 de cette carte à 80,4 s (`power2.inOut`), puis x = 1880 à 83,95 s.
- 81,0 s : le titre tombe en tampon. 81,7 s : le texte se tape.

### 84–96 | SCENE_05 MAIS PAS SEUL (réf. 1), recomposée
La ligne passe sous le titre.

**Mise en page**
- **Titre** : « MAIS PAS » puis « SEUL. », haut des capitales en (140, 107), capitales de 201 px (273 px de corps), 11 px entre les deux lignes. Le bas de « SEUL. » est vers y = 520.
- **Photo** : cadre 560×775 en (842, 150), +3,1°. Elle recouvre le bord droit du S de « PAS ».
- **POPOUT bras et ballon** : en (-116, -148) dans le repère du cadre, 232 px de large.
- **Point de dédoublement** : x = 1300, caché derrière la photo. Les deux lignes ressortent au bord droit de la photo, vers x = 1400.
- **Badge** : 333×120 en (1281, 788), -5,5°, papier `#EFE9DC`, scotch en haut.
  - texte : « RAFA | 15 ANS » puis « HANDBALL | MONTRÉAL + QUÉBEC », Courier Prime 21 px, interligne 1,6.
- **Annotation** : « mon fils » en Caveat 54 px en (1500, 60), -10°. Sa flèche courbe descend jusqu'au visage de Rafa, vers (1254, 322).

**Timing**
- 85,0 s : « MAIS PAS » tombe en tampon. 85,8 s : « SEUL. ».
- **Ligne** : x = 110 à 85,8 s, x = 640 à 87,0 s.
- 87,0 s (« Lui, c'est mon fils ») : la photo tombe d'en haut (y -1000, rotation -8°) avec un rebond (`back.out(1.4)`, 0,95 s).
- 87,9 s : le bras et le ballon POPOUT se soulèvent (y -14).
- **Ligne** : elle passe derrière la photo jusqu'au point de dédoublement (88,6 s). Les deux lignes avancent ensemble jusqu'à x = 1880 à 95,9 s.
- 89,3 s : le badge se pose. 89,8 s : son texte se tape lettre par lettre.
- 92,0 s : « mon fils » s'écrit. 92,7 s : la flèche se dessine.

### 96–108 | CARTE_20_JOURS « 20 jours / moins de 10 »
**Mise en page**
- **« UNE AVENTURE. À DEUX. »** : centré, haut des capitales à y = 170, capitales d'environ 140 px (190 px de corps).
- **« tout le monde : 20 jours »** : Special Elite 52 px, centré, haut du texte à y = 416, au-dessus des lignes.
- **« nous : moins de 10 »** : Special Elite 52 px, centré, haut du texte à y = 612, sous les lignes. Le « 10 » est en Anton encré de 132 px. Attention : la marge négative du masque d'encre ne doit pas décaler le « 10 ».

**Timing**
- Les deux lignes continuent : x = 420 à 97,8 s, x = 1500 à 107,9 s.
- 98,0 s : le titre tombe en tampon.
- 100,5 s : « tout le monde : » se tape. Le compteur apparaît et défile de 0 à 20 (1,5 s, `steps(20)`), puis « jours » se tape.
- 104,0 s : « nous : moins de » se tape. Le « 10 » tombe ensuite en tampon (scale 1,12 → 1).

### 108–118 | TITRE_FINAL
**Mise en page**
- **« COAST TO COAST »** : centré, haut des capitales à y = 240, capitales d'environ 250 px (340 px de corps), au-dessus des lignes.
- **« 300 KM À DEUX. »** : centré, haut des capitales à y = 600, environ 122 px de corps, sous les lignes.

**Timing**
- 108–109,8 s : travelling. Les lignes arrivent à x = 1100.
- 109,8–110,8 s : pause d'une seconde sur les deux lignes seules.
- 110,8 s : le titre apparaît en très grand (fondu et scale 1,05 → 1, 0,7 s). 111,6 s : le sous-titre tombe en tampon.
- 112,4–114,2 s : les deux lignes filent (`power2.in`) jusqu'au bord droit et sortent du cadre. On tient l'image jusqu'à 118 s, soit au moins 3 s.

## 7. Mouvement
- **Travellings** : easing doux `power2.inOut`.
- **Photos** : rebonds légers `back.out(1.4)`.
- **Rythme** : aucun mouvement brusque, rythme posé, pensé pour une voix off lente.
- **Flottement** : tous les calques flottent en continu de 1 à 2 px en y (`sine.inOut`, yoyo, période de 2,6 à 3,9 s qui varie d'un calque à l'autre). La ligne et le point rouge ne flottent pas.

## 8. Livrable
- **Composition** : une composition HyperFrames organisée par scènes : `index.html` avec une `<section>` par scène, `meta.json` et `assets/`.
- **Timecodes** : les blocs `TC` et `CUE` en haut du script.
- **README** : il explique comment recaler les timecodes, remplacer chaque média (le tableau des calques) et insérer la vidéo d'interview.

**Vérifications avant de livrer**
- Les captures aux temps clés montrent la ligne à y = 540, continue, masquée derrière les photos et derrière SANS.
- La ligne repart bien du galet et se dédouble derrière Rafa.
- Les titres font la bonne largeur avec la vraie police Anton.
- Aucun accent n'est rogné.
- Aucune bande blanche ne traverse les POPOUT.
- La timeline dure exactement 118 s.

Termine par `npx hyperframes render`.
