#!/usr/bin/env python3
"""raw/ (Codex image_gen) -> assets/sprites/ pour le decor de la campagne Marcos.

Mecanique seulement (crop / chroma-key / echelle / couture), tailles = analogues :
  tile_bamboo      -> 144x88 : sujet detoure cale sur la bbox de tile_panel (0,11)-(129,81)
                      (bas = bord avant marchable, meme emprise que le panneau solaire)
  bamboo_leg       -> 96x48  : un troncon du poteau, 2 copies aux x de panel_leg (24 / 60, 13px)
  bg_java_*        -> bandes parallax : ciel magenta -> alpha, fenetre la plus TILEABLE
                      (comme _hazardgen/build.py:seam_window) + fondu de couture, puis
                      echelle a la largeur de l'analogue, posee en bas du canevas.
  bg_marcos_*      -> plein ecran, cover-fit, JPEG (comme bg_map / bg_chapter / bg_win)
Usage : python _javagen/build.py [nom ...]   puis   python gen_assets_data.py
"""
import os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(HERE, 'raw')
FINAL = os.path.join(HERE, 'final')
SPR = os.path.join(ROOT, 'assets', 'sprites')

BANDS = {  # nom -> (W, H, bas opaque force ?, fenetre de couture (min, max) en fraction de largeur)
    'bg_java_volcano': (960, 480, True, (0.45, 0.62)),   # = bg_mountains (fenetre etroite -> volcan agrandi)
    'bg_java_village': (768, 300, True, (0.70, 0.96)),   # = bg_hills
    'bg_java_paddy':   (2027, 370, False, (0.70, 0.96)), # = bg_field
}
NO_DARK_KEY = {'bg_java_paddy'}   # ses filets d'ombrage NOIRS sont peints en violet sombre : ne pas les detourer
SCREENS = {'bg_marcos_map': (1920, 1056), 'bg_marcos_chapter': (1672, 941), 'bg_marcos_win': (1672, 941)}


def key_magenta(im, dark=False):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = ((np.abs(r - 255) + g + np.abs(b - 255) < 90) | ((r > 150) & (b > 150) & (g < 110))
          | ((r > 70) & (b > 70) & (g < 120) & (np.abs(r - b) < 105) & ((r + b - 2 * g) > 140)))
    if dark:   # silhouettes "ombre magenta" (violet sombre) que Codex peint parfois dans le ciel
        bg |= (g < 40) & (r > g + 12) & (b > g + 12) & (np.abs(r - b) < 70)
        bg |= (r > g + 45) & (b > g + 45) & (np.abs(r - b) < 70)   # franges roses (fumee, bords clairs)
    a[..., 3] = np.where(bg, 0, 255)
    a[bg, 0:3] = 0
    return Image.fromarray(a.astype(np.uint8))


def trim(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def resize_rgba(im, size, nearest=False):
    """Resize premultiplie (pas de frange noire du chroma) + alpha binaire."""
    arr = np.array(im.convert('RGBA')).astype(np.float32)
    al = arr[..., 3:4] / 255.0
    arr[..., :3] *= al
    pm = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).resize(size, Image.NEAREST if nearest else Image.LANCZOS)
    out = np.array(pm).astype(np.float32)
    rgb = np.zeros_like(out[..., :3])
    np.divide(out[..., :3] * 255.0, out[..., 3:4], out=rgb, where=out[..., 3:4] > 0)
    out[..., :3] = np.clip(rgb, 0, 255)
    keep = out[..., 3] >= 110
    out[..., 3] = np.where(keep, 255, 0)
    out[~keep, :3] = 0
    return Image.fromarray(out.astype(np.uint8))


def save(im, name, ext='.png', **kw):
    os.makedirs(FINAL, exist_ok=True)
    out = os.path.join(SPR, name + ext)
    im.save(out, **kw)
    prev = Image.new('RGBA', im.size, (120, 170, 220, 255))
    prev.alpha_composite(im.convert('RGBA'))
    prev.convert('RGB').save(os.path.join(FINAL, name + '_preview.png'))
    print('wrote %s %s' % (out, im.size))


WALK_Y = 60      # ligne marchable dans le cap (art px) : CAP_WALK_Y=30 affiche x ART=2 (game.js)


def build_tile_bamboo():
    """Le cadre est mis a la largeur de tile_panel (129) puis cale VERTICALEMENT
    pour que le HAUT de la poutre avant (bande opaque quasi pleine largeur la plus
    basse, au-dessus des moignons de pieds) tombe sur la ligne marchable WALK_Y."""
    im = trim(key_magenta(Image.open(os.path.join(RAW, 'tile_bamboo.png'))))
    bx0, bx1 = 0, 129                                    # emprise horizontale de tile_panel
    s = (bx1 - bx0) / im.width
    im = resize_rgba(im, (bx1 - bx0, max(1, round(im.height * s))))
    frac = (np.array(im)[..., 3] > 0).mean(axis=1)
    y = im.height - 1
    while y > 0 and frac[y] < 0.75:                      # moignons de pieds
        y -= 1
    while y > 0 and frac[y - 1] >= 0.75:                 # epaisseur de la poutre avant
        y -= 1
    beam_top = y
    top = WALK_Y - beam_top
    cv = Image.new('RGBA', (144, 88), (0, 0, 0, 0))
    if top < 0:                                          # trop haut : on coupe le haut du cadre
        im = im.crop((0, -top, im.width, im.height)); top = 0
    cv.alpha_composite(im.crop((0, 0, im.width, min(im.height, 88 - top))), (bx0, top))
    print('  tile_bamboo beam_top=%d -> y=%d' % (beam_top, WALK_Y))
    save(cv, 'tile_bamboo')


