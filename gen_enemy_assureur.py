"""Genere enemy_assureur : un assureur en costume bleu nuit, sourire commercial,
mallette avec un gros %, l'autre main qui tend 'signez ici'. Style Dora.

Refonte v3 :
  - tete bien degagee du costume (cou visible), cheveux plaques en calotte
    propre avec raie laterale (le visage et le front restent clairs) ;
  - costume bleu nuit eclairci (sinon il vire au noir a cote des gros
    contours) + grand col de chemise blanc + cravate rouge pour casser la masse ;
  - grosse bouille ronde, sourire commercial net (dents bien rangees) ;
  - mallette lisible avec un gros % blanc ; tout reste dans le cadre.
"""
import artkit as ak
import math

W, H = 54, 70
s, c = ak.new(W, H)

CX = W / 2          # centre horizontal ~27
GROUND = H - 3      # sol

# Costume bleu nuit MAIS eclairci pour ne pas virer au noir cote contour.
SUIT  = "#3a4f7a"   # bleu nuit lisible
SUITD = "#2a3a5c"   # ombre costume

# ombre portee
ak.shadow(c, CX, GROUND, 16)

# ----- JAMBES / PANTALON (costume) -----
for sx in (-1, 1):
    ak.rrect(c, CX + sx * 7 - 5, 47, 10, 18, 4)
    ak.draw(c, fill=SUITD, ow=4)
# chaussures
for sx in (-1, 1):
    ak.ellipse(c, CX + sx * 7, GROUND - 1, 7, 3.5)
    ak.draw(c, fill=ak.OUTLINE, outline=ak.OUTLINE, ow=4)

# ----- BRAS DROIT (cote spectateur gauche) : descend tenir la mallette -----
ak.rrect(c, CX - 19, 36, 9, 16, 4)
ak.draw(c, fill=SUIT, ow=4)

# ----- BRAS GAUCHE (cote droit) : tendu 'signez ici' -----
ak.rrect(c, CX + 11, 36, 11, 8, 4)
ak.draw(c, fill=SUIT, ow=4)
# main tendue (paume ouverte) — reste DANS le cadre (marge a droite)
ak.circle(c, CX + 21, 40, 4)
ak.draw(c, fill=ak.SKIN, ow=3)

# ----- VESTE / TORSE (costume bleu nuit) -----
# epaules plus basses (29) pour degager un cou au-dessus
ak.poly(c, [
    (CX - 15, 53),   # bas gauche
    (CX - 16, 36),   # cote gauche
    (CX - 11, 30),   # epaule gauche
    (CX + 11, 30),   # epaule droite
    (CX + 16, 36),   # cote droit
    (CX + 15, 53),   # bas droite
])
ak.draw(c, fill=SUIT, ow=4)

# ----- COU (skin) entre tete et veste -----
ak.rrect(c, CX - 4, 26, 8, 7, 2)
ak.draw(c, fill=ak.SKIN, ow=3)

# ----- GRAND COL DE CHEMISE BLANC (casse la masse sombre) -----
ak.poly(c, [
    (CX - 9, 30),    # pointe col gauche
    (CX - 4, 31),
    (CX, 40),        # bas du V
    (CX + 4, 31),
    (CX + 9, 30),    # pointe col droite
    (CX + 6, 36),
    (CX, 44),
    (CX - 6, 36),
])
ak.draw(c, fill=ak.WHITE, ow=3)

# lapels (revers) : deux traits fins ombre, pas de gros aplat
ak.brow(c, CX - 8, 31, CX - 4, 45, 2)
ak.brow(c, CX + 8, 31, CX + 4, 45, 2)

# ----- CRAVATE rouge -----
# noeud
ak.poly(c, [
    (CX - 3, 31),
    (CX + 3, 31),
    (CX + 2, 35),
    (CX - 2, 35),
])
ak.draw(c, fill=ak.TIE, ow=2.5)
# pan de cravate
ak.poly(c, [
    (CX - 2.2, 35),
    (CX + 2.2, 35),
    (CX + 2.6, 46),
    (CX, 50),
    (CX - 2.6, 46),
])
ak.draw(c, fill=ak.TIE, ow=2.5)

# ----- TETE -----
HY = 15
# visage rond (grosse bouille) — contour un peu plus fin pour ne pas
# alourdir le pourtour du visage (sinon ca fait barbe/favoris).
ak.circle(c, CX, HY, 11)
ak.draw(c, fill=ak.SKIN, ow=3)

# petite ombre de joue cote ombre (discrete, pas de menton fonce)
ak.ellipse(c, CX + 6.5, HY + 2, 2.5, 3.5)
ak.draw(c, fill=ak.SKIN_D, outline=None)

