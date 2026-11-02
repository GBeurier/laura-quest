#!/usr/bin/env bash
# Decor de la campagne Marcos : UNE session codex par asset, SEQUENTIEL (les
#  image_gen en parallele se melangent). Les refs -i sont lues dans
#  prompts/<nom>.refs (fichiers de _javagen/refs/, photos d'inspiration
#  redimensionnees a 1024px : gitignorees, a recreer depuis _Marcos/Level_inspiration
#  si besoin). Idempotent : un raw/<nom>.png present n'est pas regenere.
#  Usage : bash _javagen/run.sh [nom ...]   puis   python _javagen/build.py [nom ...]
set -u
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"
CODEX="$(command -v codex || echo "$HOME/.local/bin/codex")"
mkdir -p _javagen/raw
NAMES=("$@")
[ "${#NAMES[@]}" -eq 0 ] && NAMES=(tile_bamboo bamboo_leg bg_java_volcano bg_java_village bg_java_paddy bg_marcos_map bg_marcos_chapter bg_marcos_win)
for n in "${NAMES[@]}"; do
  [ -f "_javagen/raw/$n.png" ] && { echo "skip $n (raw present)"; continue; }
  ref=()
  if [ -f "_javagen/prompts/$n.refs" ]; then
    while read -r r; do [ -n "$r" ] && [ -f "_javagen/refs/$r" ] && ref+=(-i "_javagen/refs/$r"); done < "_javagen/prompts/$n.refs"
  fi
  "$CODEX" exec --dangerously-bypass-approvals-and-sandbox "${ref[@]}" \
     < "_javagen/prompts/$n.txt" > "_javagen/gen_$n.log" 2>&1
  [ -f "_javagen/raw/$n.png" ] && echo "raw OK $n" || echo "FAIL $n (no raw)"
done
