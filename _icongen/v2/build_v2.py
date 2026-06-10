#!/usr/bin/env python3
"""Post-traite la passe d'assets GAMEPLAY V2 : raw/ magenta (Codex image_gen)
-> assets/sprites. Idempotent par asset (ne traite que les raw/ presents).

Pipeline par asset :
  1. remove_chroma_key.py (helper systeme, chroma #ff00ff -> alpha) -> cut/
  2. crop au contenu + resize selon le type, compose la feuille -> assets/sprites/

Types :
  - pickup_*  -> feuille bump 4 frames, cellule 64 (via tools/gen_pickup_sheets.py)
  - medal_* / trophy_*  -> 1 frame carree centree (taille cible)
  - fx_quake -> feuille 6 frames horizontales 96x48 (re-grille la bande generee)

Ensuite : python3 gen_assets_data.py
"""
import os
import subprocess
import sys

from PIL import Image

ROOT = "/home/delete/laura_quest"
V2 = os.path.join(ROOT, "_icongen/v2")
RAW = os.path.join(V2, "raw")
CUT = os.path.join(V2, "cut")
OUT = os.path.join(ROOT, "assets/sprites")
CODEX_HOME = os.environ.get("CODEX_HOME", os.path.expanduser("~/.codex"))
RCK = os.path.join(CODEX_HOME, "skills/.system/imagegen/scripts/remove_chroma_key.py")
PY = sys.executable

# asset -> dict(type, ...). cell/size en px d'authoring (scale 2 pour l'ecran).
PICKUPS = ["pickup_puissance", "pickup_cadence"]
SINGLES = {                      # 1 frame carree, taille cible = la valeur
    "medal_or":       64,
    "medal_argent":   64,
    "medal_bronze":   64,
    "medal_lock":     64,
    "trophy_mention": 96,
}
QUAKE = "fx_quake"               # bande 6 frames -> 6x (96x48)
QUAKE_FW, QUAKE_FH, QUAKE_N = 96, 48, 6


def have(name):
    return os.path.exists(os.path.join(RAW, name + ".png"))


def chroma(name):
    """Detoure le chroma magenta -> cut/<name>.png. Renvoie le chemin."""
    src = os.path.join(RAW, name + ".png")
    dst = os.path.join(CUT, name + ".png")
    subprocess.run([PY, RCK, "--input", src, "--out", dst,
                    "--auto-key", "border", "--soft-matte",
                    "--transparent-threshold", "14", "--opaque-threshold", "210",
                    "--despill", "--force"], check=True)
    return dst


def cropped(path):
    im = Image.open(path).convert("RGBA")
    b = im.getbbox()
    return im.crop(b) if b else im


def do_pickups():
    cuts = [chroma(n) for n in PICKUPS if have(n)]
    if not cuts:
        return []
    subprocess.run([PY, os.path.join(ROOT, "tools/gen_pickup_sheets.py"), *cuts,
                    "--out", OUT, "--cell", "64", "--frames", "4",
                    "--style", "both"], check=True)
    return [os.path.splitext(os.path.basename(c))[0] for c in cuts]


def do_single(name, size):
    """1 frame carree : crop contenu -> fit dans (size-pad) -> centre dans size."""
    cut = chroma(name)
    im = cropped(cut)
    pad = max(2, round(size * 0.04))
    avail = size - 2 * pad
    s = avail / max(im.size)
    nw, nh = max(1, round(im.width * s)), max(1, round(im.height * s))
    im = im.resize((nw, nh), Image.LANCZOS)
    cv = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cv.alpha_composite(im, ((size - nw) // 2, (size - nh) // 2))
    cv.save(os.path.join(OUT, name + ".png"))
    return name


def do_quake():
    """Re-grille la bande generee en 6 frames egales 96x48 (ancre bas).

    Le raw est une bande horizontale de 6 vignettes sur fond magenta. On
    detoure, on decoupe en 6 parts EGALES en largeur, puis chaque part est
    posee dans une cellule 96x48 ancree en bas (l'onde de choc tient au sol).
    """
    cut = chroma(QUAKE)
    im = Image.open(cut).convert("RGBA")
    W, H = im.size
    seg = W / QUAKE_N
    sheet = Image.new("RGBA", (QUAKE_FW * QUAKE_N, QUAKE_FH), (0, 0, 0, 0))
    for i in range(QUAKE_N):
        x0, x1 = round(i * seg), round((i + 1) * seg)
        part = im.crop((x0, 0, x1, H))
        b = part.getbbox()
        if b:
            part = part.crop(b)
        if part.width == 0 or part.height == 0:
            continue
        # fit dans la cellule en gardant l'aspect, ancre bas-centre
        s = min((QUAKE_FW - 4) / part.width, (QUAKE_FH - 2) / part.height)
        nw, nh = max(1, round(part.width * s)), max(1, round(part.height * s))
        part = part.resize((nw, nh), Image.LANCZOS)
        cx = i * QUAKE_FW + QUAKE_FW // 2
        x = round(cx - nw / 2)
        y = QUAKE_FH - nh           # ancre bas
        sheet.alpha_composite(part, (x, y))
    sheet.save(os.path.join(OUT, QUAKE + ".png"))
    return QUAKE


def main():
    os.makedirs(CUT, exist_ok=True)
    done = []
    done += do_pickups()
    for name, size in SINGLES.items():
        if have(name):
            done.append(do_single(name, size))
    if have(QUAKE):
        done.append(do_quake())
    print("OK v2:", ", ".join(done) if done else "(aucun raw a traiter)")
    print("-> python3 gen_assets_data.py pour reembarquer")


if __name__ == "__main__":
    main()
