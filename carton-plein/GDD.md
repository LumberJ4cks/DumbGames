# CARTON PLEIN — pré-GDD

*Un Paraguayen. Onze Français. Zéro intention de jouer au ballon.*

Titre de travail. Alternatives : **FAUTE DE MIEUX**, **GUARANÍ VS GAULOIS**, **FRANCE – PARAGUAY (1)**.
Jeu de la collection DumbGames : site statique, un dossier, un `index.html`, zéro dépendance,
pixel art dessiné au code, 640×360 natif.

---

## PANNEAU 1 — Le jeu en une minute

### Le concept

Coupe du monde 2026, France – Paraguay. Les dix autres Paraguayens ont déjà été expulsés.
Il reste **toi**, le numéro 4, seul sur la pelouse face à onze Français.

Les Français **jouent au foot**, pour de vrai : passes, dribbles, tirs, buts.
Toi, **tu ne joues pas au foot**. Tu fais des fautes.
Ce n'est pas un jeu de foot : c'est un jeu de MMA dont les adversaires sont des footballeurs.

### L'objectif

**Faire le plus de fautes possible avant le coup de sifflet final.**
Le match dure 90 secondes (une minute de match = une seconde réelle), plus le temps additionnel
que tu auras gagné à force de fautes.

Les buts encaissés sont affichés sur le tableau d'affichage. Ils ne valent **rien**.
0 – 9 à la mi-temps, personne ne s'en soucie, surtout pas toi.

### Comment ça marche

**Une seule touche : ESPACE** (clavier), **clic droit** (souris) ou **tap** (tactile).

Tu ne diriges pas ton joueur : il **court tout seul vers le ballon**, parce que c'est là que sont
les Français. Ta seule décision, c'est **quand** appuyer. La distance au Français le plus proche
au moment où tu appuies choisit le coup :

| Distance au Français le plus proche | La touche déclenche | Portée |
|---|---|---|
| **Loin** (plus de 40 px) | **TACLE GLISSÉ** : glissade longue et exagérée, façon Nintendo World Cup, qui fauche tout sur son passage | 110 px |
| **Collé** (40 px ou moins) | **COUP DE POING** : contact immédiat, enchaînable poing → coude → projection, façon Double Dragon | 24 px |

Appuyer tôt en arrivant sur un Français = tacle. Attendre d'être dessus = poing.
Le même bouton, le même geste, deux fautes différentes selon le moment.

Chaque faute est **sifflée**. L'arbitre accourt, sort un carton, les Français tirent le coup franc,
le ballon repart, et toi avec.

Au **carton rouge**, l'arbitre vient te chercher. Frappe-le au bon moment : c'est une
**FAUTE SUR L'ARBITRE**, la plus grosse du jeu, et c'est le 4e arbitre qui reprend le sifflet.
Rate le moment : tu es expulsé, le match s'arrête, on compte.

**Score = fautes × combo + cartons + arbitres + bonus de fin.** À la fin, le tampon tombe :
le rapport de l'arbitre.

---

## 2. Gameplay complet

### 2.1 Le terrain et la caméra

- Vue de dessus légèrement en trois quarts, héritée de Nintendo World Cup : la pelouse défile
  horizontalement, les deux buts aux extrémités, les tribunes pleines en haut de l'écran, les
  bancs et le 4e arbitre en bas.
- La caméra suit le ballon avec un peu d'avance. Ton joueur est toujours dans le cadre puisqu'il
  court vers le ballon.
- Au sol, des **objets ramassables** apparaissent au fil du match (voir 2.6).

### 2.2 Ton joueur : le numéro 4

- Nom de travail : **Teodoro « El Toro » Benítez**, n°4, maillot rayé rouge et blanc, cuisses
  de rugbyman, tête de dessin animé. Fictif.
- **Déplacement automatique.** Il court en permanence vers le ballon, en visant légèrement le
  porteur plutôt que le ballon lui-même. Vitesse légèrement supérieure à celle des Français :
  il finit toujours par les rattraper, jamais trop vite pour que le timing reste un choix.
