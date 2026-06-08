"""Genere les assets PLACEHOLDER de la nouvelle narration.

  A) 5 collectibles animes (feuille 4 frames, 64x64/frame -> 256x64), fond
     transparent, style aligne sur pickup_data / pickup_page (cadre arrondi
     marron, panneau interieur clair, icone coloree, leger flottement/teinte) :
       pickup_graine, pickup_plant, pickup_chart, pickup_barchart, pickup_sheet
  B) 3 fonds interieurs (bandeaux tileables en X, 960x480, ancre bas) :
       bg_serre, bg_labo, bg_couloir
     960x480 (comme bg_mountains) : assez hauts pour DEPASSER au-dessus du sol
     du jeu. Les elements identifiables sont dans les DEUX TIERS SUPERIEURS ;
     le tiers du bas est un soubassement neutre (en partie masque par le sol).

Tout en px REELS = 2x l'affichage (cf. CONFIG.art.scale = 2).

Usage :
    python3 tools/gen_narration_assets.py
    python3 gen_assets_data.py        # OBLIGATOIRE ensuite (re-embarque)
"""
import math
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, "assets", "sprites")

# Palette commune des cadres de pickup (cf. pickup_data / pickup_page)
OUTLINE = (58, 40, 32)       # marron fonce du contour
PANEL = (244, 242, 236)      # panneau interieur clair


def _rrect(d, box, r, fill, outline=None, ow=0):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=ow)


