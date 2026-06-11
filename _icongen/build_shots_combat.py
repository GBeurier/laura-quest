#!/usr/bin/env python3
"""Passe "combat v2.3" : construit les 6 NOUVEAUX projectiles depuis _icongen/raw/.
Meme logique que build_shots_plain.py (crop bbox -> resize -> contour sombre net,
SANS halo) mais en cellule 96x96 (les shots LIVRES du jeu sont en 96, pas 64 —
les constantes 64/56 de build_shots_plain.py n'avaient pas ete re-commitees).
Chroma d'abord (raw magenta -> cut transparent) via le helper systeme codex.
Ensuite : python3 gen_assets_data.py
"""
import os, subprocess, sys
from PIL import Image, ImageFilter

ROOT = "/home/delete/laura_quest"
RAW = os.path.join(ROOT, "_icongen/raw")
CUT = os.path.join(ROOT, "_icongen/cut")
OUT = os.path.join(ROOT, "assets/sprites")
CHROMA = os.path.expanduser("~/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py")
SHOTS = ["shot_chart", "shot_boulette", "shot_chip", "shot_eau", "shot_courrier", "shot_page"]
CELL, CORE = 96, 88
OW, OCOL = 3, (18, 14, 12)          # contour sombre (px finaux)


def add_outline(icon, ow=OW, col=OCOL):
    pad = ow + 1
    base = Image.new("RGBA", (icon.width + 2 * pad, icon.height + 2 * pad), (0, 0, 0, 0))
    base.alpha_composite(icon, (pad, pad))
    oa = base.getchannel("A").filter(ImageFilter.MaxFilter(2 * ow + 1))
    ring = Image.new("RGBA", base.size, col + (0,))
    ring.putalpha(oa)
    out = Image.new("RGBA", base.size, (0, 0, 0, 0))
    out.alpha_composite(ring)
    out.alpha_composite(base)
    return out


def main():
    names = sys.argv[1:] or SHOTS
    done = []
    for n in names:
        raw = os.path.join(RAW, n + ".png")
        cut = os.path.join(CUT, n + ".png")
        if not os.path.exists(raw):
            print("skip (pas de raw)", n)
            continue
        r = subprocess.run([sys.executable, CHROMA, "--input", raw, "--out", cut,
                            "--auto-key", "border", "--soft-matte",
                            "--transparent-threshold", "14", "--opaque-threshold", "210",
                            "--despill", "--force"], capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(cut):
            print("CHROMA FAIL", n, r.stderr[-200:])
            continue
        im = Image.open(cut).convert("RGBA")
        b = im.getbbox()
        if b:
            im = im.crop(b)
        s = CORE / max(im.size)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        im = add_outline(im)
        cv = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        cv.alpha_composite(im, ((CELL - im.width) // 2, (CELL - im.height) // 2))
        cv.save(os.path.join(OUT, n + ".png"))
        done.append(n)
    print("OK shots combat:", ", ".join(done))


if __name__ == "__main__":
    main()
