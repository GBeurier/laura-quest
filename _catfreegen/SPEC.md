# _catfreegen — clones « cat-free » des feuilles de Laura

But : produire, pour chaque feuille de Laura, une version **sans le chat dans le sac**,
utilisee **quand le chat est deploye** (dehors). Approche « assets en double » (decidee
avec l'auteur) : on garde les feuilles AVEC chat, et on genere des clones SANS chat.

Sheets concernees (7) : `hero_idle hero_run hero_jump hero_roll hero_bike hero_duck hero_throw`.
Sortie : `final/<name>_nocat.png` (memes dimensions que `assets/sprites/<name>.png`).
Le moteur (a cabler) basculera sur `hero_<clip>_nocat` tant que le chat est dehors.

## Pipeline (meme schema que _headgen / _bossgen)
```bash
python3 _catfreegen/make_prompts.py            # prompts/<name>.txt
bash    _catfreegen/run_batch.sh [name ...]    # codex image_gen (-i src) -> raw/ ; puis postprocess -> final/
# valider les final/<name>_nocat.png a l'oeil, PUIS :
cp _catfreegen/final/<name>_nocat.png assets/sprites/<name>_nocat.png
python3 gen_assets_data.py
```

## Contrat image_gen
- L'IA recoit la feuille AVEC chat en `-i` et doit la **redessiner fidelement** en
  **retirant uniquement le chat** (sac rouge normal/ferme), meme nb de frames, memes
  poses/positions/echelle (garder le bob), meme palette/style, fond `#ff00ff` a plat,
  gros gaps magenta entre frames, sujet a gauche.
- `postprocess.py` : chroma-key magenta -> detection des N blocs -> recompose en
  N cellules 158x177, pieds sur la baseline (ancre `bot`).

## Limite connue
image_gen **redessine** (ne preserve pas les pixels) : le clone n'est pas pixel-identique
a la version avec chat. OK ici car le swap with-cat <-> cat-free se fait pendant le *poof*
de deploiement, et chaque jeu de feuilles est utilise isolement. Le risque reel = la
coherence des frames d'un meme cycle. -> **valider chaque final/ a l'oeil** avant copie.

## Etat
Pilote : `hero_idle` d'abord (juger le rendu), puis le reste si concluant.
