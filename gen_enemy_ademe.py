"""Genere enemy_ademe : une pile de rapports administratifs blasee qui ecrase."""
import math
import artkit as ak

W, H = 50, 58
s, c = ak.new(W, H)

# Ombre au sol
ak.shadow(c, W / 2, H - 4, 20)

# --- Pile de feuilles empilees de travers (du bas vers le haut) ---
# Feuilles fines, bien espacees, inclinaisons alternees -> lisible.
# (cx, cy, w, h, angle_deg)
sheets = [
    (26, 49, 40, 9, -5),
    (24, 41, 40, 9, 6),
    (26, 33, 40, 9, -4),
]
for (cx, cy, w, h, ang) in sheets:
    c.save()
    c.translate(cx, cy)
    c.rotate(math.radians(ang))
    # ombre fine sous la feuille
    ak.rrect(c, -w / 2, -h / 2 + 2.5, w, h, 2.5)
    ak.draw(c, fill=ak.PAPER_SH, ow=0)
    # feuille
    ak.rrect(c, -w / 2, -h / 2, w, h, 2.5)
    ak.draw(c, fill=ak.PAPER, outline=ak.OUTLINE, ow=3)
    # lignes de texte simulees
    ak.set_hex(c, ak.PAPER_SH)
    c.set_line_width(1.2)
    for ly in (-1.5, 1.5):
        c.move_to(-w / 2 + 6, ly)
        c.line_to(w / 2 - 8, ly)
        c.stroke()
    c.restore()

# --- Feuille du dessus (porte le bandeau ADEME + la bouille) ---
top_cx, top_cy = 25, 20
tw, th = 42, 22
c.save()
c.translate(top_cx, top_cy)
c.rotate(math.radians(-2))
# ombre
ak.rrect(c, -tw / 2, -th / 2 + 2.5, tw, th, 3)
ak.draw(c, fill=ak.PAPER_SH, ow=0)
# feuille
ak.rrect(c, -tw / 2, -th / 2, tw, th, 3)
ak.draw(c, fill=ak.PAPER, outline=ak.OUTLINE, ow=3.5)
# bandeau vert en haut
ak.rrect(c, -tw / 2 + 1.5, -th / 2 + 1.5, tw - 3, 8, 2)
ak.draw(c, fill=ak.ADEME_G, outline=ak.OUTLINE, ow=2)
# mot ADEME en noir lisible, espace, centre dans la zone libre (apres trombone)
c.select_font_face("sans", 0, 1)
c.set_font_size(5.0)
text = "ADEME"
gap = 0.5
widths = [c.text_extents(ch).x_advance for ch in text]
total = sum(widths) + gap * (len(text) - 1)
ak.set_hex(c, ak.OUTLINE)
# zone lisible du bandeau : a droite du trombone (~-9) jusqu'au bord (~17.5)
zone_l, zone_r = -9.0, 17.5
x = (zone_l + zone_r) / 2 - total / 2
ybase = -th / 2 + 6.6
for ch, wch in zip(text, widths):
    c.move_to(x, ybase)
    c.show_text(ch)
    x += wch + gap
c.restore()

# Repere monde de la feuille du dessus pour poser la bouille dessus.
# Feuille du dessus ~ y 9..31, bandeau jusqu'a ~17. Bouille bien en dessous.
fx, fy = 25, 26

# --- Bouille blasee (sous le bandeau, sur la feuille du dessus) ---
# yeux mi-clos : ovale blanc bas + grosse pupille + paupiere epaisse au-dessus.
for sx in (-1, 1):
    ex = fx + sx * 7.0
    # blanc de l'oeil
    ak.ellipse(c, ex, fy, 4.0, 3.2)
    ak.draw(c, fill=ak.WHITE, outline=ak.OUTLINE, ow=2.2)
    # grosse pupille basse (regard tombant = blase)
    ak.circle(c, ex, fy + 1.2, 1.8)
    ak.draw(c, fill=ak.OUTLINE, outline=None)
    # paupiere mi-close : trait horizontal epais qui mange le haut de l'oeil
    ak.set_hex(c, ak.OUTLINE)
    c.set_line_width(3.4)
    c.set_line_cap(1)
    c.move_to(ex - 4.4, fy - 1.6)
    c.line_to(ex + 4.4, fy - 1.6)
    c.stroke()
# bouche plate blasee (large, bien centree sous les yeux)
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(2.6)
c.set_line_cap(1)
c.move_to(fx - 7, fy + 6.2)
c.line_to(fx + 7, fy + 6.2)
c.stroke()

# --- Trombone gris (metal) accroche au coin haut gauche, hors du bandeau ---
c.save()
c.translate(6, 20)
c.rotate(math.radians(-24))
c.new_path()
c.move_to(0, 7)
c.line_to(0, -4)
c.curve_to(0, -7, 4, -7, 4, -4)
c.line_to(4, 6)
c.curve_to(4, 8.5, 0.5, 8.5, 0.5, 6)
c.line_to(0.5, -2)
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(4.2)
c.stroke_preserve()
ak.set_hex(c, ak.METAL)
c.set_line_width(2.2)
c.stroke()
c.restore()

# --- Tampons ronds rouges (TIE) ---
def stamp(cx, cy, r):
    ak.circle(c, cx, cy, r)
    ak.draw(c, fill=ak.PAPER, outline=ak.TIE, ow=2.4)
    ak.circle(c, cx, cy, r - 2.2)
    ak.draw(c, fill=None, outline=ak.TIE, ow=1.2)
    ak.set_hex(c, ak.TIE)
    c.set_line_width(1.2)
    c.move_to(cx - r + 2, cy)
    c.line_to(cx + r - 2, cy)
    c.stroke()

stamp(39, 43, 4.6)
stamp(13, 49, 3.8)

ak.save(s, "enemy_ademe")
print("OK enemy_ademe")
