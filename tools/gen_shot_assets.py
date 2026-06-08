"""Genere les 7 projectiles THEMATIQUES (placeholders) des boss + tirs ennemis.

Chaque PNG : 40x40 (= 20x20 affiche x2, cf. CONFIG.art.scale=2), 1 frame, fond
TRANSPARENT (RGBA). Dessine POINTANT VERS LA DROITE (0deg) -> le jeu le tourne
vers la trajectoire (rotate(atan2(dir.y,dir.x))). Style du jeu : contour fonce
(~rgb(42,29,24)), couleurs vives, forme simple lisible a 20px.

  shot_stake  PROPRIETAIRE : piquet / pieu de cloture en bois (pointe a droite)
  shot_fork   AGRICULTEUR  : fourche a foin (dents a droite)
  shot_chart  MICHAEL      : courbe / point de donnees (donnees/modele) bleu
  shot_error  RSTUDIO      : icone d'erreur, losange rouge avec "!"
  shot_form   CENDRINE     : formulaire tamponne (feuille creme + tampon rouge)
  shot_gavel  JURY         : marteau de juge (gavel) violet/dore
  shot_paper  generique ADEME : feuille de papier creme avec lignes

Usage :
    python3 tools/gen_shot_assets.py
    python3 gen_assets_data.py        # OBLIGATOIRE ensuite (re-embarque)
"""
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, "assets", "sprites")

S = 40                       # taille du PNG (40x40 = 20x20 x2)
OUT = (42, 29, 24)           # contour fonce (style du jeu)
OUTA = OUT + (255,)


def _new():
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im, "RGBA")


def _save(im, name):
    im.save(os.path.join(SPR, name + ".png"))
    print("  shot   %-12s %s %s" % (name, im.size, im.mode))


# --- 1) PROPRIETAIRE : piquet de cloture en bois, pointe a droite ------------
def shot_stake():
    im, d = _new()
    wood = (162, 110, 58)
    wood_lo = (124, 80, 40)
    # corps du piquet (rectangle horizontal), pointe triangulaire a droite
    body = [(4, 14), (28, 14), (28, 26), (4, 26)]
    d.polygon(body, fill=wood, outline=OUTA)
    tip = [(28, 11), (38, 20), (28, 29)]
    d.polygon(tip, fill=wood, outline=OUTA)
    # veines / planches du bois
    d.line([(8, 18), (26, 18)], fill=wood_lo + (255,), width=2)
    d.line([(8, 22), (26, 22)], fill=wood_lo + (255,), width=2)
    # bout arriere (tete du piquet) plus fonce
    d.rectangle([4, 12, 8, 28], fill=wood_lo + (255,), outline=OUTA)
    _save(im, "shot_stake")


# --- 2) AGRICULTEUR : fourche a foin, 3 dents metal vers la droite ------------
def shot_fork():
    im, d = _new()
    metal = (190, 196, 204)
    metal_lo = (132, 140, 150)
    handle = (150, 102, 54)
    # manche en bois (gauche)
    d.line([(3, 20), (18, 20)], fill=handle + (255,), width=6)
    d.line([(3, 20), (18, 20)], fill=OUTA, width=1)
    # base / collier de la fourche
    d.rectangle([16, 12, 22, 28], fill=metal, outline=OUTA)
    # 3 dents pointues vers la droite
    for cy in (14, 20, 26):
        d.polygon([(22, cy - 3), (38, cy), (22, cy + 3)],
                  fill=metal, outline=OUTA)
        d.line([(24, cy), (35, cy)], fill=metal_lo + (255,), width=1)
    _save(im, "shot_fork")


# --- 3) MICHAEL : courbe / point de donnees (bleu-turquoise) ------------------
def shot_chart():
    im, d = _new()
    # pastille ronde (jeton de donnees) bleu, ligne de tendance montante dessus
    d.ellipse([3, 3, 37, 37], fill=(36, 150, 196, 255), outline=OUTA, width=2)
    d.ellipse([3, 3, 37, 37], outline=(120, 224, 240, 120), width=1)
    line = (235, 250, 255)
    pts = [(9, 28), (16, 22), (22, 25), (29, 13)]
    d.line(pts, fill=line + (255,), width=3, joint="curve")
    # points de donnees (turquoise vif, contour fonce)
    for px, py in pts:
        d.ellipse([px - 3, py - 3, px + 3, py + 3],
                  fill=(120, 232, 220, 255), outline=OUTA)
    # fleche montante en bout de courbe (sens donnees ascendantes)
    d.polygon([(29, 13), (24, 13), (29, 8)], fill=line + (255,))
    _save(im, "shot_chart")


