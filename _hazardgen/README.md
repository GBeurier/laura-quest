# _hazardgen — art des SOLS PIEGES ('%')

Génère les **fosses à dégât CARRÉES, vues de dessus** (`hazard_paddy`,
`hazard_acid`, `hazard`) avec l'`image_gen` de Codex, comme les autres `_*gen/`
(cf. `_bossgen/SPEC.md` pour le contrat de style commun).

Chaque sprite est **UNE tuile carrée** (96×96 = 48×48 affiché = une case). En jeu,
des `%` **contigus fusionnent** : le moteur pose N tuiles bord à bord pour former
**UNE plaque-piège qui grandit en largeur** (`spawnHazardSpan` dans `js/game.js`)
→ la tuile **DOIT être TILEABLE gauche↔droite** (danger + liserés haut/bas qui
débordent des deux bords latéraux ; **pas de mur gauche/droit**, seulement un
liseré **HAUT** = bord lointain sombre et un liseré **BAS** = bord proche éclairé).
L'objet est **ancré `'top'` au ras du sol et plonge vers le bas**. Skin par biome
via `LEVELS[x].theme.hazard` (`hazard_paddy` extérieur riziere / `hazard_acid`
intérieur). Spec sprite : `SPRITES.md`.

## Cibles

| Sprite          | Fosse (tuile carrée tileable)                      |
|-----------------|----------------------------------------------------|
| `hazard_paddy`  | EXTÉRIEUR : piques de bambou dans l'eau boueuse    |
| `hazard_acid`   | INTÉRIEUR : bassin d'acide vert qui bouillonne     |
| `hazard`        | générique (fallback) : piques d'acier dans le noir |

## Pipeline

```bash
python3 _hazardgen/make_prompts.py          # -> _hazardgen/prompts/<nom>.txt
# Session Codex : UN image_gen par prompt, SÉQUENTIEL (jamais en parallèle :
#   les prompts fuient l'un dans l'autre). Dépose la planche magenta brute dans
#   _hazardgen/raw/<nom>.png. Valide chaque raw/ (fond magenta plat, fosse = un
#   TROU dans le sol, PAS un seau/pot).
python3 _hazardgen/build.py                 # chroma-key + normalise -> assets/sprites/
python3 gen_assets_data.py                  # ré-embarque window.ASSETS
```

`build.py` est idempotent (ne traite que les `raw/` présents) et normalise en
**carré 96×96** plein cadre (cover-fit, = les placeholders
`tools/gen_hazard_placeholders.py`) → tuile pavable bord à bord.

## Placeholders

Tant que l'art Codex n'est pas là, des stop-gap procéduraux tiennent la place :

```bash
python3 tools/gen_hazard_placeholders.py && python3 gen_assets_data.py
```

`raw/`, `cut/` sont des dossiers de travail (gitignorables) ; seuls les scripts
+ `prompts/` sont versionnés.
