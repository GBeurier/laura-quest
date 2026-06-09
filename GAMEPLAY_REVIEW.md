# Revue de gameplay — Laura l'exploratrice

> Objectif de cette revue : un jeu **simple mais fun**. Diagnostic du gameplay
> actuel, puis **3 directions alternatives** pour améliorer l'UX et le fun
> *sans exploser le jeu* (on garde le moteur, les boss, le thème, le pipeline d'art).
>
> Hypothèse de design qui guide toute la revue : **le public, c'est Laura** (un
> cadeau, pas un·e hardcore gamer). On optimise donc pour le *plaisir immédiat*,
> le *plancher de compétence bas* et la *fantaisie de puissance* — pas pour le
> plafond de skill. Si l'audience visée est différente, dis-le, ça change la reco.

---

## TL;DR (le diagnostic en 4 lignes)

1. **Trop de verbes.** ~10 actions distinctes pour un jeu qui se veut simple.
2. **L'énergie fait 3 métiers à la fois** (munitions + photosynthèse + jauge de
   moralité) → elle est *surchargée* et pourtant *peu impactante*.
3. **4 armes, mais une seule stratégie** : on spamme la graine et on lobe un
   gâteau sur le boss. Les 2 autres armes sont quasi-redondantes.
4. **Aucun powerup** : on ne se sent jamais devenir *plus fort*. Le seul
   « équipement » (rollers/vélo) **retire** au contraire tous tes pouvoirs.

---

# Partie 1 — Le gameplay actuel

## 1.1 Les verbes du joueur (ce que les doigts doivent gérer)

| Action | Touche | Détail |
|---|---|---|
| Bouger | ←/→ (Q/D) | course, vitesse 250 |
| Sauter | Haut/Z/W | **double saut** (maxJumps 2) |
| Saut modulable | **Bas maintenu en montée** | coupe la hauteur (jumpCutG) |
| S'accroupir | **Bas (au sol)** | hitbox réduite |
| Tirer | Espace | rafale (droit) **ou** charge+relâche (cloche) |
| Viser la cloche | **Haut/Bas pendant la charge** | incline l'angle |
| Changer d'arme | Maj | cycle aveugle sur 4 armes |
| Pleurer (sort) | X | AoE recul + efface les tirs, cd 6 s |
| Râler (sort) | V | bouclier 3 s + stun, cd 9 s |
| Chat (allié) | C **maintenu 2 s, immobile** | balaye la ligne, 3 charges |

**Le problème saute aux yeux : la touche Bas fait 3 choses** (accroupi /
jump-cut / viser-vers-le-bas) selon le contexte, et on a **3 boutons défensifs**
(X, V, C) qui résolvent tous le même problème « je suis débordée ». C'est
beaucoup de charge mentale et de doigts pour un run-and-gun « simple ».

## 1.2 L'énergie (jauge « Soleil ») — le cœur du problème d'équilibrage

La jauge fait **trois jobs en même temps**, ce qui la rend illisible :

- **Munitions** : chaque tir coûte de l'énergie (`ammoTypes[].cost`).
- **Photosynthèse** : se recharge seule **au soleil** (`regen: 8/s`) mais **pas à
  l'ombre** d'un panneau (`regenShade: 0`). « Laura *est* un panneau solaire ».
- **Moralité** : tuer un passant inoffensif **fait fondre le plafond** de la
  jauge (`killPenalty: 8`, plancher `minMax: 20`). Compteur tête-de-mort + zone
  rouge « condamnée » dans le HUD.

**Le calcul montre pourquoi ça n'est pas satisfaisant :**

| Arme | Coût | Cadence | Drain réel | Verdict |
|---|---|---|---|---|
| Graine | 2 | 0,26 s | **~7,7/s** | regen = 8/s → **quasi-infinie en plein soleil**. Le coût « 2 » est presque cosmétique. |
| Pied de riz | 14 | 0,26 s | **~54/s** | vide la jauge en **~2 s**, puis ~12 s pour recharger. Une rafale brève, rarement rentable vs la graine. |
| Cookie | 10 | charge | la *charge* limite, pas l'énergie | dégâts 2, cloche — surtout utile en hauteur. |
| Gâteau | 20 | charge | 5 tirs max pleine jauge | la vraie grosse frappe (dégâts 3 + AoE). Le tue-boss. |

**Conséquence** : la jauge reste **près du plein 90 % du temps** (on spamme la
graine), puis on la **vide d'un coup** sur une arme lourde. C'est *binaire*, pas
une économie de ressource intéressante. Et la règle « pas de regen à l'ombre »
est **invisible** : le joueur ne « lit » pas pourquoi sa jauge cesse de monter.

