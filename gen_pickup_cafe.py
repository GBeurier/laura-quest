import math
import artkit as ak

W = H = 32
s, c = ak.new(W, H)

# Soft shadow under the mug
ak.shadow(c, 16, 29, 9)

# --- Steam volutes: thin curling wisps rising from the cup (white) ---
def steam(cx, top, bot, amp):
    c.new_path()
    c.move_to(cx, bot)
    c.curve_to(cx + amp, bot - 3, cx - amp, bot - 6, cx, bot - 9)
    c.curve_to(cx + amp, top + 2, cx - amp, top + 1, cx, top)
    ak.set_hex(c, ak.WHITE)
    c.set_line_width(1.7)
    c.stroke()

steam(10.5, 5, 13, 1.6)
steam(18.5, 5, 13, 1.6)

# Little heart floating in the steam (center, top)
def heart(cx, cy, sz, col):
    c.new_path()
    c.move_to(cx, cy + sz * 0.85)
    c.curve_to(cx - sz, cy + sz * 0.1, cx - sz * 0.55, cy - sz * 0.7, cx, cy - sz * 0.05)
    c.curve_to(cx + sz * 0.55, cy - sz * 0.7, cx + sz, cy + sz * 0.1, cx, cy + sz * 0.85)
    c.close_path()
    ak.draw(c, col, ow=1.4)

heart(14.5, 6.0, 2.4, ak.HEART)

# --- Handle (behind body) on the right ---
c.new_path()
c.arc(24.5, 21, 4.2, -math.pi / 2.1, math.pi / 2.1)
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(4.6)
c.stroke()
c.new_path()
c.arc(24.5, 21, 4.2, -math.pi / 2.1, math.pi / 2.1)
ak.set_hex(c, ak.PINK)
c.set_line_width(2.2)
c.stroke()

# --- Mug body (wide rounded cup, pink) centered ---
ak.rrect(c, 6, 14, 17, 14, 5.0)
ak.draw(c, ak.PINK, ow=3.0)

# --- Coffee surface: choc ellipse filling the top of the cup ---
ak.ellipse(c, 14.5, 15.5, 7.2, 2.3)
ak.draw(c, ak.CHOC, ow=2.0)
# coffee glint
ak.ellipse(c, 12, 15.0, 1.8, 0.6)
ak.set_hex(c, ak.WHITE, 0.7)
c.fill()
c.new_path()

# --- Cute little face on the pink body, below the coffee ---
ak.blush(c, 14.5, 23.6, spread=6.8, r=1.7)
ak.eyes(c, 14.5, 21.5, spread=3.2, r=1.9, look=(0, 0.1))
ak.smile(c, 14.5, 24.2, 5.0, 2.2, lw=1.8, up=True)

ak.save(s, "pickup_cafe")
print("saved pickup_cafe")
