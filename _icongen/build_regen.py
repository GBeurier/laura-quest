#!/usr/bin/env python3
"""Post-traite la PASSE DE REGENERATION : raw/ magenta (Imagen) -> assets/sprites.
Detoure (chroma-key codex) puis met en feuille selon le groupe :
  - 5 munitions -> spin 6 frames (tools/gen_ammo_spin.py), cellule par ammo
  - 3 pickups   -> bump 4 frames cellule 64 (tools/gen_pickup_sheets.py)
  - fx_bomb_shadow -> grossit 6 frames 128x64 (tools/gen_shadow_sheet.py)
Idempotent par asset : ne traite que les raw/ presents. Ensuite : gen_assets_data.py
"""
import os
import subprocess
import sys

ROOT = "/home/delete/laura_quest"
RAW = os.path.join(ROOT, "_icongen/raw")
CUT = os.path.join(ROOT, "_icongen/cut")
OUT = os.path.join(ROOT, "assets/sprites")
RCK = "/home/delete/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py"
PY = sys.executable

AMMO_CELL = {"ammo_graine": 52, "ammo_graine_fire": 56, "ammo_cookie": 52,
             "ammo_gateau": 60, "ammo_gateau_enfer": 72}
PICKUPS = ["pickup_puissance", "pickup_cadence", "pickup_pierce"]
SHADOW = "fx_bomb_shadow"


def have(name):
    return os.path.exists(os.path.join(RAW, name + ".png"))


def key(name):
    src, dst = os.path.join(RAW, name + ".png"), os.path.join(CUT, name + ".png")
    subprocess.run([PY, RCK, "--input", src, "--out", dst, "--auto-key", "border",
                    "--soft-matte", "--transparent-threshold", "14",
                    "--opaque-threshold", "210", "--despill", "--force"], check=True)
    return dst


def main():
    os.makedirs(CUT, exist_ok=True)
    done = []
    # munitions : spin 6 frames
    for name, cell in AMMO_CELL.items():
        if not have(name):
            continue
        cut = key(name)
        subprocess.run([PY, os.path.join(ROOT, "tools/gen_ammo_spin.py"), cut,
                        "--name", name, "--cell", str(cell), "--frames", "6",
                        "--out", OUT], check=True)
        done.append(name)
    # pickups : bump 4 frames, cellule 64
    cuts = [key(n) for n in PICKUPS if have(n)]
    if cuts:
        subprocess.run([PY, os.path.join(ROOT, "tools/gen_pickup_sheets.py"), *cuts,
                        "--out", OUT, "--cell", "64", "--frames", "4", "--style", "both"], check=True)
        done += [os.path.splitext(os.path.basename(c))[0] for c in cuts]
    # ombre de bombe : grossit 6 frames
    if have(SHADOW):
        cut = key(SHADOW)
        subprocess.run([PY, os.path.join(ROOT, "tools/gen_shadow_sheet.py"), cut,
                        "--name", SHADOW, "--out", OUT], check=True)
        done.append(SHADOW)

    print("OK regen:", ", ".join(done) if done else "(aucun raw a traiter)")
    print("-> python3 gen_assets_data.py pour reembarquer")


if __name__ == "__main__":
    main()
