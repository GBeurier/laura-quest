import artkit as ak

W = H = 26
s, c = ak.new(W, H)

cx, cy = 13, 15

# --- Petit germe vert (derriere, sort de la pointe droite, vers le haut) ---
# tige courte et fine
c.new_path()
c.move_to(cx + 7, cy - 2)
c.curve_to(cx + 8.5, cy - 5, cx + 9, cy - 6.5, cx + 8.5, cy - 8.5)
ak.set_hex(c, ak.LEAF_D)
c.set_line_width(2.0)
c.set_line_cap(1)  # round cap
c.stroke()
# petite feuille en goutte au bout de la tige
c.new_path()
c.move_to(cx + 8.5, cy - 8.5)
c.curve_to(cx + 11, cy - 9, cx + 11.5, cy - 12, cx + 9, cy - 12)
c.curve_to(cx + 7.5, cy - 11, cx + 7.5, cy - 9, cx + 8.5, cy - 8.5)
c.close_path()
ak.draw(c, fill=ak.LEAF, ow=1.6)

# --- Corps de la graine : amande/goutte horizontale allongee ---
# pointue a gauche, plus ronde a droite, etiree mais bien dodue
c.new_path()
c.move_to(cx - 10, cy)                                      # pointe gauche
c.curve_to(cx - 5, cy - 7, cx + 4, cy - 7, cx + 9, cy)      # dessus
c.curve_to(cx + 4, cy + 7, cx - 5, cy + 7, cx - 10, cy)     # dessous
c.close_path()
ak.draw(c, fill=ak.SEED, ow=2.2)

# --- Sillon central (trait de la graine de riz) ---
c.new_path()
c.move_to(cx - 7.5, cy + 0.8)
c.curve_to(cx - 2, cy + 2.6, cx + 3, cy + 2.6, cx + 7, cy + 0.8)
ak.set_hex(c, "#c9a64f")
c.set_line_width(1.2)
c.set_line_cap(1)
c.stroke()

# --- Reflet blanc (petit, en haut a gauche du corps) ---
ak.ellipse(c, cx - 2.5, cy - 2.4, 2.6, 1.2)
ak.set_hex(c, ak.WHITE, 0.92)
c.fill()
c.new_path()

ak.save(s, "ammo_graine")
print("saved ammo_graine")
