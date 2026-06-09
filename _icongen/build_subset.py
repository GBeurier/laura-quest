#!/usr/bin/env python3
"""Post-traite UNIQUEMENT les pickups passes en argument (chroma-key + bump 4
frames, cellule 64) -> assets/sprites/. NE TOUCHE AUCUN autre pickup (contrairement
a build.py qui reconstruit tout ce qui a un raw). Usage :
  python3 _icongen/build_subset.py pickup_pilule pickup_champignon
"""
import os, sys, subprocess
ROOT = "/home/delete/laura_quest"
RAW = os.path.join(ROOT, "_icongen/raw")
CUT = os.path.join(ROOT, "_icongen/cut")
OUT = os.path.join(ROOT, "assets/sprites")
RCK = "/home/delete/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py"
GEN = os.path.join(ROOT, "tools/gen_pickup_sheets.py")


def key(name):
    src = os.path.join(RAW, name + ".png")
    dst = os.path.join(CUT, name + ".png")
    subprocess.run([sys.executable, RCK, "--input", src, "--out", dst,
                    "--auto-key", "border", "--soft-matte",
                    "--transparent-threshold", "14", "--opaque-threshold", "210",
                    "--despill", "--force"], check=True)
    return dst


def main():
    names = sys.argv[1:]
    os.makedirs(CUT, exist_ok=True)
    cuts = [key(n) for n in names if os.path.exists(os.path.join(RAW, n + ".png"))]
    if not cuts:
        print("rien a traiter (aucun raw)")
        return
    subprocess.run([sys.executable, GEN, *cuts, "--out", OUT,
                    "--cell", "64", "--frames", "4", "--style", "both"], check=True)
    print("OK:", ", ".join(names))


if __name__ == "__main__":
    main()