Le malus de meurtre, lui, est **mal couplé** : les passants (`N`) sont
**intercalés sur la MÊME ligne** que les vrais ennemis → on en fauche par
accident, et la punition (perte de puissance de feu) frappe une jauge qu'on ne
reliait pas mentalement à « j'ai tiré sur un collègue ».

## 1.3 Les armes — 4 noms, 1 stratégie

- **graine** (droit, dégâts 1, ~gratuit) → le spam par défaut.
- **pied_riz** (droit, dégâts 2, cher) → *même trajectoire que la graine*, juste
  plus cher/fort. **Choix sans intérêt** (pas de différence d'usage, juste des chiffres).
- **cookie** (cloche, dégâts 2, charge+vise) → redondant avec le gâteau.
- **gâteau** (cloche, dégâts 3, **AoE**, charge+vise) → la seule arme « spéciale »
  réellement distincte.

Deux familles, mais à l'intérieur de chaque famille **le 2ᵉ n'est qu'une version
chère du 1ᵉʳ**. Et les armes en cloche imposent un **mini-jeu de charge+visée à
l'arrêt**, à contre-courant d'un run-and-gun où les ennemis arrivent à
l'horizontale. Le **changement d'arme est un cycle aveugle** (Maj) : on ne sait
pas ce qui vient sans regarder le HUD. Bilan : **arsenal réel = graine + gâteau**.

## 1.4 Les powerups — il n'y en a pas

C'est exact, et c'est le plus gros manque côté *fun* :

- **Aucun powerup persistant.** Rien qui fasse « youpi, je suis plus forte ! ».
- Les **équipements** (rollers `L`, vélo `Y`) sont des jouets de **traversée
  uniquement** : ils **désactivent tir + sorts + chat** (« on ne peut QUE se
  déplacer ») et sont perdus au moindre coup. Ils servent à atteindre la publi
  cachée, pas à se sentir puissante.
- Tous les autres pickups sont des **recharges** (soleil, café=soin, croquette=chat)
  ou du **score** (data, page, publi). Aucun ne change *ce que tu peux faire*.

La boucle classique du genre — *ramasser une arme → monter en puissance → la
perdre en se faisant toucher → la reconquérir* — **n'existe pas**.

## 1.5 Les niveaux — un mur d'ennemis sur une ligne

Chaque niveau est **une seule longue ligne de sol** avec les ennemis **alignés
au ras du sol**. Exemple, niveau 1 (le « plus facile, allégé ») :

```
@  N   ^N   TVN R  N  TJVN    N  TNRV    NJT dN V   NRT  NpVJ N T   N  VRN T  JN  V    B   *
```

→ **~30 entités sur une seule rangée** le long du niveau. Avec le **knockback au
contact** (recul 300 pendant 0,22 s), se faire toucher te repousse *dans* le
suivant. Ça se ressent comme **spammy** plutôt que comme des rencontres
construites. Le **platforming est entièrement optionnel** (juste l'escalier vers
la publi). Bref : peu de design spatial, beaucoup de « pousse-toi dans le tas ».

## 1.6 Ce qui est déjà très bon (à NE PAS casser)

- **Les boss.** Les IA sont la meilleure partie du jeu : *télégraphe → esquive →
  fenêtre de punition*, une identité par boss (`bosses.js`). À préserver tel quel.
- **Le thème** est cohérent et personnel (agrivoltaïsme, parcours de thèse, chaque
  boss = un vrai obstacle de doctorat). C'est l'âme du cadeau.
- **L'architecture config-driven** : on peut presque tout rééquilibrer dans
  `js/config.js` sans toucher au moteur.
- **La métaphore « Laura = panneau solaire »** (regen au soleil) est maligne —
  juste **sous-exploitée**.
- **Le double saut + jump-cut** donnent un *feel* de saut correct.
- **L'angle « zéro meurtre »** est mignon et raccord avec le perso (une
  scientifique ne mitraille pas ses collègues).

## 1.7 Synthèse — Pros / Cons

