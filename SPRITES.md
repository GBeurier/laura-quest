# Sprites de « Laura l'exploratrice » — propriétés & guide de modification

Tu remplaces les images toi-même : pose tes PNG (fond **transparent**) dans
`assets/sprites/` puis ré-embarque (section 2). Plus aucun script de dessin :
juste les assets, ce doc, et le ré-embarqueur `gen_assets_data.py`.

---

## 1. Résolution (le facteur `art.scale`)

Les placeholders sont dessinés à **2× la taille affichée** ; le jeu divise par
`art.scale` pour les afficher nets.

| Réglage | Où | Valeur | Effet |
|---|---|---|---|
| `art.scale` | `js/config.js` | **2** | taille à l'écran = largeur du PNG ÷ `scale` |
| `art.pixelDensity` | `js/config.js` | **2** | finesse de rendu (monte à 3 si tu veux plus net) |

➡️ **Quand tu remplaces un sprite, dessine-le à la taille « PNG @×2 » du tableau**
(= taille logique × 2). Si tu préfères dessiner « à la taille réelle » (1×), mets
simplement `art.scale: 1` dans `config.js`.

---

## 2. Remplacer / ré-embarquer

```bash
# 1) remplace assets/sprites/<nom>.png (même nom, fond transparent)
# 2) ré-embarque (sinon le jeu garde l'ancienne image, car tout est en base64) :
python3 gen_assets_data.py
```

---

## 3. Inventaire des sprites

`frames` = nombre d'images dans la feuille (= `sliceX` dans `js/config.js → anims`).
`logique` = taille de design = taille à l'écran. `PNG @×2` = ce que tu dessines.
Ancre : `bot` (pieds au centre-bas), `center`, `topleft`.

### Animés (feuilles : N frames côte à côte)

| Fichier | Rôle | frames | logique | PNG @×2 | anims (vitesse) | ancre | regard |
|---|---|---|---|---|---|---|---|
| `hero_idle` | Laura repos | 4 | 64×76 | 128×152 | idle (6) | bot | → |
| `hero_run` | Laura course | 6 | 64×76 | 128×152 | run (14) | bot | → |
| `hero_jump` | Laura saut | 2 | 64×76 | 128×152 | jump (8) | bot | → |
| `hero_hurt` | Laura touchée | 2 | 64×76 | 128×152 | hurt (10) | bot | → |
| `hero_throw` | Laura lance | 2 | 64×76 | 128×152 | throw (16) | bot | → |
| `cat_run` | Chat angora | 6 | 56×40 | 112×80 | run (18) | bot | → |
| `enemy_corbeau` | Corbeau (vole) | 6 | 52×44 | 104×88 | fly (8) | bot | → |
| `enemy_<monstre>` | **Tous les autres monstres** (cf. §3bis) | 6 | ~80×90 | feuille 6×176×192 | walk 0–2 / hurt 3 / attack 4–5 | bot | →/← |
| `boss_*_move` (6) | Boss — **déplacement** | 6 | 124×140 | 248×280 (feuille 1488×280) | idle 0–4 (loop) / hurt 5 | bot | ← |
| `boss_*_atk` (6) | Boss — **attaque** | 6 | 124×140 | 248×280 (feuille 1488×280) | attack 0–5 (loop) | bot | ← |

