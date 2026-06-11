"""Embarque tous les assets (PNG + WAV + MID + TTF) en base64 dans js/assets_data.js.
=> le jeu tourne en double-cliquant index.html (file://), sans aucun serveur,
   et se deploie tel quel sur n'importe quel hebergeur statique.

A relancer apres avoir change/ajoute un asset dans assets/sprites, assets/sounds
ou assets/music.

Les PNG sont recompresses en WebP LOSSLESS (strictement les memes pixels,
~25% plus petit) au moment de l'embed si Pillow est dispo ; on garde le PNG
quand il est plus petit (rare) ou si Pillow manque. Les sources restent des
PNG dans assets/sprites/ : rien ne change pour les pipelines d'art.
"""
import base64
import io
import json
import os

try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = os.path.dirname(os.path.abspath(__file__))
SPR = os.path.join(ROOT, "assets", "sprites")
SND = os.path.join(ROOT, "assets", "sounds")
MUS = os.path.join(ROOT, "assets", "music")
FNT = os.path.join(ROOT, "assets", "fonts")
OUT = os.path.join(ROOT, "js", "assets_data.js")

os.makedirs(MUS, exist_ok=True)   # le script ne casse jamais si le repertoire manque
os.makedirs(FNT, exist_ok=True)


def datauri(data, mime):
    return "data:%s;base64,%s" % (mime, base64.b64encode(data).decode())


def best_image(path, mime):
    """Bytes + mime de la version la plus compacte (WebP lossless vs original)."""
    with open(path, "rb") as f:
        raw = f.read()
    if Image is None or mime != "image/png":
        return raw, mime          # JPG : deja compact ; pas de Pillow : tel quel
    buf = io.BytesIO()
    Image.open(path).save(buf, "WEBP", lossless=True, quality=100, method=6)
    webp = buf.getvalue()
    if len(webp) < len(raw):
        return webp, "image/webp"
    return raw, mime


# PNG = sprites/transparence ; JPG = fonds plein-cadre sans alpha (bien plus leger).
IMG_MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
sprites, sounds = {}, {}
png_total = out_total = 0
for fn in sorted(os.listdir(SPR)):
    name, ext = os.path.splitext(fn)
    if ext.lower() in IMG_MIME and not fn.startswith("_"):
        data, mime = best_image(os.path.join(SPR, fn), IMG_MIME[ext.lower()])
        png_total += os.path.getsize(os.path.join(SPR, fn))
        out_total += len(data)
        sprites[name] = datauri(data, mime)
for fn in sorted(os.listdir(SND)):
    if fn.endswith(".wav"):
        with open(os.path.join(SND, fn), "rb") as f:
            sounds[fn[:-4]] = datauri(f.read(), "audio/wav")

# Musiques : .mid en base64 BRUT (pas de prefixe data: — le lecteur chiptune
#  js/music.js fait atob() et parse les octets lui-meme).
music, mus_total = {}, 0
for fn in sorted(os.listdir(MUS)):
    name, ext = os.path.splitext(fn)
    # casse-insensible (.MID exporte par un DAW) + .midi, comme les sprites
    if ext.lower() in (".mid", ".midi") and not fn.startswith("_"):
        with open(os.path.join(MUS, fn), "rb") as f:
            raw = f.read()
        mus_total += len(raw)
        music[name] = base64.b64encode(raw).decode()

# Fonts : .ttf/.otf en data-URI (FontFace marche en file://). Subsettees a la
#  source (cf. CLAUDE.md, bulles BD des PNJ) -> quelques dizaines de Ko piece.
fonts, fnt_total = {}, 0
for fn in sorted(os.listdir(FNT)):
    name, ext = os.path.splitext(fn)
    if ext.lower() in (".ttf", ".otf") and not fn.startswith("_"):
        with open(os.path.join(FNT, fn), "rb") as f:
            raw = f.read()
        fnt_total += len(raw)
        fonts[name] = datauri(raw, "font/ttf" if ext.lower() == ".ttf" else "font/otf")

with open(OUT, "w") as f:
    f.write("/* AUTO-GENERE par gen_assets_data.py — ne pas editer a la main.\n")
    f.write("   Assets embarques en base64 : le jeu marche sans serveur (file://). */\n")
    f.write("window.ASSETS = ")
    json.dump({"sprites": sprites, "sounds": sounds, "music": music, "fonts": fonts}, f)
    f.write(";\n")

size = os.path.getsize(OUT)
print("js/assets_data.js : %d sprites (%.1f -> %.1f Mo, webp lossless), %d sons, "
      "%d musiques (%.1f Ko), %d fonts (%.1f Ko), %.0f Ko"
      % (len(sprites), png_total / 1e6, out_total / 1e6, len(sounds),
         len(music), mus_total / 1024, len(fonts), fnt_total / 1024, size / 1024))
