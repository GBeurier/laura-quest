# Repository Guidelines

## Project Structure & Module Organization

This is a static browser game built on the vendored KAPLAY engine. `index.html` is the entry point and works under `file://`. Core game code lives in `js/`: `game.js` handles scenes and gameplay, `config.js` contains tuning and story text, `level.js` stores ASCII maps, `bosses.js` defines boss AI, `save.js` manages `localStorage`, and `mobile.js` handles touch support. `engine/kaplay.js` is third-party engine code. Runtime media belongs in `assets/sprites/` and `assets/sounds/`; sprite specs are in `SPRITES.md`. `js/assets_data.js` is generated from those assets. Tooling and asset pipelines live in `tools/` and `_...gen/` work directories.

## Build, Test, and Development Commands

- `python3 gen_assets_data.py`: rebuilds `js/assets_data.js` after asset changes.
- Open `index.html`: runs the game locally without a server.
- `python3 -m http.server 8000`: optional local static server, useful when browser `localStorage` behavior under `file://` gets in the way.
- Open `index.html#gameauto`: runs the autopilot/dev smoke path.

There is no package manager manifest or formal build step beyond asset embedding. GitHub Pages runs `python3 gen_assets_data.py` before publishing.

## Coding Style & Naming Conventions

Use plain JavaScript in the existing global style: `window.CONFIG`, `window.LEVELS`, IIFEs, semicolons, and 2-space indentation. Keep configuration data in `js/config.js`, level layout data in `js/level.js`, and per-NPC identity (the ex-"passants": prenom/nom/taille `P`/`M`/`G`/`TG`/portrait source/phrases, keyed by head sprite) in `js/npc.js` (`window.NPC`), rather than hard-coding gameplay changes in `game.js`. Follow existing asset names such as `boss_rstudio_move.png`, `pickup_data.png`, and `head_npc_f_1.png`; if animation frame counts change, update the matching `CONFIG.anims` `sliceX` entry. Do not edit `js/assets_data.js` by hand.

## Testing Guidelines

No automated test framework is configured. For gameplay changes, smoke-test in a browser from title screen through level entry, combat, save slots, and return to overworld. Use `index.html#gameauto` for a quick automated path, then manually verify any changed level, boss, control, or asset. After asset changes, run `python3 gen_assets_data.py` and reload.

## Commit & Pull Request Guidelines

Recent commits use concise French summaries, often with a scope prefix when useful, for example `CI: deploie le jeu...` or `Refonte gameplay & art...`. Keep commits focused and mention generated asset refreshes when included. Pull requests should describe gameplay or asset changes, list manual browser checks, link related issues, and include screenshots or short clips for visual changes.

## Security & Configuration Tips

This project should remain static and secret-free. Do not add backend credentials, API keys, or network-dependent runtime requirements. Keep large source-art scratch files in ignored work directories unless they are intentional project assets.
