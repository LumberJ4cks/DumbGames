# CARTON PLEIN — pré-GDD (v0.2)

*Un Paraguayen. Onze Français. Zéro intention de jouer au ballon.*

Titre de travail. Alternatives : **FAUTE DE MIEUX**, **GUARANÍ VS GAULOIS**, **FRANCE – PARAGUAY (1)**.
Jeu de la collection DumbGames : site statique, un dossier, un `index.html`, zéro dépendance,
pixel art dessiné au code, 640×360 natif.

Changements v0.2 : déplacement manuel (flèches ou joystick pouce gauche), bouton d'attaque
séparé (Espace ou pouce droit) ; les cartons vont aux Français, jamais de rouge direct, le
jaune reste au-dessus de la tête ; plus aucune fin de match anticipée, le Paraguay joue au MMA
et c'est normal ; boost **EN FEU** quand le combo s'emballe.

---

## PANNEAU 1 — Le jeu en une minute

### Le concept

Coupe du monde 2026, France – Paraguay. Les dix autres Paraguayens ont déjà été expulsés.
Il reste **toi**, le numéro 4, seul sur la pelouse face à onze Français.

Les Français **jouent au foot**, pour de vrai : passes, dribbles, tirs, buts.
Toi, **tu ne joues pas au foot**. Tu fais des fautes.
Ce n'est pas un jeu de foot : c'est un jeu de MMA dont les adversaires sont des footballeurs.
Et dans ce monde-là, **c'est normal**. Personne ne t'expulsera jamais.

### L'objectif

**Faire le plus de fautes possible avant le coup de sifflet final.**
Le match dure 90 secondes (une minute de match = une seconde réelle), plus le temps additionnel
que tu auras gagné à force de fautes.

Les buts encaissés sont affichés sur le tableau d'affichage. Ils ne valent **rien**.
0 – 9 à la mi-temps, personne ne s'en soucie, surtout pas toi.

### Comment ça marche

**Deux commandes, pas une de plus.**

| | Clavier | Tactile |
|---|---|---|
| **Se déplacer** | Flèches (ou ZQSD / WASD) | Joystick flottant sous le pouce **gauche** |
| **Frapper** | **ESPACE** | Gros bouton sous le pouce **droit** |

Le bouton de frappe fait **deux choses différentes selon la distance** au Français le plus
proche au moment où tu appuies :

| Distance au Français le plus proche | La touche déclenche | Portée |
|---|---|---|
| **Loin** (plus de 40 px) | **TACLE GLISSÉ** : glissade longue et exagérée, façon Nintendo World Cup, qui fauche tout sur son passage | 110 px |
| **Collé** (40 px ou moins) | **COUP DE POING** : contact immédiat, enchaînable poing → coude → projection, façon Double Dragon | 24 px |

Tu cours vers un Français : appuie tôt, c'est un tacle. Arrive sur lui et appuie, c'est un
poing. Même bouton, deux fautes.

Chaque faute est **sifflée**. L'arbitre accourt, les Français tirent le coup franc, le ballon
repart, et toi avec.

L'arbitre a une **patience**. Tes fautes l'usent. Quand il n'en a plus et que tu commets une
**grosse faute**, il craque et sort un carton… **au Français** que tu viens de frapper. Jaune
d'abord, toujours. Le carton flotte au-dessus de sa tête. Une deuxième grosse faute sur le
même Français, et c'est le **rouge pour la France** : il sort, la France fait entrer n'importe
qui pour le remplacer.

Tu peux **frapper l'arbitre**. C'est la plus grosse faute du jeu.

Quand tes fautes s'enchaînent, la jauge **FUEGO** se remplit. Pleine, le n°4 **prend feu** :
plus rapide, tout ce qu'il touche vole, l'arbitre fuit.

**Score = fautes × combo + cartons donnés à la France + bonus de fin.** À la fin, le tampon
tombe : le rapport de l'arbitre.

---

## 2. Gameplay complet

### 2.1 Le terrain et la caméra

- Vue de dessus légèrement en trois quarts, héritée de Nintendo World Cup : la pelouse défile
  horizontalement, les deux buts aux extrémités, les tribunes pleines en haut de l'écran, les
  bancs et le 4e arbitre en bas.
