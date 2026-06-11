# GAMEPLAY v2 — passe « difficulté, plateformes & boss »

> **Statut : IMPLÉMENTÉ** (2026-06-10, paliers A **et** B d'un coup sur décision
> user). Décisions §9 tranchées (annotations `>>>`) : **jury BOSS-RUSH**,
> **4 cœurs tout de suite** (`maxHp: 4`, le §2.3 ci-dessous documente la reco
> initiale à 5), **médaille SAUVÉS complète** (persistance incluse),
> **double-tap ▼** pour le drop-through tactile, one-way joueur seulement.
> Validé par CDP headless : one-way/drop-through, bouclier (seuil 40, bris
> 2.5 s, cœurs sous le seuil), garde boss (1.5 dégâts/s mesurés à P1 vs ~90
> avant), boss-rush jury (invités 35 % + reprise), onde au sol, ombres des
> panneaux hors-écran (visuel + `inShade`). Bugs croisés fixés : bombes du
> tracteur jamais tirées (`skyEvery` > durée de traversée), `moveDirClamp`
> sans détection de bord, triple-missile du proprio jamais tiré (double `cyc++`),
> `bossFloaty` sans `opacity`, `KEY.jump` mobile résolvant `up` au lieu de `z`,
> dead code `p.shielded` retiré. Assets (médailles, trophée, fx_quake,
> pickups puissance/cadence) : génération Codex/Imagen via `_icongen/v2/`.
> La v1 (refonte arsenal/soleil/HUD) reste acquise : cœurs, cadavres, reset
> d'arsenal par niveau, timer + meilleur temps.
> **Review Codex faite** (2026-06-10, 28 points) — intégrée ; bilan en §10.

---

## 0. Constat — mesuré dans le code, pas au ressenti

| # | Problème ressenti | Cause mesurée |
|---|---|---|
| 1 | « Le bouclier soleil protège beaucoup trop » | `hitAbsorb: 40`, `regen: 22/s` (`config.js sun`) : un coup absorbé est **remboursé en 1.8 s**, sous couvert d'`invulnTime: 1.1 s`. Pire (vu en review) : `damagePlayer` absorbe le coup ENTIER dès que `p.sun > 0` — même avec 1 point de soleil. En plein soleil le bouclier est **infini** → les 5 cœurs (+ café qui rend 2) ne servent jamais. |
| 2 | « Vélo et rollers disparaissent avant le bouclier » | `damagePlayer` (`game.js:590`) teste `p.equipped` **avant** le soleil : l'équipement saute au premier gnon alors que le bouclier aurait absorbé. Ordre actuel : équipement → soleil → cœurs. |
| 3 | « Le tir de base est très fort, les boss meurent en quelques secondes » | `hitBoss` (`game.js:1333`) n'a **aucune i-frame** : à PUISSANCE 3 / CADENCE 3, 5 graines × 2 dégâts / 0.11 s ≈ **90 dégâts/s** à bout portant, contre 18–64 HP de boss. L'agriculteur meurt en < 1 s, le jury en ~2 s (ses 3 phases sont invisibles). Le gâteau des enfers ajoute ~16 dégâts/lob pour 48 soleil, remboursés en ~2 s de regen. |
| 4 | « On se cogne dans les plateformes, pas de passage entre les étages » | `addPanel` (`game.js:733`) = tuile `body isStatic` pleine, **solide des 4 côtés**. Saut = 760²/(2·1900) ≈ 152 px ≈ **3.2 tuiles** → impossible de monter sur un deck sans se cogner la tête. Ce n'est **pas** la hitbox (Laura est déjà à 0.68×0.86) : c'est la solidité. Le moteur vendoré a `platformEffector` (one-way), jamais branché. |
| 5 | « Le gameplay 1v1 des boss est limité » | Les IA ont des fenêtres de punition soignées (stall 1.8 s, stagger 1.2 s, load 1.5 s…) **pensées pour un DPS modeste**. Au DPS actuel, une seule fenêtre = boss mort. Résultat : on maintient ESPACE, fin. Et les arènes n'exploitent pas le kit dash/duck/saut. |

Tout se tient : le bouclier infini supprime la défense, le DPS libre supprime
l'offense, les plateformes pleines suppriment le mouvement. La v2 remet de la
**friction aux trois endroits**, sans punir la joueuse casual.

---

## 1. Principes (la boussole de la passe)

1. **La casual finit le jeu.** La difficulté attaque le *temps*, le *style* et
   le *100 %*, jamais la progression : checkpoint au boss, graines infinies,
   cœurs lisibles, retry gratuit.
2. **La difficulté est opt-in** : médailles (temps / data / sauvés), routes
   hautes risquées, publis gated par équipement, « sans dégât ». Celui qui veut
   souffrir choisit de souffrir.
3. **On réutilise l'existant.** `platformEffector` est déjà dans le bundle, les
   états de punition existent dans `bosses.js`, le chrono + meilleur temps
   existent, le chat existe, les sprites de tous les boss existent. Aucun
   nouveau gros système.