# ----- CHEVEUX plaques noirs : petite calotte propre sur le HAUT -----
# Casquette gominee qui couvre uniquement le sommet du crane et s'arrete
# bien au-dessus des yeux. Bord avant en vague avec une raie laterale.
c.new_path()
c.move_to(CX - 9.5, HY - 5.5)
c.curve_to(CX - 11, HY - 13, CX + 11, HY - 13, CX + 9.5, HY - 5.5)
c.line_to(CX + 6.5, HY - 7)
c.curve_to(CX + 3, HY - 9.5, CX + 1, HY - 9.5, CX - 0.5, HY - 7.5)  # meche
c.line_to(CX - 2, HY - 8.5)        # raie (petit creux)
c.curve_to(CX - 5, HY - 9.5, CX - 8, HY - 8, CX - 9.5, HY - 5.5)
c.close_path()
ak.draw(c, fill=ak.OUTLINE, outline=ak.OUTLINE, ow=2)
# petite brillance gominee (reflet)
ak.brow(c, CX - 5, HY - 10, CX + 1.5, HY - 11, 1.3)

# yeux (petits, blancs bien visibles -> regard vif et engageant, pas creux)
ak.eyes(c, CX, HY + 1, spread=4.5, r=2.5, look=(0.25, 0.1), pupil=0.5)

# sourcils faussement aimables (arques, hausses au centre -> air mielleux),
# places PLUS HAUT pour ne pas se coller aux yeux (sinon air sombre/creux)
ak.brow(c, CX - 8, HY - 2.5, CX - 3, HY - 4, 1.8)
ak.brow(c, CX + 3, HY - 4, CX + 8, HY - 2.5, 1.8)

# SOURIRE COMMERCIAL exagere : grande bouche souriante, dents bien rangees.
c.new_path()
c.move_to(CX - 7, HY + 4.5)                                      # coin gauche
c.curve_to(CX - 4.5, HY + 9.5, CX + 4.5, HY + 9.5, CX + 7, HY + 4.5)  # levre basse
c.curve_to(CX + 4, HY + 6, CX - 4, HY + 6, CX - 7, HY + 4.5)     # levre haute
c.close_path()
ak.draw(c, fill=ak.OUTLINE, outline=ak.OUTLINE, ow=1.8)
# dents blanches (bande haute du sourire)
c.new_path()
c.move_to(CX - 5.5, HY + 4.8)
c.curve_to(CX - 3, HY + 6, CX + 3, HY + 6, CX + 5.5, HY + 4.8)
c.curve_to(CX + 3, HY + 5, CX - 3, HY + 5, CX - 5.5, HY + 4.8)
c.close_path()
ak.draw(c, fill=ak.WHITE, outline=None)
# separations de dents (fines)
for dx in (-2.8, 0, 2.8):
    ak.brow(c, CX + dx, HY + 4.8, CX + dx, HY + 5.7, 0.7)

# ----- MALLETTE (devant, tenue main droite, bien dans le cadre) -----
MX, MY = CX - 14, 48
ak.rrect(c, MX - 10, MY, 20, 14, 3)
ak.draw(c, fill=ak.CASE, ow=4)
# liseret clair (separation du couvercle)
ak.brow(c, MX - 9, MY + 4, MX + 9, MY + 4, 1.6)
# poignee
c.new_path()
c.move_to(MX - 4, MY)
c.curve_to(MX - 4, MY - 6, MX + 4, MY - 6, MX + 4, MY)
ak.set_hex(c, ak.OUTLINE)
c.set_line_width(3)
c.stroke()
# main qui tient la poignee
ak.circle(c, MX, MY - 1, 3.6)
ak.draw(c, fill=ak.SKIN, ow=3)

# ----- gros symbole % BLANC sur la mallette (lisible) -----
PX, PY = MX, MY + 8   # centre du %
# barre oblique epaisse (fond contour pour la lisibilite)
ak.brow(c, PX - 5, PY + 4, PX + 5, PY - 4, 3)
# rond haut-gauche
ak.circle(c, PX - 4, PY - 3, 2.1)
ak.draw(c, fill=ak.WHITE, outline=ak.WHITE, ow=1.5)
# rond bas-droit
ak.circle(c, PX + 4, PY + 3, 2.1)
ak.draw(c, fill=ak.WHITE, outline=ak.WHITE, ow=1.5)
# barre blanche par-dessus
c.new_path()
c.move_to(PX - 5, PY + 4)
c.line_to(PX + 5, PY - 4)
ak.set_hex(c, ak.WHITE)
c.set_line_width(2)
c.stroke()

ak.save(s, "enemy_assureur")
print("done")
