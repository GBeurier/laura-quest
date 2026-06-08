"""
artkit.py — Boite a outils graphique partagee pour "Laura's Quest".

Style vise : Dora l'exploratrice / cartoon TV jeunesse.
  - GROS contours noirs (chauds, pas full black).
  - Aplats de couleurs vives et saturees.
  - Formes rondes, amicales, grosses bouilles expressives.
  - Fond TRANSPARENT (PNG ARGB).

Tous les scripts de generation de sprites importent ce module pour rester
coherents. Pour la "passe serieuse" plus tard : on peut soit ameliorer ces
helpers, soit remplacer directement les PNG dans assets/sprites/.

Usage type :
    import artkit as ak
    s, c = ak.new(64, 64)
    ak.circle(c, 32, 32, 24)
    ak.draw(c, ak.RICE, ow=5)        # remplit + contour
    ak.eyes(c, 32, 28, spread=10, r=6)
    ak.smile(c, 32, 38, 16, 8)
    ak.save(s, "hero_idle")
"""
import cairo
import math
import os

SPRITES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "sprites")

# --- Palette commune (hex) -------------------------------------------------
OUTLINE = "#2a1d18"   # presque noir, chaud
WHITE   = "#ffffff"
CREAM   = "#fbf1d8"
RICE    = "#f6e7c1"   # riz / grains
RICE_HI = "#ffffff"

TERRA   = "#d98b4a"   # pot terre cuite
TERRA_D = "#b96a30"   # ombre pot
WHEEL   = "#3a3340"   # roulettes
PINK    = "#ff67a6"   # accents / joues
PINK_D  = "#e84d8c"

SUN      = "#ffd23f"  # soleil coeur
SUN_RAY  = "#ffa62b"  # rayons
SUN_HI   = "#fff3b0"

LEAF     = "#5cbf4a"  # feuillage riz
LEAF_D   = "#3e9b3a"
SOIL     = "#7c5a3a"  # terre
SOIL_D   = "#5e4128"

PANEL    = "#33406b"  # panneau solaire cadre
PANEL_CELL = "#5b86c9" # cellules
PANEL_HI = "#9fc7ef"
METAL    = "#b8c0cc"  # structure metal

TRUCK    = "#e0483f"  # camion cabine
TRUCK_D  = "#b8352e"
TRAILER  = "#9aa3ad"

SUIT     = "#2b3a55"  # assureur costume
SUIT_D   = "#1d2840"
SKIN     = "#f0c29b"
SKIN_D   = "#d79a6e"
TIE      = "#c0392b"
CASE     = "#6b4a2b"  # mallette

PAPER    = "#f4f1e8"  # rapport
PAPER_SH = "#d9d2bf"
ADEME_G  = "#4ca64c"  # vert ADEME
INK      = "#39424e"

LAB      = "#eef1f4"  # blouse prof
LAB_SH   = "#cdd5dd"
GLASS    = "#cfeefb"

COOKIE   = "#c98a4b"  # cookie
COOKIE_D = "#9c6630"
CHOC     = "#5a3a22"
CAKE     = "#ffd9e6"  # gateau glacage
CAKE_D   = "#ff9ec2"
SEED     = "#e7c87a"  # graine

TEAR     = "#5ac8fa"  # larme
TEAR_D   = "#2f9fe0"
HEART    = "#ff5d6c"  # coeur vie
HEART_D  = "#e23b50"
SKY      = "#8fd0f0"
SHADOW   = "#000000"


# --- Coeur du moteur de dessin --------------------------------------------
def rgb(h):
    """'#rrggbb' -> (r,g,b) en floats 0..1."""
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def new(w, h):
    """Cree une surface transparente + un contexte. Retourne (surface, ctx)."""
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, w, h)
    ctx = cairo.Context(surf)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    return surf, ctx


def save(surf, name):
    """Ecrit le PNG dans assets/sprites/<name>.png."""
    os.makedirs(SPRITES_DIR, exist_ok=True)
    path = os.path.join(SPRITES_DIR, name + ".png")
    surf.write_to_png(path)
    return path


def set_hex(ctx, h, a=1.0):
    r, g, b = rgb(h)
    ctx.set_source_rgba(r, g, b, a)


