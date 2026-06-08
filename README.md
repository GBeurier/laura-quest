# Laura Quest 🌾☀️

Petit jeu web façon Mario/run-and-gun, **100 % côté client, sans serveur**, fait pour
l'anniversaire de Laura (docteure en agroclimato). On incarne **un pot de riz à roulettes**
qui suit le soleil jusqu'à la soutenance, évite cailloux, camions, assureurs et rapports de
l'ADEME, et affronte ses **directeurs de thèse** en boss. Style _Dora l'exploratrice_.

> Première démo jouable. Tout est rangé et paramétrable pour la « passe sérieuse » d'après.

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

| Action            | Touches                          |
|-------------------|----------------------------------|
| Bouger            | Flèches ← →  ou  Q/D (ou A/D)     |
| Sauter (×2)       | Espace, ↑, Z ou W                 |
| Tirer             | X ou Entrée (maintenir = rafale)  |
| Sort « Pleurer »  | C  (inonde + repousse les ennemis)|
| Sort « Râler »    | V  (bouclier + assomme)           |
| Changer de munition | Maj  (graines → cookies → gâteaux) |

---

## 🛠️ Tout customiser

### 1. Changer un asset (le plus simple)
Remplace n'importe quel fichier dans `assets/sprites/` ou `assets/sounds/` par le tien,
**en gardant le même nom**. Tailles indicatives : héros ~64×76, ennemis ~48–108 px,
boss ~124×140, tuiles 48×48, soleil 128×128.

⚠️ Comme les assets sont **embarqués** (`js/assets_data.js`), après avoir remplacé un
fichier il faut **régénérer** cet embarqué pour que le changement soit pris :
```bash
python3 gen_assets_data.py
```

Liste des sprites : `hero_idle/run/jump/hurt`, `ammo_graine/cookie/gateau`,
`enemy_caillou/camion/assureur/ademe`, `boss_directeur1/2`, `pickup_sunray/cafe`,
`sun_goal`, `tile_soil/panel`, `heart`, `fx_tear/grumble`, `bg_field/cloud`.
Voir `montage.png` pour la planche-contact de tout le casting.

### 2. Régler le gameplay & le scénario → `js/config.js`
Tout y est commenté : vitesse, saut, dégâts, points de vie, cooldown des sorts,
jauge soleil, stats des ennemis/boss, munitions, contrôles, et **les textes**
(`story.*` : titre, intro, messages de victoire/défaite…).

### 3. Dessiner le niveau → `js/level.js`
Le niveau est une grille **ASCII** (1 caractère = 1 case). Légende :

```
' ' vide      '=' sol        '-' plateforme (panneau solaire)   '@' départ héros
'o' rayon de soleil   'c' café (soin)   '^' caillou   'T' camion
'A' assureur   'R' rapport ADEME   'B' boss   '*' soleil = sortie
```

Déplace les caractères pour replacer ennemis/objets, allonger le niveau, etc.
Le boss du `'B'` est choisi par le champ `boss:` du niveau. On gagne en touchant le
soleil `'*'` **après avoir battu le boss**.

### 4. Re-générer les assets « source » (optionnel)
Les sprites sont dessinés en vectoriel via `artkit.py` (palette + helpers communs)
et un script par sprite `gen_<nom>.py`. Pour retoucher un sprite :

```bash
# édite gen_hero_idle.py puis :
python3 gen_hero_idle.py        # réécrit assets/sprites/hero_idle.png
python3 gen_sounds.py           # réécrit les bruitages
python3 gen_montage.py          # régénère montage.png (planche-contact)
```

---

## 📂 Structure

```
index.html            point d'entrée
engine/kaplay.js      moteur de jeu KAPLAY (embarqué en local, MIT)
js/assets_data.js     🧩  assets en base64 (généré) → marche sans serveur
js/config.js          ⚙️  tous les réglages + textes
js/level.js           🗺️  le(s) niveau(x) en ASCII
js/game.js            🎮  le moteur du jeu
assets/sprites/*.png  les 23 sprites (sources des assets embarqués)
assets/sounds/*.wav   les 8 bruitages
artkit.py, gen_*.py   sources des assets (cairo / numpy) — pour re-générer
gen_assets_data.py    re-génère js/assets_data.js après un changement d'asset
test_keys.py          test clavier headless (dev) ; montage.png = planche-contact
```

## ⚠️ Bon à savoir
- **Accents** : la police bitmap par défaut de KAPLAY gère mal les accents, donc les
  textes à l'écran sont sans accents. Pour de vrais accents : déposer une police TTF dans
  `assets/`, faire `loadFont("ui", "assets/maPolice.ttf")` et ajouter `font: "ui"` aux
  appels `text(...)` dans `js/game.js`.
- Vérifié en headless (Chrome, build `file://` sans serveur) : chargement des assets
  embarqués, écran titre + niveau, et **vraies touches** clavier — déplacement (lettres),
  saut (espace) et tir (x) répondent ; sorts/collisions/score/caméra OK. Pense quand même
  à playtester la run complète jusqu'au boss + soleil dans ton navigateur.

## Crédits
Moteur : [KAPLAY](https://kaplay.com) (MIT). Jeu & assets : faits maison pour Laura. 💛
