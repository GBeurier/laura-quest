#!/usr/bin/env bash
# Genere les CORPS APPLAUDISSEURS du cortege via codex (image_gen) puis les
#  regride au gabarit des passants (_bodygen/regrid.py biome=clap) -> memes
#  tailles ingame. SEQUENTIEL (pas de fuite entre prompts image_gen concurrents).
#  Usage: run_batch.sh [h f]   (defaut = les 2).
set -u
cd /home/delete/laura_quest
export PATH="$HOME/.local/bin:$PATH"
CODEX="$(command -v codex || echo "$HOME/.local/bin/codex")"
mkdir -p _clapgen/raw

gen_one() {
  local sex="$1"
  "$CODEX" exec < "_clapgen/prompts/clap_$sex.txt" > "_clapgen/gen_clap_$sex.log" 2>&1
  local rc=$?
  if [ -f "_clapgen/raw/body_clap_${sex}_sheet.png" ]; then
    python3 _bodygen/regrid.py "_clapgen/raw/body_clap_${sex}_sheet.png" clap "$sex" >> "_clapgen/gen_clap_$sex.log" 2>&1
    echo "DONE  clap_$sex (codex rc=$rc, regrid rc=$?)"
  else
    echo "FAIL  clap_$sex (codex rc=$rc, pas de raw)"
  fi
}

KEYS=("$@"); [ "${#KEYS[@]}" -eq 0 ] && KEYS=(h f)
for sex in "${KEYS[@]}"; do gen_one "$sex"; done
echo "===== CLAP BODIES TERMINE ($(date)) ====="
ls -la _clapgen/raw/ assets/sprites/body_clap_*.png
