#!/usr/bin/env python3
"""Grille de toutes les tetes 'yeux ouverts' (1er bloc = celui que regrid copie)
des planches brutes _headgen/raw, fond transparent.

Reprend le 1er bout du pipeline (key_magenta + find_blocks + norm_cell de
regrid.py) mais ne garde QUE la premiere sprite de chaque planche, puis les
range en grille. Sortie : _headgen/heads_open_grid.png (RGBA transparent).
"""
import os, re, glob
from PIL import Image
import numpy as np

ROOT = '/home/delete/laura_quest'
RAW = ROOT + '/_headgen/raw'
OUT = ROOT + '/_headgen/heads_open_grid.png'

CW, CH, BASE = 112, 112, 108
TARGETH, MAXW = 100, 104
COLS = 8                      # 38 tetes -> 8 x 5


def key_magenta(im, tol=72):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (np.abs(r - 255) + np.abs(g - 0) + np.abs(b - 255) < tol) | ((r > 150) & (b > 150) & (g < 110))
    a[..., 3] = np.where(bg, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def find_blocks(im, min_frac=0.04):
    a = np.array(im)[..., 3]
    colsum = a.sum(axis=0)
    nonempty = colsum > (a.shape[0] * 6)
    blocks, i, W = [], 0, im.size[0]
    while i < W:
        if nonempty[i]:
            j = i
            while j < W and nonempty[j]:
                j += 1
            if (j - i) > W * min_frac:
                blocks.append((i, j))
            i = j
        else:
            i += 1
    return blocks


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


def sort_key(path):
    m = re.search(r'head_npc_([hf])_(\d+)_sheet', os.path.basename(path))
    return (0 if m.group(1) == 'h' else 1, int(m.group(2)))


def open_head(path):
    img = key_magenta(Image.open(path))
    blocks = find_blocks(img)
    H = img.size[1]
    a, b = blocks[0]                       # 1er bloc = yeux ouverts (gauche)
    return norm_cell(img.crop((a, 0, b, H)))


def main():
    sheets = sorted(glob.glob(RAW + '/head_npc_*_sheet.png'), key=sort_key)
    n = len(sheets)
    rows = (n + COLS - 1) // COLS
    grid = Image.new('RGBA', (CW * COLS, CH * rows), (0, 0, 0, 0))
    for k, p in enumerate(sheets):
        cell = open_head(p)
        x, y = (k % COLS) * CW, (k // COLS) * CH
        grid.alpha_composite(cell, (x, y))
    grid.save(OUT)
    print('wrote %s %s (%d tetes, %d x %d)' % (OUT, grid.size, n, COLS, rows))


if __name__ == '__main__':
    main()
