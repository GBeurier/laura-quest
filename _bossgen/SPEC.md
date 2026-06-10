# Boss sprite-sheet generation spec

Generate real artwork with the built-in `image_gen` tool, then use code only for
mechanical formatting: crop, chroma-key, scale, pad, and lay out the grid.

## Target Style

- Retro 16-bit SNES pixel-art, crisp visible pixels, bold dark outline.
- Limited saturated palette, high contrast, flat cel-shaded forms.
- Full-body or full-vehicle boss silhouette, readable at small in-game size.
- Side / three-quarter view oriented LEFT. The game mirrors as needed.
- Raw sheets use a perfectly flat solid `#ff00ff` magenta background.
- Never use magenta/pink on the subject.
- No shadows, floor line, gradients, grid lines, frame numbers, watermark, or UI.
- No text on the subject except where the identity requires it:
  RStudio may use a large white `R` in a bright blue logo and tiny `Error` popups.

## Sheet Format

Each boss has two raw sheets:

- `raw/<boss>_move_sheet.png`
- `raw/<boss>_atk_sheet.png`

Each raw sheet must be one horizontal row of exactly 6 equal visual frames:

- `move`: frames 0-4 are idle / walk / menace, frame 5 is hurt.
- `atk`: frames 0-5 are an attack cycle.

Keep the same character, scale, baseline, and center in every frame. Leave a wide
empty magenta gap between frames so `regrid.py` can isolate the subject cleanly.

Run:

```bash
python3 _bossgen/make_prompts.py
python3 _bossgen/regrid.py _bossgen/raw/<boss>_move_sheet.png <boss> --frames 6 --move
python3 _bossgen/regrid.py _bossgen/raw/<boss>_atk_sheet.png <boss> --frames 6 --atk
```

`regrid.py` writes final game sheets to `assets/sprites/boss_<boss>_<kind>.png`
as `1488x280` RGBA files: six `248x280` frames.

It also writes QA previews to `_bossgen/final/<boss>_<kind>_preview.png`.

## Boss Likenesses

- `agriculteur`: angry farmer riding a rusty red tractor with smokestack and huge
  wheels.
- `proprietaire`: grumpy rural landowner, burgundy suit, pot belly.
- `rstudio`: buggy computer monster with a very clear RStudio identity: large
  white `R` plus vivid blue sphere / halo logo on screen or torso.
- `michael`: resembles `_bossgen/_michael.png`: bald skull, short grey beard,
  red t-shirt.
- `cendrine`: severe administrative manager, strict bun, glasses, folders under
  arm, beige suit.
- `jury`: three professors seated behind a long defense table: older white-haired
  man, woman with bun, younger man with glasses.
