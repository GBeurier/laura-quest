#!/usr/bin/env python3
"""Placeholders BOUCHE-TROU pour les SOLS PIEGES ('%') : des FOSSES en
TROMPE-L'OEIL vues de DESSUS (larges et basses), posees a plat sur le sol.
Trois skins :

  - hazard_paddy : EXTERIEUR (riziere)  -> piques de bambou dans l'eau boueuse.
  - hazard_acid  : INTERIEUR (labo/...) -> bassin d'acide vert qui bouillonne.
  - hazard       : generique (fallback) -> piques d'acier dans un trou de pierre.

Ce sont des stop-gap PROCEDURAUX. L'art DEFINITIF vient de l'image_gen Codex
(cf. _hazardgen/) -- des fosses bien plus belles. Ce script NE REMPLACE PAS un
PNG deja present (securite anti-clobber) : passe --force pour ecraser.

Format = celui de _hazardgen/build.py : LARGE et BAS (~2:1), ancre 'bot' en jeu
(la levre proche au ras du sol, cf. spawnHazard dans js/game.js). Genere
@CONFIG.art.scale (x2).

Apres run :  python3 gen_assets_data.py
"""
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter

OUT = "/home/delete/laura_quest/assets/sprites"
S = 2                      # CONFIG.art.scale
BW, BH = 72, 34            # resolution d'AFFICHAGE (final = x S) : LARGE et BAS
random.seed(7)
FORCE = "--force" in sys.argv

# Ouverture (ellipse vue de dessus) : remplit le cadre, levre proche en bas.
OX0, OY0, OX1, OY1 = 2, 1, BW - 2, BH - 1
CX = BW // 2


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def shade(c, f):
    return tuple(max(0, min(255, round(v * f))) for v in c)


def opening_mask():
    m = Image.new("L", (BW, BH), 0)
    ImageDraw.Draw(m).ellipse((OX0, OY0, OX1, OY1), fill=255)
    return m


def base_pit(rim, rim_hi):
    """Trou vu de dessus : anneau de rebord + interieur sombre creuse."""
    img = Image.new("RGBA", (BW, BH), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((OX0, OY0, OX1, OY1), fill=shade(rim, 0.8))            # rebord
    d.ellipse((OX0 + 1, OY0, OX1 - 1, OY1 - 1), outline=rim_hi, width=1)
    d.ellipse((OX0 + 3, OY0 + 3, OX1 - 3, OY1 - 2), fill=(14, 12, 12, 255))  # interieur
    return img


def inner_mask():
    m = Image.new("L", (BW, BH), 0)
    ImageDraw.Draw(m).ellipse((OX0 + 3, OY0 + 3, OX1 - 3, OY1 - 2), fill=255)
    return m


def stake(d, x, ybase, h, half, body, dark, outline):
    d.polygon([(x, ybase - h - 1), (x - half - 1, ybase + 1), (x + half + 1, ybase + 1)], fill=outline)
    d.polygon([(x, ybase - h), (x - half, ybase), (x + half, ybase)], fill=body)
    d.polygon([(x, ybase - h), (x + half, ybase), (x, ybase)], fill=dark)


def fill_paddy(img):
    d = ImageDraw.Draw(img)
    inner = inner_mask()
    mud = Image.new("RGBA", (BW, BH), (0, 0, 0, 0))
    md = ImageDraw.Draw(mud)
    for y in range(BH):
        md.line([(0, y), (BW, y)], fill=lerp((58, 70, 44), (30, 40, 26), y / BH))
    img.paste(mud, (0, 0), inner)
    bamboo, bdark, bout = (200, 176, 96), (150, 126, 58), (40, 30, 14)
    for (gx, gy) in [(16, 12), (26, 16), (36, 11), (46, 17), (56, 13),
                     (21, 24), (31, 27), (41, 24), (51, 27)]:
        if inner.getpixel((min(BW - 1, gx), min(BH - 1, gy))):
            stake(d, gx + random.randint(-1, 1), gy, 8, 2, bamboo, bdark, bout)


def fill_acid(img):
    inner = inner_mask()
    pool = Image.new("RGBA", (BW, BH), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pool)
    for y in range(BH):
        pd.line([(0, y), (BW, y)], fill=lerp((176, 240, 88), (60, 150, 34), y / BH))
    img.paste(pool, (0, 0), inner)
    d = ImageDraw.Draw(img)
    for (bx, by, r) in [(24, 14, 3), (40, 18, 4), (50, 12, 2), (32, 22, 2), (46, 24, 3)]:
        if inner.getpixel((min(BW - 1, bx), min(BH - 1, by))):
            d.ellipse((bx - r, by - r, bx + r, by + r), fill=(196, 248, 120))
            d.point((bx - 1, by - 1), fill=(240, 255, 200))
    glow = Image.new("RGBA", (BW, BH), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((OX0 + 5, OY0 + 4, OX1 - 5, OY1 - 4), fill=(150, 240, 90, 70))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(2)))


def fill_spikes(img):
    d = ImageDraw.Draw(img)
    inner = inner_mask()
    steel, sdark, sout = (172, 178, 190), (96, 100, 112), (22, 22, 28)
    for (gx, gy) in [(15, 12), (25, 15), (35, 11), (45, 15), (55, 12),
                     (20, 23), (30, 26), (40, 23), (50, 26)]:
        if inner.getpixel((min(BW - 1, gx), min(BH - 1, gy))):
            stake(d, gx, gy, 8, 2, steel, sdark, sout)


def make(name, rim, rim_hi, fill_fn):
    out = os.path.join(OUT, name + ".png")
    if os.path.exists(out) and not FORCE:
        print("  %-16s existe -> SKIP (placeholder ; --force pour ecraser)" % (name + ".png"))
        return
    img = base_pit(rim, rim_hi)
    fill_fn(img)
    img = Image.composite(img, Image.new("RGBA", (BW, BH), (0, 0, 0, 0)), opening_mask())
    big = img.resize((BW * S, BH * S), Image.NEAREST)
    big.save(out)
    print("  %-16s %dx%d (placeholder)" % (name + ".png", big.width, big.height))


def main():
    os.makedirs(OUT, exist_ok=True)
    print("Fosses-pieges (placeholders, vue de dessus) -> %s" % OUT)
    make("hazard_paddy", (96, 72, 40), (176, 150, 96), fill_paddy)
    make("hazard_acid",  (158, 150, 138), (220, 224, 206), fill_acid)
    make("hazard",       (120, 124, 134), (188, 194, 206), fill_spikes)
    print("OK -> si genere, relance : python3 gen_assets_data.py")


if __name__ == "__main__":
    main()
