/* =====================================================================
 *  LEVELS — Les niveaux, dessines en ASCII.
 *  Chaque caractere = une case de CONFIG.tileSize px. La camera ne
 *  defile QU'EN X : le jeu tient sur 11 rangees de haut (le haut de
 *  l'ecran = rangee 0). Les publis cachees sont en haut, au bout d'un
 *  escalier de panneaux '-' (double saut requis).
 *
 *  LEGENDE :
 *    ' ' vide
 *    '='  sol (terre de riziere)            -> solide
 *    '-'  plateforme (panneau solaire)      -> solide
 *    'x'  panneau solaire CASSABLE (explose apres un saut dessus -> 1 seul saut)
 *    '@'  depart de Laura
 *    'o'  rayon de soleil (recharge energie)
 *    'c'  cafe (soin)
 *    'd'  collectible THEMATIQUE du niveau (skin via theme.pickups.data :
 *         graines / plans de riz / courbes / histogrammes / feuilles)
 *    'p'  page de these (collectible)
 *    'P'  PUBLICATION cachee (1/niveau -> 100%)
 *    'k'  croquette (recharge le chat)
 *    'L'  rollers (equipement : + rapide, saute + haut ; perdu si touchee)
 *    'Y'  velo (equipement : + rapide, saute + haut ; perdu si touchee)
 *    '^'  caillou      (OBSTACLE solide : bloque monstres/camions, 0 degat ; Laura
 *                       saute par-dessus. Un caillou est AUSSI auto-pose a chaque bord.)
 *    'T'  camion/tracteur (VEHICULE : va-et-vient, gros degats)
 *    'A'  assureur/huissier (te poursuit)
 *    'R'  rapport ADEME (TIR : tire de la paperasse)
 *    'V'  corbeau      (VOLANT : vole en patrouille)
 *    'J'  criquet      (saute vers toi)
 *    --- nouveaux monstres (design definitif), poses sur la rangee d'entree ---
 *    'M'  moustique    (VOLANT, auto-eleve)        'E'  abeille (VOLANT, auto-eleve)
 *    'K'  cafard       (SOL : rampe vite vers toi)
 *    'W'  transpalette  'G' livreur d'eau  'C' coursier  (VEHICULES : va-et-vient)
 *    'I'  imprimante   'H' paquet de chips  'U' tuyau d'arrosage  (TIR : shooters)
 *    'S'  sac a dos    'F' recharge fontaine  'D' tas de dossiers  (IMMOBILES)
 *    'N'  passant      (figurant : corps "biome" + tete South Park tiree au
 *                       hasard ; fait les cent pas. Habits/tetes via theme.passant.)
 *    'B'  boss (defini par .boss)
 *    '*'  sortie = chapitre (apparait apres le boss)
 *
 *  Astuce : pose ennemis/objets sur la ligne JUSTE AU-DESSUS du sol.
 *
 *  DECOR PAR NIVEAU (optionnel) : ajoute une cle `theme:` a cote de `boss:`
 *  pour customiser fond (parallax), obstacles et monstres. Tout ce qui n'est
 *  pas precise reprend CONFIG.theme. Exemple complet :
 *    theme: {
 *      sky: [250, 190, 120],                 // couleur du ciel
 *      tint: [255, 206, 150],                // teinte de TOUTES les couches
 *      layers: [                             // PARALLAX du fond vers l'avant
 *        { sprite: 'bg_cloud', scatter: true, parallax: 0.25, count: 6, z: -22 },
 *        { sprite: 'bg_field', band: true,    parallax: 0.7, anchor: 'bot', y: 'ground', tileW: 320, z: -20 },
 *      ],
 *      tiles:   { '=': ['tile_soil', 'tile_soil2'] },   // OBSTACLES (liste = variantes)
 *      enemies: { criquet: ['enemy_criquet', 'enemy_criquet2'] }, // MONSTRES (liste = variantes)
 *    }
 *  Un sprite absent est ignore -> retour au defaut. cf. CLAUDE.md.
 * ===================================================================== */

