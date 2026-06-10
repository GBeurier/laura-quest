#!/usr/bin/env python3
"""Genere les projectiles d'ARSENAL (pixel-art lisible, sobre) en feuilles 6 frames.

Sprites produits (horizontal, ART=2 -> taille affichee = moitie) :
  ammo_graine       312x52  (6x52)  graine doree qui tournoie
  ammo_graine_fire  336x56  (6x56)  graine enflammee (P3) -- flamme qui vacille
  ammo_cookie       312x52  (6x52)  cookie aux pepites qui tournoie
  ammo_gateau       360x60  (6x60)  part de gateau qui tournoie
  ammo_gateau_enfer 432x72  (6x72)  gateau DES ENFERS (P3) -- braises + flammes

Style : contour sombre epais, petit highlight, HALO chaud discret derriere les
sujets "feu" pour qu'on les voie bien sans en faire trop. Supersample x4 + LANCZOS.
Sortie -> assets/sprites/ ; relancer ensuite `python3 gen_assets_data.py`.
"""
import math, os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sprites")
SS = 4  # supersampling

def cell(size):
    return Image.new("RGBA", (size*SS, size*SS), (0, 0, 0, 0))

def draw(im):
    return ImageDraw.Draw(im)

def finish(frames, size):
    """frames: list of supersampled cells -> one downscaled horizontal sheet."""
    n = len(frames)
    sheet = Image.new("RGBA", (size*n, size), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f.resize((size, size), Image.LANCZOS), (i*size, 0))
    return sheet

def glow(im, cx, cy, r, col, layers=5, strength=0.5):
    """halo radial chaud, doux (compose sous le sujet)."""
    g = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = draw(g)
    for k in range(layers, 0, -1):
        rr = r*SS * (k/layers)
        a = int(255 * strength * (1 - (k-1)/layers) * 0.5)
        d.ellipse([cx*SS-rr, cy*SS-rr, cx*SS+rr, cy*SS+rr], fill=col+(a,))
    g = g.filter(ImageFilter.GaussianBlur(2*SS))
    im.alpha_composite(g)

def outline_poly(d, pts, fill, oc, ow):
    s = [(x*SS, y*SS) for (x, y) in pts]
    d.polygon(s, fill=oc)                 # base sombre (epaissie par le blur d'echelle)
    # contour : redessine le bord
    d.line(s+[s[0]], fill=oc, width=int(ow*SS))
    d.polygon(s, fill=fill)

def outline_ellipse(d, box, fill, oc, ow):
    b = [v*SS for v in box]
    o = int(ow*SS)
    d.ellipse([b[0]-o, b[1]-o, b[2]+o, b[3]+o], fill=oc)
    d.ellipse(b, fill=fill)

def teardrop(cx, cy, w, h, ang=0):
    """points d'une flamme (goutte pointe en haut), centre bas en (cx,cy)."""
    pts = []
    for t in range(0, 361, 12):
        a = math.radians(t)
        # rayon module : large en bas, pointu en haut
        rx = w/2 * (0.6 + 0.4*math.cos(a))
        ry = h/2
        x = math.cos(a) * rx
        y = -abs(math.sin(a))**0.8 * ry if math.sin(a) > 0 else math.sin(a)*ry*0.5
        # etire vers le haut
        if a < math.pi:
            y = -(t/180.0)*0 - (math.sin(a))*ry
        pts.append((x, y))
    # rotation + translation
    out = []
    ca, sa = math.cos(ang), math.sin(ang)
    for (x, y) in pts:
        out.append((cx + x*ca - y*sa, cy + x*sa + y*ca))
    return out

def flame_stack(im, cx, cy, scale, phase):
    """flammes superposees (rouge->orange->jaune->blanc) qui vacillent."""
    d = draw(im)
    flick = 1 + 0.18*math.sin(phase)
    sway = 2*math.sin(phase*1.3)
    layers = [
        ((242, 75, 30), 1.00),   # rouge-orange exterieur
        ((255, 138, 30), 0.74),  # orange
        ((255, 210, 63), 0.48),  # jaune
        ((255, 243, 196), 0.24), # coeur chaud
    ]
    for col, fr in layers:
        w = 17*scale*fr
        h = 26*scale*fr*flick
        pts = teardrop(cx+sway*fr, cy, w, h)
        d.polygon([(x*SS, y*SS) for (x, y) in pts], fill=col)

OUTLINE = (40, 26, 16)

# ---------------------------------------------------------------- GRAINE
def make_graine(size=52, fire=False):
    frames = []
    n = 6
    for i in range(n):
        ph = i/n * 2*math.pi
        im = cell(size)
        c = size/2
        sy = (c + 8) if fire else c          # graine plus basse quand elle brule (flammes au-dessus)
        if fire:
            glow(im, c, c+2, 25, (255, 140, 36), strength=0.75)
            # 3 langues de flamme decalees qui montent au-dessus de la graine
            flame_stack(im, c-4, c+14, scale=size/52*1.15, phase=ph)
            flame_stack(im, c+4, c+13, scale=size/52*1.25, phase=ph+1.6)
            flame_stack(im, c,   c+12, scale=size/52*1.55, phase=ph+0.7)
        d = draw(im)
        # graine = ovale incline qui tournoie
        ang = ph if not fire else ph*0.5
        gw, gh = (13, 18) if fire else (15, 21)
        ca, sa = math.cos(ang), math.sin(ang)
        pts = []
        for t in range(0, 360, 15):
            a = math.radians(t)
            x = math.cos(a)*gw/2
            y = math.sin(a)*gh/2
            pts.append((c + x*ca - y*sa, sy + x*sa + y*ca))
        outline_poly(d, pts, (232, 176, 74), OUTLINE, 2.4)
        # highlight
        hx, hy = c - 4*ca, sy - 5
        d.ellipse([(hx-3)*SS, (hy-4)*SS, (hx+3)*SS, (hy+4)*SS], fill=(255, 233, 168, 210))
        frames.append(im)
    return finish(frames, size)

