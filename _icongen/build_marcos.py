#!/usr/bin/env python3
"""Post-traite les icones de la CAMPAGNE MARCOS : raw/ magenta -> assets/sprites.

  1. remove_chroma_key.py (helper codex, meme reglage que build.py) -> cut/
  2. mise en feuille selon le groupe (tailles = analogues existants) :
     ammo_note       6 frames 52x52   (= ammo_graine)      wobble +/- + pulse
     ammo_note_fire  6 frames 56x56   (= ammo_graine_fire)  wobble + pulse
     shot_*          1 frame 96x96    (= shot_error/bail)   pointe a DROITE,
                     contour sombre + halo sombre doux derriere
     pickup_durian   bump 4 frames 64 (= pickup_croquette) via tools/gen_pickup_sheets.py
Idempotent : ne traite que les raw/ presents. Ensuite : python gen_assets_data.py
"""
import os, subprocess, sys
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, '_icongen', 'raw')
CUT = os.path.join(ROOT, '_icongen', 'cut')
OUT = os.path.join(ROOT, 'assets', 'sprites')
CODEX_HOME = os.environ.get('CODEX_HOME', os.path.expanduser('~/.codex'))
RCK = os.path.join(CODEX_HOME, 'skills/.system/imagegen/scripts/remove_chroma_key.py')
PY = sys.executable
SS = 4

AMMO = {'ammo_note': 52, 'ammo_note_fire': 56}
SHOTS = ['shot_mud', 'shot_durian', 'shot_spine', 'shot_net', 'shot_feather']
PICKUPS = ['pickup_durian']
WOBBLE = [-14, -6, 6, 14, 6, -6]          # degres : la note se dandine (boucle)
PULSE = [1.00, 1.03, 1.06, 1.03, 1.00, 0.97]


def key(name):
    src, dst = os.path.join(RAW, name + '.png'), os.path.join(CUT, name + '.png')
    subprocess.run([PY, RCK, '--input', src, '--out', dst, '--auto-key', 'border',
                    '--soft-matte', '--transparent-threshold', '14',
                    '--opaque-threshold', '210', '--despill', '--force'],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    im = Image.open(dst).convert('RGBA')
    # binarise l'alpha (pixel-art net) et coupe le voile quasi invisible
    im.putalpha(im.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def fit(im, side):
    s = side / max(im.size)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def build_ammo(name, cell, fill=0.80):
    icon = fit(key(name), fill * cell * SS)
    ssc = cell * SS
    sheet = Image.new('RGBA', (cell * 6, cell), (0, 0, 0, 0))
    for i, (ang, k) in enumerate(zip(WOBBLE, PULSE)):
        f = icon.resize((round(icon.width * k), round(icon.height * k)), Image.LANCZOS)
        f = f.rotate(-ang, resample=Image.BICUBIC, expand=True)
        if max(f.size) > ssc:
            f = fit(f, ssc)
        c = Image.new('RGBA', (ssc, ssc), (0, 0, 0, 0))
        c.alpha_composite(f, ((ssc - f.width) // 2, (ssc - f.height) // 2))
        sheet.paste(c.resize((cell, cell), Image.LANCZOS), (i * cell, 0))
    sheet.save(os.path.join(OUT, name + '.png'))
    return sheet.size


def build_shot(name, cell=96, core=84, ow=3, halo=6):
    icon = fit(key(name), core)
    pad = ow + halo + 4
    base = Image.new('RGBA', (icon.width + 2 * pad, icon.height + 2 * pad), (0, 0, 0, 0))
    base.alpha_composite(icon, (pad, pad))
    a = base.getchannel('A')
    ring = Image.new('RGBA', base.size, (18, 14, 12, 0))
    ring.putalpha(a.filter(ImageFilter.MaxFilter(2 * ow + 1)))
    glow = Image.new('RGBA', base.size, (0, 0, 0, 0))
    glow.putalpha(a.filter(ImageFilter.MaxFilter(2 * (ow + halo) + 1))
                   .filter(ImageFilter.GaussianBlur(halo * 0.8)).point(lambda v: int(v * 0.62)))
    out = Image.new('RGBA', base.size, (0, 0, 0, 0))
    for layer in (glow, ring, base):
        out.alpha_composite(layer)
    if max(out.size) > cell:
        out = fit(out, cell)
    cv = Image.new('RGBA', (cell, cell), (0, 0, 0, 0))
    cv.alpha_composite(out, ((cell - out.width) // 2, (cell - out.height) // 2))
    cv.save(os.path.join(OUT, name + '.png'))
    return cv.size


def build_pickup(name):
    tmp = os.path.join(CUT, '_pk')
    os.makedirs(tmp, exist_ok=True)
    key(name).save(os.path.join(tmp, name + '.png'))
    subprocess.run([PY, os.path.join(ROOT, 'tools', 'gen_pickup_sheets.py'), os.path.join(tmp, name + '.png'),
                    '--out', OUT, '--cell', '64', '--frames', '4', '--style', 'both'],
                   check=True, stdout=subprocess.DEVNULL)
    return Image.open(os.path.join(OUT, name + '.png')).size


def main():
    os.makedirs(CUT, exist_ok=True)
    have = lambda n: os.path.exists(os.path.join(RAW, n + '.png'))
    for n, c in AMMO.items():
        if have(n): print(n, build_ammo(n, c), '6 frames')
    for n in SHOTS:
        if have(n): print(n, build_shot(n), '1 frame')
    for n in PICKUPS:
        if have(n): print(n, build_pickup(n), '4 frames')


if __name__ == '__main__':
    main()
