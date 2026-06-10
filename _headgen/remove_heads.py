#!/usr/bin/env python3
"""Supprime proprement des tetes de passant (doublons) du pool.

SWAP-REMOVE : comme l'ordre du pool n'a aucune importance (tirage au hasard via
PASSANT_HEADS / pickHead), on bouche chaque trou avec la tete d'indice le plus
haut plutot que de tout renumeroter -> 1 rename par suppression, sequence finale
contigue 1..N. Met a jour TOUS les artefacts (_headgen + assets/sprites) ET le
manifest. Affiche ensuite les nouveaux compteurs a reporter dans js/level.js
(PASSANT_HEADS) avant de relancer python3 gen_assets_data.py.

Usage : python3 _headgen/remove_heads.py head_npc_f_2 head_npc_f_15 head_npc_h_21
"""
import os, re, sys, glob

ROOT = '/home/delete/laura_quest'
SPR = ROOT + '/assets/sprites'
HG = ROOT + '/_headgen'
MAN = HG + '/manifest.tsv'

# Patrons d'artefacts pour une tete de nom <n> ({n} = head_npc_<sexe>_<idx>).
PATTERNS = [
    SPR + '/{n}.png', SPR + '/{n}_dead.png',
    HG + '/src/{n}.png', HG + '/dead_src/{n}.png',
    HG + '/raw/{n}_sheet.png', HG + '/raw/{n}_dead_sheet.png',
    HG + '/prompts/{n}.txt', HG + '/prompts/{n}_dead.txt',
    HG + '/final/{n}_preview.png', HG + '/final/{n}_dead_preview.png',
    HG + '/gen_{n}.log',
]


def name(sex, idx):
    return 'head_npc_%s_%d' % (sex, idx)


def max_idx(sex):
    rx = re.compile(r'head_npc_%s_(\d+)\.png$' % sex)
    idxs = [int(rx.search(os.path.basename(p)).group(1))
            for p in glob.glob('%s/head_npc_%s_*.png' % (SPR, sex))
            if rx.search(os.path.basename(p)) and '_dead' not in os.path.basename(p)]
    return max(idxs) if idxs else 0


def delete_head(n):
    for pat in PATTERNS:
        p = pat.format(n=n)
        if os.path.exists(p):
            os.remove(p)


def rename_head(src, dst):
    for pat in PATTERNS:
        ps, pd = pat.format(n=src), pat.format(n=dst)
        if os.path.exists(ps):
            os.replace(ps, pd)


def plan_for_sex(sex, removed):
    """Renvoie (newN, holes_to_fill[(hole, donor)], all_removed_names)."""
    N = max_idx(sex)
    removed = sorted(set(removed))
    newN = N - len(removed)
    remain = [i for i in range(1, N + 1) if i not in removed]
    keep_high = sorted(i for i in remain if i > newN)        # a redescendre
    holes = sorted(i for i in removed if i <= newN)          # trous a boucher
    assert len(keep_high) == len(holes), (keep_high, holes)
    pairs = list(zip(holes, keep_high))                      # (trou, donneur)
    return N, newN, pairs, removed


def load_manifest():
    head, rows = [], {}
    for line in open(MAN):
        if line.strip().startswith('#') or not line.strip():
            head.append(line.rstrip('\n'))
            continue
        parts = line.rstrip('\n').split('\t')
        rows[parts[0]] = parts[1:]                           # name -> [src, sex]
    return head, rows


def write_manifest(head, rows):
    def key(n):
        m = re.match(r'head_npc_([fh])_(\d+)', n)
        return (0 if m.group(1) == 'f' else 1, int(m.group(2)))
    with open(MAN, 'w') as f:
        for h in head:
            f.write(h + '\n')
        for n in sorted(rows, key=key):
            f.write('\t'.join([n] + rows[n]) + '\n')


def main(names):
    bysex = {}
    for nm in names:
        m = re.match(r'head_npc_([fh])_(\d+)$', nm)
        if not m:
            raise SystemExit('nom invalide: %s' % nm)
        bysex.setdefault(m.group(1), []).append(int(m.group(2)))

    head, rows = load_manifest()
    new_counts = {}
    for sex, removed in bysex.items():
        N, newN, pairs, rem = plan_for_sex(sex, removed)
        # 1) supprimer les tetes retirees (artefacts + manifest)
        for i in rem:
            delete_head(name(sex, i))
            rows.pop(name(sex, i), None)
        # 2) boucher chaque trou avec le donneur (indice le plus haut)
        for hole, donor in pairs:
            rename_head(name(sex, donor), name(sex, hole))
            if name(sex, donor) in rows:                     # le manifest suit
                rows[name(sex, hole)] = rows.pop(name(sex, donor))
            print('  %s: trou %d <- donneur %d' % (sex, hole, donor))
        new_counts[sex] = newN
        print('SEX %s: %d -> %d (retire %s)' % (sex, N, newN, sorted(rem)))
    write_manifest(head, rows)
    print('\nNouveaux compteurs PASSANT_HEADS (js/level.js) :')
    for sex in ('h', 'f'):
        if sex in new_counts:
            print('  %s: length %d' % (sex, new_counts[sex]))
    print('\n-> editer js/level.js puis: python3 gen_assets_data.py')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    main(sys.argv[1:])
