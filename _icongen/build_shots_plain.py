#!/usr/bin/env python3
"""Reconstruit les projectiles de boss shot_* depuis _icongen/cut/ : l'art Codex
d'origine ('les anciens', demande user) MAIS avec un fin CONTOUR SOMBRE ajoute
(1-2 px display) pour qu'ils ressortent un peu plus -- SANS le halo clair de
build.py:embellish() (que le user n'aimait pas).

  crop au contenu -> resize (cote long = CORE) -> contour sombre (dilate alpha)
  -> centre dans CELL x CELL. shot_bomb n'a pas de cut -> non touche.
Ensuite : python3 gen_assets_data.py
"""
import os
from PIL import Image, ImageFilter

ROOT = "/home/delete/laura_quest"
CUT = os.path.join(ROOT, "_icongen/cut")
OUT = os.path.join(ROOT, "assets/sprites")
SHOTS = ["shot_chart", "shot_error", "shot_fork", "shot_form",
         "shot_gavel", "shot_paper", "shot_stake"]
CELL, CORE = 64, 56
OW, OCOL = 3, (18, 14, 12)          # epaisseur (px finaux) + couleur du contour sombre


def add_outline(icon, ow=OW, col=OCOL):
    """Contour sombre net (dilatation de l'alpha), pas de halo/flou."""
    pad = ow + 1
    base = Image.new("RGBA", (icon.width + 2 * pad, icon.height + 2 * pad), (0, 0, 0, 0))
    base.alpha_composite(icon, (pad, pad))
    oa = base.getchannel("A").filter(ImageFilter.MaxFilter(2 * ow + 1))
    ring = Image.new("RGBA", base.size, col + (0,))
    ring.putalpha(oa)
    out = Image.new("RGBA", base.size, (0, 0, 0, 0))
    out.alpha_composite(ring)       # contour derriere
    out.alpha_composite(base)       # icone par-dessus
    return out


def main():
    done = []
    for n in SHOTS:
        src = os.path.join(CUT, n + ".png")
        if not os.path.exists(src):
            print("skip (pas de cut)", n)
            continue
        im = Image.open(src).convert("RGBA")
        b = im.getbbox()
        if b:
            im = im.crop(b)
        s = CORE / max(im.size)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        im = add_outline(im)
        cv = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        cv.alpha_composite(im, ((CELL - im.width) // 2, (CELL - im.height) // 2))
        cv.save(os.path.join(OUT, n + ".png"))
        done.append(n)
    print("OK shots (contour sombre, sans halo):", ", ".join(done))


if __name__ == "__main__":
    main()
