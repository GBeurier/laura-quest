import math
import artkit as ak

W = H = 28
s, c = ak.new(W, H)

# --- Heart silhouette path -------------------------------------------------
# Centre du canvas, bonne marge (~3px). Coeur classique a deux bosses.
cx = W / 2.0
top = 5.0          # haut des bosses
bot = 24.5         # pointe basse (marge ~3.5px sous le canvas)
side = 11.5        # demi-largeur max
mid_y = 9.5        # creux entre les deux bosses (en haut, au milieu)


def heart_path(ctx):
    ctx.new_path()
    # depart : creux central en haut
    ctx.move_to(cx, mid_y)
    # bosse gauche -> redescend vers la pointe basse
    ctx.curve_to(cx - 3.8, top - 2.5, cx - side - 1.5, top + 0.5,
                 cx - side + 1.0, top + 7.0)
    ctx.curve_to(cx - side + 2.0, top + 12.5, cx - 6.0, top + 14.5,
                 cx, bot)
    # cote droit (miroir)
    ctx.curve_to(cx + 6.0, top + 14.5, cx + side - 2.0, top + 12.5,
                 cx + side - 1.0, top + 7.0)
    ctx.curve_to(cx + side + 1.5, top + 0.5, cx + 3.8, top - 2.5,
                 cx, mid_y)
    ctx.close_path()


# --- Corps du coeur (rouge) + contour epais --------------------------------
heart_path(c)
ak.draw(c, fill=ak.HEART, ow=2.6)

# --- Ombre HEART_D en bas (croissant) --------------------------------------
c.save()
heart_path(c)
c.clip()
ak.ellipse(c, cx, bot + 2.5, side, 9.0)
ak.set_hex(c, ak.HEART_D)
c.fill()
c.new_path()
c.restore()

# --- Reflet blanc en haut-gauche -------------------------------------------
c.save()
heart_path(c)
c.clip()
ak.ellipse(c, cx - 4.6, top + 3.8, 2.4, 3.4)
ak.set_hex(c, ak.WHITE, 0.92)
c.fill()
c.new_path()
# petit reflet secondaire (rond)
ak.circle(c, cx - 6.6, top + 8.0, 0.9)
ak.set_hex(c, ak.WHITE, 0.8)
c.fill()
c.new_path()
c.restore()

# --- Bouille mignonne ------------------------------------------------------
ak.eyes(c, cx + 0.5, top + 8.0, spread=3.2, r=2.0, look=(0.0, 0.05), pupil=0.42)
ak.smile(c, cx + 0.5, top + 11.0, 4.2, 1.9, lw=1.4)

ak.save(s, "heart")
print("heart OK")
