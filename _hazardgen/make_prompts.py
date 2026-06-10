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
    'each), each a DEADLY PIT carved into the ground for a 16-bit platformer.\n\n'
    'STYLE (every sprite): retro 16-bit SNES pixel-art, crisp visible square '
    'pixels, BOLD dark outline, limited saturated palette, flat cel shading, '
    'high contrast. NO smooth gradients, NO anti-aliasing, NO 3D render, NO '
    'painterly/airbrushed look. This is a cheerful agrivoltaics-PhD farming '
    'platformer (rice paddies, lab research, French academia).\n\n'
    'WHAT IT IS (every sprite): a HOLE / PIT carved into the FLOOR that the player '
    'looks DOWN into -- a recessed trap she runs over. Seen from a STEEP overhead '
    '3/4 angle (as if standing right over it, looking down INTO it).\n'
    'GEOMETRY (CRITICAL -- read carefully, every sprite):\n'
    '  - WIDE and SHORT image (about 2:1, much wider than tall).\n'
    '  - The OPENING is a WIDE foreshortened ELLIPSE that lies FLAT on the ground '
    'and FILLS the frame. You look straight DOWN into the hole.\n'
    '  - The DANGER (acid / stakes / spikes) FILLS the whole opening and is fully '
    'visible from above -- it is the main subject, NOT hidden at a far bottom.\n'
    '  - Only a SHALLOW band of inner WALL shows around the rim, darkening fast '
    'with depth (trompe-l\'oeil: it reads as a deep shaft whose bottom you cannot '
    'see). Near (front/bottom) rim lit from the UPPER-LEFT; far (top) rim is the '
    'back edge.\n'
    'IT IS A HOLE IN THE FLOOR (flat ground decal) -- NOT a bucket, pot, cauldron, '
    'barrel, basket, tub, bowl or vessel, and NOT a wall/billboard standing up. Do '
    'NOT draw any OUTSIDE of a container (no belly, base, handles, legs). Only the '
    'ground cut away and the inside of the hole, seen from above.\n\n'
    'TROMPE-L\'OEIL (THE WHOLE POINT): a flat decal that creates a CONVINCING '
    'illusion of a REAL hole the player could fall into -- like anamorphic '
    'sidewalk-chalk "pit" street-art, but clean 16-bit pixel art. Sell depth with '
    'strong upper-left light, a bright sunlit near rim, a hard dark inner-shadow '
    'just under the rim, and the danger sitting down inside. Cracks/dirt/tiles on '
    'the rim continue the surrounding floor. Carved and three-dimensional, never a '
    'flat painted patch, never a cartoon black oval.\n\n'
    'BACKGROUND (every sprite): fill the ENTIRE area AROUND the pit with ONE '
    'perfectly FLAT solid #ff00ff magenta (chroma-key, removed later) so the pit '
    'composites into ANY floor. Only a THIN ring of exposed earth/material may '
    'border the mouth. The pit fills ~85% of the frame, mouth touching the top. '
    'NO drop shadow on the magenta, NO floor texture around it, NO gradient, NO '
    'text, NO frame, NO grid, NO watermark. NEVER use magenta/pink inside the pit.'
)

# nom de sortie -> description du DANGER au fond + matiere du rebord
HAZARDS = {
    "hazard_paddy": (
        "RICE-PADDY PUNJI PIT (outdoor), seen from ABOVE. A nest of sharpened "
        "BAMBOO / wooden stakes pointing UP at the viewer out of murky brown-green "
        "muddy paddy water that fills the opening, with water ripples and glints. "
        "Stakes are tan/green with dark sharp tips, menacing. The rim is wet "
        "exposed MUD/EARTH with a few reeds. Muddy, wet, organic, lethal."
    ),
    "hazard_acid": (
        "INDOOR ACID PIT (laboratory), seen from ABOVE. A wide pool of bubbling "
        "TOXIC ACID-GREEN corrosive liquid fills the opening, glowing, with rising "
        "bubbles and a bright caustic sheen. The rim is BROKEN CRACKED TILE / pale "
        "concrete (light, so it reads on a dark floor), with a drip or two. "
        "Industrial, chemical, lethal."
    ),
    "hazard": (
        "STEEL SPIKE PIT (generic), seen from ABOVE. A bed of sharp grey IRON / "
        "STEEL spikes points UP at the viewer from a dark hole, cold metal with "
        "bright highlights and deep shadow between them. The rim is cracked stone "
        "/ dark metal. Stark and lethal."
    ),
}


def main():
    os.makedirs(PROMPTS, exist_ok=True)
    os.makedirs(RAW, exist_ok=True)
    head = PREAMBLE.format(n=1)
    for name, subject in HAZARDS.items():
        body = (
            head + "\n\n=== SPRITE: " + name + " ===\n" + subject + "\n\n"
            "Save the raw magenta sheet as: " + os.path.join(RAW, name + ".png") + "\n"
            "Make it WIDE and SHORT (about 2:1), the elliptical opening filling the "
            "frame, danger seen from above.\n"
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
