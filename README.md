# Laura l'exploratrice 🌾☀️🐈

Jeu web façon Mario/run-and-gun, **100 % côté client, sans serveur**, fait pour
l'anniversaire de Laura (docteure en agroclimato). On incarne **Laura**, qui prépare son
**PhD sur l'agrivoltaïsme** (panneaux solaires au-dessus des rizières). Elle ramasse des
**données** et des **pages de thèse**, lance des **graines / pieds de riz** et son **chat
angora**, et gagne **un chapitre** en battant le boss de chaque niveau. Après **5 niveaux**
elle affronte le **jury de thèse** et décroche son **PhD**. Style _Dora l'exploratrice_ /
_Animal Crossing_.

- **5 boss différents** (1 gameplay par boss) : RStudio, le propriétaire terrien, Cendrine
  (l'administration), l'agriculteur fou, Michael Dingkhun — puis le **jury** (mégaboss multi-phases).
- **Carte du monde** (overworld) façon Dora, **3 sauvegardes** type borne d'arcade.
- **Publication cachée** dans chaque niveau (en hauteur) pour le 100 %.
- Personnages **animés** (grilles de sprites) — placeholders à remplacer par tes assets
  (toutes les propriétés sont dans **[`SPRITES.md`](SPRITES.md)**).

> Le _gameplay_ de plateforme est volontairement conservé tel quel ; tout le reste (histoire,
> niveaux, boss, collectibles, sauvegardes) est paramétrable.

---

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
| Bouger            | Flèches ← →  ou  Q/D (ou A/D)                  |
| Sauter (×2)       | Espace, Z ou W                                |
| Viser / s'accroupir | ↑ ↓ (en l'air = viser le tir ; **au sol, ↓ = s'accroupir**) |
| Lancer (arme)     | X ou Entrée — droit = **rafale** ; cloche (cookie/gâteau) = **charge** (plus loin) ; **consomme de l'énergie** |
| Sort « Pleurer »  | C  (inonde + repousse les ennemis)            |
| Sort « Râler »    | V  (bouclier + assomme)                        |
| Lancer le **chat**| B  (**maintenir ~2 s**, court au sol, nettoie une zone) |
| Changer d'arme    | Maj  (4 armes)                                |

Sur l'écran-titre : **Espace** → choix de la **sauvegarde** (A/B/C) → **carte du monde**
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

### 2. Régler le gameplay & le scénario → `js/config.js`
Tout y est commenté : vitesse, saut, dégâts, points de vie, cooldown des sorts,
**énergie = munitions** (`sun` + `ammoTypes[].cost`), stats des ennemis/boss, le **chat**
(`cat`, dont `chargeTime` = durée de maintien de B), contrôles, et **les textes**
(`story.*` : titre, intro, messages de victoire/défaite…).

Deux réglages pratiques :
- `art` — **haute définition** : `scale` (les PNG sont dessinés à `scale`× la taille
  affichée ; le jeu divise par `scale`) et `pixelDensity` (finesse du rendu).
- `cheats` — touches de test **(1‑6 = aller au niveau, 0 = finir, G = mode dieu,
  H = tout refaire le plein)**. ⚠️ **Mets `cheats: false` pour la version cadeau.**

### 3. Dessiner le niveau → `js/level.js`
Le niveau est une grille **ASCII** (1 caractère = 1 case). Légende :

```
' ' vide   '=' sol   '-' plateforme (panneau solaire)   '@' départ de Laura
'o' rayon de soleil   'c' café (soin)   'k' croquette (recharge le chat)
'd' data   'p' page de thèse   'P' PUBLICATION cachée (1/niveau -> 100 %)
'^' caillou   'T' camion   'A' assureur   'R' rapport ADEME
'V' corbeau (vole)   'J' criquet (saute)   'B' boss   '*' sortie = chapitre
```

Déplace les caractères pour replacer ennemis/objets, allonger le niveau, etc.
La caméra ne défile **qu'en X** : tout tient sur 11 rangées de haut (les publis `P` se
planquent en haut, au bout d'un escalier de panneaux `-`). Le boss du `'B'` est choisi par
le champ `boss:` du niveau. On écrit le chapitre en touchant la sortie `'*'` **après avoir
battu le boss**. L'ordre des niveaux est `CONFIG.levels` (`niveau1..5` + `jury`), et la carte
du monde est décrite par `CONFIG.world.nodes`. L'IA des 6 boss est dans `js/bosses.js`.

### 🗂️ Sauvegardes (3 slots) & carte
- 3 slots type arcade (`js/save.js`, `localStorage`). Chaque slot retient chapitres, publis,
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
js/level.js           🗺️  les niveaux en ASCII
js/bosses.js          🤖  l'IA des 6 boss
js/save.js            💾  les 3 sauvegardes (localStorage)
js/game.js            🎮  le moteur du jeu
assets/sprites/*.png  les 35 sprites (propriétés : SPRITES.md)
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