- La caméra suit le ballon avec un peu d'avance, et s'élargit si le n°4 s'en éloigne : il
  reste toujours dans le cadre. S'il part vraiment trop loin (il va voir le gardien), la caméra
  le suit lui et abandonne le ballon : le foot continue hors champ, le speaker commente.
- Au sol, des **objets ramassables** apparaissent au fil du match (voir 2.6).

### 2.2 Ton joueur : le numéro 4

- Nom de travail : **Teodoro « El Toro » Benítez**, n°4, maillot rayé rouge et blanc, cuisses
  de rugbyman, tête de dessin animé. Fictif.
- **Déplacement libre**, huit directions, vitesse légèrement supérieure à celle des Français :
  tu finis toujours par les rattraper, jamais assez vite pour que le placement ne compte pas.
  Au tactile, le joystick flottant apparaît là où le pouce gauche se pose, comme dans Cons de
  mime.
- Il **ne touche jamais le ballon** : s'il passe dessus, le ballon roule entre ses jambes.
  C'est un gag et une règle : il ne peut pas interférer avec le foot autrement que par la faute.
- Il **ne peut pas être mis KO** et **ne peut pas être expulsé**. Il peut être **étourdi**
  (0,8 s, étoiles autour de la tête) par un ballon de tir surpuissant, une glissade dans le vide
  ou un ballon de rechange ramassé.

### 2.3 Les deux attaques

#### Le tacle glissé (loin)

