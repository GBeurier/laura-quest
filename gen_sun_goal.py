"""Genere le sprite sun_goal (128x128) : gros soleil cartoon facon Dora, but du niveau."""
import math
import artkit as ak

W = H = 128
cx, cy = 64, 66
s, c = ak.new(W, H)

# --- Grands rayons triangulaires tout autour (derriere le disque, remplissent le canvas)
n_rays = 12
r_in = 42    # base des rayons (sur le disque)
r_out = 63   # pointe des rayons (proche du bord)
half = 0.24  # demi-largeur angulaire de la base (grosse base = rayons charnus)
for i in range(n_rays):
    ang = i * (2 * math.pi / n_rays) - math.pi / 2
    a1 = ang - half
    a2 = ang + half
    p_tip = (cx + math.cos(ang) * r_out, cy + math.sin(ang) * r_out)
    p_b1 = (cx + math.cos(a1) * r_in, cy + math.sin(a1) * r_in)
    p_b2 = (cx + math.cos(a2) * r_in, cy + math.sin(a2) * r_in)
    ak.poly(c, [p_b1, p_tip, p_b2])
    ak.draw(c, fill=ak.SUN_RAY, ow=6)

# --- Halo clair derriere le disque
ak.circle(c, cx, cy, 45)
ak.draw(c, fill=ak.SUN_HI, ow=6)

# --- Disque principal du soleil
ak.circle(c, cx, cy, 40)
ak.draw(c, fill=ak.SUN, ow=7)

# --- Reflet doux en haut a gauche (donne du volume au disque)
ak.ellipse(c, cx - 15, cy - 16, 13, 9)
ak.draw(c, fill=ak.SUN_HI, outline=None, a=0.85)

# --- Grosse bouille adorable : gros yeux brillants
ak.eyes(c, cx, cy - 6, spread=14, r=9, look=(0.0, 0.05))
# petite etincelle de lumiere dans chaque oeil
for sx in (-1, 1):
    ak.circle(c, cx + sx * 14 - 2.5, cy - 9, 2.2)
    ak.draw(c, fill=ak.WHITE, outline=None)

# --- Large sourire chaleureux + joues roses
ak.smile(c, cx, cy + 8, 36, 18, lw=6)
ak.blush(c, cx, cy + 10, spread=29, r=6)

ak.save(s, "sun_goal")
print("sun_goal genere")
