#!/usr/bin/env python3
"""Icone unique -> planche de pickup animee (mouvement de "bump").

But : tu dessines UNE icone par collectible (un seul PNG, fond transparent),
ce script la retaille a la taille "pickup" et en fabrique automatiquement la
feuille de sprite multi-frames avec une petite animation de rebond (bob
vertical + squash & stretch) qui boucle proprement.

Convention Laura Quest (cf. CONFIG.anims dans js/config.js) :
  - une frame de pickup = cellule carree de 64 px (authoring a CONFIG.art.scale=2
    -> ~32 px a l'ecran). La planche = N frames cote a cote (defaut 4).
  - anim 'idle' qui boucle a speed ~6.

Usage :
  python3 tools/gen_pickup_sheets.py assets/pickup_icons
  python3 tools/gen_pickup_sheets.py mon_icone.png --prefix pickup_
  python3 tools/gen_pickup_sheets.py assets/pickup_icons --frames 6 --bob 4

Puis (OBLIGATOIRE pour que le jeu voie le nouveau sprite) :
  python3 gen_assets_data.py

Le nom du sprite = nom du fichier (sans extension). Nomme donc tes icones
"pickup_xxx.png" (ou utilise --prefix pickup_ pour l'ajouter automatiquement).
Le script affiche en fin l'extrait a coller dans CONFIG.anims.

Dependance : Pillow uniquement (--cut, optionnel, ajoute numpy/scipy via
tools/_spritelib.py pour detourer un fond plat).
"""
import argparse
import math
import os
import sys

from PIL import Image

IMG_EXT = {".png", ".webp", ".gif", ".bmp", ".tga"}


def find_icons(paths):
    """Developpe une liste de fichiers/dossiers en liste de PNG d'icones.

    Ignore les fichiers prefixes '_' (comme gen_assets_data.py) et tout PNG qui
    ressemble deja a une planche (largeur >= 2x sa hauteur -> probablement
    plusieurs frames -> on ne le re-anime pas)."""
    out = []
    for p in paths:
        if os.path.isdir(p):
            for name in sorted(os.listdir(p)):
                if os.path.splitext(name)[1].lower() in IMG_EXT \
                        and not name.startswith("_"):
                    out.append(os.path.join(p, name))
        elif os.path.isfile(p):
            out.append(p)
        else:
            print(f"  [!] introuvable, ignore : {p}", file=sys.stderr)
    return out


def load_icon(path, cut=False, cut_tol=28):
    """Charge l'icone en RGBA, detoure (optionnel) puis rogne le vide autour."""
    im = Image.open(path).convert("RGBA")
    if cut:
        # detourage d'un fond plat via la lib partagee (numpy/scipy)
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import numpy as np
        import _spritelib as sl
        rgba, _ = sl.remove_bg_auto(np.asarray(im.convert("RGB")), tol=cut_tol)
        im = Image.fromarray(rgba, "RGBA")
    # rogne la bordure transparente pour normaliser les marges d'entree
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    return im


def frame_transforms(n, bob, squash, style):
    """Rend N quadruplets (dy, sx, sy, rot) pour les N frames.

    bump (style both/bob/squash), boucle 0->..->N-1->0 :
      phase = 2*pi*i/N ; dy = -bob*sin ; k = squash*sin ; sx=1-k ; sy=1+k ; rot=0
      -> monte+etire au 1er quart, descend+ecrase au 3e.
    rotation (style 'spin') : tour complet regulier, dy=0, sx=sy=1,
      rot = i*360/N (sens horaire), pour munitions/projectiles qui tournent.
    """
    out = []
    for i in range(n):
        if style == "spin":
            out.append((0.0, 1.0, 1.0, i * 360.0 / n))
            continue
        ph = 2.0 * math.pi * i / n
        s = math.sin(ph)
        dy = -bob * s if style in ("both", "bob") else 0.0
        k = squash * s if style in ("both", "squash") else 0.0
        out.append((dy, 1.0 - k, 1.0 + k, 0.0))
    return out


def fit_icon(icon, cell, fill, bob, squash, style, guard=1):
    """Retaille l'icone (aspect conserve) pour rester dans la cellule a l'amplitude
    max du mouvement.

    bump : borne chaque axe par le squash + le bob ->
      w*(1+squash) <= cell-2g ; h*(1+squash)+2*ceil(bob) <= cell-2g
    spin : borne par la DIAGONALE (l'icone tournee balaie un cercle de diametre
      sa diagonale) -> hypot(w,h) <= cell-2g, sinon les coins sont rognes.
    """
    w, h = icon.size
    scale = (fill * cell) / max(w, h)
    if style != "spin":
        grow = 1.0 + squash
        scale = min(scale, (cell - 2 * guard) / (w * grow))
        scale = min(scale, (cell - 2 * guard - 2 * math.ceil(bob)) / (h * grow))
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    out = icon.resize((nw, nh), Image.LANCZOS)
    if style == "spin":
        # rayon balaye = max distance centre->pixel opaque (la rotation conserve
        # cette distance). On borne le DIAMETRE balaye a cell-2*guard : exact, et
        # bien plus genereux que la diagonale pour un objet rond/centre.
        import numpy as np
        a = np.asarray(out.split()[-1])
        ys, xs = np.where(a >= 8)
        if len(xs):
            cx, cy = (out.width - 1) / 2.0, (out.height - 1) / 2.0
            r = float(np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2).max())
            lim = (cell - 2 * guard) / 2.0
            if r > lim:
                k = lim / r
                out = out.resize((max(1, round(out.width * k)),
                                  max(1, round(out.height * k))), Image.LANCZOS)
    return out