| ✅ Forces | ❌ Faiblesses |
|---|---|
| Boss excellents (télégraphe/punition) | Surcharge de verbes (~10 actions, touche Bas triple) |
| Thème riche et personnel | Énergie = 3 jauges en 1, peu lisible, peu impactante |
| Config-driven (rééquilibrage facile) | 4 armes → 1 seule stratégie réelle |
| Métaphore panneau solaire | **Zéro powerup** / power fantasy |
| Double saut + jump-cut corrects | 3 boutons « panique » redondants (X/V/C) |
| Charme « no-kill » | Flux cassé (chat 2 s immobile, charge à l'arrêt, cycle aveugle) |
| | Niveaux = mur d'ennemis sur 1 ligne, knockback en chaîne |

---

# Partie 2 — Trois propositions

Trois **axes distincts**. Toutes gardent : moteur KAPLAY, boss, thème, pipeline
d'art, structure `index.html` + globals. Aucune ne « réécrit » le jeu.

> **Communs aux 3 (no-regret, à faire quoi qu'il arrive) :**
> - Découpler **moralité ↔ énergie** (le malus meurtre ne touche plus la jauge de tir).
> - **Espacer les passants** des vrais ennemis (lignes/zones dédiées) pour ne plus en faucher par accident.
> - **Chat instantané** (lancer sur cooldown) au lieu de « maintenir 2 s immobile ».
> - **Un seul** bouton défensif au lieu de trois.

---

## Proposition A — « Less is More » (épurer l'existant)

**Philosophie :** on ne *change* pas le jeu, on le **soustrait**. Le risque le
plus faible, l'effort le plus court. Idéal si tu veux juste que ça respire.

**Ce qui change**
- **Armes 4 → 2** : *Graine* (tir droit, fiable, gratuit) + *Gâteau* (frappe AoE).
  On supprime `pied_riz` (redondant) et `cookie` (cloche redondante). Plus de
  cycle d'arme : **Maj = basculer entre les 2** (ou la lourde sur un bouton dédié).
- **Énergie = jauge de « super »**, plus de comptage par balle. Le tir de base
  est **toujours gratuit** ; l'énergie alimente **uniquement** le gâteau (et/ou
  l'allié). Le soleil/ombre devient un **risque lisible** (« je reste au soleil
  pour recharger ma grosse frappe ») au lieu d'une taxe invisible sur chaque balle.
- **Visée auto** sur la cloche (le helper `autoAimArc` existe déjà pour le mobile)
  → plus de charge-à-l'arrêt : un appui = un lob vers l'ennemi le plus proche.
- **Capacités 3 → 1** : on garde **le Chat** (charmant, on-brand) comme unique
  outil « panique/nettoyage », instantané sur cooldown. On retire `pleurer` et
  `raler` (ou on les garde en option avancée hors version cadeau).
- **Moralité** : pur score/collection, **sans** punir la jauge de tir.

**Inputs après :** Bouger · Sauter · Tirer · Super (énergie) · Chat. **~5 verbes.**

**Ce qu'on touche :** surtout `js/config.js` (`ammoTypes`, `ammoOrder`, `sun`,
`spells`, `cat.chargeTime`) + des *retraits* ciblés dans `game.js`. **On ne crée
presque rien.**

**Effort : 🟢 faible · Risque : 🟢 faible.**
**Pourquoi c'est plus fun :** moins de bruit = chaque action compte. La jauge
soleil devient une *vraie* décision (recharger ma super vs avancer). Le jeu
reste exactement le jeu, en plus net.

---

## Proposition B — « Powerup Run-and-Gun » (la boucle Contra / Metal Slug) ⭐

**Philosophie :** attaquer le manque n°1 (*pas de powerup*) de front. On
construit la **fantaisie de puissance** par des **armes ramassées** + une
**montée en niveau** qu'on peut perdre. C'est la proposition la plus *fun* pour
un public casual, et elle réutilise des briques déjà présentes.

**Ce qui change**
- **Un seul bouton de tir.** Ton arme = **le dernier powerup ramassé** dans le
  niveau (icônes flottantes) : *Éventail* (graines en spread), *Perçant* (riz qui
  traverse), *Bombe* (gâteau AoE). Plus de Maj : **tu ES ce que tu as ramassé**
  (le feeling « S / L / M » de Contra).
- **Niveau de charge (tier 1→2→3)** : ramasser des soleils/data **monte ton tir**
  (plus de projectiles / dégâts). **Se faire toucher fait redescendre d'un tier**
  *au lieu de perdre une vie tout de suite* — exactement la mécanique de perte
  d'équipement actuelle (`loseEquip`), recyclée sur **ton arme**. → la boucle
  *montée / risque / reconquête* qui fait le sel du genre.
- **Énergie = nourriture du tier**, plus de munitions par balle : soleil → tu
  montes ; ombre → tu ne montes pas (la métaphore panneau **enfin** au service du
  fun). Et **tuer un collègue grille ton tier** : le malus moral frappe désormais
  *ce à quoi tu tiens* (ta puissance), pas une jauge séparée.
- **Une signature** conservée : le Chat, instantané, en bouton panique.

**Inputs après :** Bouger · Sauter · Tirer · Chat. **~4 verbes.** L'identité
d'arme vient **du monde**, pas d'une touche.

