# Laura Quest — Les explorateurs 🌾☀️🐈

Jeu web façon Mario/run-and-gun, **100 % côté client, sans serveur**, fait pour
l'anniversaire de Laura (docteure en agroclimato). On incarne **Laura**, qui prépare son
**PhD sur l'agrivoltaïsme** (panneaux solaires au-dessus des rizières). Elle ramasse des
**données** et des **pages de thèse**, lance des **graines / pieds de riz** et son **chat
angora**, et gagne **un chapitre** en battant le boss de chaque niveau. Après **5 niveaux**
elle affronte le **jury de thèse** et décroche son **PhD**. Style _Dora l'exploratrice_ /
_Animal Crossing_.

- **5 boss différents** (1 gameplay par boss) : RStudio, le propriétaire terrien, Cendrine
  (l'administration), l'agriculteur fou, Michael Dingkhun — puis le **jury** (mégaboss multi-phases).
- **Cartes du monde** propres à chaque aventure, **3 sauvegardes par personnage**.
- **Publication cachée** dans chaque niveau (en hauteur) pour le 100 %.
- Personnages **animés** (grilles de sprites) — placeholders à remplacer par tes assets
  (toutes les propriétés sont dans **[`SPRITES.md`](SPRITES.md)**).

> Le _gameplay_ de plateforme est volontairement conservé tel quel ; tout le reste (histoire,
> niveaux, boss, collectibles, sauvegardes) est paramétrable.

---

## Personnages et aventures

Laura conserve ses cinq chapitres et son jury. **Marcos** possède une skin de profil
créée avec Imagegen, basée sur `head_npc_h_25`, sa tenue d'exploration et le style
de Laura. Huit feuilles couvrent repos, course, saut, lancer, blessure,
accroupissement, dash et K.O. Sa silhouette est plus grande que celle des PNJ.
Son premier parcours, **Escale au port**, comprend une carte, un niveau court,
un boss et une conclusion. Le port vient aussi d'Imagegen ; tuiles, objets,
musique et animations du boss sont partagés.

Le **chat est la spécialité de Laura** (`abilities.cat`). Marcos n'a ni commande
chat, ni charges, ni médaille « sauvés ». Ses croquettes deviennent des rayons
de soleil. Les médailles temps et collecte restent accessibles.

Le choix du personnage fonctionne au clavier, à la souris et au tactile. Le retour
remonte les écrans ; reprendre une sauvegarde passe directement à sa carte.
L'effacement demande une confirmation (E à nouveau pour effacer, Entrée / Échap
pour annuler). Le zoom desktop s'adapte désormais aux petites fenêtres.

### Ajouter du contenu

1. Créer `levels/<identifiant_stable>.txt` et sa définition dans `js/level.js`
   (boss, thème, musique, `par`, grille). `python3 gen_levels_data.py` embarque
   automatiquement les fichiers dont le nom suit `[a-z][a-z0-9_]*.txt`.
2. Déclarer l'aventure dans `js/campaigns.js` : `id`, `levels`, `world.nodes`
   dans le même ordre, `world.background`, `story`, `screens`, `music`.
   `finalLevel` est optionnel : si présent, il doit désigner le dernier niveau,
   évalué comme le jury (temps seul). Sinon le dernier niveau garde ses
   médailles adaptées aux capacités du personnage, son récapitulatif, puis affiche la conclusion.
3. Ajouter le personnage dans `js/characters.js` : `id`, `name`, `campaign`,
   `tagline`, `description`, `accent`, `preview`. Le menu affiche automatiquement
   deux cartes par page. Chaque nouveau personnage reçoit trois slots distincts.
4. Pour son apparence, fournir un `rig` (corps animé, tête, variantes KO, positions
   et clips) ou un dictionnaire `sprites` qui associe les noms `hero_*` partagés à
   ses feuilles dédiées (`null` désactive un calque partagé). `abilities.cat`
   active la mécanique du chat pour ce personnage. Déclarer les animations dans `CONFIG.anims`. Les propriétés
   `player` et `equipment` peuvent surcharger les réglages communs. Les champs
   absents sont partagés ; la configuration de base n'est pas mutée au changement
   de personnage. Les identités des PNJ restent dans `js/npc.js`.
5. Après les assets : `python3 gen_assets_data.py`. Puis lancer
   `node tools/check_campaigns.js`, `python3 tools/check_levels.py` et vérifier
   le nouveau parcours dans le navigateur. Ajouter sa géométrie à `META` dans
   `tools/check_levels.py` pour le contrôle de portée et de placement.

