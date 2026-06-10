#!/usr/bin/env python3
"""raw magenta -> sprites finales pour les SOLS PIEGES ('%').

Detoure le fond magenta (chroma-key Codex), recadre sur la fosse, et normalise
chaque planche au CANEVAS DU JEU : 144x128 @CONFIG.art.scale (=72x64 affiches),
GUEULE ALIGNEE EN HAUT (l'objet est ancre 'top' au ras du sol, cf. spawnHazard).

Idempotent : ne traite que les raw/<nom>.png presents.

  python3 _hazardgen/build.py
  python3 gen_assets_data.py
"""
import os
import subprocess
import sys

from PIL import Image

ROOT = "/home/delete/laura_quest"
HERE = os.path.join(ROOT, "_hazardgen")
RAW = os.path.join(HERE, "raw")
CUT = os.path.join(HERE, "cut")
OUT = os.path.join(ROOT, "assets/sprites")
RCK = "/home/delete/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py"

NAMES = ["hazard_paddy", "hazard_acid", "hazard"]
CW = 144                   # largeur du canevas final (@CONFIG.art.scale=2 -> 72 affiches)
MAXH = 112                 # hauteur max (anti fosse trop haute -> billboard)
TOP_PAD = 2                # marge transparente au-dessus de la levre lointaine
FILL_W = 0.98              # largeur visee (fraction de CW)


def have(name):
    return os.path.exists(os.path.join(RAW, name + ".png"))


def key(name):
    """raw/name.png -> cut/name.png (fond magenta -> alpha)."""
    os.makedirs(CUT, exist_ok=True)
    src, dst = os.path.join(RAW, name + ".png"), os.path.join(CUT, name + ".png")
    # Cle EXPLICITE #ff00ff (PAS --auto-key : Codex recadre serre la marge magenta,
    #  donc l'echantillon de bord est pollue par les parois sombres -> mauvaise
    #  couleur cle, magenta residuel). tolerance pour les bords anti-alias.
    subprocess.run([sys.executable, RCK, "--input", src, "--out", dst,
                    "--key-color", "#ff00ff", "--tolerance", "60", "--soft-matte",
                    "--transparent-threshold", "18", "--opaque-threshold", "200",
                    "--despill", "--force"], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return dst


def normalize(name):
    im = Image.open(key(name)).convert("RGBA")
    b = im.getbbox()
    if b:
        im = im.crop(b)                       # serre sur la fosse
    s = (FILL_W * CW) / im.width              # cale la LARGEUR (la fosse remplit le cadre)
    if im.height * s > MAXH:
        s = MAXH / im.height                  # bride la hauteur (fosse basse, pas un billboard)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.NEAREST)
    # canevas SERRE en hauteur -> la levre PROCHE (bas du sujet) = bas du canevas,
    #  donc l'objet ancre 'bot' (cf. spawnHazard) pose la levre au ras du sol.
    ch = im.height + TOP_PAD
    cv = Image.new("RGBA", (CW, ch), (0, 0, 0, 0))
    cv.alpha_composite(im, ((CW - im.width) // 2, TOP_PAD))
    out = os.path.join(OUT, name + ".png")
    cv.save(out)
    print("  %-16s %dx%d" % (name + ".png", CW, ch))


def main():
    todo = [n for n in NAMES if have(n)]
    if not todo:
        print("Aucun raw/ a traiter. Genere d'abord l'art :")
        print("  python3 _hazardgen/make_prompts.py  (puis image_gen par prompt)")
        return
    print("Fosses-pieges (Codex) -> %s" % OUT)
    for n in todo:
        normalize(n)
    print("OK -> relance : python3 gen_assets_data.py")


if __name__ == "__main__":
    main()
