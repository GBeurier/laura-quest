#!/usr/bin/env python3
"""raw -> sprites finales pour les SOLS PIEGES ('%').

Detoure un eventuel fond magenta (chroma-key Codex), recadre sur la fosse, et
normalise chaque planche en CARRE PLEIN CADRE 96x96 @CONFIG.art.scale (=48x48
affiche = UNE tuile), via un cover-fit (la fosse remplit le carre bord a bord).
Ces tuiles carrees se PAVENT cote a cote pour former une plaque-piege qui grandit
en largeur (cf. spawnHazardSpan dans js/game.js) -> il faut un CONTENU TILEABLE
(danger qui borde les bords gauche/droit), garanti par les prompts (make_prompts).

Idempotent : ne traite que les raw/<nom>.png presents.

  python3 _hazardgen/build.py
  python3 gen_assets_data.py
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = "/home/delete/laura_quest"
HERE = os.path.join(ROOT, "_hazardgen")
RAW = os.path.join(HERE, "raw")
CUT = os.path.join(HERE, "cut")
OUT = os.path.join(ROOT, "assets/sprites")
RCK = "/home/delete/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py"

NAMES = ["hazard_paddy", "hazard_acid", "hazard"]
TARGET = 96                # cote du carre final (@CONFIG.art.scale=2 -> 48 affiche = 1 tuile)


def have(name):
    return os.path.exists(os.path.join(RAW, name + ".png"))


def key(name):
    """raw/name.png -> cut/name.png (fond magenta -> alpha)."""
    os.makedirs(CUT, exist_ok=True)
    src, dst = os.path.join(RAW, name + ".png"), os.path.join(CUT, name + ".png")
    # Cle EXPLICITE #ff00ff (PAS --auto-key : Codex recadre serre la marge magenta,
    #  donc l'echantillon de bord est pollue par les parois sombres -> mauvaise
    #  couleur cle, magenta residuel). tolerance pour les bords anti-alias.
    subprocess.run([sys.executable, RCK, "--input", src, "--out", dst,
                    "--key-color", "#ff00ff", "--tolerance", "60", "--soft-matte",
                    "--transparent-threshold", "18", "--opaque-threshold", "200",
                    "--despill", "--force"], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return dst


def magenta_frac(im):
    """Fraction de pixels ~#ff00ff (Codex a encadre la fosse de magenta ?)."""
    a = np.asarray(im.convert("RGB")).astype(int)
    m = (a[..., 0] > 180) & (a[..., 1] < 80) & (a[..., 2] > 180)
    return float(m.mean())


def seam_window(im):
    """Extrait la fenetre horizontale interieure la PLUS TILEABLE (couture invisible
    gauche↔droite), pleine hauteur. Codex encadre souvent la fosse de PAROIS
    gauche/droite (non voulues) -> on coupe dedans, la ou la texture se reboucle
    (phase identique aux deux bords) -> la plaque devient un trou CONTINU une fois
    pavee. La cle est de jeter les murs lateraux et de garder un motif periodique."""
    a = np.asarray(im.convert("RGB")).astype(int)
    H, W, _ = a.shape
    best = None
    # fenetre = 62..92% de la largeur ; bords >=4% pour eviter les parois extremes.
    for wt in range(int(W * 0.62), int(W * 0.92), max(2, W // 200)):
        for x0 in range(int(W * 0.04), W - wt - int(W * 0.04) + 1, max(2, W // 200)):
            cost = np.mean(np.abs(a[:, x0, :] - a[:, x0 + wt, :]))   # ecart colonne gauche vs droite
            if best is None or cost < best[0]:
                best = (cost, x0, wt)
    cost, x0, wt = best
    return im.crop((x0, 0, x0 + wt, H)), cost


def normalize(name):
    im = Image.open(os.path.join(RAW, name + ".png")).convert("RGBA")
    if magenta_frac(im) > 0.06:               # vrai fond magenta -> detoure + serre sur la fosse
        im = Image.open(key(name)).convert("RGBA")
        b = im.getbbox()
        if b:
            im = im.crop(b)
    # aplati sur fond sombre (la tuile est OPAQUE, pleine cadre -> pas de trou au pavage)
    flat = Image.new("RGBA", im.size, (16, 14, 16, 255))
    flat.alpha_composite(im)
    win, cost = seam_window(flat)             # fenetre interieure tileable (vire les parois)
    out_im = win.resize((TARGET, TARGET), Image.LANCZOS).convert("RGBA")
    out = os.path.join(OUT, name + ".png")
    out_im.save(out)
    print("  %-16s %dx%d  (seam-cost %.1f)" % (name + ".png", TARGET, TARGET, cost))


def main():
    todo = [n for n in NAMES if have(n)]
    if not todo:
        print("Aucun raw/ a traiter. Genere d'abord l'art :")
        print("  python3 _hazardgen/make_prompts.py  (puis image_gen par prompt)")
        return
    print("Fosses-pieges (Codex) -> %s" % OUT)
    for n in todo:
        normalize(n)
    print("OK -> relance : python3 gen_assets_data.py")


if __name__ == "__main__":
    main()