def make_sheet(icon, cell, frames, transforms):
    """Compose la planche : N cellules carrees, icone centree + transformee."""
    sheet = Image.new("RGBA", (cell * frames, cell), (0, 0, 0, 0))
    bw, bh = icon.size
    for i, (dy, sx, sy, rot) in enumerate(transforms):
        fw, fh = max(1, round(bw * sx)), max(1, round(bh * sy))
        fr = icon.resize((fw, fh), Image.LANCZOS) if (fw, fh) != (bw, bh) else icon
        if rot:
            fr = fr.rotate(-rot, resample=Image.BICUBIC, expand=True)
        cx = i * cell + cell // 2
        cy = cell // 2 + dy
        x = round(cx - fr.width / 2)
        y = round(cy - fr.height / 2)
        sheet.alpha_composite(fr, (x, y))
    return sheet


def main():
    ap = argparse.ArgumentParser(
        description="Icone unique -> planche de pickup animee (bump).",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    ap.add_argument("inputs", nargs="+",
                    help="icone(s) PNG ou dossier(s) d'icones")
    ap.add_argument("--out", default="assets/sprites",
                    help="dossier de sortie des planches")
    ap.add_argument("--cell", type=int, default=64,
                    help="taille d'une frame en px (authoring, scale 2)")
    ap.add_argument("--frames", type=int, default=4,
                    help="nombre de frames de la planche")
    ap.add_argument("--fill", type=float, default=0.9,
                    help="part de la cellule occupee par l'icone au repos (0..1)")
    ap.add_argument("--bob", type=float, default=None,
                    help="amplitude du bob vertical en px (defaut: cell*0.05)")
    ap.add_argument("--squash", type=float, default=0.07,
                    help="amplitude du squash & stretch (fraction, ex 0.07)")
    ap.add_argument("--style", choices=("both", "bob", "squash", "spin"),
                    default="both",
                    help="mouvement : both/bob/squash = bump ; spin = rotation")
    ap.add_argument("--speed", type=int, default=6,
                    help="vitesse d'anim (seulement pour l'extrait config affiche)")
    ap.add_argument("--anim-name", default="idle",
                    help="nom de l'anim dans l'extrait config (ex 'spin' pour ammo)")
    ap.add_argument("--prefix", default="",
                    help="prefixe ajoute au nom de sortie s'il manque (ex pickup_)")
    ap.add_argument("--cut", action="store_true",
                    help="detoure un fond plat avant (numpy/scipy via _spritelib)")
    ap.add_argument("--cut-tol", type=int, default=28,
                    help="tolerance de detection du fond pour --cut")
    args = ap.parse_args()

    bob = args.cell * 0.05 if args.bob is None else args.bob
    if args.frames < 1:
        ap.error("--frames doit valoir au moins 1")
    if args.frames == 1:
        bob, args.squash = 0.0, 0.0  # 1 frame = simple resize centre (pas de mouvement)

    icons = find_icons(args.inputs)
    if not icons:
        print("Aucune icone trouvee.", file=sys.stderr)
        return 1
    os.makedirs(args.out, exist_ok=True)
    transforms = frame_transforms(args.frames, bob, args.squash, args.style)

    snippets = []
    for path in icons:
        stem = os.path.splitext(os.path.basename(path))[0]
        if args.prefix and not stem.startswith(args.prefix):
            stem = args.prefix + stem
        icon = load_icon(path, cut=args.cut, cut_tol=args.cut_tol)
        icon = fit_icon(icon, args.cell, args.fill, bob, args.squash, args.style)
        sheet = make_sheet(icon, args.cell, args.frames, transforms)
        dst = os.path.join(args.out, stem + ".png")
        sheet.save(dst)
        print(f"  {os.path.basename(path):28s} -> {dst}  "
              f"({sheet.width}x{sheet.height}, {args.frames} frames)")
        snippets.append(
            f"    {stem+':':18s}{{ sliceX: {args.frames}, anims: {{ {args.anim_name}: "
            f"{{ from: 0, to: {args.frames-1}, loop: true, speed: {args.speed} }} }} }},")

    print("\nA coller dans CONFIG.anims (js/config.js) si le sprite est nouveau :\n")
    print("\n".join(snippets))
    print("\nPuis reembarque les assets :  python3 gen_assets_data.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
