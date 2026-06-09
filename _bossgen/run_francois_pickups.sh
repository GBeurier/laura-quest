#!/usr/bin/env bash
# Batch 2 : boss FRANCOIS (proprietaire, 2 feuilles) + pickups pilule/champignon.
#  N'ecrase QUE boss_proprietaire_* et pickup_pilule/champignon.
set -u
cd /home/delete/laura_quest
export PATH="$HOME/.local/bin:$PATH"
CODEX="$(command -v codex || echo "$HOME/.local/bin/codex")"

echo "=== Boss Francois (proprietaire) ==="
"$CODEX" exec < _bossgen/prompts/proprietaire.txt > _bossgen/gen_francois.log 2>&1
echo "  codex rc=$?"
[ -f _bossgen/raw/proprietaire_move_sheet.png ] && python3 _bossgen/regrid.py _bossgen/raw/proprietaire_move_sheet.png proprietaire --move
[ -f _bossgen/raw/proprietaire_atk_sheet.png ]  && python3 _bossgen/regrid.py _bossgen/raw/proprietaire_atk_sheet.png  proprietaire --atk

echo "=== Pickups pilule + champignon ==="
"$CODEX" exec < _icongen/prompt_pickups_b.txt > _icongen/gen_pickups_new.log 2>&1
echo "  codex rc=$?"
python3 _icongen/build_subset.py pickup_pilule pickup_champignon

echo "===== BATCH2 TERMINE ($(date)) ====="
ls -la _bossgen/raw/proprietaire_* _icongen/raw/pickup_pilule.png _icongen/raw/pickup_champignon.png 2>/dev/null