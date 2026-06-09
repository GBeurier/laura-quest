#!/usr/bin/env python3
"""Turn an AI pixel-art sprite STRIP (N frames in one row on flat magenta) into a
clean N-frame game sheet KAPLAY can slice into equal columns.

Primary method = EVEN SLICE: cut the strip into N equal columns, trim each cell to
its content, scale ALL frames by one global factor (so the character stays one
size; capped so the tallest frame never clips), then re-place each frame
centered with feet on a common baseline inside a 248x280 cell. Output = N*248 x 280
RGBA. Preserves the AI's drawn frames; only normalizes spacing/scale/baseline.

Usage: python3 _bossgen/regrid.py <in_strip.png> <boss> [--frames 6] [--move|--atk]
       writes assets/sprites/boss_<boss>_<move|atk>.png + a QA preview.
"""
import sys, argparse
from PIL import Image
import numpy as np

CW, CH, BASE = 248, 280, 264          # cell w/h and feet baseline within cell
ROOT = '/home/delete/laura_quest'
SPR = ROOT + '/assets/sprites'
FINAL = ROOT + '/_bossgen/final'

# per-boss vertical target (character height in px) and width cap
PARAMS = {
    'default':      dict(targeth=250, maxw=224),
    'proprietaire': dict(targeth=244, maxw=234),
    'agriculteur':  dict(targeth=252, maxw=226),
    'michael':      dict(targeth=256, maxw=216),
    'rstudio':      dict(targeth=244, maxw=230),
    'cendrine':     dict(targeth=252, maxw=216),
    'jury':         dict(targeth=262, maxw=246),
}

def key_magenta(im, tol=72):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (np.abs(r-255)+np.abs(g-0)+np.abs(b-255) < tol) | ((r > 150) & (b > 150) & (g < 110))
    a[..., 3] = np.where(bg, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

def run(inp, boss, kind, N):
    p = PARAMS.get(boss, PARAMS['default'])
    img = key_magenta(Image.open(inp))
    W, H = img.size
    cw = W // N
    cells = []
    for i in range(N):
        c = img.crop((i*cw, 0, (i+1)*cw if i < N-1 else W, H))
        bb = c.getbbox()
        cells.append(c.crop(bb) if bb else c)
    heights = sorted(c.height for c in cells)
    med = heights[len(heights)//2]
    maxh = max(c.height for c in cells)
    # scale: median -> targeth, but never let the tallest frame exceed the cell
    s = min(p['targeth']/med, (CH-4)/maxh)
    sheet = Image.new('RGBA', (CW*N, CH), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        nw, nh = max(1, round(c.width*s)), max(1, round(c.height*s))
        if nw > p['maxw']:
            s2 = p['maxw']/nw; nw, nh = p['maxw'], max(1, round(nh*s2))
        c = c.resize((nw, nh), Image.LANCZOS)
        sheet.alpha_composite(c, (i*CW + (CW-nw)//2, BASE-nh))
    out = f'{SPR}/boss_{boss}_{kind}.png'
    sheet.save(out)
    # preview on gray
    import os; os.makedirs(FINAL, exist_ok=True)
    prev = Image.new('RGBA', sheet.size, (88, 94, 102, 255)); prev.alpha_composite(sheet)
    prev.convert('RGB').save(f'{FINAL}/{boss}_{kind}_preview.png')
    assert sheet.size == (CW*N, CH) and sheet.mode == 'RGBA'
    print(f'wrote {out} {sheet.size} N={N} scale={s:.3f}')

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('inp'); ap.add_argument('boss')
    ap.add_argument('--frames', type=int, default=6)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--move', action='store_const', dest='kind', const='move')
    g.add_argument('--atk', action='store_const', dest='kind', const='atk')
    a = ap.parse_args()
    run(a.inp, a.boss, a.kind, a.frames)
