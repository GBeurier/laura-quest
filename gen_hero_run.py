"""gen_hero_run.py — Le heros (pot de riz a roulettes) en train de ROULER vite.
Variante "course" du hero_idle : memes proportions eprouvees, mais penche vers
l'avant (droite), avec traits de vitesse derriere (gauche), grains de riz qui
trainent a l'arriere et bouille concentree mais contente. Regarde a droite.
Style Dora : gros contours, aplats vifs, fond transparent, mignon.
"""
import math
import artkit as ak

W, H = 64, 76
s, c = ak.new(W, H)

LEAN = -0.13  # penche vers la droite (avant)

# Ground shadow under the wheels
ak.shadow(c, 32, 73, 21)

# ---- Speed lines behind (a gauche) : drawn before the body so they trail it -
ak.set_hex(c, ak.OUTLINE)
c.set_line_cap(__import__("cairo").LINE_CAP_ROUND)
for yy, ln, w in ((30, 14, 4.0), (44, 18, 5.0), (58, 13, 4.0)):
    c.move_to(2, yy)
    c.line_to(2 + ln, yy)
    c.set_line_width(w)
    c.stroke()
c.new_path()
# a couple of fainter ones for motion feel
ak.set_hex(c, ak.OUTLINE, 0.45)
for yy, ln in ((37, 9), (51, 10)):
    c.move_to(4, yy)
    c.line_to(4 + ln, yy)
    c.set_line_width(3.0)
    c.stroke()
c.new_path()

# ---- Trailing rice grains flying off the back (a gauche) -------------------
for (gx, gy, gr) in ((10, 20, 3.2), (7, 28, 2.6), (12, 13, 2.8)):
    ak.ellipse(c, gx, gy, gr, gr * 0.66)
    ak.draw(c, fill=ak.RICE, ow=2.5)

# ===== Everything below leans forward as one block =========================
c.save()
c.translate(32, 46)
c.rotate(LEAN)
c.translate(-32, -46)

# ---- Rice tuft overflowing from the top of the pot ----
# Merged silhouette: outline pass (slightly bigger) then cream fill, so the
# outline only rings the outer edge (no muddy stacked browns).
clumps = [(20, 16, 8), (32, 11, 10.5), (44, 16, 8), (26, 18, 8.5), (38, 18, 8.5)]
for (tx, ty, tr) in clumps:
    ak.circle(c, tx, ty, tr + 2.5)
    ak.draw(c, fill=ak.OUTLINE, outline=None)
for (tx, ty, tr) in clumps:
    ak.circle(c, tx, ty, tr)
    ak.draw(c, fill=ak.RICE, outline=None)
for (gx, gy, gr) in [(27, 11, 2.6), (37, 10, 2.6), (32, 16, 2.6), (22, 17, 2.2), (43, 17, 2.2)]:
    ak.ellipse(c, gx, gy, gr, gr * 1.5)
    ak.draw(c, fill=ak.RICE_HI, outline=None)

# ---- Pot body (terracotta) : friendly round belly, tapered base ----
top_y = 23
bot_y = 58
left_top, right_top = 15, 49
left_bot, right_bot = 23, 41
c.new_path()
c.move_to(left_top, top_y)
c.curve_to(9, 33, 12, 50, left_bot, bot_y)
c.curve_to(left_bot + 3, bot_y + 3, right_bot - 3, bot_y + 3, right_bot, bot_y)
c.curve_to(52, 50, 55, 33, right_top, top_y)
c.curve_to(40, 25, 24, 25, left_top, top_y)
c.close_path()
ak.draw(c, fill=ak.TERRA, ow=6)

# Pot rim lip (darker band under the mouth)
c.new_path()
c.move_to(left_top, top_y + 1)
c.curve_to(40, top_y + 4, 24, top_y + 4, right_top, top_y + 1)
c.curve_to(right_top - 1, top_y + 6, left_top + 1, top_y + 6, left_top, top_y + 1)
c.close_path()
ak.draw(c, fill=ak.TERRA_D, outline=None)
# soft belly highlight on the left
c.new_path()
c.move_to(18, 35)
c.curve_to(15, 42, 16, 48, 20, 53)
ak.set_hex(c, ak.RICE_HI, 0.22)
c.set_line_width(4)
c.stroke()
c.new_path()

# ---- Two roller wheels under the base (roller-skate style) ----
wheel_y = 66
ak.rrect(c, 21, bot_y - 2, 22, 3.5, 1.7)
ak.draw(c, fill=ak.WHEEL, ow=3)
for wx in (21, 43):
    ak.circle(c, wx, wheel_y, 6.0)
    ak.draw(c, fill=ak.WHEEL, ow=4)
    ak.circle(c, wx, wheel_y, 2.4)
    ak.draw(c, fill=ak.RICE, ow=2)
    # little motion arc on each wheel (spin streak)
    ak.set_hex(c, ak.RICE_HI, 0.5)
    c.new_sub_path()
    c.arc(wx, wheel_y, 4.2, math.pi * 0.9, math.pi * 1.5)
    c.set_line_width(1.8)
    c.stroke()
    c.new_path()

# ---- Pink Dora-style headband ----
band_y = 29
c.new_path()
c.move_to(12, band_y)
c.curve_to(32, band_y - 5, 32, band_y - 5, 52, band_y)
c.curve_to(52, band_y + 6, 12, band_y + 6, 12, band_y)
c.close_path()
ak.draw(c, fill=ak.PINK, ow=4)
c.new_path()
c.move_to(16, band_y - 1)
c.curve_to(32, band_y - 3.5, 32, band_y - 3.5, 48, band_y - 1)
ak.set_hex(c, ak.RICE_HI, 0.35)
c.set_line_width(2)
c.stroke()
c.new_path()

# ---- Face on the belly : concentrated but happy, looking right ----
face_cy = 43
ak.eyes(c, 32, face_cy, spread=8, r=6, look=(0.7, 0.05))
# determined brows (slight frown) above the eyes
ak.brow(c, 23, face_cy - 7, 31, face_cy - 5, lw=3.2)
ak.brow(c, 33, face_cy - 5, 41, face_cy - 7, lw=3.2)
ak.blush(c, 32, face_cy + 7, spread=14, r=4)
ak.smile(c, 32, face_cy + 8, 17, 8, lw=4)

c.restore()

ak.save(s, "hero_run")
print("saved hero_run")
