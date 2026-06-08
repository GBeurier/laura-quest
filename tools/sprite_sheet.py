#!/usr/bin/env python3
"""Etape 3 : assemble une spritesheet par dossier de assets/sprites_norm/.

Chaque dossier <serie>/ contient ses frames normalisees (<serie>_N.png, meme
canvas commun). Les frames sont ordonnees par leur NUMERO croissant (gere les
trous et les numerotations qui ne commencent pas a 1) et concatenees en une
bande horizontale -> assets/sprites_sheets/<serie>.png (sliceX = nb de frames,
sliceY = 1, format attendu par CONFIG.anims).

Par defaut, rognage UNIFORME : on calcule la bounding box du contenu sur TOUTES
les frames de TOUTES les series et on coupe ce meme rectangle partout. Ca retire
la marge vide commune sans changer les positions relatives (pieds alignes).

Usage:
    python3 tools/sprite_sheet.py
    python3 tools/sprite_sheet.py --no-trim          # garde le canvas plein
    python3 tools/sprite_sheet.py --pad 8 --cols 4   # marge / disposition en grille
"""
import argparse
import os
import re

import numpy as np
from PIL import Image

import _spritelib as sl


def frame_num(fname):
    m = re.search(r"(\d+)\.png$", fname)
    return int(m.group(1)) if m else -1


def list_series(root):
    out = []
    for d in sorted(os.listdir(root)):
        p = os.path.join(root, d)
        if not os.path.isdir(p):
            continue
        frames = sorted((f for f in os.listdir(p) if f.lower().endswith(".png")),
                        key=frame_num)
        if frames:
            out.append((d, [os.path.join(p, f) for f in frames]))
    return out


def global_bbox(series, floor):
    x0 = y0 = 10 ** 9
    x1 = y1 = -1
    for _, paths in series:
        for p in paths:
            a = np.asarray(Image.open(p).convert("RGBA"))
            bb = sl.bbox_of(a[:, :, 3] > floor)
            if bb is None:
                continue
            x0, y0 = min(x0, bb[0]), min(y0, bb[1])
            x1, y1 = max(x1, bb[2]), max(y1, bb[3])
    if x1 < 0:
        return None
    return x0, y0, x1, y1


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", default=os.path.join(root, "assets/sprites_norm"))
    ap.add_argument("--out", default=os.path.join(root, "assets/sprites_sheets"))
    ap.add_argument("--no-trim", dest="trim", action="store_false", default=True,
                    help="garde le canvas commun plein (pas de rognage uniforme)")
    ap.add_argument("--pad", type=int, default=4, help="marge px autour du rognage uniforme")
    ap.add_argument("--cols", type=int, default=0,
                    help="frames par ligne (0 = une seule ligne horizontale)")
    args = ap.parse_args()

    series = list_series(args.src)
    if not series:
        raise SystemExit(f"Aucun dossier de frames dans {args.src}")
    os.makedirs(args.out, exist_ok=True)

    # rectangle de rognage commun
    crop = None
    if args.trim:
        bb = global_bbox(series, sl.AA_ALPHA_FLOOR)
        if bb:
            x0, y0, x1, y1 = bb
            # taille du canvas (toutes frames identiques)
            W, H = Image.open(series[0][1][0]).size
            x0, y0 = max(0, x0 - args.pad), max(0, y0 - args.pad)
            x1, y1 = min(W, x1 + args.pad), min(H, y1 + args.pad)
            crop = (x0, y0, x1, y1)

    fw = (crop[2] - crop[0]) if crop else Image.open(series[0][1][0]).size[0]
    fh = (crop[3] - crop[1]) if crop else Image.open(series[0][1][0]).size[1]

    print(f"frame : {fw} x {fh}" + (f"  (rogne de {crop})" if crop else "  (canvas plein)"))
    print(f"{'serie':16s} {'frames':>6s} {'sliceX':>6s} {'sliceY':>6s}  {'sheet (px)':>12s}")
    previews = []
    for sid, paths in series:
        frames = []
        for p in paths:
            im = Image.open(p).convert("RGBA")
            if crop:
                im = im.crop(crop)
            frames.append(np.asarray(im))
        n = len(frames)
        cols = args.cols if args.cols > 0 else n
        rows = (n + cols - 1) // cols
        sheet = np.zeros((rows * fh, cols * fw, 4), np.uint8)
        for i, fr in enumerate(frames):
            r, c = divmod(i, cols)
            sheet[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw] = fr
        Image.fromarray(sheet, "RGBA").save(os.path.join(args.out, f"{sid}.png"))
        print(f"{sid:16s} {n:6d} {cols:6d} {rows:6d}  {sheet.shape[1]}x{sheet.shape[0]}")
        previews.append((sid, n, cols, rows, sheet))

    _write_preview(previews, fw, fh, os.path.join(args.out, "_preview.png"))
    print(f"\n-> {args.out}  ({len(series)} spritesheets, apercu : _preview.png)")
    print("CONFIG.anims : sliceX = nb de frames ci-dessus, sliceY = 1 (bande horizontale).")


def _write_preview(previews, fw, fh, path, target_w=900):
    scale = min(0.5, target_w / max(p[4].shape[1] for p in previews))
    tw, th = max(1, round(fw * scale)), max(1, round(fh * scale))
    gap, label_w = 5, 90
    rows_px = []
    maxcols = max(p[2] for p in previews)
    for sid, n, cols, rows, sheet in previews:
        sh = np.asarray(Image.fromarray(sheet, "RGBA").resize(
            (round(sheet.shape[1] * scale), round(sheet.shape[0] * scale)), Image.LANCZOS))
        rows_px.append((sid, n, sh))
    width = label_w + maxcols * (tw + gap) + gap
    height = sum(s.shape[0] for _, _, s in rows_px) + gap * (len(rows_px) + 1)
    yy, xx = np.mgrid[0:height, 0:width]
    chk = (((xx // 12) + (yy // 12)) % 2)
    base = np.where(chk[..., None] == 0, 210, 165).astype(np.uint8)
    canvas = np.dstack([np.repeat(base, 3, 2)[:, :, :3], np.full((height, width), 255, np.uint8)])
    y = gap
    for sid, n, sh in rows_px:
        h, w = sh.shape[:2]
        x = label_w
        al = sh[:, :, 3:4].astype(float) / 255
        reg = canvas[y:y + h, x:x + w]
        reg[:, :, :3] = (sh[:, :, :3] * al + reg[:, :, :3] * (1 - al)).astype(np.uint8)
        canvas[y:y + h, x:x + w] = reg
        y += h + gap
    img = Image.fromarray(canvas, "RGBA").convert("RGB")
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    yy2 = gap
    for sid, n, sh in rows_px:
        d.text((4, yy2 + sh.shape[0] // 2 - 6), f"{sid}\n{n}f", fill=(15, 15, 15))
        yy2 += sh.shape[0] + gap
    img.save(path)


if __name__ == "__main__":
    main()
