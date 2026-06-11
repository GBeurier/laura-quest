"""Genere des MUSIQUES PLACEHOLDER (.mid) pour le lecteur chiptune.

11 pistes dans assets/music/ : title, map, chapter, win, lose, niveau1..5, jury.
Chacune = une petite boucle de 8 a 16 mesures en 4/4, trois voix :
  - melodie  (canal 0) : notes de la gamme, accroche sur les accords aux temps forts
  - basse    (canal 1) : fondamentale de l'accord, motif par piste
  - batterie (canal 9) : kick 36 / snare 38 / hihat 42

Fichiers SMF format 0 ecrits a la main (stdlib uniquement : struct + random
SEEDE par piste -> sortie 100% deterministe). MThd division 480 ticks/noire,
un seul MTrk : Set Tempo + Time Signature, notes, End of Track pile sur la
fin de la derniere mesure (la boucle reboucle proprement).

Chaque piste a son caractere (gamme, tempo, progression I-V-vi-IV ou
pentatonique, densite, derive haut/bas) — agreables mais bouche-trou :
remplace n'importe quel .mid par ta vraie compo (meme nom) quand tu l'as.

Usage :
    python3 tools/gen_placeholder_midis.py
    python3 gen_assets_data.py        # OBLIGATOIRE ensuite (re-embarque)
"""
import os
import random
import struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MUS = os.path.join(ROOT, "assets", "music")

TPQ = 480                 # ticks par noire (division MThd)
E8 = TPQ // 2             # une croche
BAR = TPQ * 4             # une mesure 4/4
GAP = 30                  # silence d'articulation en fin de note (ticks)

# Gammes (intervalles depuis la fondamentale)
MAJOR = [0, 2, 4, 5, 7, 9, 11]
MINOR = [0, 2, 3, 5, 7, 8, 10]
HMINOR = [0, 2, 3, 5, 7, 8, 11]
DORIAN = [0, 2, 3, 5, 7, 9, 10]
PENT_MAJ = [0, 2, 4, 7, 9]
PENT_MIN = [0, 3, 5, 7, 10]

# Rythmes de melodie par mesure : listes de (depart_en_croches, duree_en_croches)
RHYTHMS = {
    "sparse": [
        [(0, 8)],
        [(0, 4), (4, 4)],
        [(0, 6), (6, 2)],
        [(0, 4), (4, 3)],
    ],
    "medium": [
        [(0, 2), (2, 2), (4, 2), (6, 2)],
        [(0, 4), (4, 2), (6, 2)],
        [(0, 2), (2, 2), (4, 4)],
        [(0, 3), (3, 1), (4, 2), (6, 2)],
    ],
    "dense": [
        [(0, 1), (1, 1), (2, 2), (4, 1), (5, 1), (6, 2)],
        [(0, 2), (2, 1), (3, 1), (4, 2), (6, 1), (7, 1)],
        [(0, 1), (1, 1), (2, 1), (3, 1), (4, 2), (6, 2)],
        [(0, 2), (2, 2), (4, 1), (5, 1), (6, 2)],
    ],
}

# Batteries par mesure : (croche, note GM canal 9, velocite)
DRUMS = {
    "none": [],
    "soft": [(0, 36, 64)],
    "sparse": [(0, 36, 84), (4, 36, 72),
               (0, 42, 56), (2, 42, 48), (4, 42, 56), (6, 42, 48)],
    "basic": [(0, 36, 96), (4, 36, 88), (2, 38, 90), (6, 38, 90)]
             + [(i, 42, 64 if i % 2 == 0 else 48) for i in range(8)],
    "drive": [(0, 36, 100), (3, 36, 84), (4, 36, 92), (2, 38, 96), (6, 38, 96)]
             + [(i, 42, 68 if i % 2 == 0 else 52) for i in range(8)],
    "march": [(0, 36, 96), (4, 36, 96), (2, 38, 92), (6, 38, 92), (7, 38, 70),
              (0, 42, 60), (2, 42, 60), (4, 42, 60), (6, 42, 60)],
}

# Pistes : seed fixe -> deterministe. prog = degres de la gamme (0 = tonique).
TRACKS = [
    # nom        seed root gamme     bpm bars prog          mel       bass      drum     derive lead bassprog
    ("title",    11,  60,  MAJOR,    120, 8,  [0, 4, 5, 3], "dense",  "pulse8", "basic",  0,    80,  38),
    ("map",      22,  55,  MAJOR,    100, 8,  [0, 3, 0, 4], "medium", "half",   "sparse", 0,    73,  33),
    ("chapter",  33,  53,  MAJOR,     80, 8,  [0, 5, 3, 4], "sparse", "whole",  "none",   0,    46,  32),
    ("win",      44,  60,  MAJOR,    132, 8,  [0, 3, 4, 0], "dense",  "quarter","march",  1,    56,  58),
    ("lose",     55,  57,  MINOR,     62, 8,  [0, 5, 3, 4], "sparse", "whole",  "none",  -1,    48,  32),
    ("niveau1",  61,  55,  PENT_MAJ, 112, 16, [0, 3, 0, 4], "medium", "half",   "sparse", 0,    75,  33),
    ("niveau2",  62,  57,  DORIAN,   116, 8,  [0, 3, 0, 4], "medium", "offbeat","basic",  0,    81,  34),
    ("niveau3",  63,  52,  MINOR,    140, 8,  [0, 5, 3, 4], "dense",  "pulse8", "drive",  0,    80,  39),
    ("niveau4",  64,  57,  PENT_MIN, 126, 8,  [0, 3, 4, 3], "medium", "quarter","basic",  0,    82,  36),
    ("niveau5",  65,  59,  MINOR,     96, 12, [0, 5, 2, 4], "sparse", "half",   "sparse", -1,   89,  35),
    ("jury",     77,  50,  HMINOR,    92, 8,  [0, 0, 3, 4], "medium", "quarter","march",  0,    61,  43),
]


