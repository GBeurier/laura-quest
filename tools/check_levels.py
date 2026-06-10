#!/usr/bin/env python3
"""Vérification ANALYTIQUE des cartes levels/*.txt (pas de navigateur).

C'est le check fiable décrit en mémoire projet : on parse l'ASCII et on
compare aux budgets de portée CALIBRÉS sur le moteur réel (gravity 1900,
jumpForce 760, rollers jumpMul 1.4, vélo speedMul 1.7, tuiles de 48 px) :

    saut            vertical (tuiles)   gap horizontal (tuiles)
    simple          3.0                 4
    double          5.5                 7
    roller simple   6.0                 4
    roller double   12                  7
    vélo double     5.5                 12

Vérifie pour chaque niveau :
  1. dimensions exactes (largeur/hauteur/rangée de sol pleine) ;
  2. légende (aucun caractère inconnu), unicité de @/B/*/P ;
  3. support : tout char "au sol" (monstre, rocher, fosse, boss...) posé
     directement sur un solide ; fosses '%' posées sur '=' ;
  4. atteignabilité de TOUS les pickups via un BFS sur les surfaces
     marchables avec le cône de saut (par équipement du niveau) ;
  5. gating de la publi 'P' : atteignable AVEC l'équipement prévu du
     niveau, PAS atteignable en double saut nu (niveaux 2-5) ;
  6. arène de boss : sol plat, pas de fosse '%' (ERREUR) ni de monstre dans
     le rayon du boss ; plateformes : seules celles à h<3 au-dessus du sol
     sont warnées (gênent le boss) — les h>=3 sont VOULUES depuis la passe
     v2 (postes de lob one-way, GAMEPLAY.md §4.6) et restent silencieuses ;
  7. départ : pas d'ennemi ni de fosse à <5 colonnes de '@'.

NOTE v2 (GAMEPLAY.md §3) : les plateformes '-'/'x' sont désormais
TRAVERSANTES par en-dessous pour le JOUEUR (one-way). Le modèle
d'atteignabilité ci-dessous n'en tient pas compte (il ne modélisait déjà
pas les plafonds) : on le garde CONSERVATEUR tel quel pour l'instant.

Usage : python3 tools/check_levels.py   (exit 1 si erreur bloquante)
"""
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LVL = os.path.join(ROOT, 'levels')

SOLID = set('=-x')
ITEMS = set('ocdpPkLYei b'.replace(' ', ''))
GROUND_CHARS = set('TARJKWGCIHUSFDN@B^%')      # posés sur une surface
FLYERS = set('VME')                            # spawn 1.5-1.6 tuile au-dessus
KNOWN = SOLID | ITEMS | GROUND_CHARS | FLYERS | set('@B*^% ')

# équipement disponible par niveau + portée du boss (px -> tuiles)
META = {
    'niveau1': dict(W=148, R=10, g=9,  gear=[],          boss_range=300 / 48),
    'niveau2': dict(W=260, R=14, g=12, gear=['velo'],    boss_range=300 / 48),
    'niveau3': dict(W=280, R=14, g=12, gear=['rollers'], boss_range=280 / 48),
    'niveau4': dict(W=300, R=14, g=12, gear=['velo'],    boss_range=300 / 48),
    'niveau5': dict(W=330, R=16, g=14, gear=['rollers'], boss_range=320 / 48),
    'jury':    dict(W=60,  R=11, g=9,  gear=[],          boss_range=320 / 48),
}

# cônes de saut : (montée max en tuiles, gap horizontal max en tuiles)
CONES = {
    'base':    dict(up=5.5, gap=7),
    'velo':    dict(up=5.5, gap=12),
    'rollers': dict(up=12,  gap=7),
}
DROP_GAP = 8           # gap franchissable en RETOMBANT (cible plus basse)


def read_rows(path):
    txt = open(path, 'r', newline='').read().replace('\r\n', '\n').replace('\r', '\n')
    rows = txt.split('\n')
    if rows and rows[-1] == '':
        rows.pop()
    return rows


