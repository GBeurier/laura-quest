"""Sprite ennemi : camion pollueur de profil allant a gauche, bouille mechante."""
import artkit as ak

W, H = 108, 66
s, c = ak.new(W, H)

# --- Ombre au sol -----------------------------------------------------------
ak.shadow(c, 54, 61, 48)

# --- Nuage d'echappement (derriere a droite) --------------------------------
for (ex, ey, er) in ((101, 24, 6), (98, 16, 5), (105, 13, 4.5), (103, 30, 4)):
    ak.circle(c, ex, ey, er)
    ak.draw(c, fill="#c4ccd4", outline=ak.OUTLINE, ow=3)

# --- Remorque grise (droite) ------------------------------------------------
ak.rrect(c, 48, 14, 47, 32, 5)
ak.draw(c, fill=ak.TRAILER, outline=ak.OUTLINE, ow=5)
# lignes de tole sur la remorque
for lx in (60, 72, 84):
    c.new_path()
    c.move_to(lx, 16)
    c.line_to(lx, 44)
    ak.set_hex(c, ak.OUTLINE)
    c.set_line_width(2)
    c.stroke()

# --- Cabine rouge (gauche, avant a gauche) ----------------------------------
# corps cabine : haut (toit + pare-brise) recule, museau plat qui avance a gauche
ak.poly(c, [(5, 47), (5, 28), (12, 15), (44, 15), (44, 47)])
ak.draw(c, fill=ak.TRUCK, outline=ak.OUTLINE, ow=5)

# --- Pare-brise (en haut de la cabine, museau rouge bien visible dessous) ----
ak.poly(c, [(16, 18), (40, 18), (40, 25), (16, 25)])
ak.draw(c, fill=ak.GLASS, outline=ak.OUTLINE, ow=3)

# --- Phares jaunes a l'avant (gauche, sur le museau) ------------------------
for (px, py) in ((8, 30), (8, 38)):
    ak.circle(c, px, py, 2.8)
    ak.draw(c, fill=ak.SUN, outline=ak.OUTLINE, ow=3)

# --- Bouille mechante sur la calandre (panneau clair bien lisible) -----------
# panneau clair = "visage" de la calandre, contoure, laisse du rouge autour
ak.rrect(c, 15, 29, 24, 16, 4)
ak.draw(c, fill="#ffdf7a", outline=ak.OUTLINE, ow=3)

# yeux en fente mechants (haut du panneau)
for (ex, dx) in ((22, 1), (33, -1)):
    ak.ellipse(c, ex, 33, 4.0, 2.4)
    ak.draw(c, fill=ak.WHITE, outline=ak.OUTLINE, ow=2)
    ak.circle(c, ex + dx, 33, 1.6)
    ak.draw(c, fill=ak.OUTLINE, outline=None)
# Sourcils en V agressif, bien epais, au dessus des yeux
ak.brow(c, 16, 29, 26, 32, 5)
ak.brow(c, 29, 32, 39, 29, 5)

# Rictus mechant = calandre blanche avec dents pointues (bas du panneau)
ak.rrect(c, 16, 38, 22, 6, 2)
ak.draw(c, fill=ak.WHITE, outline=ak.OUTLINE, ow=3)
# dents : triangles pleins sombres pointant vers le bas (gros, lisibles)
for tx in (18, 24, 30):
    ak.poly(c, [(tx, 38), (tx + 4.5, 38), (tx + 2.25, 44)])
    ak.draw(c, fill=ak.OUTLINE, outline=None)

# --- Roues noires avec jantes claires ---------------------------------------
for wx in (18, 58, 82):
    ak.circle(c, wx, 50, 9.5)
    ak.draw(c, fill=ak.WHEEL, outline=ak.OUTLINE, ow=5)
    ak.circle(c, wx, 50, 3.8)
    ak.draw(c, fill=ak.METAL, outline=ak.OUTLINE, ow=2)

ak.save(s, "enemy_camion")
print("OK enemy_camion")
