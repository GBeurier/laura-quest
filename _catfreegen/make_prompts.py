#!/usr/bin/env python3
"""Genere un prompt image_gen par feuille de Laura -> retirer le chat du sac a dos.

Sortie : _catfreegen/prompts/<name>.txt  (un par feuille).
Le batch (run_batch.sh) lance `codex exec -i src/<name>.png < prompts/<name>.txt`,
le modele appelle SON image_gen et sauvegarde la planche brute dans raw/<name>_sheet.png.
postprocess.py la chroma-key + remet aux dimensions d'origine -> final/<name>_nocat.png.

A relancer apres edition :  python3 _catfreegen/make_prompts.py
"""
import os

ROOT = '/home/delete/laura_quest'
OUT = ROOT + '/_catfreegen/prompts'
os.makedirs(OUT, exist_ok=True)

# name : (nb_frames, description du mouvement de la feuille)
SHEETS = {
    'hero_idle':  (8, 'standing idle / gentle breathing loop'),
    'hero_run':   (8, 'a side-on RUN cycle (legs cycling, body bobbing up and down)'),
    'hero_jump':  (8, 'a JUMP arc (crouch, leap, rise, peak, fall, land)'),
    'hero_roll':  (8, 'gliding on inline ROLLER-SKATES (knees bent, leaning forward)'),
    'hero_bike':  (7, 'riding a small BICYCLE (seated, hands on the handlebars, pedalling)'),
    'hero_duck':  (7, 'progressively CROUCHING down (frame 0 standing -> last frame fully ducked)'),
    'hero_hurt':  (8, 'a recoil / HURT flinch (knocked back, wincing)'),
    'hero_throw': (6, 'a forward THROW gesture (wind-up then release with the arm)'),
}

HEADER = (
    'Use your built-in image_gen tool (the "imagegen" skill) to GENERATE raster pixel art. '
    'Do NOT use the CLI fallback (no OPENAI_API_KEY). Do NOT draw procedurally (no PIL/canvas/'
    'SVG). The artwork MUST come from your AI image generator.\n'
)


def make(name, frames, motion):
    p = HEADER + f"""
The ATTACHED image is a finished pixel-art SPRITE SHEET of "Laura", a cute cartoon
girl explorer (blonde ponytail, blue top, shorts, boots, RED BACKPACK), shown as
{frames} frames in ONE horizontal row: {motion}. She wears a red backpack and a small
WHITE/CREAM FLUFFY CAT pokes its head out of the top of the backpack.

YOUR ONE JOB: redraw this EXACT sheet but REMOVE THE CAT. The backpack must look
NORMAL and CLOSED/EMPTY (just the red backpack, its flap and straps) with NO animal,
NO cat head, NO ears, NO paws, NO tail anywhere.

FAITHFULNESS IS EVERYTHING — copy the input as closely as you can:
- SAME number of frames ({frames}), SAME poses in the SAME order, SAME body proportions,
  SAME size, SAME scale and SAME vertical position of Laura in each frame (keep the
  up/down bob of the original — do NOT flatten the animation, do NOT re-center).
- SAME palette, SAME outline, SAME 16-bit SNES pixel-art style, SAME facing direction.
- Change ONLY the backpack area (erase the cat, close the pack). Everything else pixel-faithful.

LAYOUT: ONE horizontal row of EXACTLY {frames} equal cells, Laura at the same scale and
baseline in every cell, with a WIDE empty magenta gap between frames (separate islands,
never touching).

BACKGROUND: fill the ENTIRE image (including the gaps) with ONE perfectly FLAT solid
#ff00ff magenta. NO shadow, NO floor line, NO gradient, NO grid, NO text, NO numbers,
NO watermark, NO border. NEVER use magenta/pink on Laura or the backpack.

After image_gen returns, copy ONLY the PNG created by THIS Codex session to:
  {ROOT}/_catfreegen/raw/{name}_sheet.png

CRITICAL: do NOT pick "the newest PNG" globally from ~/.codex/generated_images — other
agents may generate at the same time. Use only the generated_images subdirectory for YOUR
OWN Codex session id (printed in your header), or otherwise verify the file came from your
own image_gen call. If you cannot unambiguously identify your own PNG, copy nothing and
print FAIL_UNSAFE_COPY instead.

Generate the sheet (ONE image_gen call), then cp it. Do NOT run chroma-key removal, do NOT
delete files. Finally print exactly:
  SHEET: {ROOT}/_catfreegen/raw/{name}_sheet.png (<W>x<H>)
"""
    with open(f'{OUT}/{name}.txt', 'w') as f:
        f.write(p)
    print(f"  prompts/{name}.txt  ({frames} frames)")


for name, (frames, motion) in SHEETS.items():
    make(name, frames, motion)
print(f"\n{len(SHEETS)} prompts ecrits dans {OUT}")
