"""Genere tile_panel : tuile plateforme = panneau solaire (48x48), tileable horizontalement."""
import artkit as ak

W = H = 48
s, c = ak.new(W, H)

# --- Cadre metal sur tout le carre (pleine tuile, bords raccord) -----------
# On remplit tout le carre 0..48 en metal ; pas de marge laterale pour le raccord H.
ak.rrect(c, 0, 0, W, H, 0)
ak.draw(c, fill=ak.METAL, outline=None)

# --- Surface bleu fonce (le panneau) avec une fine bordure metal -----------
m = 3  # epaisseur du cadre metal
ak.rrect(c, m, m, W - 2 * m, H - 2 * m, 2)
ak.draw(c, fill=ak.PANEL, outline=None)

# --- Cellules 3x3 (aplats PANEL_CELL) separees par fines lignes -----------
inner_x, inner_y = m, m
inner_w, inner_h = W - 2 * m, H - 2 * m
n = 3
gap = 1.6          # demi-largeur visuelle de la ligne de separation
cell_w = inner_w / n
cell_h = inner_h / n
pad = 1.4          # creux entre cellules

for i in range(n):
    for j in range(n):
        cx = inner_x + i * cell_w + pad
        cy = inner_y + j * cell_h + pad
        cw = cell_w - 2 * pad
        ch = cell_h - 2 * pad
        ak.rrect(c, cx, cy, cw, ch, 1.4)
        ak.draw(c, fill=ak.PANEL_CELL, outline=None)

# --- Reflet diagonal clair en travers (bande PANEL_HI) --------------------
# Bande diagonale translucide qui traverse la surface des cellules.
c.save()
c.rectangle(m, m, inner_w, inner_h)
c.clip()
ak.poly(c, [(-6, H * 0.62), (H * 0.28, -6),
            (H * 0.50, -6), (-6, H * 0.86)])
ak.set_hex(c, ak.PANEL_HI, 0.55)
c.fill()
c.new_path()
# Petit deuxieme reflet plus fin
ak.poly(c, [(W * 0.55, -6), (W * 0.66, -6),
            (-6 + W, H * 0.55), (-6 + W, H * 0.66)])
ak.set_hex(c, ak.PANEL_HI, 0.30)
c.fill()
c.new_path()
c.restore()

# --- Bord superieur net : contour OUTLINE en haut (on marche dessus) ------
c.set_line_cap(__import__("cairo").LINE_CAP_BUTT)
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(4)
c.move_to(0, 2)
c.line_to(W, 2)
c.stroke()

# Liseré clair sous le bord du haut pour donner du volume au cadre metal
ak.set_hex(c, ak.PANEL_HI, 0.5)
c.set_line_width(1.4)
c.move_to(0, 4.6)
c.line_to(W, 4.6)
c.stroke()

ak.save(s, "tile_panel")
print("OK tile_panel")
