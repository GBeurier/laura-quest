# REFONTE_PLAN — Gameplay + Boss

> Plan d'exécution vérifié (synthèse de 7 specs d'architecture + 3 revues adversariales).
> Base figée : **tag `v1.0-pre-refonte`** (rollback sûr). Source détaillée : voir
> `GAMEPLAY_REVIEW.md` pour le *pourquoi*. Ce fichier = le *quoi/comment/dans quel ordre*.
>
> Règle d'or : **mécaniques d'abord (code), art Codex ensuite.** Aucune phase ne
> doit casser le rendu. Chaque phase = un commit validé par screenshot headless.

---

## 1. Décisions arrêtées

- **Saut** : double saut conservé. Jump-cut converti en **« relâcher SAUT tôt = petit saut »** (`onKeyRelease`, confirmé présent dans le moteur). `jumpCutG → 0`. **BAS = accroupi uniquement** (on retire `aimUp`/`aimDown` des contrôles).
- **Rollers / vélo** : **powerup positif** (plus rapide + saute plus haut **ET garde le tir**), perdu si touchée (absorbe le coup *avant* le tier). Tir depuis la pose de roule (fallback sans frame dédiée) + hook `hero_roll_throw`/`hero_bike_throw` si générés plus tard.
- **Kit final = 6 verbes** : tir de base · lob lourd · dash · double saut · accroupi · chat. Chaque verbe est justifié par au moins un boss (cf. §5).
- **Passants/NPC = inoffensifs** : ils ne font que mourir, **ils n'attaquent jamais** (`touchDamage 0`). Ils ne sont **jamais** utilisés comme « minions menaçants ». Les vrais minions de boss = ennemis réels fragiles (cafard/bug/assureur). Tuer un passant = **-1 tier** (la conscience). On les retire des arènes de boss.

### Remap contrôles (≈7 touches, vs ~10)

