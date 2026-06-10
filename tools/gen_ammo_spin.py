#!/usr/bin/env python3
"""Icone unique detouree -> feuille de MUNITION a 6 frames qui TOURNOIE.

Parallele a gen_pickup_sheets.py (qui fait du "bump"), mais pour les projectiles
d'arsenal : on fait pivoter l'icone par pas de 360/frames pour un spin qui boucle.
Cellule carree (authoring a CONFIG.art.scale=2 -> moitie a l'ecran). Jamais de
clip : si l'icone tournee deborde, on la reduit pour la caler dans la cellule.

Usage:
  python3 tools/gen_ammo_spin.py cut/ammo_cookie.png --name ammo_cookie --cell 52
Sortie -> assets/sprites/<name>.png (sliceX=frames). Puis gen_assets_data.py.
"""
import argparse
import os
from PIL import Image

SS = 4  # supersampling


def autocrop(im):
    bb = im.split()[3].getbbox()
    return im.crop(bb) if bb else im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("icon")
    ap.add_argument("--name", required=True)
    ap.add_argument("--cell", type=int, default=52)
    ap.add_argument("--frames", type=int, default=6)
    ap.add_argument("--fill", type=float, default=0.82, help="part de la cellule occupee")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "assets", "sprites"))
    a = ap.parse_args()

    ssc = a.cell * SS
    icon = autocrop(Image.open(a.icon).convert("RGBA"))
    s = (a.fill * ssc) / max(icon.size)
    icon = icon.resize((max(1, round(icon.width * s)), max(1, round(icon.height * s))), Image.LANCZOS)

    sheet = Image.new("RGBA", (a.cell * a.frames, a.cell), (0, 0, 0, 0))
    for i in range(a.frames):
        rot = icon.rotate(-360.0 * i / a.frames, resample=Image.BICUBIC, expand=True)
        if max(rot.size) > ssc:                       # anti-clip : recale dans la cellule
            k = ssc / max(rot.size)
            rot = rot.resize((max(1, round(rot.width * k)), max(1, round(rot.height * k))), Image.LANCZOS)
        cellimg = Image.new("RGBA", (ssc, ssc), (0, 0, 0, 0))
        cellimg.alpha_composite(rot, ((ssc - rot.width) // 2, (ssc - rot.height) // 2))
        sheet.paste(cellimg.resize((a.cell, a.cell), Image.LANCZOS), (i * a.cell, 0))

    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    sheet.save(os.path.join(out, a.name + ".png"))
    print("wrote", a.name, sheet.size)


if __name__ == "__main__":
    main()
