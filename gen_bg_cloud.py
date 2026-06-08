import artkit as ak
import math

W, H = 76, 42
s, c = ak.new(W, H)

OUT = ak.PANEL_HI  # contour leger demande

# --- Silhouette du nuage : un corps + bosses arrondies ---
# On construit une grosse forme molle avec plusieurs cercles fusionnes.
# D'abord on remplit tous les lobes (path unique) puis on contoure.

lobes = [
    (20, 26, 11),  # bosse gauche
    (33, 20, 14),  # grande bosse centre-gauche
    (50, 19, 13),  # grande bosse centre-droite
    (62, 25, 10),  # bosse droite
    (40, 28, 14),  # ventre bas
]

# Remplissage blanc de tous les lobes en un seul path
c.new_path()
for (cx, cy, r) in lobes:
    ak.circle(c, cx, cy, r)
# base plate du nuage
ak.rrect(c, 14, 26, 50, 11, 6)
ak.set_hex(c, ak.WHITE)
c.fill()

# Contour : on redessine le path pour le stroke exterieur seulement.
# Astuce simple : refaire les memes lobes, mais on ne stroke que le contour
# global -> on utilise une seconde passe avec un leger trait.
c.new_path()
for (cx, cy, r) in lobes:
    ak.circle(c, cx, cy, r)
ak.rrect(c, 14, 26, 50, 11, 6)
ak.set_hex(c, OUT)
c.set_line_width(3)
c.stroke()

# Re-remplir le blanc par dessus pour masquer les traits interieurs
c.new_path()
for (cx, cy, r) in lobes:
    ak.circle(c, cx, cy, r - 1.6)
ak.rrect(c, 15.5, 27.5, 47, 8, 5)
ak.set_hex(c, ak.WHITE)
c.fill()

# --- Mini bouille endormie ---
# Yeux fermes (deux arcs vers le bas) + petit sourire + joue rosee
def closed_eye(cx, cy, w):
    c.new_path()
    c.move_to(cx - w / 2, cy)
    c.curve_to(cx - w / 4, cy + 3.2, cx + w / 4, cy + 3.2, cx + w / 2, cy)
    ak.set_hex(c, OUT)
    c.set_line_width(2.4)
    c.stroke()

closed_eye(36, 22, 7)
closed_eye(50, 22, 7)

# joues rosees douces
for jx in (33, 53):
    ak.ellipse(c, jx, 26, 3.2, 2.2)
    ak.set_hex(c, ak.PINK, 0.55)
    c.fill()
    c.new_path()

# petit sourire paisible
c.new_path()
c.move_to(40, 28)
c.curve_to(42, 30.5, 47, 30.5, 49, 28)
ak.set_hex(c, OUT)
c.set_line_width(2.4)
c.stroke()

# --- Petits Z de sommeil ---
def zed(x, y, sz):
    c.new_path()
    c.move_to(x, y)
    c.line_to(x + sz, y)
    c.line_to(x, y + sz)
    c.line_to(x + sz, y + sz)
    ak.set_hex(c, OUT)
    c.set_line_width(2.0)
    c.stroke()

zed(63, 8, 4)
zed(68, 4, 3)

ak.save(s, "bg_cloud")
print("ok bg_cloud")
