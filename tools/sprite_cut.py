#!/usr/bin/env python3
"""Etape 1 : grilles -> frames numerotees detourees.

Pour chaque planche assets/sprites_bench/*.png :
  - decoupe en 8 cellules (ligne du haut 1..4, ligne du bas 5..8)
  - retire le fond blanc + les marges/borders (detourage par connexite)
  - rogne sur la bounding box du perso
  - sauve <out>/<serie>/<serie>_1.png .. _8.png (RGBA, rognage serre)

Ecrit aussi <out>/manifest.json : pour chaque frame, sa bbox dans la cellule,
ses dimensions rognees et la taille de cellule -> sert a l'etape de normalisation
(tools/sprite_normalize.py).

Usage:
    python tools/sprite_cut.py
    python tools/sprite_cut.py --src assets/sprites_bench --out assets/sprites_cut
"""
import argparse
import glob
import json
import os

from PIL import Image

import _spritelib as sl


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", default=os.path.join(root, "assets/sprites_bench"))
    ap.add_argument("--out", default=os.path.join(root, "assets/sprites_cut"))
    ap.add_argument("--nn", action="store_true",
                    help="detourage par reseau (BiRefNet) au lieu de l'heuristique "
                         "fond clair ; preserve mieux les blancs du perso (chat). "
                         "Necessite torch -> lancer avec /home/delete/venv_311/bin/python")
    args = ap.parse_args()

    handle = sl.load_birefnet() if args.nn else None
    method = "BiRefNet (NN)" if args.nn else "heuristique fond clair"
    print(f"methode de detourage : {method}\n")

    sheets = sorted(glob.glob(os.path.join(args.src, "*.png")))
    if not sheets:
        raise SystemExit(f"Aucune planche dans {args.src}")

    os.makedirs(args.out, exist_ok=True)
    manifest = {"grid": {"cols": sl.COLS, "rows": sl.ROWS}, "series": {}}
    global_max_h = 0
    global_max_w = 0

    print(f"{'serie':22s} {'cellule':>9s}  {'8 hauteurs bbox':>40s}")
    for path in sheets:
        stem = os.path.splitext(os.path.basename(path))[0]
        sid = sl.series_id(stem)
        sheet = sl.load_rgb(path)
        cells, (cw, ch) = sl.split_cells(sheet)

        sdir = os.path.join(args.out, sid)
        os.makedirs(sdir, exist_ok=True)

        frames = []
        heights = []
        for n, cell in cells:
            if handle is not None:
                rgba, fg = sl.remove_bg_nn(cell, handle)
            else:
                rgba, fg = sl.remove_white_bg(cell)
            bb = sl.bbox_of(rgba[:, :, 3] > sl.AA_ALPHA_FLOOR)  # inclut la rampe AA
            if bb is None:  # cellule vide (ne devrait pas arriver)
                bb = (0, 0, cw, ch)
            x0, y0, x1, y1 = bb
            trimmed = rgba[y0:y1, x0:x1]
            fname = f"{sid}_{n}.png"
            Image.fromarray(trimmed, "RGBA").save(os.path.join(sdir, fname))
            w, h = x1 - x0, y1 - y0
            frames.append({"n": n, "file": fname, "bbox": [x0, y0, x1, y1],
                           "w": w, "h": h})
            heights.append(h)
            global_max_h = max(global_max_h, h)
            global_max_w = max(global_max_w, w)

        max_h = max(f["h"] for f in frames)
        max_w = max(f["w"] for f in frames)
        manifest["series"][sid] = {
            "source": os.path.basename(path),
            "cell": [cw, ch],
            "max_w": max_w, "max_h": max_h,
            "frames": frames,
        }
        print(f"{sid:22s} {cw}x{ch:<4d}  {str(heights):>40s}")

    manifest["global_max_bbox_w"] = global_max_w
    manifest["global_max_bbox_h"] = global_max_h
    with open(os.path.join(args.out, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    print()
    print(f"{len(sheets)} planches -> {args.out}")
    print(f"bbox max globale : {global_max_w} x {global_max_h} (hauteur de reference)")
    print(f"manifest : {os.path.join(args.out, 'manifest.json')}")


if __name__ == "__main__":
    main()
