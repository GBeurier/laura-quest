#!/usr/bin/env bash
# Regenere le boss AGRICULTEUR en MAFIOSO : visage tire de _bossgen/_agri_ref.png
# (photo reelle passee en -i a image_gen), costume gangster, MEME tracteur.
# N'ecrase QUE boss_agriculteur_*. Sauvegarde fermier dans _bossgen/_backup_farmer/.
set -u
cd /home/delete/laura_quest
export PATH="$HOME/.local/bin:$PATH"
CODEX="$(command -v codex || echo "$HOME/.local/bin/codex")"
REF=_bossgen/_agri_ref.png
LOG=_bossgen/gen_agriculteur_mafioso.log

# Raws fermier deja sauvegardes -> on les retire pour que le regrid ne reprenne
# pas une vieille feuille si codex ne sort qu'une seule des deux planches.
rm -f _bossgen/raw/agriculteur_move_sheet.png _bossgen/raw/agriculteur_atk_sheet.png

echo "=== Boss agriculteur (mafioso) $(date) ==="
"$CODEX" exec --dangerously-bypass-approvals-and-sandbox -i "$REF" \
   < _bossgen/prompts/agriculteur.txt > "$LOG" 2>&1
echo "  codex rc=$?"

[ -f _bossgen/raw/agriculteur_move_sheet.png ] && \
  python3 _bossgen/regrid.py _bossgen/raw/agriculteur_move_sheet.png agriculteur --move
[ -f _bossgen/raw/agriculteur_atk_sheet.png ]  && \
  python3 _bossgen/regrid.py _bossgen/raw/agriculteur_atk_sheet.png  agriculteur --atk

echo "===== AGRI MAFIOSO DONE ($(date)) ====="
ls -la _bossgen/raw/agriculteur_*_sheet.png \
       _bossgen/final/agriculteur_*_preview.png \
       assets/sprites/boss_agriculteur_*.png 2>/dev/null
