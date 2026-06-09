#!/usr/bin/env python3
"""CORPS AFFALES (cadavres) : un prompt Codex par CORPS de passant, + la 1re
frame de chaque planche de marche comme IMAGE DE REFERENCE a fournir a image_gen.

Pour chaque body_<biome>_<sex>_sheet.png de _bodygen/raw (cycle de marche, corps
SANS TETE de face sur magenta), on :
  1. extrait la 1re frame -> _bodygen/dead_ref/body_<biome>_<sex>_ref.png
     (detoure, transparent) = la POSE DEBOUT de reference (meme tenue).
  2. ecrit _bodygen/prompts_dead/<biome>_<sex>.txt = demande a Codex de REDESSINER
     ce MEME personnage (meme tenue) AFFALE par terre, 1 SEULE frame, mais le
     COU/HAUT DU CORPS reste DROIT (vertical) pour que la tete (ajoutee en jeu)
     s'attache bien d'aplomb. Sortie raw : body_<biome>_<sex>_dead_sheet.png.

Decoupe ensuite via _bodygen/regrid_dead.py -> assets/sprites/body_<biome>_<sex>_dead.png.
Convention de nom = celle attendue par corpsify() dans js/game.js (<body>_dead).

  biomes : champ / pote / horti / labo / bureau     sexes : h / f
"""
import os
from PIL import Image
import numpy as np

ROOT = '/home/delete/laura_quest'
RAW = os.path.join(ROOT, '_bodygen', 'raw')
OUT = os.path.join(ROOT, '_bodygen', 'prompts_dead')
REF = os.path.join(ROOT, '_bodygen', 'dead_ref')
os.makedirs(OUT, exist_ok=True)
os.makedirs(REF, exist_ok=True)

# Tenues IDENTIQUES a _bodygen/make_prompts.py (garder synchro si on les change).
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

COMMON = """Use your built-in image_gen tool (the "imagegen" skill) to GENERATE raster pixel art. Do NOT use the CLI fallback (no OPENAI_API_KEY). Do NOT draw procedurally (no PIL/canvas/SVG). The artwork MUST come from your AI image generator. You will generate ONE single-frame sprite = a KNOCKED-OUT (dead) version of a HEADLESS character BODY for a cute cartoon platformer.

REFERENCE IMAGE: a reference PNG of this exact character STANDING is provided ({ref}). Keep the SAME outfit, SAME colors, SAME body type. Only change the POSE (standing -> collapsed on the ground).

PIXEL-ART STYLE: retro 16-bit SNES look. Crisp visible square pixels, bold dark outline, limited vibrant palette, flat cel shading, chunky readable shapes. NO smooth gradients, NO anti-aliasing, NO 3D. Cute, comedic, NOT gory.

CRITICAL — HEADLESS, SEEN FROM THE FRONT:
- The body is seen STRAIGHT FROM THE FRONT (facing the viewer), roughly symmetric. NOT a side view, NOT lying flat in profile.
- There is NO HEAD and NO FACE. The body ends at the top in a short bare NECK STUMP (just the neck/shoulders) where a head will be attached later. Do NOT draw any head, hair, ears, or face.

POSE — COLLAPSED / KNOCKED OUT, BUT NECK UPRIGHT (critical):
- The character has SLUMPED to the GROUND: sitting / sprawled on its bottom, LEGS splayed forward and limp, ARMS limp at the sides or resting on the floor. A defeated, knocked-out body that has dropped to the floor.
- BUT the SHOULDERS and the NECK STUMP stay UPRIGHT and VERTICAL, centered at the TOP of the sprite, pointing straight UP (so an upright head can be placed on it). The torso sags a little but the neck must NOT tilt sideways and must NOT lie down flat.
- Lower / wider than the standing pose (the body is on the ground), the LOWEST point = the bottom (buttocks / legs) resting on the floor baseline.
- Limp, heavy, "passed out" feel. Eyes-closed mood. No blood, no wound — just collapsed.

LAYOUT: ONE single sprite, ONE body, centered. NO grid, NO multiple frames.

BACKGROUND: fill the ENTIRE image with ONE perfectly FLAT solid #ff00ff magenta. NO shadow, NO floor line, NO gradient, NO grid, NO text, NO watermark. NEVER use magenta/pink on the body.

OUTFIT (same as the reference, identical colors): {outfit}

cp the generated PNG to {root}/_bodygen/raw/body_{biome}_{sex}_dead_sheet.png

Generate the sprite (ONE image_gen call), then cp it. Do NOT run chroma-key removal, do NOT delete files. Finally print exactly:
  SHEET: {root}/_bodygen/raw/body_{biome}_{sex}_dead_sheet.png (<W>x<H>)
"""


def key_magenta(im, tol=72):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (np.abs(r - 255) + np.abs(g - 0) + np.abs(b - 255) < tol) | ((r > 150) & (b > 150) & (g < 110))
    a[..., 3] = np.where(bg, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def first_frame_ref(sheet_path, out_path, n=4):
    """1re frame (even-slice) detouree -> PNG transparent de reference."""
    img = key_magenta(Image.open(sheet_path))
    W, H = img.size
    cw = W // n
    c = img.crop((0, 0, cw, H))
    bb = c.getbbox()
    if bb:
        c = c.crop(bb)
    c.save(out_path)
    return c.size


def main():
    n = 0
    for biome, (oh, of) in BIOMES.items():
        for sex, outfit in (('h', oh), ('f', of)):
            sheet = os.path.join(RAW, 'body_%s_%s_sheet.png' % (biome, sex))
            ref = os.path.join(REF, 'body_%s_%s_ref.png' % (biome, sex))
            if os.path.exists(sheet):
                sz = first_frame_ref(sheet, ref)
                print('ref %s_%s %s' % (biome, sex, sz))
            else:
                print('WARN planche absente: %s (prompt ecrit quand meme)' % sheet)
            body = COMMON.format(biome=biome, sex=sex, root=ROOT, outfit=outfit, ref=ref)
            open(os.path.join(OUT, '%s_%s.txt' % (biome, sex)), 'w').write(body)
            n += 1
    print('%d prompts -> %s' % (n, OUT))
    print('refs            -> %s' % REF)


if __name__ == '__main__':
    main()