# --- 4) RSTUDIO : icone d'erreur, losange rouge avec "!" ---------------------
def shot_error():
    im, d = _new()
    red = (224, 52, 52)
    red_hi = (255, 120, 110)
    # losange rouge vif
    dia = [(20, 3), (37, 20), (20, 37), (3, 20)]
    d.polygon(dia, fill=red, outline=OUTA)
    # liseré clair interieur (volume)
    d.line([(20, 6), (34, 20)], fill=red_hi + (180,), width=2)
    # "!" blanc : barre verticale + point
    d.rectangle([17, 11, 23, 25], fill=(255, 255, 255, 255), outline=OUTA)
    d.ellipse([17, 28, 23, 34], fill=(255, 255, 255, 255), outline=OUTA)
    _save(im, "shot_error")


# --- 5) CENDRINE : formulaire creme tamponne (tampon rouge rond) -------------
def shot_form():
    im, d = _new()
    paper = (246, 240, 224)
    # feuille (rectangle leger arrondi), coin haut-droit plie
    d.rounded_rectangle([7, 4, 33, 36], radius=2,
                        fill=paper, outline=OUTA, width=1)
    # lignes de texte (champs du formulaire)
    for ly in (10, 15, 20, 25, 30):
        d.line([(11, ly), (29, ly)], fill=(150, 142, 124, 255), width=1)
    # tampon rouge rond, en travers (officiel)
    d.ellipse([15, 16, 33, 34], outline=(204, 40, 44, 255), width=3)
    d.ellipse([18, 19, 30, 31], outline=(204, 40, 44, 180), width=1)
    d.line([(19, 25), (29, 25)], fill=(204, 40, 44, 255), width=2)
    _save(im, "shot_form")


# --- 6) JURY : marteau de juge (gavel) violet/dore ---------------------------
def shot_gavel():
    im, d = _new()
    wood = (140, 98, 178)        # manche violet
    head = (110, 72, 156)        # tete violette
    gold = (240, 200, 96)        # embouts dores
    # manche en diagonale (du bas-gauche vers la tete)
    d.line([(6, 35), (20, 18)], fill=wood + (255,), width=5)
    d.line([(6, 35), (20, 18)], fill=OUTA, width=1)
    # tete du marteau : gros cylindre horizontal en haut, bien lisible
    d.rounded_rectangle([13, 6, 37, 18], radius=4,
                        fill=head, outline=OUTA, width=1)
    # embouts dores du marteau (les deux faces de frappe)
    d.rectangle([13, 6, 18, 18], fill=gold + (255,), outline=OUTA)
    d.rectangle([32, 6, 37, 18], fill=gold + (255,), outline=OUTA)
    # reflet sur la tete
    d.line([(20, 9), (31, 9)], fill=(210, 178, 232, 220), width=2)
    _save(im, "shot_gavel")


# --- 7) generique ADEME : feuille de papier creme avec lignes ----------------
def shot_paper():
    im, d = _new()
    paper = (244, 241, 232)
    fold = (210, 204, 190)
    # feuille avec coin haut-droit plie
    body = [(8, 5), (28, 5), (34, 11), (34, 35), (8, 35)]
    d.polygon(body, fill=paper, outline=OUTA)
    # triangle du coin plie
    d.polygon([(28, 5), (34, 11), (28, 11)], fill=fold, outline=OUTA)
    # lignes de texte
    for i, ly in enumerate((15, 20, 25, 30)):
        x1 = 30 if i % 2 == 0 else 24
        d.line([(12, ly), (x1, ly)], fill=(150, 146, 134, 255), width=2)
    _save(im, "shot_paper")


def main():
    print("Projectiles thematiques (40x40, RGBA, pointe a droite) :")
    shot_stake()
    shot_fork()
    shot_chart()
    shot_error()
    shot_form()
    shot_gavel()
    shot_paper()
    print("OK. Lance maintenant : python3 gen_assets_data.py")


if __name__ == "__main__":
    main()
