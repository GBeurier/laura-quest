#!/usr/bin/env python3
"""Niveaux en TEXTE -> JS embarque.

Lit les grilles ASCII de chaque niveau dans levels/<nom>.txt (une rangee par
ligne) et genere js/levels_data.js : window.LEVEL_MAPS = { <nom>: [..rangees..] }.
js/level.js lit ce global pour le `map:` de chaque niveau (le reste -- boss,
theme -- reste du code dans level.js). A relancer apres avoir edite un .txt :

    python3 gen_levels_data.py

Le jeu tourne en file:// (pas de fetch), d'ou l'embarquement JS facon
gen_assets_data.py. Les .txt sont la SOURCE editable des niveaux.
"""
import os, json

ROOT = os.path.dirname(os.path.abspath(__file__))
LVL = os.path.join(ROOT, 'levels')
OUT = os.path.join(ROOT, 'js', 'levels_data.js')

# Ordre = ordre d'apparition dans level.js / CONFIG.levels.
NAMES = ['niveau1', 'niveau2', 'niveau3', 'niveau4', 'niveau5', 'jury']


def read_rows(path):
    # newline='' -> on ne traduit pas les fins de ligne ; on garde les espaces.
    txt = open(path, 'r', newline='').read()
    txt = txt.replace('\r\n', '\n').replace('\r', '\n')
    rows = txt.split('\n')
    if rows and rows[-1] == '':       # enleve le '' artefact du newline final
        rows.pop()
    return rows


def main():
    maps = {}
    for n in NAMES:
        p = os.path.join(LVL, '%s.txt' % n)
        if not os.path.exists(p):
            print('WARN niveau absent: %s' % p)
            continue
        maps[n] = read_rows(p)
    body = json.dumps(maps, ensure_ascii=False, indent=2)
    js = ('// AUTO-GENERE par gen_levels_data.py -- EDITE les niveaux dans '
          'levels/*.txt, PAS ici.\n'
          'window.LEVEL_MAPS = %s;\n' % body)
    open(OUT, 'w', newline='\n').write(js)
    print('wrote %s (%d niveaux : %s)' % (OUT, len(maps), ', '.join(maps)))


if __name__ == '__main__':
    main()
