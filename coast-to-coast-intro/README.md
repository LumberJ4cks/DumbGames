# Coast to Coast · intro (animatique HyperFrames)

Animatique motion design de l'intro du documentaire père-fils. 1920×1080, 30 fps, 118 s, sans audio : la voix off et la musique (*Paris*, Else) s'ajoutent au montage.

```bash
npx hyperframes preview     # prévisualiser
npx hyperframes render      # rendre en MP4 (1920x1080, 30 fps)
```

Tout est dans `index.html`. Les polices (Anton, Special Elite, Courier Prime, Caveat) viennent de Google Fonts et GSAP 3.12.5 de jsDelivr : il faut une connexion au moment du rendu.

## Recaler sur la voix off

En haut du `<script>` :

- `TC` : début de chaque scène, en secondes. Chaque scène commence par son travelling (`TRAVEL` = 1,8 s).
- `CUE` : repères internes, exprimés en décalage depuis le début de la scène. Déplacer une scène dans `TC` déplace donc aussi tous ses repères.
- `TC.FIN` : durée totale. Si vous la changez, mettez à jour `data-duration` sur `#root` et `#camera` (le script le fait aussi au chargement).

| Scène | `TC` | Repères |
|---|---|---|
| Carte « un an plus tôt » | `UN_AN` 0 | |
| SCENE_01 New York | `NEW_YORK` 3 | `NY_PRENOMS` (+5 → 08 s), `NY_NOUS` (+9 → 12 s) |
| SCENE_02 Mont Royal | `MONT_ROYAL` 15 | `MR_REVE` (+8 → 23 s) |
| SCENE_03 D'une mer à l'autre | `DEUX_MERS` 27 | `MERS_RHB` (+11 → 38 s) |
| Carte « prise de conscience » | `PRISE` 45 | `PRISE_INTERVIEW` (+6 → 51 s), `PRISE_PHRASE` (+11 → 56 s) |
| SCENE_04 SANS | `SANS` 63 | `SANS_STOP` (+3 → 66 s), `SANS_MOT` (+8 → 71 s) |
| Carte « c'est décidé » | `DECIDE` 79 | |
| SCENE_05 Mais pas seul | `SEUL` 84 | `SEUL_FILS` (+3 → 87 s) |
| Carte « 20 jours » | `VINGT_JOURS` 96 | `VINGT_COMPTEURS` (+4,5 → 100,5 s) |
| Titre final | `FINAL` 108 | fin `FIN` 118 |

## Remplacer les médias

Les photos sont des recadrages provisoires des style frames, dans `assets/`. Chaque fichier porte le nom du calque qui l'utilise. Pour remplacer une photo, il suffit d'écraser le fichier en gardant son nom.

| Calque | Fichier |
|---|---|
| `SCENE_01_photo_escaliers` | `SCENE_01_photo_escaliers.jpg` |
| `SCENE_01_photo_couple` | `SCENE_01_photo_couple.jpg` |
| `POPOUT_SCENE_01_tetes` | `POPOUT_SCENE_01_tetes.png` (détouré, fond transparent) |
| `SCENE_01_photo_nous` | placeholder gris : remplacer le `<div class="media">` par `<img class="media" src="…">` |
| `SCENE_02_photo_gauche` / `_centre` / `_droite` | `SCENE_02_photo_*.jpg` |
| `POPOUT_SCENE_02_tete_homme` | `POPOUT_SCENE_02_tete_homme.png` |
| `SCENE_02_photo_lande` | `SCENE_02_photo_lande.jpg` (le bord déchiré est généré en CSS) |
| `SCENE_03_photo_gauche` / `_droite` | `SCENE_03_photo_*.jpg` |
| `POPOUT_SCENE_03_main_galet` | `POPOUT_SCENE_03_main_galet.png` |
| `SCENE_04_interview` | placeholder 16:9 : y mettre un `<video>` (voir ci-dessous) |
| `SCENE_04_lettre_S1` / `_A` / `_N` / `_S2` | `SCENE_04_lettre_*.jpg` (photo vue à travers chaque lettre de « SANS ») |
| `SCENE_05_photo_rafa` | `SCENE_05_photo_rafa.jpg` |
| `POPOUT_SCENE_05_bras_ballon` | `POPOUT_SCENE_05_bras_ballon.png` |

Les POPOUT sont positionnés dans le repère du cadre photo (`left`/`top` en px depuis le coin du cadre). Si une vraie photo change le cadrage, recalez-les dans leur attribut `style`.

Pour l'interview, remplacez le contenu de `.media` dans `SCENE_04_interview` par :

```html
<video class="media clip" src="assets/interview.mp4" muted playsinline
       data-start="51" data-duration="8" data-track-index="1"
       style="width:100%;height:100%;object-fit:cover"></video>
```

## Structure

- `#world` : la bande horizontale qui porte toutes les scènes (`<section class="scene">`), posées côte à côte. La caméra déplace cette bande : les transitions sont des travellings `power2.inOut` qui suivent la pointe de la ligne.
- `#LIGNE` : l'unique ligne rouge, 6 px, à y = 540. Elle est dessinée par `stroke-dashoffset` à partir des images-clés `K(temps, x, ease)` déclarées dans chaque scène. Elle passe sous les calques photo, et le masque `LIGNE_masque_SANS` la cache derrière « SANS. ». Elle n'ondule que sur la carte « prise de conscience », puis se dédouble (y = 520 / 560) derrière la photo de Rafa.
- Chaque calque est construit ainsi : `.layer` (flottement continu de 1 à 2 px) > `.in` (animation d'entrée) > `.photo` (inclinaison fixe en CSS).

## À vérifier au premier rendu

L'environnement où cette composition a été écrite n'avait pas accès au réseau, donc ni Anton ni GSAP. Les images de contrôle ont été rendues avec un moteur d'animation de substitution et des polices de remplacement.

- **Tailles des titres** : elles ont été calculées pour qu'Anton atteigne la hauteur de capitale des style frames, en supposant une hauteur de capitale d'environ 0,735 em. Les titres sont rognés sur la hauteur des capitales (`text-box: trim-both cap alphabetic`). Si la largeur ne tombe pas juste (« NEW YORK » doit couvrir toute la largeur, le « S » de « PAS » doit passer sous la photo de Rafa, la fin de « À L'AUTRE » sous Robin Hood's Bay), ajustez le `font-size` de la `.row` concernée.
- **Mont Royal** : pour respecter la règle y = 540 et faire « ressortir la ligne à hauteur de son visage », la scène a été recomposée. La ligne court dans la gouttière entre le titre et les bandes photo, et les bandes sortent par le bas du cadre.
