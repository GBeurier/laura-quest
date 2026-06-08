import math
import artkit as ak

W = H = 32
s, c = ak.new(W, H)

cx, cy = 16, 16

# --- Rayons triangulaires tout autour (derriere le disque) ---
# Contour fin pour garder les rayons lumineux (orange) et pas trop noirs.
n_rays = 11
ro = 14.5   # pointe du rayon
ri = 8.5    # base du rayon (sous le bord du disque)
half = math.radians(13)  # demi-largeur angulaire de la base
for i in range(n_rays):
    a = -math.pi / 2 + i * (2 * math.pi / n_rays)
    tip = (cx + math.cos(a) * ro, cy + math.sin(a) * ro)
    b1 = (cx + math.cos(a - half) * ri, cy + math.sin(a - half) * ri)
    b2 = (cx + math.cos(a + half) * ri, cy + math.sin(a + half) * ri)
    ak.poly(c, [tip, b1, b2])
    ak.draw(c, fill=ak.SUN_RAY, ow=1.6)

# --- Disque jaune central ---
ak.circle(c, cx, cy, 10)
ak.draw(c, fill=ak.SUN, ow=3)

# --- Centre clair (highlight) ---
ak.circle(c, cx - 1.5, cy - 2, 5.5)
ak.draw(c, fill=ak.SUN_HI, outline=None)

# --- Petite bouille toute contente ---
ak.blush(c, cx, cy + 2.5, spread=6.2, r=1.7)
ak.eyes(c, cx, cy - 0.5, spread=3.2, r=1.7, look=(0, 0.15), pupil=0.55)
ak.smile(c, cx, cy + 2.2, 6.5, 3.5, lw=2.0)

ak.save(s, "pickup_sunray")
print("done")
