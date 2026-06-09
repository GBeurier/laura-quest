#!/usr/bin/env python3
"""raw magenta -> assets finales. Detoure (chroma-key) puis fabrique chaque
planche selon son groupe. Idempotent : ne traite que les raw/ presents.

  pickups (13) : bump 4 frames, cellule 64
  shots   (7)  : icone statique 1 frame, cellule 40 (projectiles, hitbox inchangee)
  fx_tear      : icone statique 1 frame, cellule 56
  fx_grumble   : 3 frames "throb" (squash, pas de bob), cellule 104
  heart        : 2 frames PLEIN(0)/VIDE(1) assembles depuis heart_full/heart_empty
"""
import os
import subprocess
import sys

from PIL import Image, ImageFilter

ROOT = "/home/delete/laura_quest"
RAW = os.path.join(ROOT, "_icongen/raw")
CUT = os.path.join(ROOT, "_icongen/cut")
OUT = os.path.join(ROOT, "assets/sprites")
RCK = "/home/delete/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py"
GEN = os.path.join(ROOT, "tools/gen_pickup_sheets.py")

PICKUPS = ["pickup_sunray", "pickup_cafe", "pickup_data", "pickup_page",
           "pickup_publi", "pickup_croquette", "pickup_rollers", "pickup_velo",
           "pickup_graine", "pickup_plant", "pickup_chart", "pickup_barchart",
           "pickup_sheet", "pickup_pilule", "pickup_champignon"]
SHOTS = ["shot_paper", "shot_stake", "shot_fork", "shot_chart", "shot_error",
         "shot_form", "shot_gavel"]


def have(name):
    return os.path.exists(os.path.join(RAW, name + ".png"))


def key(name):
    """raw/name.png -> cut/name.png (fond magenta -> alpha)."""
    src, dst = os.path.join(RAW, name + ".png"), os.path.join(CUT, name + ".png")
    subprocess.run([sys.executable, RCK, "--input", src, "--out", dst,
                    "--auto-key", "border", "--soft-matte",
                    "--transparent-threshold", "14", "--opaque-threshold", "210",
                    "--despill", "--force"], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return dst


def gen(cut_paths, cell, frames, style="both", extra=None):
    cmd = [sys.executable, GEN, *cut_paths, "--out", OUT,
           "--cell", str(cell), "--frames", str(frames), "--style", style]
    if extra:
        cmd += extra
    subprocess.run(cmd, check=True)


def fit_square(im, cell, fill=0.86):
    """Trim alpha + resize (aspect garde) + centre dans une cellule carree."""
    b = im.getbbox()
    if b:
        im = im.crop(b)
    w, h = im.size
    s = (fill * cell) / max(w, h)
    im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    cv = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
    cv.alpha_composite(im, ((cell - im.width) // 2, (cell - im.height) // 2))
    return cv


def embellish(icon, outline=3, outline_col=(26, 18, 14), glow=6,
              glow_col=(255, 244, 214), glow_op=205):
    """Ajoute un CONTOUR sombre epais + un HALO lumineux autour de l'icone, pour
    qu'un petit projectile ressorte sur n'importe quel fond (contour = pop sur
    fond clair ; halo = pop sur fond sombre). Rend une RGBA agrandie."""
    pad = outline + glow + 2
    base = Image.new("RGBA", (icon.width + 2 * pad, icon.height + 2 * pad), (0, 0, 0, 0))
    base.alpha_composite(icon, (pad, pad))
    a = base.getchannel("A")
    out = Image.new("RGBA", base.size, (0, 0, 0, 0))
    if glow > 0:  # halo lumineux (dilate + flou), derriere tout
        ga = a.filter(ImageFilter.MaxFilter(2 * (outline + glow) + 1)) \
              .filter(ImageFilter.GaussianBlur(glow * 0.8))
        gl = Image.new("RGBA", base.size, glow_col + (0,))
        gl.putalpha(ga.point(lambda v: int(v * glow_op / 255)))
        out.alpha_composite(gl)
    if outline > 0:  # contour sombre epais (dilate l'alpha)
        oa = a.filter(ImageFilter.MaxFilter(2 * outline + 1))
        ol = Image.new("RGBA", base.size, outline_col + (0,))
        ol.putalpha(oa)
        out.alpha_composite(ol)
    out.alpha_composite(base)  # icone par-dessus
    return out


def build_shots(core=42, cell=64):
    """shot_* : projectiles repenses. Objet redimensionne (cote long = core),
    contour+halo (embellish) pour le contraste, centre dans une cellule cell.
    Plus GROS et plus CONTRASTE que la 1re version (cell 40, sans contour)."""
    for n in SHOTS:
        if not have(n):
            continue
        im = Image.open(key(n)).convert("RGBA")
        b = im.getbbox()
        if b:
            im = im.crop(b)
        s = core / max(im.size)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))),
                       Image.LANCZOS)
        emb = embellish(im)
        cv = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
        cv.alpha_composite(emb, ((cell - emb.width) // 2, (cell - emb.height) // 2))
        cv.save(os.path.join(OUT, n + ".png"))
        print(f"  {n} -> {OUT}/{n}.png ({cell}x{cell}, contour+halo)")


def build_heart(cell=56):
    """heart_full(0) + heart_empty(1) -> assets/sprites/heart.png (2 frames)."""
    if not (have("heart_full") and have("heart_empty")):
        print("  heart: raw manquant, saute"); return
    full = fit_square(Image.open(key("heart_full")).convert("RGBA"), cell)
    empty = fit_square(Image.open(key("heart_empty")).convert("RGBA"), cell)
    sheet = Image.new("RGBA", (cell * 2, cell), (0, 0, 0, 0))
    sheet.alpha_composite(full, (0, 0))
    sheet.alpha_composite(empty, (cell, 0))
    sheet.save(os.path.join(OUT, "heart.png"))
    print(f"  heart -> {OUT}/heart.png ({sheet.width}x{sheet.height}, 2 frames)")


def build_skull(cell=56):
    """skull (raw magenta) -> assets/sprites/skull.png : icone HUD statique 1
    frame, detouree + centree dans une cellule carree (meme gabarit que le
    coeur, pour s'aligner a cote des coeurs en haut a gauche)."""
    if not have("skull"):
        print("  skull: raw manquant, saute"); return
    im = fit_square(Image.open(key("skull")).convert("RGBA"), cell, fill=0.84)
    im.save(os.path.join(OUT, "skull.png"))
    print(f"  skull -> {OUT}/skull.png ({im.width}x{im.height}, 1 frame)")


def main():
    os.makedirs(CUT, exist_ok=True)
    # pickups : bump 4f cell 64
    pk = [key(n) for n in PICKUPS if have(n)]
    if pk:
        print(f"[pickups] {len(pk)}"); gen(pk, 64, 4)
    # shots : statiques, repenses (plus gros + contour sombre + halo lumineux)
    if any(have(n) for n in SHOTS):
        print("[shots] embellish"); build_shots()
    # fx_tear : statique 1f cell 56
    if have("fx_tear"):
        print("[fx_tear]"); gen([key("fx_tear")], 56, 1)
    # fx_grumble : 3f throb cell 104
    if have("fx_grumble"):
        print("[fx_grumble]"); gen([key("fx_grumble")], 104, 3, style="squash")
    # heart : 2f plein/vide
    print("[heart]"); build_heart()
    # skull : compteur HUD "tete de mort" (statique 1f)
    print("[skull]"); build_skull()
    print("OK. Pense a: python3 gen_assets_data.py")


if __name__ == "__main__":
    main()
