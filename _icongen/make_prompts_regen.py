#!/usr/bin/env python3
"""Prompts codex/image_gen pour la PASSE DE REGENERATION (cf. demande user) :
les 5 munitions d'arsenal + 3 pickups d'upgrade + l'ombre de bombe, en vrai
pixel-art Imagen (remplace les versions procedurales tools/gen_projectiles.py
et tools/gen_bomb_shadow.py). Meme contrat que make_prompts.py : 1 icone unique
par asset, fond plein #ff00ff, detourage + mise en feuille faits APRES par
_icongen/build_regen.py.

NON idempotent (on FORCE la regen) : ecrit 3 fichiers de prompt, un par session
codex exec. Lance : python3 _icongen/make_prompts_regen.py
"""
import os
from make_prompts import PREAMBLE, AMMO_NOTE  # reutilise le style maison

RAW = "/home/delete/laura_quest/_icongen/raw"
HERE = os.path.dirname(os.path.abspath(__file__))

# --- 5 munitions (projectiles bouffe qui tournoient) ----------------------
AMMO = {
    "ammo_graine":      "a compact little cluster of three or four plump ROUND brown garden seeds (pumpkin-seed teardrop shapes with a visible seam), warm tan and brown, clearly SEEDS about to sprout, definitely NOT pale elongated rice grains and NOT cereal",
    "ammo_graine_fire": "the SAME compact cluster of plump round brown garden seeds but now ABLAZE, wreathed in chunky orange-and-yellow FLAMES with a hot glowing core, a fierce flaming fire-seed projectile; the seeds still clearly visible inside the fire, compact and round (no smoke)",
    "ammo_cookie":      "a round golden-brown chocolate-chip COOKIE with a few chunky dark chocolate chips, warm and appetizing",
    "ammo_gateau":      "a small round single-serving layered birthday CAKE with creamy frosting, a couple of cute drips and one bright red cherry on top, appetizing",
    "ammo_gateau_enfer":"the SAME small round layered CAKE but turned INFERNAL: dark devil's-chocolate layers, glowing molten-lava drips and small orange flames licking up, a menacing 'cake from hell', still clearly a round cake, fierce but cute (absolutely NO skull)",
}

# --- 3 pickups d'upgrade d'arsenal (medaillons power-up lisibles) ----------
#  Set coherent : meme medaillon rond, couleur+symbole distincts.
PICKUP = {
    "pickup_puissance": "a round chunky POWER-UP medallion badge in bright RED and gold, stamped with a bold muscular UPWARD arrow / strength symbol and a tiny spark, the firepower 'puissance' boost, punchy and heroic",
    "pickup_cadence":   "a round chunky POWER-UP medallion badge in bright BLUE and white, stamped with a vivid yellow LIGHTNING BOLT and two little speed streaks, the rapid-fire 'cadence' (fire-rate) boost",
    "pickup_pierce":    "a round chunky POWER-UP medallion badge in bright GREEN and steel, stamped with a sharp glinting ARROWHEAD spike punching through a small cracked ring, the armor-'pierce' (transpercant) boost",
}

# --- 1 ombre de bombe (marqueur telegraphe vu de dessus) ------------------
#  Style different (PAS un objet Monkey Island) -> preambule dedie.
SHADOW_PROMPT = (
    'Use your built-in image_gen tool (the "imagegen" skill) to GENERATE raster '
    'pixel art. Do NOT use the CLI fallback. Do NOT draw procedurally (no '
    'PIL/SVG/canvas). Generate ONE single image.\n\n'
    'SUBJECT: a top-down DANGER-ZONE shadow marker for a platformer, the warning '
    'shadow that appears on the ground where a bomb is about to drop. Draw a wide, '
    'FLATTENED dark oval shadow (seen from straight above, lying on the floor) with '
    'a BOLD bright red-orange WARNING RING around its rim and a slightly darker '
    'center, a little ominous. retro 16-bit pixel-art, crisp visible square pixels, '
    'thick dark outline, flat cel shading, NO smooth gradients, NO 3D, NO '
    'anti-aliasing.\n\n'
    'COMPOSITION: the flattened oval is centered and fills about 85% of the width '
    'and about 55% of the height (wide and short, like a shadow on the ground). NO '
    'bomb, NO object, NO crosshair text.\n\n'
    'BACKGROUND: fill the ENTIRE image with ONE perfectly FLAT solid #ff00ff '
    'magenta (chroma key). NO real shadow, NO gradient, NO text, NO frame. NEVER '
    'use magenta or pink anywhere on the oval itself.\n\n'
    f'cp the generated PNG to {RAW}/fx_bomb_shadow.png\n'
    "When done, print: 'fx_bomb_shadow: <path> (<W>x<H>)'.\n"
)

GUARD = (
    "\nIMPORTANT: ONLY generate the image(s) above with image_gen and cp them to "
    "the given path(s). Do NOT edit any source code, do NOT run chroma-key removal, "
    "do NOT modify or delete any other file, do NOT run git.\n"
)


def emit(path, mapping, note=""):
    n = len(mapping)
    word = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five"}.get(n, str(n))
    lines = [PREAMBLE.format(n=word), note]
    for i, (name, subj) in enumerate(mapping.items(), 1):
        lines.append(f"IMAGE {i} -> {subj}. cp the generated PNG to {RAW}/{name}.png")
    lines.append(
        "\nGenerate the images ONE AT A TIME (one image_gen call, then cp, then the "
        "next). Do NOT run chroma-key removal, do NOT delete any files. When all are "
        "done, print one line per image: '<name>: <path> (<W>x<H>)'." + GUARD)
    open(path, "w").write("\n".join(lines))
    print("wrote", path, f"({n} icons)")


if __name__ == "__main__":
    os.makedirs(RAW, exist_ok=True)
    emit(os.path.join(HERE, "prompt_regen_ammo.txt"), AMMO, AMMO_NOTE)
    emit(os.path.join(HERE, "prompt_regen_pickups.txt"), PICKUP)
    open(os.path.join(HERE, "prompt_regen_shadow.txt"), "w").write(SHADOW_PROMPT + GUARD)
    print("wrote", os.path.join(HERE, "prompt_regen_shadow.txt"), "(1 icon)")