- Il **ne touche jamais le ballon** : s'il passe dessus, le ballon roule entre ses jambes.
  C'est un gag et une règle : il ne peut pas interférer avec le foot autrement que par la faute.
- Il **ne peut pas être mis KO**. Il peut être **étourdi** (0,8 s, étoiles autour de la tête)
  par un ballon de tir surpuissant ou par une glissade dans le vide.

### 2.3 Les deux attaques

#### Le tacle glissé (loin)

- Déclenché si aucun Français n'est à 40 px ou moins.
- Glissade rectiligne de 110 px en 0,45 s dans la direction de course, jambe tendue, motte de
  pelouse qui vole. Tout Français touché sur le trajet est fauché (plusieurs d'un coup possible :
  **DOUBLE**, **TRIPLÉ**).
- Variantes détectées automatiquement, chacune avec son nom à l'écran et ses points :
  - **TACLE** : contact de face ou de côté.
  - **PAR DERRIÈRE** : le Français te tournait le dos.
  - **SEMELLE** : contact dans la seconde moitié de la glissade (plus de 55 px parcourus),
    les deux pieds décollés.
  - **CISEAUX** : deux Français fauchés dans la même glissade.
- **Raté** : si la glissade ne touche personne, le n°4 finit à plat ventre : **GLISSADE**,
  0,8 s au sol, combo cassé. C'est le seul vrai coût d'une mauvaise lecture.

#### Le coup de poing (collé)

- Déclenché si un Français est à 40 px ou moins. Vise le plus proche.
- Enchaînement Double Dragon en trois temps, un appui par coup, fenêtre de 0,6 s entre deux
  appuis :
  1. **POING** : direct, le Français recule d'un pas, étourdi 0,6 s.
  2. **COUDE** : il plie, étourdi 0,8 s.
  3. **PROJECTION** : saisie par le col et envoi au sol, roulade de trois tours, il reste à terre 1,5 s.
- Chacun des trois coups est une faute à part entière, sifflée à part entière. L'arbitre
  siffle trois fois de suite, de plus en plus rouge.
- **Sur un Français au sol** : l'appui donne un **ACHARNEMENT** (petit coup de pied). Peu de
  points, patience de l'arbitre très entamée. C'est le coup des joueurs qui veulent provoquer
  le rouge pour aller chercher l'arbitre.

### 2.4 Les Français : ils jouent au foot

- Onze joueurs, noms de l'effectif réel (à confirmer avant mise en ligne) ou détournés d'une
  lettre si l'on préfère. Deux ou trois têtes reconnaissables en caricature : l'attaquant
  star, le gardien, le sélectionneur sur le banc.
- **IA de foot sincère**, inspirée des coéquipiers automatiques de Nintendo World Cup :
  le porteur avance vers le but vide, passe quand tu approches, tire dès qu'il entre dans la
  surface. Les autres se démarquent, demandent le ballon, lèvent le bras. Ils **ne se défendent
  jamais** et ne te rendent jamais un coup. Au mieux ils t'évitent d'un petit crochet si tu
  arrives de face trop lentement.
- **Après chaque faute** : coup franc rapide, à l'endroit de la faute. Les Français se
  regroupent autour du ballon pendant 1,2 s avant de le jouer. C'est le moment le plus dense du
  jeu : le coup franc est un buffet.
- **Après chaque but** : coup d'envoi au rond central, onze Français alignés. Autre buffet.
  C'est pour ça que les buts encaissés ne sont pas un problème : chaque but te ramène tout le
  monde au centre.
- **Santé.** Chaque Français encaisse **trois fautes** avant d'être KO (points d'exclamation,
  langue sortie). Un KO déclenche la **civière** : deux brancardiers traversent le terrain,
  l'emportent, un remplaçant entre depuis le banc en trottinant. La France a **cinq
  remplacements**. Au sixième KO, elle joue à dix, puis à neuf… Moins de Français, moins de
  cibles, moins de fautes par minute : **le joueur qui tape trop fort se prive de victimes**.
  C'est la seule décision stratégique du jeu, et elle suffit.
