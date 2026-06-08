"""Sprite : BOSS directeur de these n.1 - severe, blouse, barbe grise, lunettes,
pointe du doigt vers la gauche, tasse de cafe fumante dans l'autre main."""
import math
import artkit as ak

W, H = 124, 140
s, c = ak.new(W, H)

GREY   = "#9aa0a8"   # barbe grise
GREY_D = "#7c828a"
COFFEE = "#5a3a22"   # cafe
MUG    = "#e0483f"   # tasse rouge
MUG_D  = "#b8352e"

# Ombre au sol
ak.shadow(c, 64, 132, 38)

# ---- CORPS / BLOUSE (silhouette d'abord) ----------------------------------
# Tronc en blouse (large, imposant)
ak.rrect(c, 30, 64, 64, 66, 16)
ak.draw(c, fill=ak.LAB, ow=6)

# Ombre cote droit de la blouse
ak.rrect(c, 70, 70, 22, 56, 12)
ak.draw(c, fill=ak.LAB_SH, outline=None)

# Re-contour gauche pour garder la forme nette
ak.rrect(c, 30, 64, 64, 66, 16)
ak.draw(c, fill=None, ow=6)

# ---- BRAS GAUCHE (du perso) : POINTE DU DOIGT vers la GAUCHE ---------------
# Manche tendue horizontalement vers la gauche
ak.rrect(c, 8, 74, 36, 18, 9)
ak.draw(c, fill=ak.LAB, ow=6)
# Main + doigt pointe (vers la gauche)
ak.circle(c, 18, 83, 9)
ak.draw(c, fill=ak.SKIN, ow=5)
# Poing ferme + doigt qui pointe nettement vers la gauche
ak.rrect(c, 2, 78, 16, 11, 5)
ak.draw(c, fill=ak.SKIN, ow=5)
# Bout du doigt arrondi (accent)
ak.circle(c, 3, 83, 4)
ak.draw(c, fill=ak.SKIN, ow=4)

# ---- BRAS DROIT (du perso) : tient la TASSE -------------------------------
# Manche pliee vers le bas-droit
ak.rrect(c, 80, 78, 18, 34, 9)
ak.draw(c, fill=ak.LAB, ow=6)
# Main
ak.circle(c, 92, 108, 9)
ak.draw(c, fill=ak.SKIN, ow=5)

# ---- TASSE DE CAFE FUMANTE ------------------------------------------------
# Vapeur (derriere la tasse, blanc translucide)
c.new_path()
c.move_to(98, 94)
c.curve_to(92, 86, 106, 82, 100, 74)
c.curve_to(96, 68, 108, 64, 104, 58)
c.set_line_width(5)
ak.set_hex(c, ak.WHITE, 0.85)
c.set_line_cap(1)
c.stroke()
c.new_path()
c.move_to(108, 96)
c.curve_to(114, 88, 102, 84, 110, 76)
c.curve_to(114, 70, 106, 66, 112, 60)
c.set_line_width(5)
ak.set_hex(c, ak.WHITE, 0.6)
c.stroke()

# Corps de la tasse
ak.rrect(c, 90, 96, 26, 24, 6)
ak.draw(c, fill=MUG, ow=5)
# Anse
ak.circle(c, 118, 108, 7)
ak.draw(c, fill=None, ow=5)
ak.circle(c, 118, 108, 3)
ak.draw(c, fill=None, ow=4)
# Cafe (haut de la tasse)
ak.ellipse(c, 103, 98, 12, 4)
ak.draw(c, fill=COFFEE, ow=4)

# ---- COL / CHEMISE ---------------------------------------------------------
ak.poly(c, [(52, 66), (64, 80), (76, 66)])
ak.draw(c, fill=ak.WHITE, ow=5)
# Cravate
ak.poly(c, [(60, 72), (68, 72), (66, 98), (62, 98)])
ak.draw(c, fill=ak.TIE, ow=4)

# ---- TETE ------------------------------------------------------------------
# Tete (grosse, ronde, un peu haute pour un grand front)
ak.ellipse(c, 62, 38, 30, 32)
ak.draw(c, fill=ak.SKIN, ow=6)

# ---- BARBE (grise) ---------------------------------------------------------
# Grande barbe : entoure le bas du visage (joues -> menton), laisse le front
c.new_path()
c.move_to(34, 40)
c.curve_to(30, 60, 42, 82, 62, 84)
c.curve_to(82, 82, 94, 60, 90, 40)
c.curve_to(86, 50, 78, 54, 62, 54)
c.curve_to(46, 54, 38, 50, 34, 40)
c.close_path()
ak.draw(c, fill=GREY, ow=5)
# Texture barbe (quelques traits)
for bx in (50, 62, 74):
    c.new_path()
    c.move_to(bx, 58)
    c.line_to(bx + 1, 76)
    c.set_line_width(2)
    ak.set_hex(c, GREY_D)
    c.stroke()

# Couronne de cheveux gris : touffes laterales au-dessus des oreilles
ak.ellipse(c, 34, 34, 8, 13)
ak.draw(c, fill=GREY, ow=5)
ak.ellipse(c, 90, 34, 8, 13)
ak.draw(c, fill=GREY, ow=5)

# Moustache (au-dessus de la bouche, sous le nez)
ak.ellipse(c, 55, 56, 8, 4)
ak.draw(c, fill=GREY, outline=None)
ak.ellipse(c, 69, 56, 8, 4)
ak.draw(c, fill=GREY, outline=None)

# ---- LUNETTES rectangulaires (monture noire, verres GLASS) -----------------
# Verre gauche
ak.rrect(c, 44, 37, 16, 13, 3)
ak.draw(c, fill=ak.GLASS, ow=4)
# Verre droit
ak.rrect(c, 64, 37, 16, 13, 3)
ak.draw(c, fill=ak.GLASS, ow=4)
# Pont
c.new_path()
c.move_to(60, 43)
c.line_to(64, 43)
c.set_line_width(4)
ak.set_hex(c, ak.OUTLINE)
c.stroke()

# ---- YEUX severes (derriere les verres) ------------------------------------
# Petits yeux fronces qui regardent vers la gauche (le joueur)
for ex in (51, 71):
    ak.circle(c, ex, 44, 2.6)
    ak.draw(c, fill=ak.OUTLINE, outline=None)

# ---- SOURCILS TRES FRONCES (poses SUR le haut des verres, bien visibles) --
# Inclines vers le nez (inner bas / outer haut) = air severe "refais tes manips"
# Petit fond clair sous le sourcil pour le detacher de la monture
ak.brow(c, 45, 33, 60, 40, lw=8)
ak.brow(c, 79, 33, 64, 40, lw=8)

# Nez
c.new_path()
c.move_to(62, 46)
c.curve_to(58, 52, 59, 55, 64, 55)
c.set_line_width(4)
ak.set_hex(c, ak.SKIN_D)
c.stroke()

# ---- BOUCHE severe (moue / ligne stricte) ---------------------------------
ak.smile(c, 62, 64, 15, 5, lw=5, up=False)

ak.save(s, "boss_directeur1")
print("OK")
