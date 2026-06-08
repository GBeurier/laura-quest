#!/usr/bin/env python3
"""Etape 2 : normalisation d'echelle + canvas uniforme (+ rescale par serie).

Part des frames rognees de tools/sprite_cut.py (assets/sprites_cut/ + manifest)
et produit des frames a ECHELLE UNIFORME sur un CANVAS COMMUN, dans
assets/sprites_norm/<serie>/<serie>_1.png .. _8.png.

Principe
--------
- "scale" par serie = facteur applique a la serie. Au 1er passage il est
  PRE-REMPLI a global_max_bbox_h / max_h(serie) : la frame la plus haute de
  chaque serie atteint ainsi la hauteur de reference (uniformisation auto).
- Ce pre-remplissage va SUR-AGRANDIR les series a pose penchee/accroupie
  (throws, jump, hurt, duck) dont la bbox est courte a cause de la pose, pas de
  l'echelle. C'est voulu : tu ajustes ensuite le % a la main.

Workflow
--------
  python tools/sprite_cut.py                 # produit les frames + manifest
  python tools/sprite_normalize.py           # cree tools/sprite_scale.json + rend
  # edite les "scale" dans tools/sprite_scale.json, puis :
  python tools/sprite_normalize.py           # re-rend avec tes valeurs
  # ou, en une ligne, pour rescaler une (des) serie(s) :
  python tools/sprite_normalize.py --set throw_rice=0.82 jump=0.9
  python tools/sprite_normalize.py --reseed  # recalcule les suggestions auto

Le JSON conserve tes editions entre les passages (seules les series manquantes
sont ajoutees). Alignement par defaut : pieds sur une baseline commune.
"""
import argparse
import glob
import json
import os

import numpy as np
from PIL import Image

import _spritelib as sl

CONFIG_NAME = "sprite_scale.json"


def load_manifest(cut_dir):
    with open(os.path.join(cut_dir, "manifest.json")) as f:
        return json.load(f)


def load_or_init_config(path, manifest, reseed=False):
    cfg = {}
    if os.path.exists(path):
        with open(path) as f:
            cfg = json.load(f)
    cfg.setdefault("margin", 0.30)
    cfg.setdefault("default_align", "bottom-center")  # bottom-center | center | cell
    cfg.setdefault("canvas", None)                    # null=auto, ou [W,H]
    cfg.setdefault("series", {})
    gmax = manifest["global_max_bbox_h"]
    for sid, sdata in manifest["series"].items():
        suggested = round(gmax / sdata["max_h"], 4)
        entry = cfg["series"].get(sid)
        if entry is None:
            cfg["series"][sid] = {"scale": suggested, "x_offset": 0,
                                  "y_offset": 0, "align": None}
        elif reseed:
            entry["scale"] = suggested
        else:
            entry.setdefault("scale", suggested)
            entry.setdefault("x_offset", 0)
            entry.setdefault("y_offset", 0)
            entry.setdefault("align", None)
    return cfg


def save_config(path, cfg):
    with open(path, "w") as f:
        json.dump(cfg, f, indent=2)


def scaled_size(w, h, s):
    return max(1, round(w * s)), max(1, round(h * s))


def compute_canvas(manifest, cfg):
    if cfg["canvas"]:
        return int(cfg["canvas"][0]), int(cfg["canvas"][1])
    margin = cfg["margin"]
    maxw = maxh = 0
    for sid, sdata in manifest["series"].items():
        s = cfg["series"][sid]["scale"]
        for fr in sdata["frames"]:
            w, h = scaled_size(fr["w"], fr["h"], s)
            maxw = max(maxw, w)
            maxh = max(maxh, h)
    cw = int(np.ceil(maxw * (1 + margin) / 2) * 2)
    ch = int(np.ceil(maxh * (1 + margin) / 2) * 2)
    return cw, ch, maxw, maxh


def place(canvas, sprite, x, y):
    """Alpha-composite sprite (RGBA np) sur canvas (RGBA np) en (x,y), clip bords."""
    H, W = canvas.shape[:2]
    sh, sw = sprite.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + sw), min(H, y + sh)
    if x0 >= x1 or y0 >= y1:
        return
    sx0, sy0 = x0 - x, y0 - y
    sub = sprite[sy0:sy0 + (y1 - y0), sx0:sx0 + (x1 - x0)].astype(float)
    reg = canvas[y0:y1, x0:x1].astype(float)
    a = sub[:, :, 3:4] / 255.0
    reg[:, :, :3] = sub[:, :, :3] * a + reg[:, :, :3] * (1 - a)
    reg[:, :, 3:4] = np.clip(sub[:, :, 3:4] + reg[:, :, 3:4] * (1 - a), 0, 255)
    canvas[y0:y1, x0:x1] = reg.astype(np.uint8)