- **Le gardien** reste dans sa surface. L'atteindre coûte un trajet long, ce qui en fait une
  cible chère : **FAUTE SUR LE GARDIEN**.

### 2.5 L'arbitre, les cartons, et la faute suprême

- L'arbitre court derrière le jeu, un peu en retrait. **Il siffle tout.** Il n'y a pas de faute
  non vue : le jeu ne récompense pas la discrétion, il récompense le volume.
- Chaque faute remplit sa **jauge de patience** (le sifflet en bas à gauche, qui rougit) :

  | Palier | Ce qui se passe |
  |---|---|
  | 40 % | **Avertissement** : il te fait la morale, doigt levé. Rien ne change. |
  | 70 % | **CARTON JAUNE** : il le brandit, bonus au score, ton multiplicateur ne retombe plus en dessous de ×2 jusqu'à la prochaine faute ratée. |
  | 100 % | **CARTON ROUGE** : il marche vers toi, carton levé, en 2 secondes. |

- **Le moment rouge.** Pendant qu'il approche, le jeu ralentit légèrement, la foule se tait.
  - Appuie quand il arrive dans la zone de poing : **FAUTE SUR L'ARBITRE**. Il part en roulade,
    la foule hurle, le **4e arbitre** entre en courant pour reprendre le sifflet. Patience à
    zéro, mais le nouvel arbitre est plus nerveux : sa jauge monte 25 % plus vite.
  - Appuie trop tôt (il est loin) : tu tacles dans le vide, tu es à terre quand il arrive.
    Expulsé.
  - N'appuie pas : expulsé.
- **Expulsé = fin du match**, immédiate. Le score est compté normalement, le tampon dit
  « EXPULSÉ À LA 67e ». Perdre vingt secondes de match, c'est la vraie punition.
- **Succession des arbitres** : l'arbitre principal, puis le 4e arbitre, puis l'arbitre
  assistant qui arrive avec son drapeau, puis le **VAR** : un écran sur roulettes qui ne peut
  pas être frappé. Au rouge du VAR, le match est fini, point. Trois fautes sur l'arbitre
  maximum par match, donc.

### 2.6 Objets et armes (Double Dragon)

- Des objets apparaissent au sol à des moments précis ou après certains événements : **drapeau
  de corner**, **bouteille d'eau**, **cône d'entraînement**, **chaussure perdue**, **ballon de
  rechange**.
- Le n°4 **ramasse automatiquement** tout objet qu'il traverse. Il le brandit en courant.
- Le prochain coup de poing utilise l'objet : points doublés, animation dédiée, l'objet part en
  morceaux. Un tacle avec objet en main le lâche sans effet.
- Le **ballon de rechange** est un cas spécial : le ramasser le fait **exploser** entre ses mains
  (il ne peut pas toucher un ballon), étourdi 0,8 s. Ne pas ramasser le ballon est une
  compétence.

### 2.7 Combo et multiplicateur

- Chaque faute déclenche un chrono de **3 secondes**. Une nouvelle faute avant la fin du chrono
  prolonge la chaîne.
- Multiplicateur selon la longueur de la chaîne : ×1, puis **×2** à 2 fautes, **×3** à 4,
  **×4** à 7, **×5** à 10. Plafond ×5, comme les autres jeux de la collection.
- La chaîne casse : chrono écoulé, **GLISSADE** dans le vide, étourdissement, ou ballon
  explosé. Un carton jaune en cours garantit un plancher à ×2.
- Le multiplicateur s'affiche au centre de l'écran avec ses crans et le prochain palier, les
  popups nomment la faute (« PAR DERRIÈRE », « COUDE », « SEMELLE »), un bandeau tombe à chaque
  palier. Même grammaire que Cons de mime.

