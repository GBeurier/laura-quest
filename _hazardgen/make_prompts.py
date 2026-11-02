#!/usr/bin/env python3
"""Emet les prompts Codex (built-in image_gen) pour les SOLS PIEGES ('%') de
Laura Quest : des FOSSES A DEGAT profondes, en perspective, encastrees dans le
sol (cf. spawnHazard dans js/game.js, SPRITES.md).

Un fichier de prompt par fosse -> a passer a `codex exec` (un appel image_gen
chacun). Les planches brutes magenta atterrissent dans _hazardgen/raw/<nom>.png,
puis _hazardgen/build.py les detoure (chroma-key) + normalise -> assets/sprites/.

  python3 _hazardgen/make_prompts.py
  # (session Codex) image_gen par prompt -> _hazardgen/raw/<nom>.png
  python3 _hazardgen/build.py
  python3 gen_assets_data.py
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PROMPTS = os.path.join(HERE, "prompts")
RAW = os.path.join(HERE, "raw")

PREAMBLE = (
    'Use your built-in image_gen tool (the "imagegen" skill) to GENERATE raster '
    'pixel art. Do NOT use the CLI fallback (no OPENAI_API_KEY). Do NOT draw '
    'procedurally (no PIL/SVG/canvas). The artwork MUST come from your AI image '
    'generator. You will generate {n} separate sprite(s) (one image_gen call '
    'each), each a SQUARE TILE of a floor HAZARD STRIP for a SIDE-SCROLLING 16-bit '
    'platformer.\n\n'
    'STYLE (every sprite): retro 16-bit SNES pixel-art, CHUNKY and COARSE. BIG bold '
    'shapes, THICK dark outlines, large flat cel-shaded color areas, only a FEW '
    'large elements. BIG visible square pixels, LOW native resolution look (as if '
    'drawn at about 32-40 px wide then enlarged). NO fine/dense/intricate detail, '
    'NO thin lines, NO tiny repeated specks, NO smooth gradients, NO anti-aliasing, '
    'NO 3D render, NO painterly/airbrushed look. Cheerful agrivoltaics-PhD farming '
    'game (rice paddies, lab research, French academia).\n\n'
    'VIEW / PERSPECTIVE (CRITICAL -- this is the #1 requirement): SIDE VIEW (side '
    'elevation), the way the player sees the world in a SIDE-SCROLLER -- looking at '
    'it horizontally FROM THE SIDE, only very slightly from above (~15 degrees). You '
    'SEE THE SIDE of the danger and a bit of its DEPTH, exactly like the spikes and '
    'the lava/acid in Super Mario or Metroid. This is absolutely NOT a top-down / '
    'map view: do NOT look straight down into a hole.\n\n'
    'WHAT IT IS (every sprite): a horizontal STRIP of deadly hazard set into the '
    'FLOOR, seen from the side. The TOP edge of the tile is the GROUND SURFACE LINE '
    '(where the player runs); just BELOW it the danger sits in a shallow trough cut '
    'into the ground. Show a little DEPTH on the side: a lit near edge (top-left) and '
    'a darker recess behind/below. In-game many identical tiles are laid edge-to-edge '
    'into ONE long strip -- so it MUST TILE SEAMLESSLY left-to-right.\n'
    'GEOMETRY (CRITICAL):\n'
    '  - PERFECT SQUARE image (1:1); the hazard FILLS THE WHOLE SQUARE edge to edge.\n'
    '  - SEAMLESS HORIZONTAL TILING: the ground line and the danger run STRAIGHT OFF '
    'both the LEFT and the RIGHT edge so copies abut into one continuous strip. Draw '
    'NO left wall and NO right wall -- the pattern simply continues sideways.\n'
    '  - It is a FLOOR HAZARD STRIP -- NOT a single centered object, NOT a bucket / '
    'pot / vessel, NOT a wall standing up, NOT a top-down hole.\n\n'
    'BACKGROUND (every sprite): the hazard fills the ENTIRE square (opaque tile, '
    'essentially no background). If any sliver is left in the very corners, make it '
    'FLAT solid #ff00ff magenta (chroma-key, removed/cropped later). NO drop shadow, '
    'NO gradient halo, NO text, NO frame border, NO grid lines, NO watermark. NEVER '
    'use magenta inside the art, and NEVER along the LEFT or RIGHT edges (they must '
    'stay live so the tiling is seamless).'
)

# nom de sortie -> description du DANGER (vue de COTE, gros et grossier)
HAZARDS = {
    "hazard_paddy": (
        "RICE-PADDY PUNJI HAZARD (outdoor), SIDE VIEW. A row of BIG CHUNKY sharpened "
        "BAMBOO stakes pointing UP, seen from the SIDE, planted in muddy brown-green "
        "paddy water/earth. Only a FEW large stakes across (about 4 to 6), thick dark "
        "outlines, tan/green bamboo with dark sharp tips and a bright top-left "
        "highlight on each. Big, bold, menacing, lethal."
    ),
    "hazard_acid": (
        "INDOOR ACID HAZARD (laboratory), SIDE VIEW. A trough of bubbling TOXIC "
        "ACID-GREEN corrosive liquid set into the floor, seen from the side: a big "
        "wavy bright surface line near the top and a FEW BIG round rising bubbles, "
        "glowing caustic green, with a darker recess behind. Chunky, bold, lethal."
    ),
    "hazard": (
        "STEEL SPIKE HAZARD (generic), SIDE VIEW. A row of BIG CHUNKY triangular "
        "grey IRON / STEEL spikes pointing UP, seen from the SIDE, set into a dark "
        "metal/stone trough in the floor. Only a FEW large spikes across (about 4 to "
        "6), thick dark outlines, cold metal with a bright highlight on the "
        "upper-left face and a dark shadow side. Stark, bold, lethal."
    ),
}


def main():
    os.makedirs(PROMPTS, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    head = PREAMBLE.format(n=1)
    for name, subject in HAZARDS.items():
        body = (
            head + "\n\n=== SPRITE: " + name + " ===\n" + subject + "\n\n"
            "Save the raw sheet as: " + os.path.join(RAW, name + ".png") + "\n"
            "Make it a PERFECT SQUARE (1:1), SIDE VIEW (NOT top-down), CHUNKY/COARSE "
            "with only a FEW big bold elements (thick outlines, big pixels), and "
            "SEAMLESSLY TILEABLE left-to-right (ground line + danger run straight off "
            "both side edges; no left/right wall).\n"
        )
        path = os.path.join(PROMPTS, name + ".txt")
        with open(path, "w") as f:
            f.write(body)
        print("wrote", path)
    print("\nNext (Codex session, ONE image_gen call per prompt, SEQUENTIAL):")
    for name in HAZARDS:
        print("  codex exec \"$(cat %s/%s.txt)\"" % (PROMPTS, name))
    print("then: python3 _hazardgen/build.py && python3 gen_assets_data.py")


if __name__ == "__main__":
    main()
