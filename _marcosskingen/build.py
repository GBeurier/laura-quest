"""Decoupage mecanique de la planche Imagegen (aucun dessin ajoute).

Source ignoree : marcos_source.png, copie de la sortie Imagegen.
Une echelle commune conserve les proportions des poses accroupies / K.O.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = Image.open(Path(__file__).with_name('marcos_source.png')).convert('RGBA')
# Elimine le voile quasi invisible hors silhouettes avant de mesurer les poses.
source.putalpha(source.getchannel('A').point(lambda a: 0 if a <= 8 else a))
xs, ys = [0, 313, 627, 941, 1254], [0, 333, 632, 944, 1254]
cells = []
for row in range(4):
    for col in range(4):
        cell = source.crop((xs[col], ys[row], xs[col + 1], ys[row + 1]))
        cells.append(cell.crop(cell.getbbox()))

factor = 200 / cells[0].height
frames = []
for i, cell in enumerate(cells):
    cell = cell.resize((round(cell.width * factor), round(cell.height * factor)), Image.Resampling.NEAREST)
    frame = Image.new('RGBA', (224, 224))
    # Le lancer tend le bras devant le torse, sans reculer le personnage.
    x = (224 - cell.width) // 2 + (12 if i == 3 else 0)
    assert x >= 0 and x + cell.width <= 224 and cell.height <= 220, (i, cell.size)
    frame.paste(cell, (x, 220 - cell.height))
    frames.append(frame)

states = {'idle': [0, 1], 'run': [4, 5, 6, 7], 'jump': [8, 9],
          'hurt': [10], 'throw': [2, 3], 'duck': [0, 12, 13],
          'dash': [11], 'dead': [14, 15]}
for state, indices in states.items():
    sheet = Image.new('RGBA', (224 * len(indices), 224))
    for col, index in enumerate(indices):
        sheet.paste(frames[index], (col * 224, 0))
    dest = ROOT / 'assets' / 'sprites' / ('marcos_' + state + '.png')
    sheet.save(dest, optimize=True)
    print(dest.name, sheet.size, dest.stat().st_size)

preview = Image.new('RGBA', (224 * 4, 224 * 4), (44, 60, 70, 255))
for i, frame in enumerate(frames):
    preview.alpha_composite(frame, ((i % 4) * 224, (i // 4) * 224))
preview.save(Path(__file__).with_name('preview.png'))
