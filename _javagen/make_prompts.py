#!/usr/bin/env python3
"""Prompts Codex (image_gen) du DECOR de la campagne MARCOS (Java) -> prompts/<nom>.txt.

Meme schema que les autres _*gen/ : UN image_gen par session codex, SEQUENTIEL
(run.sh), brut copie dans raw/<nom>.png, puis build.py normalise vers les tailles
des ANALOGUES existants et ecrit assets/sprites/ :

  tile_bamboo        144x88   (= tile_panel)   cap penche : cadre bambou + filet d'ombrage noir
  bamboo_leg         96x48    (= panel_leg)    2 poteaux bambou (etires en Y par le moteur)
  bg_java_volcano    960x480  (= bg_mountains) couche lointaine, ciel transparent, bas opaque
  bg_java_village    768x300  (= bg_hills)     couche moyenne, ciel transparent, bas opaque
  bg_java_paddy      2027x370 (= bg_field)     couche proche, contenu en bas, haut transparent
  bg_marcos_map      1920x1056 jpg (= bg_map)  carte vue de dessus, 3 noeuds le long d'un chemin
  bg_marcos_chapter  1672x941  jpg (= bg_chapter)
  bg_marcos_win      1672x941  jpg (= bg_win)

REFS (-i) : photos d'inspiration redimensionnees dans refs/ (gitignore, cf. run.sh).
Usage : python _javagen/make_prompts.py [nom ...] ; bash _javagen/run.sh [nom ...] ; python _javagen/build.py [nom ...]
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw').replace(os.sep, '/')
OUT = os.path.join(HERE, 'prompts')

HEAD = ('Use your built-in image_gen tool (the "imagegen" skill) to GENERATE raster pixel art. Do NOT use the CLI '
        'fallback (no OPENAI_API_KEY). Do NOT draw procedurally (no PIL/SVG/canvas). The artwork MUST come from your '
        'AI image generator. Generate exactly ONE image (ONE image_gen call).\n\n')

PIX = ('STYLE: retro 16-bit SNES pixel art matching a cute cartoon run-and-gun platformer. Crisp visible square pixels, '
       'bold dark outlines, limited vibrant palette, flat cel shading, chunky readable shapes. NO smooth gradients, NO '
       'anti-aliasing, NO 3D render, NO painterly/airbrushed look, NO photo-realism.\n\n')

SCENE = ('STYLE: retro 16-bit pixel art, cozy and CUTE storybook warmth (LucasArts / SNES adventure vibe), crisp visible '
         'square pixels, bold dark outlines, limited warm vibrant palette, flat cel shading, soft chunky readable shapes. '
         'NO smooth gradients, NO 3D render, NO painterly/airbrushed look, NO photographic realism.\n\n'
         'FORMAT: ONE wide LANDSCAPE illustration, full-bleed, filling the ENTIRE frame edge to edge (a full-screen GAME '
         'BACKGROUND: no padding, no border, NO magenta anywhere). The very top ~8% and bottom ~8% may be cropped.\n\n'
         'SETTING: an agrivoltaic EXPERIMENTAL RICE FIELD in JAVA, Indonesia (see the attached reference photos for the '
         'real place): bright green rice paddies, rows of BAMBOO shade structures (bamboo poles and frames holding '
         'stretched BLACK or dark-green SHADE NETS above the rice), muddy paths, coconut palms and bamboo groves, a '
         'big blue VOLCANO in the distance, cloudy tropical sky.\n\n')

BAND = ('FORMAT (CRITICAL): a WIDE horizontal PANORAMA STRIP for a side-scrolling PARALLAX background layer, seen '
        'straight from the SIDE (side elevation, like a stage backdrop). The scenery sits in the LOWER part of the '
        'image and runs across the FULL WIDTH, continuing straight off BOTH the left and the right edges (it will be '
        'tiled horizontally, so: no frame, no vignette, nothing that ends at the sides, keep the left and right edges '
        'similar in height and color). Everything ABOVE the scenery (the sky) must be ONE perfectly FLAT solid #ff00ff '
        'magenta (chroma-key). NO clouds, NO sun, NO birds in the sky: just flat magenta. NEVER use magenta or pink in '
        'the scenery itself. NO text, NO people, NO watermark.\n\n')

SPRITE_BG = ('BACKGROUND: fill the ENTIRE image around the object with ONE perfectly FLAT solid #ff00ff magenta. NO '
             'shadow, NO contact shadow, NO floor line, NO gradient, NO text, NO labels, NO watermark. NEVER use '
             'magenta or pink on the object.\n\n')

TAIL = ('After image_gen returns, copy ONLY the PNG created by THIS Codex session to:\n  {raw}/{name}.png\n'
        'CRITICAL: do NOT select "the newest PNG" globally from ~/.codex/generated_images. Use only the generated_images '
        'subdirectory for YOUR OWN Codex session id, or otherwise verify the file was produced by your own image_gen '
        'call. If you cannot identify it unambiguously, print FAIL_UNSAFE_COPY instead.\n'
        'Do NOT run chroma-key removal, do NOT delete files. Finally print exactly:\n  RAW: {raw}/{name}.png (<W>x<H>)\n')

# nom -> (refs -i (noms dans refs/), corps du prompt)
ASSETS = {
 'tile_bamboo': (['panel_geom.png', 'shade_black.jpg'], HEAD + PIX + SPRITE_BG +
   'The FIRST attached image is the GEOMETRY reference: a game platform tile showing a tilted solar panel seen in '
   'side/3-4 perspective (a flat parallelogram leaning back toward the upper-left, front edge horizontal at the bottom, '
   'on a low base). The SECOND attached image is a real photo of the agrivoltaic shade structures to depict.\n\n'
   'SUBJECT: redraw that EXACT SAME platform shape, angle, proportions and framing, but as an agrivoltaic BAMBOO SHADE '
   'STRUCTURE TOP instead of a solar panel: a rectangular FRAME of thick tan-yellow BAMBOO poles (visible node rings, '
   'lashed corners with rope), with a BLACK SHADE NET (dark knitted mesh, slightly translucent texture, a little sag) '
   'stretched tightly across the frame. Along the bottom FRONT edge, instead of the panel base, a thick horizontal '
   'BAMBOO crossbeam (the beam the hero stands on), with short bamboo stubs where the legs attach. ONE single object, '
   'centered, filling about 80% of the width, wide and flat like the reference.\n\n'),
 'bamboo_leg': (['tile_bamboo_raw.png'], HEAD + PIX + SPRITE_BG +
   'The ATTACHED image is the bamboo shade-net frame this pole supports: use EXACTLY the same bamboo colors '
   '(warm orange-tan / golden-yellow bamboo, brown node rings, dark outline) and the same pixel-art style.\n\n'
   'SUBJECT: ONE single straight VERTICAL BAMBOO POLE (a structural leg of that shade structure), standing perfectly '
   'vertical and centered, spanning almost the FULL HEIGHT of the image (top and '
   'bottom cut flat). Warm golden-tan bamboo matching the attached frame (NOT lime green), a bright highlight stripe on the left side and a darker shadow '
   'stripe on the right side, thick dark outline, only 2 or 3 subtle node rings far apart. The pole is about 1/8 of the '
   'image width. Plain and clean, no leaves, no rope, no ground.\n\n'),
 'bg_java_volcano': (['volcano_paddy.jpg', 'volcano_shade.jpg'], HEAD + PIX + BAND +
   'SCENERY: the FAR distance layer: a range of JAVANESE VOLCANOES in soft blue atmospheric HAZE, one big classic '
   'cone-shaped volcano with a small wisp of white smoke at its summit and a couple of smaller volcanic peaks and long '
   'ridges beside it, painted in hazy desaturated blues and blue-greens (lighter toward the top, aerial perspective), '
   'a band of distant hazy green forest and palm silhouettes along the bottom. The mountains occupy the lower ~65% of '
   'the image, and the bottom ~25% is a SOLID band of hazy blue-green lowland that reaches the bottom edge.\n\n'),
 'bg_java_village': (['houses.jpg', 'build_site.jpg'], HEAD + PIX + BAND +
   'SCENERY: the MIDDLE distance layer: a row of NEW INDONESIAN VILLAGE HOUSES and constructions-in-progress at the '
   'edge of the rice fields: small white and pastel concrete houses with orange TERRACOTTA tile roofs, one half-built '
   'house with exposed red bricks and bamboo scaffolding, a tall red-and-white TELECOM / cell TOWER, a small mosque '
   'dome, coconut PALM trees and feathery BAMBOO clumps between the houses, two parked scooters, a low wall. The '
   'buildings occupy the lower ~70% of the image; the bottom ~20% is a SOLID band of green grass and hedges reaching '
   'the bottom edge. Slightly desaturated (it is mid-distance).\n\n'),
 'bg_java_paddy': (['shade_black.jpg', 'shade_green.jpg', 'birdnet.jpg'], HEAD + PIX + BAND +
   'SCENERY: the NEAR layer: a LOW strip of bright green RICE PADDIES seen from the side, with ROWS of agrivoltaic '
   'BAMBOO SHADE STRUCTURES standing in them: bamboo poles holding flat horizontal frames covered with stretched '
   'BLACK and dark-GREEN SHADE NETS above the rice (exactly like the attached photos), one tall structure covered by a '
   'white bird-net, a stack of cut bamboo poles lying on a muddy dyke, a small parked red scooter. Keep it LOW and '
   'wide: everything fits in the bottom ~35% of the image (the structures are short), the rest above is flat magenta. '
   'The bottom edge is solid green rice / mud.\n\n'),
 'bg_marcos_map': (['shade_black.jpg', 'volcano_paddy.jpg'], HEAD + SCENE +
   'SCENE: a cute TOP-DOWN WORLD MAP (bird\'s-eye view, like a classic 16-bit overworld map) of the Javanese '
   'experimental field. A winding sandy-brown DIRT PATH goes from the LOWER-LEFT, through the CENTER, to the '
   'UPPER-RIGHT. Along it, three clear empty round flat CLEARINGS (where level markers will be drawn, keep them plain '
   'and uncluttered): one at about 20% from the left / 72% from the top in the green RICE PADDIES with muddy '
   'patches; one at about 49% from the left / 57% from the top next to a small VILLAGE with orange terracotta roofs '
   'and a road with tiny scooters; one at about 79% from the left / 44% from the top in the AGRIVOLTAIC PLOT (neat '
   'rows of rectangular BLACK shade nets on bamboo frames, seen from above). In the TOP-RIGHT corner a big blue '
   'VOLCANO with a smoke wisp. Palm trees, bamboo groves, irrigation canals, terraced paddies everywhere else. NO '
   'text, NO labels, NO signs, NO numbers.\n\n'),
 'bg_marcos_chapter': (['shade_black.jpg'], HEAD + SCENE +
   'SCENE: a cosy place to write a thesis chapter in the field: inside an open BAMBOO FIELD HUT (a gazebo / saung '
   'with a thatched roof and bamboo posts) looking out over the rice paddies under a soft cloudy afternoon sky. On a '
   'low bamboo table in the foreground: an open laptop showing a little rice-growth chart, a thick notebook, a glass '
   'of sweet iced tea, an acoustic GUITAR leaning against the table, a half-eaten opened durian on a plate. Outside: '
   'rows of bamboo shade structures with black nets, the blue volcano far away. Calm, warm, inviting. NO people, NO '
   'text, NO legible writing.\n\n'),
 'bg_marcos_win': (['shade_black.jpg', 'volcano_paddy.jpg'], HEAD + SCENE +
   'SCENE: a joyful PhD CELEBRATION in the rice field at golden hour: many black graduation CAPS (mortarboards with '
   'golden tassels) thrown high up into the air, golden CONFETTI and sparkles raining down, an acoustic guitar and a '
   'thick bound thesis book resting on a bamboo bench in the lower center, rows of bamboo shade structures with black '
   'nets over bright green paddies stretching to the horizon, the blue volcano under a warm golden sky with a big '
   'friendly sun. Keep the UPPER THIRD calm (soft sky, few sparkles) for a title overlay. NO people, NO faces, NO '
   'text, NO letters.\n\n'),
}

if __name__ == '__main__':
    only = set(sys.argv[1:])
    os.makedirs(OUT, exist_ok=True)
    for name, (refs, body) in ASSETS.items():
        if only and name not in only:
            continue
        p = os.path.join(OUT, name + '.txt')
        open(p, 'w', encoding='utf-8').write(body + TAIL.format(raw=RAW, name=name))
        open(os.path.join(OUT, name + '.refs'), 'w', encoding='utf-8').write('\n'.join(refs) + '\n')
        print('wrote', p, 'refs:', ', '.join(refs))
