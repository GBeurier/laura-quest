"""gen_tile_soil.py — Tuile de SOL : terre de riziere, tileable horizontalement."""
import math
import artkit as ak

W = H = 48
s, c = ak.new(W, H)

# --- 1) Fond : terre brune, remplit tout le carre -------------------------
c.rectangle(0, 0, W, H)
ak.set_hex(c, ak.SOIL)
c.fill()

# --- 2) Bande d'eau (reflet) juste sous le haut ---------------------------
# Bleu clair faible alpha, sur toute la largeur -> raccord parfait.
c.rectangle(0, 6, W, 7)
ak.set_hex(c, ak.TEAR, 0.30)
c.fill()
# Une fine ligne de reflet plus claire dans l'eau
c.rectangle(0, 7, W, 2)
ak.set_hex(c, ak.TEAR, 0.45)
c.fill()

# --- 3) Mottes de terre (ak.SOIL_D), placees pour boucler ----------------
# Helper : dessine une motte, et si elle deborde d'un bord, la duplique
# sur le bord oppose -> couture invisible.
def motte(cx, cy, rx, ry):
    for off in (0, -W, W):
        ak.ellipse(c, cx + off, cy, rx, ry)
        ak.set_hex(c, ak.SOIL_D)
        c.fill()

# Mottes reparties sous la bande d'eau
motte(8,  20, 6, 4)
motte(24, 17, 5, 3.5)
motte(38, 22, 6, 4)
motte(15, 30, 5, 3.5)
motte(32, 33, 6, 4)
# UNE seule motte qui chevauche la couture (centree sur le bord x=0/W).
# Dessinee a x=0 ET x=W, ses pixels gauche/droite sont identiques -> raccord.
motte(0,  39, 5, 3.5)
motte(22, 42, 6, 4)

# Petits points sombres (cailloux/grains) pour la texture
def speck(cx, cy, r):
    for off in (0, -W, W):
        ak.circle(c, cx + off, cy, r)
        ak.set_hex(c, ak.SOIL_D)
        c.fill()

for (sx, sy) in [(12, 24), (28, 26), (40, 30), (6, 32), (34, 38), (18, 36), (45, 24)]:
    speck(sx, sy, 1.2)

# --- 4) Trait de contour seulement sur le bord du HAUT -------------------
c.new_path()
c.move_to(0, 1.5)
c.line_to(W, 1.5)
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(3.0)
c.stroke()

# --- 5) Brins de riz qui depassent du bord HAUT --------------------------
# Lames vertes en forme de feuille, base ancree au bord haut, pointe en haut.
# Dessines APRES le contour pour passer par-dessus.
def brin(x0, tipx, tipy, col):
    # feuille (lame) : base large au sol -> pointe fine en haut
    c.new_path()
    c.move_to(x0 - 3, 5)
    c.curve_to(x0 - 2, 0, tipx - 1, tipy + 4, tipx, tipy)
    c.curve_to(tipx + 1, tipy + 4, x0 + 4, 0, x0 + 3, 5)
    c.close_path()
    ak.set_hex(c, col)
    c.fill_preserve()
    ak.set_hex(c, ak.OUTLINE)
    c.set_line_width(2.2)
    c.stroke()
    # nervure centrale
    c.new_path()
    c.move_to(x0, 5)
    c.curve_to((x0 + tipx) / 2, 1, tipx, tipy + 5, tipx, tipy + 1)
    ak.set_hex(c, ak.LEAF_D if col == ak.LEAF else ak.OUTLINE)
    c.set_line_width(1.3)
    c.stroke()

# Brins espaces, strictement a l'interieur (pas sur les bords L/R).
brin(11, 8,  -4, ak.LEAF)
brin(24, 22, -6, ak.LEAF_D)
brin(36, 40, -3, ak.LEAF)

ak.save(s, "tile_soil")
print("OK tile_soil")