Les résultats v3 sont stockés par **identifiant de niveau**, avec les niveaux
débloqués et le curseur par identifiant. Ajouter / réordonner les niveaux ne décale
pas les résultats. Un niveau ajouté après un niveau fini devient accessible ; les
résultats d'un niveau temporairement retiré restent conservés. Ne pas renommer les
identifiants de personnage, aventure ou niveau déjà publiés sans migration explicite.
Les anciens slots `lauraquest_slot_*` sont migrés à leur première lecture vers
`lauraquest_v3_laura_*` ; leur source est conservée jusqu'à un effacement volontaire.
Les préférences audio restent communes. Si le stockage échoue, la partie continue
avec une sauvegarde en mémoire pour la session.

Raccourcis de test (sauvegardes jetables, aucun vrai slot modifié) :
`#gameauto`, `#game/marcos`, `#gameauto/marcos`, `#map/marcos`,
`#chapterscreen0/marcos`, `#winscreen/marcos`. `#characters` ouvre le sélecteur.

Le smoke navigateur optionnel se lance avec `node tools/smoke_campaigns.cjs`
si Playwright est disponible (directement ou via `NODE_PATH`). Il utilise des
contextes isolés, le canal Edge sur Windows et écrit ses captures ignorées dans
`_campaigngen/checks/`.

Le runtime reste entièrement statique et compatible `file://`. Les assets sont
encore chargés ensemble au démarrage ; leur découpage par aventure reste une
évolution distincte du registre de contenu.

## ▶️ Lancer le jeu

**100 % frontend, aucun serveur.** Les assets sont embarqués en base64
(`js/assets_data.js`), donc :

- **En local** : double-clique `index.html` (ça s'ouvre en `file://` et ça marche).
- **Déploiement** : pose le dossier tel quel sur n'importe quel hébergeur statique
  (GitHub Pages, Netlify, itch.io, Vercel static…). Pas de backend, pas de build.

> Astuce : `index.html#game` démarre direct le niveau (raccourci dev),
> `index.html#gameauto` lance un mode autopilote de test.

> Si jamais tu retires les assets embarqués, tu peux aussi servir le dossier
> avec `python3 -m http.server 8000` puis ouvrir `http://localhost:8000`.

### ⌨️ Le clavier ne répond pas ?
Clique une fois **dans le jeu** (le canvas doit avoir le focus). Le jeu force et
re-attrape le focus automatiquement, mais un clic dans la fenêtre lève tout doute.

## 🎮 Contrôles (configurables)

| Action            | Touches                                       |
|-------------------|-----------------------------------------------|
| Bouger | Flèches gauche/droite ou Q/D |
| Sauter (×2) | Haut, Z ou W ; relâcher tôt pour un petit saut |
| Tir de base | Espace |
| Lob chargé | Maintenir X, puis relâcher |
| Dash | Maj |
| Chat | C |
| S'accroupir / descendre d'une plateforme | Bas / Bas + saut |
| Pause / retour | Échap |
| Son / musique | S / M (préférences globales) |

Sur l'écran-titre : **Espace** → **personnage** → **sauvegarde du personnage** (A/B/C) → présentation de la nouvelle aventure → **carte du monde**
(flèches pour choisir un chapitre débloqué, Espace pour entrer). On gagne un chapitre en
battant le boss puis en touchant la sortie `*`.

> L'**énergie** (jauge « soleil ») sert aussi de **munitions** : chaque tir en consomme
> (les pieds de riz plus que les graines). On en perd un peu en continu, et des rayons de
> soleil apparaissent pendant les combats de boss pour se recharger.

---

## 🛠️ Tout customiser

### 1. Changer un asset (le plus simple)
Remplace n'importe quel fichier dans `assets/sprites/` ou `assets/sounds/` par le tien,
**en gardant le même nom**. La liste complète des sprites — taille, nombre de frames,
ancre, sens du regard, rôle — est dans **[`SPRITES.md`](SPRITES.md)**.

⚠️ Comme les assets sont **embarqués** (`js/assets_data.js`), après avoir remplacé un
fichier il faut **ré-embarquer** pour que le changement soit pris en compte :
```bash
python3 gen_assets_data.py
```

> 🎞️ **Grilles d'animation** : les sprites animés sont des **feuilles** (bande horizontale
> de N frames). Le découpage est décrit dans `CONFIG.anims` (`sliceX` = nb de frames +
> `anims`). Si tu remplaces un sprite animé par un autre nombre de frames, **ajuste le
> `sliceX`** correspondant dans `js/config.js`.