- Déclenché si aucun Français n'est à 40 px ou moins.
- Glissade rectiligne de 110 px en 0,45 s dans la direction du déplacement (ou la dernière
  direction tenue si le joueur est à l'arrêt), jambe tendue, motte de pelouse qui vole. Tout
  Français touché sur le trajet est fauché (plusieurs d'un coup possible : **DOUBLE**, **TRIPLÉ**).
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
  appuis. Pendant la chaîne, le déplacement est coupé : on frappe ou on bouge.
  1. **POING** : direct, le Français recule d'un pas, étourdi 0,6 s.
  2. **COUDE** : il plie, étourdi 0,8 s.
  3. **PROJECTION** : saisie par le col et envoi au sol, roulade de trois tours, il reste à terre 1,5 s.
- Chacun des trois coups est une faute à part entière, sifflée à part entière. L'arbitre
  siffle trois fois de suite, de plus en plus rouge.
- **Sur un Français au sol** : l'appui donne un **ACHARNEMENT** (petit coup de pied). Peu de
  points, mais c'est une **grosse faute** au sens de l'arbitre (voir 2.5) : c'est le coup qu'on
  garde pour faire sortir un carton.

#### Les grosses fautes

Certaines fautes comptent comme **grosses** pour l'arbitre : PROJECTION, SEMELLE, PAR DERRIÈRE,
CISEAUX, ACHARNEMENT, toute faute avec un objet en main, toute faute sur le gardien. Les
autres (POING, COUDE, TACLE simple) sont des fautes **ordinaires**. La distinction ne change
pas les points, elle change ce que fait l'arbitre.

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
  l'emportent, un remplaçant entre depuis le banc en trottinant.
- **La France ne manque jamais de joueurs.** Cinq vrais remplaçants d'abord. Ensuite, le
  banc fait entrer **n'importe qui**, en maillot enfilé à la va-vite : le kiné, l'intendant, le
  ramasseur de balle, la mascotte, un supporter en marcel, le 4e arbitre lui-même. Ces
  remplaçants de fortune jouent mal (ils ratent leurs passes, le foot devient grotesque) et
  tombent en **une seule faute**, mais ils rapportent comme les autres. Le match ne s'arrête
  jamais faute de combattants : le Paraguay joue au MMA, et c'est normal.
- **Le gardien** reste dans sa surface. L'atteindre coûte un trajet long, ce qui en fait une
  cible chère : **FAUTE SUR LE GARDIEN**.

### 2.5 L'arbitre et les cartons pour la France

- L'arbitre court derrière le jeu, un peu en retrait. **Il siffle tout.** Il n'y a pas de faute
  non vue : le jeu ne récompense pas la discrétion, il récompense le volume.
- Il **ne sanctionne jamais le Paraguay**. Il siffle, il note, il souffle. Dans ce monde, un
  Paraguayen qui fait du MMA, c'est le jeu.
- Il a une **jauge de patience** (le sifflet en bas à gauche, qui rougit en se vidant).
  Chaque faute l'entame : une faute ordinaire un peu, une grosse faute beaucoup. Elle remonte
  lentement quand tu le laisses respirer (5 secondes sans faute pour revenir à moitié).

  | Patience | État de l'arbitre | Ce qui se passe sur une grosse faute |
  |---|---|---|
  | plus de 40 % | Il court, il siffle, il note. | Rien de plus : faute, coup franc. |
  | 40 % à 1 % | **Il râle** : il te fait la morale, doigt levé, il siffle plus fort. | Rien de plus, mais la jauge se vide deux fois plus vite. |
  | **0 %** | **Il craque** : rouge, en sueur, le sifflet coincé entre les dents. | **CARTON POUR LA FRANCE** (voir ci-dessous). |

- **Le carton pour la France.** Quand sa patience est à zéro et que tu commets une grosse
  faute, l'arbitre n'en peut plus, se retourne, et sort un carton **au Français au sol** :
  « Simulation ! », « Relevez-vous ! », « Vous l'avez cherché ! ».
  - **Jamais de rouge direct.** La première fois, c'est un **CARTON JAUNE** : il monte
    au-dessus de la tête du Français et **y reste** pour le reste du match, qui tourne doucement.
    Un Français qui porte un jaune est visible de loin : c'est une cible marquée.
  - Une **seconde grosse faute** sur un Français déjà jaune, patience à zéro à nouveau :
    **CARTON ROUGE POUR LA FRANCE**. Le jaune devient rouge au-dessus de sa tête, il sort en
    protestant, la France fait entrer le suivant (voir 2.4). Gros bonus, bandeau, la foule siffle
    l'arbitre.
  - Sortir un carton **remet sa patience à 60 %** : il s'est défoulé. Il faut la réuser pour
    le prochain. Un carton donné, c'est donc un cycle de jeu : user, cibler un jaune, grosse faute.
  - Le **gardien** carton rouge est le grand moment : il est remplacé par un joueur de champ
    avec des gants trop grands, qui encaisse en marchant.
- **Frapper l'arbitre.** Il est une cible comme une autre, poing ou tacle : **FAUTE SUR
  L'ARBITRE**, la plus grosse du jeu. Il part en roulade, la foule hurle. Effets :
  - sa patience tombe **à zéro** d'un coup : le prochain carton pour la France est prêt ;
  - il reste au sol 2 s et **ne siffle rien** pendant ce temps : les fautes continuent de
    compter, mais à moitié (« PAS VU ») ;
  - relevé, il te **fuit** pendant 5 s, plus vite que toi. Le frapper à nouveau demande de le
    coincer contre une ligne de touche ou dans le tas d'un coup franc.
  - À la **troisième** fois dans le match, il sort sur civière et le **4e arbitre** reprend le
    sifflet : même règles, patience qui s'use 25 % plus vite. Le 4e arbitre est le dernier :
    on ne peut plus changer d'arbitre, mais on peut toujours le frapper.

### 2.6 Objets et armes (Double Dragon)

- Des objets apparaissent au sol à des moments précis ou après certains événements : **drapeau
  de corner**, **bouteille d'eau**, **cône d'entraînement**, **chaussure perdue**, **ballon de
  rechange**.
- Le n°4 **ramasse automatiquement** tout objet qu'il traverse. Il le brandit en courant.
- Le prochain coup de poing utilise l'objet : points doublés, grosse faute garantie, animation
  dédiée, l'objet part en morceaux. Un tacle avec objet en main le lâche sans effet.
- Le **ballon de rechange** est un cas spécial : le ramasser le fait **exploser** entre ses mains
  (il ne peut pas toucher un ballon), étourdi 0,8 s. Contourner le ballon est une compétence.

### 2.7 Combo, multiplicateur, et EN FEU

#### Le combo

- Chaque faute déclenche un chrono de **3 secondes**. Une nouvelle faute avant la fin du chrono
  prolonge la chaîne.
- Multiplicateur selon la longueur de la chaîne : ×1, puis **×2** à 2 fautes, **×3** à 4,
  **×4** à 7, **×5** à 10. Plafond ×5, comme les autres jeux de la collection.
- La chaîne casse : chrono écoulé, **GLISSADE** dans le vide, étourdissement, ou ballon
  explosé.
- Le multiplicateur s'affiche au centre de l'écran avec ses crans et le prochain palier, les
  popups nomment la faute (« PAR DERRIÈRE », « COUDE », « SEMELLE »), un bandeau tombe à chaque
  palier. Même grammaire que Cons de mime.

#### La jauge FUEGO et le boost EN FEU

- Sous le multiplicateur, une jauge **FUEGO** en forme de flamme. Elle se remplit **à chaque
  faute commise à ×3 ou plus** (un cran par faute, deux par grosse faute), et se vide
  lentement quand le combo casse. Elle ne se remplit pas en dessous de ×3 : il faut déjà être
  chaud pour prendre feu.
- Pleine (environ 8 à 10 fautes bien enchaînées), le boost se déclenche **tout seul** :
  bandeau **¡ EN FEU !**, cri de la foule, le n°4 s'embrase : flammes dans le dos, traînée de
  pelouse brûlée, musique qui monte d'un ton.
- **Pendant 6 secondes :**
  - vitesse de course **+60 %** ;
  - **tout Français touché en courant est fauché** : plus besoin d'appuyer, le simple contact
    est une faute (**PERCUTÉ**, 200 points, faute ordinaire) et l'envoie valdinguer trois fois
    plus loin que d'habitude, en renversant ceux qu'il croise (**STRIKE** si trois tombent) ;
  - le bouton reste utile : le tacle devient un **TACLE ENFLAMMÉ** de 200 px qui traverse tout
    le terrain en largeur, le poing devient une projection directe ;
  - tous les points sont **×2** (en plus du combo), le chrono du combo est **gelé** : la chaîne
    ne peut pas casser pendant le feu ;
  - l'**arbitre fuit** en permanence, et une faute sur lui pendant le feu vaut double ;
  - les Français **paniquent** : ils lâchent le ballon et s'écartent de la trajectoire, ce qui
    les regroupe sur les lignes de touche. Le feu les pousse dans les coins, le joueur les y
    cueille.
- Fin du boost : le n°4 fume, la jauge est vide, le combo reprend son cours normal là où il
  en était. Deux, parfois trois boosts dans un match bien mené, dont un en temps additionnel si
  on le garde pour la fin.

### 2.8 Les événements à heure fixe

Le match dure 90 secondes, une seconde par minute de jeu. Événements scriptés, dans l'ordre :

| Minute | Événement |
|---|---|
| 0' | Coup d'envoi. Onze Français alignés au centre, toi seul en face. Le speaker annonce « …et pour le Paraguay : Benítez. » Silence. |
| 12' | **Le ramasseur de balle** traverse le terrain pour rendre un ballon. Le frapper n'est pas une faute (il n'est pas joueur) : « HORS SUJET », zéro point, combo cassé. Première fausse cible. Plus tard dans le match il peut entrer comme remplaçant, et là il compte. |
| 23' | **TIR SURPUISSANT** : l'attaquant star arme son tir spécial, le ballon prend feu, la caméra tremble. Si tu le fauches pendant l'armement (1,5 s) : **TIR ANNULÉ**, gros bonus. Sinon le ballon traverse le terrain, et toi si tu es sur la trajectoire. |
| 45' | **MI-TEMPS : LE TUNNEL.** Les Français rentrent au vestiaire en file. Niveau bonus de 8 secondes dans le couloir, en vue de côté, défilement horizontal pur Double Dragon : la file avance, toi derrière, les fautes dans le tunnel valent ×1,5. L'arbitre est déjà dans son vestiaire : sa patience ne bouge pas, pas de carton possible, mais la jauge FUEGO se remplit normalement. |
| 46' | Reprise. L'arbitre revient calmé : patience remontée à 100 %. |
| 61' | **Triple remplacement** : trois Français frais trottinent depuis le banc, les trois ensemble, le long de la ligne de touche. Couloir de fautes. |
| 72' | **LE SÉLECTIONNEUR** entre sur la pelouse pour protester auprès de l'arbitre. Il y reste 6 secondes. Le toucher : **FAUTE SUR LE STAFF**, et l'arbitre, s'il est à zéro de patience, le carde lui aussi : expulsé du banc, il regarde la fin en tribune. |
| 85' | **Annonce du temps additionnel** : le 4e arbitre lève le panneau. Le nombre affiché est calculé sur **tes** fautes : une seconde par tranche de six fautes, plafonné à 15. Plus tu as fauté, plus tu joues. |
| 90'+ | Temps additionnel. Les fautes valent **×2** (en plus du combo). La foule compte à rebours. |
| Fin | Coup de sifflet final, puis **LA HAIE D'HONNEUR** (voir 3.1). |

Les minutes exactes sont indicatives : à régler au prototype pour que les buffets (coups
d'envoi après but) ne tombent pas sur les événements.

### 2.9 La boucle

**Micro-boucle (2 à 5 secondes), celle qu'on répète cent fois :**

1. Tu cours vers le ballon ou vers un Français isolé. Les Français jouent.
2. Un Français arrive à portée : tu lis la distance.
3. Tu appuies : tacle de loin, ou poing si tu as attendu d'être collé.
4. Faute, popup, sifflet, patience qui baisse, combo qui monte, FUEGO qui monte à partir de ×3.
5. Coup franc : les Français se regroupent 1,2 s. Tu enchaînes sur le tas (poing, coude,
   projection) ou tu repars tacler le prochain.
6. Le ballon repart. Retour en 1.

**Boucle de l'arbitre (15 à 25 secondes) :**

1. Tes fautes vident sa patience.
2. À zéro, tu choisis la victime : de préférence un Français qui porte déjà un jaune.
3. Grosse faute (projection, semelle, acharnement, objet) : carton.
4. Patience à 60 %, on recommence. Ou on le frappe pour la remettre à zéro tout de suite,
   au prix de 2 secondes de fautes à moitié comptées et de 5 secondes de course-poursuite.

**Boucle de match (90 secondes), celle qui donne le rythme :**

- Les Français marquent toutes les 10 à 15 secondes puisque personne ne défend. Chaque but
  renvoie tout le monde au centre : c'est le **gros buffet** périodique.
- Un carton pour la France toutes les 15 à 25 secondes, trois à cinq par match, un ou deux
  rouges.
- Deux ou trois boosts EN FEU, qui déplacent les Français vers les touches et les coins et
  changent la géographie du terrain pendant 6 secondes.
- Les vrais remplaçants s'épuisent vers la 60e ; les remplaçants de fortune qui suivent sont
  des cibles faciles qui jouent n'importe comment : la fin de match est plus grotesque, pas
  plus vide.
- Les événements injectent une cible rare toutes les 10 à 15 secondes (star, staff, tunnel).
- Le temps additionnel récompense le volume de fautes avec… du temps pour faire des fautes.

**Boucle de session :** record en `localStorage`, tampon final à comparer, `?seed=` pour rejouer
la même partie. Une partie dure moins de deux minutes, on relance.

### 2.10 Sensations à atteindre

- **Lisibilité du choix** : un anneau discret au sol autour du n°4 marque la zone des 40 px.
  Un Français dedans, l'anneau passe au rouge : appuyer donnera un poing.
- **Lisibilité de l'arbitre** : sa jauge est son visage. À zéro, il est cramoisi et tout le
  monde le voit, même sans regarder le HUD. Les jaunes flottent au-dessus des têtes, les cibles
  marquées se lisent de loin.
- **Impact** : arrêt sur image de 2 à 3 frames à chaque contact, secousse d'écran, motte de
  pelouse, roulade exagérée du Français (il roule trois fois, comme à la télé). En feu, tout est
  plus grand, plus loin, plus fort.
- **Le foot continue** : même pendant tes conneries, le ballon circule, le speaker commente les
  buts, le tableau d'affichage tourne. Le contraste fait le gag.

---

## 3. La fin et le calcul du score

### 3.1 Le coup de sifflet final

Une seule fin : le match va **toujours** à son terme. Pas d'expulsion, pas de match arrêté.

Au coup de sifflet final (90' plus le temps additionnel), les Français lèvent les bras, et
viennent te serrer la main : **LA HAIE D'HONNEUR**. Les onze présents défilent devant toi en
6 secondes, main tendue, les cartons toujours au-dessus des têtes. Pendant la haie, tu ne te
déplaces plus : chaque appui au bon moment transforme la poignée de main en coup de poing :
**POIGNÉE DE MAIN**, faute d'après-match, l'arbitre n'y peut plus rien. Dernier petit combo, puis
l'écran de score.

Si tu es **EN FEU** au coup de sifflet, le feu continue pendant la haie : les onze poignées de
main partent toutes seules, en cascade. C'est la fin qu'on cherche à obtenir.

### 3.2 Les points

Points de base par faute, avant multiplicateur :

| Faute | Points | Grosse ? | Comment |
|---|---|---|---|
| POING | 100 | non | 1er coup de la chaîne |
| COUDE | 150 | non | 2e coup |
| PROJECTION | 300 | **oui** | 3e coup |
| ACHARNEMENT | 50 | **oui** | sur un joueur au sol |
| TACLE | 200 | non | glissade, contact de face ou de côté |
| PAR DERRIÈRE | 400 | **oui** | glissade, le Français te tournait le dos |
| SEMELLE | 500 | **oui** | glissade, contact dans la seconde moitié |
| CISEAUX | +300 | **oui** | deux Français dans la même glissade (en plus de leurs fautes) |
| PERCUTÉ | 200 | non | contact en courant, uniquement EN FEU |
| POIGNÉE DE MAIN | 250 | non | haie d'honneur |
| FAUTE SUR LE GARDIEN | 600 | **oui** | n'importe quel coup sur le gardien |
| FAUTE SUR LE STAFF | 1 500 | **oui** | le sélectionneur, 72e minute |
| FAUTE SUR L'ARBITRE | 2 000 | **oui** | poing ou tacle sur l'arbitre |
| TIR ANNULÉ | 1 000 | **oui** | star fauchée pendant l'armement, 23e |

Modificateurs cumulables sur une même faute :

| Modificateur | Effet |
|---|---|
| Sur le porteur du ballon | ×1,5 |
| Sur un Français qui porte un jaune | ×1,5 |
| Dans la surface de réparation (c'est un penalty) | +250 |
| Avec un objet en main | ×2 |
| Dans le tunnel (mi-temps) | ×1,5 |
| EN FEU | ×2 |
| Temps additionnel | ×2 |
| Arbitre au sol (« PAS VU ») | ×0,5 |
| Combo | ×1 à ×5 |

Bonus hors fautes :

| Bonus | Points |
|---|---|
| Carton jaune donné à la France | 1 000 chacun |
| Carton rouge donné à la France | 3 000 chacun |
| Gardien expulsé | +2 000 en plus du rouge |
| Sélectionneur expulsé | +2 000 |
| Boost EN FEU déclenché | 500 chacun |
| STRIKE (trois Français renversés d'un coup EN FEU) | 1 000 chacun |
| Arbitre sorti sur civière | 2 500 |
| Temps additionnel obtenu | 100 par seconde |
| Buts encaissés | **× 0**, affiché quand même |

### 3.3 La formule

```
SCORE = Σ sur chaque faute ( points de base × modificateurs × combo )
      + 1 000 × cartons jaunes donnés à la France
      + 3 000 × cartons rouges donnés à la France
      + bonus spéciaux (gardien, sélectionneur, STRIKE, arbitre sur civière)
      +   500 × boosts EN FEU
      +   100 × secondes de temps additionnel
      +     0 × buts encaissés
```

Ordre de grandeur visé au prototype : une partie moyenne entre **30 000 et 50 000**, une très
bonne partie autour de **100 000**, deux rouges, trois boosts et une haie d'honneur en feu pour
passer **150 000**. À caler avec `?seed=` et le bot.

### 3.4 L'écran de fin : le rapport de l'arbitre

Feuille de match tapée à la machine, remplie ligne par ligne au rythme d'un sifflet court :

```
RAPPORT DE L'ARBITRE          France – Paraguay
Joueur concerné : BENÍTEZ (4)   Sanction : aucune (normal)

Fautes sifflées ............ 74
  dont grosses fautes ...... 31
  dont par derrière ........ 14
  dont sur l'arbitre .......  3
Cartons jaunes (France) ....  4
Cartons rouges (France) ....  2
Arbitres évacués ...........  1
Français évacués ...........  5
Boosts EN FEU ..............  3
Combo maximum .............. ×5
Temps additionnel .......... +12
Buts encaissés ............. 8   (sans importance)

SCORE ...................... 112 350
RECORD ..................... 118 900
```

Puis le **tampon** rouge, en biais, selon le score :

| Score | Tampon |
|---|---|
| moins de 15 000 | **FAIR-PLAY** (c'est une insulte) |
| 15 000 à 40 000 | **RUGUEUX** |
| 40 000 à 80 000 | **BOUCHER** |
| 80 000 à 150 000 | **CARTON PLEIN** |
| 150 000 et plus | **LÉGENDE DU GUARANÍ** |

Record en `localStorage`, bouton REJOUER, Espace relance.

---

## 4. Habillage et technique (court, pour le pré-GDD)

- **Visuel** : pixel art 16 bits, palette Endesga 32, même boîte à outils que Cons de mime et
  Attention à la mousse. 640×360 natif, mise à l'échelle entière. Sprites de 24 à 32 px de
  haut, tête un peu grosse, roulades à quatre images. Cartons au-dessus des têtes en 6×8 px
  qui tournent sur eux-mêmes ; flammes du boost en trois tons de la palette.
- **Son** : tout synthétisé (sifflet, impacts, « oh » de la foule, speaker en langue
  inaudible, ronflement du feu). Une seule ressource enregistrée envisageable : un hymne
  détourné à l'écran titre. M pour couper.
- **Entrées** : flèches / ZQSD / WASD pour se déplacer, Espace pour frapper. Au tactile,
  joystick flottant à gauche et bouton de frappe à droite, avec l'anneau de la jauge FUEGO
  autour du bouton. Manette : stick gauche et bouton A. P pour la pause, Entrée pour passer les
  cinématiques.
- **Paramètres d'URL** : `?seed=42` rejoue la même partie, `?run=30` raccourcit le match,
  `?debug=1` affiche hitboxes, zone des 40 px, cibles de l'IA, patience de l'arbitre et FUEGO.
- **Tests** : simulation des règles sans rendu (`node --test`), bot qui joue une partie entière
  dans Chromium pour caler les ordres de grandeur du score.

## 5. Hors périmètre V1

- Deux joueurs, choix d'équipe, autres matchs.
- Vraies tactiques françaises (une 4-4-2 statique qui avance suffit).
- Remplaçants de fortune avec des comportements propres (la mascotte qui danse, le kiné qui
  soigne) : en V1 ils jouent comme des Français maladroits et tombent en un coup.

## 6. Questions ouvertes

1. Noms réels ou détournés pour les Français ?
2. La zone poing/tacle à 40 px : valeur de départ, à régler à la main avec l'anneau au sol.
3. Durée du boost EN FEU : 6 secondes de base. Faut-il qu'il se prolonge à chaque faute
   commise pendant le feu (jusqu'à 10 s), pour récompenser le joueur qui ne lâche pas ?
4. La haie d'honneur : tous les appuis comptent (facile, festif) ou fenêtre de timing par
   joueur (plus Siuuuu Simulator) ?
5. L'arbitre frappé « PAS VU » à ×0,5 : assez dissuasif pour que frapper l'arbitre reste un
   choix et pas un réflexe ? À tester.
