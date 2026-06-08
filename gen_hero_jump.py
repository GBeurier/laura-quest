"""gen_hero_jump.py - Le heros (pot de riz a roulettes) en PLEIN SAUT.

Roues rentrees/relevees sous le pot, riz qui s'envole vers le haut,
bouille "wiii" (yeux grands, bouche ronde ouverte), regarde a droite.
Style Dora : gros contours chauds, aplats vifs, formes rondes, grosse bouille.

On reste tres proche de hero_idle (meme pot terracotta + bandeau rose + grosse
bouille) pour que le perso soit immediatement reconnaissable, mais :
  - le perso est plus haut dans le cadre (en l'air),
  - le riz creme jaillit/s'envole vers le haut (touffe etiree + grains qui giclent),
  - les roulettes sont relevees, serrees sous le fond du pot,
  - des lignes de whoosh sous le pot montrent l'elan,
  - la bouille passe en mode "wiii" (bouche ronde ouverte).
"""
import math
import artkit as ak

W, H = 64, 76
s, c = ak.new(W, H)

# ---------------------------------------------------------------------------
# 0. Lignes de whoosh / d'elan SOUS le pot : montrent l'envol vers le haut
# ---------------------------------------------------------------------------
ak.set_hex(c, ak.OUTLINE, 0.55)
c.set_line_width(4)
for dx in (-12, 0, 12):
    c.move_to(32 + dx, 64)
    c.line_to(32 + dx, 73)
    c.stroke()
c.new_path()

# ---------------------------------------------------------------------------
# 1. RIZ creme qui s'envole vers le HAUT (touffe etiree, meme rendu que idle :
#    passe contour fusionnee puis remplissage creme, pour eviter le marron).
# ---------------------------------------------------------------------------
# Touffe principale qui sort du pot et s'etire vers le haut
clumps = [
    (32, 12, 9.5),   # sommet de la touffe (plus haut, comme un jet)
    (24, 17, 7.5),
    (40, 17, 7.5),
    (32, 18, 9.0),
    (28, 9, 5.0),    # giclures qui montent
    (37, 8, 5.0),
]
# 1) passe contour : remplissage OUTLINE legerement plus gros -> bord fusionne
for (tx, ty, tr) in clumps:
    ak.circle(c, tx, ty, tr + 2.5)
    ak.draw(c, fill=ak.OUTLINE, outline=None)
# 2) passe remplissage : riz creme par-dessus
for (tx, ty, tr) in clumps:
    ak.circle(c, tx, ty, tr)
    ak.draw(c, fill=ak.RICE, outline=None)
# grains brillants qui ressortent
for (gx, gy, gr) in [(27, 12, 2.6), (37, 11, 2.6), (32, 17, 2.6),
                     (28, 7, 2.0), (38, 6, 2.0)]:
    ak.ellipse(c, gx, gy, gr, gr * 1.5)
    ak.draw(c, fill=ak.RICE_HI, outline=None)

# Quelques grains isoles qui giclent encore plus haut (effet "ca saute !")
for (gx, gy, gr) in [(20, 6, 2.4), (45, 7, 2.4), (32, 2, 2.2)]:
    ak.ellipse(c, gx, gy, gr, gr * 1.6)
    ak.draw(c, fill=ak.RICE, ow=2)

# ---------------------------------------------------------------------------
# 2. POT en terre cuite : meme galbe amical que idle, remonte dans le cadre
# ---------------------------------------------------------------------------
top_y = 23
bot_y = 55
left_top, right_top = 15, 49
left_bot, right_bot = 23, 41
c.new_path()
c.move_to(left_top, top_y)
c.curve_to(9, 33, 12, 48, left_bot, bot_y)
c.curve_to(left_bot + 3, bot_y + 3, right_bot - 3, bot_y + 3, right_bot, bot_y)
c.curve_to(52, 48, 55, 33, right_top, top_y)
c.curve_to(40, 25, 24, 25, left_top, top_y)
c.close_path()
ak.draw(c, fill=ak.TERRA, ow=6)

# Levre / bord du pot (bande terracotta foncee sous la bouche)
c.new_path()
c.move_to(left_top, top_y + 1)
c.curve_to(40, top_y + 4, 24, top_y + 4, right_top, top_y + 1)
c.curve_to(right_top - 1, top_y + 6, left_top + 1, top_y + 6, left_top, top_y + 1)
c.close_path()
ak.draw(c, fill=ak.TERRA_D, outline=None)
# rehaut doux sur le ventre gauche
c.new_path()
c.move_to(18, 35)
c.curve_to(15, 42, 16, 47, 20, 51)
ak.set_hex(c, ak.RICE_HI, 0.22)
c.set_line_width(4)
c.stroke()
c.new_path()

# ---------------------------------------------------------------------------
# 3. ROUES relevees / rentrees, serrees sous le fond du pot
# ---------------------------------------------------------------------------
wheel_y = bot_y + 5
# essieu rentre derriere les roues
ak.rrect(c, 23, bot_y, 18, 4, 2)
ak.draw(c, fill=ak.WHEEL, ow=3)
for wx in (26, 38):
    ak.circle(c, wx, wheel_y, 5.0)
    ak.draw(c, fill=ak.WHEEL, ow=3.5)
    ak.circle(c, wx, wheel_y, 1.8)
    ak.draw(c, fill=ak.RICE, outline=None)

# ---------------------------------------------------------------------------
# 4. Bandeau rose style Dora autour du haut du pot
# ---------------------------------------------------------------------------
band_y = 29
c.new_path()
c.move_to(12, band_y)
c.curve_to(32, band_y - 5, 32, band_y - 5, 52, band_y)
c.curve_to(52, band_y + 6, 12, band_y + 6, 12, band_y)
c.close_path()
ak.draw(c, fill=ak.PINK, ow=4)
# rehaut sur le bandeau
c.new_path()
c.move_to(16, band_y - 1)
c.curve_to(32, band_y - 3.5, 32, band_y - 3.5, 48, band_y - 1)
ak.set_hex(c, ak.RICE_HI, 0.35)
c.set_line_width(2)
c.stroke()
c.new_path()

# ---------------------------------------------------------------------------
# 5. BOUILLE "wiii" : yeux grands, bouche ronde ouverte, regard a droite
# ---------------------------------------------------------------------------
face_cy = 43
# sourcils releves (joyeux / surpris)
ak.brow(c, 22, face_cy - 11, 29, face_cy - 13, lw=3)
ak.brow(c, 35, face_cy - 13, 42, face_cy - 11, lw=3)
# yeux grands, regard a droite
ak.eyes(c, 32, face_cy, spread=8, r=6, look=(0.8, -0.1))
# bouche ronde ouverte ("wiii")
ak.ellipse(c, 33, face_cy + 9, 5.0, 6.0)
ak.draw(c, fill=ak.PINK_D, ow=3.5)
ak.ellipse(c, 33, face_cy + 11, 2.8, 2.2)
ak.draw(c, fill=ak.PINK, outline=None)
# joues rouges (excitation du saut)
ak.blush(c, 32, face_cy + 5, spread=15, r=4)

ak.save(s, "hero_jump")
print("saved hero_jump")