4. **Chaque règle a un signal** (c'est un cadeau, pas un soulslike) : bouclier
   brisé = jauge grisée, boss en garde = « tink » gris, fenêtre ouverte = boss
   doré + « OUVERT ! ».
5. **Deux paliers d'implémentation** (reco Codex) : palier A = les fixes
   structurels mesurables (ordre dégâts, bouclier cassable, tick boss, HP,
   one-way joueur) ; palier B = la couche design (garde/fenêtres, phases 2,
   jury rush, médailles). On playtest entre les deux.

---

## 2. Survie : un bouclier qui casse, un équipement qui dure

### 2.1 Nouvel ordre des dégâts : SOLEIL → ÉQUIPEMENT → CŒURS

Inversion des deux premiers tests de `damagePlayer` (`game.js:595-609`) :

```
coup reçu
  └─ soleil ≥ 40 ?     → absorbe (−40 soleil) + BRISE le bouclier (cf. 2.2)
       └─ équipé ?     → perd vélo/rollers (le coup « casse le matos »)
            └─ sinon   → −1 cœur
```

- **Seuil d'absorption** (review #1) : le bouclier n'absorbe que si
  `sun >= hitAbsorb` (40). En dessous, le soleil est conservé (c'est de la
  munition) mais ne protège plus → fini l'absorption infinie à 1 point de
  soleil près. La jauge HUD affiche un **cran à 40** : au-dessus le liseré
  bouclier de Laura est allumé, en dessous il est éteint. Lisible d'un coup
  d'œil.
- Fix direct du ressenti : **vélo/rollers survivent tant que le bouclier
  tient** → on en profite enfin, et ils deviennent le carburant du time attack.
- Thématiquement propre : le surbouclier protège Laura *et* son matos ; à
  l'ombre (soleil gelé), tout redevient fragile → les couloirs d'ombre restent
  les zones de tension voulues par la v1.

### 2.2 Le bouclier CASSE (le vrai nerf)

Le problème n'est pas l'absorption (40, ok), c'est le remboursement instantané.

- **Nouveau `sun.hitRegenDelay: 2.5`** : après un coup absorbé, la **regen
  passive** est coupée pendant 2.5 s (« bouclier brisé » : jauge grisée +
  flash). Les **rayons `o` ramassés créditent toujours** (+30 instantané, ils
  ne réarment pas le délai) → se replacer/collecter reste la réponse active.
- `sun.regen` 22 → **18/s** : recharger 40 de bouclier prend ~2.2 s *après* le
  délai, soit ~4.7 s entre deux coups tankés. En plein soleil on tanke
  toujours **2 coups d'affilée** (100 ≥ 2×40) — mais plus 2 coups *toutes les
  2 secondes*, et le 3e passe.
- Le coût des pâtisseries devient une vraie décision : cramer 48 de soleil en
  gâteau des enfers peut faire passer sous le seuil de 40 → renoncer au
  bouclier pour l'offense, exactement le dilemme voulu par la v1.

> **v2.1 (playtest)** : `hitRegenDelay` repassé à **0** — l'autoregen est
> **continue** même après un coup absorbé (le « bouclier brisé » était ressenti
> comme un trou de regen frustrant). Le mécanisme reste entièrement câblé :
> remettre une durée > 0 dans `config.js` (`sun.hitRegenDelay`) le réactive.

> **v2.2** : réactivé à **2 s** et **élargi à TOUTE blessure** (coup absorbé,
> équipement perdu OU cœur — cf. `damagePlayer`) : la jauge d'énergie est
> bloquée 2 s après chaque coup encaissé. Sans ça le bouclier se réarmait en
> continu → spam défensif. Les rayons `o` créditent toujours pendant le lock.
>
> **v2.2 (bis) — le CONTACT d'un boss est un coup LOURD** (`sun.bossTouchPierces`,
> `damagePlayer(heavy)`) : se faire écraser par le tracteur **traverse** le
> surbouclier — il draine ses 40 de soleil au passage mais équipement/cœurs
> encaissent QUAND MÊME (`touchDamage` du boss), avec recul ×1.6
> (`player.heavyKnockMul`) et grosse secousse. Avant ça, un passage de tracteur
> avec ≥40 de soleil ne coûtait QUE du soleil → « ne fait quasiment rien ».
> Les tirs/bombes de boss restent absorbables normalement (le bouclier garde
> son rôle anti-projectiles) ; seul le contact physique perce.
>
> **Et le boss n'est PAS un mur** : la résolution physique joueur↔boss est
> annulée des deux côtés (`onBeforePhysicsResolve` + `preventResolution`,
> cf. `spawnPlayer`/`spawnBoss`) — le tracteur TRAVERSE Laura. Sans ça, pendant
> l'invuln post-coup (ni dégât ni lock), son body la bulldozait devant le capot
> jusqu'à hors de l'arène : des « coups lourds fantômes » sans perte de vie ni
> lock de regen. Le seul recul légitime est celui du coup (knockback ×1.6).

### 2.3 Cœurs et soins

