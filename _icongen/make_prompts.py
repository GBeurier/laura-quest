#!/usr/bin/env python3
"""Emet les prompts codex (built-in image_gen) pour les icones de Laura Quest.

Un fichier de prompt par GROUPE -> a passer a `codex exec`. Chaque icone est
un objet unique, pixel-art Monkey Island, centre+petit, sur fond plein #ff00ff
magenta (chroma-key local ensuite). cp vers _icongen/raw/<nom>.png.
"""
import os

RAW = "/home/delete/laura_quest/_icongen/raw"

PREAMBLE = (
    'Use your built-in image_gen tool (the "imagegen" skill) to GENERATE raster '
    'pixel art. Do NOT use the CLI fallback (no OPENAI_API_KEY). Do NOT draw '
    'procedurally (no PIL/SVG/canvas). The artwork MUST come from your AI image '
    'generator. You will generate {n} separate game-item icons (one image_gen '
    'call each).\n\n'
    'STYLE (every icon): retro 16-bit pixel-art GAME ICON, classic LucasArts '
    '"Monkey Island" / SCUMM vibe. Crisp visible square pixels, bold dark brown '
    'outline, limited warm vibrant palette, flat cel shading, chunky readable '
    'CUTE shapes, a touch of humor. NO smooth gradients, NO anti-aliasing, NO 3D, '
    'NO painterly/airbrushed look.\n\n'
    'COMPOSITION (every icon): ONE single object, centered, SMALL, with WIDE '
    'empty padding all around (the object fills about 55-65% of the square frame '
    'and never touches the edges). These belong to a cheerful agrivoltaics-PhD '
    'farming platformer (sun, solar panels, crops, lab research, French academia).'
    '\n\nBACKGROUND (every icon): fill the ENTIRE image with ONE perfectly FLAT '
    'solid #ff00ff magenta. NO shadow, NO contact shadow, NO floor line, NO '
    'gradient, NO vignette, NO text, NO frame, NO grid, NO watermark. NEVER use '
    'magenta or pink anywhere on the object itself.\n'
)

SHOT_NOTE = (
    '\nCRITICAL for these PROJECTILE icons (they fly fast and small over a busy '
    'colorful background, so they MUST pop): draw each as a BOLD, SIMPLE, '
    'HIGH-CONTRAST silhouette that reads instantly at tiny size. Use a VERY THICK '
    'dark almost-black outline, BRIGHT saturated colors, strong light/shadow, and '
    'fill ~85% of the frame (little padding). Make it look MENACING/dangerous '
    '(a clear incoming threat), clearly oriented as THROWN to the RIGHT (leading '
    'tip toward the right edge), with a couple of short motion streaks behind it. '
    'Keep the shape chunky and uncluttered — NO tiny fragile details.\n'
)

# nom de sortie -> sujet
PICKUPS = {
    "pickup_sunray":    "a cheerful round smiling SUN radiating warm chunky sun-rays, a glowing solar-energy token",
    "pickup_cafe":      "a cozy inviting cup of warm latte coffee in a rounded mug, with a cute little HEART drawn in the cream foam and gentle curls of steam, cheerful comforting and appetizing, a delightful pick-me-up (absolutely NO skull, nothing scary or toxic)",
    "pickup_data":      "a field-research clipboard with a tiny checklist and a small green sprout sketch, a 'field data' sample",
    "pickup_page":      "a single slightly-curled manuscript page covered in tiny handwriting and a little equation, a thesis page",
    "pickup_publi":     "a SHINY GOLDEN published scientific journal/booklet with a small star and a laurel sprig, sparkling, the prized publication",
    "pickup_croquette": "a small bowl of cat kibble with a paw-print on it and a couple of brown croquettes, cat food",
    "pickup_rollers":   "a single fun retro roller-skate (quad wheels), colorful",
    "pickup_velo":      "a cute little bicycle seen from the side",
    "pickup_graine":    "a small pile of plump ROUND garden seeds (pumpkin-seed and round bean shapes, warm brown/tan) with one little green sprout popping up, clearly gardening seeds about to grow (NOT rice, NOT cereal grains)",
    "pickup_plant":     "a small young green seedling growing in a little terracotta pot",
    "pickup_chart":     "a small white research card showing a rising green line-chart with an upward arrow",
    "pickup_barchart":  "a small white research card showing a colorful little bar-chart",
    "pickup_sheet":     "a sheet of paper printed with a tidy grid of cells and tiny numbers, a spreadsheet/data sheet",
    "pickup_pilule":    "a single shiny medicine PILL / capsule, two-tone red-and-white, a little glossy highlight, a friendly harmless vitamin (a PhD-stress pick-me-up; nothing scary, no skull)",
    "pickup_champignon":"a cute little red-capped MUSHROOM with white polka-dots and a pale chunky stem, a cheerful forest mushroom",
}

