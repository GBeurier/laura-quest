"""Genere des ASSETS PLACEHOLDER (simples, geometriques) pour le decor.

Familles :
  1) COUCHES de parallax tileables : bg_mountains, bg_hills.
  2) FONDS plein-ecran : bg_title (ecran-titre), bg_map (carte du monde).
  3) PANNEAU SOLAIRE en perspective : tile_panel (le "cap" sur lequel on marche,
     bord avant = ligne marchable) + panel_leg (les pieds, etires en Y par le
     jeu jusqu'au sol -> hauteur variable selon l'altitude de la plateforme).
     Le panneau est penche vers le soleil (haut-gauche) -> colineaire a l'ombre
     projetee (qui tombe en bas-droite, cf. SHADE_SLOPE dans game.js).
  4) VARIANTES par decalage de teinte : enemy_xxx2, tile_xxx2.

Tout est en px REELS = 2x l'affichage (cf. CONFIG.art.scale). Remplace
n'importe quel PNG par ton vrai asset (memes nom + dimensions) quand tu l'as.

Usage :
    python3 tools/gen_placeholders.py
    python3 gen_assets_data.py        # OBLIGATOIRE ensuite (re-embarque)
"""
import os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, "assets", "sprites")


def _save(im, name):
    im.save(os.path.join(SPR, name + ".png"))


def _lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


# --- 1) Variantes par decalage de teinte (preserve alpha + decoupage) -------
def hue_variant(base, out, deg, sat=1.0, val=1.0):
    im = Image.open(os.path.join(SPR, base + ".png")).convert("RGBA")
    r, g, b, a = im.split()
    H, S, V = Image.merge("RGB", (r, g, b)).convert("HSV").split()
    H = H.point(lambda h: int(h + deg / 360.0 * 255) % 256)
    S = S.point(lambda s: min(255, int(s * sat)))
    V = V.point(lambda v: min(255, int(v * val)))
    r2, g2, b2 = Image.merge("HSV", (H, S, V)).convert("RGB").split()
    Image.merge("RGBA", (r2, g2, b2, a)).save(os.path.join(SPR, out + ".png"))
    print("  variante", out, "(teinte", base, "+%d deg)" % deg)


# --- 1bis) Silhouette de fond TILEABLE (les bords se raccordent) ------------
def silhouette(out, w, h, base_h, waves, color, alpha=255, ridge=18):
    x = np.arange(w)
    prof = np.full(w, float(base_h))
    for n, amp, ph in waves:
        prof += amp * np.sin(2 * np.pi * n * x / w + ph)
    prof = np.clip(prof, 4, h - 1).astype(int)
    top = (h - prof)
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    rows = np.arange(h)[:, None]
    mask = rows >= top[None, :]
    arr[..., 0], arr[..., 1], arr[..., 2] = color
    arr[..., 3] = mask * alpha
    hi = (rows >= top[None, :]) & (rows < (top + ridge)[None, :])
    light = tuple(min(255, c + 38) for c in color)
    for i in range(3):
        arr[..., i] = np.where(hi, light[i], arr[..., i])
    Image.fromarray(arr, "RGBA").save(os.path.join(SPR, out + ".png"))
    print("  couche  ", out, "%dx%d (affichage %dx%d)" % (w, h, w // 2, h // 2))


# --- 3) Panneau solaire en perspective (cap) --------------------------------
#  Le bord AVANT (en bas du parallelogramme) = ligne marchable ; game.js l'aligne
#  sur le haut de la tuile. Le bord ARRIERE est decale a GAUCHE+HAUT (vers le
#  soleil) -> meme axe que l'ombre. La largeur du bord avant = 1 tuile (96 reels).
def panel_cap(name, top_col, bot_col, line_col):
    W, H = 144, 88
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im, "RGBA")
    bl, br, fr, fl = (2, 12), (98, 12), (120, 60), (24, 60)   # arr-G, arr-D, av-D, av-G
    d.polygon([bl, br, fr, fl], fill=top_col + (255,))         # face haute (marchable)

    def e(p, q, t):
        return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)
    for i in range(1, 4):                                     # cellules : lignes // cotes
        d.line([e(bl, br, i / 4), e(fl, fr, i / 4)], fill=line_col + (255,), width=2)
    d.line([e(bl, fl, 0.5), e(br, fr, 0.5)], fill=line_col + (255,), width=2)
    d.line([bl, br], fill=_lerp(top_col, (255, 255, 255), 0.55) + (255,), width=3)  # reflet
    d.polygon([fl, fr, (fr[0], fr[1] + 14), (fl[0], fl[1] + 14)], fill=bot_col + (255,))  # cadre avant
    _save(im, name)
    print("  panneau ", name)