def vlq(n):
    """Encode un delta-time en quantite a longueur variable (VLQ)."""
    out = [n & 0x7F]
    n >>= 7
    while n:
        out.append(0x80 | (n & 0x7F))
        n >>= 7
    return bytes(reversed(out))


def deg_pitch(root, scale, deg):
    """Degre de gamme (peut depasser une octave) -> note MIDI."""
    octv, idx = divmod(deg, len(scale))
    return max(0, min(127, root + 12 * octv + scale[idx]))


def nearest_chord_deg(scale, chord, cur):
    """Degre d'accord (sur 3 octaves de melodie) le plus proche de cur."""
    cands = [d + len(scale) * k for d in chord for k in (0, 1, 2)]
    return min(cands, key=lambda d: (abs(d - cur), d))


class Song:
    """Accumule des evenements (tick absolu) puis serialise un SMF format 0."""

    def __init__(self, bpm, bars):
        self.ev = []                      # (tick, ordre, bytes)
        self.total = bars * BAR
        tempo = round(60_000_000 / bpm)
        self.ev.append((0, 0, b"\xFF\x51\x03" + struct.pack(">I", tempo)[1:]))
        self.ev.append((0, 0, b"\xFF\x58\x04\x04\x02\x18\x08"))  # 4/4

    def program(self, ch, prog):
        self.ev.append((0, 1, bytes([0xC0 | ch, prog])))

    def note(self, ch, pitch, start, dur, vel):
        off = min(max(start + dur, start + 1), self.total)
        self.ev.append((start, 3, bytes([0x90 | ch, pitch, max(1, min(127, vel))])))
        self.ev.append((off, 2, bytes([0x80 | ch, pitch, 0])))

    def tobytes(self):
        self.ev.append((self.total, 9, b"\xFF\x2F\x00"))  # End of Track
        self.ev.sort(key=lambda e: (e[0], e[1]))
        track, prev = b"", 0
        for tick, _, data in self.ev:
            track += vlq(tick - prev) + data
            prev = tick
        head = struct.pack(">4sIHHH", b"MThd", 6, 0, 1, TPQ)
        return head + struct.pack(">4sI", b"MTrk", len(track)) + track


def gen_track(name, seed, root, scale, bpm, bars, prog, mel, bass, drum, drift, lead, bassprog):
    rng = random.Random(seed)
    song = Song(bpm, bars)
    song.program(0, lead)
    song.program(1, bassprog)
    n = len(scale)
    cur = n  # la melodie demarre sur la tonique, une octave au-dessus de root
    steps = {-1: [-2, -2, -1, -1, 0, 1],      # derive descendante (triste)
             0: [-2, -1, -1, 0, 1, 1, 2],     # marche aleatoire equilibree
             1: [-1, 0, 1, 1, 2, 2]}[drift]   # derive montante (fanfare)

    for bar in range(bars):
        t0 = bar * BAR
        chord_deg = prog[bar % len(prog)]
        chord = [chord_deg, chord_deg + 2, chord_deg + 4]
        broot = deg_pitch(root - 12, scale, chord_deg)

        # --- basse (canal 1) : fondamentale, motif par piste
        if bass == "whole":
            bnotes = [(0, 8, broot)]
        elif bass == "half":
            bnotes = [(0, 4, broot), (4, 4, broot)]
        elif bass == "quarter":
            bnotes = [(i, 2, broot) for i in (0, 2, 4, 6)]
        elif bass == "pulse8":
            bnotes = [(i, 1, broot + 12 * (i % 2)) for i in range(8)]
        else:  # offbeat
            bnotes = [(i, 1, broot) for i in (1, 3, 5, 7)]
        for s, d, p in bnotes:
            song.note(1, p, t0 + s * E8, d * E8 - GAP, 88 if s == 0 else 80)

        # --- batterie (canal 9)
        for s, note, vel in DRUMS[drum]:
            song.note(9, note, t0 + s * E8, 40, vel)

        # --- melodie (canal 0) : rythme tire au sort, hauteurs par marche
        #  aleatoire dans la gamme, recalees sur l'accord aux temps forts
        notes = list(rng.choice(RHYTHMS[mel]))
        for i, (s, d) in enumerate(notes):
            if s in (0, 4) or rng.random() < 0.25:
                cur = nearest_chord_deg(scale, chord, cur)
            else:
                cur = max(2, min(2 * n + 3, cur + rng.choice(steps)))
            if bar == bars - 1 and i == len(notes) - 1:
                cur = round(cur / n) * n      # resolution : on finit sur la tonique
                cur = max(n, min(2 * n, cur))
            vel = (102 if s == 0 else 94 if s == 4 else 78) + rng.randint(-4, 6)
            song.note(0, deg_pitch(root, scale, cur), t0 + s * E8, d * E8 - GAP, vel)

    return song.tobytes()


if __name__ == "__main__":
    os.makedirs(MUS, exist_ok=True)
    total = 0
    for spec in TRACKS:
        name = spec[0]
        data = gen_track(*spec)
        path = os.path.join(MUS, name + ".mid")
        with open(path, "wb") as f:
            f.write(data)
        total += len(data)
        print("  %-12s %5d octets" % (name + ".mid", len(data)))
    print("%d fichiers .mid dans assets/music/ (%.1f Ko au total)"
          % (len(TRACKS), total / 1024))
