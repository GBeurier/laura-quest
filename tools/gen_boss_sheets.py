"""Genere des FEUILLES DE SPRITE PLACEHOLDER pour les boss : 2 feuilles / boss.

  boss_X_move.png  -> DEPLACEMENT : 4 frames (cycle de marche 0-1-2 + TOUCHE 3)
                      anims : idle {0->2 loop}, hurt {3}
  boss_X_atk.png   -> ATTAQUE     : 4 frames (charge -> frappe -> retour)
                      anims : attack {0->3 loop}

Chaque feuille = 992x280 = 4 frames de 248x280 (soit 124x140 a l'affichage, car
CONFIG.art.scale = 2). Memes dimensions/decoupage que les anciens boss -> il
suffit de remplacer le PNG par ton vrai pixel-art (meme nom, meme grille 1x4).

Les boss sont dessines POINTANT A GAUCHE (le jeu les flippe en X selon la
direction, cf. js/bosses.js) -> l'attaque s'etend vers la GAUCHE.

Usage :
    python3 tools/gen_boss_sheets.py
    python3 gen_assets_data.py        # OBLIGATOIRE ensuite (re-embarque)
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, "assets", "sprites")

FW, FH, N = 248, 280, 4          # 1 frame, en px reels (affichage = /2)
GROUND = 262                     # y des pieds dans la frame (anchor 'bot')
CX = FW // 2

# 1 couleur par boss (base, nom affiche) ----------------------------------
BOSSES = [
    ("boss_proprietaire", (158, 120, 86),  "PROPRIO"),
    ("boss_agriculteur",  (96, 156, 74),   "AGRI"),
    ("boss_michael",      (74, 116, 184),  "MICHAEL"),
    ("boss_rstudio",      (60, 162, 172),  "RSTUDIO"),
    ("boss_cendrine",     (156, 92, 164),  "CENDRINE"),
    ("boss_jury",         (176, 78, 86),   "JURY"),
]

HURT_COL = (210, 92, 92)         # teinte "touche"


def _font(size):
    for path in ("DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


F_TAG = _font(20)
F_SUB = _font(15)


def _mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _ctext(d, cx, y, s, font, fill):
    w = d.textlength(s, font=font)
    d.text((cx - w / 2, y), s, font=font, fill=fill)


# parametres de pose par (kind, frame) : bob vertical, decalage tete (lean),
# portee du bras avant (vers la gauche), ecart des jambes, etats hurt/strike.
def pose(kind, i):
    if kind == "move":
        return [
            dict(bob=0,  head=0,  arm=14, legs=26),                 # 0 contact
            dict(bob=-7, head=0,  arm=10, legs=4),                  # 1 passing (haut)
            dict(bob=0,  head=0,  arm=14, legs=-26),                # 2 contact inverse
            dict(bob=5,  head=12, arm=8,  legs=10, hurt=True),      # 3 TOUCHE
        ][i]
    return [                                                        # kind == "atk"
        dict(bob=-3, head=14, arm=-10, legs=8),                    # 0 charge (recul)
        dict(bob=0,  head=6,  arm=4,   legs=2),                    # 1 armement
        dict(bob=3,  head=-14, arm=78, legs=22, strike=True),     # 2 FRAPPE (avant)
        dict(bob=0,  head=-4, arm=34,  legs=6),                   # 3 retour
    ][i]


def draw_boss(d, col, p):
    bob = p["bob"]
    gy = GROUND + max(0, bob)            # les pieds descendent un peu si "sag"
    hurt = p.get("hurt")
    body = HURT_COL if hurt else col
    edge = _mix(body, (0, 0, 0), 0.42)
    lite = _mix(body, (255, 255, 255), 0.30)

    # jambes (2 blocs qui alternent autour de l'axe)
    sw = p["legs"]
    for dx in (-sw, sw):
        d.rounded_rectangle([CX + dx - 13, gy - 64 - bob, CX + dx + 13, gy],
                            radius=8, fill=edge)

    # bras ARRIERE (cote droit, court)
    d.line([(CX + 30, gy - 150 - bob), (CX + 48, gy - 96 - bob)], fill=edge, width=18)

    # torse
    d.rounded_rectangle([CX - 50, gy - 168 - bob, CX + 50, gy - 52 - bob],
                        radius=26, fill=body)
    d.rounded_rectangle([CX - 50, gy - 168 - bob, CX + 8, gy - 120 - bob],
                        radius=22, fill=lite)                       # reflet haut-gauche

    # tete (decalee par le "lean")
    hx, hy = CX + p["head"], gy - 200 - bob
    d.ellipse([hx - 40, hy - 40, hx + 40, hy + 40], fill=body, outline=edge, width=4)

    # yeux (pointe a gauche) ; X si touche
    ex, ey = hx - 16, hy - 4
    if hurt:
        for s in (-1, 1):
            cx = hx - 4 + s * 14
            d.line([(cx - 7, ey - 7), (cx + 7, ey + 7)], fill=edge, width=4)
            d.line([(cx - 7, ey + 7), (cx + 7, ey - 7)], fill=edge, width=4)
    else:
        for s in (0, 1):
            d.ellipse([ex - 7 - s * 22, ey - 9, ex + 7 - s * 22, ey + 9], fill=(255, 255, 255))
            d.ellipse([ex - 4 - s * 22, ey - 6, ex + 4 - s * 22, ey + 6], fill=(30, 30, 40))

    # bras AVANT (cote gauche) : s'etend de `arm` px vers la gauche -> attaque
    reach = p["arm"]
    sx, sy = CX - 34, gy - 150 - bob
    fx, fy = sx - max(8, reach), sy + (18 if reach > 40 else 30)
    d.line([(sx, sy), (fx, fy)], fill=body if not hurt else edge, width=20)
    d.ellipse([fx - 16, fy - 16, fx + 16, fy + 16], fill=lite, outline=edge, width=3)  # poing

    # etoile d'impact sur la frappe
    if p.get("strike"):
        ix, iy = fx - 22, fy
        for a in range(0, 360, 45):
            import math
            r1, r2 = 8, 26
            x1 = ix + r1 * math.cos(math.radians(a))
            y1 = iy + r1 * math.sin(math.radians(a))
            x2 = ix + r2 * math.cos(math.radians(a))
            y2 = iy + r2 * math.sin(math.radians(a))
            d.line([(x1, y1), (x2, y2)], fill=(255, 236, 120), width=5)


def sheet(base, col, label, kind):
    """Construit boss_X_move.png ou boss_X_atk.png (992x280, 1x4)."""
    sh = Image.new("RGBA", (FW * N, FH), (0, 0, 0, 0))
    sub = "DEPLACE" if kind == "move" else "ATTAQUE"
    names = (["MOVE 0", "MOVE 1", "MOVE 2", "TOUCHE"] if kind == "move"
             else ["ATK 0", "ATK 1", "FRAPPE", "ATK 3"])
    for i in range(N):
        fr = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        d = ImageDraw.Draw(fr, "RGBA")
        # cadre de cellule (repere de grille, discret) + bandeaux de texte
        d.rectangle([1, 1, FW - 2, FH - 2], outline=(255, 255, 255, 40), width=2)
        draw_boss(d, col, pose(kind, i))
        _ctext(d, CX, 8, label, F_TAG, _mix(col, (255, 255, 255), 0.2) + (255,))
        _ctext(d, CX, 30, sub, F_SUB, (255, 255, 255, 150))
        _ctext(d, CX, FH - 24, names[i], F_SUB, (255, 255, 255, 200))
        sh.paste(fr, (i * FW, 0), fr)
    sh.save(os.path.join(SPR, base + "_" + kind + ".png"))
    print("  %-22s 992x280 (4x %dx%d, affichage 124x140)" % (base + "_" + kind, FW, FH))


def main():
    print("Feuilles de sprite placeholder des boss (deplacement + attaque) :")
    for base, col, label in BOSSES:
        sheet(base, col, label, "move")
        sheet(base, col, label, "atk")
    print("OK. Lance maintenant : python3 gen_assets_data.py")


if __name__ == "__main__":
    main()
