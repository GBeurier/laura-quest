#!/usr/bin/env python3
"""raw -> sprite finale pour la SORTIE de niveau (porte de labo CIRAD, tuile '*').

Detoure le fond magenta (chroma-key Codex), recadre serre sur la porte (trim
alpha), et normalise dans une toile CARREE transparente a la bonne taille
@CONFIG.art.scale (la porte garde son ratio, centree, ancrage 'center' cote jeu).
Ecrit assets/sprites/tile_exit_door.png.

Idempotent : ne traite que raw/door.png s'il est present.

  python3 _doorgen/build.py
  python3 gen_assets_data.py
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = "/home/delete/laura_quest"
HERE = os.path.join(ROOT, "_doorgen")
RAW = os.path.join(HERE, "raw")
CUT = os.path.join(HERE, "cut")
OUT = os.path.join(ROOT, "assets/sprites")
RCK = "/home/delete/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py"

NAME = "door"
OUT_NAME = "tile_exit_door"
# La sortie est affichee ancree 'center' a ~1 tuile (48px). On vise une porte un
# peu plus haute que large -> toile carree 256 @CONFIG.art.scale=2 (128 affiche).
CANVAS = 256


def have():
    return os.path.exists(os.path.join(RAW, NAME + ".png"))


def magenta_frac(im):
    a = np.asarray(im.convert("RGB")).astype(int)
    m = (a[..., 0] > 180) & (a[..., 1] < 90) & (a[..., 2] > 180)
    return float(m.mean())


def key(src, dst):
    """Detoure le fond magenta #ff00ff -> alpha."""
    os.makedirs(CUT, exist_ok=True)
    subprocess.run([sys.executable, RCK, "--input", src, "--out", dst,
                    "--key-color", "#ff00ff", "--tolerance", "55", "--soft-matte",
                    "--transparent-threshold", "18", "--opaque-threshold", "210",
                    "--despill", "--force"], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return dst


def normalize():
    src = os.path.join(RAW, NAME + ".png")
    im = Image.open(src).convert("RGBA")
    if magenta_frac(im) > 0.02:                       # fond magenta -> chroma-key
        im = Image.open(key(src, os.path.join(CUT, NAME + ".png"))).convert("RGBA")
    # recadre serre sur la porte (trim alpha)
    b = im.getbbox()
    if b:
        im = im.crop(b)
    # scale pour tenir dans la toile carree en gardant le ratio (porte tall ok)
    w, h = im.size
    s = (CANVAS - 4) / float(max(w, h))               # 2px de marge de chaque cote
    nw, nh = max(1, int(round(w * s))), max(1, int(round(h * s)))
    im = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((CANVAS - nw) // 2, (CANVAS - nh) // 2))
    out = os.path.join(OUT, OUT_NAME + ".png")
    canvas.save(out)
    print("  %-20s %dx%d  (porte %dx%d centree)" % (OUT_NAME + ".png", CANVAS, CANVAS, nw, nh))


def main():
    if not have():
        print("Aucun raw/door.png a traiter. Genere d'abord l'art :")
        print("  python3 _doorgen/make_prompts.py  (puis codex exec image_gen)")
        return
    print("Porte de sortie CIRAD (Codex) -> %s" % OUT)
    normalize()
    print("OK -> relance : python3 gen_assets_data.py")


if __name__ == "__main__":
    main()
