#!/usr/bin/env python3
"""Brut AI (4 frames CORPS sans tete, de face, applaudissant, sur magenta) -> feuille.

Reutilise TEL QUEL le decoupage de _bodygen/regrid.py (meme cellule 112x150, meme
baseline pieds y146 et meme cou ~y44) avec le "biome" fige a 'clap' -> ecrit
assets/sprites/body_clap_<sex>.png. Meme gabarit que les passants : les tetes
head_npc_<sex>_<n> du pool partage s'attachent au meme headLocal.

Usage : python3 _clapgen/regrid.py <raw/body_clap_h_sheet.png> h [--frames 4]
"""
import sys, os, argparse
sys.path.insert(0, os.path.join('/home/delete/laura_quest', '_bodygen'))
import regrid as bg   # noqa: E402  (constantes + run() ; aucun effet de bord a l'import)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('inp'); ap.add_argument('sex')
    ap.add_argument('--frames', type=int, default=4)
    a = ap.parse_args()
    bg.run(a.inp, 'clap', a.sex, a.frames)
