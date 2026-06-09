#!/usr/bin/env python3
"""Brut AI (4 frames CORPS sans tete, de face, sur magenta) -> feuille passant.

EVEN SLICE en 4 colonnes + chroma-key magenta + detourage, echelle commune
(hauteur mediane -> TARGETH), repose chaque frame centree, PIEDS sur la baseline
commune (BASE) dans une cellule 112x150. La TETE (dessinee par l'utilisateur)
s'attache ensuite a theme.passant.headLocal (~[0,-104] @ART) : on garde donc le
meme gabarit que les mockups (pieds y~146, cou/haut du corps y~44).

Sortie : assets/sprites/body_<biome>_<sex>.png (448x150) + apercu QA.
Usage : python3 _bodygen/regrid.py <in_strip.png> <biome> <sex> [--frames 4]
"""
import sys, argparse, os
from PIL import Image
import numpy as np

CW, CH, BASE = 112, 150, 146          # cellule + baseline pieds (= mockups)
TARGETH, MAXW = 102, 96               # hauteur cible du corps / largeur max
ROOT = '/home/delete/laura_quest'
SPR = ROOT + '/assets/sprites'
FINAL = ROOT + '/_bodygen/final'


def key_magenta(im, tol=72):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (np.abs(r - 255) + np.abs(g - 0) + np.abs(b - 255) < tol) | ((r > 150) & (b > 150) & (g < 110))
    a[..., 3] = np.where(bg, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def run(inp, biome, sex, N):
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
    s = min(TARGETH / med, (CH - 4) / maxh)
    sheet = Image.new('RGBA', (CW * N, CH), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        nw, nh = max(1, round(c.width * s)), max(1, round(c.height * s))
        if nw > MAXW:
            s2 = MAXW / nw
            nw, nh = MAXW, max(1, round(nh * s2))
        c = c.resize((nw, nh), Image.LANCZOS)
        sheet.alpha_composite(c, (i * CW + (CW - nw) // 2, BASE - nh))
    out = '%s/body_%s_%s.png' % (SPR, biome, sex)
    sheet.save(out)
    os.makedirs(FINAL, exist_ok=True)
    prev = Image.new('RGBA', sheet.size, (88, 94, 102, 255))
    prev.alpha_composite(sheet)
    # repere du point d'attache de la tete (~ y 44) pour QA
    from PIL import ImageDraw
    d = ImageDraw.Draw(prev)
    for i in range(N):
        d.line([(i * CW + CW // 2 - 8, 44), (i * CW + CW // 2 + 8, 44)], fill=(255, 60, 60), width=1)
    prev.convert('RGB').save('%s/body_%s_%s_preview.png' % (FINAL, biome, sex))
    assert sheet.size == (CW * N, CH) and sheet.mode == 'RGBA'
    print('wrote %s %s N=%d scale=%.3f' % (out, sheet.size, N, s))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('inp'); ap.add_argument('biome'); ap.add_argument('sex')
    ap.add_argument('--frames', type=int, default=4)
    a = ap.parse_args()
    run(a.inp, a.biome, a.sex, a.frames)
