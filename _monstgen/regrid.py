#!/usr/bin/env python3
"""Brut AI (6 frames sur magenta plat) -> feuille de monstre propre 6 colonnes.

EVEN SLICE : on coupe la bande en 6 colonnes egales, on chroma-key le magenta,
on detoure chaque cellule (bbox), on met TOUTES les frames a une echelle commune
(hauteur mediane -> targeth, plafonnee pour que la plus grande ne deborde pas),
puis on repose chaque frame centree, pieds sur une baseline commune, dans une
cellule CW x CH. Sortie = 6*CW x CH RGBA -> assets/sprites/enemy_<name>.png
(+ apercu QA dans _monstgen/final/). game.js slice en 6 (cf. CONFIG.anims).

Usage: python3 _monstgen/regrid.py <in_strip.png> <name> [--frames 6]
"""
import sys, argparse, os
from PIL import Image
import numpy as np

CW, CH, BASE = 176, 192, 182          # cellule + baseline pieds
TARGETH, MAXW = 150, 168              # hauteur cible du perso / largeur max
ROOT = '/home/delete/laura_quest'
SPR = ROOT + '/assets/sprites'
FINAL = ROOT + '/_monstgen/final'


def key_magenta(im, tol=72):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (np.abs(r - 255) + np.abs(g - 0) + np.abs(b - 255) < tol) | ((r > 150) & (b > 150) & (g < 110))
    a[..., 3] = np.where(bg, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def run(inp, name, N):
    img = key_magenta(Image.open(inp))
    W, H = img.size
    cw = W // N
    cells = []
    for i in range(N):
        c = img.crop((i * cw, 0, (i + 1) * cw if i < N - 1 else W, H))
        bb = c.getbbox()
        cells.append(c.crop(bb) if bb else c)
    heights = sorted(c.height for c in cells)
    med = heights[len(heights) // 2] or 1
    maxh = max(c.height for c in cells) or 1
    s = min(TARGETH / med, (CH - 6) / maxh)
    sheet = Image.new('RGBA', (CW * N, CH), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        nw, nh = max(1, round(c.width * s)), max(1, round(c.height * s))
        if nw > MAXW:
            s2 = MAXW / nw
            nw, nh = MAXW, max(1, round(nh * s2))
        c = c.resize((nw, nh), Image.LANCZOS)
        sheet.alpha_composite(c, (i * CW + (CW - nw) // 2, BASE - nh))
    out = '%s/enemy_%s.png' % (SPR, name)
    sheet.save(out)
    os.makedirs(FINAL, exist_ok=True)
    prev = Image.new('RGBA', sheet.size, (88, 94, 102, 255))
    prev.alpha_composite(sheet)
    prev.convert('RGB').save('%s/%s_preview.png' % (FINAL, name))
    assert sheet.size == (CW * N, CH) and sheet.mode == 'RGBA'
    print('wrote %s %s N=%d scale=%.3f' % (out, sheet.size, N, s))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('inp')
    ap.add_argument('name')
    ap.add_argument('--frames', type=int, default=6)
    a = ap.parse_args()
    run(a.inp, a.name, a.frames)
