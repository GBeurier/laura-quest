#!/usr/bin/env python3
"""Post-traite les images brutes de Codex image_gen pour Laura Quest.

  bg_<name>   : fond INTERIEUR pleine hauteur (plafond->sol). On le redimensionne
                a BG_W x BG_H pour qu'en bandeau (anchor 'bot' @ HORIZON_Y, scale
                1/ART) il couvre tout l'ecran -> plus de bande de ciel unie en haut.
  sol_<name>  : tuile de SOL '='. On la recadre/redimensionne puis on ajoute une
                marge TRANSPARENTE en haut de SOIL_LIFT*ART px : addSolid REMONTE
                le visuel de SOIL_LIFT, donc la surface opaque du bois retombe
                pile sur la surface de collision (comme tile_soil).

Usage: postprocess.py bg <rawpath> <outname>
       postprocess.py sol <rawpath> <outname>
"""
import sys
from PIL import Image

ART = 2
SOIL_LIFT = 8                      # cf. game.js addSolid
# Fond : display 800x500 -> ancre 'bot' @ HORIZON_Y=440, haut a -60 (marge anti-shake)
BG_W, BG_H = 1600, 1000
# Sol : display 112x140 -> surface @432, DEBORDE jusqu'a 572 (44px SOUS l'ecran=528)
#  -> un tremblement vers le haut ne decouvre plus la bande de couleur 'sky' en bas.
SOL_W = 224
SOL_BODY_H = 280                   # corps opaque (display 140 -> 432..572)
SOL_PAD_TOP = SOIL_LIFT * ART      # 16 px transparents en haut (compense le SOIL_LIFT)


def fit_cover(im, w, h):
    """Redimensionne en COUVRANT w x h (recadre le trop-plein, centre)."""
    sw, sh = im.size
    s = max(w / sw, h / sh)
    nw, nh = round(sw * s), round(sh * s)
    im = im.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - w) // 2, (nh - h) // 2
    return im.crop((left, top, left + w, top + h))


def do_bg(raw, out):
    im = Image.open(raw).convert("RGB")
    # On ne recadre PAS verticalement (on garde plafond + sol) : resize direct en
    #  ratio cible (leger etirement tolere en pixel-art). Largeur recadree au besoin.
    sw, sh = im.size
    # Ajuste d'abord la HAUTEUR exactement, puis recadre la largeur au centre.
    s = BG_H / sh
    im = im.resize((round(sw * s), BG_H), Image.LANCZOS)
    nw, _ = im.size
    if nw >= BG_W:
        left = (nw - BG_W) // 2
        im = im.crop((left, 0, left + BG_W, BG_H))
    else:
        im = im.resize((BG_W, BG_H), Image.LANCZOS)
    im.save(out)
    print("BG  ", out, im.size)


def do_sol(raw, out):
    im = Image.open(raw).convert("RGB")
    body = fit_cover(im, SOL_W, SOL_BODY_H)
    canvas = Image.new("RGBA", (SOL_W, SOL_BODY_H + SOL_PAD_TOP), (0, 0, 0, 0))
    canvas.paste(body.convert("RGBA"), (0, SOL_PAD_TOP))
    canvas.save(out)
    print("SOL ", out, canvas.size, "(top pad", SOL_PAD_TOP, "transparent)")


def do_panorama(panels, out):
    """Assemble N panneaux pleine hauteur en UN long bandeau (large -> peu de
    repetition + variete). Chaque panneau est mis a BG_H de haut (ratio conserve)
    puis colle avec un CROSSFADE lineaire de `blend` px qui masque les joints."""
    scaled = []
    for p in panels:
        im = Image.open(p).convert("RGB")
        w, h = im.size
        scaled.append(im.resize((round(w * BG_H / h), BG_H), Image.LANCZOS))
    blend = 28
    total_w = sum(im.size[0] for im in scaled) - blend * (len(scaled) - 1)
    pano = Image.new("RGB", (total_w, BG_H))
    # masque de fondu : 1 ligne (alpha 0->255 sur la largeur) etiree en hauteur
    row = Image.new("L", (blend, 1))
    row.putdata([int(255 * j / blend) for j in range(blend)])
    ramp = row.resize((blend, BG_H))
    x = 0
    for i, im in enumerate(scaled):
        if i == 0:
            pano.paste(im, (0, 0)); x = im.size[0]
        else:
            prev = pano.crop((x - blend, 0, x, BG_H))
            new = im.crop((0, 0, blend, BG_H))
            pano.paste(Image.composite(new, prev, ramp), (x - blend, 0))
            pano.paste(im.crop((blend, 0, im.size[0], BG_H)), (x, 0))
            x += im.size[0] - blend
    pano.save(out)
    print("PANO", out, pano.size, "(", len(panels), "panneaux, blend", blend, ")")


if __name__ == "__main__":
    kind = sys.argv[1]
    if kind == "panorama":
        # postprocess.py panorama <outname> <panel1> <panel2> ...
        outname, panels = sys.argv[2], sys.argv[3:]
        do_panorama(panels, "assets/sprites/%s.png" % outname)
    else:
        raw, outname = sys.argv[2], sys.argv[3]
        out = "assets/sprites/%s.png" % outname
        (do_bg if kind == "bg" else do_sol)(raw, out)
