# _doorgen — porte de sortie de niveau (logo CIRAD)

Pipeline d'art IA (sur le modèle de `_hazardgen/`) qui produit le sprite
`tile_exit_door` : la **SORTIE de niveau** (tuile `*`, gating « boss mort ») —
une **porte de laboratoire** moderne surmontée du **logo CIRAD** (texte vert sur
bandeau blanc), en **légère perspective penchée** pour rester colinéaire à
l'ombre haut-gauche du jeu (comme les panneaux solaires, cf. `SHADE_SLOPE` dans
`js/game.js`). Elle remplace l'ancien soleil de sortie (`sun_goal`).

L'asset est généré par l'**`image_gen` de Codex** (pixel-art 16-bit, fond
chroma-key magenta), **pas** un placeholder PIL.

## Workflow

```bash
# 1) émet le prompt -> _doorgen/prompts/door.txt
python3 _doorgen/make_prompts.py

# 2) génère via Codex (UN appel image_gen) -> _doorgen/raw/door.png
cd /home/delete/laura_quest && $HOME/.local/bin/codex exec \
    --dangerously-bypass-approvals-and-sandbox \
    < _doorgen/prompts/door.txt > _doorgen/gen_door.log 2>&1

# 3) post-traitement : détoure le magenta + recadre + normalise -> assets/sprites/tile_exit_door.png
python3 _doorgen/build.py

# 4) réembarque dans js/assets_data.js (OBLIGATOIRE)
python3 gen_assets_data.py
```

## Fichiers

- `make_prompts.py` — émet `prompts/door.txt`.
- `build.py` — `raw/door.png` -> chroma-key (#ff00ff) -> trim alpha -> toile carrée
  256px (@`CONFIG.art.scale`=2) -> `assets/sprites/tile_exit_door.png`.
- `prompts/`, `raw/`, `cut/` — entrées/sorties intermédiaires.

## Intégration moteur

`spawnSun()` (`js/game.js`) affiche `tile_exit_door` si le sprite est présent
(`hasSprite`), sinon repli sur `sun_goal`. Le tag interne reste `'sun'` → toute
la logique de fin de niveau (`onCollide('sun')` → `tryReachSun`, gating boss)
est inchangée.
