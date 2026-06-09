#!/usr/bin/env python3
"""Detecte les raws contamines par une COLLISION image_gen :
  - une TETE/sprite arrive sur fond MAGENTA (#ff00ff) -> mes fonds n'ont PAS de magenta.
  - une tete est ~CARREE -> mes PANNEAUX sont paysage ~3:2 (les sols sont carres, tolere).
Sortie : 'OK' ou 'SUSPECT' par fichier. Code retour != 0 si au moins un suspect."""
import sys, glob
from PIL import Image

def magenta_frac(im):
    im = im.convert("RGB"); w, h = im.size
    n = bad = 0
    for y in range(0, h, 6):
        for x in range(0, w, 6):
            r, g, b = im.getpixel((x, y))
            n += 1
            if r > 200 and b > 200 and g < 90:   # ~ #ff00ff
                bad += 1
    return bad / max(1, n)

bad_any = False
for p in sorted(glob.glob("_levelgen/raw/*_p*.png") + glob.glob("_levelgen/raw/tile_sol_*.png")):
    im = Image.open(p); w, h = im.size
    ar = w / h
    mag = magenta_frac(im)
    is_panel = "_p" in p.rsplit("/", 1)[1] and "tile_sol" not in p
    suspect = mag > 0.02 or (is_panel and ar < 1.30)
    bad_any = bad_any or suspect
    print("%-8s %s  %dx%d ar=%.2f magenta=%.1f%%" %
          ("SUSPECT" if suspect else "OK", p.split("/")[-1], w, h, ar, mag * 100))
sys.exit(1 if bad_any else 0)
