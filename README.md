# DumbGames

Des jeux à la con, un à la fois. Sites statiques, pixel art dessiné au code, zéro dépendance.

- **BARRICASSE** — *Tout fait barricade. Même le poisson.* Un casse-briques défensif à l’envers, en paysage : un cortège de CRS à gauche de la rue envoie de grosses balles d’arcade vers les manifestants à droite, et toi au milieu qui poses où tu veux des meubles livrés depuis une seule icône de stock (superposition permise). L’objet ne protège qu’une fois arrivé ; un canapé encaisse trois balles, un ballon de foot ne sert à rien. Quatre-vingt-dix secondes, quatre événements absurdes. À la souris ou au doigt ; sur un téléphone tenu debout, l’image pivote. Version 3 : score et combos (jusqu’à ×5, annonces, popups), foule animée qui sursaute et applaudit, lumière de fin d’après-midi avec ombres longues, éclats selon la matière, photo souvenir en fin de partie ; la version 1 reste jouable dans `barricasse/v1/`. S’ouvre sans serveur ; `?seed=42` rejoue la même partie, `?debug=1` montre les hitboxes, `node --test barricasse/test/sim.test.js` vérifie les règles.
- **ATTENTION À LA MOUSSE !** — *10 kilomètres d’effort. 20 centimètres de catastrophe.* Une seule touche pour faire sauter les patineurs au-dessus d’un tapis de mousse minuscule, juste après l’arrivée d’une course municipale. Deux minutes : trois sportifs du dimanche au début, une migration de rollers à la fin. Version 2 : intrus à ne pas faire sauter (le maire, une poussette, un chien, le secouriste), débutants qui freinent, tapis rallongé, flash du photographe, pigeons, camion de pompiers, ola. La version 1 reste jouable dans `attention-a-la-mousse/v1/`. Bande-son : l’enregistrement du mème (`mousse.mp3`, seule ressource non dessinée ni synthétisée du site).
- **ONLY FEET** — *Deux minutes pour payer ton loyer.* Des abonnés commandent des photos d'un pied atroce ; tu peins les ongles au pinceau, poses poils, points, bijoux et finitions à la souris ou au doigt, et tu publies. Trois critères, 120 secondes. Un seul `index.html`, s'ouvre sans serveur.
- **LA VÉRITÉ SI JE VENDS !** — *Une seule touche. Aucune dignité.* Un grossiste, une veste léopard violette invendable, des clients dont l'offre monte puis qui se barrent. Soixante secondes.
- **OÙ EST LA VOITURE ?** — *Elle était là il y a deux secondes.* Un bonneteau avec une berline FIFA : tu la trouves toujours, une main la déplace toujours.
- **CTRL + RN** — *Impossible de vider l'historique.* Un clicker absurde de soixante secondes.

Prototypes gardés hors de l'accueil (dossier présent, non listé) :

- **GRAND THEFT FIFA** — *Vous êtes presque arrivé.* Conduite arcade vue du dessus ; le gag administratif tenait, le moteur de conduite demandait trop de travail pour être agréable.

Chaque jeu est un dossier autonome avec son `index.html`, servi tel quel par GitHub Pages.
