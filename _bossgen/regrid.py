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
    bg = (
        (np.abs(r-255)+np.abs(g-0)+np.abs(b-255) < tol)
        | ((r > 150) & (b > 150) & (g < 110))
        | ((r > 70) & (b > 70) & (g < 120) & (np.abs(r-b) < 105) & ((r + b - 2*g) > 140))
    )
    a[..., 3] = np.where(bg, 0, 255)
    a[bg, 0:3] = 0
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

def resize_rgba(im, size):
    """Resize RGBA with premultiplied alpha so chroma-key RGB cannot bleed."""
    arr = np.array(im.convert('RGBA')).astype(np.float32)
    alpha = arr[..., 3:4] / 255.0
    arr[..., 0:3] *= alpha
    pm = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')
    pm = pm.resize(size, Image.LANCZOS)
    out = np.array(pm).astype(np.float32)
    alpha = out[..., 3:4]
    rgb = np.zeros_like(out[..., 0:3])
    np.divide(out[..., 0:3] * 255.0, alpha, out=rgb, where=alpha > 0)
    out[..., 0:3] = np.clip(rgb, 0, 255)
    keep = out[..., 3] >= 96
    out[..., 3] = np.where(keep, 255, 0)
    out[~keep, 0:3] = 0
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')

def projection_runs(mask, N):
    W = mask.shape[1]
    close_gap = max(8, W // (N * 45))
    cols = mask.any(axis=0)
    xs = np.flatnonzero(cols)
    if len(xs) == 0:
        return [(0, W)]

    runs = []
    start = prev = int(xs[0])
    for x in xs[1:]:
        x = int(x)
        if x - prev <= close_gap + 1:
            prev = x
        else:
            runs.append((start, prev + 1))
            start = prev = x
    runs.append((start, prev + 1))

    while len(runs) > N:
        gaps = [(runs[i + 1][0] - runs[i][1], i) for i in range(len(runs) - 1)]
        _, i = min(gaps)
        runs[i:i + 2] = [(runs[i][0], runs[i + 1][1])]

    if len(runs) < N:
        widths = np.array([b - a for a, b in runs], dtype=np.float32)
        unit = float(np.median(widths)) if len(widths) else W / N
        pieces = [max(1, int(round((b - a) / max(1.0, unit)))) for a, b in runs]
        while sum(pieces) < N:
            ratios = [((runs[i][1] - runs[i][0]) / pieces[i], i) for i in range(len(runs))]
            _, i = max(ratios)
            pieces[i] += 1
        while sum(pieces) > N:
            ratios = [((runs[i][1] - runs[i][0]) / pieces[i], i) for i in range(len(runs)) if pieces[i] > 1]
            if not ratios:
                break
            _, i = min(ratios)
            pieces[i] -= 1

        split = []
        for (a, b), n in zip(runs, pieces):
            edges = np.linspace(a, b, n + 1).round().astype(int)
            split.extend((int(edges[i]), int(edges[i + 1])) for i in range(n))
        runs = split

    if len(runs) != N:
        cw = W // N
        return [(i * cw, (i + 1) * cw if i < N - 1 else W) for i in range(N)]

    return runs

def strip_final_magenta(im):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r, g, b, alpha = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mag = (
        (alpha > 0)
        & (r > 170) & (b > 150) & (g < 105)
        & (np.abs(r - b) < 130)
    )
    a[mag, 0:4] = 0
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

def run(inp, boss, kind, N):
    p = PARAMS.get(boss, PARAMS['default'])
    img = key_magenta(Image.open(inp))
    W, H = img.size
    mask = np.array(img)[..., 3] > 0
    x_runs = projection_runs(mask, N)
    pad = max(2, W // (N * 120))
    cells = []
    for x0, x1 in x_runs:
        x0 = max(0, x0 - pad)
        x1 = min(W, x1 + pad)
        c = img.crop((x0, 0, max(x0 + 1, x1), H))
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
        c = resize_rgba(c, (nw, nh))
        sheet.alpha_composite(c, (i*CW + (CW-nw)//2, BASE-nh))
    sheet = strip_final_magenta(sheet)
    import os; os.makedirs(FINAL, exist_ok=True)
    final_out = f'{FINAL}/boss_{boss}_{kind}.png'
    sheet.save(final_out)
    out = f'{SPR}/boss_{boss}_{kind}.png'
    sheet.save(out)
    # preview on gray
    prev = Image.new('RGBA', sheet.size, (88, 94, 102, 255)); prev.alpha_composite(sheet)
    prev.convert('RGB').save(f'{FINAL}/{boss}_{kind}_preview.png')
    assert sheet.size == (CW*N, CH) and sheet.mode == 'RGBA'
    print(f'wrote {final_out} and {out} {sheet.size} N={N} scale={s:.3f}')

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('inp'); ap.add_argument('boss')
    ap.add_argument('--frames', type=int, default=6)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--move', action='store_const', dest='kind', const='move')
    g.add_argument('--atk', action='store_const', dest='kind', const='atk')
    a = ap.parse_args()
    run(a.inp, a.boss, a.kind, a.frames)