- `player.maxHp` reste **5** (review #6/#18 : ne pas durcir la survie deux
  fois ; le bouclier cassable est déjà LE nerf. On redescendra à 4 après
  playtest si ça rigole encore trop — c'est un chiffre dans config).
- `pickups.cafe.heal` 2 → **1** (un vrai soin, plus un demi full-heal ; le
  boss en drop toujours un à sa mort).

### 2.4 Checkpoint boss (la contrepartie casual)

Aujourd'hui mourir au boss = retour carte = retraverser tout le niveau : c'est
ça qui interdit de durcir les boss. Donc :

- Au premier franchissement de la porte d'arène (le tile `B` est connu), on
  mémorise un **checkpoint**. Mourir pendant le boss → **respawn IN-SCENE**
  (pas de rebuild du niveau, review #14) : Laura téléportée à l'entrée
  d'arène, cœurs pleins, soleil 50, arsenal/score/chat conservés ; boss remis
  à `maxHp` + machine d'états réinitialisée + repositionné à `homeX` ; tirs
  ennemis (`ehot`), ondes de choc ET **bombes en vol** purgés (pas de pluie sur
  le checkpoint).
- **Le KO doit être LISIBLE** (v2.2, playtest : un respawn silencieux se lisait
  comme un bug « éjectée + vie pleine d'un coup ») : jingle de défaite
  (`sfx('lose')`), **flash rouge plein écran**, gros message
  `story.checkpoint` (« K.O. ! REPRISE A L ARENE ») + grosse secousse —
  cf. `respawnAtArena` (game.js).

> **v2.2 (playtest) : checkpoint DÉSACTIVÉ pour tous les niveaux + jury**
> (`CONFIG.bossCheckpoint: false`) — même rendu lisible, le respawn restait
> perçu comme un glitch. Mourir au boss = écran lose / retour carte, comme
> partout. Tout le mécanisme (pose du checkpoint, `respawnAtArena`, K.O.
> rouge) reste câblé : repasser le flag à `true` le réactive tel quel.
- `levelTime` **continue de tourner** entre les essais → la pénalité time
  attack est naturelle, pas besoin de compteur de morts.
- Mourir hors boss : inchangé (retour carte / écran lose).

---

## 3. Plateformes traversantes — le déblocage du level design

### 3.1 Mécanique

- **Étape 0 (proto, review #7/#8)** : valider `platformEffector({})` sur UNE
  tuile dans une page de probe avant la bascule — l'API exige un objet
  (`platformEffector()` nu crashe : le code minifié déréférence `t.surfaceArc`)
  et son filtre est basé sur l'angle de la **vélocité** du corps entrant, pas
  sur la normale de contact. Si le comportement est douteux, **fallback custom
  trivial** sur le même hook : `onBeforePhysicsResolve` du panneau →
  `preventResolution()` sauf si la cible descend (`vel.y > 0`) ET avait les
  pieds au-dessus du cap à la frame précédente. ~10 lignes, indépendant du
  moteur.
- `addPanel` (`game.js:733`) : la tuile de collision gagne un **tag `panel`**
  et devient **solide par le dessus uniquement**. **Phase 1 : one-way pour le
  JOUEUR seulement** (review #20) — ennemis, passants et chat continuent de
  traiter les panneaux comme solides (aucun changement de leurs IA/patrouilles)
  ; on généralisera après validation si utile.
- **Redescendre : BAS + SAUT** sur un panneau → `p._dropT = 0.25 s`, les
  panneaux ignorent Laura pendant ce laps. Détails (review #10/#11) :
  intercepté **dans le handler de saut avant `p.jump()`** ; ne consomme pas un
  saut (ni le double-saut) ; conditionné à `p.curPlatform()` taggé `panel`
  (jamais sur le sol `=`, les cailloux `^` ou les murs de bord). Les deux
  touches existent partout, **y compris la manette tactile** (bouton ▼,
  `mobile.js:133`).

### 3.2 Ce qui ne change PAS (et c'est voulu)

- **Les tirs s'arrêtent toujours sur les panneaux** (les projectiles n'ont pas
  de `body`, leur `onCollide('solid')` reste) → le panneau reste un **couvert**.
- **L'abri anti-bombe** est calculé sur la grille (`game.js:1186`), pas sur la
  physique → se planquer sous un panneau protège toujours. (Test à ajouter :
  bombe avant/après destruction d'un `x`, review #13.)
- L'**ombre portée** (`castColumnShade`) et la regen soleil : inchangées.
- Le panneau cassable `x` : son déclencheur de crumble passe à
  **`pl.curPlatform() === t`** (review #12 — `isGrounded()` seul laisse un
  overlap latéral l'armer) → il ne s'amorce qu'en marchant VRAIMENT dessus.

### 3.3 Ce que ça ouvre

- Les **étages deviennent praticables** : monter pour fuir, redescendre d'un
  coup (BAS+SAUT) pour esquiver — deux nouveaux verbes gratuits.
- Les **routes hautes** redeviennent le contenu risque/récompense qu'elles
  devaient être (data, publis, raccourcis de speedrun) ; le deck secret du
  niveau 5 devient atteignable proprement.
- Passe de level design (après bascule) : sur chaque niveau, 1 route basse
  « casual » + 1 route haute plus dense en data/dangers (`%`, shooters,
  volants) — la difficulté plateforme demandée, en opt-in.
- `tools/check_levels.py` : ajouter la vérification « tout deck est joignable
  par en-dessous OU par escalier » (le cône de saut existe déjà dans l'outil).

### 3.4 Matrice de tests one-way (review #26)

À dérouler au proto puis à la bascule : Laura à pied / rollers (saut ×1.4) /
vélo ; ennemis `patrol`/`chase`/`jump` sur et sous un deck ; passants ;
chat (aller-retour sous un deck) ; projectiles joueur et boss ; bombes (abri) ;
ombre portée ; crumble `x` par-dessus et par-dessous ; mobile ▼+SAUT.

---

## 4. Boss : la garde, les fenêtres, la phase 2 — et un jury-boss-rush

### 4.1 Le TICK de dégât et la GARDE (le cœur du fix combat)

On ne nerfe pas le feeling des graines contre la chair à canon (5 graines qui
one-shot les criquets, c'est le power fantasy mérité de l'arsenal). On change
**ce que le boss en encaisse**, par **canal de dégâts** (review #3/#24) :

| Canal | Règle vs boss | Effet |
|---|---|---|
| **Graines** | 1 tick / **0.25 s** (`b.hitCdSeed`), dégât de tick **[1, 2, 3]** selon PUISSANCE (`arsenal.graines.bossTick`) | la volée de 5 compte pour 1 ; progression d'arsenal ×3 conservée, plafonnée à 4 ticks/s |
| **Pâtisseries (AoE)** | canal séparé, 1 explosion / **0.5 s** (`b.hitCdAoe`), dégât AoE plein (2/3/4) ; les mini-explosions des enfers comptent pour UNE explosion de plus max | le lob reste le burst de fenêtre (~7 dégâts l'enfers), pas un spam |
| **Chat** | pas de tick ; dégât **6** (au lieu de 2) + **ouvre une fenêtre** `vulnT = 1.5 s`, ré-armable au plus tôt **8 s** plus tard (`b.catVulnLock`, review #5) | l'ouvre-boîte tactique, pas un stun-lock à 3 charges |
| Hors fenêtre | tout canal × **`b.guard`** | la garde |

- **Garde graduée par boss** (review #17 — si 75 % des tirs font « tink », la
  casual lit « ça ne marche pas ») : `guard` = **0.5 / 0.4 / 0.35 / 0.3 /
  0.3 / 0.35** du boss 1 au jury. Le boss 1 reste tendre partout et sert de
  tutoriel ; la garde devient une vraie mécanique à partir du 2-3.
- Pendant les états de punition existants (stall, stagger, load, recalc,
  window) l'IA pose `b.guard = 1` → la **fenêtre** redevient LE moment où l'on
  fait des dégâts. Uptime visé ≈ 40 % du cycle (les durées sont déjà des
  champs de config par boss).
- **Lisibilité** (règle n°4) : garde = « tink » gris discret + floaty « GARDE »
  la première fois ; fenêtre = boss surligné doré, barre HP qui pulse, floaty
  « OUVERT ! ». Le stall de 1.8 s de l'agriculteur = le tutoriel naturel.

### 4.2 Les tremblements deviennent des SÉISMES LOCALISÉS

Le Todo est clair (« virer les tremblements, ça pourrit l'expérience ») :

- Les `api.shake()` de télégraphe sont remplacés par des **FX localisés** :
  poussière aux pieds du boss, fissure au sol, vibration du *sprite* du boss.
  On garde un micro-shake uniquement sur les explosions.
- Le séisme du proprio devient une **onde au sol visible** (vague de poussière
  qui parcourt le sol sur ~300 px depuis le point d'impact, dégât au contact si
  on est au sol) → **on saute pour l'éviter**, exactement le « petit
  tremblement prévient, gros fait dégâts » du Todo.

### 4.3 Phase 2 à 50 % HP — chaque boss garde son identité, et l'amplifie

À `hp/maxHp ≤ 0.5` (test trivial dans chaque IA), le boss passe en phase 2 :
petit poof + pose marquée, puis ses paramètres durcissent. Tout est fait avec
les outils déjà codés.

| Boss | Phase 1 (actuel) | Phase 2 (nouveau) |
|---|---|---|
| **Agriculteur** (tracteur) | rev → drive (bombes) → stall | drive ×1.25, `skyEvery` 3.4 → 2.4, et **une bombe ciblée tombe PENDANT le stall** → punir devient un risque calculé, plus un open bar. |
| **François** (charger) | pace → wind → dash → stagger → throw | **dash aller-retour** (re-wind court de 0.3 s au bord), triple-missile à CHAQUE pace (au lieu d'1/2, milieu toujours duckable), stagger 1.2 → 0.9, **onde au sol des deux côtés** à l'arrêt du dash. |
| **RStudio** (errors) | fire (3 salves) → summon → load | + le **« stack trace »** promis dans le commentaire du fichier : mur vertical à trou (factorisé depuis le jury) 1×/cycle, dont le trou s'aligne parfois EN HAUTEUR → force à monter sur les plateformes de l'arène (l'alternance sol/hauteur voulue par le Todo). `burstGap` 0.8 → 0.6, 3 cafards. |
| **Michael** (modeles) | aim → bombe papier / overload → recalc | **2 bombes papier** (sur le joueur + une décalée de ±120 px), overload 1 cycle/3 → 1/2, `keepMin/Max` 220–440 → 180–380 (il colle plus), recalc spawn 2 cafards. |
| **Cendrine** (paperasse) | pre → implosion/TP → throw → window | **double TP enchaîné** (preTime réduit au 2e), `formN` 4 → 6, tampon-piège 2.5 → 3.5 s, window 1.2 → 0.9. |

### 4.4 Le JURY devient un BOSS RUSH (l'envie du Todo)

Le Todo demande « le bureau, puis les boss 1 par 1, un gameplay qui oblige à
bouger ». Tous les sprites + IA existent — on les invoque :

- Les 3 phases HP du jury restent (Q&A / débat / verdict). **Entre les
  phases**, le jury « se concerte » (recule au fond, invulnérable, pose idle)
  et **invoque un ancien boss à ~35 % de ses HP** dans l'arène :
  - après la phase Q&A → **l'agriculteur** (tracteur + bombes) ;
  - après la phase débat → **RStudio** ou **Michael** (au hasard) ;
  - le verdict reste un duel pur contre le jury (mur à trou + bombes + panique).
- L'invité tué rouvre le combat (le jury revient). Sa mini-barre HP s'affiche
  sous celle du jury.
- **Coût réel, pas « quasi nul »** (review #15) : le code suppose UN boss —
  `BOSS_SHOT_SPRITE` global (→ passer par `b.shotSprite`), HUD `get('boss')[0]`
  (→ barre principale = jury, mini-barre = invité), `hitBoss` décrémente
  `bossesAlive` + drop café + « Va écrire » (→ flag `b.guest` qui saute tout
  ça). C'est ~1 journée de singletons à défaire, budgétée en palier B.
  L'alternative simple (une vague de minions + mur à trou durci, review #21)
  est listée en §9 si on veut couper.

### 4.5 HP recalibrés — la formule, puis la table

Durée ≈ `HP / DPS_eff`, avec `DPS_eff = (0.4 + 0.6 × guard) × DPS_tick + lobs`
(maths corrigées par la review #2 ; fenêtres ~40 %) :

| Arsenal au boss | DPS ticks brut | DPS_eff (guard 0.35) | + pâtisseries en fenêtre |
|---|---|---|---|
| P1/R1 (casual qui rate les pickups) | 3.6 | ≈ 2.2 | ≈ 3 |
| P2/R2 (parcours normal) | 8 (cap 4 ticks/s × 2) | ≈ 4.9 | ≈ 6 |
| P3/R3 (farm complet) | 12 | ≈ 7.3 | ≈ 9 |

| Boss | HP actuel | **HP v2** | Durée visée (arsenal attendu) | Morts « acceptées » |
|---|---|---|---|---|
| Agriculteur | 18 | **70** | ~25 s (P1–P2, guard 0.5) | 0–1 |
| François | 24 | **120** | ~25–30 s (P2) | 0–1 |
| RStudio | 30 | **170** | ~30–35 s (P2–P3) | 1–2 |
| Michael | 38 | **210** | ~35–40 s (P2–P3) | 1–2 |
| Cendrine | 46 | **280** | ~40–45 s (P3) | 2–3 |
| Jury | 64 | **450** (+ 2 invités ~35 %) | ~2 min – 2 min 30 au total | 2–4 |

> Les HP ×4–7 paraissent énormes : c'est l'effet mécanique du tick (l'ancien
> 18 HP = 18 graines ; le nouveau 70 ≈ 32 ticks ≈ 25 s en jouant les
> fenêtres). Le farm complet divise par ~2.5 la durée : c'est la **récompense
> time attack**, pas un bug. Arsenal attendu par niveau (à vérifier en passe
> niveaux) : P1–P2 / P2 / P2–P3 / P2–P3 / P3 / P3. Calibrage aux cheats
> (`G`/`H`, `1`–`6`, `#gameauto`).
> Budget soleil en boss : regen 18/s + rayons (`bossDropEvery: 9`) ≈ 21/s hors
> ombre ≈ un gâteau des enfers toutes les ~2.5 s SI on sacrifie le bouclier —
> c'est le dilemme, et le lock de 2.5 s après coup le rend réel (review #4).

### 4.6 Les ARÈNES utilisent enfin le kit de mouvement

- **Audit arène par arène** (review #16 — plusieurs ont déjà des panneaux à
  proximité) : l'objectif est 1–2 panneaux one-way utiles (h3–h5) par arène —
  poste de lob (le Todo niveau 1 : « tirer en cloche depuis les panneaux en
  évitant les bombes »), esquive verticale du mur-à-trou, drop BAS+SAUT.
- Bonus thématique gratuit : leur **ombre portée** (`castColumnShade` est
  automatique) crée des couloirs sans regen DANS l'arène → gérer son soleil
  pendant le boss devient un placement actif, pas un compteur passif.
- `check_levels.py` : garder l'interdit `%` en arène ; ne warner que les
  plateformes < h3 (gênent le boss), valider les autres.
- **Le boss IGNORE les panneaux** (`collisionIgnore: ['panel']`, `spawnBoss`) :
  les perchoirs de l'arène ne le bloquent jamais — il balaie DESSOUS. Sans ça,
  un deck h3 (< hauteur de boîte du boss, ~2.9 tuiles) coinçait le tracteur du
  niveau 1 en plein `drive` : jamais de bord → plus de stall ni de demi-tour,
  boss figé qui bombarde. Filet de sécurité en plus : `moveDirClamp`
  (`bosses.js`) traite un blocage physique persistant (rocher, mur) comme un
  bord → le boss fait demi-tour au lieu de se figer.

### 4.7 VERROU D'ARÈNE (v2.3) — le combat est sans retour

Diagnostic playtest : l'arène n'était **pas délimitée** — on sortait à gauche,
le bouclier remontait à 18/s hors de portée (le boss reste clampé à
`homeX±range` et éveillé pour toujours), et on revenait blindé. Boucle infinie
sans coût. **Pas intended** → verrouillage :

- Dès que Laura **entre** dans l'arène (trigger position, `PLAYER.onUpdate`),
  `addArenaGates` (`game.js`) pose 1–2 **murs invisibles pleine hauteur qui ne
  bloquent QUE le joueur** (même hook maison que les panneaux one-way) +
  pilier doré pulsant (le verrou se VOIT) + message `story.arenaClose`.
  Mur gauche toujours ; mur droit seulement si la poche entre l'arène et le
  bord jouable dépasse 3 tuiles (niveau3/4/jury).
- Trigger **position, pas `b._awoken`** : un lob qui réveille le boss de loin
  ne doit pas enfermer Laura dehors.
- Levés à la **victoire** (`hitBoss`, qui purge aussi bombes en vol / tampons
  temporaires / ondes / tirs — on ne meurt plus après « BOSS BATTU ! ») et au
  respawn d'arène. L'étoile `*` est DERRIÈRE le mur droit en niveau3/4/jury :
  le teardown est obligatoire.
- Ceinture côté `bosses.js` : helper `inArena` — **toutes** les attaques
  ciblées sur `p.pos` (bombes de michael/jury/tracteur p2, tampons de
  cendrine/jury) ne partent que si le joueur est dans l'arène +6 tuiles.
- Les caches de pickups pré-arène restent DEHORS : on fait le plein AVANT
  d'entrer, puis le combat est sans retour.

---

## 5. Time attack & farme — la difficulté opt-in

Le chrono in-game + meilleur temps par niveau existent (v1). On les transforme
en objectifs sans nouveau mode (décision v1 maintenue : pas de menu dédié) :

### 5.1 Trois médailles par niveau (bronze / argent / or)

| Médaille | Or | Argent | Bronze | Source |
|---|---|---|---|---|
| ⏱️ **TEMPS** | ≤ par or | ≤ par argent | ≤ par bronze | `LEVELS[x].par = { or, argent, bronze }` (s) — à caler sur une run dev ×1.25 / ×1.75 / ×2.5 (`#gameauto` + chrono) |
| 📊 **DATA** | 100 % | ≥ 80 % | ≥ 60 % | compteur existant |
| 🕊️ **SAUVÉS** | 100 % | ≥ 60 % | ≥ 30 % | `sauvés / passants spawnés` (le chat sauve, v1) ; un passant tué n'est plus sauvable → le pacifisme paie. Nécessite de **persister** `passantTotal`/`savedBest` (review #25) — sinon livrer TEMPS+DATA d'abord (review #22). |

- **Récap fin de niveau** (l'écran chapter affiche déjà score/temps) : les 3
  médailles gagnées, seuils ratés en gris (« or à 1:32 — toi : 1:47 »).
- **Carte du monde** : 3 pastilles sous chaque nœud (le meilleur temps y est
  déjà affiché, `game.js:2828`).
- **Méta-récompense** : tout or sur les 5 niveaux + jury battu =
  « **MENTION TRÈS HONORABLE** » sur l'écran win + petit trophée sur l'écran
  titre du slot. Médaille cachée « FÉLICITATIONS DU JURY » : finir un niveau
  **sans perdre ni cœur ni équipement** (le bouclier peut absorber : ça reste
  humain).

### 5.2 Pourquoi ça suffit

- Le casual les ignore totalement (aucun mur de progression derrière).
- Le hardcore a 16–18 médailles + publis (gated équipement, en place) + data
  100 % + pacifisme — la « farme d'options cachées » demandée.
- Vélo/rollers conservés plus longtemps (§2.1) = les routes de speedrun
  deviennent réellement tenables ; perdre l'équipement (3e coup) casse la run
  temps → tension juste.

---

## 6. Tuning — avant → après (une ligne par changement)

| Paramètre | Avant | Après | Pourquoi |
|---|---|---|---|
| Ordre dégâts (`damagePlayer`) | équipement → soleil → cœurs | **soleil → équipement → cœurs** | profiter du vélo/rollers |
| Absorption bouclier | dès `sun > 0` (coup entier) | **seulement si `sun ≥ 40`** (cran HUD) | fini l'absorb infini à 1 pt de soleil |
| `sun.hitRegenDelay` | — | **2.5 s → 0 (v2.1) → 2 s sur TOUTE blessure (v2.2)** | anti spam défensif du bouclier ; durée réglable dans config.js |
| `sun.regen` | 22/s | **18/s** | recharge généreuse mais plus gratuite |
| `player.maxHp` | 5 | **5 (inchangé)** | review : ne pas durcir la survie deux fois ; knob de playtest |
| `pickups.cafe.heal` | 2 | **1** | soin, pas full-heal |
| Checkpoint boss | — | **respawn in-scene porte d'arène, boss reset, chrono continue** | permet de durcir les boss sans punir |
| Panneaux `-`/`x` | solides 4 côtés | **one-way JOUEUR (`platformEffector({})` ou filtre custom) + tag `panel` + BAS+SAUT** | étages praticables |
| Crumble `x` | `pos.y` seul | **`pl.curPlatform() === t`** | pas d'amorce en traversant/longeant |
| Tick dégât boss | aucun (90 DPS possible) | **graines 1/0.25 s [1,2,3] ; AoE 1/0.5 s plein** | plafonne le DPS par canal |
| `b.guard` | — | **0.5→0.35 selon boss hors fenêtre, 1 en fenêtre/`vulnT`** | fenêtres = le jeu ; boss 1 reste tendre |
| `cat.bossDamage` | 2 | **6 PAR PASSAGE (v2.1 : frappe à l'aller ET au retour, insensible à la garde → ~12/chat) + fenêtre 1.5 s (re-arm 8 s)** | ouvre-boîte tactique, pas un stun-lock |
| HP boss | 18/24/30/38/46/64 | **70/120/170/210/280/450** | durées cibles 25 s → 2 min 30 |
| Phase 2 (≤50 % HP) | — | **par boss, cf. §4.3** | le 1v1 évolue en cours de combat |
| Jury | 3 phases solo | **3 phases + 2 interludes boss-rush** (coût singletons assumé) | l'envie du Todo |
| `api.shake` télégraphes | screen shake | **FX localisés + onde au sol (proprio)** | Todo « virer les tremblements » |
| Arènes | sous-exploitées | **audit + panneaux one-way utiles (h3–h5)** | lob, esquive verticale, ombre tactique |
| Médailles | — | **TEMPS / DATA / SAUVÉS par niveau + mention** | difficulté opt-in |
| `CONFIG.cheats` | true | **false au build cadeau** (rappel review #28) | déjà dans CLAUDE.md, à ne pas oublier |

---

## 7. Scénarios de validation

- *Casual, niveau 1* : elle tanke 2 coups au soleil, voit la jauge griser,
  perd parfois un cœur, atteint le boss, meurt une fois, **reprend à l'arène**,
  apprend le stall doré, gagne en ~2 essais. ✅
- *Plateformes* : monter un escalier de panneaux **sans se cogner**, traverser
  un deck par en-dessous, redescendre en BAS+SAUT au milieu d'une pluie de
  bombes. Dérouler la matrice §3.4. ✅
- *Vélo* : ramassé, prend un coup (soleil absorbe, vélo conservé), un 2e coup
  rapproché (bouclier brisé → vélo perdu au 3e) — « j'ai eu le temps d'en
  profiter ». ✅
- *Boss P3/R3 farm complet* : agriculteur en ~10–12 s en jouant les fenêtres
  (récompense), plus jamais < 2 s. ✅
- *Boss casual P1* : ~25–30 s, lisible : « tink » → stall → « OUVERT ! » →
  dégâts. Le chat ouvre une fenêtre quand ça traîne. ✅
- *Jury* : 3 phases visibles + 2 invités + mur à trou dashé = un final de
  2 min 30 dont on se souvient. ✅
- *Time attack* : run vélo conservé de bout en bout → or TEMPS ; un gnon de
  trop → vélo perdu → argent. Tension exacte voulue. ✅
- *Bombes/abri* : bombe bloquée par un panneau intact, plus bloquée après
  crumble du `x` (grille à jour). ✅

---

## 8. Chantiers d'implémentation

### Palier A — structurel (à playtester seul d'abord, reco review #19)

1. **Proto one-way** : page de probe, `platformEffector({})` vs filtre custom,
   matrice §3.4 réduite (joueur seul). *Décision d'API ici.*
2. **`js/game.js`** — `damagePlayer` (l.590) : ordre + seuil 40 +
   `sunRegenLockT` ; regen (l.2432) : `charging && lock<=0` (rayons `o`
   exemptés, l.1437) ; HUD jauge grisée + cran à 40 ;
   `addPanel` (l.733) : one-way joueur + tag `panel` + drop BAS+SAUT (handler
   de saut, `curPlatform()`, ne consomme pas de saut) ; crumble `curPlatform` ;
   `hitBoss` (l.1333) : ticks par canal (`bossDmg` posé par
   `fireBase`/`lobShoot`) + FX tink.
3. **`js/config.js`** — `sun{regen:18, hitRegenDelay:2.5}`, `cafe.heal:1`,
   `arsenal.graines.bossTick:[1,2,3]`, `bossHit:{seedCd:.25, aoeCd:.5}`,
   HP boss table §4.5.
4. **Checkpoint boss** (respawn in-scene, §2.4).
5. → **Playtest** : durées de boss réelles, ressenti bouclier, plateformes.

### Palier B — design (après mesure)

6. **`js/bosses.js`** — `b.guard` gradué + `=1` dans stall/stagger/load/
   recalc/window ; `vulnT`/`catVulnLock` (chat l.1378) ; phases 2 (§4.3) ;
   mur-à-trou factorisé (jury → RStudio p2) ; séismes localisés (purge des
   `safeShake` de télégraphe, onde au sol) ; jury boss-rush (défaire les
   singletons listés §4.4 : `BOSS_SHOT_SPRITE`, HUD, `hitBoss` guest).
7. **Médailles** — `js/save.js` (`medals[]`, `passantTotal`, `savedBest`,
   migration des slots existants) ; récap chapter (l.2028) ; pastilles carte
   (l.2828) ; `par` dans `js/level.js` + `check_levels.py`.
8. **Passe niveaux/arènes** — audit §4.6, routes hautes §3.3,
   `gen_levels_data.py` + `check_levels.py` (warn arène < h3, check decks
   joignables, pars présents).
9. **FX/art/audio** (review #27) : jauge grisée + cran, liseré bouclier, tink,
   « OUVERT ! », pose phase 2, onde au sol, pastilles médailles — la plupart
   en dessin code (rect/cercle/floaty), pas de pipeline Codex requis sauf
   icônes médailles (`_icongen/`).
10. **Release** : `CONFIG.cheats: false` au build cadeau.

Validation continue : screenshots headless (`#game`, `#gamejury`), CDP pour
forcer les phases (`LQ.level`), `#gameauto` pour calibrer les pars.

---

## 9. Décisions à trancher (reco en premier)

1. **Jury** — *(reco)* boss-rush §4.4 (coût singletons ~1 j assumé) **vs**
   une vague de minions + mur à trou durci (review #21, 10× moins de code,
   moins mémorable). >>> BOSS-RUSH
2. **Cœurs** — *(reco)* rester à 5 et ne durcir qu'au playtest **vs** 4 tout
   de suite (plus tendu, risque cadeau). >>> 4 tout de suite
3. **Médaille SAUVÉS** — *(reco)* livrée avec TEMPS/DATA si la persistance
   est triviale, sinon reportée (review #22). Au jury : pas de médaille
   sauvés (que des invoqués) — temps seulement. >> prends la solution la meilleur pour le joueur
4. **Drop-through mobile** — *(reco)* ▼+SAUT (boutons existants) **vs**
   double-tap ▼ (un doigt, geste à apprendre). >> double tap
5. **One-way pour les ennemis** (phase 2 éventuelle) — *(reco)* non, sauf si
   le playtest révèle des mobs coincés sous les decks. >> ok

---

## 10. Review Codex — bilan (2026-06-10)

Review menée par `codex exec` (lecture seule du dépôt, 28 points). Détail :

**Intégré (a modifié la proposition)** :
- #1 seuil d'absorption `sun ≥ 40` (l'absorb à 1 pt de soleil était un trou) ;
- #2 maths DPS corrigées (`0.4 + 0.6×guard`) → table §4.5 et HP revus à la
  baisse (70…450 au lieu de 100…600) ;
- #3/#24 canaux de dégâts boss séparés (graines tick 0.25 / AoE 0.5 / chat) ;
- #4 budget soleil en boss explicité, rayons `o` exemptés du lock ;
- #5 chat : 8 → 6 dégâts + re-arm de la fenêtre 8 s ;
- #6/#18 `maxHp` reste 5 (on ne durcit pas la survie deux fois) ;
- #7/#8 `platformEffector({})` (l'appel nu crashe) + étape proto + fallback
  custom décrit ;
- #9/#20 one-way **joueur seulement** en phase 1 ;
- #10/#11/#12 drop-through spécifié (handler de saut, tag `panel`,
  `curPlatform`) ;
- #13 test bombe/abri ajouté ; #14 checkpoint respecifié **in-scene** (pas de
  rebuild, pas de re-farm de pickups) ;
- #15 coût réel du jury boss-rush assumé et budgété (singletons listés) ;
- #16 « ajouter des panneaux » → **audit arène par arène** ;
- #17 garde graduée 0.5→0.35 (boss 1 tendre) ;
- #19 découpage en **paliers A/B** avec playtest entre les deux ;
- #22/#25 médaille SAUVÉS conditionnée à la persistance (`passantTotal`,
  `savedBest`, migration save) ;
- #23 cibles chiffrées (durées, morts acceptées, arsenal attendu) dans §4.5 ;
- #26 matrice de tests one-way (§3.4) ; #27 liste FX/art (§8.9) ;
- #28 rappel `cheats:false` (§6).

**Écarté (en connaissance de cause)** :
- #21 (remplacer le boss-rush par une vague de minions) : gardé en option §9.1,
  mais le boss-rush est une demande explicite du Todo (« les boss 1 par 1 »)
  et le différenciateur mémorable du final — on paie le coût.
- La suggestion implicite de réduire la portée des médailles à TEMPS+DATA
  d'office : SAUVÉS reste dans la cible si la persistance tient en ~20 lignes
  (c'est le cas a priori dans `save.js`), sinon on coupe.
