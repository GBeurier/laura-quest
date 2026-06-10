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
  local log="_headgen/gen_${name}.log"
  # --- 1. TETE VIVANTE (feuille de clignement) ---------------------------------
  if [ ! -f "_headgen/raw/${name}_sheet.png" ]; then
    "$CODEX" exec --dangerously-bypass-approvals-and-sandbox \
       -i "_headgen/src/${name}.png" < "_headgen/prompts/${name}.txt" \
       > "$log" 2>&1
  fi
  if [ ! -f "_headgen/raw/${name}_sheet.png" ]; then
    echo "FAIL $name (no raw)"; return
  fi
  python3 _headgen/regrid.py "_headgen/raw/${name}_sheet.png" "$name" >> "$log" 2>&1

  # --- 2. TETE ZOMBIE (cadavre) : meme workflow, on ajoute juste la tete morte --
  #  reference -i = la tete VIVANTE qu'on vient de generer (redraw fidele).
  #  Idempotent : si le _dead.png existe deja (ex. les 38 tetes d'origine), on saute.
  if [ -f "assets/sprites/${name}.png" ] && [ ! -f "assets/sprites/${name}_dead.png" ]; then
    [ -f "_headgen/prompts/${name}_dead.txt" ] || python3 _headgen/make_dead_prompts.py "$name" >> "$log" 2>&1
    python3 _headgen/prep_dead.py "$name" >> "$log" 2>&1
    if [ ! -f "_headgen/raw/${name}_dead_sheet.png" ]; then
      "$CODEX" exec --dangerously-bypass-approvals-and-sandbox \
         -i "_headgen/dead_src/${name}.png" < "_headgen/prompts/${name}_dead.txt" \
         >> "$log" 2>&1
    fi
    if [ -f "_headgen/raw/${name}_dead_sheet.png" ]; then
      python3 _headgen/regrid_dead.py "_headgen/raw/${name}_dead_sheet.png" "$name" >> "$log" 2>&1
    fi
  fi
  echo "DONE $name (live=$([ -f assets/sprites/${name}.png ] && echo ok || echo NO) dead=$([ -f assets/sprites/${name}_dead.png ] && echo ok || echo NO))"
}
export -f gen_one; export CODEX

if [ "$#" -gt 0 ]; then
  NAMES=("$@")
else
  mapfile -t NAMES < <(grep -v '^#' _headgen/manifest.tsv | awk -F'\t' 'NF{print $1}')
fi
printf '%s\n' "${NAMES[@]}" | xargs -P "${HEADGEN_JOBS:-1}" -I{} bash -c 'gen_one "$@"' _ {}

echo "===== HEADS BATCH DONE ($(date)) ====="
missing=0; missing_dead=0
for n in "${NAMES[@]}"; do
  [ -f "assets/sprites/${n}.png" ]      || { echo "  MISSING live: $n"; missing=$((missing+1)); }
  [ -f "assets/sprites/${n}_dead.png" ] || { echo "  MISSING dead: $n"; missing_dead=$((missing_dead+1)); }
done
echo "missing finals: live $missing / dead $missing_dead  (of ${#NAMES[@]})"
