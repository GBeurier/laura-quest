#!/usr/bin/env python3
"""Brut AI (1 tete ZOMBIE de face sur magenta) -> tete-cadavre detouree.

Pendant 1-tete de extract_zombies.py (qui, lui, decoupe une GRILLE de zombies).
Ici une seule tete par planche : chroma-key magenta, on garde le plus gros bloc
opaque, puis MEME normalisation que extract_zombies/regrid (112x112, menton sur
baseline 108) -> head_npc_<sexe>_<n>_dead.png est un DROP-IN exact de la tete
vivante head_npc_<sexe>_<n>.png (meme geometrie -> swap propre dans le jeu).

Sortie : assets/sprites/<name>_dead.png (1 frame statique)
       + apercu QA _headgen/final/<name>_dead_preview.png (vivant | zombie).
Usage : python3 _headgen/regrid_dead.py <in_zombie.png> <name>
"""
import sys, os
from PIL import Image, ImageDraw
import numpy as np

CW, CH, BASE = 112, 112, 108
TARGETH, MAXW = 100, 104
ROOT = '/home/delete/laura_quest'
SPR = ROOT + '/assets/sprites'
FINAL = ROOT + '/_headgen/final'


def key_magenta(im, tol=72):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (np.abs(r - 255) + np.abs(g - 0) + np.abs(b - 255) < tol) | ((r > 150) & (b > 150) & (g < 110))
    a[..., 3] = np.where(bg, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def find_blocks(im, min_frac=0.04):
    """Blocs horizontaux par colonnes pleines (alpha) -> on prendra le plus large."""
    a = np.array(im)[..., 3]
    nonempty = a.sum(axis=0) > (a.shape[0] * 6)
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


def live_face(name):
    p = '%s/%s.png' % (SPR, name)
    if not os.path.exists(p):
        return Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    return Image.open(p).convert('RGBA').crop((0, 0, CW, CH))


def run(inp, name):
    img = key_magenta(Image.open(inp))
    H = img.size[1]
    blocks = find_blocks(img)
    if not blocks:
        raise SystemExit('FAIL %s: aucun bloc (chroma-key ?)' % name)
    a, b = max(blocks, key=lambda ab: ab[1] - ab[0])   # plus gros bloc = la tete
    head = norm_cell(img.crop((a, 0, b, H)))
    out = '%s/%s_dead.png' % (SPR, name)
    head.save(out)

    os.makedirs(FINAL, exist_ok=True)
    prev = Image.new('RGBA', (CW * 2, CH), (88, 94, 102, 255))
    prev.alpha_composite(live_face(name), (0, 0))      # vivant a gauche
    prev.alpha_composite(head, (CW, 0))                # zombie a droite
    d = ImageDraw.Draw(prev)
    d.line([(CW, 0), (CW, CH)], fill=(255, 90, 90), width=1)
    prev.convert('RGB').save('%s/%s_dead_preview.png' % (FINAL, name))
    print('wrote %s %s blocks=%d' % (out, head.size, len(blocks)))


if __name__ == '__main__':
    run(sys.argv[1], sys.argv[2])
