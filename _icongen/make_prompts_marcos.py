#!/usr/bin/env python3
"""Prompts Codex (image_gen) des icones de la CAMPAGNE MARCOS -> prompts_marcos/<nom>.txt.

UNE icone par session codex (cp sur raw/<nom>.png), meme contrat de style que
make_prompts.py (pixel-art 16-bit, contour sombre, fond magenta plat). Ensuite
_icongen/build_marcos.py met en feuille :
  ammo_note / ammo_note_fire -> 6 frames (wobble + pulse), cellules 52 / 56 (= ammo_graine / _fire)
  shot_*                     -> 1 frame 96x96, pointe a DROITE, halo sombre (= shot_error)
  pickup_durian              -> bump 4 frames cellule 64 (= pickup_croquette)
Usage : python _icongen/make_prompts_marcos.py ; bash _icongen/run_marcos.sh [nom ...]
"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace(os.sep, '/')
RAW = ROOT + '/_icongen/raw'
OUT = os.path.join(ROOT, '_icongen', 'prompts_marcos')

PRE = ('Use your built-in image_gen tool (the "imagegen" skill) to GENERATE raster pixel art. '
       'Do NOT use the CLI fallback (no OPENAI_API_KEY). Do NOT draw procedurally (no PIL/SVG/canvas). '
       'The artwork MUST come from your AI image generator. You will generate ONE game-item icon (ONE image_gen call).\n\n'
       'STYLE: retro 16-bit SNES pixel-art GAME ICON for a cheerful cartoon platformer set in the rice fields of Java (Indonesia). '
       'Crisp visible square pixels, bold dark brown/black outline, limited warm vibrant palette, flat cel shading, chunky readable '
       'CUTE shapes, a touch of humor. NO smooth gradients, NO anti-aliasing, NO 3D, NO painterly/airbrushed look.\n\n'
       'COMPOSITION: ONE single object, centered, with empty padding all around (the object fills about {fill} of the square '
       'frame and never touches the edges).{extra}\n\n'
       'BACKGROUND: fill the ENTIRE image with ONE perfectly FLAT solid #ff00ff magenta. NO shadow, NO contact shadow, NO floor '
       'line, NO gradient, NO vignette, NO text, NO letters, NO numbers, NO frame, NO grid, NO watermark. NEVER use magenta or '
       'pink anywhere on the object itself.\n\n'
       'SUBJECT: {subj}\n\n'
       'After image_gen returns, copy ONLY the PNG created by THIS Codex session to:\n  {raw}/{name}.png\n'
       'CRITICAL: do NOT select "the newest PNG" globally from ~/.codex/generated_images. Use only the generated_images '
       'subdirectory for YOUR OWN Codex session id, or otherwise verify the file was produced by your own image_gen call. '
       'If you cannot identify it unambiguously, print FAIL_UNSAFE_COPY instead.\n'
       'Do NOT run chroma-key removal, do NOT delete files. Finally print exactly:\n  RAW: {raw}/{name}.png (<W>x<H>)\n')

SHOT = ('\nThis is a PROJECTILE that flies fast and small over a busy colorful background, so it MUST pop: a BOLD, SIMPLE, '
        'HIGH-CONTRAST silhouette readable at tiny size, VERY THICK dark outline, bright saturated colors, strong light/shadow, '
        'clearly oriented as THROWN to the RIGHT (leading tip toward the right edge), with a couple of short motion streaks behind '
        'it on the left. Chunky and uncluttered, NO tiny fragile details.')

ICONS = {
 'ammo_note': ('75%', '\nThis is the hero\'s ammo: a magical MUSIC NOTE shot from a guitar. Compact, reads well while wobbling.',
   'ONE single bold MUSIC NOTE (an eighth note: a filled oval note head, a vertical stem and one curly flag), warm GOLD with '
   'creamy-white highlights and a thick dark outline, a few tiny sparkles around it, glowing and joyful.'),
 'ammo_note_fire': ('75%', '\nThis is the hero\'s POWERED-UP ammo (level 3). Use the ATTACHED image as the exact reference: the SAME '
   'music note shape, now ON FIRE.',
   'the SAME bold gold MUSIC NOTE (eighth note with one curly flag) as the attached reference, now wrapped in bright orange-and-'
   'yellow pixel FLAMES licking upward around it, a few embers, a hot glowing white-yellow core. Powerful and fiery, still clearly a music note.'),
 'shot_mud': ('85%', SHOT,
   'a wet glob / CLOD OF BROWN RICE-PADDY MUD flying right, lumpy and dripping, darker brown shading, a few small mud droplets '
   'trailing behind on the left, a little wet shine highlight, a stray rice straw stuck in it.'),
 'shot_durian': ('85%', SHOT,
   'a whole spiky green DURIAN FRUIT thrown through the air: a round olive-green husk covered in sharp conical thorns, a short '
   'brown stem, tumbling toward the right, a small green stink cloud trailing behind on the left.'),
 'shot_spine': ('85%', SHOT,
   'ONE single sharp DURIAN SPIKE / thorn, an elongated cone shape pointing RIGHT, olive-green at the base turning yellow-brown '
   'at the very sharp tip, like a little dart.'),
 'shot_net': ('85%', SHOT,
   'a thrown ROPE FISHING NET spread open in mid-air, a square-ish mesh of thick tan rope knots with small round dark weights '
   'on its corners, billowing toward the right like a trap.'),
 'shot_feather': ('85%', SHOT,
   'ONE single sharp FEATHER thrown like a dart, brown-and-gold eagle feather with a white quill, the pointed quill tip leading '
   'RIGHT, a razor-sharp gleaming edge.'),
 'pickup_durian': ('62%', '\nThis is a collectible PICKUP (a tasty treat), it must look appetizing and inviting.',
   'an OPENED DURIAN fruit: the spiky green husk split open showing plump creamy pale-YELLOW custardy pods inside, looking '
   'delicious, with a small funny curly GREEN STINK CLOUD wafting above it (cartoon smell lines).'),
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, (fill, extra, subj) in ICONS.items():
        p = os.path.join(OUT, name + '.txt')
        open(p, 'w', encoding='utf-8').write(PRE.format(fill=fill, extra=extra, subj=subj, raw=RAW, name=name))
        print('wrote', p)
