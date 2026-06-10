#!/usr/bin/env bash
# Genere les CLONES "cat-free" des feuilles de Laura via codex (image_gen, feuille
#  avec chat en -i, prompt = "retire le chat"). Puis postprocess -> final/<name>_nocat.png.
#  Idempotent : si raw/<name>_sheet.png existe deja, on saute l'appel codex.
#  Usage : run_batch.sh [name ...]   (defaut = les 7 feuilles)
#  NB : NE copie PAS dans assets/sprites/ -> on valide d'abord les final/ a l'oeil,
#       puis on copie a la main (cp final/<name>_nocat.png assets/sprites/ + gen_assets_data.py).
set -u
cd /home/delete/laura_quest
export PATH="$HOME/.local/bin:$PATH"
CODEX="$(command -v codex || echo "$HOME/.local/bin/codex")"

declare -A FRAMES=( [hero_idle]=8 [hero_run]=8 [hero_jump]=8 [hero_roll]=8 [hero_bike]=7 [hero_duck]=7 [hero_throw]=6 [hero_hurt]=8 )

gen_one() {
  local name="$1"
  local log="_catfreegen/gen_${name}.log"
  if [ ! -f "_catfreegen/raw/${name}_sheet.png" ]; then
    "$CODEX" exec --dangerously-bypass-approvals-and-sandbox \
       -i "_catfreegen/src/${name}.png" < "_catfreegen/prompts/${name}.txt" \
       > "$log" 2>&1
  fi
  # Repli FIABLE : si codex n'a pas fait le cp, on recupere l'image depuis le
  #  dossier generated_images de NOTRE session (id lu dans le log -> pas de collision
  #  avec les autres agents codex qui tournent en parallele).
  if [ ! -f "_catfreegen/raw/${name}_sheet.png" ]; then
    local sid; sid="$(grep -m1 'session id:' "$log" | sed -E 's/.*session id: *//')"
    local png; png="$(ls -t "$HOME/.codex/generated_images/${sid}/"*.png 2>/dev/null | head -1)"
    [ -n "$png" ] && cp "$png" "_catfreegen/raw/${name}_sheet.png"
  fi
  if [ ! -f "_catfreegen/raw/${name}_sheet.png" ]; then
    echo "FAIL $name (no raw) — voir $log"; return
  fi
  python3 _catfreegen/postprocess.py "_catfreegen/raw/${name}_sheet.png" "$name" "${FRAMES[$name]}" >> "$log" 2>&1
  echo "DONE $name (final=$([ -f _catfreegen/final/${name}_nocat.png ] && echo ok || echo NO))"
}

if [ "$#" -gt 0 ]; then NAMES=("$@"); else NAMES=(hero_idle hero_run hero_jump hero_roll hero_bike hero_duck hero_throw); fi
for n in "${NAMES[@]}"; do gen_one "$n"; done
echo "===== CATFREE BATCH DONE ($(date)) ====="
