# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Laura l'exploratrice" — a 100% client-side run-and-gun platformer (KAPLAY engine), built as a birthday gift. Laura does a PhD on agrivoltaics: 5 levels each with a unique boss, then a multi-phase jury megaboss. There is **no build system, no backend, no package manager, no test suite** — it is plain `<script>` tags and static assets.

> `AGENTS.md` (sibling, for Codex) covers the same ground more briefly; this file is the authoritative one. Keep them roughly in sync if you change project-wide conventions.

## Running & validating

- **Run locally**: open `index.html` directly (works in `file://`). Assets are embedded as base64 in `js/assets_data.js`, so no server is needed.
- **Run with persistence**: `python3 -m http.server 8000` then open `http://localhost:8000`. Needed because Chrome blocks `localStorage` in `file://`, so saves don't persist there (they fall back to session-only memory).
- **Dev shortcuts** (URL hash): `index.html#game` jumps straight into level 1; `index.html#gameauto` runs an autopilot test mode.
- **Mobile / tactile**: la manette tactile s'active **toute seule** sur écran tactile. Pour la forcer/désactiver (test desktop) : `index.html?touch=1#game` (force la manette) ou `?touch=0` (la coupe). Détails : section *Mobile / tactile* plus bas.
- **In-game cheat keys** (only when `CONFIG.cheats: true`): `1`-`6` jump to a level, `0` finishes the level, `G` god mode, `H` refill everything.

### Re-embedding assets (required after any asset change)
Sprites/sounds live in `assets/sprites/*.png` and `assets/sounds/*.wav`, but the game reads them from the embedded `window.ASSETS` in `js/assets_data.js`. After replacing/adding any asset you **must** regenerate:
```bash
python3 gen_assets_data.py
```
Files prefixed with `_` in `assets/sprites/` are skipped by the generator.

