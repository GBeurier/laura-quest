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
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, "assets", "sprites")


# SECURITE : ne JAMAIS ecraser un asset existant (placeholder OU vrai PNG). Ce
#  script ne fait que COMBLER les manquants. Mets FORCE=1 (env) pour regenerer
#  malgre tout, ou supprime le PNG cible a la main avant de relancer.
FORCE = os.environ.get("FORCE") == "1"


def _exists(name):
    return os.path.exists(os.path.join(SPR, name + ".png"))


def _save(im, name):
    if _exists(name) and not FORCE:
        print("  skip    ", name, "(existe deja -> non ecrase)")
        return
    im.save(os.path.join(SPR, name + ".png"))


def _font(size):
    for path in ("DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


F_TAG = _font(14)


def _ctext(d, cx, y, s, fill, font=F_TAG):
    w = d.textlength(s, font=font)
    d.text((cx - w / 2, y), s, font=font, fill=fill)


def _lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


# --- 1) Variantes par decalage de teinte (preserve alpha + decoupage) -------
def hue_variant(base, out, deg, sat=1.0, val=1.0):
    if _exists(out) and not FORCE:
        print("  skip    ", out, "(existe deja -> non ecrase)")
        return
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
    if _exists(out) and not FORCE:
        print("  skip    ", out, "(existe deja -> non ecrase)")
        return
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


# --- 5) Feuille MONSTRE placeholder : 6 frames walk(0-2)/hurt(3)/attack(4-5) ---
#  Boite coloree + yeux ; bob/jambes alternes (walk), rouge + X (hurt), penche +
#  '!' (attack) -> l'anim est VISIBLE en validation. Ancre 'bot' (pieds en bas).
def monster_sheet(name, col, label):
    CW, CH, N = 128, 128, 6
    edge = _lerp(col, (0, 0, 0), 0.45)
    sh = Image.new("RGBA", (CW * N, CH), (0, 0, 0, 0))
    for i in range(N):
        fr = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
        d = ImageDraw.Draw(fr, "RGBA")
        c, lean, bob = col, 0, (-6 if i in (0, 2) else 0)
        if i == 3:                                   # hurt
            c, lean = _lerp(col, (220, 40, 40), 0.55), -10
        elif i >= 4:                                 # attack
            c, lean = _lerp(col, (255, 255, 255), 0.18), 9
        cx = CW // 2 + lean
        bw, bh = 70, 78
        by1 = CH - 12                                # baseline pieds
        by0 = by1 - bh + bob
        d.rounded_rectangle([cx - bw // 2, by0, cx + bw // 2, by1], radius=16, fill=c, outline=edge, width=3)
        ey = by0 + 26
        for s in (-1, 1):
            ex = cx + s * 16
            if i == 3:                               # yeux en X
                d.line([ex - 7, ey - 7, ex + 7, ey + 7], fill=(40, 30, 30), width=3)
                d.line([ex - 7, ey + 7, ex + 7, ey - 7], fill=(40, 30, 30), width=3)
            else:
                d.ellipse([ex - 9, ey - 9, ex + 9, ey + 9], fill=(255, 255, 255), outline=edge, width=2)
                d.ellipse([ex - 3, ey - 3, ex + 5, ey + 5], fill=(30, 30, 40))
        if i < 3:                                    # jambes alternees (walk)
            off = (8 if i == 0 else (-8 if i == 2 else 0))
            for dx in (12 + off, -12 - off):
                d.rectangle([cx + dx - 6, by1 - 2, cx + dx + 6, by1 + 8], fill=edge)
        if i >= 4:                                   # marqueur d'attaque
            _ctext(d, cx + bw // 2 + 10, by0 + 4, "!", (250, 220, 60), _font(26))
        _ctext(d, CW // 2, 5, label, (255, 255, 255, 185))
        sh.paste(fr, (i * CW, 0), fr)
    _save(sh, name)
    print("  monstre ", name, "(6 frames)")


# --- 6) Etagere (cap) : meme parallelogramme que le panneau, garni d'objets ---
#  kind='books' = tranches de livres verticales ; kind='biblo' = bibelots varies.
def shelf_cap(name, plank_col, kind):
    W, H = 144, 88
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im, "RGBA")
    bl, br, fr_, fl = (2, 24), (98, 24), (120, 60), (24, 60)
    d.polygon([bl, br, fr_, fl], fill=plank_col + (255,))                       # planche
    d.line([bl, br], fill=_lerp(plank_col, (255, 255, 255), 0.5) + (255,), width=3)
    d.polygon([fl, fr_, (fr_[0], fr_[1] + 14), (fl[0], fl[1] + 14)],
              fill=_lerp(plank_col, (0, 0, 0), 0.3) + (255,))                   # chant avant
    cols = [(196, 64, 60), (60, 120, 196), (84, 168, 96), (224, 176, 64), (150, 96, 178), (90, 170, 170)]
    if kind == "books":                                                        # tranches de livres
        for j in range(7):
            x = 18 + j * 14
            col = cols[j % len(cols)]
            d.rectangle([x, 2, x + 10, 26], fill=col, outline=(30, 24, 20))
            d.line([(x, 7), (x + 10, 7)], fill=_lerp(col, (255, 255, 255), 0.5), width=1)
    else:                                                                      # bibelots (vase/cadre/plante)
        d.rectangle([22, 6, 40, 26], fill=(60, 120, 196), outline=(30, 24, 20))  # cadre
        d.ellipse([54, 4, 74, 26], fill=(208, 150, 120), outline=(30, 24, 20))   # vase
        d.rectangle([88, 10, 100, 26], fill=(140, 96, 60), outline=(30, 24, 20))  # pot
        d.ellipse([84, 0, 104, 16], fill=(84, 168, 96))                          # plante
    _save(im, name)
    print("  etagere ", name)


def wood_leg(name):                                                            # pied/support bois
    W, H = 96, 48
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im, "RGBA")
    wood, hi, dk = (140, 96, 56), (176, 130, 84), (96, 62, 34)
    for px in (24, 60):
        d.rectangle([px, 0, px + 12, H], fill=wood + (255,))
        d.rectangle([px, 0, px + 3, H], fill=hi + (255,))
        d.rectangle([px + 9, 0, px + 12, H], fill=dk + (255,))
    _save(im, name)
    print("  pied    ", name)


# --- 7) Fond INTERIEUR (band tileable) : placeholder pour l'appart -----------
def bg_appart(name):
    W, H = 1024, 420
    arr = _vgrad(W, H, (224, 206, 198), (206, 184, 178))                        # mur creme/rose
    im = Image.fromarray(arr, "RGB").convert("RGBA")
    d = ImageDraw.Draw(im, "RGBA")
    for x in range(0, W, 64):                                                  # lambris vertical
        d.line([(x, 0), (x, H)], fill=(180, 156, 150, 80), width=2)
    for x in range(96, W, 256):                                                # cadres au mur (repete -> tileable)
        d.rectangle([x, 60, x + 90, 170], fill=(150, 120, 96, 120), outline=(110, 84, 64, 160), width=3)
        d.rectangle([x + 150, 90, x + 220, 200], fill=(120, 150, 170, 110), outline=(90, 110, 130, 150), width=3)
    d.rectangle([0, H - 56, W, H], fill=(150, 110, 78, 255))                    # plinthe / parquet
    d.line([(0, H - 56), (W, H - 56)], fill=(110, 80, 56, 255), width=4)
    _save(im, name)
    print("  bg      ", name, "(interieur appart, placeholder)")


# --- 8) Pickup placeholder : 4 frames (idle bump) ----------------------------
def pickup_bump(name, drawfn):
    CW, CH, N = 96, 96, 4
    sh = Image.new("RGBA", (CW * N, CH), (0, 0, 0, 0))
    for i in range(N):
        fr = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
        d = ImageDraw.Draw(fr, "RGBA")
        drawfn(d, CW // 2, CH // 2 + (-3 if i in (1, 3) else 0))
        sh.paste(fr, (i * CW, 0), fr)
    _save(sh, name)
    print("  pickup  ", name, "(4 frames)")


def _draw_pilule(d, cx, cy):
    d.rounded_rectangle([cx - 26, cy - 12, cx + 26, cy + 12], radius=12, fill=(232, 232, 240), outline=(40, 40, 60), width=3)
    d.rounded_rectangle([cx - 26, cy - 12, cx, cy + 12], radius=12, fill=(228, 92, 96), outline=(40, 40, 60), width=3)
    d.line([(cx, cy - 12), (cx, cy + 12)], fill=(40, 40, 60), width=2)
    d.ellipse([cx + 8, cy - 8, cx + 16, cy], fill=(255, 255, 255, 180))


def _draw_champi(d, cx, cy):
    d.rectangle([cx - 9, cy, cx + 9, cy + 26], fill=(238, 226, 200), outline=(120, 96, 70), width=2)   # pied
    d.pieslice([cx - 28, cy - 26, cx + 28, cy + 18], 180, 360, fill=(206, 60, 56), outline=(120, 30, 28))  # chapeau
    for dx, dy in ((-14, -10), (10, -8), (-2, -16), (16, -2)):
        d.ellipse([cx + dx - 5, cy + dy - 5, cx + dx + 5, cy + dy + 5], fill=(250, 244, 230))           # points


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

    # NB: plus de variantes enemy_*2 (les monstres ont desormais UNE feuille 6
    #  frames chacun, comme corbeau). tile_soil2/tile_panel2 restent des vrais
    #  assets (le guard skip-if-exists les protege).
    print("Variantes de tuiles (skip si deja presentes) :")
    hue_variant("tile_soil",      "tile_soil2",       28, sat=1.1)
    hue_variant("tile_panel",     "tile_panel2",      70)   # derive du nouveau cap

    print("Etageres (caps + pied bois) + fond interieur :")
    shelf_cap("tile_shelf_biblo", (176, 134, 92), "biblo")   # appart : bibelots
    shelf_cap("tile_shelf_books", (150, 110, 74), "books")   # labo / universite : livres
    wood_leg("shelf_leg")
    bg_appart("bg_appart")

    print("Pickups manquants (pilule / champignon) :")
    pickup_bump("pickup_pilule", _draw_pilule)
    pickup_bump("pickup_champignon", _draw_champi)

    print("Feuilles MONSTRES placeholder (6 frames walk/hurt/attack) :")
    #  (caillou/camion/criquet/ademe/assureur restent en 2 frames -> regeneres en phase art)
    MONSTERS = {
        # regeneres (ex-mockups 2 frames) : memes feuilles 6 frames que les neufs
        "enemy_caillou":      ((128, 122, 110), "CAILL"),
        "enemy_camion":       ((176, 72, 60),   "TRACT"),
        "enemy_criquet":      ((120, 176, 80),  "CRIQ"),
        "enemy_ademe":        ((206, 192, 150), "ADEME"),
        "enemy_assureur":     ((70, 86, 130),   "ASSUR"),
        # nouveaux
        "enemy_moustique":    ((118, 158, 182), "MOUST"),
        "enemy_abeille":      ((232, 200, 64),  "ABEIL"),
        "enemy_cafard":       ((96, 74, 60),    "CAFAR"),
        "enemy_transpalette": ((222, 122, 44),  "TRANS"),
        "enemy_livreur":      ((80, 150, 200),  "LIVR"),
        "enemy_coursier":     ((150, 92, 172),  "COURS"),
        "enemy_imprimante":   ((176, 182, 190), "IMPRI"),
        "enemy_chips":        ((222, 182, 84),  "CHIPS"),
        "enemy_tuyau":        ((92, 182, 152),  "TUYAU"),
        "enemy_sac":          ((150, 112, 72),  "SAC"),
        "enemy_fontaine":     ((120, 200, 220), "FONT"),
        "enemy_dossiers":     ((202, 172, 112), "DOSS"),
    }
    for nm, (col, lab) in MONSTERS.items():
        monster_sheet(nm, col, lab)

    print("OK. Lance maintenant : python3 gen_assets_data.py")


if __name__ == "__main__":
    main()
