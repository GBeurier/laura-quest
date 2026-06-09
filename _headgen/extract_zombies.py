#!/usr/bin/env python3
"""Decoupe la planche _headgen/raw/zombies.png (grille 8x5, MEME ordre que
export_open_grid : hommes h_1..h_21 puis femmes f_1..f_17) en une tete-cadavre
par case. Fond deja transparent -> pas de chroma. Normalise chaque tete comme
regrid.norm_cell (112x112, menton sur baseline 108) pour rester un DROP-IN du
sprite de tete vivant head_npc_<sexe>_<n> (meme geometrie -> swap propre).

Sortie : assets/sprites/head_npc_<sexe>_<n>_dead.png (1 frame, statique)
       + apercu QA _headgen/zombies_check.png (live | zombie cote a cote).
"""
import os
from PIL import Image, ImageDraw
import numpy as np

ROOT = '/home/delete/laura_quest'
RAW = ROOT + '/_headgen/raw/zombies.png'
SPR = ROOT + '/assets/sprites'
CHECK = ROOT + '/_headgen/zombies_check.png'

COLS, ROWS = 8, 5
CW, CH, BASE = 112, 112, 108
TARGETH, MAXW = 100, 104

# Meme ordre que export_open_grid.sort_key : 21 hommes puis 17 femmes.
NAMES = (['head_npc_h_%d' % i for i in range(1, 22)] +
         ['head_npc_f_%d' % i for i in range(1, 18)])


def norm_cell(im):
    bb = im.getbbox()
    c = im.crop(bb) if bb else im
    s = TARGETH / max(1, c.height)
    nw, nh = max(1, round(c.width * s)), max(1, round(c.height * s))
    if nw > MAXW:
        s2 = MAXW / nw
        nw, nh = MAXW, max(1, round(nh * s2))
    c = c.resize((nw, nh), Image.LANCZOS)
    cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    cell.alpha_composite(c, ((CW - nw) // 2, BASE - nh))
    return cell


def live_face(name):
    """1re frame (112x112) du sprite de tete vivant, pour l'apercu QA."""
    p = '%s/%s.png' % (SPR, name)
    if not os.path.exists(p):
        return Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    return Image.open(p).convert('RGBA').crop((0, 0, CW, CH))


def main():
    sheet = Image.open(RAW).convert('RGBA')
    iw, ih = sheet.size
    cw, ch = iw // COLS, ih // ROWS                 # 160 x 160
    check = Image.new('RGBA', (CW * 2 * COLS, CH * ROWS), (88, 94, 102, 255))
    d = ImageDraw.Draw(check)
    n = 0
    for k in range(COLS * ROWS):
        cx, cy = (k % COLS) * cw, (k // COLS) * ch
        cell = sheet.crop((cx, cy, cx + cw, cy + ch))
        if cell.getbbox() is None:                  # case vide (les 2 derniers slots)
            continue
        if k >= len(NAMES):
            print('WARN case %d non vide mais hors mapping -> ignoree' % k)
            continue
        head = norm_cell(cell)
        out = '%s/%s_dead.png' % (SPR, NAMES[k])
        head.save(out)
        n += 1
        # apercu : live a gauche, zombie a droite, sous la meme case
        gx, gy = (k % COLS) * CW * 2, (k // COLS) * CH
        check.alpha_composite(live_face(NAMES[k]), (gx, gy))
        check.alpha_composite(head, (gx + CW, gy))
        d.line([(gx + CW, gy), (gx + CW, gy + CH)], fill=(255, 90, 90), width=1)
        d.text((gx + 2, gy + 2), NAMES[k].replace('head_npc_', ''), fill=(255, 240, 120))
    check.convert('RGB').save(CHECK)
    print('wrote %d cadavres -> %s/head_npc_*_dead.png' % (n, SPR))
    print('QA: %s' % CHECK)


if __name__ == '__main__':
    main()