### Ajouter / changer des assets (hyper bref)
1. Dépose le PNG dans `assets/sprites/` (nom = nom de sprite, ex. `bg_hills.png`, `enemy_criquet2.png`, `tile_soil2.png`). PNG authoring à `CONFIG.art.scale`× (cf. `SPRITES.md`).
2. **Animé ?** déclare-le dans `CONFIG.anims[nom]` (`sliceX` = nb de frames). Sinon rien à faire (image simple).
3. **Réembarque** : `python3 gen_assets_data.py`.
4. **Utilise-le** :
   - *fond* → ajoute une couche dans `CONFIG.theme.layers` (ou `LEVELS[x].theme.layers`) : `{ sprite:'bg_hills', band:true, parallax:0.45, anchor:'bot', y:'ground', tileW:<largeur affichée>, z:-21 }`.
   - *obstacle* → `theme.tiles['=']: ['tile_soil','tile_soil2']` (liste = variantes au hasard).
   - *monstre* → `theme.enemies.criquet: ['enemy_criquet','enemy_criquet2']`.
   - *nouveau type d'ennemi* → ajoute-le à `CONFIG.enemies` + un caractère dans le switch de `buildLevel` (`js/game.js`) + la légende de `js/level.js`.
   - *figurant* (`N`) → un **PNJ** (anciennement « passant » ; le tag interne reste `'passant'`) : corps `body_<biome>_<sexe>` (habits du décor, 8 biomes : `champ`/`pote`/`horti`/`labo`/`bureau`) surmonté d'une **tête** "South Park" de face tirée **au hasard** dans un **pool partagé biome-indépendant** `head_npc_h_<n>` (25) / `head_npc_f_<n>` (22). Le moteur tire un sexe → le corps `body_<biome>_<sexe>` correspondant + une tête du pool. Par niveau via `theme.passant` (helper `PASSANT(biome)` dans `js/level.js`, ou `PASSANT_ALL([biomes])` pour mélanger les tenues — utilisé par le jury). **L'identité de chaque PNJ** (prénom, nom, **taille** `P`/`M`/`G`/`TG`, portrait source, et — à venir — phrases perso) est **centralisée dans `js/npc.js`** (`window.NPC`, **une entrée par tête**, clé = nom du sprite `head_npc_<sexe>_<n>`). La taille pilote l'échelle du **corps** (la tête garde toujours sa taille ; facteurs dans `CONFIG.theme.passant.sizeScale`, lus par `passantSize` dans `game.js`). **Spec complète des assets : `SPRITES.md` §5bis.** Mockups : `python3 tools/gen_passant_mockups.py`.
     - *cadavre* : un passant **abattu ne disparaît plus** — `corpsify()` (`js/game.js`) le laisse en **cadavre inerte** sur la carte (plus d'IA/gravité/collision). ⚠️ le retrait `area`/`body` y est **différé d'un tick** (`wait(0)`) : `corpsify` est appelé depuis un `onCollide`, et un `unuse()` synchrone en plein parcours de collision fait crasher le moteur (règle générale : `destroy()` est sûr dans un `onCollide`, `unuse()` non — toujours différer). Le corps prend le sprite affalé `body_<biome>_<sexe>_dead` s'il existe (sinon bascule au sol en repli), et sa tête vivante est remplacée par la **tête zombie** `head_npc_<sexe>_<n>_dead` avec un **léger tilt aléatoire** (cadavres pas tous droits). Debug : `LQ.kill(i)` abat le i-ème passant à l'écran (tous si sans arg).

Tout sprite cité mais absent est ignoré (retour au défaut) — rien ne casse si tu oublies le PNG.

**Placeholders** : `python3 tools/gen_placeholders.py` (puis `gen_assets_data.py`) génère des assets bouche-trou — couches de parallax tileables (`bg_mountains`, `bg_hills`), fonds plein-écran (`bg_title` écran-titre, `bg_map` carte), le panneau en perspective (`tile_panel` = le "cap" + `panel_leg` = les pieds) et des variantes de monstres/tuiles (`enemy_*2`, `tile_*2`, décalage de teinte). Remplace-les par tes vrais PNG (mêmes noms/tailles) quand tu les as.

### Pipelines d'art IA (`_*gen/`) — comment les vrais assets sont produits
Les vrais sprites/fonds sont du **pixel-art généré par l'`image_gen` de Codex** (pas procédural — `tools/gen_placeholders.py` ne sert qu'au bouche-trou). Chaque domaine d'asset a son répertoire de travail `_*gen/`, tous bâtis sur le **même schéma** (voir `_bossgen/SPEC.md` pour le contrat détaillé) :
1. `make_prompts.py` émet un prompt par asset dans `prompts/`. Style imposé : pixel-art 16-bit SNES, contour sombre, palette limitée, **fond plat magenta `#ff00ff`** (chroma-key — jamais de magenta sur le sujet), sujet face/profil **à gauche** (le jeu mirroir).
2. Une session Codex appelle `image_gen` par asset (trace dans `gen_*.log`) et dépose les planches brutes dans `raw/`.
3. Un script de post-traitement découpe la grille / enlève le chroma / normalise l'échelle et l'alpha → `final/` (ou `cut/`, `out/`, `heads/`). Selon le dossier : `regrid.py` (re-grille en N frames égales), `assemble.py`/`montage.py` (compose les feuilles), `postprocess.py` (`_levelgen` : `fit_cover` + `SOIL_LIFT` pour caler le bois sur la collision), `fit.py`, `build.py` (`_icongen`).
4. On **copie les PNG `final/` dans `assets/sprites/`** (mêmes noms que les sprites du jeu) puis **`python3 gen_assets_data.py`** ré-embarque tout.

