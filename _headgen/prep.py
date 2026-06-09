#!/usr/bin/env python3
"""Photo brute -> crop carre cadre VISAGE (entree pour Codex image_gen).

Applique l'orientation EXIF (photos de tel), recadre en carre avec un leger
biais vers le HAUT (le visage est en general dans le tiers superieur d'un
portrait), upscale a 768x768. Sortie : _headgen/src/<name>.png

Usage : python3 _headgen/prep.py "<src_photo>" <out_name>
"""
import sys, os
from PIL import Image, ImageOps

ROOT = '/home/delete/laura_quest'
SRC = ROOT + '/_headgen/src'


def crop_square(im, top_bias=0.12):
    w, h = im.size
    s = min(w, h)
    if w >= h:                       # paysage -> centre horizontal
        x = (w - s) // 2
        y = 0
    else:                            # portrait -> garde le haut (visage)
        x = 0
        y = int((h - s) * top_bias)
    return im.crop((x, y, x + s, y + s))


def run(src, name):
    im = Image.open(src)
    im = ImageOps.exif_transpose(im).convert('RGB')
    im = crop_square(im)
    im = im.resize((768, 768), Image.LANCZOS)
    os.makedirs(SRC, exist_ok=True)
    out = '%s/%s.png' % (SRC, name)
    im.save(out)
    print('wrote', out, im.size)
    return out


if __name__ == '__main__':
    run(sys.argv[1], sys.argv[2])
