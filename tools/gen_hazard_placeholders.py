#!/usr/bin/env python3
"""Placeholders BOUCHE-TROU pour les SOLS PIEGES ('%') : des FOSSES CARREES vues
de DESSUS, TILEABLES horizontalement -> des '%' contigus FUSIONNENT en UNE plaque
rectangulaire (cf. spawnHazardSpan dans js/game.js). Trois skins :

  - hazard_paddy : EXTERIEUR (riziere)  -> piques de bambou dans l'eau boueuse.
  - hazard_acid  : INTERIEUR (labo/...) -> bassin d'acide vert qui bouillonne.
  - hazard       : generique (fallback) -> piques d'acier dans un trou de pierre.

Ce sont des stop-gap PROCEDURAUX. L'art DEFINITIF vient de l'image_gen Codex
(cf. _hazardgen/) -- des fosses bien plus belles. Ce script NE REMPLACE PAS un
PNG deja present (securite anti-clobber) : passe --force pour ecraser.

CONTRAT (= _hazardgen/build.py) : CARRE 2*TS px (96x96 = 48x48 affiche @scale 2),
plein cadre (PAS de marge transparente), ancre 'top' au ras du sol. Lisere FAR
(haut, sombre) + lisere NEAR (bas, eclaire) en bandes PLEINE LARGEUR, danger a
positions PERIODIQUES -> les bords gauche/droit se raccordent sans couture quand
on pave plusieurs cellules cote a cote.

Apres run :  python3 gen_assets_data.py
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

OUT = "/home/delete/laura_quest/assets/sprites"
S = 2                      # CONFIG.art.scale
BW = BH = 48               # resolution d'AFFICHAGE (final = x S) : CARRE = 1 tuile
LIP = 5                    # epaisseur des liseres far (haut) / near (bas), pleine largeur
FORCE = "--force" in sys.argv
SPIKE_X = (6, 18, 30, 42)  # colonnes des piques : periode 12, marge 6 -> PAVAGE sans couture


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def shade(c, f):
    return tuple(max(0, min(255, round(v * f))) for v in c)


def vgrad(d, ctop, cbot, y0, y1):
    """Degrade VERTICAL plein cadre (varie selon y -> tileable horizontalement)."""
    span = max(1, y1 - y0)
    for y in range(y0, y1):
        d.line([(0, y), (BW, y)], fill=lerp(ctop, cbot, (y - y0) / span))


def stake(d, x, ybase, h, hw, body, dark, outline):
    """Pique vue de dessus, pointe vers le HAUT (vers le joueur)."""
    d.polygon([(x, ybase - h - 1), (x - hw - 1, ybase + 1), (x + hw + 1, ybase + 1)], fill=outline)
    d.polygon([(x, ybase - h), (x - hw, ybase), (x + hw, ybase)], fill=body)
    d.polygon([(x, ybase - h), (x + hw, ybase), (x, ybase)], fill=dark)   # moitie droite a l'ombre


def fill_spikes(img):
    d = ImageDraw.Draw(img)
    vgrad(d, (16, 16, 22), (58, 60, 72), LIP, BH - LIP)       # trou de pierre sombre
    steel, sdark, sout = (174, 180, 192), (96, 100, 112), (20, 20, 26)
    for x in (12, 24, 36):                                    # rangee FOND (petites, hautes, sombres)
        stake(d, x, LIP + 12, 8, 2, shade(steel, 0.6), sdark, sout)
    for x in SPIKE_X:                                         # rangee AVANT (grandes, basses, eclairees)
        stake(d, x, BH - LIP - 2, 14, 3, steel, sdark, sout)


def fill_paddy(img):
    d = ImageDraw.Draw(img)
    vgrad(d, (30, 40, 26), (60, 76, 46), LIP, BH - LIP)       # eau boueuse vert-brun
    for (gx, gy) in [(10, 16), (22, 22), (34, 17), (44, 23)]:  # reflets d'eau (interieurs)
        d.ellipse((gx - 2, gy - 1, gx + 2, gy + 1), fill=(96, 116, 78))
    bamboo, bdark, bout = (200, 176, 96), (150, 126, 58), (40, 30, 14)
    for x in (12, 24, 36):
        stake(d, x, LIP + 12, 8, 2, shade(bamboo, 0.7), bdark, bout)
    for x in SPIKE_X:
        stake(d, x, BH - LIP - 2, 14, 3, bamboo, bdark, bout)


def fill_acid(img):
    d = ImageDraw.Draw(img)
    vgrad(d, (44, 120, 32), (158, 224, 84), LIP, BH - LIP)    # bassin d'acide qui s'eclaircit en bas
    for (bx, by, r) in [(8, 16, 2), (18, 22, 3), (28, 15, 2), (38, 21, 3), (44, 17, 2)]:  # bulles (interieures)
        d.ellipse((bx - r, by - r, bx + r, by + r), fill=(196, 248, 120))
        d.point((bx - 1, by - 1), fill=(240, 255, 200))
    glow = Image.new("RGBA", (BW, BH), (0, 0, 0, 0))
    ImageDraw.Draw(glow).rectangle((0, LIP + 2, BW, BH - LIP - 2), fill=(150, 240, 90, 60))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(2)))


def draw_lips(img, rim, rim_hi):
    """Lisere FAR (haut, ombre) + NEAR (bas, eclaire) -- bandes PLEINE LARGEUR."""
    d = ImageDraw.Draw(img)
    for y in range(LIP):                                     # far : sombre, s'eclaircit vers l'interieur
        d.line([(0, y), (BW, y)], fill=lerp(shade(rim, 0.4), shade(rim, 0.72), y / max(1, LIP - 1)))
    d.line([(0, LIP), (BW, LIP)], fill=shade(rim, 0.9))      # arete interieure du fond (legere lumiere)
    for y in range(BH - LIP, BH):                            # near : eclaire en haut de bande
        d.line([(0, y), (BW, y)], fill=lerp(rim, shade(rim, 0.66), (y - (BH - LIP)) / max(1, LIP - 1)))
    d.line([(0, BH - LIP - 1), (BW, BH - LIP - 1)], fill=rim_hi)   # arete near vivement eclairee
    d.line([(0, BH - LIP), (BW, BH - LIP)], fill=shade(rim_hi, 0.85))


def make(name, rim, rim_hi, fill_fn):
    out = os.path.join(OUT, name + ".png")
    if os.path.exists(out) and not FORCE:
        print("  %-16s existe -> SKIP (placeholder ; --force pour ecraser)" % (name + ".png"))
        return
    img = Image.new("RGBA", (BW, BH), (12, 10, 12, 255))     # plein cadre opaque -> pave sans trou
    fill_fn(img)
    draw_lips(img, rim, rim_hi)
    big = img.resize((BW * S, BH * S), Image.NEAREST)
    big.save(out)
    print("  %-16s %dx%d (placeholder carre tileable)" % (name + ".png", big.width, big.height))


def main():
    os.makedirs(OUT, exist_ok=True)
    print("Fosses-pieges (placeholders carres tileables, vue de dessus) -> %s" % OUT)
    make("hazard_paddy", (96, 72, 40), (176, 150, 96), fill_paddy)
    make("hazard_acid",  (158, 150, 138), (220, 224, 206), fill_acid)
    make("hazard",       (120, 124, 134), (188, 194, 206), fill_spikes)
    print("OK -> si genere, relance : python3 gen_assets_data.py")


if __name__ == "__main__":
    main()