| Dossier | Produit | Sprites cibles |
|---|---|---|
| `_bossgen/` | feuilles de boss (move + atk, 6 frames) — *gitignoré* | `boss_<nom>_move`/`_atk` |
| `_monstgen/` | ennemis | `enemy_*` |
| `_bodygen/` | corps de figurants (feuille de marche) **+ corps affalés "cadavre"** (`make_dead_prompts.py` → 1 frame slumpée à cou droit, post-traitée par `regrid_dead.py`) | `body_<biome>_<sexe>` **+ `body_<biome>_<sexe>_dead`** |
| `_clapgen/` | corps applaudisseurs du cortège de victoire (feuille d'applaudissement, habits gris recolorés) | `body_clap_<sexe>` |
| `_headgen/` | têtes "South Park" partagées **+ leurs versions zombie**. **Inbox de portraits** : on dépose les **photos brutes à traiter** dans `_headgen/new_heads/` ; une fois la tête générée + enregistrée (manifest + `js/npc.js`), on **déplace le portrait source dans `_headgen/heads/`** → la présence dans `heads/` (à plat, sans sous-dossier) = « traité / OK » (c'est ce nom de fichier que pointe la colonne `src` du manifest et de `window.NPC`). `_headgen/heads/` est gitignoré (seuls les scripts + `manifest.tsv` sont versionnés). Workflow par tête piloté par `run_batch.sh` (lit `manifest.tsv`) : photo → `prep.py` → `src/` → `make_prompts.py` → `image_gen(-i src)` → `regrid.py` → feuille de clignement. **Pendant cadavre intégré** (one-shot, idempotent) : la tête vivante sert de réf `-i` (`prep_dead.py` → `dead_src/`), prompt zombie **sans sang** (`make_dead_prompts.py`), `image_gen` → `regrid_dead.py` → drop-in `_dead`. *Batch historique alternatif* (38 têtes d'un coup) : `export_open_grid.py` → grille → `image_gen` → `raw/zombies.png` → `extract_zombies.py` (mapping en dur). | `head_npc_<sexe>_<n>` **+ `head_npc_<sexe>_<n>_dead`** |
| `_levelgen/` | fonds intérieurs pleine hauteur + tuiles de sol | `bg_*`, `sol_*` |
| `_bggen/` | fonds de narration (chapitre / écran de victoire) | écrans `chapter`/`win` |
| `_icongen/` | pickups, munitions, projectiles | `pickup_*`, `ammo_*`, tirs |
| `_shelfgen/` | décor d'étagères | étagères du labo |

**Piège connu** (cf. mémoire *Indoor bg pipeline*) : lancer plusieurs `image_gen` en parallèle pour les fonds fait fuiter des éléments d'un prompt dans un autre (têtes parasites) → générer **séquentiellement** et valider chaque `raw/` (`_levelgen/validate_raws.py`).

**Panneaux solaires (plateformes `-`/`x`) en perspective** : la *collision* reste une tuile invisible 48×48 (on marche sur le haut). Le *visuel* (`addPanel`/`addPanelDeco` dans `game.js`) = un `tile_panel` (cap penché vers le soleil haut-gauche, son bord avant aligné sur le haut de tuile) + `panel_leg` étiré en Y jusqu'au sol de la colonne → hauteur des pieds variable selon l'altitude. Penché pour rester colinéaire à l'ombre (cf. `SHADE_SLOPE`). `bg_title`/`bg_map` sont des PNG plein-écran (1920×1056 = 960×528 ×2) posés en `z(-10)` dans les scènes `title`/`overworld`.

### Visual validation (no automated tests)
Verify rendering with headless Chrome + SwiftShader (software WebGL). A blank/dark screenshot means a JS error broke KAPLAY init:
```bash
google-chrome --headless=new --no-sandbox --use-gl=swiftshader --enable-unsafe-swiftshader \
  --window-size=1000,640 --virtual-time-budget=8000 --screenshot=/tmp/shot.png \
  "file:///home/delete/laura_quest/index.html#game"
```
There is no `node` available; you cannot `node --check` the JS.

## Architecture

### Globals-as-modules (no imports/bundler)
KAPLAY itself is **vendored** as a minified bundle in `engine/kaplay.js` (no CDN, no npm) and is the first script `index.html` loads; updating the engine means replacing that file. `index.html` then loads the game scripts in a fixed dependency order (`assets_data.js → config.js → level.js → npc.js → save.js → bosses.js → mobile.js → game.js`); they communicate **only through `window` globals**. There are no ES modules or `require`. The contract:

| Global | Defined in | Consumed by |
|---|---|---|
| `window.ASSETS` | `js/assets_data.js` (generated) | `game.js` asset loader |
| `window.CONFIG` (`C`) | `js/config.js` | everything |
| `window.LEVELS` | `js/level.js` | `game.js` |
| `window.NPC` | `js/npc.js` | `game.js` (`passantSize`, identite des PNJ) |
| `window.LQ_SAVE` | `js/save.js` | `game.js` |
| `window.BOSS_AI` | `js/bosses.js` | `game.js` (`AI[def.behavior]`) |
| `window.LQ_TOUCH` | `js/mobile.js` | `game.js` (`{active, assist}` ; lu **avant** `kaplay()` pour le letterbox mobile + l'auto-visée) |
| `window.LQ` | `js/game.js` | debug handle (`LQ.player`, `LQ.level`, `LQ.save`) |

`js/game.js` is one big IIFE that calls `kaplay({...})` and defines all KAPLAY scenes. **If you add a new JS file, wire it into `index.html` in the right order** (before `game.js`, after its own dependencies).

### Mobile / tactile (web, pas de natif)
`js/mobile.js` (chargé **avant** `game.js`) ajoute une **manette tactile** à l'écran sur mobile **sans toucher au gameplay** : chaque bouton synthétise un `KeyboardEvent` (keydown/keyup) sur le `<canvas>`, et comme tout l'input passe par `C.controls` + `keysDown`/`onKeys` (cf. `game.js`), le jeu réagit exactement comme au clavier. **Détection auto** via `(pointer: coarse)` ; override URL `?touch=1` (force) / `?touch=0` (désactive). Pose `window.LQ_TOUCH = {active, assist}` **avant** `kaplay()` (qui lit `.active` pour passer en `letterbox`+`stretch` plein écran **sur mobile uniquement** — desktop strictement inchangé). Tous les réglages sont dans `CONFIG.mobile`. La manette s'adapte à la scène (`getSceneName()` : gamepad complet en `game`, set réduit ◀▶/OK/pause dans les menus — où `OK`/jump valide). `assistAim` (helper `autoAimArc` dans `game.js`) fait **auto-viser** les armes en cloche (cookie/gâteau) sur l'ennemi le plus proche → un seul bouton TIR, pas de visée manuelle. Le bouton SAUT synthétise `z` (pas `up`) pour ne jamais entrer en conflit avec la visée. **Gotcha de test** : en headless, `--dump-dom` **ne fait pas tourner la boucle rAF** de KAPLAY (frames figées, aucun spawn) — un test *comportemental* tactile doit utiliser `--screenshot` (qui, lui, fait avancer les frames) en écrivant le résultat dans un `<div>` superposé (les overlays DOM apparaissent dans le screenshot). Penser aussi que KAPLAY applique une touche au **frame suivant** (`onOnce("input")`), donc un `isKeyDown` lu de façon synchrone après dispatch renvoie `false`.

### Config-driven design — edit `js/config.js`, not `game.js`
Almost all behavior is data in `CONFIG`: physics (`player.jumpForce`, etc.), damage/HP, spell cooldowns, the cat ally (`cat.chargeTime` = hold duration), energy-as-ammo (`sun` + `ammoTypes[].cost`), enemy/boss stats, sprite sheets (`anims`), key bindings (`controls`), level order (`levels`), world map (`world.nodes`), and **all on-screen text** (`story.*`). Changing gameplay or wording usually means editing config, not engine code.

### Scene flow
`title → slots → overworld → game → chapter → overworld … → jury → win`; losing returns to `overworld` (or `title` if no save). Menu scenes confirm via the `onConfirm` helper (space + enter + jump keys); `overworld` navigates levels with left/right.

### Levels = ASCII grids (`js/level.js`)
Each char is one `CONFIG.tileSize` tile; the legend is documented at the top of the file. Camera scrolls **X only** — every level is 11 rows tall. The hidden publication (`P`, one per level, gives 100%) sits at the top of a stair of solar-panel platforms (`-`), requiring the double jump. The `'B'` tile spawns the boss named by the level's `boss:` field; touching `'*'` after killing the boss writes the chapter.

### Décor par niveau : parallax + skins (`theme`)
Le fond est un **parallax** multi-couches et tout le décor est **customisable par niveau**. Les défauts sont dans `CONFIG.theme` (`js/config.js`) ; chaque niveau peut surcharger via une clé `theme:` à côté de `boss:` (`js/level.js`). Résolution dans `buildLevel` : `tiles`/`enemies` fusionnent clé par clé, `sky`/`tint`/`layers` se remplacent en bloc.
- **`layers`** (du fond vers l'avant) : `parallax` 0 = immobile (ciel) → 1 = colle au sol. `band:true` = bandeau répété sans couture (sol, collines) ; `scatter:true` = sprites dispersés qui dérivent et se recyclent (nuages). Couches rendues en repère écran (`fixed`), défilées par `getCam().x * parallax` (cf. `addBandLayer`/`addScatterLayer`).
- **`sky`** `[r,g,b]` = ciel ; **`tint`**/`color` `[r,g,b]` = teinte d'ambiance (multiplie les sprites).
- **`tiles`** (par caractère de map) et **`enemies`** (par nom d'ennemi) : la valeur est une **liste de sprites** → une variante au hasard par exemplaire. Un sprite absent est ignoré → retour au défaut (`pickSkin`). C'est en plus du système global de variantes numérotées (`enemy_criquet2`…).

Dev : `index.html#game/niveau4` (ou `#gamejury`) saute directement à un niveau pour tester son thème ; `index.html#map` ouvre directement la carte du monde.

### Boss AI (`js/bosses.js`)
`game.js` calls `BOSS_AI[def.behavior](b, p, api)` every frame. `b` is the boss entity (`b.def`, `b.hp`, `b.maxHp`, `b.t`, `b.homeX`, `b.pos`); `p` is the player; `api` exposes `{ TS, bullet, add, shake, poof }`. An AI sets `b.animWant = 'idle' | 'attack' | 'hurt'` and `game.js` plays the matching animation. One behavior function per boss.

**Two sheets per boss** (`bossAnim` in `game.js`): each boss has a **movement** sheet `def.sprite` (`boss_X_move` — `idle`/`hurt`) and a separate **attack** sheet `def.attackSprite` (`boss_X_atk` — `attack`). When `animWant === 'attack'` the entity swaps to `b.sprAtk`; everything else stays on `b.spr`. A missing `_atk` PNG falls back to the move sheet (no crash). Placeholders: `python3 tools/gen_boss_sheets.py` → `gen_assets_data.py`.

### Saves (`js/save.js`)
Three arcade-style slots in `localStorage` (key `lauraquest_slot_<i>`), with a session-memory fallback when storage is unavailable. Each slot tracks chapters done, publications, data %, best score, and map cursor. `N_LEVELS = 5` (the jury is not a "chapter").

### Sprites & animation
Animated sprites are **horizontal spritesheets**; `CONFIG.anims[name].sliceX` is the frame count and `anims` the named clips. After replacing an animated sprite with a different frame count, **update its `sliceX`** in config or frames will be sliced wrong. PNGs are authored at `CONFIG.art.scale`× display size and the engine divides by `scale` (HD trick). Full per-sprite spec (size, frames, anchor, facing, role) is in `SPRITES.md`.

## Gotchas

- **No accents in on-screen text** — KAPLAY's default bitmap font renders them poorly. To enable real accents, load a TTF (`loadFont("ui", "assets/font.ttf")`) and add `font: "ui"` to `text(...)` calls.
- **HUD key labels are hardcoded strings in `game.js`** (the `keycap(...)` / `spellPill(...)` calls and `CONFIG.story.hint`). If you rebind a key in `CONFIG.controls`, update those display strings to match — they are not derived from the bindings.
- **Set `CONFIG.cheats: false`** for the shipped gift version (otherwise number/G/H keys are intercepted and the cheat hint shows).
- Keyboard not responding → the canvas needs focus; the game re-grabs it, but a click in the window resolves it.