# Pieds du panneau : 2 montants verticaux (constants en Y -> s'etirent net).
def panel_leg(name):
    W, H = 96, 48
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im, "RGBA")
    metal, hi, dk = (86, 92, 104), (124, 132, 146), (52, 56, 66)
    for px in (24, 60):
        d.rectangle([px, 0, px + 12, H], fill=metal + (255,))
        d.rectangle([px, 0, px + 3, H], fill=hi + (255,))
        d.rectangle([px + 9, 0, px + 12, H], fill=dk + (255,))
    _save(im, name)
    print("  pieds   ", name)


# --- 2) Fonds plein-ecran (1920x1056 = 960x528 a l'affichage) ---------------
def _vgrad(w, h, top, bot):
    t = (np.arange(h) / (h - 1))[:, None]
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    for i in range(3):
        arr[..., i] = (top[i] + (bot[i] - top[i]) * t).astype(np.uint8)
    return arr


def _hill_poly(d, w, h, base_y, amp, color, alpha):
    xs = np.arange(w)
    prof = base_y + amp * np.sin(2 * np.pi * 2 * xs / w) + amp * 0.4 * np.sin(2 * np.pi * 5 * xs / w + 1)
    pts = [(0, h)] + [(int(x), int(prof[x])) for x in range(0, w, 8)] + [(w, h)]
    d.polygon(pts, fill=color + (alpha,))


def bg_title(name):
    W, H = 1920, 1056
    im = Image.fromarray(_vgrad(W, H, (86, 150, 212), (178, 218, 240)), "RGB").convert("RGBA")
    d = ImageDraw.Draw(im, "RGBA")
    for r, al in [(280, 36), (200, 40), (130, 54)]:                 # lueur douce haut-gauche
        d.ellipse([320 - r, 180 - r, 320 + r, 180 + r], fill=(255, 246, 205, al))
    _hill_poly(d, W, H, 720, 64, (124, 174, 122), 200)             # collines lointaines
    _hill_poly(d, W, H, 824, 52, (96, 152, 86), 235)
    d.rectangle([0, 944, W, H], fill=(150, 112, 72, 255))          # sol
    d.rectangle([0, 944, W, 986], fill=(112, 172, 82, 255))        # herbe
    _save(im, name)
    print("  bg      ", name)


def bg_map(name):
    W, H = 1920, 1056
    im = Image.fromarray(_vgrad(W, H, (150, 192, 126), (124, 172, 106)), "RGB").convert("RGBA")
    d = ImageDraw.Draw(im, "RGBA")
    cs = 132                                                        # parcelles : 1/2 = riziere d'eau (bleu doux)
    for gx in range(0, W, cs):
        for gy in range(0, H, cs):
            if (gx // cs + gy // cs) % 2 == 0:
                d.rectangle([gx, gy, gx + cs, gy + cs], fill=(150, 196, 206, 30))
    for gx in range(0, W + 1, cs):                                  # diguettes (lignes douces)
        d.line([(gx, 0), (gx, H)], fill=(86, 124, 78, 30), width=2)
    for gy in range(0, H + 1, cs):
        d.line([(0, gy), (W, gy)], fill=(86, 124, 78, 30), width=2)
    ys = np.arange(0, H, 6)                                         # riviere douce
    pts = [(int(560 + 240 * np.sin(2 * np.pi * y / H * 1.25)), int(y)) for y in ys]
    d.line(pts, fill=(126, 184, 222, 90), width=42)
    d.line(pts, fill=(156, 208, 236, 90), width=18)
    _save(im, name)
    print("  bg      ", name)


def main():
    print("Panneau solaire en perspective + pieds :")
    panel_cap("tile_panel", (74, 120, 196), (40, 64, 120), (150, 196, 240))
    panel_leg("panel_leg")

    print("Fonds plein-ecran :")
    bg_title("bg_title")
    bg_map("bg_map")

    print("Couches de parallax (silhouettes tileables) :")
    silhouette("bg_mountains", 960, 480, base_h=300,
               waves=[(2, 78, 0.0), (5, 30, 1.1), (11, 13, 2.3)],
               color=(120, 140, 172), alpha=232, ridge=22)
    silhouette("bg_hills", 768, 300, base_h=150,
               waves=[(3, 42, 0.4), (7, 20, 2.0), (13, 9, 0.7)],
               color=(96, 152, 82), alpha=255, ridge=16)

    print("Variantes de monstres / tuiles :")
    hue_variant("enemy_criquet",  "enemy_criquet2",  120)
    hue_variant("enemy_corbeau",  "enemy_corbeau2",  205)
    hue_variant("enemy_assureur", "enemy_assureur2", 150)
    hue_variant("enemy_ademe",    "enemy_ademe2",     95)
    hue_variant("enemy_caillou",  "enemy_caillou2",   35, sat=0.8)
    hue_variant("enemy_camion",   "enemy_camion2",   210)
    hue_variant("tile_soil",      "tile_soil2",       28, sat=1.1)
    hue_variant("tile_panel",     "tile_panel2",      70)   # derive du nouveau cap

    print("OK. Lance maintenant : python3 gen_assets_data.py")


if __name__ == "__main__":
    main()
