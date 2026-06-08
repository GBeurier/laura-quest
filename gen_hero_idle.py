import math
import artkit as ak

W, H = 64, 76
s, c = ak.new(W, H)

# Ground shadow under the wheels
ak.shadow(c, 32, 73, 20)

# ---- Rice tuft overflowing from the top of the pot ----
# Draw as ONE merged silhouette so the outline is only on the outer edge
# (avoids stacked dark outlines that make the rice look brown).
clumps = [(20, 16, 8), (32, 11, 10.5), (44, 16, 8), (26, 18, 8.5), (38, 18, 8.5)]
# 1) outline pass: fill each clump with OUTLINE color slightly larger -> merged border
for (tx, ty, tr) in clumps:
    ak.circle(c, tx, ty, tr + 2.5)
    ak.draw(c, fill=ak.OUTLINE, outline=None)
# 2) fill pass: cream rice on top
for (tx, ty, tr) in clumps:
    ak.circle(c, tx, ty, tr)
    ak.draw(c, fill=ak.RICE, outline=None)
# highlight grains
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

# Pot rim lip (darker terracotta band just under the mouth)
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

# ---- Two roller wheels aligned under the base (roller-skate style) ----
wheel_y = 66
# axle bar behind wheels (thin, kept above the wheels so they read as two)
ak.rrect(c, 21, bot_y - 2, 22, 3.5, 1.7)
ak.draw(c, fill=ak.WHEEL, ow=3)
# two clearly separated wheels with a hub
for wx in (21, 43):
    ak.circle(c, wx, wheel_y, 6.0)
    ak.draw(c, fill=ak.WHEEL, ow=4)
    ak.circle(c, wx, wheel_y, 2.4)
    ak.draw(c, fill=ak.RICE, ow=2)

# ---- Pink Dora-style headband around the top of the pot ----
band_y = 29
c.new_path()
c.move_to(12, band_y)
c.curve_to(32, band_y - 5, 32, band_y - 5, 52, band_y)
c.curve_to(52, band_y + 6, 12, band_y + 6, 12, band_y)
c.close_path()
ak.draw(c, fill=ak.PINK, ow=4)
# band highlight stripe
c.new_path()
c.move_to(16, band_y - 1)
c.curve_to(32, band_y - 3.5, 32, band_y - 3.5, 48, band_y - 1)
ak.set_hex(c, ak.RICE_HI, 0.35)
c.set_line_width(2)
c.stroke()
c.new_path()

# ---- Big smiling face on the belly, looking right ----
face_cy = 43
ak.eyes(c, 32, face_cy, spread=8, r=5.5, look=(0.4, 0.0))
ak.blush(c, 32, face_cy + 6, spread=14, r=3.6)
ak.smile(c, 32, face_cy + 9, 17, 7, lw=4)

ak.save(s, "hero_idle")
print("saved hero_idle")
