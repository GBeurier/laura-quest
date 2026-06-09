#!/usr/bin/env python3
"""Brut AI (1 frame CORPS AFFALE sans tete, de face, sur magenta) -> sprite cadavre.

Chroma-key magenta + detourage, mise a l'echelle pour TENIR dans la cellule
112x150 (meme gabarit que body_<biome>_<sex>), corps centre, BAS du corps pose
sur la baseline commune (BASE=146, = pieds des passants debout) -> le cadavre
s'ancre au sol au meme endroit que le corps vivant (anchor bot, en jeu).

Affiche aussi le Y du COU (haut du corps) en repere ART -> sert a regler
l'offset de la tete zombie pour la pose affalee (cf. corpsify / theme.passant).

Sortie : assets/sprites/body_<biome>_<sex>_dead.png (112x150, 1 frame) + apercu QA.
Usage : python3 _bodygen/regrid_dead.py <in.png> <biome> <sex>
"""
import sys, os
from PIL import Image, ImageDraw
import numpy as np

CW, CH, BASE = 112, 150, 146          # meme cellule/baseline que regrid.py
MAXW, MAXH = 108, 146                 # tient dans la cellule
ART = 4                               # = CONFIG.art.scale (px ecran -> px @ART)
ROOT = '/home/delete/laura_quest'
SPR = ROOT + '/assets/sprites'
FINAL = ROOT + '/_bodygen/final'


def key_magenta(im, tol=72):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (np.abs(r - 255) + np.abs(g - 0) + np.abs(b - 255) < tol) | ((r > 150) & (b > 150) & (g < 110))
    a[..., 3] = np.where(bg, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def run(inp, biome, sex):
    img = key_magenta(Image.open(inp))
    bb = img.getbbox()
    c = img.crop(bb) if bb else img
    s = min(MAXW / c.width, MAXH / c.height)
    nw, nh = max(1, round(c.width * s)), max(1, round(c.height * s))
    c = c.resize((nw, nh), Image.LANCZOS)
    sheet = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    topY = BASE - nh                                  # haut du corps (~ cou) dans la cellule
    sheet.alpha_composite(c, ((CW - nw) // 2, topY))
    out = '%s/body_%s_%s_dead.png' % (SPR, biome, sex)
    sheet.save(out)

    os.makedirs(FINAL, exist_ok=True)
    prev = Image.new('RGBA', sheet.size, (88, 94, 102, 255))
    prev.alpha_composite(sheet)
    d = ImageDraw.Draw(prev)
    d.line([(0, BASE), (CW, BASE)], fill=(255, 60, 60), width=1)          # sol
    d.line([(CW // 2 - 10, topY), (CW // 2 + 10, topY)], fill=(80, 200, 255), width=1)  # cou
    prev.convert('RGB').save('%s/body_%s_%s_dead_preview.png' % (FINAL, biome, sex))
    # offset tete = du sol (anchor bot) vers le cou, en px @ART negatifs (y vers le haut)
    neck_local = -(BASE - topY)
    print('wrote %s %s  cou@y=%d -> headLocal y ~= %d (@ART)' % (out, sheet.size, topY, neck_local))


if __name__ == '__main__':
    if len(sys.argv) < 4:
        raise SystemExit('usage: regrid_dead.py <in.png> <biome> <sex>')
    run(sys.argv[1], sys.argv[2], sys.argv[3])
