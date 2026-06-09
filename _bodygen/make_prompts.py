#!/usr/bin/env python3
"""Emet un prompt Codex par CORPS de passant -> _bodygen/prompts/<biome>_<sex>.txt.

Chaque session Codex = UN appel image_gen : une bande pixel-art de 4 frames (cycle
de marche) d'un CORPS SANS TETE vu de FACE (cou/epaules en haut), sur magenta plat,
cp dans _bodygen/raw/body_<biome>_<sex>_sheet.png. Decoupe ensuite via
_bodygen/regrid.py -> assets/sprites/body_<biome>_<sex>.png (448x150 = 4x112x150,
ancre bot, cou ~ y50 pour que la TETE (dessinee par l'utilisateur) s'attache bien).

  biomes : champ / pote / horti / labo / bureau     sexes : h / f
"""
import os
ROOT = '/home/delete/laura_quest'
OUT = os.path.join(ROOT, '_bodygen', 'prompts')
os.makedirs(OUT, exist_ok=True)

COMMON = """Use your built-in image_gen tool (the "imagegen" skill) to GENERATE raster pixel art. Do NOT use the CLI fallback (no OPENAI_API_KEY). Do NOT draw procedurally (no PIL/canvas/SVG). The artwork MUST come from your AI image generator. You will generate ONE sprite sheet (4 frames) = the WALK cycle of a HEADLESS character BODY for a cute cartoon platformer.

PIXEL-ART STYLE: retro 16-bit SNES look. Crisp visible square pixels, bold dark outline, limited vibrant palette, flat cel shading, chunky readable shapes. NO smooth gradients, NO anti-aliasing, NO 3D. Friendly, cute, comedic.

CRITICAL — HEADLESS, SEEN FROM THE FRONT:
- The body is seen STRAIGHT FROM THE FRONT (facing the viewer), SYMMETRIC. NOT a side view.
- There is NO HEAD and NO FACE. The body ends at the top in a short bare NECK STUMP (just the neck/shoulders) where a head will be attached later. Do NOT draw any head, hair, ears, or face.
- Full torso + arms + legs + feet visible; arms at the sides.

LAYOUT (critical): EXACTLY 4 frames in a SINGLE horizontal row, uniform grid of 4 equal cells, same size, the body at the SAME scale, feet on the SAME ground baseline near the bottom of each cell, centered. WIDE empty magenta gap between frames (separate islands, never touching). Outfit and colors IDENTICAL across all 4 frames. The 4 frames = a smooth WALK-IN-PLACE cycle seen from the front: legs alternating (one forward / one back), arms swinging slightly, a tiny vertical bob. Neck-stump at the SAME height in every frame.

BACKGROUND: fill the ENTIRE image (including gaps) with ONE perfectly FLAT solid #ff00ff magenta. NO shadow, NO floor line, NO gradient, NO grid, NO text, NO watermark. NEVER use magenta/pink on the body.

OUTFIT (identical every frame): {outfit}

cp the generated PNG to {root}/_bodygen/raw/body_{biome}_{sex}_sheet.png

Generate the sheet (ONE image_gen call), then cp it. Do NOT run chroma-key removal, do NOT delete files. Finally print exactly:
  SHEET: {root}/_bodygen/raw/body_{biome}_{sex}_sheet.png (<W>x<H>)
"""

# biome -> (outfit homme, outfit femme)
BIOMES = {
 'champ': (
   "a rice-field FARMER's body: a checkered/olive rolled-sleeve work shirt, sturdy khaki work trousers held by suspenders, muddy rubber boots. Tanned forearms. Rural worker.",
   "a rice-field FARM WORKER woman's body: an olive work shirt with rolled sleeves, a practical knee-length khaki skirt or work trousers, rubber boots, a small apron. Rural worker."),
 'pote': (
   "a casual ROOMMATE / student guy's body: a bright hoodie or sweatshirt over a tee, blue jeans, colorful sneakers. Relaxed casual streetwear.",
   "a casual ROOMMATE / student woman's body: a colorful cropped sweatshirt or cardigan over a tee, jeans or a casual skirt with leggings, sneakers. Relaxed casual streetwear."),
 'horti': (
   "a greenhouse HORTICULTURIST's body: a teal/green work polo, a sturdy gardening APRON with pockets, gardening gloves, work trousers, rubber clogs. Plant nursery worker.",
   "a greenhouse HORTICULTURIST woman's body: a green work top, a gardening APRON with tool pockets, gloves, work trousers, rubber clogs. Plant nursery worker."),
 'labo': (
   "a LAB RESEARCHER's body: an open WHITE LAB COAT over a shirt and tie, dark trousers, plain shoes, a pen clipped in the coat pocket. Scientist.",
   "a LAB RESEARCHER woman's body: an open WHITE LAB COAT over a blouse, dark trousers or a knee-length skirt, plain flats, a pen in the pocket. Scientist."),
 'bureau': (
   "an university ADMIN / office worker man's body: a navy blazer over a shirt and tie, grey slacks, dress shoes, a lanyard badge. Bureaucrat.",
   "an university ADMIN / office worker woman's body: a buttoned cardigan or blazer over a blouse, a knee-length pencil skirt or slacks, low heels, a lanyard badge. Bureaucrat."),
}

n = 0
for biome, (oh, of) in BIOMES.items():
    for sex, outfit in (('h', oh), ('f', of)):
        body = COMMON.format(biome=biome, sex=sex, root=ROOT, outfit=outfit)
        open(os.path.join(OUT, '%s_%s.txt' % (biome, sex)), 'w').write(body)
        n += 1
        print('wrote', '%s_%s.txt' % (biome, sex))
print('%d prompts -> %s' % (n, OUT))
