import math
import artkit as ak

W, H = 124, 140
s, c = ak.new(W, H)

# Ground shadow
ak.shadow(c, W/2, H-10, 40, 9)

# ----- BODY: sweater / cardigan (LEAF_D) -----
# torso, posed at bottom, occupies height
ak.poly(c, [(34, H-8), (32, 86), (40, 70), (84, 70), (92, 86), (90, H-8)])
ak.draw(c, fill=ak.LEAF_D, ow=6)

# Cardigan center opening (vertical line) + a couple buttons hint
c.new_path()
c.move_to(W/2, 76)
c.line_to(W/2, H-10)
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(4)
c.stroke()

# Collar (V-neck of sweater) over skin
ak.poly(c, [(54, 70), (W/2, 84), (70, 70)])
ak.draw(c, fill=ak.SKIN, ow=5)

# ----- ARMS -----
# Left arm (his right) hanging down
ak.poly(c, [(40, 74), (28, 78), (22, 110), (32, 114), (40, 92)])
ak.draw(c, fill=ak.LEAF_D, ow=6)
# Right arm raised holding paper
ak.poly(c, [(84, 74), (96, 78), (104, 100), (94, 106), (84, 90)])
ak.draw(c, fill=ak.LEAF_D, ow=6)

# Hand (right, holding paper) - skin
ak.circle(c, 99, 104, 8)
ak.draw(c, fill=ak.SKIN, ow=5)
# Hand (left)
ak.circle(c, 28, 112, 8)
ak.draw(c, fill=ak.SKIN, ow=5)

# ----- PAPER with red corrections, held in right hand -----
ak.rrect(c, 70, 90, 34, 44, 4)
ak.draw(c, fill=ak.PAPER, ow=5)
# red ratures (HEART_D) - scribbles / crossed-out lines
ak.set_hex(c, ak.HEART_D)
c.set_line_width(3)
for i, yy in enumerate([100, 108, 116, 124]):
    c.new_path()
    c.move_to(74, yy)
    c.line_to(100, yy)
    c.stroke()
    # crossing-out diagonal scribble
    c.new_path()
    c.move_to(75, yy-3)
    c.line_to(99, yy+3)
    c.stroke()
# big red X / circled correction
c.new_path()
c.move_to(78, 96)
c.line_to(96, 132)
c.move_to(96, 96)
c.line_to(78, 132)
c.set_line_width(3.2)
c.stroke()

# ----- HAIR back mass (drawn FIRST so head sits on top) -----
GREY = "#cdd1d9"
GREY_D = "#a7abb5"
HX, HY = W/2, 46
# big rounded grey hair silhouette behind the head (full head of hair, no bald)
ak.ellipse(c, HX, HY-7, 35, 28)
ak.draw(c, fill=GREY, ow=6)

# ----- HEAD -----
ak.circle(c, HX, HY, 30)
ak.draw(c, fill=ak.SKIN, ow=6)

# Ears
for sx in (-1, 1):
    ak.circle(c, HX + sx*29, HY+4, 6)
    ak.draw(c, fill=ak.SKIN, ow=4)

# ----- GREY HAIR messy clumps over the forehead/top (no bald spot) -----
# Solid wavy fringe sitting on the brow line: a closed shape with a flat-ish
# bottom (covering the forehead) and a few rounded bumps on top -> volume,
# so the grey FILL dominates and it clearly reads as grey hair.
hair_pts = [
    (HX-31, HY+1),     # left side, down by the ear
    (HX-33, HY-12),
    (HX-26, HY-22),    # top-left bump
    (HX-16, HY-14),
    (HX-12, HY-26),    # bump
    (HX-2, HY-16),
    (HX+4, HY-27),     # center bump
    (HX+13, HY-15),
    (HX+19, HY-25),    # bump
    (HX+28, HY-14),
    (HX+33, HY-11),
    (HX+31, HY+1),     # right side, down by the ear
    # bottom edge of the fringe across the forehead (wavy)
    (HX+18, HY-3),
    (HX+8, HY-7),
    (HX-3, HY-4),
    (HX-13, HY-7),
    (HX-22, HY-3),
]
ak.poly(c, hair_pts)
ak.draw(c, fill=GREY, ow=6)
# a few light strand lines for texture (kept subtle, light grey so hair stays light)
ak.set_hex(c, GREY_D)
c.set_line_width(2.0)
for (x1, y1, x2, y2) in [(HX-16, HY-8, HX-14, HY-19),
                          (HX-1, HY-8, HX+1, HY-21),
                          (HX+15, HY-8, HX+13, HY-19)]:
    c.new_path()
    c.move_to(x1, y1)
    c.line_to(x2, y2)
    c.stroke()

# ----- ROUND GLASSES (GLASS) -----
gy = HY + 4
for sx in (-1, 1):
    ak.circle(c, HX + sx*13, gy, 10)
    ak.draw(c, fill=ak.GLASS, ow=4, a=0.8)
# bridge
c.new_path()
c.move_to(HX-3, gy)
c.line_to(HX+3, gy)
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(4)
c.stroke()
# temple arms to ears
for sx in (-1, 1):
    c.new_path()
    c.move_to(HX + sx*23, gy)
    c.line_to(HX + sx*30, gy+2)
    c.set_line_width(3.5)
    c.stroke()

# ----- EYES behind glasses, skeptical (asymmetric: one wide, one squint) -----
# left eye wide open (simple round eye, no bullseye)
ak.circle(c, HX-13, gy+1, 4.2)
ak.draw(c, ak.WHITE, ow=2.4)
ak.circle(c, HX-12, gy+1, 2.4)
ak.draw(c, ak.OUTLINE, outline=None)
# right eye squinted (suspicious) - a flat lid line + small pupil under it
ak.circle(c, HX+13, gy+1, 4.2)
ak.draw(c, ak.WHITE, ow=2.4)
ak.circle(c, HX+13, gy+2, 2.2)
ak.draw(c, ak.OUTLINE, outline=None)
# heavy upper lid on the squint eye -> half closed, dubious
c.new_path()
c.move_to(HX+8, gy-1)
c.curve_to(HX+13, gy-3, HX+17, gy-2, HX+18, gy+1)
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(4)
c.stroke()

# ----- ASYMMETRIC SKEPTICAL EYEBROWS (drawn ON TOP, very visible) -----
# left brow (his right): raised high & arched -> the "really?" look
c.new_path()
c.move_to(HX-22, gy-11)
c.curve_to(HX-17, gy-20, HX-9, gy-20, HX-4, gy-16)
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(5)
c.stroke()
# right brow (his left): lowered, angled down toward squint -> dubious
c.new_path()
c.move_to(HX+5, gy-12)
c.line_to(HX+21, gy-7)
c.set_line_width(5)
c.stroke()

# ----- NOSE -----
c.new_path()
c.move_to(HX+1, gy+6)
c.line_to(HX-4, gy+13)
c.line_to(HX+3, gy+13)
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(3.2)
c.stroke()

# ----- DUBIOUS MOUTH (asymmetric skeptical smirk) -----
c.new_path()
c.move_to(HX-10, HY+21)
c.curve_to(HX-3, HY+25, HX+4, HY+16, HX+11, HY+18)
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(4.2)
c.stroke()

ak.save(s, "boss_directeur2")
print("done")
