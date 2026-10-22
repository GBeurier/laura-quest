# Repository Guidelines

## Project Structure & Module Organization

This is a static browser game built on the vendored KAPLAY engine. `index.html` is the entry point and works under `file://`. Core game code lives in `js/`: `game.js` handles scenes and gameplay, `config.js` contains tuning and story text, `level.js` stores ASCII maps, `bosses.js` defines boss AI, `save.js` manages `localStorage` (slots + global prefs like audio mute), `music.js` is a dependency-free chiptune MIDI player (`window.LQ_MUSIC`), and `mobile.js` handles touch support. `engine/kaplay.js` is third-party engine code. Runtime media belongs in `assets/sprites/`, `assets/sounds/` and `assets/music/` (`.mid`, one track per level plus per-screen tracks mapped in `CONFIG.music`); sprite specs are in `SPRITES.md`. `js/assets_data.js` is generated from those assets. Tooling and asset pipelines live in `tools/` and `_...gen/` work directories. Audio shortcuts: `S` toggles sound effects, `M` toggles music (persisted via `LQ_SAVE` prefs).

## Build, Test, and Development Commands

Playable characters live in `js/characters.js` (`window.LQ_CHARACTERS`); adventures live in `js/campaigns.js` (`window.LQ_CAMPAIGNS`). Each character has three independent save slots. Keep character, campaign and level IDs stable after release: v3 saves store progress by level ID, and migrate legacy Laura slots on first load. Add maps in `levels/*.txt`, metadata in `js/level.js`, then include their IDs and map nodes in the campaign. Character art can reuse a body/head rig or map `hero_*` sprite names to dedicated sheets; per-NPC identity remains in `js/npc.js`.

- `python3 gen_levels_data.py`: embeds all lowercase level map filenames automatically.
- `node tools/check_campaigns.js`: checks save migrations, character isolation, level reordering and content references.
- `python3 tools/check_levels.py`: validates map geometry and reachability (add new level metadata to `META`).
- `node tools/smoke_campaigns.cjs`: optional browser checks with an external Playwright installation; uses isolated browser contexts and writes ignored screenshots to `_campaigngen/checks/`.
- `python3 gen_assets_data.py`: rebuilds `js/assets_data.js` after asset changes.
- Open `index.html`: runs the game locally without a server.
- `python3 -m http.server 8000`: optional local static server, useful when browser `localStorage` behavior under `file://` gets in the way.
- Open `index.html#gameauto`: runs the autopilot/dev smoke path.

Use `#game/marcos`, `#gameauto/marcos`, `#map/marcos`, or `#winscreen/marcos` for Marcos previews. Dev previews use disposable saves and do not overwrite player slots. `#characters` opens character selection.

There is no package manager manifest or formal build step beyond asset embedding. GitHub Pages runs `python3 gen_assets_data.py` before publishing.

## Coding Style & Naming Conventions

Use plain JavaScript in the existing global style: `window.CONFIG`, `window.LEVELS`, IIFEs, semicolons, and 2-space indentation. Keep configuration data in `js/config.js`, level layout data in `js/level.js`, and per-NPC identity (the ex-"passants" — on-screen they are called "POTE" in level 1, "COLLEGUE" after: prenom/nom/taille `P`/`M`/`G`/`TG`/portrait source/`level` of belonging (0..4, drawn first in their own level; jury = everyone)/`phrases` shown in rare comic speech bubbles, keyed by head sprite) in `js/npc.js` (`window.NPC`), rather than hard-coding gameplay changes in `game.js`. Follow existing asset names such as `boss_rstudio_move.png`, `pickup_data.png`, and `head_npc_f_1.png`; if animation frame counts change, update the matching `CONFIG.anims` `sliceX` entry. Do not edit `js/assets_data.js` by hand.

## Testing Guidelines

No automated test framework is configured. For gameplay changes, smoke-test in a browser from title screen through level entry, combat, save slots, and return to overworld. Use `index.html#gameauto` for a quick automated path, then manually verify any changed level, boss, control, or asset. After asset changes, run `python3 gen_assets_data.py` and reload.

## Commit & Pull Request Guidelines

Recent commits use concise French summaries, often with a scope prefix when useful, for example `CI: deploie le jeu...` or `Refonte gameplay & art...`. Keep commits focused and mention generated asset refreshes when included. Pull requests should describe gameplay or asset changes, list manual browser checks, link related issues, and include screenshots or short clips for visual changes.

## Security & Configuration Tips

This project should remain static and secret-free. Do not add backend credentials, API keys, or network-dependent runtime requirements. Keep large source-art scratch files in ignored work directories unless they are intentional project assets.