// --- PASSANTS par biome (figurants 'N', cf. theme.passant / SPRITES.md) ------
//  Un biome = un jeu d'habits (corps body_<biome>_<h|f>) + le pool partage de
//  tetes de collegues head_npc_<h|f>_<n>. Le moteur tire UN sexe + UN corps + UNE
//  tete au hasard par 'N' au build du niveau. Un sprite absent est simplement
//  ignore -> pas de crash pendant une generation partielle.
const PASSANT_HEADS = {
  h: Array.from({ length: 25 }, (_, i) => 'head_npc_h_' + (i + 1)),
  f: Array.from({ length: 22 }, (_, i) => 'head_npc_f_' + (i + 1)),
};
const PASSANT = (biome) => ({
  femaleRatio: PASSANT_HEADS.f.length / (PASSANT_HEADS.f.length + PASSANT_HEADS.h.length),
  bodies: { h: ['body_' + biome + '_h'], f: ['body_' + biome + '_f'] },
  heads: PASSANT_HEADS,
});

// ARENE FINALE : le jury invoque des randoms de TOUS les biomes. Pool FUSIONNE
//  -> chaque passant tire un corps au hasard parmi tous les biomes + une tete dans
//  le meme pool partage de collegues.
const PASSANT_ALL = (biomes) => {
  const bodies = (sex) => biomes.map((b) => 'body_' + b + '_' + sex);
  return {
    femaleRatio: PASSANT_HEADS.f.length / (PASSANT_HEADS.f.length + PASSANT_HEADS.h.length),
    bodies: { h: bodies('h'), f: bodies('f') },
    heads: PASSANT_HEADS,
  };
};
const BIOMES_ALL = ['champ', 'pote', 'horti', 'labo', 'bureau'];

// Les GRILLES de niveaux vivent dans levels/*.txt -> embarquees par
//  gen_levels_data.py dans js/levels_data.js (window.LEVEL_MAPS), charge
//  AVANT ce fichier dans index.html. Ici on ne garde que boss/theme.
const LEVEL_MAPS = window.LEVEL_MAPS || {};

