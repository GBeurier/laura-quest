"""Planche-contact de tous les sprites pour relecture visuelle."""
import os
from PIL import Image, ImageDraw

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "sprites")
names = sorted(n[:-4] for n in os.listdir(D) if n.endswith(".png") and not n.startswith("_"))

cell, pad, cols = 150, 12, 6
rows = (len(names) + cols - 1) // cols
W, H = cols * cell, rows * cell
img = Image.new("RGBA", (W, H), (60, 70, 84, 255))
dr = ImageDraw.Draw(img)

# damier pour voir la transparence
for y in range(0, H, 16):
    for x in range(0, W, 16):
        if (x // 16 + y // 16) % 2:
            dr.rectangle([x, y, x + 15, y + 15], fill=(72, 82, 96, 255))

for i, name in enumerate(names):
    cx, cy = (i % cols) * cell, (i // cols) * cell
    s = Image.open(os.path.join(D, name + ".png")).convert("RGBA")
    maxw, maxh = cell - 2 * pad, cell - 2 * pad - 16
    sc = min(maxw / s.width, maxh / s.height, 3.0)
    s2 = s.resize((max(1, int(s.width * sc)), max(1, int(s.height * sc))), Image.NEAREST)
    ox = cx + (cell - s2.width) // 2
    oy = cy + (cell - 16 - s2.height) // 2
    img.alpha_composite(s2, (ox, oy))
    dr.text((cx + 5, cy + cell - 14), name, fill=(255, 255, 255, 255))
    dr.rectangle([cx, cy, cx + cell - 1, cy + cell - 1], outline=(40, 46, 56, 255))

img.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "montage.png"))
print("montage.png ->", img.size, "|", len(names), "sprites")
