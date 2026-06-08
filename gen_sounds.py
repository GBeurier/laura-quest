"""Genere des bruitages retro (WAV 16-bit mono) dans assets/sounds/.
Aucune dependance externe hors numpy. Relancer pour regenerer."""
import numpy as np, wave, os, math

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "sounds")
os.makedirs(OUT, exist_ok=True)


def save(name, samples):
    s = np.clip(samples, -1, 1)
    pcm = (s * 32767).astype("<i2")
    with wave.open(os.path.join(OUT, name + ".wav"), "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def t(dur):
    return np.linspace(0, dur, int(SR * dur), endpoint=False)


def env(n, a=0.005, d=0.08):
    e = np.ones(n)
    ai = min(int(SR * a), n // 2)
    di = min(int(SR * d), n - ai)
    if ai: e[:ai] = np.linspace(0, 1, ai)
    if di: e[-di:] = np.linspace(1, 0, di)
    return e


def tone(freq, dur, kind="sine", vol=0.5, a=0.005, d=0.08):
    x = t(dur)
    if callable(freq):
        ph = 2 * np.pi * np.cumsum(freq(x)) / SR
    else:
        ph = 2 * np.pi * freq * x
    if kind == "square":
        wv = np.sign(np.sin(ph))
    elif kind == "saw":
        wv = 2 * (ph / (2 * np.pi) % 1) - 1
    elif kind == "noise":
        wv = np.random.uniform(-1, 1, len(x))
    else:
        wv = np.sin(ph)
    return wv * env(len(x), a, d) * vol


def seq(notes, kind="square", vol=0.45):
    return np.concatenate([tone(f, dur, kind, vol) for f, dur in notes])


# --- les sons ---
save("shoot", tone(lambda x: 900 - 1400 * x, 0.12, "square", 0.35, d=0.06))
save("jump", tone(lambda x: 300 + 600 * x, 0.16, "square", 0.35, d=0.07))
save("hit", tone(lambda x: 220 - 120 * x, 0.18, "saw", 0.4)
     + 0.25 * tone(0, 0.18, "noise", 1.0))
save("pickup", seq([(880, 0.07), (1320, 0.10)], "square", 0.35))
save("spell", seq([(660, 0.06), (880, 0.06), (1175, 0.06), (1568, 0.12)], "sine", 0.3))
save("boss", tone(lambda x: 160 - 90 * x, 0.5, "saw", 0.45, d=0.2)
     + 0.3 * tone(0, 0.5, "noise", 1.0, d=0.3))
save("win", seq([(523, 0.12), (659, 0.12), (784, 0.12), (1047, 0.28)], "square", 0.4))
save("lose", seq([(440, 0.16), (370, 0.16), (294, 0.30)], "saw", 0.4))

print("Sons generes :", sorted(os.listdir(OUT)))