def draw(ctx, fill=None, outline=OUTLINE, ow=4, a=1.0):
    """Remplit le path courant puis le contoure. Conserve le path ? non : consomme.
    Passe fill=None pour ne faire que le contour."""
    if fill is not None:
        set_hex(ctx, fill, a)
        ctx.fill_preserve()
    if outline is not None and ow > 0:
        set_hex(ctx, outline)
        ctx.set_line_width(ow)
        ctx.stroke()
    else:
        ctx.new_path()


# --- Primitives de forme (creent un path, ne dessinent pas) ----------------
def circle(ctx, cx, cy, r):
    ctx.new_sub_path()
    ctx.arc(cx, cy, r, 0, 2 * math.pi)


def ellipse(ctx, cx, cy, rx, ry):
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(rx, ry)
    ctx.new_sub_path()
    ctx.arc(0, 0, 1, 0, 2 * math.pi)
    ctx.restore()


def rrect(ctx, x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.arc(x + r, y + r, r, math.pi, 3 * math.pi / 2)
    ctx.close_path()


def poly(ctx, pts):
    ctx.new_sub_path()
    ctx.move_to(*pts[0])
    for p in pts[1:]:
        ctx.line_to(*p)
    ctx.close_path()


# --- Bouilles : yeux, sourires, joues --------------------------------------
def eyes(ctx, cx, cy, spread=10, r=6, look=(0.0, 0.0), pupil=0.45):
    """Deux yeux ronds blancs + pupille noire. look=(dx,dy) en -1..1 oriente le regard."""
    for sx in (-1, 1):
        ex = cx + sx * spread
        circle(ctx, ex, cy, r)
        draw(ctx, WHITE, ow=max(2, r * 0.45))
        px = ex + look[0] * r * 0.5
        py = cy + look[1] * r * 0.5
        circle(ctx, px, py, r * pupil)
        draw(ctx, OUTLINE, outline=None)


def smile(ctx, cx, cy, w, h, lw=4, up=True):
    """Sourire (up=True) ou moue (up=False)."""
    ctx.save()
    ctx.new_path()
    if up:
        ctx.move_to(cx - w / 2, cy)
        ctx.curve_to(cx - w / 4, cy + h, cx + w / 4, cy + h, cx + w / 2, cy)
    else:
        ctx.move_to(cx - w / 2, cy + h)
        ctx.curve_to(cx - w / 4, cy, cx + w / 4, cy, cx + w / 2, cy + h)
    set_hex(ctx, OUTLINE)
    ctx.set_line_width(lw)
    ctx.stroke()
    ctx.restore()


def blush(ctx, cx, cy, spread=14, r=4):
    for sx in (-1, 1):
        ellipse(ctx, cx + sx * spread, cy, r * 1.3, r)
        draw(ctx, PINK, outline=None, a=0.8)


def brow(ctx, x1, y1, x2, y2, lw=4):
    ctx.new_path()
    ctx.move_to(x1, y1)
    ctx.line_to(x2, y2)
    set_hex(ctx, OUTLINE)
    ctx.set_line_width(lw)
    ctx.stroke()


def star(ctx, cx, cy, ro, ri, n=5, rot=-math.pi / 2):
    ctx.new_sub_path()
    for i in range(n * 2):
        ang = rot + i * math.pi / n
        rr = ro if i % 2 == 0 else ri
        x = cx + math.cos(ang) * rr
        y = cy + math.sin(ang) * rr
        (ctx.move_to if i == 0 else ctx.line_to)(x, y)
    ctx.close_path()


def shadow(ctx, cx, cy, rx, ry=None):
    """Petite ombre portee douce sous un perso (a appeler en premier)."""
    ry = ry if ry is not None else rx * 0.35
    ellipse(ctx, cx, cy, rx, ry)
    set_hex(ctx, SHADOW, 0.18)
    ctx.fill()
    ctx.new_path()


if __name__ == "__main__":
    # Petit auto-test : une bouille temoin.
    s, c = new(64, 64)
    circle(c, 32, 34, 24)
    draw(c, SUN, ow=5)
    eyes(c, 32, 30, spread=9, r=6)
    smile(c, 32, 40, 18, 9)
    blush(c, 32, 38, spread=18, r=4)
    save(s, "_artkit_selftest")
    print("artkit OK ->", os.path.join(SPRITES_DIR, "_artkit_selftest.png"))
