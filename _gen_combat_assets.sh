#!/usr/bin/env bash
# Generation SEQUENTIELLE (jamais en parallele : image_gen concurrent fuite
#  entre prompts) des assets de la passe "combat de boss v2.3" :
#   1. 6 projectiles (shot_chart v2, boulette, chip, eau, courrier, page)
#   2. enemy_ademe reskin avec logo ADEME (-i ref)
#   3. hero_dash (feuille de dash, -i hero_run)
#   4. hero_dash_nocat (retrait du chat, -i raw de l'etape 3)
#   5. boss_proprietaire_move v2 (vrai cycle idle + artefact ventre corrige, -i ref)
#  Le post-traitement (chroma/regrid/build) est fait APRES validation visuelle,
#  pas ici. Repli session-id si la session codex n'a pas fait son cp.
set -u
cd /home/delete/laura_quest
export PATH="$HOME/.local/bin:$PATH"
CODEX="$(command -v codex || echo "$HOME/.local/bin/codex")"

rescue() {  # rescue <log> <dest>  : recupere le PNG de NOTRE session si cp manque
  local log="$1" dest="$2"
  [ -f "$dest" ] && return 0
  local sid; sid="$(grep -m1 'session id:' "$log" | sed -E 's/.*session id: *//')"
  local png; png="$(ls -t "$HOME/.codex/generated_images/${sid}/"*.png 2>/dev/null | head -1)"
  [ -n "$png" ] && cp "$png" "$dest"
}

echo "=== [1/5] shots combat ($(date +%T)) ==="
"$CODEX" exec < _icongen/prompt_shots_combat.txt > _icongen/log_shots_combat.log 2>&1
for n in shot_chart shot_boulette shot_chip shot_eau shot_courrier shot_page; do
  # pas de rescue multi-images fiable (6 PNG dans la meme session) : on liste juste
  [ -f "_icongen/raw/$n.png" ] && echo "  raw OK  $n" || echo "  raw MANQUANT $n"
done

echo "=== [2/5] enemy_ademe logo ($(date +%T)) ==="
"$CODEX" exec --dangerously-bypass-approvals-and-sandbox \
  -i assets/sprites/enemy_ademe.png < _monstgen/prompts/ademe_logo.txt \
  > _monstgen/gen_ademe_logo.log 2>&1
rescue _monstgen/gen_ademe_logo.log _monstgen/raw/ademe_logo_sheet.png
[ -f _monstgen/raw/ademe_logo_sheet.png ] && echo "  raw OK" || echo "  raw MANQUANT"

echo "=== [3/5] hero_dash ($(date +%T)) ==="
"$CODEX" exec --dangerously-bypass-approvals-and-sandbox \
  -i assets/sprites/hero_run.png < _catfreegen/prompts/hero_dash.txt \
  > _catfreegen/gen_hero_dash.log 2>&1
rescue _catfreegen/gen_hero_dash.log _catfreegen/raw/hero_dash_sheet.png
[ -f _catfreegen/raw/hero_dash_sheet.png ] && echo "  raw OK" || echo "  raw MANQUANT"

echo "=== [4/5] hero_dash_nocat ($(date +%T)) ==="
if [ -f _catfreegen/raw/hero_dash_sheet.png ]; then
  "$CODEX" exec --dangerously-bypass-approvals-and-sandbox \
    -i _catfreegen/raw/hero_dash_sheet.png < _catfreegen/prompts/hero_dash_nc.txt \
    > _catfreegen/gen_hero_dash_nc.log 2>&1
  rescue _catfreegen/gen_hero_dash_nc.log _catfreegen/raw/hero_dash_nc_sheet.png
  [ -f _catfreegen/raw/hero_dash_nc_sheet.png ] && echo "  raw OK" || echo "  raw MANQUANT"
else
  echo "  SKIP (pas de hero_dash_sheet.png)"
fi

echo "=== [5/5] boss_proprietaire_move v2 ($(date +%T)) ==="
"$CODEX" exec --dangerously-bypass-approvals-and-sandbox \
  -i assets/sprites/boss_proprietaire_move.png < _bossgen/prompts/proprietaire_move_v2.txt \
  > _bossgen/gen_proprietaire_move_v2.log 2>&1
rescue _bossgen/gen_proprietaire_move_v2.log _bossgen/raw/proprietaire_move_v2_sheet.png
[ -f _bossgen/raw/proprietaire_move_v2_sheet.png ] && echo "  raw OK" || echo "  raw MANQUANT"

echo "===== GEN COMBAT ASSETS TERMINE ($(date)) ====="
