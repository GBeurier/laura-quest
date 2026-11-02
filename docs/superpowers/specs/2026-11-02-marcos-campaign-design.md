# Campagne Marcos — « La thèse de Marcos » (design)

Date : 2026-11-02. Carte blanche donnée par Greg. Source : `~/Downloads/_Marcos/`
(`concepts.txt` du collègue, photos `Level_inspiration/`, portraits Ade / Afif + citations).

## Intention

Marcos est, comme Laura, un thésard qui galère pour avoir sa thèse — mais son terrain est
une **parcelle agrivoltaïque expérimentale en Indonésie** (Java) : rizières boueuses,
structures d'ombrage en **bambou + filets d'ombrage noirs/verts**, volcans au loin,
nouvelles constructions, scooters, durians, rats, oiseaux. 3 niveaux, 3 boss, puis
**il obtient son PhD** (écran de victoire). Même ton, même style pixel-art 16-bit que Laura.

Anti-objectifs : casser la campagne de Laura (tout changement moteur est gated par le kit
du personnage) ; un Marcos « Laura avec un autre skin » (il doit se jouer différemment).

## Kit de Marcos (gated par `CHARACTER.kit`, Laura inchangée)

| Touche | Laura | Marcos |
|---|---|---|
| ESPACE | graines | **Notes de guitare** : notes de musique qui ondulent (sinus). Arsenal identique (P1 1 note, P2 accord de 3, P3 5 notes « fire » perçantes). |
| X (maintenir/relâcher) | lob pâtisserie (cloche AoE) | **POWER CHORD** : onde de choc circulaire centrée sur Marcos (rayon selon PUISSANCE × charge), dégâts AoE, **efface les tirs ennemis**, repousse. Coûte du soleil. Pas de friendly fire. |
| C | chat (aller-retour) | **L'armée des étudiants** (Ade : *« The army of students is ready to help you! »*) : 3 étudiants PNJ (Ade en tête + 2 têtes du pool) chargent en avant puis reviennent, mêmes règles que le chat (ouvre la garde des boss, nettoie les tirs, sauve les PNJ → médaille SAUVES conservée). |
| pickup `g` | — | **Durian** (Afif : *« Marcos, il faut goûter les Durian ! »*) : 7 s d'aura puante — dégâts périodiques aux ennemis proches + dissout les tirs ennemis. |

## Nouveaux éléments de niveau

| Char | Élément | Comportement |
|---|---|---|
| `~` | **Boue** | sol collant non-solide (comme `%`, sans dégât) : vitesse ×0.4, saut ×0.6 tant qu'on y a les pieds. Le dash s'en extrait. Contigus fusionnés. |
| `r` | **Rat** | sol, court très vite vers Marcos (`chase`), petit. Immunisé à la boue. |
| `u` | **Durian** | piquant immobile. **Posé en l'air** (sous une ligne de panneau/arbre) → il pend et **tombe** quand Marcos passe dessous. |
| `y` | **Oiseau** | vole en patrouille puis **plonge en piqué** sur Marcos quand il passe dessous, remonte. |
| `Z` | **Scooter** | véhicule va-et-vient rapide (ignore les panneaux). |
| `g` | Durian (pickup) | aura puante (cf. kit). |

Panneaux `-`/`x` : skin **structure bambou + filet d'ombrage** (`tile_bamboo` + `bamboo_leg`).

## Les 3 niveaux

1. **`marcos_rizieres` — « Le chantier des rizières »** (installation de la manip dans la boue,
   photos 11-18). Tuto Marcos : boue, rats, oiseaux, structures en construction. Boss
   **RAJA TIKUS, le roi des rats** (IA `tikus`) : course + coup de queue ; **s'enfouit** dans
   la boue (bosse qui se déplace sous terre), **jaillit** sous Marcos (marqueur 0.7 s) en
   crachant des mottes de boue → **sonné** (fenêtre de punition) ; invoque des rats.
   P2 : double plongée, les jaillissements laissent des flaques de boue temporaires.
2. **`marcos_village` — « Le village et la route »** (nouvelles constructions, scooters,
   marché aux durians). Boss **PAK DURIAN, le vendeur à scooter** (IA `scooter`) : klaxon
   (télégraphe) → **charge** à travers l'arène en semant des durians-mines ; **lance** 3 durians
   en cloche qui éclatent en épines ; **panne** (fumée) = punition. P2 : aller-retour enchaîné +
   pluie de durians (bombes).
3. **`marcos_parcelle` — « La parcelle agrivoltaïque »** (structures finies, filets anti-oiseaux,
   oiseaux partout). Boss final **GARUDA, l'homme-oiseau** (IA `garuda`, cf. concept) :
   **lance des piafs** (minions volants), **jette des filets** qui immobilisent Marcos (marteler
   SAUT pour se libérer), **coup de bec** en piqué → bec planté dans le sol = punition.
   P2 : vole plus haut, filets doublés, éventail de plumes, piqués enchaînés.
   Après Garuda : écran de victoire **PhD de Marcos**.

Gating des publications : escaliers de panneaux (double saut) / plateforme en hauteur (zone-ciel).
PNJ : Ade (`head_npc_h_27`) appartient au niveau 1, Afif (`head_npc_h_28`) au niveau 2 ;
les anciens PNJ restent dans le pool. Les nouveaux PNJ sont **dédiés à Marcos** (absents chez Laura).

## Contraintes techniques

- Campagne `marcos_these` (remplace l'ancien proto `marcos_port` / niveau `marcos_bateau`, supprimés :
  Marcos est nouveau, pas de saves à préserver).
- Tout sprite absent = repli (le code doit tourner avant l'arrivée de l'art).
- Art = pipelines `_*gen/` + `image_gen` de Codex, généré **séquentiellement**.

## Assets à produire (noms exacts)

- Têtes : `head_npc_h_27` (Ade) + `_dead`, `head_npc_h_28` (Afif) + `_dead`.
- Ennemis (6 frames, walk 0-2 / hurt 3 / attack 4-5) : `enemy_rat`, `enemy_durian`, `enemy_oiseau`, `enemy_scooter`.
- Boss (move + atk, 6 frames) : `boss_tikus_*`, `boss_pakdurian_*`, `boss_garuda_*`.
- Projectiles / pickups : `ammo_note`, `ammo_note_fire`, `shot_mud`, `shot_durian`, `shot_spine`, `shot_net`, `shot_feather`, `pickup_durian`.
- Sol : `hazard_mud`. Panneaux : `tile_bamboo`, `bamboo_leg`.
- Fonds parallax : `bg_java_volcano`, `bg_java_paddy`, `bg_java_village`. Écrans : `bg_marcos_map`, `bg_marcos_chapter`, `bg_marcos_win`.
- Marcos : `marcos_guitar` (pose guitare, remplace la pose de lancer).
