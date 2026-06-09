#!/usr/bin/env python3
"""Assemble AI-generated transparent boss cutouts into the game's exact boss
sheets: 992x280 = 4 frames of 248x280, anchor bottom-center, feet on a common
baseline, character facing LEFT.

This is MECHANICAL packaging only (scale / center / baseline / subtle motion);
the artwork itself is AI-generated (Codex image_gen). Reads keyed cutouts from
_bossgen/cut/<boss>_idle.png and _bossgen/cut/<boss>_atk.png and writes
assets/sprites/boss_<boss>_move.png and boss_<boss>_atk.png, plus a QA preview.

Usage: python3 _bossgen/assemble.py <boss> [<boss> ...]
"""
import sys, os
from PIL import Image, ImageEnhance

SHEET_W, SHEET_H, N = 992, 280, 4
FW = SHEET_W // N            # 248
BASELINE = 262               # feet y within a cell (anchor 'bot')
ROOT = '/home/delete/laura_quest'
SPR = os.path.join(ROOT, 'assets', 'sprites')
CUT = os.path.join(ROOT, '_bossgen', 'cut')
FINAL = os.path.join(ROOT, '_bossgen', 'final')

# per-boss tuning. target_h = character pixel height in the 280 cell; max_w caps
# width so it fits 248; bob = idle breathe px; reach = attack lunge-left px.
PARAMS = {
    'default':      dict(target_h=250, max_w=222, bob=7,  reach=18, hurt_deg=-7),
    'proprietaire': dict(target_h=246, max_w=230, bob=6,  reach=22, hurt_deg=-6),
    'agriculteur':  dict(target_h=252, max_w=226, bob=8,  reach=20, hurt_deg=-8),
    'michael':      dict(target_h=256, max_w=216, bob=7,  reach=20, hurt_deg=-7),
    'rstudio':      dict(target_h=246, max_w=228, bob=5,  reach=16, hurt_deg=-5),
    'cendrine':     dict(target_h=252, max_w=216, bob=7,  reach=18, hurt_deg=-8),
    'jury':         dict(target_h=258, max_w=244, bob=4,  reach=12, hurt_deg=-3),
}

def trim(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im

def fit(im, target_h, max_w):
    im = trim(im)
    w, h = im.size
    s = target_h / h
    if w * s > max_w:
        s = max_w / w
    return im.resize((max(1, round(w*s)), max(1, round(h*s))), Image.LANCZOS)

def red_tint(im, amt=0.5):
    r, g, b, a = im.split()
    g = g.point(lambda v: int(v*(1-amt)))
    b = b.point(lambda v: int(v*(1-amt)))
    r = r.point(lambda v: min(255, int(v*1.15)))
    return Image.merge('RGBA', (r, g, b, a))

def rot(im, deg):
    return im.rotate(deg, resample=Image.BICUBIC, expand=True)

def cell_with(spr, dx=0, dy=0):
    c = Image.new('RGBA', (FW, SHEET_H), (0, 0, 0, 0))
    x = (FW - spr.width)//2 + dx
    y = BASELINE - spr.height + dy
    c.alpha_composite(spr, (x, y))
    return c

def make_sheet(poses):
    sh = Image.new('RGBA', (SHEET_W, SHEET_H), (0, 0, 0, 0))
    for i, (spr, dx, dy) in enumerate(poses):
        sh.alpha_composite(cell_with(spr, dx, dy), (i*FW, 0))
    return sh

def build(boss):
    p = PARAMS.get(boss, PARAMS['default'])
    idle = fit(Image.open(os.path.join(CUT, f'{boss}_idle.png')).convert('RGBA'), p['target_h'], p['max_w'])
    atk  = fit(Image.open(os.path.join(CUT, f'{boss}_atk.png')).convert('RGBA'),  p['target_h'], p['max_w'])
    bob, reach, hd = p['bob'], p['reach'], p['hurt_deg']
    hurt = rot(red_tint(idle), hd)
    move = make_sheet([(idle, 0, 0), (idle, 0, -bob), (idle, 0, -2), (hurt, 6, -3)])
    atks = make_sheet([(atk, 10, -2), (atk, 0, 0), (atk, -reach, 2), (atk, -4, 0)])
    move.save(os.path.join(SPR, f'boss_{boss}_move.png'))
    atks.save(os.path.join(SPR, f'boss_{boss}_atk.png'))
    # QA preview: both sheets stacked on a mid-gray background
    prev = Image.new('RGBA', (SHEET_W, SHEET_H*2+12), (90, 96, 104, 255))
    prev.alpha_composite(move, (0, 0)); prev.alpha_composite(atks, (0, SHEET_H+12))
    os.makedirs(FINAL, exist_ok=True)
    prev.convert('RGB').save(os.path.join(FINAL, f'{boss}_preview.png'))
    # validate
    for nm in (f'boss_{boss}_move.png', f'boss_{boss}_atk.png'):
        im = Image.open(os.path.join(SPR, nm))
        assert im.size == (SHEET_W, SHEET_H), f'{nm} is {im.size}'
        assert im.mode == 'RGBA', f'{nm} mode {im.mode}'
        assert im.getpixel((1, 1))[3] == 0, f'{nm} corner not transparent'
    print(f'OK {boss}: move+atk 992x280 RGBA; preview _bossgen/final/{boss}_preview.png')

if __name__ == '__main__':
    for b in (sys.argv[1:] or ['michael']):
        build(b)
