# Pipeline sprites — grilles → frames normalisées

Traite les planches `assets/sprites_bench/*.png` (grilles **4×2 = 8 frames**, fond
~blanc, perso au centre avec marges, échelle non normalisée d'une planche à l'autre).

## Détourage : heuristique vs réseau de neurones (`--nn`)

Deux moteurs de détourage, partagés par `sprite_cut.py` et `sprite_detour.py` :

- **Heuristique** (défaut) : fond clair par connexité + poches enclavées. Rapide,
  pas de dépendance, mais fragile sur les **blancs du perso sur fond blanc** (le
  chat blanc pouvait être abîmé).
- **`--nn` : BiRefNet** (segmentation SOTA, recommandé). Segmente le *sujet* et non
  la couleur → le chat blanc est conservé nativement, et la haute résolution capte
  même l'intérieur des roues. Nécessite torch → **lancer avec l'env dédié** :

  ```bash
  /home/delete/venv_311/bin/python tools/sprite_cut.py --nn
  /home/delete/venv_311/bin/python tools/sprite_normalize.py
  /home/delete/venv_311/bin/python tools/sprite_detour.py img/ --nn
  ```

  (modèle ~400 Mo téléchargé au 1er run ; tourne sur GPU. Paquets installés dans
  venv_311 : transformers, timm, kornia.) Le matte NN fait son propre AA ; on ajoute
  une décontamination couleur (color bleed) pour zéro liseré. Les assets Laura
  actuels ont été générés avec `--nn`.

## 1. Découpe + détourage

```bash
python3 tools/sprite_cut.py
```

- découpe chaque planche en 8 frames (ligne du haut 1..4, ligne du bas 5..8) ;
- retire le fond blanc **par connexité depuis les bords** → les blancs *intérieurs*
  (chat angora, chaussettes, reflets) sont préservés, pas de trous ;
- rogne sur la bounding box, plumage anti-halo ;
- sort `assets/sprites_cut/<série>/<série>_1.png … _8.png` (RGBA serré)
  + `assets/sprites_cut/manifest.json` (bbox/dimensions par frame).

## 2. Normalisation d'échelle + canvas commun

```bash
python3 tools/sprite_normalize.py
```

- au 1er passage, crée `tools/sprite_scale.json` avec un `scale` **auto-suggéré**
  par série = `hauteur_bbox_max_globale / hauteur_bbox_max_série` (la frame la plus
  haute de chaque série atteint la hauteur de référence) ;
- met toutes les frames sur un **canvas commun** (auto, avec **marge 30 %** pour
  pouvoir réagrandir sans rogner), pieds alignés sur une **baseline commune** ;
- sort `assets/sprites_norm/<série>/…` + un aperçu `assets/sprites_norm/_preview.png`.

⚠️ L'auto-suggestion **sur-agrandit** les séries à pose penchée/accroupie (throws,
jump, hurt, duck) dont la bbox est courte à cause de la *pose*, pas de l'échelle.
Ces séries sont signalées `<-- |scale-1| élevé`. → à corriger à la main (étape 3).

## 3. Rescaler une série (réglage manuel)

Édite les `"scale"` dans `tools/sprite_scale.json` puis relance
`python3 tools/sprite_normalize.py`. Ou en une ligne :

```bash
python3 tools/sprite_normalize.py --set throw_rice=0.85 jump=0.92
python3 tools/sprite_normalize.py --reseed     # recalcule les suggestions auto
```

Le JSON conserve tes valeurs entre deux passages (seules les séries manquantes sont
ajoutées). Autres réglages par série : `x_offset`, `y_offset` (px), `align`
(`bottom-center` défaut | `center` | `cell` — `cell` conserve la position dessinée
dans la cellule, utile pour garder le *lift* d'un saut). Réglages globaux : `margin`,
`default_align`, `canvas` (`null` = auto, ou `[L,H]` fixe).

Le contour est **anti-aliasé** (alpha adouci, σ = `AA_SIGMA` dans `_spritelib.py`)
avec **décontamination couleur** (la couleur du sprite est reportée sous l'alpha)
→ pas de bord en escalier ni de liseré blanc, y compris au filtrage/mipmap GPU.

## Détourage en bulk (sans normalisation)

Pour détourer d'autres sprites sans toute la chaîne de normalisation :

```bash
python3 tools/sprite_detour.py assets/raw/                 # dossier -> assets/raw_cutout/
python3 tools/sprite_detour.py a.png b.png --out detoure/  # fichiers precis
python3 tools/sprite_detour.py sheets/*.png --grid 4x3     # planches -> frames
python3 tools/sprite_detour.py img/ --no-trim --pad 8      # garde la taille / marge
```

- Détecte la **couleur de fond sur la bordure** → marche pour blanc OU couleur unie
  quelconque (`--bg R,G,B` pour forcer, `--tol N` pour la tolérance, `--white` pour
  forcer le chemin clair).
- `--grid CxR` découpe chaque image en grille ; sinon traite l'image entière.
- `--no-pockets` : ne retire que le fond connecté aux bords (garde les creux).
- `--aa SIGMA` : règle/désactive l'anti-alias (`--aa 0` = bord dur). `--trim`/`--no-trim`.
- Même qualité de détourage + AA que le pipeline Laura.

Code partagé (détourage, AA, bbox, découpe) : `tools/_spritelib.py`
(`remove_white_bg` = fond clair, `remove_bg_auto` = fond quelconque, `cutout` = cœur).