# ---------------------------------------------------------------- COOKIE
def make_cookie(size=52):
    frames = []
    n = 6
    chips = [(-5, -4), (4, -2), (-1, 5), (6, 5), (-7, 3), (2, -7)]
    for i in range(n):
        ph = i/n * 2*math.pi
        im = cell(size); d = draw(im); c = size/2
        r = 17
        outline_ellipse(d, [c-r, c-r, c+r, c+r], (214, 160, 90), OUTLINE, 2.6)
        # bord plus fonce
        d.ellipse([(c-r+2)*SS, (c-r+2)*SS, (c+r-2)*SS, (c+r-2)*SS], outline=(168, 106, 46, 180), width=int(2*SS))
        # highlight
        d.ellipse([(c-9)*SS, (c-11)*SS, (c-1)*SS, (c-4)*SS], fill=(243, 217, 166, 200))
        # pepites (tournent)
        ca, sa = math.cos(ph), math.sin(ph)
        for (x, y) in chips:
            rx, ry = x*ca - y*sa, x*sa + y*ca
            d.ellipse([(c+rx-2.6)*SS, (c+ry-2.6)*SS, (c+rx+2.6)*SS, (c+ry+2.6)*SS], fill=(74, 42, 24))
        frames.append(im)
    return finish(frames, size)

# ---------------------------------------------------------------- GATEAU (part)
def make_gateau(size=60, enfer=False):
    frames = []
    n = 6
    for i in range(n):
        ph = i/n * 2*math.pi
        im = cell(size); c = size/2
        if enfer:
            glow(im, c, c, 30, (255, 70, 20), strength=0.7)
        d = draw(im)
        ang = ph if not enfer else 0.12*math.sin(ph)   # enfer : juste un leger balancement
        ca, sa = math.cos(ang), math.sin(ang)
        def R(x, y):
            return (c + x*ca - y*sa, c + x*sa + y*ca)
        # part de gateau : triangle (vue de cote) avec 2 etages
        base = (252, 201, 160) if not enfer else (58, 42, 46)   # genoise / charbon
        cream = (255, 243, 224) if not enfer else (90, 42, 46)
        body = [R(-15, 11), R(15, 11), R(11, -12), R(-11, -12)]
        outline_poly(d, body, base, OUTLINE if not enfer else (26, 14, 16), 2.6)
        # etage creme au milieu
        mid = [R(-13, 1), R(13, 1), R(12, -5), R(-12, -5)]
        d.polygon([(x*SS, y*SS) for (x, y) in mid], fill=cream)
        if enfer:
            # fissures de lave
            for (x0, y0, x1, y1) in [(-8, 8, -3, -6), (4, 9, 8, -4), (-1, 10, 1, -8)]:
                d.line([R(x0, y0)[0]*SS, R(x0, y0)[1]*SS, R(x1, y1)[0]*SS, R(x1, y1)[1]*SS],
                       fill=(255, 110, 30), width=int(2.2*SS))
                d.line([R(x0, y0)[0]*SS, R(x0, y0)[1]*SS, R((x0+x1)/2, (y0+y1)/2)[0]*SS, R((x0+x1)/2, (y0+y1)/2)[1]*SS],
                       fill=(255, 210, 63), width=int(1.2*SS))
            # flammes sur le dessus + braises
            flame_stack(im, c-5, c-9, scale=0.8, phase=ph)
            flame_stack(im, c+5, c-10, scale=0.95, phase=ph+1.7)
            flame_stack(im, c, c-13, scale=1.15, phase=ph+0.7)
            d = draw(im)
            for k in range(5):
                ea = ph*1.5 + k*1.25
                ex, ey = c + math.cos(ea)*16, c - 12 - (k % 3)*4 + math.sin(ea)*3
                d.ellipse([(ex-1.5)*SS, (ey-1.5)*SS, (ex+1.5)*SS, (ey+1.5)*SS], fill=(255, 184, 58))
        else:
            # cerise + glacage clair sur le dessus
            d.ellipse([(c-3)*SS, (c-19)*SS, (c+3)*SS, (c-13)*SS], fill=(226, 55, 79))
            d.ellipse([(c-2)*SS, (c-18)*SS, (c)*SS, (c-16)*SS], fill=(255, 200, 210))
        frames.append(im)
    return finish(frames, size)

def save(img, name):
    p = os.path.join(OUT, name + ".png")
    img.save(p)
    print("  %-20s %s" % (name, img.size))

if __name__ == "__main__":
    print("Projectiles d'arsenal ->", os.path.abspath(OUT))
    save(make_graine(52, fire=False), "ammo_graine")
    save(make_graine(56, fire=True),  "ammo_graine_fire")
    save(make_cookie(52),             "ammo_cookie")
    save(make_gateau(60, enfer=False),"ammo_gateau")
    save(make_gateau(72, enfer=True), "ammo_gateau_enfer")
    print("OK. Relance: python3 gen_assets_data.py")
