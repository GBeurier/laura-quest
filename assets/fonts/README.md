# Fonts embarquees (bulles BD des PNJ)

Embarquees en data-URI par `gen_assets_data.py` (prefixe `_` = ignoree), chargees
par `loadFont` dans `js/game.js`, utilisees par les bulles BD (`npcBubble`) pour
afficher les `phrases` de `js/npc.js` avec leurs accents. cf. CLAUDE.md (gotcha
"No accents").

| Fichier | Source | Licence | Subset |
|---|---|---|---|
| `font_bubble.ttf` | Comic Neue Bold — (c) The Comic Neue Project Authors (https://github.com/crozynski/comicneue) | SIL OFL 1.1 | latin U+0020-024F, U+1E00-1EFF, ponctuation U+2000-206F |
| `font_bubble_kh.ttf` | Noto Sans Khmer — (c) The Noto Project Authors (https://github.com/notofonts) | SIL OFL 1.1 | instance Regular (wght 400) ; ASCII + khmer U+1780-17FF, U+19E0-19FF |

Subsets produits avec fonttools (`pyftsubset` / `varLib.instancer`). Pour
re-subsetter (ex. nouvel alphabet dans une phrase), repartir des TTF complets
des depots ci-dessus.
