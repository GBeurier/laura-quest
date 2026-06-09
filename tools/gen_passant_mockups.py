"""Genere des MOCKUPS pour le PASSANT (figurant 'N', cf. enemies.passant).

Le passant = un CORPS (habits selon le biome + sexe) surmonte d'une TETE
"South Park" de face, choisie AU HASARD dans le pool du biome. La tete est un
ENFANT du corps (game.js attachHead) : elle dodeline et ne se mirroir pas.

Ce script produit des BOUCHE-TROU lisibles (couleurs par biome, sexe marque,
tetes numerotees) pour valider le code AVANT de generer les vrais assets :

  body_<biome>_<sexe>.png   feuille de MARCHE, 4 frames de 112x150 (sheet 448x150)
                            anim 'walk' (cf. CONFIG.anims, injecte pour les 8)
                            SANS TETE (cou en haut), ancre 'bot' (pieds en bas)
  head_<biome>_<sexe>_<n>.png  tete de face, 112x112, ancre 'bot' (menton en bas)

  biomes = champ / horti / labo / bureau   sexes = h / f   (n = 1..3 par defaut)

Tout est dessine a 2x (CONFIG.art.scale) -> affichage corps ~56x75, tete ~56.
Remplace ces PNG par tes vrais pixel-art (memes noms/tailles) puis :

    python3 tools/gen_passant_mockups.py
    python3 gen_assets_data.py        # OBLIGATOIRE ensuite (re-embarque)

Voir SPRITES.md (section Passant) pour la spec complete des vrais assets.
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, "assets", "sprites")

# SECURITE : ne JAMAIS ecraser un asset existant (mockup OU vrai PNG fourni). Ce
#  script ne fait que COMBLER les manquants (ex. nouveau biome 'pote', ou des
#  tetes que tu n'as pas encore dessinees). FORCE=1 (env) pour regenerer.
FORCE = os.environ.get("FORCE") == "1"


def _skip(path):
    if os.path.exists(path) and not FORCE:
        print("  skip   ", os.path.basename(path), "(existe -> non ecrase)")
        return True
    return False

# --- Corps (feuille de marche) -------------------------------------------
BFW, BFH, BN = 112, 150, 4        # 1 frame px reels (affichage = /2 -> 56x75)
GROUND = 146                      # y des pieds dans la frame (ancre 'bot')
NECK_Y = 50                       # y des epaules/cou (la tete s'attache ici)
BCX = BFW // 2

# --- Tete (face, 1 frame) ------------------------------------------------
HW, HH = 112, 112                 # affichage 56x56 ; menton ~ bas du canvas

# --- Palette par biome (manteau, pantalon, accent) -----------------------
BIOMES = {
    "champ":  dict(coat=(150, 170, 90),  pant=(122, 92, 58),  accent=(96, 134, 60),  lab=False, label="CHAMP"),
    "pote":   dict(coat=(214, 96, 110),  pant=(58, 78, 138),  accent=(240, 196, 70), lab=False, label="POTE"),   # colocs : sweat/jean casual
    "horti":  dict(coat=(60, 150, 138),  pant=(112, 90, 66),  accent=(40, 122, 108), lab=False, label="HORTI"),
    "labo":   dict(coat=(236, 239, 243), pant=(120, 128, 140), accent=(86, 150, 202), lab=True,  label="LABO"),
    "bureau": dict(coat=(62, 74, 112),   pant=(48, 56, 86),   accent=(184, 72, 72),  lab=False, label="BUREAU"),
}

SKIN = [(247, 206, 170), (226, 172, 122), (158, 108, 74)]
HAIR = [(46, 36, 30), (96, 64, 34), (126, 126, 130), (196, 160, 70)]


def _font(size):
    for path in ("DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


F_TAG = _font(15)
F_NUM = _font(20)


def _mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _ctext(d, cx, y, s, font, fill):
    w = d.textlength(s, font=font)
    d.text((cx - w / 2, y), s, font=font, fill=fill)


# ----------------------------------------------------------------------------
#  CORPS (sans tete) — 4 frames de marche
# ----------------------------------------------------------------------------
WALK = [  # (bob, balancement jambe avant, balancement bras)
    dict(bob=0,  leg=13,  arm=-11),
    dict(bob=-4, leg=0,   arm=0),
    dict(bob=0,  leg=-13, arm=11),
    dict(bob=-4, leg=0,   arm=0),
]


def draw_body(d, biome, sexe, p):
    pal = BIOMES[biome]
    bob = p["bob"]
    coat, pant, accent = pal["coat"], pal["pant"], pal["accent"]
    edge = _mix(coat, (0, 0, 0), 0.4)
    skin = SKIN[0]

    hip = 100 - 0  # y de la taille
    sh_y = NECK_Y + 6                       # epaules
    top = NECK_Y - bob

    # cou (peau) : relie le torse a la tete (qui s'attache vers NECK_Y)
    d.rounded_rectangle([BCX - 9, top - 10, BCX + 9, top + 14], radius=6, fill=skin)

    # jambes / jupe -----------------------------------------------------
    lg = p["leg"]
    foot_y = GROUND
    if sexe == "f":
        # jupe trapeze (oscille) + 2 mollets
        sway = lg // 3
        d.polygon([(BCX - 16, hip - bob), (BCX + 16, hip - bob),
                   (BCX + 30 + sway, hip + 34 - bob), (BCX - 30 + sway, hip + 34 - bob)],
                  fill=accent)
        for s, dx in ((1, 8), (-1, -8)):
            d.rounded_rectangle([BCX + dx - 7, hip + 30 - bob, BCX + dx + 7, foot_y], radius=6, fill=pant)
            d.ellipse([BCX + dx - 11, foot_y - 8, BCX + dx + 11, foot_y + 4], fill=edge)  # chaussure
    else:
        for s, dx in ((1, lg), (-1, -lg)):
            d.rounded_rectangle([BCX + dx - 9, hip - bob, BCX + dx + 9, foot_y], radius=7, fill=pant)
            d.ellipse([BCX + dx - 12, foot_y - 8, BCX + dx + 12, foot_y + 4], fill=edge)  # chaussure

    # torse / manteau ---------------------------------------------------
    d.rounded_rectangle([BCX - 26, top + 8, BCX + 26, hip + 6 - bob], radius=14, fill=coat)
    d.rounded_rectangle([BCX - 26, top + 8, BCX - 4, top + 44], radius=12, fill=_mix(coat, (255, 255, 255), 0.22))  # reflet
    if pal["lab"]:
        # blouse de labo : pans blancs + ligne de boutons + col d'accent
        d.line([(BCX, top + 12), (BCX, hip + 4 - bob)], fill=_mix(coat, (0, 0, 0), 0.12), width=2)
        d.polygon([(BCX - 8, top + 8), (BCX + 8, top + 8), (BCX, top + 26)], fill=accent)
    else:
        # accent (echarpe / cravate / tablier selon biome)
        if sexe == "h" and biome == "bureau":
            d.polygon([(BCX - 6, top + 10), (BCX + 6, top + 10), (BCX, hip - 18 - bob)], fill=accent)  # cravate
        else:
            d.rounded_rectangle([BCX - 26, top + 8, BCX + 26, top + 20], radius=8, fill=accent)        # col

    # bras (oscillent, devant le torse) ---------------------------------
    arm = p["arm"]
    for s in (1, -1):
        sx, sy = BCX + s * 24, sh_y - bob + 4
        fx, fy = sx + s * 2 + arm * s * 0.3, sy + 56
        d.line([(sx, sy), (fx, fy)], fill=_mix(coat, (0, 0, 0), 0.16), width=13)
        d.ellipse([fx - 7, fy - 7, fx + 7, fy + 7], fill=skin)   # main


def body_sheet(biome, sexe):
    sh = Image.new("RGBA", (BFW * BN, BFH), (0, 0, 0, 0))
    for i in range(BN):
        fr = Image.new("RGBA", (BFW, BFH), (0, 0, 0, 0))
        d = ImageDraw.Draw(fr, "RGBA")
        d.rectangle([1, 1, BFW - 2, BFH - 2], outline=(255, 255, 255, 36), width=1)  # repere de cellule
        draw_body(d, biome, sexe, WALK[i])
        # marqueur du point d'attache de la tete (croix discrete au cou)
        d.line([(BCX - 6, NECK_Y), (BCX + 6, NECK_Y)], fill=(255, 60, 60, 130), width=1)
        _ctext(d, BCX, 4, BIOMES[biome]["label"] + " " + sexe.upper(), F_TAG, (255, 255, 255, 170))
        sh.paste(fr, (i * BFW, 0), fr)
    out = os.path.join(SPR, "body_%s_%s.png" % (biome, sexe))
    sh.save(out)
    return out


# ----------------------------------------------------------------------------
#  TETE "South Park" (de face) — variete par numero
# ----------------------------------------------------------------------------
def draw_head(d, biome, sexe, n):
    accent = BIOMES[biome]["accent"]
    skin = SKIN[(n - 1) % len(SKIN)]
    hair = HAIR[(n + (1 if sexe == "f" else 0)) % len(HAIR)]
    edge = _mix(skin, (0, 0, 0), 0.35)
    cx = HW // 2
    cy = 60                       # centre de la tete
    R = 44                        # rayon (grosse tete)

    # tete ronde
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=skin, outline=edge, width=3)

    # cheveux : style par (sexe, n)
    if sexe == "h":
        if n == 1:                 # coupe courte
            d.pieslice([cx - R, cy - R - 4, cx + R, cy + 20], 180, 360, fill=hair)
        elif n == 2:               # cheveux + barbe
            d.pieslice([cx - R, cy - R - 6, cx + R, cy + 16], 180, 360, fill=hair)
            d.arc([cx - 30, cy - 6, cx + 30, cy + 40], 20, 160, fill=hair, width=8)
        else:                      # chauve (juste couronne)
            d.arc([cx - R + 4, cy - 8, cx + R - 4, cy + 30], 200, 340, fill=hair, width=6)
    else:
        if n == 1:                 # cheveux longs
            d.ellipse([cx - R - 6, cy - R - 2, cx + R + 6, cy + R + 10], fill=hair)
            d.ellipse([cx - R + 4, cy - R + 6, cx + R - 4, cy + R], fill=skin)  # decoupe du visage
        elif n == 2:               # couette
            d.pieslice([cx - R, cy - R - 4, cx + R, cy + 16], 180, 360, fill=hair)
            d.ellipse([cx + R - 10, cy - 22, cx + R + 10, cy - 2], fill=hair)
        else:                      # carre court
            d.pieslice([cx - R - 2, cy - R - 2, cx + R + 2, cy + 24], 180, 360, fill=hair)

    # yeux (grands, style cartoon)
    for s in (-1, 1):
        ex = cx + s * 16
        d.ellipse([ex - 12, cy - 14, ex + 12, cy + 12], fill=(255, 255, 255), outline=edge, width=2)
        d.ellipse([ex - 4, cy - 6, ex + 6, cy + 8], fill=(40, 40, 50))
    # lunettes pour le n=3
    if n == 3:
        for s in (-1, 1):
            ex = cx + s * 16
            d.ellipse([ex - 14, cy - 16, ex + 14, cy + 14], outline=(30, 30, 40), width=3)
        d.line([(cx - 4, cy - 2), (cx + 4, cy - 2)], fill=(30, 30, 40), width=3)

    # nez + bouche
    d.ellipse([cx - 3, cy + 12, cx + 5, cy + 22], fill=_mix(skin, (0, 0, 0), 0.18))
    d.arc([cx - 14, cy + 18, cx + 14, cy + 40], 20, 160, fill=(150, 70, 70), width=4)

    # badge numero (identifie la variante dans le mockup)
    d.ellipse([HW - 26, HH - 26, HW - 4, HH - 4], fill=accent, outline=(255, 255, 255), width=2)
    _ctext(d, HW - 15, HH - 24, str(n), F_NUM, (255, 255, 255))


def head_png(biome, sexe, n):
    im = Image.new("RGBA", (HW, HH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im, "RGBA")
    draw_head(d, biome, sexe, n)
    out = os.path.join(SPR, "head_%s_%s_%d.png" % (biome, sexe, n))
    im.save(out)
    return out


def main(n_heads=3):
    print("Mockups PASSANT (corps + tetes), 2x :")
    nb = 0
    for biome in BIOMES:
        for sexe in ("h", "f"):
            body_sheet(biome, sexe)
            nb += 1
            for n in range(1, n_heads + 1):
                head_png(biome, sexe, n)
                nb += 1
    print("  %d corps (448x150, 4x112x150) + %d tetes (112x112)"
          % (len(BIOMES) * 2, len(BIOMES) * 2 * n_heads))
    print("OK (%d PNG). Lance maintenant : python3 gen_assets_data.py" % nb)


if __name__ == "__main__":
    main()
