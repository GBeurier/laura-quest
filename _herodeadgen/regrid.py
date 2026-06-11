#!/usr/bin/env python3
"""Brut AI (1 frame Laura AFFALEE / K.O. sur magenta) -> sprite hero_dead.

Chroma-key magenta + detourage SERRE (la derniere ligne opaque = contact sol,
PAS de padding sous le corps -> l'ancre 'bot' du jeu pose le cadavre pile sur la
surface, cf. memoire FEET_PAD), mise a l'echelle pour tenir dans le gabarit
display d'une Laura allongee (~ MAXW x MAXH px @ART), corps centre horizontalement.

Sortie : assets/sprites/hero_dead.png (1 frame) + apercu QA dans final/.
Usage : python3 _herodeadgen/regrid.py [in.png]   (defaut = raw/hero_dead_sheet.png)
"""
import sys, os
from PIL import Image, ImageDraw
import numpy as np

ART = 2                                  # = CONFIG.art.scale (hero a ART=2)
MAXW, MAXH = 188, 104                    # gabarit px @ART : Laura couchee (~94x52 ecran)
ROOT = '/home/delete/laura_quest'
SPR = ROOT + '/assets/sprites'
RAW = ROOT + '/_herodeadgen/raw/hero_dead_sheet.png'
FINAL = ROOT + '/_herodeadgen/final'


def key_magenta(im, tol=72):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (np.abs(r - 255) + np.abs(g - 0) + np.abs(b - 255) < tol) | ((r > 150) & (b > 150) & (g < 110))
    a[..., 3] = np.where(bg, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def run(inp):
    img = key_magenta(Image.open(inp))
    bb = img.getbbox()
    c = img.crop(bb) if bb else img            # detourage SERRE (bas = contact sol)
    s = min(MAXW / c.width, MAXH / c.height, 1.0)
    nw, nh = max(1, round(c.width * s)), max(1, round(c.height * s))
    c = c.resize((nw, nh), Image.LANCZOS)
    out = '%s/hero_dead.png' % SPR
    c.save(out)

    os.makedirs(FINAL, exist_ok=True)
    prev = Image.new('RGBA', (nw, nh + 8), (88, 94, 102, 255))
    prev.alpha_composite(c, (0, 0))
    d = ImageDraw.Draw(prev)
    d.line([(0, nh), (nw, nh)], fill=(255, 60, 60), width=1)   # sol (bas du sprite)
    prev.convert('RGB').save('%s/hero_dead_preview.png' % FINAL)
    print('wrote %s %s  (display ~%dx%d)' % (out, c.size, nw // ART, nh // ART))


if __name__ == '__main__':
    run(sys.argv[1] if len(sys.argv) > 1 else RAW)