def build_bamboo_leg():
    im = trim(key_magenta(Image.open(os.path.join(RAW, 'bamboo_leg.png'))))
    # coeur du poteau : colonnes majoritairement opaques (vire les bavures laterales)
    a = np.array(im)[..., 3] > 0
    cols = np.flatnonzero(a.mean(axis=0) > 0.6)
    im = im.crop((int(cols[0]), 0, int(cols[-1]) + 1, im.height))
    pw = 13
    seg_h = round(im.width * 48 / pw)                    # troncon au bon ratio 13x48
    # troncon le plus UNIFORME (entre deux noeuds : un noeud etire en Y par le
    #  moteur ferait une longue bande) = variance minimale de la couleur par rangee
    rows = np.array(im.convert('RGB')).astype(np.float32).mean(axis=1)
    best = None
    for yy in range(0, max(1, im.height - seg_h), 2):
        v = rows[yy:yy + seg_h].std(axis=0).sum()
        if best is None or v < best[0]:
            best = (v, yy)
    y0 = best[1]
    seg = resize_rgba(im.crop((0, y0, im.width, min(im.height, y0 + seg_h))), (pw, 48))
    seg_arr = np.array(seg); seg_arr[..., 3] = 255       # poteau plein (pas de trou au stretch)
    seg = Image.fromarray(seg_arr)
    cv = Image.new('RGBA', (96, 48), (0, 0, 0, 0))
    for x in (24, 60):                                   # memes x que panel_leg
        cv.alpha_composite(seg, (x, 0))
    save(cv, 'bamboo_leg')


def seam_window(arr, lo=0.70, hi=0.96):
    """Fenetre [x0, x0+w) dont les colonnes de bord se ressemblent le plus
    (alpha + couleur) -> pavage sans couture visible."""
    H, W, _ = arr.shape
    best = None
    step = max(2, W // 300)
    for w in range(int(W * lo), int(W * hi), step):
        for x0 in range(0, W - w, step):
            c = np.mean(np.abs(arr[:, x0] - arr[:, x0 + w]))
            if best is None or c < best[0]:
                best = (c, x0, w)
    return best


def build_band(name):
    W, H, solid_bottom, (lo, hi) = BANDS[name]
    im = trim(key_magenta(Image.open(os.path.join(RAW, name + '.png')), dark=name not in NO_DARK_KEY))
    arr = np.array(im).astype(np.float32)
    arr[..., :3] *= arr[..., 3:4] / 255.0                # couleur ponderee alpha pour la mesure
    lo = max(lo, min(hi - 0.02, im.height * W / H / im.width))   # fenetre assez large pour ne jamais couper le haut
    cost, x0, w = seam_window(arr, lo, hi)
    src = np.array(im).astype(np.float32)
    ov = max(8, int(w * 0.06))                           # fondu de couture : la fin du motif glisse dans le debut
    tile = src[:, x0:x0 + w].copy()
    tail = src[:, x0 + w:x0 + w + ov] if x0 + w + ov <= src.shape[1] else src[:, x0 + w - ov:x0 + w]
    ramp = np.linspace(1.0, 0.0, ov)[None, :, None]
    tile[:, :ov] = tail * ramp + tile[:, :ov] * (1 - ramp)
    tile[..., 3] = np.where(tile[..., 3] >= 128, 255, 0)
    t = Image.fromarray(np.clip(tile, 0, 255).astype(np.uint8))
    h = round(t.height * W / t.width)
    t = resize_rgba(t, (W, h))
    if h > H:                                            # trop haut : on garde le bas (le sol)
        t = t.crop((0, h - H, W, h)); h = H
    cv = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cv.alpha_composite(t, (0, H - h))
    if solid_bottom:                                     # comme l'analogue : plus aucun trou sous la crete
        a = np.array(cv)
        for x in range(W):
            col = np.flatnonzero(a[:, x, 3] > 0)
            if len(col):
                top = col[0]
                fill = a[top:, x].copy()
                hole = fill[:, 3] == 0
                if hole.any():
                    last = None
                    for y in range(len(fill)):
                        if fill[y, 3]:
                            last = fill[y].copy()
                        elif last is not None:
                            fill[y] = last
                    a[top:, x] = fill
        cv = Image.fromarray(a)
    print('  %s seam-cost %.1f window x0=%d w=%d' % (name, cost, x0, w))
    save(cv, name)


def build_screen(name):
    W, H = SCREENS[name]
    im = Image.open(os.path.join(RAW, name + '.png')).convert('RGB')
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    save(im.crop((x, y, x + W, y + H)), name, '.jpg', quality=92)


def main():
    names = sys.argv[1:] or ['tile_bamboo', 'bamboo_leg', *BANDS, *SCREENS]
    for n in names:
        if not os.path.exists(os.path.join(RAW, n + '.png')):
            print('skip (pas de raw)', n); continue
        if n == 'tile_bamboo': build_tile_bamboo()
        elif n == 'bamboo_leg': build_bamboo_leg()
        elif n in BANDS: build_band(n)
        elif n in SCREENS: build_screen(n)


if __name__ == '__main__':
    main()
