#!/usr/bin/env bash
# Genere les CORPS de passant via codex (image_gen) puis les regride.
#  Usage: run_batch.sh [biome_sex ...]  (defaut = les 10).
set -u
cd /home/delete/laura_quest
export PATH="$HOME/.local/bin:$PATH"
CODEX="$(command -v codex || echo "$HOME/.local/bin/codex")"

gen_one() {
  local key="$1"                 # ex. champ_h
  local biome="${key%_*}" sex="${key##*_}"
  "$CODEX" exec < "_bodygen/prompts/$key.txt" > "_bodygen/gen_$key.log" 2>&1
  local rc=$?
  if [ -f "_bodygen/raw/body_${key}_sheet.png" ]; then
    python3 _bodygen/regrid.py "_bodygen/raw/body_${key}_sheet.png" "$biome" "$sex" >> "_bodygen/gen_$key.log" 2>&1
    echo "DONE  $key (codex rc=$rc, regrid rc=$?)"
  else
    echo "FAIL  $key (codex rc=$rc, pas de raw)"
  fi
}
export -f gen_one
export CODEX

KEYS=("$@")
if [ "${#KEYS[@]}" -eq 0 ]; then
  KEYS=(champ_h champ_f pote_h pote_f horti_h horti_f labo_h labo_f bureau_h bureau_f)
fi
printf '%s\n' "${KEYS[@]}" | xargs -P 3 -I{} bash -c 'gen_one "$@"' _ {}
echo "===== BODIES TERMINE ($(date)) ====="
ls -la _bodygen/raw/