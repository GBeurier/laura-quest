#!/usr/bin/env bash
# Genere le sprite hero_dead (Laura K.O. affalee) via codex (image_gen, pose
#  debout hero_idle frame 0 en reference -i) puis le regride.
#  Miroir minimal de _bodygen/run_dead_batch.sh pour UN seul sprite.
#  Idempotent : si le raw existe deja, on saute l'appel codex.
set -u
cd /home/delete/laura_quest
export PATH="$HOME/.local/bin:$PATH"
CODEX="$(command -v codex || echo "$HOME/.local/bin/codex")"

RAW="_herodeadgen/raw/hero_dead_sheet.png"
if [ ! -f "$RAW" ]; then
  "$CODEX" exec --dangerously-bypass-approvals-and-sandbox \
    -i "_herodeadgen/hero_ref.png" \
    < "_herodeadgen/prompt.txt" \
    > "_herodeadgen/gen_hero_dead.log" 2>&1
fi
rc=$?
if [ -f "$RAW" ]; then
  python3 _herodeadgen/regrid.py "$RAW" >> "_herodeadgen/gen_hero_dead.log" 2>&1
  echo "DONE hero_dead (codex rc=$rc, regrid rc=$?)"
  ls -la assets/sprites/hero_dead.png
else
  echo "FAIL hero_dead (codex rc=$rc, pas de raw -> voir _herodeadgen/gen_hero_dead.log)"
fi
