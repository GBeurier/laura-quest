#!/usr/bin/env bash
# Genere les FOSSES-PIEGES ('%') via codex (image_gen), trompe-l'oeil.
#  SEQUENTIEL (-P 1) : eviter la fuite de prompts entre generations (cf. piege
#  connu des fonds). Usage: run_batch.sh [name ...]  (defaut = les 3).
set -u
cd /home/delete/laura_quest
export PATH="$HOME/.local/bin:$PATH"
CODEX="$(command -v codex || echo "$HOME/.local/bin/codex")"

gen_one() {
  local n="$1"
  "$CODEX" exec --dangerously-bypass-approvals-and-sandbox \
     < "_hazardgen/prompts/$n.txt" > "_hazardgen/gen_$n.log" 2>&1
  local rc=$?
  if [ -f "_hazardgen/raw/$n.png" ]; then
    echo "DONE  $n (codex rc=$rc) -> $(python3 -c "from PIL import Image;print(Image.open('_hazardgen/raw/$n.png').size)" 2>/dev/null)"
  else
    echo "FAIL  $n (codex rc=$rc, pas de raw) -- tail log:"; tail -6 "_hazardgen/gen_$n.log"
  fi
}
export -f gen_one; export CODEX

NAMES=("$@")
if [ "${#NAMES[@]}" -eq 0 ]; then NAMES=(hazard_acid hazard_paddy hazard); fi
printf '%s\n' "${NAMES[@]}" | xargs -P 1 -I{} bash -c 'gen_one "$@"' _ {}
echo "===== BATCH TERMINE ($(date)) ====="
echo "Puis : python3 _hazardgen/build.py && python3 gen_assets_data.py"