> **Deux feuilles par boss** (`boss_proprietaire`, `boss_agriculteur`, `boss_michael`,
> `boss_rstudio`, `boss_cendrine`, `boss_jury`) :
> - `boss_X_move` = DÉPLACEMENT : 6 frames, 0→4 = cycle d'idle/menace (anim `idle`), frame 5 = touché (`hurt`).
> - `boss_X_atk` = ATTAQUE : 6 frames, 0→5 = charge → frappe → retour (anim `attack`).
>
> `game.js` bascule sur la feuille `_atk` **uniquement** quand l'IA pose `animWant = 'attack'`
> (cf. `bossAnim` / `js/bosses.js`) ; sinon il reste sur `_move`. Si une feuille `_atk`
> manque, le boss reste sur `_move` (pas de crash). Les boss sont dessinés **tournés à
> gauche** (le jeu les retourne via `flipX`) → l'attaque s'étend vers la gauche.
> Sprites **pixel-art** générés par l'IA (Codex `image_gen`) puis recoupés en grille par
> `_bossgen/` (cf. `_bossgen/regrid.py`) ; le jury (`boss_jury_*`) est un panel de **3
> chercheurs** rendu plus grand (`CONFIG.bosses.jury.scale`). Réembarquer : `gen_assets_data.py`.
> (L'ancien générateur de placeholders `tools/gen_boss_sheets.py` est obsolète : il produisait 4 frames.)

### 3bis. Monstres — **une feuille 6 frames** par monstre (walk / hurt / attack)

Tous les monstres (sauf `enemy_corbeau`, qui n'a qu'un cycle `fly`) partagent **un seul
format** : une feuille horizontale de **6 frames** découpée par `CONFIG.anims.enemy_<nom>` :
`walk` 0–2 (boucle), `hurt` 3 (touché), `attack` 4–5 (boucle). `game.js` pilote l'état via
`e.animWant` (cf. `enemyAnim`, miroir léger des boss) ; si un clip manque, on retombe sur la
boucle (+ flash d'opacité). Ancre **bot**.

**Regard (doit matcher `flipX` de `game.js`, non modifié) :** véhicules (`patrol`) et SOL
(`chase`) dessinés tournés **à gauche** ; VOLANTS (`fly`), TIR (`shooter`), `jump`, IMMOBILES
(`static`) tournés **à droite**. La taille à l'écran est réglée par `scale` dans
`CONFIG.enemies` (petits insectes ~0.45, humanoïdes/engins ~1).

| `enemy_<nom>` | archétype (`move`) | char map | regard |
|---|---|---|---|
| `caillou`* (obstacle) | static | `^` | → |
| `camion` (tracteur) | patrol | `T` | ← |
| `assureur` (huissier) | chase | `A` | ← |
| `ademe` | shooter | `R` | → |
| `criquet` | jump | `J` | → |
| `moustique` / `abeille` | fly | `M` / `E` | → |
| `cafard` | chase (rampe) | `K` | ← |
| `transpalette` / `livreur` / `coursier` | patrol | `W` / `G` / `C` | ← |
| `imprimante` / `chips` / `tuyau` | shooter | `I` / `H` / `U` | → |
| `sac` / `fontaine` / `dossiers` | static | `S` / `F` / `D` | → |

> *`caillou` est posé par `addRock` (obstacle solide) : il ne joue que `walk`.
> Génération : `python3 _monstgen/make_prompts.py` → `codex exec < _monstgen/prompts/<nom>.txt`
> (pixel-art, 6 frames sur magenta) → `python3 _monstgen/regrid.py _monstgen/raw/<nom>_sheet.png <nom>`
> (chroma-key + découpe → `assets/sprites/enemy_<nom>.png`) → `python3 gen_assets_data.py`.

### Placeholders animés — objets, munitions, ennemis « fixes », FX, décor

> Ce sont désormais des **feuilles** : pickups / `sun_goal` / munitions = **4 frames**
> (anim `idle` ou `spin`), ennemis « fixes » & `heart` = **2**, `fx_grumble` = **3**.
> Les tailles ci-dessous sont **par frame** (la feuille = N × cette largeur).
> Restent **1 frame** (statiques) : `tile_soil`, `tile_panel`, `bg_field`, `bg_cloud`, `fx_tear`.

| Fichier | Rôle | logique | PNG @×2 | ancre |
|---|---|---|---|---|
| `ammo_graine` | Graine (tir droit, ↑↓ pour viser) | 26×26 | 52×52 | center |
| `ammo_riz` | Pied de riz (tir droit, +fort) | 26×26 | 52×52 | center |
| `ammo_cookie` | Cookie (tir **en cloche**) ⚠️ vieux placeholder basse-déf, à redessiner en 60×60 | 30×30 | 60×60 | center |
| `ammo_gateau` | Gâteau (tir **en cloche**, +fort) | 30×30 | 60×60 | center |
| `pickup_sunray` | Rayon de soleil (= énergie/munitions) | 32×32 | 64×64 | center |
| `pickup_cafe` | Café (soin) | 32×32 | 64×64 | center |
| `pickup_data` | Donnée | 32×32 | 64×64 | center |
| `pickup_page` | Page de thèse | 32×32 | 64×64 | center |
| `pickup_publi` | Publication (100 %) | 32×32 | 64×64 | center |
| `pickup_croquette` | Croquette (recharge chat) | 28×28 | 56×56 | center |
| `pickup_pilule` | Pilule (skin `d`/`p` Appart & Arène) | 32×32 | 64×64 | center |
| `pickup_champignon` | Champignon (skin `p` Arène) | 32×32 | 64×64 | center |
| `sun_goal` | Soleil = sortie du niveau | 128×128 | 256×256 | center |
| `tile_soil` | Terre (sol) | 48×48 | 96×96 | topleft |
| `tile_panel` | Panneau solaire (plateforme) | 48×48 | 96×96 | topleft |
| `hazard_paddy` | Fosse-piège EXTÉRIEUR (riziere : piques de bambou) | ~72×35 | ~144×70 | **bot** |
| `hazard_acid` | Fosse-piège INTÉRIEUR (acide vert) | ~72×34 | ~144×67 | **bot** |
| `hazard` | Fosse-piège générique (piques d'acier, fallback) | ~72×30 | ~144×59 | **bot** |
| `heart` | Cœur de vie (HUD) | 28×28 | 56×56 | topleft |
| `fx_tear` | Larme (sort « pleurer ») | 28×28 | 56×56 | center |
| `fx_grumble` | Bulle (sort « râler ») | 76×52 | 152×104 | center |
| `bg_field` | Rizière (fond) | 320×128 | 640×256 | topleft |
| `bg_cloud` | Nuage (fond) | 76×42 | 152×84 | center |

> `tile_soil` / `tile_panel` doivent rester **carrés (48 logique)** pour la grille.
> Le **panneau cassable** (`x` dans la map) réutilise `tile_panel` teinté rouge — pas de
> nouveau sprite à dessiner ; il explose après un saut dessus (cf. `js/level.js`).
>
> **Fosses-pièges (`hazard*`, map `%`)** : ancre **`bot`** — le sprite est posé
> **à plat sur le sol** (la lèvre proche au ras du sol, légèrement enfoncée). Le
> jeu a très peu de hauteur sous le sol (le HUD est juste dessous), donc on ne
> peut PAS plonger vers le bas : dessine un **TROU VU DE DESSUS** (trompe-l'œil),
> ouverture **large et basse** (~2:1), le **danger (piques / acide) remplit
> l'ouverture** et reste visible, fines parois qui s'assombrissent (illusion de
> profondeur). Un trou dans le sol, **pas un seau ni un panneau debout**. Autour =
> transparent (composite sur n'importe quel sol). Skin par biome via
> `theme.hazard`. Art : `_hazardgen/` (Codex `image_gen`, trompe-l'œil) ;
> placeholders : `python3 tools/gen_hazard_placeholders.py`.
>
> **Plateformes par décor (cap + pied) :** la plateforme `-`/`x` = un *cap* (haut où l'on
> marche) + un *pied* étiré au sol (`addPanelDeco`). Le cap est reskinné par `theme.tiles['-']`
> et le pied par `theme.panelLeg`. Rizière & Serre = panneaux solaires (`tile_panel` +
> `panel_leg`). Appart = **étagère à bibelots** (`tile_shelf_biblo` + `shelf_leg`), Labo &
> Université = **étagère à livres** (`tile_shelf_books` + `shelf_leg`). Le *cap* a la même
> géométrie/format que `tile_panel` (144×88 @×2, perspective penchée), le *pied* comme
> `panel_leg` (96×48, étiré en Y). `bg_appart` = bandeau intérieur (placeholder à remplacer).

### Équipements (placeholders fournis — à redessiner)

| Fichier | Rôle | logique | PNG @×2 | ancre |
|---|---|---|---|---|
| `pickup_rollers` | objet rollers à ramasser (`L` dans la map) | 32×32 | 64×64 | center |
| `gear_rollers` | rollers **superposés** sur Laura (cf. §6) | 40×24 | 80×48 | bot |
| `pickup_velo` | objet vélo à ramasser (`Y` dans la map) | 32×32 | 64×64 | center |
| `gear_velo` | vélo **superposé** sur Laura (cf. §6) | 70×52 | 140×104 | bot |

> Tailles **par frame**. `pickup_rollers`/`pickup_velo` = **4 frames** (`idle`).
> `gear_rollers`/`gear_velo` = **4 frames** avec anims **`idle` / `run` / `jump`** : l'overlay
> se cale sur la pose de Laura (roues qui tournent quand elle court, etc.).

---

## 4. Animer N'IMPORTE QUEL sprite (élargir une image)

Oui : tout sprite peut être animé. Il suffit de :
1. faire un PNG **plus large** = N frames identiques **côte à côte** (bande horizontale) ;
2. le déclarer dans `js/config.js → anims` (compteur **manuel**) :
```js
pickup_data: { sliceX: 4, anims: { spin: { from: 0, to: 3, loop: true, speed: 8 } } },
```
Le jeu joue automatiquement la **1ʳᵉ** anim (ou celle nommée dans `play:`). Pour les
sprites pilotés par le jeu (Laura, boss…), garde les noms d'anim attendus
(`idle/run/jump/hurt/throw`, et `idle/hurt` sur `boss_*_move` + `attack` sur `boss_*_atk`).

> Si tu changes le **nombre de frames** d'un sprite déjà animé, ajuste son `sliceX`.

---

## 5. Variants / skins aléatoires (sprites numérotés)

Ajoute des copies **numérotées** d'un sprite et le jeu en choisit une **au hasard**
à chaque apparition (ennemis & boss) :

```
enemy_criquet.png    enemy_criquet2.png    enemy_criquet3.png
```
→ chaque criquet qui apparaît prend une de ces 3 têtes au hasard. Les variants
**héritent du découpage du sprite de base** (même `sliceX`/anims), donc dessine-les
avec le même nombre de frames. (Convention : le numéro **collé** au nom, sans espace
ni underscore.) Pense à `python3 gen_assets_data.py` après ajout.

---

## 5bis. Passant (figurant `N`) — corps « biome » + tête interchangeable

Le **passant** est un petit monstre (fait les cent pas, 1 dégât, 2 PV) qu'on pose
dans une map avec le caractère **`N`**. Il est **composé** à l'exécution :

```
CORPS (habits du biome, par sexe)  +  TÊTE (South Park, de face, au hasard)
```

La tête est un **enfant** du corps (`attachHead`, `js/game.js`) : elle dodeline
(petit bob + balancement), **suit le corps**, est **détruite/masquée avec lui**, et
**ne se retourne pas** quand le corps change de sens → elle reste **toujours de face**.
À chaque `N`, le moteur tire **un sexe**, **un corps** de ce sexe, puis **une tête**
au hasard dans le pool du biome (cf. `theme.passant`, `js/config.js` / `js/level.js`).

### Assets à dessiner

| Fichier | Rôle | frames | logique | PNG @×2 | anim | ancre | regard |
|---|---|---|---|---|---|---|---|
| `body_<biome>_<sexe>` | CORPS **sans tête** (marche) | 4 | 56×75 | 112×150 (feuille **448×150**) | `walk` (7) | **bot** (pieds) | face |
| `head_<biome>_<sexe>_<n>` | TÊTE de face (grosse, « South Park ») | 1 | 56×56 | **112×112** | — (bouge par code) | **bot** (= **menton**) | face |

> Dessine le **corps de face** (symétrique) : le passant patrouille et le moteur
> le `flipX` selon le sens, mais comme la tête (de face) ne se retourne jamais, un
> corps de face garde l'ensemble cohérent (le miroir gauche/droite devient invisible).

- **`<biome>`** ∈ `champ` · `pote` · `horti` · `labo` · `bureau` — un jeu d'habits par
  décor (champs / colocs casual / horticulteur / blouse de labo / bureau-admin).
  **`<sexe>`** ∈ `h` · `f`. **`<n>`** = 1, 2, 3… (autant de têtes que tu veux dans le pool).
  L'**arène finale** (`jury`) invoque des randoms de **tous** les biomes (corps + tête
  tirés au hasard parmi tous, cf. `PASSANT_ALL` dans `js/level.js`).
- **Corps** : dessine-le **sans tête**, le **cou/épaules vers le haut de la frame**
  (≈ y 50/150 en px @×2). Les 4 frames = un cycle de marche. L'anim `walk` est
  **déjà déclarée** pour les 8 corps (boucle `js/config.js`) — garde **4 frames**.
- **Tête** : **de face**, ronde et **grosse** (style South Park), **menton en bas
  du canvas** (ancre `bot`) ; elle pousse vers le haut et se pose sur le cou.
  Reste un **PNG simple** (le mouvement est codé). Tu *peux* l'animer (clignement)
  en élargissant le PNG + en la déclarant dans `CONFIG.anims` (cf. §4).
- **Placement tête** : `theme.passant.headLocal` = `[0, -104]` (px @×2, point du cou).
  `headBob` (≈4 px) et `headRot` (≈3°) règlent le dodelinement. À ajuster si tes
  vrais corps n'ont pas le cou exactement au même endroit.

### Brancher les assets (par niveau)

Dans `js/level.js`, chaque niveau a un `theme.passant` construit par le helper
`PASSANT(biome, nbTêtesH, nbTêtesF)` :

```js
// niveau3 (serre) -> horticulteur, 3 têtes homme + 3 têtes femme
passant: PASSANT('horti', 3, 3),
```

`femaleRatio` (proba de tirer `f`, défaut 0.5) se règle dans `CONFIG.theme.passant`.
**Tout asset manquant est ignoré** : pas de tête dispo → le corps s'affiche seul ;
pas de corps → repli sur `body_champ_<sexe>`. Pose des `N` dans la map, puis
`python3 gen_assets_data.py`.

### Mockups (bouche-trou actuels)

`python3 tools/gen_passant_mockups.py` génère les 8 corps + 24 têtes (couleurs par
biome, sexe marqué, têtes numérotées) pour tester le système. **Remplace-les** par
tes vrais PNG (**mêmes noms, mêmes tailles**) puis ré-embarque.

---

## 6. Overlays & équipements (rollers, etc.)

Un **équipement** se ramasse et change Laura. Configuré dans `js/config.js → equipment` :

```js
equipment: {
  rollers: { overlay: 'gear_rollers', overlayZ: 6,  offset: [0,0], speedMul: 1.6, jumpMul: 1.3 },
  velo:    { overlay: 'gear_velo',    overlayZ: -1, offset: [0,0], speedMul: 2.0, jumpMul: 1.35 },
},
```
- **overlay** : superpose le sprite sur Laura ; s'il a les mêmes anims qu'elle
  (`idle/run/jump`…), il se **synchronise sur sa pose** automatiquement. C'est le
  mécanisme général pour **superposer** une animation.
- **overlayZ** : `6` = devant Laura (rollers aux pieds) · `-1` = derrière (le vélo, pour
  qu'elle paraisse assise dessus).
- **speedMul** : vitesse de course. **jumpMul** : hauteur de saut.
- **override** : remplace le sprite d'une pose (ex. `run: 'hero_roll'`).
- ⚠️ **Si Laura est touchée, elle PERD l'équipement au lieu d'une vie** (puis courte
  invincibilité). Un seul équipement à la fois.

Ramassables : `pickup_rollers` (pose un **`L`** dans la map) et `pickup_velo` (**`Y`**).
Tu peux créer d'autres équipements sur le même modèle : un `pickup_*` avec `equip: 'nom'`
+ une entrée `equipment.nom` (+ les PNG `pickup_*` / `gear_*`).

---

## 7. Armes (qui consomment l'énergie)

4 armes, **MAJ** pour changer (ordre dans `config.js → ammoOrder`). **Haut/Bas visent**
(ils ne font plus sauter ; saut = Espace/Z/W).

| Arme | Trajectoire | Dégâts | Énergie | Sprite |
|---|---|---|---|---|
| Graines | tout droit (↑↓ orientent) — **rafale** en maintenant | 1 | 6 | `ammo_graine` |
| Pieds de riz | tout droit — **rafale** | 2 | 14 | `ammo_riz` |
| Cookies | **en cloche**, à **charge** | 2 | 10 | `ammo_cookie` |
| Gâteaux | **en cloche**, à **charge** | 3 | 20 | `ammo_gateau` |

Les armes **en cloche se chargent** : maintiens X, plus c'est long plus ça part loin
(jauge orange au-dessus de Laura), lancer au relâchement. Les armes droites tirent en
rafale tant qu'on maintient.

Tout est réglable dans `config.js → ammoTypes` (`damage`, `speed`, `cost`, `traj`),
`shot.arcGravity` (courbure) et `shot.{chargeTime,arcMin,arcMax}` (la charge).

---

## 8. Chat (aller-retour) & recul

**Chat** : il **saute hors du sac**, **court** vers l'avant en nettoyant ennemis + tirs,
fait **demi-tour** à `cat.range`, **revient** et disparaît en touchant Laura.
- **Laura n'est PLUS figée** pendant ce temps : elle joue une **brève** pose « lance le
  chat » (`cat.tossTime`, ~0,4 s) puis **reprend tous ses moves** (courir / tirer / sauter)
  pendant que le chat fait son aller-retour tout seul. La pose de lancer passe par le
  **rig en couches** (cf. §9) : calque `act_cat` sur rollers/à pied, feuille dédiée
  `hero_bike_cat` sur vélo.
- Animation du chat lui-même : feuille `cat_run` dans les deux sens (`flipX`).
- **Recharge** des charges (`cat.maxCharges` = 3) :
  - **auto** : une charge revient seule toutes les **`cat.regenTime`** s (= 40). Jamais
    bloquée à 0. Le HUD remplit progressivement le prochain pip (anneau qui grossit).
  - **croquettes** (`k` dans les maps, `pickup_croquette`) : **+1 instantané** en plus.
- Réglages : `config.js → cat.{range, speed, regenTime, tossTime, maxCharges, startCharges}`.

**Recul** : quand Laura touche un monstre (ou un tir), elle est **repoussée** dans la
direction opposée (pas de contrôle pendant ~0,2 s) et joue l'anim **`hurt`** de
`hero_hurt`. Réglages : `config.js → player.{knockback, knockTime}`.

---

## 9. Rig en couches : actions (lancer / chat) × locomotion (à pied / rollers / vélo)

**Le problème résolu.** Avant, Laura était **un seul sprite plein-corps**. Du coup
chaque action (lancer, lancer-le-chat) × chaque locomotion (à pied, rollers, vélo)
aurait demandé sa propre feuille → explosion combinatoire. C'est pour ça qu'un lancer
**en rollers/vélo** retombait sur la pose de roule (pas de bras qui lance) et que le chat
**figeait** Laura.

**La solution : deux couches.**
- **Couche LOCOMOTION (base)** = le sprite de Laura : `hero_idle/run/jump/duck/hurt`
  à pied, ou `hero_roll` / `hero_bike` quand elle est équipée. **Inchangée.**
- **Couche ACTION (calque)** = un petit sprite `act_*` (haut du corps : bras qui lance,
  ou geste de lancer le chat) **posé par-dessus** Laura. Elle continue sa locomotion en
  dessous ; le calque joue **sa** propre anim une fois puis se retire seul.

### Comment le moteur choisit (par action `throw` ou `cat`) — `game.js`, `PLAYER.onUpdate`
1. **Équipée + feuille dédiée `<base>_<action>` présente** → swap plein-corps.
   Ex. vélo : `hero_bike_throw`, `hero_bike_cat` (et si tu veux, `hero_roll_throw`/`hero_roll_cat`).
2. Sinon **calque `act_<action>` présent** → base **inchangée** + on superpose `act_throw` / `act_cat`.
3. Sinon **repli** : à pied → plein-corps historique (`hero_throw` / `hero_cat_out`) ;
   équipée sans asset → simple pose de roule (comme aujourd'hui, aucune régression).

> Tout est **gardé par `hasSprite`** : tant qu'un PNG n'existe pas, on tombe au niveau
> suivant — rien ne casse, tu allumes les couches au fur et à mesure que tu génères.

### Pourquoi ça règle ta peur d'alignement
Le calque `act_*` se dessine **à la TAILLE D'UNE FRAME de Laura** (même 64×76 logique,
PNG @×2 = 128×152), **même ancre `bot`**. Le moteur le pose **exactement** sur Laura
(même `pos`/ancre/échelle/`flipX`) → **aligné par construction, zéro offset à régler**.
Méthode d'auteur **WYSIWYG** : ouvre une frame de `hero_run`/`hero_idle` en calque de
référence, dessine le bras-qui-lance (et la croquette/le chat qui part) **à la bonne
place**, **efface le corps** → il ne reste que le bras sur fond transparent. Drop-in.
*(Un micro-décalage est possible via `config.js → player.actionOffset = [x,y]` si une base
assoit Laura un peu plus bas, mais en pratique : pas besoin.)*

### Le vélo = anims **dédiées** (ton instinct était bon)
Sur le vélo la posture est trop différente (penchée, mains au guidon) pour qu'un calque
« debout » colle. Donc **règle 1** : tu dessines des feuilles **plein-corps** `hero_bike_throw`
et `hero_bike_cat` (Laura-sur-le-vélo en train de lancer). Pas de calque à aligner. Si tu
ne les fais pas, le vélo lance **depuis la pose de roule** (propre, sans glitch).

### Liste d'assets à générer (regard → gauche/face, le jeu mirroir via `flipX`)

| Fichier | Rôle | Couvre | logique | PNG @×2 | anim (clip) | ancre |
|---|---|---|---|---|---|---|
| `act_throw` | bras qui lance (graine/lob) — **calque** | à pied + rollers | 64×76 | 128×152 | `throw` | bot |
| `act_cat`   | geste « lance le chat » — **calque** | à pied + rollers | 64×76 | 128×152 | `cat` | bot |
| `hero_bike_throw` | Laura-sur-vélo lance — **plein-corps** | vélo | (= `hero_bike`) | idem | `throw` | bot |
| `hero_bike_cat`   | Laura-sur-vélo lance le chat — **plein-corps** | vélo | (= `hero_bike`) | idem | `cat` | bot |
| *(option)* `hero_roll_throw` / `hero_roll_cat` | versions dédiées rollers si le calque ne te plaît pas | rollers | (= `hero_roll`) | idem | `throw`/`cat` | bot |

**Brancher** chaque feuille : ajoute son entrée dans `config.js → anims` avec le bon
`sliceX` (nb de frames) et un clip `throw` ou `cat` `loop:false`, ex. :
```js
act_throw:       { sliceX: 6, anims: { throw: { from: 0, to: 5, loop: false, speed: 18 } } },
act_cat:         { sliceX: 5, anims: { cat:   { from: 0, to: 4, loop: false, speed: 14 } } },
hero_bike_throw: { sliceX: 6, anims: { throw: { from: 0, to: 5, loop: false, speed: 18 } } },
hero_bike_cat:   { sliceX: 5, anims: { cat:   { from: 0, to: 4, loop: false, speed: 14 } } },
```
puis dépose les PNG dans `assets/sprites/` et `python3 gen_assets_data.py`.

### Diversité de moves « gratuite »
Une fois la couche action en place, **ajouter un move = 1 calque** `act_<nom>` (qui marche
sur **toutes** les locomotions à pied/rollers), pas une matrice de feuilles. (Pour
brancher une *nouvelle* action il faut une petite ligne dans `PLAYER.onUpdate` qui pose
son timer + `actWord` ; les actuelles sont `throw` et `cat`.)

---

## Récap : combien de frames dessiner ?

| Sprite(s) | frames | anim(s) |
|---|---|---|
| `hero_idle` | 4 | idle |
| `hero_run` | 6 | run |
| `hero_jump` / `hero_hurt` / `hero_throw` | 2 | jump / hurt / throw |
| `cat_run` | 6 | run |
| `enemy_corbeau` / `enemy_criquet` | 2 | fly / hop |
| `enemy_caillou/camion/assureur/ademe` | 2 | idle |
| `boss_*_move` (6) | 6 | idle(0-4) / hurt(5) — DÉPLACEMENT |
| `boss_*_atk` (6) | 6 | attack(0-5) — ATTAQUE |
| `pickup_*` (8) · `sun_goal` · `ammo_*` (4) | 4 | idle / spin |
| `fx_grumble` | 3 | idle |
| `heart` | 2 | idle |
| `gear_rollers` / `gear_velo` | 4 | idle / run / jump |
| `tile_*` · `bg_*` · `fx_tear` | 1 | (statiques) |

> Tu peux changer le nombre de frames de n'importe quel sprite : ajuste son `sliceX`
> (et les bornes `from`/`to` des anims) dans `js/config.js → anims`.
