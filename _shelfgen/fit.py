#!/usr/bin/env python3
"""Brut AI (etagere sur magenta) -> tuiles aux dimensions du panneau solaire.

caps  (tile_shelf_books / tile_shelf_biblo) -> 144x88, contenu detoure, mis a
l'echelle pour tenir dans la cellule, BAS-ALIGNE + centre (le bord avant de
l'etagere = bas de l'image = ligne ou Laura se tient, comme tile_panel).
leg   (shelf_leg)                           -> 96x48, poste centre.

Sort dans _shelfgen/out/ (PAS dans assets/sprites/) : on valide AVANT de copier.
Usage : python3 _shelfgen/fit.py
"""
import os
from PIL import Image
import numpy as np

ROOT = '/home/delete/laura_quest'
RAW = ROOT + '/_shelfgen/raw'
OUT = ROOT + '/_shelfgen/out'
os.makedirs(OUT, exist_ok=True)


def key_magenta(im, tol=72):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (np.abs(r - 255) + np.abs(g - 0) + np.abs(b - 255) < tol) | ((r > 150) & (b > 150) & (g < 110))
    a[..., 3] = np.where(bg, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def fit(name, W, H, valign, fillw=False):
    src = os.path.join(RAW, name + '.png')
    if not os.path.exists(src):
        print('manque', src); return
    im = key_magenta(Image.open(src))
    bb = im.getbbox()
    if bb:
        im = im.crop(bb)
    if fillw:                              # remplit la largeur (cap plus gros) ; borne la hauteur
        s = W / im.width
        if im.height * s > H:
            s = H / im.height
    else:
        s = min(W / im.width, H / im.height)
    nw, nh = max(1, round(im.width * s)), max(1, round(im.height * s))
    im = im.resize((nw, nh), Image.LANCZOS)
    cv = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    x = (W - nw) // 2
    y = (H - nh) if valign == 'bot' else (H - nh) // 2
    cv.alpha_composite(im, (x, y))
    cv.save(os.path.join(OUT, name + '.png'))
    # apercu sur gris
    prev = Image.new('RGBA', (W, H), (90, 96, 104, 255)); prev.alpha_composite(cv)
    prev.convert('RGB').save(os.path.join(OUT, name + '_preview.png'))
    print('fit', name, (W, H))


if __name__ == '__main__':
    fit('tile_shelf_books', 144, 88, 'bot', fillw=True)
    fit('tile_shelf_biblo', 144, 88, 'bot', fillw=True)
    fit('shelf_leg', 96, 48, 'mid')
    print('-> candidats dans _shelfgen/out/ (a copier dans assets/sprites/ si OK)')
