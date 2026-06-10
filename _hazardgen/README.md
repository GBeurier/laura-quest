# _hazardgen — art des SOLS PIEGES ('%')

Génère les **fosses à dégât** profondes en perspective (`hazard_paddy`,
`hazard_acid`, `hazard`) avec l'`image_gen` de Codex, comme les autres `_*gen/`
(cf. `_bossgen/SPEC.md` pour le contrat de style commun).

En jeu : l'objet est **ancré `'top'` au ras du sol et plonge vers le bas**
(`spawnHazard` dans `js/game.js`) → la **gueule est en HAUT** du PNG, la
profondeur descend, le danger (piques / acide) est **en bas**. Skin par biome via
`LEVELS[x].theme.hazard` (`hazard_paddy` extérieur riziere / `hazard_acid`
intérieur). Spec sprite : `SPRITES.md`.

## Cibles

| Sprite          | Fosse                                              |
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

`build.py` est idempotent (ne traite que les `raw/` présents) et normalise au
canevas du jeu **144×128** (= les placeholders `tools/gen_hazard_placeholders.py`),
gueule alignée en haut.

## Placeholders

Tant que l'art Codex n'est pas là, des stop-gap procéduraux tiennent la place :

```bash
python3 tools/gen_hazard_placeholders.py && python3 gen_assets_data.py
```

`raw/`, `cut/` sont des dossiers de travail (gitignorables) ; seuls les scripts
+ `prompts/` sont versionnés.
