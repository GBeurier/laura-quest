"""fx_tear — effet du sort PLEURER : une grosse larme bleue (goutte), reflet brillant."""
import math
import artkit as ak

W = H = 28
s, c = ak.new(W, H)

# --- Goutte : pointe en haut, rond en bas -------------------------------
# On construit le path d'une larme classique.
cx = 14.0          # centre horizontal
top_y = 3.5        # pointe (haut)
bot_y = 24.5       # bas du rond
r = 7.5            # rayon du gros rond du bas
bulb_cy = bot_y - r  # centre du cercle du bas

c.new_sub_path()
# Pointe en haut
c.move_to(cx, top_y)
# Cote droit : courbe de la pointe vers le bord droit du rond
c.curve_to(cx + 3.0, top_y + 7.0,   # controle haut-droit
           cx + r,   bulb_cy - 4.0,  # controle qui pousse vers le bord droit
           cx + r,   bulb_cy)        # bord droit du rond
# Demi-cercle bas (droite -> bas -> gauche)
c.arc(cx, bulb_cy, r, 0, math.pi)
# Cote gauche : remonte vers la pointe
c.curve_to(cx - r,   bulb_cy - 4.0,
           cx - 3.0, top_y + 7.0,
           cx, top_y)
c.close_path()
ak.draw(c, fill=ak.TEAR, ow=4)

# --- Ombre interne (croissant en bas-droite) ----------------------------
ak.ellipse(c, cx + 2.0, bulb_cy + 1.5, r * 0.62, r * 0.62)
ak.draw(c, fill=ak.TEAR_D, outline=None, a=0.55)

# --- Gros reflet blanc brillant (haut-gauche) ---------------------------
ak.ellipse(c, cx - 2.6, bulb_cy - 2.4, 2.6, 3.4)
ak.draw(c, fill=ak.WHITE, outline=None)
# petit point de brillance secondaire
ak.circle(c, cx + 2.6, bulb_cy - 3.6, 1.1)
ak.draw(c, fill=ak.WHITE, outline=None, a=0.9)

ak.save(s, "fx_tear")
print("done")
