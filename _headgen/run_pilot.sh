#!/usr/bin/env bash
set -u
cd /home/delete/laura_quest
export PATH="$HOME/.local/bin:$PATH"
CODEX="$(command -v codex || echo "$HOME/.local/bin/codex")"
gen_one() {
  local name="$1"
  "$CODEX" exec --dangerously-bypass-approvals-and-sandbox \
     -i "_headgen/src/$name.png" < "_headgen/prompts/$name.txt" \
     > "_headgen/gen_$name.log" 2>&1
  local rc=$?
  if [ -f "_headgen/raw/${name}_sheet.png" ]; then
    python3 _headgen/regrid.py "_headgen/raw/${name}_sheet.png" "$name" >> "_headgen/gen_$name.log" 2>&1
    echo "DONE $name (codex rc=$rc regrid rc=$?)"
  else
    echo "FAIL $name (codex rc=$rc, no raw) -- tail log:"; tail -5 "_headgen/gen_$name.log"
  fi
}
export -f gen_one; export CODEX
printf '%s\n' npc_f_1 npc_h_1 | xargs -P 2 -I{} bash -c 'gen_one "$@"' _ {}
echo "===== PILOT DONE ($(date)) ====="