**Ce qu'on touche :** `pickups` + tiles de niveau pour poser les armes ;
réutilise `equipment`/`loseEquip` pour la perte de tier ; une variable `tier` sur
le joueur ; `playerShoot` lit (arme, tier) au lieu de `ammoKey`. **Moyen, mais
les systèmes existent déjà** (pickups, perte d'équipement, familles d'armes).

**Effort : 🟡 moyen · Risque : 🟡 moyen.**
**Pourquoi c'est plus fun :** une *courbe de puissance* lisible et jouissive,
zéro gestion de menu, des décisions spatiales (« je vais chercher la Bombe »),
et un enjeu clair à ne pas se faire toucher. Power fantasy + simplicité.

---

## Proposition C — « Momentum » (le flux d'abord : dash + parcours)

**Philosophie :** régler le « pas fluide » en faisant du **mouvement** le plaisir
central, et en allégeant le combat. On passe d'un « mur d'éponges à PV » à un
**parcours de flow**.

**Ce qui change**
- **Un DASH** (le seul verbe ajouté) : une ruée horizontale courte avec
  **i-frames**, sur cooldown court (ou coût d'énergie). **Dasher à travers/au-dessus**
  des ennemis = LE correctif de fluidité. Le moteur a déjà tout (knockback +
  invuln → on les recycle en dash i-frames ; le code de jump-cut prouve qu'on
  sait bidouiller la vélocité).
- **Énergie = stamina d'action** (dash + super tir) rechargée au soleil (thème
  préservé). La jauge gouverne **tes mouvements expressifs**, plus le comptage de balles.
- **Armes** : 1 tir par défaut + 1 chargé **qu'on peut charger en bougeant** (fini
  l'arrêt). On supprime le roster de 4.
- **Défense** : le **dash-esquive** (i-frames) remplace pleurer/râler ; on garde
  le chat en invocation cooldown.
- **Niveaux** : on retravaille le « mur sur 1 ligne » en **courtes séquences de
  flow** — ennemis-obstacles à esquiver, quelques vraies séquences de plateforme,
  et les panneaux utilisés comme **vraie ombre/couvert** (rester à l'ombre évite
  un danger du ciel mais coupe la regen → un choix). **Boss inchangés.**

**Inputs après :** Bouger · Sauter · **Dash** · Tirer · Chat. Mouvement-roi.

**Ce qu'on touche :** ajout du dash dans `game.js` (réutilise invuln/knockback) ;
`sun` repensé en stamina ; **réécriture des maps** dans `js/level.js` (le gros du
boulot). Boss et art intacts.

**Effort : 🔴 élevé (refonte des niveaux) · Risque : 🟡 moyen.**
**Pourquoi c'est plus fun :** un *skill expressif* immédiat (le dash est
satisfaisant dès la 1ʳᵉ seconde), ça règle frontalement « pas fluide ». **Mais**
c'est l'axe le plus exigeant en exécution *et* le moins adapté à un public
non-gamer (plus de skill demandé). À réserver si tu veux un vrai *game feel*.

---

## Tableau comparatif

| Critère | A — Épurer | B — Powerups ⭐ | C — Momentum |
|---|---|---|---|
| Règle « trop d'armes » | ✅ (4→2) | ✅✅ (pickups, 0 menu) | ✅ (1+1) |
| Règle « énergie déséquilibrée » | ✅ (super) | ✅✅ (nourrit le tier) | ✅ (stamina) |
| Ajoute des powerups | ➖ | ✅✅✅ | ➖ |
| Règle « pas fluide » | 🙂 (moins de friction) | 🙂 | ✅✅✅ (dash) |
| Verbes restants | ~5 | **~4** | ~5 (+dash) |
| Effort | 🟢 faible | 🟡 moyen | 🔴 élevé |
| Risque de casser le jeu | 🟢 | 🟡 | 🟡 |
| Adapté public casual (Laura) | ✅ | ✅✅ | ⚠️ (skill) |

## Recommandation

Pour **« simple mais fun »** et un public-cadeau : **B en cible, posée sur le
socle A.**

1. **D'abord A** (les *no-regret* + couper l'arsenal et fusionner les boutons) :
   peu d'effort, le jeu respire tout de suite.
2. **Puis la boucle de B** (armes-pickups + tiers montants/perdables) : c'est ce
   qui apporte le *fun* et la *power fantasy* qui manquent, avec seulement ~4
   verbes et zéro menu.
3. **Garder C en réserve** : le **dash** est le seul élément de C que je
   piquerais quand même un jour (énorme rapport fun/effort), mais la refonte des
   niveaux n'est pas nécessaire pour atteindre « simple et fun ».

Dans tous les cas : **on ne touche pas aux boss** (déjà excellents) ni au thème.
