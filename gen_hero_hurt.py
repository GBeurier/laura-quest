"""Genere hero_hurt : le pot de riz a roulettes qui prend un coup.
Bouille grimacante, pot penche en arriere (gauche), etoiles d'etourdissement."""
import math
import artkit as ak

W, H = 64, 76
s, c = ak.new(W, H)

# Petite ombre portee au sol
ak.shadow(c, 33, H - 6, 19)

# On bascule tout le pot en arriere (vers la gauche), pivot pres du sol.
PIVOT_X, PIVOT_Y = 30, H - 12
TILT = -0.32  # radians, penche vers la gauche

c.save()
c.translate(PIVOT_X, PIVOT_Y)
c.rotate(TILT)
c.translate(-PIVOT_X, -PIVOT_Y)

# --- ROULETTES (de travers) -----------------------------------------------
# roue gauche un peu plus basse / decalee, roue droite legerement de travers
ak.ellipse(c, 19, H - 9, 8, 7)
ak.draw(c, fill=ak.WHEEL, ow=5)
ak.circle(c, 19, H - 9, 2.4)
ak.draw(c, fill=ak.METAL, outline=None)

ak.ellipse(c, 44, H - 7, 7, 8)
ak.draw(c, fill=ak.WHEEL, ow=5)
ak.circle(c, 44, H - 7, 2.4)
ak.draw(c, fill=ak.METAL, outline=None)

# Petite barre/essieu sous le pot
ak.rrect(c, 18, H - 17, 28, 6, 3)
ak.draw(c, fill=ak.METAL, ow=4)

# --- CORPS DU POT (terre cuite, forme jarre ronde) ------------------------
# corps principal
ak.ellipse(c, 31, H - 30, 21, 22)
ak.draw(c, fill=ak.TERRA, ow=6)

# ombre laterale (cote droit) pour le volume
c.save()
ak.ellipse(c, 38, H - 30, 12, 20)
c.clip()
ak.ellipse(c, 31, H - 30, 21, 22)
ak.set_hex(c, ak.TERRA_D, 0.55)
c.fill()
c.restore()
c.new_path()

# col / rebord du pot
ak.rrect(c, 14, H - 53, 34, 11, 5)
ak.draw(c, fill=ak.TERRA_D, ow=6)
ak.rrect(c, 12, H - 56, 38, 8, 4)
ak.draw(c, fill=ak.TERRA, ow=6)

# riz qui depasse du col (monticule creme bombe + grains brillants)
ak.ellipse(c, 31, H - 55, 18, 8)
ak.draw(c, fill=ak.RICE, ow=5)
for gx, gy in [(23, -58), (31, -60), (39, -58), (27, -56), (35, -56)]:
    ak.ellipse(c, gx, H + gy, 3.4, 2.4)
    ak.draw(c, fill=ak.RICE_HI, outline=ak.OUTLINE, ow=1.5)

# --- BOUILLE GRIMACANTE ----------------------------------------------------
fcx, fcy = 31, H - 34
ak.eyes(c, fcx, fcy, spread=9, r=5.5, look=(-0.4, 0.0))

# sourcils en biais (fronces, douleur)
ak.brow(c, fcx - 15, fcy - 10, fcx - 4, fcy - 6, 4)
ak.brow(c, fcx + 4, fcy - 6, fcx + 15, fcy - 10, 4)

# joues rouges (effort/douleur)
ak.blush(c, fcx, fcy + 6, spread=15, r=3.5)

# bouche en moue (up=False) bien dessous, ne touche pas les joues
ak.smile(c, fcx, fcy + 9, 15, 6, 4, up=False)

c.restore()  # fin du tilt

# --- ETOILES D'ETOURDISSEMENT (en arc au-dessus de la tete, pas inclinees) ---
# 3 etoiles jaunes en arc au-dessus de la tete (bien degagees du pot)
# tete/col du pot ~ y 18-26 : on place les etoiles franchement plus haut.
ak.star(c, 12, 14, 6.5, 2.8, 5)
ak.draw(c, fill=ak.SUN, ow=3)
ak.star(c, 31, 5, 5.5, 2.4, 5)
ak.draw(c, fill=ak.SUN, ow=3)
ak.star(c, 52, 12, 6.0, 2.6, 5)
ak.draw(c, fill=ak.SUN, ow=3)

# petits points jaunes (eclats) pour densifier l'effet d'etourdissement
for px, py in [(21, 7), (42, 6)]:
    ak.circle(c, px, py, 1.6)
    ak.draw(c, fill=ak.SUN_RAY, outline=ak.OUTLINE, ow=1.2)

ak.save(s, "hero_hurt")
print("hero_hurt OK")
