#!/usr/bin/env bash
# Icones de la campagne Marcos : UNE session codex par icone, SEQUENTIEL.
#  Idempotent (un raw/<nom>.png present n'est pas regenere). ammo_note_fire
#  prend ammo_note comme reference -i (meme note, en feu). Puis build_marcos.py.
#  Usage : bash _icongen/run_marcos.sh [nom ...]
set -u
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"
CODEX="$(command -v codex || echo "$HOME/.local/bin/codex")"
mkdir -p _icongen/raw
NAMES=("$@")
[ "${#NAMES[@]}" -eq 0 ] && NAMES=(ammo_note ammo_note_fire shot_mud shot_durian shot_spine shot_net shot_feather pickup_durian)
for n in "${NAMES[@]}"; do
  [ -f "_icongen/raw/$n.png" ] && { echo "skip $n (raw present)"; continue; }
  ref=()
  [ "$n" = ammo_note_fire ] && [ -f _icongen/raw/ammo_note.png ] && ref=(-i _icongen/raw/ammo_note.png)
  "$CODEX" exec --dangerously-bypass-approvals-and-sandbox "${ref[@]}" \
     < "_icongen/prompts_marcos/$n.txt" > "_icongen/gen_marcos_$n.log" 2>&1
  [ -f "_icongen/raw/$n.png" ] && echo "raw OK $n" || echo "FAIL $n (no raw)"
done
python _icongen/build_marcos.py
