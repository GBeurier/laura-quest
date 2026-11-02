#!/usr/bin/env python3
"""Brut AI (bande 2 frames TETE de face, yeux ouverts/fermes, sur magenta) ->
feuille de clignement.

Chroma-key magenta + detourage, decoupe par DETECTION DES BLOCS (gap magenta,
pas un slice naif -> robuste si l'IA met un ecart variable / 1 seul bloc), puis
normalise les 2 frames a la MEME hauteur de tete, MENTON sur une baseline commune,
centrees -> aucune variation a part les yeux. Sortie 3 cellules [ouvert, ferme,
ouvert] pour un clip 'blink' qui revient a l'etat ouvert.

Sortie : assets/sprites/<name>.png (336x112) + apercu QA dans _headgen/final.
Usage : python3 _headgen/regrid.py <in_strip.png> <name>
"""
import sys, os
from PIL import Image, ImageDraw
import numpy as np

CW, CH, BASE = 112, 112, 108          # cellule + baseline menton
TARGETH, MAXW = 100, 104              # hauteur cible de la tete / largeur max
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
    """Decoupe en blocs horizontaux par colonnes vides (alpha)."""
    a = np.array(im)[..., 3]
    colsum = a.sum(axis=0)
    nonempty = colsum > (a.shape[0] * 6)        # colonne "pleine" (>~6px opaques)
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


def run(inp, name):
    img = key_magenta(Image.open(inp))
    blocks = find_blocks(img)
    H = img.size[1]
    crops = [img.crop((a, 0, b, H)) for a, b in blocks]
    if len(crops) >= 2:
        opn, clo = norm_cell(crops[0]), norm_cell(crops[1])
    elif len(crops) == 1:
        opn = clo = norm_cell(crops[0])          # repli : pas de clignement detecte
        print('WARN %s: 1 seul bloc detecte -> pas de clignement' % name)
    else:
        raise SystemExit('FAIL %s: aucun bloc (chroma-key ?)' % name)

    sheet = Image.new('RGBA', (CW * 3, CH), (0, 0, 0, 0))   # [ouvert, ferme, ouvert]
    sheet.alpha_composite(opn, (0, 0))
    sheet.alpha_composite(clo, (CW, 0))
    sheet.alpha_composite(opn, (CW * 2, 0))
    out = '%s/%s.png' % (SPR, name)
    sheet.save(out)

    os.makedirs(FINAL, exist_ok=True)
    prev = Image.new('RGBA', sheet.size, (88, 94, 102, 255))
    prev.alpha_composite(sheet)
    d = ImageDraw.Draw(prev)
    for i in range(3):
        d.line([(i * CW, BASE), (i * CW + CW, BASE)], fill=(255, 60, 60), width=1)
    prev.convert('RGB').save('%s/%s_preview.png' % (FINAL, name))
    print('wrote %s %s blocks=%d' % (out, sheet.size, len(crops)))


if __name__ == '__main__':
    run(sys.argv[1], sys.argv[2])
