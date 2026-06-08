#!/usr/bin/env python3
"""Une image en grille -> une spritesheet horizontale detouree (tout en un).

Decoupe une planche en grille (ordre de lecture), detoure chaque frame, rogne
au rectangle commun (frames alignees) et assemble une bande horizontale prete
pour CONFIG.anims -> assets/sprites_sheets/<nom>.png

Detourage : --nn (BiRefNet, recommande si fond non uni / sujet clair, ex. chat
blanc sur damier), --white (fond clair), ou auto (couleur de fond detectee).

Exemples
--------
  /home/delete/venv_311/bin/python tools/sheet_from_grid.py \
      assets/sprites_bench/Cat_run.png --grid 4x2 --nn
  python3 tools/sheet_from_grid.py planche.png --grid 4x3 --white --name walk
"""
import argparse
import os

import numpy as np
from PIL import Image

import _spritelib as sl


def split_grid(arr, cols, rows):
    H, W = arr.shape[:2]
    cw, ch = W // cols, H // rows
    cells = []
    for r in range(rows):
        for c in range(cols):
            cells.append(arr[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw])
    return cells


def checker_preview(sheet, fw, n, path, sq=14):
    h, w = sheet.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    c = (((xx // sq) + (yy // sq)) % 2)
    base = np.where(c[..., None] == 0, 210, 160).astype(np.uint8)
    bg = np.repeat(base, 3, 2)[:, :, :3].astype(float)
    a = sheet[:, :, 3:4] / 255.0
    out = (sheet[:, :, :3] * a + bg * (1 - a)).astype(np.uint8)
    img = Image.fromarray(out)
    img.thumbnail((1400, 400))
    img.save(path)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("--grid", required=True, metavar="CxR", help="ex 4x2")
    ap.add_argument("--out", default=os.path.join(root, "assets/sprites_sheets"))
    ap.add_argument("--nn", action="store_true", help="detourage BiRefNet (torch requis)")
    ap.add_argument("--white", action="store_true", help="detourage fond clair")
    ap.add_argument("--tol", type=int, default=sl.AUTO_BG_TOL)
    ap.add_argument("--pad", type=int, default=4, help="marge px autour du sujet")
    ap.add_argument("--bottom", action="store_true",
                    help="aligne le sujet en bas (defaut : centre vertical)")
    ap.add_argument("--cols", type=int, default=0, help="frames/ligne (0 = une ligne)")
    ap.add_argument("--name", default=None, help="nom de sortie (defaut: nom de fichier en minuscules)")
    args = ap.parse_args()

    cols, rows = (int(x) for x in args.grid.lower().split("x"))
    os.makedirs(args.out, exist_ok=True)
    handle = sl.load_birefnet() if args.nn else None

    for path in args.inputs:
        arr = np.asarray(Image.open(path).convert("RGB"))
        cells = split_grid(arr, cols, rows)

        rgbas = []
        for cell in cells:
            if handle is not None:
                rgba, _ = sl.remove_bg_nn(cell, handle)
            elif args.white:
                rgba, _ = sl.remove_white_bg(cell)
            else:
                rgba, _ = sl.remove_bg_auto(cell, tol=args.tol)
            rgbas.append(rgba)

        # rogne CHAQUE frame sur sa propre bbox (la grille source ne place pas le
        # sujet au meme endroit d'une cellule a l'autre), puis recentre sur un
        # canvas commun -> frames de meme taille, sujet centre/aligne.
        tight = []
        for rgba in rgbas:
            bb = sl.bbox_of(rgba[:, :, 3] > sl.AA_ALPHA_FLOOR)
            if bb is None:
                tight.append(np.zeros((1, 1, 4), np.uint8))
                continue
            x0, y0, x1, y1 = bb
            tight.append(rgba[y0:y1, x0:x1])

        fw = max(t.shape[1] for t in tight) + 2 * args.pad
        fh = max(t.shape[0] for t in tight) + 2 * args.pad

        n = len(tight)
        sheet_cols = args.cols if args.cols > 0 else n
        sheet_rows = (n + sheet_cols - 1) // sheet_cols
        sheet = np.zeros((sheet_rows * fh, sheet_cols * fw, 4), np.uint8)
        for i, t in enumerate(tight):
            r, c = divmod(i, sheet_cols)
            th, tw = t.shape[:2]
            ox = c * fw + (fw - tw) // 2                       # centre horizontal
            if args.bottom:
                oy = r * fh + (fh - th - args.pad)             # aligne en bas
            else:
                oy = r * fh + (fh - th) // 2                   # centre vertical
            sheet[oy:oy + th, ox:ox + tw] = t

        name = args.name or os.path.splitext(os.path.basename(path))[0].lower()
        outp = os.path.join(args.out, f"{name}.png")
        Image.fromarray(sheet, "RGBA").save(outp)
        checker_preview(sheet, fw, n, os.path.join(args.out, f"_{name}_preview.png"))
        print(f"{os.path.basename(path)} -> {outp}")
        print(f"  {n} frames | frame {fw}x{fh} | sheet {sheet.shape[1]}x{sheet.shape[0]} "
              f"| sliceX={sheet_cols} sliceY={sheet_rows}")


if __name__ == "__main__":
    main()