def render(manifest, cfg, cut_dir, out_dir):
    cw, ch, content_w, content_h = compute_canvas(manifest, cfg)
    margin = cfg["margin"]
    # baseline : pieds des frames, bande de contenu centree verticalement
    baseline = ch - round((ch - content_h) / 2)
    os.makedirs(out_dir, exist_ok=True)

    rows = []
    print(f"\ncanvas commun : {cw} x {ch}  (contenu max {content_w}x{content_h}, "
          f"marge {int(margin*100)}%)")
    print(f"{'serie':20s} {'scale':>6s} {'align':>13s}  frames")
    for sid, sdata in manifest["series"].items():
        sc = cfg["series"][sid]
        s = sc["scale"]
        align = sc["align"] or cfg["default_align"]
        xoff, yoff = sc.get("x_offset", 0), sc.get("y_offset", 0)
        scw, sch = sdata["cell"][0] * s, sdata["cell"][1] * s
        sdir = os.path.join(out_dir, sid)
        os.makedirs(sdir, exist_ok=True)
        thumbs = []
        for fr in sdata["frames"]:
            src = Image.open(os.path.join(cut_dir, sid, fr["file"])).convert("RGBA")
            sw, sh = scaled_size(fr["w"], fr["h"], s)
            sprite = np.asarray(src.resize((sw, sh), Image.LANCZOS))
            canvas = np.zeros((ch, cw, 4), np.uint8)

            cx = cw // 2 + xoff
            if align == "center":
                x = round(cx - sw / 2)
                y = round((ch - sh) / 2) + yoff
            elif align == "cell":
                # conserve la position dessinee dans la cellule (lift/sway)
                x0, y0, x1, y1 = fr["bbox"]
                cell_left = round(cw / 2 - scw / 2) + xoff
                cell_top = round(baseline - scw * 0 - sch) + yoff  # bas cellule->baseline
                x = round(cell_left + x0 * s)
                y = round(cell_top + y0 * s)
            else:  # bottom-center
                x = round(cx - sw / 2)
                y = baseline - sh + yoff

            place(canvas, sprite, x, y)
            Image.fromarray(canvas, "RGBA").save(os.path.join(sdir, fr["file"]))
            thumbs.append(canvas)
        rows.append((sid, s, align, thumbs))
        flag = "  <-- |scale-1| eleve, verifier (pose courte ?)" if abs(s - 1) > 0.15 else ""
        print(f"{sid:20s} {s:6.3f} {align:>13s}  {len(thumbs)} frames{flag}")

    _write_preview(rows, cw, ch, baseline, os.path.join(out_dir, "_preview.png"))
    print(f"\n-> {out_dir}  (apercu : {os.path.join(out_dir, '_preview.png')})")


def _write_preview(rows, cw, ch, baseline, path, scale=0.32):
    """Contact sheet : 1 ligne par serie, 8 frames, sur damier + baseline."""
    tw, th = max(1, round(cw * scale)), max(1, round(ch * scale))
    gap = 6
    label_w = 110
    n = len(rows)
    sheet_w = label_w + 8 * tw + 9 * gap
    sheet_h = n * (th + gap) + gap
    yy, xx = np.mgrid[0:sheet_h, 0:sheet_w]
    chk = (((xx // 14) + (yy // 14)) % 2)
    base = np.where(chk[..., None] == 0, 210, 170).astype(np.uint8)
    sheet = np.dstack([np.repeat(base, 3, 2)[:, :, :3],
                       np.full((sheet_h, sheet_w), 255, np.uint8)])
    bl = round(baseline * scale)
    for ri, (sid, s, align, thumbs) in enumerate(rows):
        oy = gap + ri * (th + gap)
        # baseline rouge
        sheet[oy + bl:oy + bl + 1, label_w:, :3] = [220, 60, 60]
        ox = label_w + gap
        for cv in thumbs:
            t = np.asarray(Image.fromarray(cv, "RGBA").resize((tw, th), Image.LANCZOS)).astype(float)
            reg = sheet[oy:oy + th, ox:ox + tw].astype(float)
            a = t[:, :, 3:4] / 255.0
            reg[:, :, :3] = t[:, :, :3] * a + reg[:, :, :3] * (1 - a)
            sheet[oy:oy + th, ox:ox + tw, :3] = reg[:, :, :3].astype(np.uint8)
            ox += tw + gap
    img = Image.fromarray(sheet, "RGBA").convert("RGB")
    # etiquettes texte
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    for ri, (sid, s, align, thumbs) in enumerate(rows):
        oy = gap + ri * (th + gap)
        d.text((4, oy + th // 2 - 6), f"{sid}\nx{s:.2f}", fill=(20, 20, 20))
    img.save(path)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cut", default=os.path.join(root, "assets/sprites_cut"))
    ap.add_argument("--out", default=os.path.join(root, "assets/sprites_norm"))
    ap.add_argument("--config", default=os.path.join(here, CONFIG_NAME))
    ap.add_argument("--reseed", action="store_true",
                    help="recalcule tous les scale auto (ecrase tes valeurs)")
    ap.add_argument("--set", nargs="+", metavar="SERIE=VAL", default=None,
                    help="fixe le scale d'une/des serie(s), ex: --set jump=0.9 run=1.05")
    args = ap.parse_args()

    manifest = load_manifest(args.cut)
    cfg = load_or_init_config(args.config, manifest, reseed=args.reseed)

    if args.set:
        for kv in args.set:
            k, v = kv.split("=")
            k = k.strip()
            if k not in cfg["series"]:
                cfg["series"][k] = {"scale": 1.0, "x_offset": 0, "y_offset": 0, "align": None}
            cfg["series"][k]["scale"] = round(float(v), 4)
            print(f"set {k} -> scale {cfg['series'][k]['scale']}")

    save_config(args.config, cfg)
    print(f"config : {args.config}")
    render(manifest, cfg, args.cut, args.out)


if __name__ == "__main__":
    main()