| Verbe | Touche | Note |
|---|---|---|
| Bouger | ←→ / Q,D | inchangé |
| Sauter (double, hauteur variable) | Haut / Z,W | relâcher tôt = petit saut |
| Accroupi | Bas | **seul usage** de Bas |
| Tir de base (gratuit) | Espace (maintenu) | famille = dernier powerup ramassé |
| Lob lourd (auto-visé, coûte stamina) | **X** (ex-pleurer) | `autoAimArc` |
| **Dash** (i-frames, coûte stamina) | **Maj** (libéré du switch d'arme) | |
| Chat (instantané, cooldown) | C | plus de maintien 2 s |
| Quitter | Échap | |

> **Supprimés** : `switchAmmo` (Maj), `pleurer` (X), `raler` (V), visée manuelle (Haut/Bas).

---

## 2. Modèle de ressource (résolu — plus de jauge surchargée)

Deux ressources **orthogonales**, chacune un seul métier :

- **STAMINA** = une barre. Regen **au soleil**, 0 à l'ombre (métaphore panneau conservée, enfin lisible). **Dépensée par : dash + lob lourd.** Le tir de base est gratuit. (= l'ancienne jauge `sun` renommée/recâblée ; **un seul** bloc de regen.)
- **TIER** = 3 pips discrets (découplés de l'énergie). **+1** en ramassant soleil/data ou un powerup d'arme ; **-1** à chaque coup reçu **et** à chaque passant tué.
  - **Buffer plafonné** : au **tier 1 = aucun buffer** (un coup coûte un cœur). Seuls **tier 2/3 absorbent** le coup (perte de tier au lieu d'un cœur). → empêche le « 8-10 PV effectifs » qui banaliserait le début. Ordre d'absorption d'un coup : **équipement → tier(2/3) → cœur**.

HUD épuré : cœurs · barre stamina (glow conservé) · **3 pips de tier** · récoltes (data/page/publi) · chat (cooldown) · score. **Retirés** : panneau d'arme + coût, crâne « capacité condamnée », les 2 pastilles de sorts.

---

## 3. Décisions boss (forks tranchés)

1. **Michael (lvl4)** = **bombes en papier** (cloche qui éclate en éventail télégraphé, boss de positionnement ; corrige le bug « tire dans le sol »).
2. **Jury (lvl6)** = **MVP maintenant** (refonte VFX `dropBomb` + spawn-en-face + phase finale rendue *dash-pertinente*). Le « bureau → ex-boss 1 par 1 → verdict » = **tâche dédiée de la passe arènes** (déférée).
3. **Cendrine (lvl5)** = **huissiers supprimés**, remplacés par des **tampons-pièges au sol** (`api.hazard`, area denial qui force le dash).

---

## 4. Dettes techniques partagées (corrigées **une fois**, profitent à tous)

- **Projectiles vilains** → `enemyBullet` : rotation par frame + petite traînée ; chaque boss garde son sprite `shot_*` thématique (fallback cercle si PNG absent).
- **Bombe + impact pourris** → **un seul** helper `api.dropBomb(x, groundY, delay, sprite)` : sprite qui tombe + **ombre qui grandit** (télégraphe) + `addBoom` + secousse à l'impact. Remplace `skyHazard`/`marker` plat. Sert agriculteur, Cendrine (tampon), jury. *(Cendrine = `api.dropBomb(...,'shot_stamp')`, pas de helper dupliqué.)*
- **Spawn derrière** → **un seul** helper module-scope `spawnEnFace(b, p, kind)` dans `bosses.js` (entre boss et joueur, clampé à l'écran, poof). Remplace **tous** les `api.add('...')`. (Pas de doublon dans `BOSS_API`.)
- **Feuille unique par boss** *(art-déféré, cf. §8)* : `_move`+`_atk` → **une grille `sliceX:8`** (mapping de clips par boss : idle / attack / hurt, + `move` pour le tracteur). `bossAnim` simplifié (plus de swap `b.sprAtk`). **Ne pas migrer tant que le PNG Codex n'est pas embarqué** (les IA tournent avec les feuilles actuelles pendant toute la refonte gameplay).
- **Helpers de tir mutualisés** : `tripleShoot(b,p,api,speed)` (3 hauteurs, le milieu **duckable**), `lobPaper`, `spawnEnFace`, `dropBomb` → **tous module-scope** dans `bosses.js` (pas définis dans une IA).

---

## 5. Sols piégés (ajout — statique **et** lancé)

- **Statique** : nouveau caractère de map `%` → entité **non solide** au ras du sol, tag `hazard`, **dégât au contact** (`CONFIG.hazards.touchDamage = 1`) via `damagePlayer` + invuln (un coup propre, pas de drain). Skin **par biome** via `theme.hazard` (liste = variantes) : champ=clous, pote=tessons, horti=fiole cassée, labo=acide, bureau=agrafes. `buildLevel` : un `case '%'`.
- **Lancé par boss (temporaire)** : helper `api.hazard(x, dur)` = même entité + `lifespan(dur)` + télégraphe (`marker`). **Complexité faible** (composition de briques déjà présentes). Attribué à **Cendrine** (tampons) + **phase finale jury**.
- **Synergie** : le dash (i-frames) traverse un piège → encore une raison de dasher ; et ça casse le « sol plat ».
- **Garde-fou** : area denial juste **seulement** s'il reste où se mettre → couverture **partielle** + télégraphe ; conçu **avec l'arène** (placement → passe level design).

---

## 6. Refonte des 6 boss (IA — tourne sur les feuilles actuelles)

> Philosophie conservée : **télégraphe → esquive → fenêtre de punition**. Une identité = un verbe rentabilisé.

- **lvl1 Agriculteur** — *drive + drop bombs*. Le tracteur traverse en semant des **bombes verticales** (`dropBomb`, ombre qui grandit). À l'arrêt (**stall**) = fenêtre de punition : **Laura lobe depuis un panneau solaire solide**. Esquive : lob-depuis-panneau + saut/dash latéral sous la bombe. *(Plus de fourches horizontales.)* **Prérequis dur** : convertir quelques `x` en `-` solides près du `B` (ships avec l'IA).
- **lvl2 Proprio** — *triple missile + séisme localisé*. `tripleShoot` dont **le tir du milieu est duckable** ; charge/dash télégraphée ; **séisme localisé autour du boss** (petit = alerte `shake`, gros = dégât si trop près) qu'on **saute**. Esquive : **duck** (missile) / **saut** (séisme). Anim refaite (feuille bien proportionnée).
- **lvl3 RStudio** — *haut/bas alterné + cafards fragiles*. Monte sur **petite plateforme** (teleport-blink), tire `tripleShoot` rapide ; descend, **invoque 2-3 cafards 1 PV** (`spawnEnFace`) ; **load** = punition. Esquive : **dash** + **plateformes** + tir de base sur les cafards. Skin : **logo RStudio bien visible**. *(On retire le tir de près inutile et le mur vertical.)*
- **lvl4 Michael** — **fork** (cf. §3). Reco : **bombes en papier** en cloche qui **éclatent en éventail** au sol (`enemyBullet` kind `paper_bomb` → 3 sous-tirs) ; garde ses distances ; fenêtre de recalc. Corrige le bug « tire dans le sol ». Tête = réf `_bossgen/_michael.png`.
- **lvl5 Cendrine** — *téléport spectaculaire + tampons-pièges*. **Téléport refait** : marqueur destination → **implosion** (scale→0 + clignote) → réapparition flash → **explosion AoE** télégraphée (on **dash** à l'opposé). **Huissiers → fork** (reco : remplacés par `api.hazard` tampons au sol). Destination **clampée à l'écran**.
- **lvl6 Jury** — **fork** (cf. §3). Reco **MVP** : garder les 3 phases (gates d'enrage OK), mais (a) `skyHazard → api.dropBomb`, (b) **spawn-en-face** (et **ne plus invoquer de passants comme menace**), (c) **phase finale dash-pertinente** (murs de projectiles avec **trou** annoncé par poof → on dash dedans + tampons-pièges). Le « bureau → ex-boss 1 par 1 » = tâche dédiée de la passe arènes.

---

## 7. Ordre d'exécution (chaque phase = 1 commit validé par screenshot)

> Les **groupes atomiques** signalés (⚛) doivent être commités ensemble, sinon double-binding / crash.

**Phase 0 — ✅ fait** : tag `v1.0-pre-refonte`.

**Phase 1 — Contrôles & armes (refactor A)** ⚛
Collapse 4→2 armes (`tir_base`=graine droit gratuit ; `lob_lourd`=gateau cloche AoE). Supprimer `pied_riz`/`cookie`/`ammoOrder`. **Lob sur X auto-visé** (`autoAimArc(p, ammoOverride)` — *ne pas* lire `p.ammoKey`). Retirer pleurer/raler/switchAmmo (fonctions, bindings, HUD, autopilot, **mobile.js** boutons). Cat instantané. **Jump-cut → relâche** (`onKeysRelease`), `jumpCutG=0`, retirer `aimUp`/`aimDown`, BAS=crouch. (Le lob coûte la jauge `sun` existante en attendant la Phase 2.) MàJ `story.hint` + keycaps HUD. → *valider tir/lob/cat/saut*.

**Phase 2 — Ressource stamina + tier** 
Renommer/recâbler `sun → stamina` (**un seul** bloc de regen). Pips de tier (1-3) : +1 pickup soleil/data, -1 coup & meurtre (**buffer tier2/3 seulement**). `registerKill → tier`. HUD redesign. Cheat `H` (stamina/tier). Guards `save.js`. → *valider HUD + meurtre + recharge*.

**Phase 3 — Dash + powerups d'arme (B+C)** ⚛(mobile)
Dash sur Maj (`p.vel = vec2(dashVx, p.vel.y)` — **pas** le pattern knock ; i-frames via `p.invuln`). Bouton mobile dash. 3 pickups d'arme (spread/pierce/bomb) → `collectPickup` change la famille. Rollers/vélo positifs (retirer le guard `eqv` sur le tir, MàJ `msg`). → *valider dash/i-frames + ramassage d'arme + tir en rollers*.

**Phase 4 — Dettes tech boss (code, feuilles actuelles)** 
`enemyBullet` rotation+traînée ; `api.dropBomb` (+fallback cercle) ; `spawnEnFace` (remplace tous les `api.add`, jury ne spawn plus de passants-menace) ; `api.hazard` ; sols piégés statiques (`%`, `theme.hazard`, `CONFIG.hazards`, `buildLevel`). → *valider une bombe, un spawn, un piège*.

**Phase 5 — IA des 6 boss** (1 sous-commit / boss) 
Réécrire chaque machine à états (§6) sur les **clips existants** (idle/attack/hurt) + tech partagée. Agriculteur ships avec l'édit minimal niveau1 (`x→-`). → *valider `#game/niveauX` et `#gamejury` un par un*.

**Phase 6 — Art Codex** *(toi + moi pour les prompts ; je ne génère pas l'art moi-même)* 
Générer tous les assets (§8), **puis** migration feuille-unique (config anims + `bossAnim` + `SPRITES_FALLBACK` + `gen_boss_sheets.py`), `gen_assets_data.py`, valider.

**Déféré — Grosse passe level design** : arènes (panneaux solides lvl1, petites plateformes lvl3, espace téléport lvl5, jury multi-phase), espacement des passants, placement des powerups + sols piégés, **jury « ex-boss 1 par 1 »**.

---

## 8. Liste d'assets Codex (à générer)

- **Projectiles** (64×64 @2x, fond magenta, face gauche) : `shot_fork`, `shot_stake`, `shot_error`, `shot_paper_ball` (Michael), `shot_form` (Cendrine), `shot_gavel` (jury), `shot_paper` (générique).
- **Bombe / tampon** : `shot_bomb` (chute), `shot_stamp` (tampon Cendrine).
- **Sols piégés** (par biome) : `hazard_champ`, `hazard_pote`, `hazard_horti`, `hazard_labo`, `hazard_bureau`.
- **Boss — feuille UNIQUE `sliceX:8`** (idle/attack/hurt) : `boss_agriculteur`, `boss_proprietaire`, `boss_rstudio` (**logo R bien lisible**), `boss_michael` (**tête = `_bossgen/_michael.png`**), `boss_cendrine`, `boss_jury` (**frames plus larges**, 3 personnes).
- **Pickups d'arme** (4 frames) : `pickup_spread`, `pickup_piercing`, `pickup_bomb`.
- **Optionnels (fallback propre)** : `hud_pip_tier`, `fx_dash`, `hero_roll_throw`, `hero_bike_throw`.

---

## 9. Checklist anti-régression (les « pièges » trouvés par la passe contradictoire)

- `autoAimArc` : ajouter param `ammoOverride` (sinon crash quand `ammoKey` disparaît).
- **Maj** : supprimer `switchAmmo` *dans le même commit* que l'ajout du dash (sinon double handler).
- **Frame count boss** : unifier **`sliceX:8`** partout (mapping de clips par boss) ; jury = frames plus larges, pas plus nombreuses.
- **Un seul** : bloc de regen stamina, réécriture du bloc tir/lob, retrait du guard `eqv`, suppression de `catBar`, helper `dropBomb`/`spawnEnFace`.
- `CONFIG.story.hint` + keycaps HUD + cheat `H` + `SPRITES_FALLBACK` (noms `boss_*_move/_atk`) + anims mortes `hero_throw_rice/cookie` + `mobile.js` (`pl.ammoKey`) + autopilot (`castPleurer/Raler`) → **tous à nettoyer**.
- `save.js` : garder la compat (champs lus avec défauts).
- `engine/kaplay.js` : **préserver le patch null-`s`** ; documenter dans `engine/KAPLAY_PATCHES.md`.
- Boss : **garder les feuilles `_move/_atk` actuelles** jusqu'à l'embarquement de l'art unique (sinon rendu cassé).
