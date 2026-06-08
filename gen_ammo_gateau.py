"""Genere ammo_gateau : un petit cupcake mignon (30x30)."""
import math
import artkit as ak

W = H = 30
s, c = ak.new(W, H)

cx = W / 2  # 15

# --- Base biscuit (caissette/cupcake liner), trapeze vers le bas ---
# Caissette compacte au bas, glacage clair domine pour la lisibilite.
ak.poly(c, [
    (cx - 7.0, 19.5),   # haut gauche
    (cx + 7.0, 19.5),   # haut droite
    (cx + 5.0, 26.5),   # bas droite
    (cx - 5.0, 26.5),   # bas gauche
])
ak.draw(c, fill=ak.COOKIE, ow=2.4)

# Rainures verticales de la caissette
ak.set_hex(c, ak.COOKIE_D)
c.set_line_width(1.2)
for off in (-4, 4):
    c.move_to(cx + off, 20.5)
    c.line_to(cx + off * 0.72, 25.5)
    c.stroke()

# --- Glacage rose ondule (CAKE) : grosse dome bombe avec bord festonne ---
# Bord inferieur du glacage = festons qui retombent un peu sur la caissette.
c.new_path()
c.move_to(cx - 9.5, 19.5)
# bord superieur dome qui monte (plus haut et large pour montrer le rose)
c.curve_to(cx - 11, 11, cx - 4.5, 7.5, cx, 7.5)
c.curve_to(cx + 4.5, 7.5, cx + 11, 11, cx + 9.5, 19.5)
# bord inferieur festonne (de droite vers gauche), 3 vagues
c.curve_to(cx + 7, 17.5, cx + 5, 20.5, cx + 3, 19)
c.curve_to(cx + 1.5, 21, cx - 1.5, 21, cx - 3, 19)
c.curve_to(cx - 5, 20.5, cx - 7, 17.5, cx - 9.5, 19.5)
c.close_path()
ak.draw(c, fill=ak.CAKE, ow=2.4)

# Ondulation decorative (le swirl du glacage), legere, en haut du dome
ak.set_hex(c, ak.CAKE_D)
c.set_line_width(1.2)
c.move_to(cx - 5.5, 11.8)
c.curve_to(cx - 2, 10.3, cx + 2, 10.3, cx + 5.5, 11.8)
c.stroke()
c.new_path()

# Quelques perles de sucre colorees sur le glacage (cotes, hors du visage)
for (px, py, col) in [(cx - 6, 14.5, ak.SUN), (cx + 6, 14.5, ak.LEAF),
                      (cx - 5, 17.5, ak.SKY), (cx + 5, 17.5, ak.PINK_D)]:
    ak.circle(c, px, py, 0.9)
    ak.set_hex(c, col)
    c.fill()
    c.new_path()

# --- Cerise rouge au sommet (legerement detachee du dome) ---
ak.circle(c, cx, 6.2, 3.1)
ak.draw(c, fill=ak.HEART, ow=2.0)
# Reflet sur la cerise
ak.circle(c, cx - 1.1, 5.1, 0.9)
ak.set_hex(c, ak.WHITE, 0.9)
c.fill()
c.new_path()
# Petite tige
ak.set_hex(c, ak.LEAF_D)
c.set_line_width(1.4)
c.move_to(cx + 0.5, 3.6)
c.curve_to(cx + 2, 2.2, cx + 3, 2.7, cx + 3.4, 3.7)
c.stroke()

# --- Bouille rigolote sur le glacage clair (compacte, centree, lisible) ---
ak.eyes(c, cx, 14.6, spread=2.3, r=1.35, look=(0, 0.12))
ak.smile(c, cx, 16.2, 3.0, 1.4, lw=1.1)
ak.blush(c, cx, 16.2, spread=3.8, r=1.1)

ak.save(s, "ammo_gateau")
print("ammo_gateau OK")
