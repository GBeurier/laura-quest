#!/usr/bin/env python3
"""Detourage en BULK (sans normalisation).

Retire le fond de n'importe quelles images (sprites isoles ou planches), avec la
meme qualite que le pipeline Laura : fond exterieur + poches enclavees, contour
anti-aliase, decontamination couleur (pas de halo). Detecte la couleur de fond
sur la bordure -> marche pour fond blanc OU couleur unie quelconque.

Exemples
--------
  # tous les png/jpg d'un dossier -> <dossier>_cutout/, fond auto, rogne
  python3 tools/sprite_detour.py assets/raw/

  # fichiers precis, sortie choisie, sans rognage (garde la taille)
  python3 tools/sprite_detour.py a.png b.png --out detoure/ --no-trim

  # planches en grille 4x3 -> 12 frames detourees par planche
  python3 tools/sprite_detour.py sheets/*.png --grid 4x3 --out frames/

  # fond clair force, marge de 8px autour du sprite rogne
  python3 tools/sprite_detour.py img/ --white --pad 8

Options utiles : --tol (tolerance couleur fond), --bg R,G,B (force la couleur),
--no-pockets (ne retire QUE le fond connecte aux bords, garde les creux),
--aa SIGMA (0 = bord dur), --grid CxR, --pad N, --no-trim.
"""
import argparse
import glob
import os
import sys

import numpy as np
from PIL import Image

import _spritelib as sl

EXTS = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif")


def gather_inputs(paths):
    files = []
    for p in paths:
        if os.path.isdir(p):
            for f in sorted(os.listdir(p)):
                if f.lower().endswith(EXTS):
                    files.append(os.path.join(p, f))
        elif any(ch in p for ch in "*?[") and not os.path.exists(p):
            files.extend(sorted(glob.glob(p)))
        elif os.path.isfile(p):
            files.append(p)
        else:
            print(f"  (ignore, introuvable: {p})", file=sys.stderr)
    # dedup en gardant l'ordre
    seen, out = set(), []
    for f in files:
        if f not in seen:
            seen.add(f)
            out.append(f)
    return out


def cells_of(img, grid):
    """Rend [(suffixe, cell_rgb)]. grid=None -> 1 cellule (image entiere)."""
    arr = np.asarray(img.convert("RGB"))
    if not grid:
        return [("", arr)]
    cols, rows = grid
    H, W, _ = arr.shape
    cw, ch = W // cols, H // rows
    out = []
    for r in range(rows):
        for c in range(cols):
            n = r * cols + c + 1
            out.append((f"_{n:02d}", arr[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw]))
    return out


def trim(rgba, pad):
    bb = sl.bbox_of(rgba[:, :, 3] > sl.AA_ALPHA_FLOOR)
    if bb is None:
        return rgba
    x0, y0, x1, y1 = bb
    H, W = rgba.shape[:2]
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(W, x1 + pad), min(H, y1 + pad)
    return rgba[y0:y1, x0:x1]


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+", help="fichiers, dossiers ou globs")
    ap.add_argument("--out", default=None, help="dossier de sortie (defaut: <input>_cutout)")
    ap.add_argument("--grid", default=None, metavar="CxR", help="decoupe en grille, ex 4x2")
    ap.add_argument("--trim", dest="trim", action="store_true", default=True)
    ap.add_argument("--no-trim", dest="trim", action="store_false", help="ne pas rogner")
    ap.add_argument("--pad", type=int, default=0, help="marge px autour du rognage")
    ap.add_argument("--white", action="store_true", help="force le chemin fond clair")
    ap.add_argument("--tol", type=int, default=sl.AUTO_BG_TOL, help="tolerance couleur fond")
    ap.add_argument("--bg", default=None, metavar="R,G,B", help="force la couleur de fond")
    ap.add_argument("--no-pockets", dest="pockets", action="store_false", default=True,
                    help="ne retire que le fond connecte aux bords (garde les creux)")
    ap.add_argument("--aa", type=float, default=None, help="sigma anti-alias (0 = bord dur)")
    ap.add_argument("--nn", action="store_true",
                    help="detourage par reseau (BiRefNet) : segmente le sujet, garde "
                         "les blancs du perso. Necessite torch -> lancer avec "
                         "/home/delete/venv_311/bin/python")
    args = ap.parse_args()

    if args.aa is not None:
        sl.AA_SIGMA = args.aa
    nn_handle = sl.load_birefnet() if args.nn else None
    grid = None
    if args.grid:
        cols, rows = (int(x) for x in args.grid.lower().split("x"))
        grid = (cols, rows)
    bgcol = None
    if args.bg:
        bgcol = np.array([float(x) for x in args.bg.split(",")], dtype=np.float32)

    files = gather_inputs(args.inputs)
    if not files:
        raise SystemExit("Aucune image en entree.")

    # dossier de sortie par defaut
    out = args.out
    if out is None:
        base = args.inputs[0]
        base = base if os.path.isdir(base) else os.path.dirname(base) or "."
        out = base.rstrip("/\\") + "_cutout"
    os.makedirs(out, exist_ok=True)

    n_in = n_out = 0
    for path in files:
        stem = os.path.splitext(os.path.basename(path))[0]
        try:
            img = Image.open(path)
        except Exception as e:
            print(f"  ! {path}: {e}", file=sys.stderr)
            continue
        n_in += 1
        cells = cells_of(img, grid)
        subdir = os.path.join(out, stem) if grid else out
        if grid:
            os.makedirs(subdir, exist_ok=True)
        for suffix, cell in cells:
            if nn_handle is not None:
                rgba, _ = sl.remove_bg_nn(cell, nn_handle)
            elif args.white:
                rgba, _ = sl.remove_white_bg(cell)
                # remove_white_bg gere deja les poches ; respecte --no-pockets :
                if not args.pockets:
                    a = cell.astype(np.int16)
                    sat = a.max(2) - a.min(2); bright = a.max(2)
                    near = (bright >= sl.NEAR_WHITE_BRIGHT) & (sat <= sl.NEAR_WHITE_SAT)
                    rgba, _ = sl.cutout(cell, near, sl.detect_bg_color(cell),
                                        remove_pockets=False)
            else:
                rgba, _ = sl.remove_bg_auto(cell, tol=args.tol, bgcol=bgcol,
                                            remove_pockets=args.pockets)
            if args.trim:
                rgba = trim(rgba, args.pad)
            fname = f"{stem}{suffix}.png"
            Image.fromarray(rgba, "RGBA").save(os.path.join(subdir, fname))
            n_out += 1

    print(f"{n_in} image(s) -> {n_out} png detoure(s) dans {out}")
    if grid:
        print(f"grille {grid[0]}x{grid[1]} ; un sous-dossier par planche")


if __name__ == "__main__":
    main()
