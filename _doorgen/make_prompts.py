#!/usr/bin/env python3
"""Emet le prompt Codex (built-in image_gen) pour la SORTIE de niveau de Laura
Quest : une PORTE DE LABORATOIRE moderne au logo CIRAD, en legere perspective
(penchee pour rester colineaire a l'ombre haut-gauche du jeu, comme les panneaux
solaires -- cf. SHADE_SLOPE dans js/game.js). Elle remplace l'ancien soleil de
sortie (tuile '*', gating "boss mort").

Un seul prompt -> a passer a `codex exec` (un appel image_gen). La planche brute
magenta atterrit dans _doorgen/raw/door.png, puis _doorgen/build.py la detoure
(chroma-key) + recadre + normalise -> assets/sprites/tile_exit_door.png.

  python3 _doorgen/make_prompts.py
  cd /home/delete/laura_quest && $HOME/.local/bin/codex exec \
      --dangerously-bypass-approvals-and-sandbox \
      < _doorgen/prompts/door.txt > _doorgen/gen_door.log 2>&1
  python3 _doorgen/build.py
  python3 gen_assets_data.py
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PROMPTS = os.path.join(HERE, "prompts")
RAW = os.path.join(HERE, "raw")

NAME = "door"
OUT_RAW = os.path.join(RAW, NAME + ".png")

PROMPT = (
    'Use your built-in image_gen tool (the "imagegen" skill) to GENERATE raster '
    'pixel art. Do NOT use the CLI fallback (no OPENAI_API_KEY). Do NOT draw '
    'procedurally (no PIL / SVG / HTML canvas / matplotlib). The artwork MUST come '
    'from your AI image generator. Produce EXACTLY ONE image (one image_gen call).\n\n'

    '=== WHAT IT IS ===\n'
    'A single SPRITE for a side-scrolling 16-bit platformer: the LEVEL-EXIT '
    'object -- a modern LABORATORY / research-institute DOOR (an automatic glass '
    'lab door set in a clean metal/aluminium frame) that the heroine walks into to '
    'finish the level. ABOVE the door, mounted on the wall/frame, a clean white '
    'horizontal SIGN BANNER bearing the logo text "CIRAD" in bold GREEN capital '
    'letters (CIRAD = a French agronomy research institute; institutional FOREST '
    'GREEN #006633). The five letters C I R A D must be clearly readable and '
    'correctly spelled. Optionally a small green leaf/sun emblem next to the word. '
    'The door panel itself can have a softly glowing inviting interior light, '
    'suggesting "enter here".\n\n'

    '=== PERSPECTIVE (CRITICAL) ===\n'
    'Show the door in a slight 3/4 / oblique PERSPECTIVE, LEANING so it stays '
    'COLINEAR with the game world shadow: the light comes from the TOP-LEFT, so the '
    'door is tilted/sheared so its top edge leans toward the upper-left and its '
    'right side recedes (a parallelogram-ish lean, the same slant as a thing casting '
    'a shadow down-right). It is NOT a flat front-facing rectangle and NOT top-down: '
    'it reads as a 3D doorway you see slightly from the left, set into a wall, with a '
    'lit near (left) edge and a darker receding (right) side giving depth.\n\n'

    '=== STYLE ===\n'
    'Retro 16-bit SNES pixel-art, CHUNKY and COARSE: BIG bold shapes, THICK dark '
    'outlines, large flat cel-shaded color areas, BIG visible square pixels, LOW '
    'native-resolution look (as if drawn around 40-56 px tall then enlarged). NO '
    'fine/dense detail, NO thin hairlines, NO smooth gradients, NO anti-aliasing, NO '
    '3D render, NO painterly/airbrushed look. Cheerful agrivoltaics-PhD research '
    'theme (lab, French academia, green energy). Limited palette: cool '
    'aluminium/steel greys for the frame, light blue-grey glass, white sign, CIRAD '
    'forest green, a warm glow inside.\n\n'

    '=== COMPOSITION / GEOMETRY ===\n'
    '  - ONE single centered object (the door + its CIRAD sign on top). NOT a '
    'tileable strip, NOT a repeating pattern, NOT a row of doors.\n'
    '  - Roughly SQUARE framing (1:1), the door+sign filling most of the image with '
    'a little breathing room. Portrait-tall door, wider where the sign sits on top.\n'
    '  - Self-contained: do not draw surrounding walls/floor/furniture beyond the '
    'thin frame the door sits in.\n\n'

    '=== BACKGROUND (CRITICAL -- chroma key) ===\n'
    'Fill the ENTIRE background (everything that is not the door+sign) with FLAT '
    'solid #ff00ff magenta. It will be keyed out and the object cropped. NEVER use '
    'magenta anywhere ON the door, frame, glass, glow or the CIRAD sign. NO drop '
    'shadow, NO gradient halo, NO extra text, NO frame border, NO grid lines, NO '
    'watermark, NO ground line.\n\n'

    '=== OUTPUT ===\n'
    'Save the raw image as: ' + OUT_RAW + '\n'
    'One image only. Slight top-left lean (colinear with a down-right shadow), '
    'readable green "CIRAD" sign above a modern lab door, chunky 16-bit pixel art, '
    'flat #ff00ff magenta background.\n'
)


def main():
    os.makedirs(PROMPTS, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    path = os.path.join(PROMPTS, NAME + ".txt")
    with open(path, "w") as f:
        f.write(PROMPT)
    print("wrote", path)
    print("\nNext (Codex session, ONE image_gen call):")
    print("  cd /home/delete/laura_quest && $HOME/.local/bin/codex exec "
          "--dangerously-bypass-approvals-and-sandbox \\")
    print("      < %s > %s/gen_door.log 2>&1" % (path, HERE))
    print("then: python3 _doorgen/build.py && python3 gen_assets_data.py")


if __name__ == "__main__":
    main()