class Level:
    def __init__(self, name, meta):
        self.name, self.meta = name, meta
        rows = read_rows(os.path.join(LVL, name + '.txt'))
        self.rows = [r.ljust(meta['W']) for r in rows]
        self.R = len(rows)
        self.errors, self.warns = [], []

    def at(self, r, c):
        if 0 <= r < self.R and 0 <= c < self.meta['W']:
            return self.rows[r][c]
        return ' '

    def err(self, m): self.errors.append(m)
    def warn(self, m): self.warns.append(m)

    # --- surfaces marchables : (rangée du DESSUS de tuile, colonne) ----------
    def standables(self):
        out = set()
        for r in range(self.R):
            for c in range(self.meta['W']):
                if self.at(r, c) in SOLID and self.at(r - 1, c) not in SOLID:
                    out.add((r, c))
        return out

    # --- BFS de déplacement avec un cône de saut donné -----------------------
    #  NOTE v2 : les plateformes sont devenues one-way pour le joueur (on saute
    #  À TRAVERS par en-dessous) — ce cône ne testait de toute façon aucune
    #  obstruction, donc le jeu se rapproche du modèle. Logique INCHANGÉE
    #  volontairement (conservateur) dans cette passe.
    def reachable(self, cone):
        stand = self.standables()
        g = self.meta['g']
        start = {(g, c) for c in range(self.meta['W']) if (g, c) in stand}
        seen = set(start)
        frontier = list(start)
        while frontier:
            r, c = frontier.pop()
            for (r2, c2) in stand:
                if (r2, c2) in seen:
                    continue
                dy_up = r - r2                     # >0 : cible plus haut
                dx = abs(c2 - c)
                if dy_up <= 0:
                    ok = dx <= (cone['gap'] if dy_up == 0 else DROP_GAP)
                else:
                    ok = dy_up <= cone['up'] and dx <= max(1.0, cone['gap'] - dy_up)
                if ok:
                    seen.add((r2, c2))
                    frontier.append((r2, c2))
        return seen

    # un item (r,c) est ramassable depuis une surface atteinte ?
    def item_ok(self, r, c, reached, cone):
        for (rs, cs) in reached:
            dy = rs - r                            # hauteur de l'item AU-DESSUS des pieds
            dx = abs(cs - c)
            if dy <= 0 and dx <= 1:                # au niveau des pieds / en contrebas
                return True
            if dy <= 2 and dx <= 1:                # à portée de corps/petit saut
                return True
            if dy <= 3.5 and dx <= 3:              # saut simple
                return True
            if dy <= cone['up'] + 1 and dx <= 4:   # (double) saut / roller
                return True
        # attrapé EN PLEIN VOL au-dessus d'un gap : un appui de chaque côté,
        # l'item à hauteur d'arc (<=3.5 au-dessus du décollage), gap franchissable
        left = [(rs, cs) for (rs, cs) in reached if cs < c and -1 <= rs - r <= 3.5]
        right = [(rs, cs) for (rs, cs) in reached if cs > c and -1 <= rs - r <= 3.5]
        for (rA, cA) in left:
            for (rB, cB) in right:
                if cB - cA <= cone['gap'] + 1:
                    return True
        return False

    def check(self):
        m = self.meta
        W, g = m['W'], m['g']
        # 1. dimensions
        if self.R != m['R']:
            self.err(f"hauteur {self.R} != {m['R']} rangées attendues")
        width = max(len(r.rstrip()) for r in self.rows)
        if width != W:
            self.err(f'largeur utile {width} != {W} attendue')
        if any(ch != '=' for ch in self.rows[g][:W]):
            self.err(f'rangée de sol {g} pas pleine')
        # 2. légende + unicité
        counts = {}
        for r in range(self.R):
            if r == g:
                continue
            for c in range(W):
                ch = self.at(r, c)
                if ch == ' ':
                    continue
                if ch not in KNOWN and ch != '*':
                    self.err(f'caractère inconnu {ch!r} en ({r},{c})')
                counts[ch] = counts.get(ch, 0) + 1
        for ch in '@B*':
            if counts.get(ch, 0) != 1:
                self.err(f"{ch!r} présent {counts.get(ch, 0)} fois (attendu 1)")
        wantP = 0 if self.name == 'jury' else 1
        if counts.get('P', 0) != wantP:
            self.err(f"'P' présent {counts.get('P', 0)} fois (attendu {wantP})")
        # 3. supports
        for r in range(self.R):
            if r == g:
                continue
            for c in range(W):
                ch = self.at(r, c)
                if ch in GROUND_CHARS or ch == '*':
                    below = self.at(r + 1, c)
                    if below not in SOLID:
                        self.err(f'{ch!r} en ({r},{c}) sans solide dessous ({below!r})')
                    if ch == '%' and below != '=':
                        self.err(f"'%' en ({r},{c}) posé sur {below!r} (sol '=' requis)")
        # position B / *
        bpos = spos = ppos = None
        for r in range(self.R):
            for c in range(W):
                ch = self.at(r, c)
                if ch == 'B': bpos = (r, c)
                elif ch == '*': spos = (r, c)
                elif ch == 'P': ppos = (r, c)
        if bpos and spos and spos[1] <= bpos[1]:
            self.err(f"'*' ({spos}) pas à droite du boss ({bpos})")
        # 4. items atteignables (avec l'équipement du niveau)
        cones = [CONES['base']] + [CONES[k] for k in m['gear']]
        reach_all = set()
        for cone in cones:
            reach_all |= self.reachable(cone)
        best = dict(up=max(c['up'] for c in cones), gap=max(c['gap'] for c in cones))
        for r in range(self.R):
            for c in range(W):
                ch = self.at(r, c)
                if ch in ITEMS and ch != 'P':
                    if not self.item_ok(r, c, reach_all, best):
                        self.err(f'pickup {ch!r} en ({r},{c}) INATTEIGNABLE')
        # 5. gating de la publi
        if ppos:
            base_reach = self.reachable(CONES['base'])
            ok_base = self.item_ok(ppos[0], ppos[1], base_reach, CONES['base'])
            ok_gear = self.item_ok(ppos[0], ppos[1], reach_all, best)
            if not ok_gear:
                self.err(f'P en {ppos} inatteignable MÊME avec {m["gear"] or "double saut"}')
            if m['gear'] and ok_base:
                self.err(f'P en {ppos} atteignable SANS {m["gear"]} (gating cassé)')
            if not m['gear'] and not ok_base:
                self.err(f'P en {ppos} inatteignable en double saut nu')
        # 6. arène de boss
        if bpos:
            br, bc = bpos
            lo, hi = int(bc - m['boss_range']) - 1, int(bc + m['boss_range']) + 1
            for c in range(max(0, lo), min(W, hi + 1)):
                ch = self.at(g - 1, c)
                if ch == '%':
                    self.err(f"fosse '%' en ({g-1},{c}) DANS l'arène du boss")
                if ch in (GROUND_CHARS - set('NB^@')) and ch != ' ':
                    self.warn(f'{ch!r} en ({g-1},{c}) dans l\'arène du boss')
                # v2 (GAMEPLAY.md §4.6) : les plateformes h>=3 DANS l'arène sont
                # VOULUES (poste de lob one-way + esquive verticale) -> silence.
                # On ne warne QUE les plateformes basses (0 < h < 3, gênent le
                # boss) ; le `0 <` exclut le sol et d'éventuels solides sous lui.
                for r in range(self.R):
                    if self.at(r, c) in SOLID and 0 < g - r < 3 and self.at(r - 1, c) != 'B':
                        self.warn(f'plateforme basse h{g-r} en ({r},{c}) dans l\'arène (gêne le boss ?)')
                        break
        # 7. départ sûr
        apos = None
        for r in range(self.R):
            for c in range(W):
                if self.at(r, c) == '@':
                    apos = (r, c)
        if apos:
            for c in range(max(0, apos[1] - 2), apos[1] + 6):
                ch = self.at(g - 1, c)
                if ch in (GROUND_CHARS - set('N@^')) | FLYERS:
                    self.err(f'{ch!r} en ({g-1},{c}) trop près du départ')
        return self

    # rapport d'ombre (info design, pas une erreur)
    def shade_info(self):
        W, g = self.meta['W'], self.meta['g']
        shaded = []
        for c in range(W):
            s = False
            py = g                                   # pieds au sol
            for r in range(g):
                shift = max(0.0, (py - (r + 1)) * 0.45)
                cc = int(c - shift)
                if 0 <= cc < W and self.at(r, cc) in '-x':
                    s = True
                    break
            shaded.append(s)
        runs, cur = [], 0
        for s in shaded:
            cur = cur + 1 if s else 0
            if cur:
                if runs and runs[-1][1] + runs[-1][0] == 0:
                    pass
                runs.append((cur, 0))
        longest = max([0] + [r[0] for r in runs])
        return sum(shaded), longest


def main():
    bad = False
    for name, meta in META.items():
        lv = Level(name, meta).check()
        ns, longest = lv.shade_info()
        status = 'OK ' if not lv.errors else 'ERR'
        print(f'[{status}] {name:8s}  ombre {ns}/{meta["W"]} cols (max couloir {longest})')
        for e in lv.errors:
            print(f'    ERREUR  {e}')
            bad = True
        for w in lv.warns:
            print(f'    note    {w}')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
