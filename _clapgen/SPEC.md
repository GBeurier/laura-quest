# `_clapgen/` — bodies applaudisseurs du cortège de victoire

Même schéma que `_bodygen/` (cf. `_bossgen/SPEC.md` pour le contrat de style). Produit
**2 feuilles** de corps SANS tête, vus de **face**, en train d'**applaudir** :

| Sortie | Sprite jeu |
|---|---|
| `assets/sprites/body_clap_h.png` | `body_clap_h` (homme) |
| `assets/sprites/body_clap_f.png` | `body_clap_f` (femme) |

Gabarit **identique aux passants** (`448x150` = 4×`112x150`, pieds baseline `y146`,
cou ~`y44`) → les têtes `head_npc_<sex>_<n>` du **pool partagé** s'attachent au même
`theme.passant.headLocal`. Le jeu les **recolore** (multiply) à la volée, donc les
habits sont en **gris clair neutre** : 2 feuilles suffisent pour une foule multicolore.

Usage : c'est l'**écran de victoire** (`scene('win')` dans `js/game.js`) qui, au bout
de quelques secondes, fait défiler ce cortège applaudissant Laura diplômée (max 10 à
l'écran, corps teinté + tête tirée au hasard).

## Pipeline (comme les autres `_*gen/`)
1. `python3 _clapgen/make_prompts.py` → `prompts/clap_h.txt`, `prompts/clap_f.txt`.
2. **Tout en un** : `bash _clapgen/run_batch.sh` → lance `codex exec < prompt` (Codex
   `image_gen`) pour `h` puis `f` **séquentiellement** (cf. piège `image_gen`
   concurrent qui fait fuiter des éléments d'un prompt dans l'autre), dépose les
   planches brutes dans `_clapgen/raw/`, puis appelle `_bodygen/regrid.py … clap …`
   (MÊME découpe/baseline que les passants → mêmes tailles ingame) →
   `assets/sprites/body_clap_<sex>.png`. Logs : `_clapgen/gen_clap_<sex>.log`.
   - Manuel : `python3 _bodygen/regrid.py _clapgen/raw/body_clap_h_sheet.png clap h`.
3. `python3 gen_assets_data.py` → ré-embarque tout.

Le **stitch du cou** est correct par construction : la regrille `_bodygen` pose le
cou-souche à `y44` et les pieds à `y146` comme TOUS les corps ingame, donc les têtes
`head_npc` s'attachent au même `theme.passant.headLocal` (le cortège réutilise
`attachHead`, l'attache exacte des passants).

> **Placeholder** (déprécié, fallback) : `python3 _clapgen/placeholder.py` génère un
> bouche-trou procédural — uniquement si les vraies planches Codex manquent.
