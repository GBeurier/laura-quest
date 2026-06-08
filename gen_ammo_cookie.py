import math
import artkit as ak

W = H = 30
s, c = ak.new(W, H)

cx, cy = 15, 15
R = 11

# Corps du cookie : rond, bord epais fonce
ak.circle(c, cx, cy, R)
ak.draw(c, fill=ak.COOKIE, outline=ak.COOKIE_D, ow=2.5)
# recontour exterieur noir chaud par-dessus
ak.circle(c, cx, cy, R)
ak.draw(c, fill=None, outline=ak.OUTLINE, ow=3)

# Pepites de chocolat (5), bien reparties et espacees, contour epais
chips = [
    (cx - 4.6, cy - 3.8, 2.3),
    (cx + 4.4, cy - 3.4, 2.3),
    (cx + 0.2, cy + 0.4, 2.4),
    (cx - 4.8, cy + 4.2, 2.2),
    (cx + 4.6, cy + 4.0, 2.2),
]
for px, py, pr in chips:
    ak.circle(c, px, py, pr)
    ak.draw(c, fill=ak.CHOC, outline=ak.OUTLINE, ow=1.4)
    # petit reflet sur la pepite
    ak.circle(c, px - pr * 0.35, py - pr * 0.35, pr * 0.34)
    ak.draw(c, fill=ak.RICE_HI, outline=None)

ak.save(s, "ammo_cookie")
print("done")
