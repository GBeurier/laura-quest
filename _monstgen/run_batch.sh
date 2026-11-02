#!/usr/bin/env bash
# Genere les feuilles de monstres via codex (image_gen) puis les regride.
#  Concurrence limitee (-P) pour ne pas saturer. Usage: run_batch.sh [name ...]
#  (sans args = toute la liste par defaut, moustique exclu car deja fait).
set -u
cd /home/delete/laura_quest
export PATH="$HOME/.local/bin:$PATH"
CODEX="$(command -v codex || echo "$HOME/.local/bin/codex")"

gen_one() {
  local n="$1"
  "$CODEX" exec < "_monstgen/prompts/$n.txt" > "_monstgen/gen_$n.log" 2>&1
  local rc=$?
  if [ -f "_monstgen/raw/${n}_sheet.png" ]; then
    python3 _monstgen/regrid.py "_monstgen/raw/${n}_sheet.png" "$n" >> "_monstgen/gen_$n.log" 2>&1
    echo "DONE  $n (codex rc=$rc, regrid rc=$?)"
  else
    echo "FAIL  $n (codex rc=$rc, pas de raw produit)"
  fi
}
export -f gen_one
export CODEX

NAMES=("$@")
if [ "${#NAMES[@]}" -eq 0 ]; then
  NAMES=(caillou camion criquet ademe assureur abeille cafard transpalette \
         livreur coursier imprimante chips tuyau sac fontaine dossiers)
fi
printf '%s\n' "${NAMES[@]}" | xargs -P 3 -I{} bash -c 'gen_one "$@"' _ {}
echo "===== BATCH TERMINE ($(date)) ====="
ls -la _monstgen/raw/