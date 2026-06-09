# Boss sprite-sheet generation spec — "Laura l'exploratrice"

You are generating REAL artwork with your built-in AI image generator (NOT procedural
drawing, NOT PIL/canvas/SVG). Code is allowed ONLY for mechanical formatting of the
AI-generated pixels (crop / scale / pad / lay out the grid / enforce transparency).

## Target art style (MATCH THE ATTACHED REFERENCE `hero_idle.png`)
- Detailed hand-painted 2D **cartoon platformer** sprite art (think Rayman Origins /
  Dora-the-Explorer / modern run-and-gun indie). **NOT** blocky 8-bit pixel art.
- Smooth cel-shading with soft gradients, clean **dark-brown outlines**, vibrant
  saturated colors, light coming from the upper-left.
- Full-body character, **side / three-quarter view, standing on the ground**.
- Fully **TRANSPARENT background** (real alpha, no checkerboard, no halo, no border box).
- Slightly chunky, friendly-but-villainous cartoon proportions. Same rendering quality
  and line weight as Laura in the reference. Caricatured, expressive, a bit comedic —
  this is a lighthearted birthday-gift game.
- **No baked-in text/letters/labels/UI** on the sprite (exception: RStudio may show an
  "R" logo and tiny "Error" popups, since that IS the character).

## Hard technical spec (every file)
- Each sheet is a **horizontal strip of 4 frames**, total **992 x 280 px**, so each
  frame cell is exactly **248 x 280 px** (frame i occupies x = i*248 .. i*248+248).
- **RGBA**, transparent background.
- The character **faces LEFT** (the game mirrors it to face the player; attacks extend
  to the LEFT).
- **Anchor = bottom-center**: the character's FEET (or base) must sit on a consistent
  baseline at about **y = 262** within each 248x280 cell, and be horizontally centered
  in the cell. The character should fill most of the cell height (head near the top with
  a small margin). **Same size, same baseline, same center across all 4 frames** so the
  animation does not jump.
- Display size in-game is 124x140 (the sheet is authored at 2x). Keep silhouettes
  readable at that small size: bold shapes, strong contrast, clear faces.

## The two sheets per boss (4 frames each)
- `<boss>_move.png` — frames 0,1,2 = a gentle **idle / breathing / small step** cycle
  (subtle motion only); frame 3 = **HURT** (a recoil/flinch: lean back, eyes squeezed
  or X-eyes, maybe small impact stars). The character identity is IDENTICAL across all
  4 frames — only the pose changes slightly.
- `<boss>_atk.png` — frames 0->3 = an **attack**: wind-up (0,1) -> strike reaching to
  the LEFT (2) -> recover (3). Same character, clearly mid-attack.

> Tip for frame consistency: generate the 4 poses of one sheet **inside a single image**
> (one generation), so the character stays identical; then crop/normalize the 4 cells to
> the exact 248x280 grid with a common baseline. If your generator can't do a clean 4-up
> strip, generate one clean full-body pose and produce the 4 frames from it (still
> AI-rendered art), keeping motion subtle.

## Output paths (overwrite these exact files)
```
assets/sprites/boss_proprietaire_move.png   assets/sprites/boss_proprietaire_atk.png
assets/sprites/boss_agriculteur_move.png    assets/sprites/boss_agriculteur_atk.png
assets/sprites/boss_michael_move.png        assets/sprites/boss_michael_atk.png
assets/sprites/boss_rstudio_move.png        assets/sprites/boss_rstudio_atk.png
assets/sprites/boss_cendrine_move.png       assets/sprites/boss_cendrine_atk.png
assets/sprites/boss_jury_move.png           assets/sprites/boss_jury_atk.png
```

## The 6 bosses (caricatures — comedic villains, lighthearted)
1. **proprietaire** — "Le propriétaire terrien": a big **OBESE, ANGRY rural landowner**
   (Camargue rice-fields). Huge round belly, red furious face, scowl, small flat cap or
   beret, checkered shirt straining over the belly, suspenders, muddy boots. He CHARGES
   like a bull (lowers a shoulder). In the attack sheet he hurls a wooden property
   **stake/piquet** to the left. Earthy **brown/tan** palette.
2. **agriculteur** — "L'agriculteur fou": a **CRAZED, manic FARMER**, wild bulging eyes,
   manic toothy grin, straw hat askew, dirty green/khaki overalls, brandishing a
   **pitchfork**. Unhinged energy. Attack = thrust/throw the pitchfork to the left. A
   small beat-up **tractor** element is OK (he rides a tractor in-game). **Green** palette.
3. **michael** — "Michael, le vieux chercheur": a **tall, big, OLD, BALD researcher**,
   MEAN/evil stern glare, **3-day white stubble beard** (short, unshaven), white **lab
   coat**, glasses, maybe a blue tie. Imposing professor. Attack = flings a **statistical
   chart/graph** to the left, pointing menacingly. **Blue** accents.
4. **rstudio** — "RStudio (le logiciel qui plante)": NOT a person — the **R statistics
   software personified as a buggy machine monster**: a chunky old **computer monitor /
   CRT** (or laptop) with stubby arms, an **angry glitchy face on the screen**, cracked/
   glitched pixels, the **R logo** (blue oval + grey "R") on its body, floating red
   **"Error!" dialog popups**, tangled cables. Attack = spits **error messages / a stack
   trace** to the left, screen flashing. **Teal/cyan** palette.
5. **cendrine** — "Cendrine, la secrétaire": an **OLD, ANGRY female administrator /
   secretary**. Severe grey bun, **cat-eye glasses on a chain**, pursed furious lips,
   blouse + buttoned **mauve cardigan**, long skirt. Brandishes a big rubber **STAMP
   (tampon)** and a fan of **forms/paperwork**. Attack = slams the stamp / throws forms
   to the left. **Purple/mauve** palette.
6. **jury** — "Le jury de thèse" (FINAL megaboss): a **panel of THREE DISTINCT
   professors seated behind a long wooden defense table** (the classic thesis-viva
   bench), shown together in each frame. Dramatic **night** lighting, **red/burgundy**
   academic palette.
   - LEFT: stern older male prof, white/grey beard, glasses, dark academic gown/suit.
   - MIDDLE: the jury **president** — distinguished, balding/grey, bow tie or formal
     robe, holding a **gavel** and the thesis manuscript.
   - RIGHT: a younger **skeptical female prof**, dark hair in a bun, sharp blazer, arms
     crossed / finger raised.
   Table has name plaques, stacks of paper, water glasses, a small desk lamp. They face
   forward / slightly left. Idle = shuffling papers, leaning, exchanging looks; hurt =
   all three recoil; attack = the president **slams the gavel** and/or they fling papers
   to the left. Make the three clearly DIFFERENT people. (This single sheet is the whole
   jury — the fight has 3 escalating phases driven by code, no separate sheets.)
