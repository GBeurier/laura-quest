#!/usr/bin/env python3
"""Brut image_gen (Laura SANS chat, N frames sur magenta) -> feuille cat-free
aux dimensions EXACTES de l'original, prete pour le jeu.

Etapes :
  1. chroma-key magenta #ff00ff -> alpha (detourage).
  2. detection des N blocs par les colonnes de gap magenta (robuste si l'IA met un
     ecart variable). Repli : decoupe naive en N si la detection echoue.
  3. recompose une planche N x (158x177), chaque frame centree en X, PIEDS sur la
     baseline du bas (ancre 'bot' du jeu), en gardant la hauteur relative (le bob).
  4. ecrit final/<name>_nocat.png  (+ rien dans assets/ : copie manuelle apres validation).

Usage : python3 _catfreegen/postprocess.py <raw_sheet.png> <name> <frames>
"""
import sys, os
import numpy as np
from PIL import Image

ROOT = '/home/delete/laura_quest'
FINAL = ROOT + '/_catfreegen/final'
CW, CH = 158, 177                       # cellule cible (= cellule du jeu)
BASE_PAD = 4                            # marge sous les pieds


def key_magenta(im, tol=72):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (np.abs(r - 255) + np.abs(g - 0) + np.abs(b - 255) < tol) | ((r > 150) & (b > 150) & (g < 110))
    a[..., 3] = np.where(bg, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def column_alpha(arr):
    return arr[..., 3].max(axis=0)       # opacite max par colonne


def find_blocks(im, n):
    """Renvoie n (x0,x1) de sujets, par les vides de la colonne alpha."""
    a = np.array(im)
    col = column_alpha(a) > 0
    # runs de colonnes pleines
    runs, s = [], None
    for x, v in enumerate(col):
        if v and s is None:
            s = x
        elif not v and s is not None:
            runs.append((s, x)); s = None
    if s is not None:
        runs.append((s, len(col)))
    runs = [r for r in runs if r[1] - r[0] >= 6]    # ignore les miettes
    if len(runs) == n:
        return runs
    # repli : decoupe naive en n tranches egales
    W = im.width
    return [(int(i * W / n), int((i + 1) * W / n)) for i in range(n)]


def normalize(im, blocks):
    n = len(blocks)
    out = Image.new('RGBA', (CW * n, CH), (0, 0, 0, 0))
    a = np.array(im)
    for i, (x0, x1) in enumerate(blocks):
        sub = im.crop((x0, 0, x1, im.height))
        sa = np.array(sub)
        ys = np.where(sa[..., 3].max(axis=1) > 0)[0]
        xs = np.where(sa[..., 3].max(axis=0) > 0)[0]
        if len(ys) == 0 or len(xs) == 0:
            continue
        sub = sub.crop((xs[0], ys[0], xs[-1] + 1, ys[-1] + 1))
        # echelle pour tenir dans la cellule (garde les proportions)
        sc = min((CW - 8) / sub.width, (CH - BASE_PAD) / sub.height, 1.0)
        if sc < 1.0:
            sub = sub.resize((max(1, int(sub.width * sc)), max(1, int(sub.height * sc))), Image.NEAREST)
        px = i * CW + (CW - sub.width) // 2          # centre X
        py = CH - BASE_PAD - sub.height               # pieds en bas (ancre bot)
        out.alpha_composite(sub, (px, max(0, py)))
    return out


def main():
    raw, name, frames = sys.argv[1], sys.argv[2], int(sys.argv[3])
    os.makedirs(FINAL, exist_ok=True)
    im = key_magenta(Image.open(raw))
    blocks = find_blocks(im, frames)
    sheet = normalize(im, blocks)
    outp = f'{FINAL}/{name}_nocat.png'
    sheet.save(outp)
    print(f"OK {name}: {len(blocks)} frames detectees -> {outp} ({sheet.width}x{sheet.height})")
    if len(blocks) != frames:
        print(f"  /!\\ {len(blocks)} blocs detectes != {frames} attendus (repli naif). Verifie le rendu.")


if __name__ == '__main__':
    main()
