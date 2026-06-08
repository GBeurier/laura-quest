import artkit as ak
import math

W, H = 54, 48
s, c = ak.new(W, H)

cx = W / 2

# Ombre portee au sol
ak.shadow(c, cx, H - 4, 22)

# --- Corps : galet patatoide, large/aplati en bas, bossele en haut ---
# Points dans le sens horaire, base bien plate
pts = [
    (7, 38),    # bas gauche
    (6, 28),
    (10, 19),
    (18, 13),
    (27, 12),
    (37, 14),
    (45, 20),
    (48, 29),
    (46, 38),   # bas droit
    (40, 40),   # base plate
    (14, 40),
]
c.new_path()
c.move_to(*pts[0])
n = len(pts)
for i in range(1, n + 1):
    p0 = pts[(i - 1) % n]
    p1 = pts[i % n]
    mx = (p0[0] + p1[0]) / 2
    my = (p0[1] + p1[1]) / 2
    c.curve_to(p0[0], p0[1], p0[0], p0[1], mx, my)
c.close_path()
ak.draw(c, fill="#c4ccd8", ow=5)

# --- Base aplatie plus foncee (ombre dessous) ---
c.save()
c.new_path()
c.move_to(*pts[0])
for i in range(1, n + 1):
    p0 = pts[(i - 1) % n]
    p1 = pts[i % n]
    mx = (p0[0] + p1[0]) / 2
    my = (p0[1] + p1[1]) / 2
    c.curve_to(p0[0], p0[1], p0[0], p0[1], mx, my)
c.close_path()
c.clip()
ak.ellipse(c, cx, 45, 26, 11)
ak.set_hex(c, "#8a929e")  # METAL plus fonce
c.fill()
c.new_path()
c.restore()

# --- Petit highlight clair en haut a gauche (volume galet) ---
ak.ellipse(c, 20, 19, 6, 3.5)
ak.set_hex(c, "#d6dce4")
c.fill()
c.new_path()

# --- Fissures (2) bien marquees ---
c.new_path()
c.move_to(13, 22)
c.line_to(16, 27)
c.line_to(12, 30)
c.line_to(15, 36)
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(2.6)
c.stroke()

c.new_path()
c.move_to(42, 24)
c.line_to(45, 30)
c.line_to(41, 33)
c.line_to(44, 37)
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(2.6)
c.stroke()

# --- Sourcils fronces (accent circonflexe), bas et rapproches ---
ak.brow(c, 19, 22, 26, 18, 4.2)
ak.brow(c, 35, 18, 28, 22, 4.2)

# --- Yeux pas contents (regard baisse) ---
ak.eyes(c, cx, 26, spread=7, r=5, look=(0, 0.5))

# Paupieres baissees mecontentes : fin arc sombre sur le haut de chaque oeil
for sx in (-1, 1):
    ex = cx + sx * 7
    c.new_path()
    c.move_to(ex - 5, 24.5)
    c.curve_to(ex - 3, 22, ex + 3, 22, ex + 5, 24.5)
    ak.set_hex(c, ak.OUTLINE)
    c.set_line_width(2.4)
    c.set_line_cap(1)
    c.stroke()
    c.new_path()

# --- Bouche en moue (up=False) ---
ak.smile(c, cx, 33, 14, 5, lw=4, up=False)

ak.save(s, "enemy_caillou")
print("done")