def pickup_frame(size, draw_icon, t):
    """Une frame de pickup : cadre arrondi + panneau clair + icone.
    `t` in [0,1) -> flottement vertical + leger pulse de teinte. `draw_icon`
    recoit (draw, x0, y0, w, h, glow) ou (x0,y0)=coin du panneau interieur."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im, "RGBA")
    # flottement : +/- 2 px vertical (sur 64) au gre des 4 frames
    bob = round(2 * math.sin(2 * math.pi * t))
    pad = 6
    box = [pad, pad + bob, size - pad, size - pad + bob]
    # ombre douce du cadre
    _rrect(d, [box[0] + 2, box[1] + 3, box[2] + 2, box[3] + 3], 14,
           (0, 0, 0, 60))
    # cadre marron
    _rrect(d, box, 14, OUTLINE + (255,))
    # panneau interieur clair
    inb = [box[0] + 6, box[1] + 6, box[2] - 6, box[3] - 6]
    _rrect(d, inb, 9, PANEL + (255,))
    # pulse de luminosite de l'icone (0 -> 1 -> 0)
    glow = 0.5 + 0.5 * math.sin(2 * math.pi * t)
    draw_icon(d, inb[0], inb[1], inb[2] - inb[0], inb[3] - inb[1], glow)
    return im


def _mix(c, other, k):
    return tuple(int(c[i] + (other[i] - c[i]) * k) for i in range(3))


# --- Icones (dessinees dans le panneau interieur w x h depuis (x0,y0)) -------
def icon_graine(d, x0, y0, w, h, glow):
    """Une graine de riz : ovale ocre/beige, pointu, avec un sillon."""
    base = _mix((214, 176, 110), (240, 214, 150), glow)
    cx, cy = x0 + w / 2, y0 + h / 2
    rw, rh = w * 0.22, h * 0.42
    # grain incline
    d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh],
              fill=base + (255,), outline=(150, 112, 56, 255), width=2)
    # sillon central
    d.line([(cx, cy - rh + 4), (cx, cy + rh - 4)], fill=(168, 130, 70, 255),
           width=2)
    # reflet
    d.ellipse([cx - rw + 3, cy - rh + 4, cx - rw + 9, cy - rh + 14],
              fill=(255, 248, 224, 200))


def icon_plant(d, x0, y0, w, h, glow):
    """Jeune pousse de riz : tige verte + 2-3 feuilles, petit pot/terre."""
    green = _mix((84, 168, 78), (120, 206, 110), glow)
    dark = (52, 120, 56)
    cx = x0 + w / 2
    base_y = y0 + h * 0.82
    # terre / mini-butte
    d.ellipse([cx - w * 0.26, base_y - 5, cx + w * 0.26, base_y + 8],
              fill=(120, 84, 58, 255))
    # tige
    d.line([(cx, base_y), (cx, y0 + h * 0.30)], fill=dark + (255,), width=3)
    # feuilles (courbes simples via polygones)
    d.polygon([(cx, y0 + h * 0.55), (cx - w * 0.30, y0 + h * 0.34),
               (cx - 2, y0 + h * 0.40)], fill=green + (255,))
    d.polygon([(cx, y0 + h * 0.48), (cx + w * 0.30, y0 + h * 0.26),
               (cx + 2, y0 + h * 0.34)], fill=green + (255,))
    d.polygon([(cx, y0 + h * 0.40), (cx - w * 0.18, y0 + h * 0.18),
               (cx + 1, y0 + h * 0.24)], fill=dark + (255,))


def icon_chart(d, x0, y0, w, h, glow):
    """Line chart : axes + ligne montante (verte) + points."""
    ax = x0 + w * 0.18
    ay = y0 + h * 0.82
    aw = w * 0.66
    ah = h * 0.62
    # axes
    d.line([(ax, y0 + h * 0.16), (ax, ay)], fill=OUTLINE + (255,), width=3)
    d.line([(ax, ay), (ax + aw, ay)], fill=OUTLINE + (255,), width=3)
    # ligne montante
    line_col = _mix((40, 140, 220), (90, 190, 255), glow)
    pts = [
        (ax + aw * 0.04, ay - ah * 0.18),
        (ax + aw * 0.30, ay - ah * 0.42),
        (ax + aw * 0.55, ay - ah * 0.34),
        (ax + aw * 0.80, ay - ah * 0.80),
        (ax + aw * 0.98, ay - ah * 0.92),
    ]
    d.line(pts, fill=line_col + (255,), width=3, joint="curve")
    for px, py in pts:
        d.ellipse([px - 3, py - 3, px + 3, py + 3], fill=(220, 60, 70, 255))


def icon_barchart(d, x0, y0, w, h, glow):
    """Histogramme : 4 barres verticales de hauteurs differentes + axe."""
    ax = x0 + w * 0.16
    ay = y0 + h * 0.82
    aw = w * 0.70
    ah = h * 0.60
    d.line([(ax, y0 + h * 0.16), (ax, ay)], fill=OUTLINE + (255,), width=3)
    d.line([(ax, ay), (ax + aw, ay)], fill=OUTLINE + (255,), width=3)
    heights = [0.40, 0.62, 0.50, 0.86]
    cols = [(232, 96, 96), (96, 184, 232), (120, 200, 110), (244, 188, 80)]
    n = len(heights)
    slot = aw / (n + 0.5)
    bw = slot * 0.62
    for i, (hh, col) in enumerate(zip(heights, cols)):
        bx = ax + slot * (i + 0.4)
        top = ay - ah * hh
        col = _mix(col, (255, 255, 255), glow * 0.25)
        d.rectangle([bx, top, bx + bw, ay - 1],
                    fill=col + (255,), outline=OUTLINE + (255,), width=1)


def icon_sheet(d, x0, y0, w, h, glow):
    """Feuille / page de these : feuille blanche, coin plie, lignes de texte."""
    pw = w * 0.56
    ph = h * 0.74
    px = x0 + (w - pw) / 2
    py = y0 + (h - ph) / 2
    fold = pw * 0.30
    paper = _mix((252, 252, 250), (255, 255, 255), glow * 0.4)
    # corps de la feuille (coin haut-droit plie)
    body = [
        (px, py), (px + pw - fold, py), (px + pw, py + fold),
        (px + pw, py + ph), (px, py + ph),
    ]
    d.polygon(body, fill=paper + (255,), outline=OUTLINE + (255,))
    # triangle du coin plie
    d.polygon([(px + pw - fold, py), (px + pw, py + fold),
               (px + pw - fold, py + fold)],
              fill=(214, 210, 200, 255), outline=OUTLINE + (255,))
    # lignes de texte
    lx0 = px + pw * 0.16
    lx1 = px + pw * 0.84
    for i in range(5):
        ly = py + ph * (0.34 + 0.13 * i)
        x1 = lx1 if i % 2 == 0 else lx0 + (lx1 - lx0) * 0.7
        d.line([(lx0, ly), (x1, ly)], fill=(150, 150, 156, 255), width=2)


PICKUPS = [
    ("pickup_graine", icon_graine),
    ("pickup_plant", icon_plant),
    ("pickup_chart", icon_chart),
    ("pickup_barchart", icon_barchart),
    ("pickup_sheet", icon_sheet),
]


def gen_pickups():
    print("Collectibles (256x64 = 4 x 64x64) :")
    for name, icon in PICKUPS:
        sheet = Image.new("RGBA", (256, 64), (0, 0, 0, 0))
        for f in range(4):
            fr = pickup_frame(64, icon, f / 4.0)
            sheet.paste(fr, (f * 64, 0), fr)
        sheet.save(os.path.join(SPR, name + ".png"))
        print("  pickup ", name, sheet.size)


# --- B) Fonds interieurs : bandeaux tileables (960x480), ancre bas -----------
# 960x480 = meme taille que bg_mountains (affiche 480/scale = 240 px). Le sol du
# jeu masque environ le tiers du bas -> on place tout l'identifiable en haut.
W, H = 960, 480


def _vgrad(top, bot):
    im = Image.new("RGBA", (W, H))
    px = im.load()
    for y in range(H):
        t = y / (H - 1)
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        for x in range(W):
            px[x, y] = c + (255,)
    return im


def bg_serre(name):
    """Serre : verrieres en arceaux (haut) + tables de culture a plants verts.

    Tout l'identifiable (arches de verre + plants) est dans les 2/3 hauts
    (y < ~320). Le bas est un soubassement de mur neutre.
    """
    im = _vgrad((198, 228, 198), (158, 206, 162))
    d = ImageDraw.Draw(im, "RGBA")
    glass = (208, 234, 212, 90)
    frame = (118, 150, 118, 235)
    P = 192  # periode -> 5 travees sur 960, raccord parfait (960 / 192 = 5)
    # poutre faitiere (tout en haut)
    d.rectangle([0, 18, W, 30], fill=(108, 140, 108, 255))
    for k in range(W // P + 1):
        cx = k * P + P // 2
        # grande arche de verriere (demi-ellipse), bien visible en haut
        d.arc([cx - P // 2, 24, cx + P // 2, 320], 180, 360,
              fill=frame, width=6)
        # vitres : grands panneaux verticaux sous l'arche
        for vx in range(cx - P // 2 + 26, cx + P // 2 - 12, 40):
            d.line([(vx, 40), (vx, 250)], fill=glass, width=20)
            d.line([(vx, 40), (vx, 250)], fill=(150, 178, 150, 70), width=2)
        # montant central de la travee
        d.line([(cx, 24), (cx, 250)], fill=frame, width=4)
        # croisillons horizontaux de la verriere
        for hy in (110, 180):
            d.line([(cx - P // 2 + 10, hy), (cx + P // 2 - 10, hy)],
                   fill=(140, 168, 140, 140), width=2)
    # tables de culture + plants verts (milieu, encore bien au-dessus du sol)
    for k in range(W // P + 1):
        cx = k * P + P // 2
        ty = 300
        # plateau de la table
        d.rectangle([cx - 82, ty, cx + 82, ty + 20],
                    fill=(142, 112, 78, 255), outline=(96, 72, 50, 255))
        # plants verts en rangee (au-dessus du plateau)
        for j in range(-3, 4):
            gx = cx + j * 22
            d.line([(gx, ty), (gx, ty - 26)], fill=(60, 130, 64, 255), width=3)
            d.ellipse([gx - 11, ty - 40, gx + 11, ty - 14],
                      fill=(88, 174, 82, 255))
            d.ellipse([gx - 6, ty - 50, gx + 6, ty - 30],
                      fill=(110, 196, 100, 255))
        # pieds de table qui descendent vers le bas
        d.rectangle([cx - 72, ty + 20, cx - 62, 420], fill=(110, 84, 58, 255))
        d.rectangle([cx + 62, ty + 20, cx + 72, 420], fill=(110, 84, 58, 255))
    # soubassement neutre (le tiers du bas, masque en partie par le sol du jeu)
    d.rectangle([0, 420, W, H], fill=(132, 176, 138, 255))
    im.save(os.path.join(SPR, name + ".png"))
    print("  bandeau", name, im.size)


def bg_labo(name):
    """Laboratoire : tons froids gris/bleu, etageres de fioles, paillasses,
    ecrans d'ordinateur. Etageres + ecrans dans les 2/3 hauts.
    """
    im = _vgrad((208, 216, 226), (172, 184, 200))
    d = ImageDraw.Draw(im, "RGBA")
    wall = (192, 202, 214, 255)
    d.rectangle([0, 0, W, 300], fill=wall)
    P = 160  # periode -> 6 travees sur 960, raccord parfait (960 / 160 = 6)
    # etageres de fioles en hauteur (deux niveaux, bien visibles)
    for shelf_y in (70, 150):
        d.rectangle([0, shelf_y, W, shelf_y + 7], fill=(148, 158, 170, 255))
        for k in range(W // 32 + 1):
            bx = k * 32 + 8
            col = [(120, 190, 210), (200, 170, 120), (180, 130, 190),
                   (150, 200, 150)][k % 4]
            # fiole : col + corps
            d.rectangle([bx, shelf_y - 30, bx + 14, shelf_y],
                        fill=col + (235,), outline=(88, 98, 110, 255))
            d.rectangle([bx + 4, shelf_y - 38, bx + 10, shelf_y - 30],
                        fill=(96, 106, 118, 255))
    # paillasses + ecrans d'ordinateur (periode P, milieu de l'image)
    for k in range(W // P + 1):
        cx = k * P + P // 2
        by = 300
        # paillasse (plan de travail)
        d.rectangle([cx - 78, by, cx + 78, by + 18],
                    fill=(178, 186, 198, 255), outline=(120, 130, 144, 255))
        # ecran d'ordi pose dessus (au-dessus de la paillasse)
        d.rectangle([cx - 46, by - 70, cx - 2, by - 24],
                    fill=(38, 54, 76, 255), outline=(22, 30, 44, 255), width=3)
        d.rectangle([cx - 40, by - 64, cx - 8, by - 30],
                    fill=(86, 158, 196, 255))
        # quelques lignes "de code" sur l'ecran
        for li in range(3):
            ly = by - 58 + li * 9
            d.line([(cx - 36, ly), (cx - 14, ly)], fill=(190, 220, 240, 220),
                   width=2)
        d.line([(cx - 24, by - 24), (cx - 24, by)], fill=(88, 98, 110, 255),
               width=4)
        d.rectangle([cx - 34, by, cx - 14, by + 3], fill=(110, 120, 134, 255))
        # becher / verrerie a cote
        d.polygon([(cx + 18, by - 4), (cx + 24, by - 40), (cx + 46, by - 40),
                   (cx + 52, by - 4)],
                  fill=(150, 202, 212, 190), outline=(108, 148, 158, 255))
        d.rectangle([cx + 24, by - 20, cx + 46, by - 4],
                    fill=(120, 192, 172, 210))
        # pied de paillasse vers le bas
        d.rectangle([cx - 72, by + 18, cx - 60, 420], fill=(150, 158, 170, 255))
        d.rectangle([cx + 60, by + 18, cx + 72, 420], fill=(150, 158, 170, 255))
    # soubassement neutre (tiers du bas, masque en partie par le sol du jeu)
    d.rectangle([0, 420, W, H], fill=(150, 160, 174, 255))
    im.save(os.path.join(SPR, name + ".png"))
    print("  bandeau", name, im.size)


def bg_couloir(name):
    """Couloir d'universite : neons au plafond, rangee de portes/casiers,
    sol carrele. Plafond + portes occupent les 2/3 hauts ; le sol carrele
    forme le tiers du bas (en partie masque par le sol du jeu).
    """
    im = _vgrad((228, 220, 200), (210, 200, 178))
    d = ImageDraw.Draw(im, "RGBA")
    P = 160  # periode -> 6 travees sur 960, raccord parfait (960 / 160 = 6)
    # plafond + neons (motif periodique, tout en haut)
    d.rectangle([0, 0, W, 40], fill=(216, 210, 194, 255))
    for k in range(W // P + 1):
        cx = k * P + P // 2
        d.rectangle([cx - 48, 14, cx + 48, 26], fill=(255, 252, 222, 255),
                    outline=(182, 178, 152, 255))
        # halo lumineux sous le neon
        d.rectangle([cx - 40, 26, cx + 40, 34], fill=(248, 244, 210, 120))
    # mur beige institutionnel
    d.rectangle([0, 40, W, 330], fill=(222, 212, 190, 255))
    # rangee de portes / casiers (periode P, du mur jusqu'au milieu)
    for k in range(W // P + 1):
        cx = k * P + P // 2
        dx0 = cx - 60
        dx1 = cx + 60
        # porte
        d.rectangle([dx0, 90, dx1, 324], fill=(168, 150, 120, 255),
                    outline=(120, 104, 80, 255), width=4)
        # cadre interieur (panneau)
        d.rectangle([dx0 + 12, 104, dx1 - 12, 312],
                    outline=(140, 124, 98, 255), width=3)
        # poignee
        d.ellipse([dx1 - 26, 200, dx1 - 16, 212], fill=(90, 78, 60, 255))
        # plaque numero en haut de la porte
        d.rectangle([cx - 20, 116, cx + 20, 136], fill=(238, 234, 222, 255),
                    outline=(150, 138, 112, 255))
    # plinthe au pied du mur
    d.rectangle([0, 324, W, 332], fill=(150, 138, 112, 255))
    # sol carrele (tiers du bas), carreaux periodiques
    floor_y = 332
    d.rectangle([0, floor_y, W, H], fill=(200, 190, 168, 255))
    tile = 64  # divise 960 -> raccord vertical sans couture
    # decale d'un demi-carreau : aucune ligne sur les bords (x=0 / x=959) ->
    # le motif raccorde parfaitement quand on tile (cf. verif de couture).
    for tx in range(tile // 2, W, tile):
        d.line([(tx, floor_y), (tx, H)], fill=(178, 168, 146, 255), width=2)
    for ty in range(floor_y, H + 1, 28):
        d.line([(0, ty), (W, ty)], fill=(178, 168, 146, 255), width=2)
    im.save(os.path.join(SPR, name + ".png"))
    print("  bandeau", name, im.size)


def gen_backgrounds():
    print("Fonds interieurs (bandeaux 960x480, tileables en X) :")
    bg_serre("bg_serre")
    bg_labo("bg_labo")
    bg_couloir("bg_couloir")


def main():
    import sys
    # Par defaut on ne regenere QUE les fonds (les 5 pickups sont deja faits).
    # Passe --all pour aussi regenerer les pickups.
    if "--all" in sys.argv:
        gen_pickups()
    gen_backgrounds()
    print("OK. Lance maintenant : python3 gen_assets_data.py")


if __name__ == "__main__":
    main()
