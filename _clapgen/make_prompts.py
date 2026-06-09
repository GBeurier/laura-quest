#!/usr/bin/env python3
"""Emet un prompt Codex par CORPS d'APPLAUDISSEUR -> _clapgen/prompts/clap_<sex>.txt.

Meme schema que _bodygen/ (cf. _bossgen/SPEC.md) : chaque session Codex = UN appel
image_gen produisant une bande pixel-art de 4 frames (cycle d'APPLAUDISSEMENT) d'un
CORPS SANS TETE vu de FACE, sur magenta plat #ff00ff, copiee dans
_clapgen/raw/body_clap_<sex>_sheet.png. Decoupe ensuite via _clapgen/regrid.py ->
assets/sprites/body_clap_<sex>.png (448x150 = 4x112x150, ancre bot, cou ~y44).

MEME GABARIT que les passants (_bodygen) pour que les tetes head_npc_<sex>_<n> du
pool partage s'attachent au meme point (theme.passant.headLocal). Habits en GRIS
CLAIR NEUTRE : le jeu les RECOLORE (multiply) a la volee -> 2 feuilles suffisent
pour une foule multicolore. Sert au CORTEGE de l'ecran de victoire (defile qui
applaudit Laura diplomee).

  sexes : h / f
"""
import os
ROOT = '/home/delete/laura_quest'
OUT = os.path.join(ROOT, '_clapgen', 'prompts')
os.makedirs(OUT, exist_ok=True)

COMMON = """Use your built-in image_gen tool (the "imagegen" skill) to GENERATE raster pixel art. Do NOT use the CLI fallback (no OPENAI_API_KEY). Do NOT draw procedurally (no PIL/canvas/SVG). The artwork MUST come from your AI image generator. You will generate ONE sprite sheet (4 frames) = an APPLAUSE / CLAPPING cycle of a HEADLESS character BODY for a cute cartoon platformer's victory crowd.

PIXEL-ART STYLE: retro 16-bit SNES look. Crisp visible square pixels, bold dark outline, limited vibrant palette, flat cel shading, chunky readable shapes. NO smooth gradients, NO anti-aliasing, NO 3D. Friendly, cute, joyful, celebrating.

CRITICAL - HEADLESS, SEEN FROM THE FRONT:
- The body is seen STRAIGHT FROM THE FRONT (facing the viewer), SYMMETRIC. NOT a side view.
- There is NO HEAD and NO FACE. The body ends at the top in a short bare NECK STUMP (just the neck/shoulders) where a head will be attached later. Do NOT draw any head, hair, ears, or face.
- Full torso + arms + legs + feet visible. Both forearms are raised toward the CHEST CENTER so the two hands meet IN FRONT of the chest (clapping). This is an APPLAUSE pose, not arms-at-sides.

LAYOUT (critical): EXACTLY 4 frames in a SINGLE horizontal row, uniform grid of 4 equal cells, same size, the body at the SAME scale, feet on the SAME ground baseline near the bottom of each cell, centered. WIDE empty magenta gap between frames (separate islands, never touching). Outfit and colors IDENTICAL across all 4 frames. Neck-stump at the SAME height in every frame. The 4 frames = a smooth CLAPPING loop seen from the front: frame 1 hands apart (open ~ shoulder width), frame 2 hands moving in, frame 3 hands TOGETHER at chest center (the clap), frame 4 hands moving back apart - with a tiny vertical bob of joy. Only the arms/hands move; torso, legs and feet stay nearly still.

OUTFIT (identical every frame): {outfit} Render all CLOTHING in a NEUTRAL LIGHT GREY (#c8c8cd-ish) with simple darker-grey shading, because the game RECOLORS the outfit at runtime - so keep it greyscale, do NOT bake in a saturated clothing color. Keep visible SKIN (hands, forearms, neck stump) in a natural warm skin tone.

BACKGROUND: fill the ENTIRE image (including gaps) with ONE perfectly FLAT solid #ff00ff magenta. NO shadow, NO floor line, NO gradient, NO grid, NO text, NO watermark. NEVER use magenta/pink on the body.

After image_gen returns, copy ONLY the PNG created by THIS Codex session to:
  {root}/_clapgen/raw/body_clap_{sex}_sheet.png

CRITICAL: do NOT select "the newest PNG" globally from ~/.codex/generated_images.
Use only the generated_images subdirectory for YOUR OWN Codex session id (printed in
your header), or otherwise verify the candidate file was produced by your own image_gen
call. If you cannot unambiguously identify your own generated PNG, print FAIL_UNSAFE_COPY
instead of copying.

Generate the sheet (ONE image_gen call), then cp it. Do NOT run chroma-key removal, do NOT delete files. Finally print exactly:
  SHEET: {root}/_clapgen/raw/body_clap_{sex}_sheet.png (<W>x<H>)
"""

# sexe -> silhouette d'habits (neutre, recolorable). Smart-casual generique : ca
#  marche pour n'importe quel collegue/ami dans la foule de soutenance.
OUTFITS = {
 'h': "a generic adult MAN's body in smart-casual clothes: a plain long-sleeve crew-neck jumper/sweater over a collar, plain trousers, simple shoes. Sleeves reach the wrists; only the hands are bare skin.",
 'f': "a generic adult WOMAN's body in smart-casual clothes: a plain long-sleeve top/blouse, plain trousers or a knee-length skirt, simple flats. Sleeves reach the wrists; only the hands are bare skin.",
}

n = 0
for sex, outfit in OUTFITS.items():
    body = COMMON.format(sex=sex, root=ROOT, outfit=outfit)
    open(os.path.join(OUT, 'clap_%s.txt' % sex), 'w').write(body)
    n += 1
    print('wrote', 'clap_%s.txt' % sex)
print('%d prompts -> %s' % (n, OUT))