window.LEVELS = {

  // --- INTRODUCTION : L'agriculteur fou — RIZIERES DE CAMARGUE, plein jour ----
  //  Installation de la manip + recolte de donnees. Le niveau INTRODUCTIF : le
  //  plus LONG mais le plus FACILE. Long couloir tres aere ou les ennemis sont
  //  introduits UN A UN, bien espaces (densite ~6 monstres + 5 passants, vs une
  //  vingtaine ailleurs) : ~30 cases de tuto sans danger au depart, puis criquet
  //  'J', corbeau 'V', tracteur 'T', ademe 'R' presentes a tour de role avec de
  //  l'air entre chaque. Caillou '^' pour apprendre le saut, powerup eventail 'e'
  //  en recompense. Monstres : caillou '^', tracteur 'T', corbeau 'V', criquet
  //  'J', ademe 'R', random agri 'N'. Pickups 'd'=graines, 'p'=plants. Ciel bleu
  //  clair, tint verte de Camargue (parallax par defaut).
  niveau1: {
    boss: 'agriculteur',
    theme: {
      sky: [150, 212, 246],
      tint: [228, 246, 214],
      pickups: { data: 'pickup_graine', page: 'pickup_plant' },
      passant: PASSANT('champ'),   // habits des champs (Camargue)
    },
    map: LEVEL_MAPS.niveau1,
  },

  // --- CHAPITRE 1 : Francois le proprio — L'APPART / LA COLLOC (interieur) ---
  //  Installation de la colloc + bibliographie. Decor INTERIEUR : placeholder
  //  bg_appart (a remplacer par ton asset) + ETAGERES a bibelots a la place des
  //  panneaux ('-'/'x' = cap tile_shelf_biblo, pied shelf_leg). Monstres : sac a
  //  dos 'S', huissier 'A', moustique 'M', cafard 'K', paquet de chips 'H',
  //  random pote 'N'. Pickups 'd'=pilules, 'p'=pages.
  niveau2: {
    boss: 'proprietaire',
    theme: {
      sky: [196, 188, 206],
      tint: [222, 212, 224],
      layers: [
        { sprite: 'bg_appart', band: true, parallax: 0.40, anchor: 'bot', y: 'ground', z: -22 },
      ],
      tiles: { '=': ['tile_sol_appart'], '-': ['tile_shelf_biblo'], 'x': ['tile_shelf_biblo'] },
      panelLeg: 'shelf_leg',
      indoor: true,
      pickups: { data: 'pickup_pilule', page: 'pickup_page' },
      passant: PASSANT('pote'),
    },
    map: LEVEL_MAPS.niveau2,
  },

  // --- CHAPITRE 2 : RStudio — SERRE DE CULTURE (interieur verre) ------------
  //  Manip de precision + recolte de donnees. Decor INTERIEUR : ciel vert pale,
  //  bandeau bg_serre, PANNEAUX SOLAIRES conserves. Monstres : recharge fontaine
  //  'F' (IMMOBILE), transpalette 'W', moustique 'M', criquet 'J', tuyau
  //  d'arrosage 'U', random horti 'N'. Pickups 'd'=plants, 'p'=charts.
  niveau3: {
    boss: 'rstudio',
    theme: {
      sky: [196, 226, 200],
      tint: [206, 236, 200],
      layers: [
        { sprite: 'bg_serre', band: true, parallax: 0.40, anchor: 'bot', y: 'ground', z: -22 },
      ],
      tiles: { '=': ['tile_sol_serre'] },
      indoor: true,
      pickups: { data: 'pickup_plant', page: 'pickup_chart' },
      passant: PASSANT('horti'),   // serre -> tenue d'horticulteur
    },
    map: LEVEL_MAPS.niveau3,
  },

  // --- CHAPITRE 3 : Michael le directeur — LABORATOIRE (interieur) ----------
  //  Redaction des publis + analyse des resultats. Decor INTERIEUR froid,
  //  bandeau bg_labo + ETAGERES a livres a la place des panneaux ('-'/'x' = cap
  //  tile_shelf_books, pied shelf_leg). Monstres : recharge fontaine 'F',
  //  livreur d'eau 'G', abeille 'E', cafard 'K', imprimante 'I', random labo
  //  'N'. Pickups 'd'=data, 'p'=sheets.
  niveau4: {
    boss: 'michael',
    theme: {
      sky: [170, 184, 200],
      tint: [200, 212, 230],
      layers: [
        { sprite: 'bg_labo', band: true, parallax: 0.40, anchor: 'bot', y: 'ground', z: -22 },
      ],
      tiles: { '=': ['tile_sol_labo'], '-': ['tile_shelf_books'], 'x': ['tile_shelf_books'] },
      panelLeg: 'shelf_leg',
      indoor: true,
      pickups: { data: 'pickup_data', page: 'pickup_sheet' },
      passant: PASSANT('labo'),    // labo -> blouse blanche
    },
    map: LEVEL_MAPS.niveau4,
  },

  // --- CONCLUSION : Cendrine la responsable — UNIVERSITE (couloirs) ---------
  //  Redaction de la these + demarches administratives. Le niveau le PLUS DUR
  //  des 5 (densite max). Decor INTERIEUR beige institutionnel, bandeau
  //  bg_couloir + ETAGERES a livres a la place des panneaux. Monstres : tas de
  //  dossiers 'D', coursier 'C', moustique 'M', cafard 'K', imprimante 'I',
  //  random admin 'N'. Pickups 'd'=pages, 'p'=data.
  niveau5: {
    boss: 'cendrine',
    theme: {
      sky: [228, 220, 198],
      tint: [232, 226, 210],
      layers: [
        { sprite: 'bg_couloir', band: true, parallax: 0.40, anchor: 'bot', y: 'ground', z: -22 },
      ],
      tiles: { '=': ['tile_sol_couloir'], '-': ['tile_shelf_books'], 'x': ['tile_shelf_books'] },
      panelLeg: 'shelf_leg',
      indoor: true,
      pickups: { data: 'pickup_page', page: 'pickup_data' },
      passant: PASSANT('bureau'),  // couloirs/admin -> tenue de bureau
    },
    map: LEVEL_MAPS.niveau5,
  },

  // --- FINAL : Le jury de these (megaboss multi-phases) — ARENE, nuit ---------
  //  Soumission + soutenance. Le boss n'invoque QUE des randoms (passants de tous
  //  les biomes, cf. bosses.js jury). Pickups 'd'=pilules, 'p'=champignons.
  jury: {
    boss: 'jury',
    theme: { sky: [70, 86, 140], tint: [150, 162, 205], pickups: { data: 'pickup_pilule', page: 'pickup_champignon' }, passant: PASSANT_ALL(BIOMES_ALL) },   // nuit ; randoms de tous les biomes
    map: LEVEL_MAPS.jury,
  },
};
