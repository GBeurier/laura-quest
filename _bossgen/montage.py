#!/usr/bin/env python3
"""Crop each qa_<boss>.png around screen-centre (where the probe centres the boss)
and tile into a labelled 2x3 montage for one-look QA."""
from PIL import Image, ImageDraw
bosses = ['proprietaire', 'agriculteur', 'michael', 'rstudio', 'cendrine', 'jury']
# crop box around canvas centre (boss is centred there); include Laura to the left for scale
box = (290, 140, 660, 420)   # x0,y0,x1,y1 in the 1000x640 shot
cw, ch = box[2]-box[0], box[3]-box[1]
cols, rows = 3, 2
pad, lab = 8, 18
W = cols*cw + (cols+1)*pad
H = rows*(ch+lab) + (rows+1)*pad
m = Image.new('RGB', (W, H), (32, 38, 48))
d = ImageDraw.Draw(m)
for i, b in enumerate(bosses):
    try:
        im = Image.open(f'/tmp/qa_{b}.png').convert('RGB').crop(box)
    except Exception as e:
        im = Image.new('RGB', (cw, ch), (60, 20, 20)); ImageDraw.Draw(im).text((6, 6), f'MISSING {b}', fill=(255, 180, 180))
    c, r = i % cols, i//cols
    x = pad + c*(cw+pad); y = pad + r*(ch+lab+pad)
    d.text((x+2, y), b, fill=(220, 230, 240))
    m.paste(im, (x, y+lab))
m.save('/tmp/boss_montage.png')
print('montage /tmp/boss_montage.png', m.size)
