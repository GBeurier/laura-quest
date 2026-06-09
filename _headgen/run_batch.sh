#!/usr/bin/env bash
# Genere les TETES de passant via codex (image_gen, photo en -i) puis les regride.
#  Idempotent : si _headgen/raw/<name>_sheet.png existe deja, on saute l'appel
#  codex (utile pour reprendre/reparer). Re-lancer le script = reparer les ratees.
#  Usage : run_batch.sh [name ...]   (defaut = tout le manifest.tsv)
#  HEADGEN_JOBS permet de paralleliser, mais 1 est le defaut sur pour eviter
#  qu'une session copie le PNG genere par une autre depuis ~/.codex/generated_images.
set -u
cd /home/delete/laura_quest
export PATH="$HOME/.local/bin:$PATH"
CODEX="$(command -v codex || echo "$HOME/.local/bin/codex")"

gen_one() {
  local name="$1"
  if [ ! -f "_headgen/raw/${name}_sheet.png" ]; then
    "$CODEX" exec --dangerously-bypass-approvals-and-sandbox \
       -i "_headgen/src/${name}.png" < "_headgen/prompts/${name}.txt" \
       > "_headgen/gen_${name}.log" 2>&1
  fi
  if [ -f "_headgen/raw/${name}_sheet.png" ]; then
    python3 _headgen/regrid.py "_headgen/raw/${name}_sheet.png" "$name" >> "_headgen/gen_${name}.log" 2>&1
    echo "DONE $name (regrid rc=$?)"
  else
    echo "FAIL $name (no raw)"
  fi
}
export -f gen_one; export CODEX

if [ "$#" -gt 0 ]; then
  NAMES=("$@")
else
  mapfile -t NAMES < <(grep -v '^#' _headgen/manifest.tsv | awk -F'\t' 'NF{print $1}')
fi
printf '%s\n' "${NAMES[@]}" | xargs -P "${HEADGEN_JOBS:-1}" -I{} bash -c 'gen_one "$@"' _ {}

echo "===== HEADS BATCH DONE ($(date)) ====="
missing=0
for n in "${NAMES[@]}"; do [ -f "assets/sprites/${n}.png" ] || { echo "  MISSING: $n"; missing=$((missing+1)); }; done
echo "missing finals: $missing / ${#NAMES[@]}"