### 2. Régler le gameplay → `js/config.js`, le scénario → `js/campaigns.js`
Tout y est commenté : vitesse, saut, dégâts, points de vie, cooldown des sorts,
**énergie = munitions** (`sun` + `ammoTypes[].cost`), stats des ennemis/boss, le **chat**
(`cat`), contrôles et textes communs. Les aventures surchargent `story` dans
`js/campaigns.js` (intro, messages, conclusion, textes par identifiant de niveau).

Deux réglages pratiques :
- `art` — **haute définition** : `scale` (les PNG sont dessinés à `scale`× la taille
  affichée ; le jeu divise par `scale`) et `pixelDensity` (finesse du rendu).
- `cheats` — touches de test **(1‑6 = aller au niveau, 0 = finir, G = mode dieu,
  Suppr = tout refaire le plein)**. ⚠️ **Mets `cheats: false` pour la version cadeau.**

### 3. Dessiner le niveau → `levels/*.txt` et `js/level.js`
Le niveau est une grille **ASCII** (1 caractère = 1 case). Légende :

```
' ' vide   '=' sol   '-' plateforme (panneau solaire)   '@' départ de Laura
'o' rayon de soleil   'c' café (soin)   'k' croquette (recharge le chat)
'd' data   'p' page de thèse   'P' PUBLICATION cachée (1/niveau -> 100 %)
'^' caillou   'T' camion   'A' assureur   'R' rapport ADEME
'V' corbeau (vole)   'J' criquet (saute)   'B' boss   '*' sortie = chapitre
```

Déplace les caractères pour replacer ennemis/objets, allonger le niveau, etc.
La caméra suit horizontalement le joueur ; les marqueurs `|` permettent aussi
des sections verticales (voir la légende complète dans `js/level.js`). Le boss du `'B'` est choisi par
le champ `boss:` du niveau. On écrit le chapitre en touchant la sortie `'*'` **après avoir
battu le boss**. L'ordre des niveaux et la carte sont décrits par `levels` et
`world.nodes` de l'aventure dans `js/campaigns.js`. Le parcours Laura reprend les
valeurs historiques de `CONFIG.levels` / `CONFIG.world`. Les IA partagées des boss
sont dans `js/bosses.js` ; plusieurs boss peuvent réutiliser la même IA.

### 🗂️ Sauvegardes (3 slots par personnage) & carte
- 3 slots par personnage (`js/save.js`, `localStorage`). Chaque slot retient chapitres, publis,
  % de données, meilleur score et progression de la carte.
- ⚠️ **En `file://` sous Chrome**, `localStorage` peut être bloqué : les slots marchent alors
  pour la session mais **ne persistent pas**. Pour garder les sauvegardes : sers le dossier
  via `python3 -m http.server` ou déploie-le (itch.io / GitHub Pages).

---

## 📂 Structure

```
index.html            point d'entrée
engine/kaplay.js      moteur de jeu KAPLAY (embarqué en local, MIT)
js/assets_data.js     🧩  assets en base64 (généré) → marche sans serveur
js/config.js          ⚙️  tous les réglages + textes (+ bloc `art` HD, flag `cheats`)
js/level.js           🗺️  boss et thèmes des niveaux (grilles : levels/*.txt)
js/campaigns.js       aventures, cartes, narration et écrans
js/characters.js      personnages jouables, apparence, aventure associée
js/bosses.js          🤖  l'IA des 6 boss
js/save.js            💾  3 sauvegardes par personnage (localStorage)
js/game.js            🎮  le moteur du jeu
assets/sprites/*      sprites / fonds partagés (propriétés : SPRITES.md)
assets/sounds/*.wav   les 8 bruitages
gen_assets_data.py    ré-embarque js/assets_data.js après un changement d'asset
SPRITES.md            propriétés de chaque sprite (taille, frames, ancre, rôle…)
```

## ⚠️ Bon à savoir
- **Accents** : la police bitmap par défaut de KAPLAY gère mal les accents, donc les
  textes à l'écran sont sans accents. Pour de vrais accents : déposer une police TTF dans
  `assets/`, faire `loadFont("ui", "assets/maPolice.ttf")` et ajouter `font: "ui"` aux
  appels `text(...)` dans `js/game.js`.

## Crédits
Moteur : [KAPLAY](https://kaplay.com) (MIT). Jeu & assets : faits maison pour Laura. 💛
