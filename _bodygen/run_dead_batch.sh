#!/usr/bin/env bash
# Genere les CORPS AFFALES "cadavre" via codex (image_gen, 1re frame debout en -i)
#  puis les regride. Miroir de run_batch.sh mais : prompts_dead/ + ref -i + regrid_dead.
#  Idempotent : si le raw _dead existe deja, on saute l'appel codex.
#  Usage : run_dead_batch.sh [biome_sex ...]   (defaut = les 10)
#  DEADGEN_JOBS = parallelisme (defaut 3).
set -u
cd /home/delete/laura_quest
export PATH="$HOME/.local/bin:$PATH"
CODEX="$(command -v codex || echo "$HOME/.local/bin/codex")"
JOBS="${DEADGEN_JOBS:-3}"

gen_one() {
  local key="$1"                 # ex. labo_h
  local biome="${key%_*}" sex="${key##*_}"
  if [ ! -f "_bodygen/raw/body_${key}_dead_sheet.png" ]; then
    "$CODEX" exec --dangerously-bypass-approvals-and-sandbox \
      -i "_bodygen/dead_ref/body_${key}_ref.png" \
      < "_bodygen/prompts_dead/${key}.txt" \
      > "_bodygen/gen_dead_${key}.log" 2>&1
  fi
  local rc=$?
  if [ -f "_bodygen/raw/body_${key}_dead_sheet.png" ]; then
    python3 _bodygen/regrid_dead.py "_bodygen/raw/body_${key}_dead_sheet.png" "$biome" "$sex" >> "_bodygen/gen_dead_${key}.log" 2>&1
    echo "DONE  $key (codex rc=$rc, regrid rc=$?)"
  else
    echo "FAIL  $key (codex rc=$rc, pas de raw -> voir _bodygen/gen_dead_${key}.log)"
  fi
}
export -f gen_one; export CODEX

KEYS=("$@")
if [ "${#KEYS[@]}" -eq 0 ]; then
  KEYS=(champ_h champ_f pote_h pote_f horti_h horti_f labo_h labo_f bureau_h bureau_f)
fi
printf '%s\n' "${KEYS[@]}" | xargs -P "$JOBS" -I{} bash -c 'gen_one "$@"' _ {}
echo "===== DEAD BODIES TERMINE ($(date)) ====="
ls -la _bodygen/raw/*_dead_sheet.png 2>/dev/null