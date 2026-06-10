#!/usr/bin/env python3
"""Genere assets/sprites/fx_bomb_shadow.png : feuille de 6 frames de l'ombre de
chute d'une bombe (telegraphe au sol / sur un panneau).

Ombre plate sombre + lisere d'alerte rouge qui GROSSIT et s'intensifie frame
par frame ; le moteur (addBombShadow dans game.js) regle la frame sur
l'avancement de la chute. Authoring a CONFIG.art.scale (=2x) : chaque frame
128x64 s'affiche en 64x32. Re-embarque ensuite : python3 gen_assets_data.py
"""
from PIL import Image, ImageDraw, ImageFilter

NF = 6
FW, FH = 128, 64
CX, CY = FW // 2, FH // 2
OUT = "assets/sprites/fx_bomb_shadow.png"

sheet = Image.new("RGBA", (FW * NF, FH), (0, 0, 0, 0))
for i in range(NF):
    k = i / (NF - 1)                       # 0..1 progression de la chute
    a = 26 + k * 34                        # demi-grand axe (px author)
    b = a * 0.42                           # demi-petit axe -> ombre aplatie

    # halo sombre : ellipses concentriques alpha-composees + flou = bord doux
    fr = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    for grow, alpha in ((1.25, 40), (0.98, 85), (0.66, 125)):
        lay = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        aa, bb = a * grow, b * grow
        al = min(190, int(alpha + k * 55))
        ImageDraw.Draw(lay).ellipse([CX - aa, CY - bb, CX + aa, CY + bb], fill=(12, 10, 14, al))
        fr = Image.alpha_composite(fr, lay)
    fr = fr.filter(ImageFilter.GaussianBlur(1.5))

    # lisere d'alerte rouge (net) qui s'intensifie a l'approche de l'impact
    rim = min(255, int(115 + k * 140))
    w = max(2, int(2 + k * 3))
    ImageDraw.Draw(fr).ellipse([CX - a, CY - b, CX + a, CY + b], outline=(244, 92, 54, rim), width=w)

    sheet.paste(fr, (i * FW, 0))

sheet.save(OUT)
print("wrote", OUT, sheet.size)
