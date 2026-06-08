"""Embarque tous les assets (PNG + WAV) en base64 dans js/assets_data.js.
=> le jeu tourne en double-cliquant index.html (file://), sans aucun serveur,
   et se deploie tel quel sur n'importe quel hebergeur statique.

A relancer apres avoir change/ajoute un asset dans assets/sprites ou assets/sounds.
"""
import os, base64, json

ROOT = os.path.dirname(os.path.abspath(__file__))
SPR = os.path.join(ROOT, "assets", "sprites")
SND = os.path.join(ROOT, "assets", "sounds")
OUT = os.path.join(ROOT, "js", "assets_data.js")


def datauri(path, mime):
    with open(path, "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode())


sprites, sounds = {}, {}
for fn in sorted(os.listdir(SPR)):
    if fn.endswith(".png") and not fn.startswith("_"):
        sprites[fn[:-4]] = datauri(os.path.join(SPR, fn), "image/png")
for fn in sorted(os.listdir(SND)):
    if fn.endswith(".wav"):
        sounds[fn[:-4]] = datauri(os.path.join(SND, fn), "audio/wav")

with open(OUT, "w") as f:
    f.write("/* AUTO-GENERE par gen_assets_data.py — ne pas editer a la main.\n")
    f.write("   Assets embarques en base64 : le jeu marche sans serveur (file://). */\n")
    f.write("window.ASSETS = ")
    json.dump({"sprites": sprites, "sounds": sounds}, f)
    f.write(";\n")

size = os.path.getsize(OUT)
print("js/assets_data.js : %d sprites, %d sons, %.0f Ko" % (len(sprites), len(sounds), size / 1024))
