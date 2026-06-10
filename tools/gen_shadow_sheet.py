#!/usr/bin/env python3
"""Icone unique d'ombre (ellipse detouree) -> feuille fx_bomb_shadow a 6 frames
qui GROSSISSENT (telegraphe de chute de bombe). Le moteur (addBombShadow dans
game.js) regle la frame sur l'avancement de la chute.

Chaque frame = 128x64 (authoring a CONFIG.art.scale=2 -> 64x32 a l'ecran).
L'ellipse passe de ~0.5x (frame 0) a 1.0x (frame 5), centree, aspect conserve.

Usage: python3 tools/gen_shadow_sheet.py cut/fx_bomb_shadow.png
Sortie -> assets/sprites/fx_bomb_shadow.png. Puis gen_assets_data.py.
"""
import argparse
import os
from PIL import Image

FW, FH, NF = 128, 64, 6


def autocrop(im):
    bb = im.split()[3].getbbox()
    return im.crop(bb) if bb else im


def fit_within(im, w, h):
    k = min(w / im.width, h / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("icon")
    ap.add_argument("--name", default="fx_bomb_shadow")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "assets", "sprites"))
    a = ap.parse_args()

    icon = autocrop(Image.open(a.icon).convert("RGBA"))
    sheet = Image.new("RGBA", (FW * NF, FH), (0, 0, 0, 0))
    for i in range(NF):
        sc = 0.5 + 0.5 * (i / (NF - 1))               # 0.5 -> 1.0
        fr = fit_within(icon, int(FW * sc), int(FH * sc))
        cell = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        cell.alpha_composite(fr, ((FW - fr.width) // 2, (FH - fr.height) // 2))
        sheet.paste(cell, (i * FW, 0))

    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    sheet.save(os.path.join(out, a.name + ".png"))
    print("wrote", a.name, sheet.size)


if __name__ == "__main__":
    main()
