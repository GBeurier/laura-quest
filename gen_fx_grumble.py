import math
import artkit as ak

W, H = 76, 52
s, c = ak.new(W, H)

# --- Bulle de BD (nuage de parole) : silhouette bosselee ----------------
# Centre de la bulle, legerement vers le haut pour laisser la queue en bas.
bcx, bcy = 38, 25
brx, bry = 31, 16

# Nuage : cercle central + petits bossages autour pour le look "parole".
def cloud_path(ctx, cx, cy, rx, ry):
    bumps = [
        (-rx*0.70, -ry*0.20, 9),
        (-rx*0.45, -ry*0.75, 8),
        ( 0.0,     -ry*0.95, 9),
        ( rx*0.45, -ry*0.75, 8),
        ( rx*0.70, -ry*0.20, 9),
        ( rx*0.70,  ry*0.35, 8),
        ( rx*0.35,  ry*0.80, 9),
        (-rx*0.10,  ry*0.95, 8),
        (-rx*0.55,  ry*0.70, 8),
        (-rx*0.75,  ry*0.30, 8),
    ]
    ctx.new_path()
    for (dx, dy, rr) in bumps:
        ak.circle(ctx, cx+dx, cy+dy, rr)

# Petite queue triangulaire de la bulle vers le bas-gauche.
def tail_path(ctx):
    ak.poly(ctx, [(24, 36), (17, 47), (33, 39)])

# 1) Contour epais d'abord (queue + nuage), pour la silhouette exterieure.
tail_path(c)
ak.draw(c, fill=ak.WHITE, ow=6)
cloud_path(c, bcx, bcy, brx, bry)
ak.draw(c, fill=ak.WHITE, ow=6)

# 2) Re-remplir l'interieur en blanc SANS contour pour effacer les contours
#    internes entre les bossages (chevauchements). On le fait en un seul
#    path fusionne (fill non-zero) pour un blanc propre et continu.
tail_path(c)
cloud_path(c, bcx, bcy, brx, bry)
ak.set_hex(c, ak.WHITE)
c.fill()
c.new_path()

# --- Texte "RAA!" en rouge gras au centre -------------------------------
c.select_font_face("sans", 0, 1)  # bold
c.set_font_size(18)
txt = "RAA!"
ext = c.text_extents(txt)
tx = bcx - ext.width/2 - ext.x_bearing
ty = bcy - ext.height/2 - ext.y_bearing
# Petit contour fonce derriere le texte pour le punch.
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(3.5)
c.move_to(tx, ty)
c.text_path(txt)
c.stroke()
# Remplissage rouge.
ak.set_hex(c, ak.TIE)
c.move_to(tx, ty)
c.show_text(txt)

# --- Lignes de colere autour de la bulle --------------------------------
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(4.0)
anger_lines = [
    ((6, 16), (13, 19)),     # haut-gauche
    ((4, 28), (11, 28)),     # gauche
    ((70, 16), (63, 19)),    # haut-droit
    ((72, 30), (65, 30)),    # droite
]
for (a, b) in anger_lines:
    c.move_to(*a)
    c.line_to(*b)
    c.stroke()

# --- Petite veine de colere (en haut a droite de la bulle) --------------
# Symbole "popote" : deux paires de chevrons rouges au-dessus de la bulle.
ak.set_hex(c, ak.TIE)
c.set_line_width(3.4)
for vx, vy in [(43, 9), (51, 9)]:
    c.move_to(vx-4, vy+3)
    c.line_to(vx,   vy-2)
    c.line_to(vx+4, vy+3)
    c.stroke()

ak.save(s, "fx_grumble")
print("done")
