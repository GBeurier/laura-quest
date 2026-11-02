"""Planche guitare de Marcos (image_gen, magenta) -> assets/sprites/marcos_guitar.png.

Decoupage mecanique (aucun dessin) : chroma-key, 4 colonnes egales, crop au contenu,
UNE echelle commune (taille du perso = celle de marcos_idle : 200 px de haut pour
les frames de grattage 0-1), pieds sur la baseline 220, cellule 224x224, 4 frames.
Le corps est centre comme dans marcos_idle (la guitare deborde a droite).
Usage : python _marcosskingen/build_guitar.py   (raw : raw/marcos_guitar_sheet.png)
"""
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
src = Image.open(HERE / 'raw' / 'marcos_guitar_sheet.png').convert('RGBA')
a = np.array(src).astype(np.int16)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
bg = ((np.abs(r - 255) + g + np.abs(b - 255) < 90) | ((r > 150) & (b > 150) & (g < 110))
      | ((r > 70) & (b > 70) & (g < 120) & (np.abs(r - b) < 105) & ((r + b - 2 * g) > 140)))
a[..., 3] = np.where(bg, 0, 255); a[bg, :3] = 0
src = Image.fromarray(a.astype(np.uint8))

N, CELL, BASE = 4, 224, 220
W = src.width // N
cells = []
for i in range(N):
    c = src.crop((i * W, 0, (i + 1) * W, src.height))
    cells.append(c.crop(c.getbbox()))
# echelle commune : la hauteur des frames de grattage = hauteur de marcos_idle (200)
factor = 200 / np.median([cells[0].height, cells[1].height])
mx = max(c.width for c in cells) * factor
if mx > CELL - 4:
    factor *= (CELL - 4) / mx
mh = max(c.height for c in cells) * factor
if mh > BASE - 2:
    factor *= (BASE - 2) / mh
sheet = Image.new('RGBA', (CELL * N, CELL))
for i, c in enumerate(cells):
    c = c.resize((max(1, round(c.width * factor)), max(1, round(c.height * factor))), Image.Resampling.NEAREST)
    # centre du CORPS ~ centre des pieds : mediane des colonnes opaques de la bande basse (bottes)
    al = np.array(c)[..., 3] > 0
    feet = np.flatnonzero(al[int(c.height * 0.85):].any(axis=0))
    fx = int(np.median(feet)) if len(feet) else c.width // 2
    x = int(np.clip(112 - fx, 0, CELL - c.width))       # marcos_idle : pieds centres sur x~112
    sheet.alpha_composite(c, (i * CELL + x, BASE - c.height))
dest = ROOT / 'assets' / 'sprites' / 'marcos_guitar.png'
sheet.save(dest, optimize=True)
prev = Image.new('RGBA', sheet.size, (44, 60, 70, 255)); prev.alpha_composite(sheet)
prev.save(HERE / 'preview_guitar.png')
print(dest.name, sheet.size, 'factor %.3f' % factor)
