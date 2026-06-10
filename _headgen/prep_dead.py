#!/usr/bin/env python3
"""Tete VIVANTE deja generee -> reference -i pour la passe ZOMBIE de Codex.

Prend la 1re cellule (yeux ouverts, 112x112) de la feuille de clignement
assets/sprites/<name>.png, la recadre sur son contenu et la pose AGRANDIE,
centree, sur un fond plat #ff00ff magenta 768x768 -> _headgen/dead_src/<name>.png.

Donner a image_gen la VRAIE tete pixel deja stylisee (et non la photo) garantit
que le zombie est un redraw fidele (memes cheveux/contour/forme) -> swap propre
avec head_npc_<sexe>_<n>_dead. Le magenta du fond rappelle au modele le chroma-key
attendu en sortie (regrid_dead le detoure).

Usage : python3 _headgen/prep_dead.py <name>
"""
import sys, os
from PIL import Image

ROOT = '/home/delete/laura_quest'
SPR = ROOT + '/assets/sprites'
OUT = ROOT + '/_headgen/dead_src'
CW = 112                       # largeur d'une cellule de la feuille vivante
CANVAS, TARGET = 768, 560      # toile magenta / hauteur cible de la tete dessus
MAGENTA = (255, 0, 255, 255)


def run(name):
    src = '%s/%s.png' % (SPR, name)
    sheet = Image.open(src).convert('RGBA')
    cell = sheet.crop((0, 0, CW, sheet.height))        # 1re frame = yeux ouverts
    bb = cell.getbbox()
    if bb:
        cell = cell.crop(bb)
    s = TARGET / max(1, cell.height)
    nw, nh = max(1, round(cell.width * s)), max(1, round(cell.height * s))
    cell = cell.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new('RGBA', (CANVAS, CANVAS), MAGENTA)
    canvas.alpha_composite(cell, ((CANVAS - nw) // 2, (CANVAS - nh) // 2))
    os.makedirs(OUT, exist_ok=True)
    out = '%s/%s.png' % (OUT, name)
    canvas.convert('RGB').save(out)            # RGB plat : magenta franc, pas d'alpha
    print('wrote', out, canvas.size)


if __name__ == '__main__':
    run(sys.argv[1])
