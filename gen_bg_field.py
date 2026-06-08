"""Genere bg_field : decor de fond parallax, tileable horizontalement.
Bande basse de riziere verte + rangees de panneaux solaires en silhouette douce.
Le haut reste transparent (ciel dessine par le moteur)."""
import artkit as ak
import math

W, H = 320, 128
s, c = ak.new(W, H)

# ---------------------------------------------------------------------------
# 1) BANDE BASSE : RIZIERE VERTE (silhouette d'abord)
# ---------------------------------------------------------------------------
GROUND_TOP = 96
AMP = 4
PER = 80                 # W/PER = 4 cycles entiers => raccord parfait

def ground_top_y(x):
    return GROUND_TOP + AMP * math.sin(2 * math.pi * x / PER)

xs = list(range(0, W + 1, 4))

# Sol vert principal.
c.new_path()
c.move_to(0, ground_top_y(0))
for x in xs:
    c.line_to(x, ground_top_y(x))
c.line_to(W, H)
c.line_to(0, H)
c.close_path()
ak.draw(c, fill=ak.LEAF, ow=6)

# Bande d'eau/sillon plus sombre (texture riziere douce).
c.new_path()
c.move_to(0, ground_top_y(0) + 11)
for x in xs:
    c.line_to(x, ground_top_y(x) + 11)
c.line_to(W, H)
c.line_to(0, H)
c.close_path()
ak.set_hex(c, ak.LEAF_D)
c.fill()
c.new_path()

# Sillons de plants de riz (petits traits clairs verticaux).
ak.set_hex(c, ak.LEAF, 0.95)
c.set_line_width(2)
for x in range(8, W, 16):
    ty = ground_top_y(x) + 14
    c.move_to(x, ty)
    c.line_to(x, ty + 9)
c.stroke()
c.new_path()

# ---------------------------------------------------------------------------
# 2) PANNEAUX SOLAIRES inclines sur pieds (silhouette douce).
#    Dessine comme une dalle vue en perspective 3/4 : un dessus (top face)
#    et une tranche avant, posee sur deux jambes metal.
# ---------------------------------------------------------------------------
def solar_panel(cx, base_y, scale=1.0, alpha=1.0):
    pw = 44 * scale       # largeur projetee de la dalle
    depth = 8 * scale     # profondeur (la dalle s'enfonce vers le haut)
    rise = 13 * scale     # cote gauche releve (inclinaison)
    thick = 4 * scale     # epaisseur de la tranche avant
    leg_h = 16 * scale    # hauteur des pieds

    # Coins de la FACE SUPERIEURE (le verre incline).
    # Avant-gauche releve haut, avant-droit bas, fond decale vers le haut.
    bl = (cx - pw / 2, base_y - leg_h)                 # avant-gauche (haut, releve)
    br = (cx + pw / 2, base_y - leg_h + rise)          # avant-droit (plus bas)
    tr = (cx + pw / 2, base_y - leg_h + rise - depth)  # fond-droit
    tl = (cx - pw / 2, base_y - leg_h - depth)         # fond-gauche

    # --- Pieds metal (derriere). ---
    for lx in (cx - pw * 0.30, cx + pw * 0.30):
        ak.rrect(c, lx - 2.4 * scale, base_y - leg_h, 4.8 * scale, leg_h + 3, 2)
        ak.draw(c, fill=ak.METAL, ow=4 * scale, a=alpha)

    # --- Tranche avant (epaisseur, cote ombre PANEL fonce-ish via outline). ---
    ak.poly(c, [bl, br, (br[0], br[1] + thick), (bl[0], bl[1] + thick)])
    ak.draw(c, fill=ak.PANEL, ow=4 * scale, a=alpha)

    # --- Face superieure (le verre). ---
    ak.poly(c, [tl, tr, br, bl])
    ak.draw(c, fill=ak.PANEL_CELL, ow=5 * scale, a=alpha)

    # --- Grille de cellules sur la face superieure (lignes du quadrillage). ---
    # Verticales (3 divisions) interpolees entre bord gauche et droit.
    def lerp(p, q, t):
        return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)
    ak.set_hex(c, ak.PANEL, alpha)
    c.set_line_width(2 * scale)
    for i in range(1, 3):
        t = i / 3
        a = lerp(tl, tr, t)
        b = lerp(bl, br, t)
        c.move_to(*a); c.line_to(*b)
    # Horizontale (1 division) entre fond et avant.
    a = lerp(tl, bl, 0.5)
    b = lerp(tr, br, 0.5)
    c.move_to(*a); c.line_to(*b)
    c.stroke()
    c.new_path()

    # --- Reflet doux en haut-gauche du verre. ---
    g0 = tl
    g1 = lerp(tl, tr, 0.4)
    g2 = lerp(bl, br, 0.4)
    g3 = bl
    mid_top = lerp(g0, g1, 1.0)
    ak.poly(c, [g0, lerp(g0, g1, 0.55), lerp(g3, g2, 0.55), g3])
    ak.draw(c, fill=ak.PANEL_HI, outline=None, a=0.45 * alpha)

# Rangee LOINTAINE (petite, palotte) — profondeur, decalee d'un demi-pas.
# On va de -1 a 4 pour que les panneaux coupes par les bords gauche/droit
# se completent mutuellement (raccord parfait, PER divise W).
for k in range(-1, 5):
    cx = 40 + k * PER
    solar_panel(cx, base_y=ground_top_y(cx) - 4, scale=0.60, alpha=0.62)

# Rangee PROCHE (grande) posee sur la riziere.
for k in range(-1, 5):
    cx = 0 + k * PER
    solar_panel(cx, base_y=ground_top_y(cx) + 14, scale=1.0, alpha=1.0)

ak.save(s, "bg_field")
print("OK bg_field")