### 2.8 Les événements à heure fixe

Le match dure 90 secondes, une seconde par minute de jeu. Événements scriptés, dans l'ordre :

| Minute | Événement |
|---|---|
| 0' | Coup d'envoi. Onze Français alignés au centre, toi seul en face. Le speaker annonce « …et pour le Paraguay : Benítez. » Silence. |
| 12' | **Le ramasseur de balle** traverse le terrain pour rendre un ballon. Le frapper n'est pas une faute (il n'est pas joueur) : « HORS SUJET », zéro point, combo cassé. Première fausse cible. |
| 23' | **TIR SURPUISSANT** : l'attaquant star arme son tir spécial, le ballon prend feu, la caméra tremble. Si tu le fauches pendant l'armement (1,5 s) : **TIR ANNULÉ**, gros bonus. Sinon le ballon traverse le terrain, et toi si tu es sur la trajectoire. |
| 45' | **MI-TEMPS : LE TUNNEL.** Les Français rentrent au vestiaire en file. Niveau bonus de 8 secondes dans le couloir, en vue de côté, défilement horizontal pur Double Dragon : la file avance, toi derrière, les fautes dans le tunnel valent ×1,5 et n'affectent pas la patience de l'arbitre (il est déjà dans son vestiaire). |
| 46' | Reprise. Le second arbitre du match reprend si le premier a été frappé ; sinon le même, qui s'est calmé (patience −30 %). |
| 61' | **Entrée de la star en remplacement** si elle n'est pas déjà sur le terrain, ou **triple remplacement** : trois Français frais trottinent depuis le banc, les trois ensemble, le long de la ligne de touche. Couloir de fautes. |
| 72' | **LE SÉLECTIONNEUR** entre sur la pelouse pour protester auprès de l'arbitre. Il y reste 6 secondes. Le toucher : **FAUTE SUR LE STAFF**, et il se fait expulser du banc à ta place. |
| 85' | **Annonce du temps additionnel** : le 4e arbitre lève le panneau. Le nombre affiché est calculé sur **tes** fautes : une seconde par tranche de six fautes, plafonné à 15. Plus tu as fauté, plus tu joues. |
| 90'+ | Temps additionnel. Les fautes valent **×2** (en plus du combo). La foule compte à rebours. |
| Fin | Coup de sifflet final, puis **LA HAIE D'HONNEUR** (voir 3.1). |

Les minutes exactes sont indicatives : à régler au prototype pour que les buffets (coups
d'envoi après but) ne tombent pas sur les événements.

### 2.9 La boucle

**Micro-boucle (2 à 5 secondes), celle qu'on répète cent fois :**

1. Le n°4 court vers le ballon. Les Français jouent.
2. Un Français arrive à portée : tu lis la distance.
3. Tu appuies : tacle de loin, ou poing si tu as attendu.
4. Faute, popup, sifflet, patience qui monte, combo qui monte.
5. Coup franc : les Français se regroupent 1,2 s. Tu enchaînes sur le tas (poing, coude,
   projection) ou tu repars tacler le prochain.
6. Le ballon repart. Retour en 1.

**Boucle de match (90 secondes), celle qui donne le rythme :**

- Les Français marquent toutes les 10 à 15 secondes puisque personne ne défend. Chaque but
  renvoie tout le monde au centre : c'est le **gros buffet** périodique.
- La patience de l'arbitre monte en 15 à 25 secondes de jeu agressif : un **moment rouge**
  toutes les 20 secondes environ, trois dans un match bien mené.
- Les remplaçants s'épuisent : vers la 60e, le joueur qui a tout mis KO joue contre huit
  Français essoufflés et le regrette.
- Les événements injectent une cible rare toutes les 10 à 15 secondes (star, staff, tunnel).
- Le temps additionnel récompense le volume de fautes avec… du temps pour faire des fautes.

**Boucle de session :** record en `localStorage`, tampon final à comparer, `?seed=` pour rejouer
la même partie. Une partie dure moins de deux minutes, on relance.

### 2.10 Sensations à atteindre

- **Lisibilité du choix** : à tout moment, un anneau discret au sol autour du n°4 marque la
  zone des 40 px. Un Français dedans, l'anneau passe au rouge : appuyer donnera un poing.
- **Impact** : arrêt sur image de 2 à 3 frames à chaque contact, secousse d'écran, motte de
  pelouse, roulade exagérée du Français (il roule trois fois, comme à la télé).
- **L'arbitre comme personnage** : il court, il souffle, il rougit, il est le vrai boss du jeu.
- **Le foot continue** : même pendant tes conneries, le ballon circule, le speaker commente les
  buts, le tableau d'affichage tourne. Le contraste fait le gag.

---

## 3. La fin et le calcul du score

### 3.1 Le coup de sifflet final

Trois fins possibles, même écran de score derrière :

- **Temps écoulé** (cas normal) : sifflet, les Français lèvent les bras, et viennent te serrer
  la main : **LA HAIE D'HONNEUR**. Les onze défilent devant toi en 6 secondes, main tendue.
  Chaque appui au bon moment transforme une poignée de main en coup de poing : **POIGNÉE
  DE MAIN**, faute d'après-match, l'arbitre n'y peut plus rien. Dernier petit combo, puis
  l'écran de score.
- **Expulsé** : le dernier arbitre lève le rouge, le n°4 sort en applaudissant le public,
  la caméra le suit jusqu'au tunnel. Pas de haie d'honneur. L'écran de score indique la minute
  d'expulsion.
- **Plus de Français** (cas théorique : onze KO et cinq remplacements consommés) : l'arbitre
  arrête le match faute de combattants. Tampon spécial « MATCH ARRÊTÉ », bonus unique, mais
  score généralement faible : c'est l'anti-stratégie, et le jeu l'assume.

### 3.2 Les points

Points de base par faute, avant multiplicateur :

| Faute | Points | Comment |
|---|---|---|
| POING | 100 | 1er coup de la chaîne |
| COUDE | 150 | 2e coup |
| PROJECTION | 300 | 3e coup |
| ACHARNEMENT | 50 | sur un joueur au sol |
| TACLE | 200 | glissade, contact de face ou de côté |
| PAR DERRIÈRE | 400 | glissade, le Français te tournait le dos |
| SEMELLE | 500 | glissade, contact dans la seconde moitié |
| CISEAUX | +300 | deux Français dans la même glissade (en plus de leurs fautes) |
| POIGNÉE DE MAIN | 250 | haie d'honneur |
| FAUTE SUR LE GARDIEN | 600 | n'importe quel coup sur le gardien |
| FAUTE SUR LE STAFF | 1 500 | le sélectionneur, 72e minute |
| FAUTE SUR L'ARBITRE | 2 000 | le moment rouge réussi |
| TIR ANNULÉ | 1 000 | star fauchée pendant l'armement, 23e |

Modificateurs cumulables sur une même faute :

| Modificateur | Effet |
|---|---|
| Sur le porteur du ballon | ×1,5 |
| Dans la surface de réparation (c'est un penalty) | +250 |
| Avec un objet en main | ×2 |
| Dans le tunnel (mi-temps) | ×1,5 |
| Temps additionnel | ×2 |
| Combo | ×1 à ×5 |

Bonus hors fautes :

| Bonus | Points |
|---|---|
| Carton jaune reçu | 500 chacun |
| Carton rouge survécu (arbitre frappé) | 2 000 chacun, en plus de la faute elle-même |
| Match joué jusqu'au bout (pas d'expulsion) | 1 000 |
| Temps additionnel obtenu | 100 par seconde |
| Buts encaissés | **× 0**, affiché quand même |

### 3.3 La formule

```
SCORE = Σ sur chaque faute ( points de base × modificateurs × combo )
      + 500 × cartons jaunes
      + 2 000 × arbitres mis à terre
      + 1 000 si match complet
      + 100 × secondes de temps additionnel
      + 0 × buts encaissés
```

Ordre de grandeur visé au prototype : une partie moyenne entre **25 000 et 40 000**, une très
bonne partie autour de **80 000**, trois arbitres frappés et onze poignées de main pour passer
**100 000**. À caler avec `?seed=` et le bot.

### 3.4 L'écran de fin : le rapport de l'arbitre

Feuille de match tapée à la machine, remplie ligne par ligne au rythme d'un sifflet court :

```
RAPPORT DE L'ARBITRE          France – Paraguay
Joueur concerné : BENÍTEZ (4)

Fautes sifflées ............ 61
  dont par derrière ........ 14
  dont semelles ............  6
  dont sur l'arbitre .......  2
Cartons jaunes .............  3
Cartons rouges .............  2  (joueur toujours sur le terrain)
Arbitres remplacés .........  2
Français évacués ...........  4
Combo maximum .............. ×5
Temps additionnel .......... +9
Buts encaissés ............. 7   (sans importance)

SCORE ...................... 84 350
RECORD ..................... 91 200
```

Puis le **tampon** rouge, en biais, selon le score :

| Score | Tampon |
|---|---|
| moins de 10 000 | **FAIR-PLAY** (c'est une insulte) |
| 10 000 à 30 000 | **RUGUEUX** |
| 30 000 à 60 000 | **BOUCHER** |
| 60 000 à 100 000 | **CARTON PLEIN** |
| 100 000 et plus | **LÉGENDE DU GUARANÍ** |

Cas spéciaux : « EXPULSÉ À LA 67e » barre la feuille si le match s'est fini tôt ;
« MATCH ARRÊTÉ » si les Français ont manqué. Record en `localStorage`, bouton REJOUER,
Espace relance.

---

## 4. Habillage et technique (court, pour le pré-GDD)

- **Visuel** : pixel art 16 bits, palette Endesga 32, même boîte à outils que Cons de mime et
  Attention à la mousse. 640×360 natif, mise à l'échelle entière. Sprites de 24 à 32 px de
  haut, tête un peu grosse, roulades à quatre images.
- **Son** : tout synthétisé (sifflet, impacts, « oh » de la foule, speaker en langue
  inaudible). Une seule ressource enregistrée envisageable : un hymne détourné à l'écran titre.
  M pour couper.
- **Entrées** : Espace, clic droit (menu contextuel bloqué), tap. Aucune autre touche en jeu.
  P pour la pause, Entrée pour passer les cinématiques.
- **Paramètres d'URL** : `?seed=42` rejoue la même partie, `?run=30` raccourcit le match,
  `?debug=1` affiche hitboxes, zone des 40 px, cibles de l'IA et jauge de l'arbitre.
- **Tests** : simulation des règles sans rendu (`node --test`), bot qui joue une partie entière
  dans Chromium pour caler les ordres de grandeur du score.

## 5. Hors périmètre V1

- Deux joueurs, choix d'équipe, autres matchs.
- Vraies tactiques françaises (une 4-4-2 statique qui avance suffit).
- Déplacement manuel du n°4. Si le déplacement automatique s'avère frustrant au prototype,
  l'alternative est la souris ou le doigt qui donnent la direction, le bouton restant le seul
  déclencheur. Décision au premier prototype jouable.

## 6. Questions ouvertes

1. Noms réels ou détournés pour les Français ?
2. La zone poing/tacle à 40 px : valeur de départ, à régler à la main avec l'anneau au sol.
3. Faut-il un plancher de Français sur le terrain (par exemple jamais moins de six) pour éviter
   la partie morte, ou laisser le joueur se punir tout seul ?
4. La haie d'honneur : tous les appuis comptent (facile, festif) ou fenêtre de timing par
   joueur (plus Siuuuu Simulator) ?
