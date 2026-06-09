#!/usr/bin/env python3
"""Bouche-trou procedural pour body_clap_h / body_clap_f (en attendant Codex).

Dessine une silhouette de FACE, sans tete (cou-souche en haut), qui APPLAUDIT sur
4 frames, au gabarit des passants (4x112x150, pieds baseline y146, cou ~y44) pour
que les tetes head_npc_<sex>_<n> s'attachent pile. Habits en GRIS CLAIR (le jeu les
recolore). A ECRASER par les vraies planches Codex (memes noms).

  python3 _clapgen/placeholder.py        # ecrit assets/sprites/body_clap_{h,f}.png
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'assets', 'sprites')
CW, CH, N = 112, 150, 4
CX, BASE = CW // 2, 146

OUT = (44, 34, 32, 255)        # contour
SHIRT, SHIRT_SH = (202, 202, 208, 255), (170, 170, 178, 255)   # gris clair recolorable
SKIN, SKIN_SH = (226, 180, 142, 255), (198, 152, 118, 255)
TROUSER = (126, 126, 138, 255)
SKIRT = (150, 142, 162, 255)
SHOE = (70, 62, 60, 255)

# demi-ecart des mains par frame (applaudissement : ouvert -> ferme -> ouvert)
GAP = [17, 9, 3, 9]
BOB = [0, -1, -2, -1]          # petit rebond de joie


def rrect(d, box, fill, r=4):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=OUT, width=2)


def draw_body(d, sex, frame):
    g = GAP[frame]
    dy = BOB[frame]
    x = CX

    # jambes / pieds
    if sex == 'f':
        # jupe (trapeze) + bas de jambes nus + chaussures
        d.polygon([(x - 11, 100 + dy), (x + 11, 100 + dy), (x + 18, 122 + dy), (x - 18, 122 + dy)],
                  fill=SKIRT, outline=OUT)
        rrect(d, (x - 13, 121 + dy, x - 4, 142 + dy), SKIN, r=3)
        rrect(d, (x + 4, 121 + dy, x + 13, 142 + dy), SKIN, r=3)
        rrect(d, (x - 15, 140 + dy, x - 2, 148 + dy), SHOE, r=3)
        rrect(d, (x + 2, 140 + dy, x + 15, 148 + dy), SHOE, r=3)
    else:
        rrect(d, (x - 14, 102 + dy, x - 3, 142 + dy), TROUSER, r=3)
        rrect(d, (x + 3, 102 + dy, x + 14, 142 + dy), TROUSER, r=3)
        rrect(d, (x - 16, 140 + dy, x - 2, 148 + dy), SHOE, r=3)
        rrect(d, (x + 2, 140 + dy, x + 16, 148 + dy), SHOE, r=3)

    # torse (chemise/pull) + cou-souche
    tw = 18 if sex == 'f' else 20
    rrect(d, (x - tw, 58 + dy, x + tw, 106 + dy), SHIRT, r=7)
    d.line([(x, 64 + dy), (x, 100 + dy)], fill=SHIRT_SH, width=2)   # pli central (ombre)
    rrect(d, (x - 7, 44 + dy, x + 7, 60 + dy), SKIN, r=4)           # cou-souche (point d'attache tete)

    # bras applaudissants : epaules -> mains qui se rejoignent au centre
    hy = 86 + dy
    shoulder = 66 + dy
    hlx, hrx = x - g, x + g
    for (sx, hx) in ((x - tw + 3, hlx), (x + tw - 3, hrx)):
        d.line([(sx, shoulder), (hx, hy)], fill=OUT, width=11)     # contour bras
        d.line([(sx, shoulder), (hx, hy)], fill=SHIRT, width=7)    # manche
    # mains (peau), jointes au clap
    d.ellipse((hlx - 7, hy - 7, hlx + 7, hy + 7), fill=SKIN, outline=OUT, width=2)
    d.ellipse((hrx - 7, hy - 7, hrx + 7, hy + 7), fill=SKIN, outline=OUT, width=2)


def build(sex):
    sheet = Image.new('RGBA', (CW * N, CH), (0, 0, 0, 0))
    for i in range(N):
        cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        draw_body(ImageDraw.Draw(cell), sex, i)
        sheet.alpha_composite(cell, (i * CW, 0))
    out = os.path.join(SPR, 'body_clap_%s.png' % sex)
    sheet.save(out)
    print('wrote', out, sheet.size)


if __name__ == '__main__':
    for s in ('h', 'f'):
        build(s)
