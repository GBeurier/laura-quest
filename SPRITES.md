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
| `enemy_corbeau` | Corbeau (vole) | 2 | 52×44 | 104×88 | fly (8) | bot | → |
| `enemy_criquet` | Criquet (bondit) | 2 | 44×40 | 88×80 | hop (6) | bot | → |
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
| `enemy_caillou` | Caillou (statique) | 54×48 | 108×96 | bot |
| `enemy_camion` | Camion (va-et-vient) | 108×66 | 216×132 | bot |
| `enemy_assureur` | Assureur (poursuit) | 54×70 | 108×140 | bot |
| `enemy_ademe` | Rapport ADEME (tire) | 50×58 | 100×116 | bot |
| `pickup_sunray` | Rayon de soleil (= énergie/munitions) | 32×32 | 64×64 | center |
| `pickup_cafe` | Café (soin) | 32×32 | 64×64 | center |
| `pickup_data` | Donnée | 32×32 | 64×64 | center |
| `pickup_page` | Page de thèse | 32×32 | 64×64 | center |
| `pickup_publi` | Publication (100 %) | 32×32 | 64×64 | center |
| `pickup_croquette` | Croquette (recharge chat) | 28×28 | 56×56 | center |
| `sun_goal` | Soleil = sortie du niveau | 128×128 | 256×256 | center |
| `tile_soil` | Terre (sol) | 48×48 | 96×96 | topleft |
| `tile_panel` | Panneau solaire (plateforme) | 48×48 | 96×96 | topleft |
| `heart` | Cœur de vie (HUD) | 28×28 | 56×56 | topleft |
| `fx_tear` | Larme (sort « pleurer ») | 28×28 | 56×56 | center |
| `fx_grumble` | Bulle (sort « râler ») | 76×52 | 152×104 | center |
| `bg_field` | Rizière (fond) | 320×128 | 640×256 | topleft |
| `bg_cloud` | Nuage (fond) | 76×42 | 152×84 | center |

> `tile_soil` / `tile_panel` doivent rester **carrés (48 logique)** pour la grille.
> Le **panneau cassable** (`x` dans la map) réutilise `tile_panel` teinté rouge — pas de
> nouveau sprite à dessiner ; il explose après un saut dessus (cf. `js/level.js`).

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
fait **demi-tour** à `cat.range`, **revient** et **resaute dans le sac** puis disparaît.
- Animation : il utilise `cat_run` dans les deux sens (retourné via `flipX`). Tu peux
  ajouter une feuille `cat_jump` plus tard pour les sauts d'entrée/sortie.
- Réglages : `config.js → cat.{range, speed, hopHeight, jumpTime}`.

**Recul** : quand Laura touche un monstre (ou un tir), elle est **repoussée** dans la
direction opposée (pas de contrôle pendant ~0,2 s) et joue l'anim **`hurt`** de
`hero_hurt`. Réglages : `config.js → player.{knockback, knockTime}`.

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