SHOTS = {
    "shot_paper":  "a sharp folded WHITE paper dart/airplane, crisp bright paper with a bold dark outline, zipping right",
    "shot_stake":  "a thick sharp WOODEN spike/stake with a bright glinting pointed steel tip leading, warm brown wood",
    "shot_fork":   "a bold metal PITCHFORK head: three thick sharp shiny prongs and a short wooden handle, prongs leading right",
    "shot_chart":  "a rolled paper SCROLL/diploma tied with a bright RED ribbon, hurled like a dart, pointed end right",
    "shot_error":  "a bold glowing bright-RED software ERROR: a red warning hexagon/burst with a big white X, angry and dangerous",
    "shot_form":   "a crisp white official FORM stamped with a big bright-RED 'REFUSE' seal, a sharp folded corner leading right",
    "shot_gavel":  "a judge's GAVEL: a chunky dark-wood mallet with a bright golden band, striking head leading right",
}

AMMO_NOTE = (
    '\nNOTE: these are SPINNING food projectiles thrown by the hero. Draw each as '
    'ONE compact, roundish object that reads well while rotating (no long thin '
    'tail), centered with wide padding (~60%).\n'
)

AMMO = {
    "ammo_graine": "a compact little cluster of three plump ROUND brown garden seeds (pumpkin-seed teardrop shape with a visible seam), clearly SEEDS, definitely NOT a pale elongated rice grain and NOT cereal",
    "ammo_riz":    "a small tidy bundle of green rice stalks tied with twine, a compact rice-plant token",
    "ammo_cookie": "a round golden chocolate-chip cookie with a bite of chunky chips",
    "ammo_gateau": "a small round layered birthday cake with frosting and one cherry on top",
}

FX_HEART = {
    "fx_tear":     "ONE single glossy cartoon TEARDROP, light blue, a sad little tear",
    "fx_grumble":  "a comic ANGER PUFF: a small grumpy grey steam-cloud puff with two tiny red anger-mark veins, the 'grr' bubble",
    "heart_full":  "a plump glossy bright-RED cartoon HEART, cute and healthy, with a small white shine",
    "heart_empty": "the SAME chunky heart silhouette but EMPTY: a hollow dark-grey heart with a thick outline and a greyed/empty interior, no red fill (a lost life)",
}

# Compteur HUD "tete de mort" : a cote des coeurs, compte les passants tues.
#  Charmant facon Monkey Island (le jeu est un cadeau d'anniv) : lisible tout
#  petit, jamais gore. Meme contrat de style/fond que les autres icones.
SKULL = {
    "skull": "a small friendly-but-spooky cartoon human SKULL seen FROM THE FRONT "
             "(a 'tete de mort' tally token), one rounded chunky cranium in warm "
             "off-white bone ivory, two big dark hollow round eye sockets, a tiny "
             "upside-down heart-shaped nose hole, and a simple grin of a few square "
             "teeth, classic LucasArts Monkey Island skull charm, bold dark brown "
             "outline, flat cel shading, one tiny hairline crack on the cranium for "
             "character. CUTE not gory: no blood, no crossbones, no jaw hanging open",
}


def emit(path, mapping, note=""):
    # idempotent : ne (re)genere QUE les icones absentes de raw/
    mapping = {k: v for k, v in mapping.items()
               if not os.path.exists(os.path.join(RAW, k + ".png"))}
    if not mapping:
        if os.path.exists(path):
            os.remove(path)
        print("skip", os.path.basename(path), "(tout existe deja)")
        return
    n = len(mapping)
    lines = [PREAMBLE.format(n=_word(n)), note]
    for i, (name, subj) in enumerate(mapping.items(), 1):
        lines.append(f"IMAGE {i} -> {subj}. cp the generated PNG to {RAW}/{name}.png")
    lines.append(
        "\nGenerate the images ONE AT A TIME (one image_gen call, then cp, then "
        "the next). Do NOT run chroma-key removal, do NOT delete any files. When "
        "all are done, print one line per image: '<name>: <path> (<W>x<H>)'.\n")
    with open(path, "w") as f:
        f.write("\n".join(lines))
    print("wrote", path, f"({n} icons)")


def _word(n):
    return {1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six",
            7: "seven", 8: "eight"}.get(n, str(n))


if __name__ == "__main__":
    os.makedirs(RAW, exist_ok=True)
    d = os.path.dirname(os.path.abspath(__file__))
    # pickups scindes en 2 sessions (plus fiable que 13 d'un coup)
    items = list(PICKUPS.items())
    emit(os.path.join(d, "prompt_pickups_a.txt"), dict(items[:7]))
    emit(os.path.join(d, "prompt_pickups_b.txt"), dict(items[7:]))
    emit(os.path.join(d, "prompt_shots.txt"), SHOTS, SHOT_NOTE)
    emit(os.path.join(d, "prompt_fxheart.txt"), FX_HEART)
    emit(os.path.join(d, "prompt_ammo.txt"), AMMO, AMMO_NOTE)
    emit(os.path.join(d, "prompt_skull.txt"), SKULL)
