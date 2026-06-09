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
 *    '^'  caillou      (statique, indestructible)
 *    'T'  camion       (va-et-vient, gros degats)
 *    'A'  assureur     (te poursuit)
 *    'R'  rapport ADEME (tire de la paperasse)
 *    'V'  corbeau      (vole en patrouille)
 *    'J'  criquet      (saute vers toi)
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
window.LEVELS = {

  // --- INTRODUCTION : Le proprietaire terrien — RIZIERES DE CAMARGUE, plein jour
  //  Le niveau le PLUS FACILE : densite d'ennemis allegee, beaucoup d'air.
  //  Collectible 'd' = GRAINES (pickup_graine). Ciel bleu clair lumineux,
  //  tint chaude/verte de Camargue (decor parallax par defaut).
  niveau1: {
    boss: 'proprietaire',
    theme: {
      sky: [150, 212, 246],
      tint: [228, 246, 214],
      pickups: { data: 'pickup_graine' },
    },
    map: [
      '                                                                                                ',
      '                              P                                                                 ',
      '                            xxxx                                                                ',
      '                  o     ----                                                                    ',
      '              ----                      o            d                    xxx                   ',
      '          ----              d                    ----              d                            ',
      '     d                            p         ----            p              c                    ',
      '                                               xx                                               ',
      '   @ L Y  ^       A             J               d       p              k         d        B    *',
      '================================================================================================',
      '================================================================================================',
    ],
  },

  // --- CHAPITRE 1 : L'agriculteur fou — RIZIERES EN PLEIN CHAMP -------------
  //  Collectible 'd' = PLANS DE RIZ (pickup_plant). Meme base parallax que
  //  niveau1, tint plus doree/verte pour varier (midi au champ).
  niveau2: {
    boss: 'agriculteur',
    theme: { sky: [128, 200, 232], tint: [240, 234, 178], pickups: { data: 'pickup_plant' } },
    map: [
      '                                                                                                            ',
      '                                          P                                                                 ',
      '                                        xxxx                                                                ',
      '                          o         ----            o                                                       ',
      '                      ----      ----          d           ----        d                 xxx                 ',
      '        o         ----                 p              ----                    d         c                   ',
      '     d        ----        d      V            J            p      V                k                        ',
      '                                                     xx                                                     ',
      '   @     ^     A    T        J      A      d     V      p    T      A      d     J      p    A        B    *',
      '============================================================================================================',
      '============================================================================================================',
    ],
  },

  // --- CHAPITRE 2 : Michael Dingkhun — SERRE DE CULTURE (interieur verre) ---
  //  Collectible 'd' = COURBES/CHARTS (pickup_chart). Decor INTERIEUR :
  //  ciel vert pale (verre), bandeau bg_serre + une couche legere devant.
  //  tint verdatre lumineuse.
  niveau3: {
    boss: 'michael',
    theme: {
      sky: [196, 226, 200],
      tint: [206, 236, 200],
      layers: [
        { sprite: 'bg_serre', band: true, parallax: 0.40, anchor: 'bot', y: 'ground', z: -22 },
      ],
      pickups: { data: 'pickup_chart' },
    },
    map: [
      '                                                                                                                    ',
      '                                                  P                                                                 ',
      '                                                xxxx                                                                ',
      '                              o             ----          o            d                                           ',
      '                  o       ----        ----         d            ----          d        o            xxx            ',
      '       d      ----                p          V            ----          p            ----      c                    ',
      '   d      ----      d     V             J          A             V    d        J          p         k               ',
      '                                                         xx                                                         ',
      '  @    ^   A   J     J     A    d    J    V     p    J    A    d    J    V    p    J    A    J    d     A        B  *',
      '====================================================================================================================',
      '====================================================================================================================',
    ],
  },

  // --- CHAPITRE 3 : RStudio — LABORATOIRE (interieur paillasses/ordis) ------
  //  Collectible 'd' = HISTOGRAMMES (pickup_barchart). Decor INTERIEUR :
  //  ambiance froide, bandeau bg_labo. Exemple de theme avec variantes de
  //  tuiles/monstres ('...2' pris si le PNG existe, sinon retour au defaut).
  niveau4: {
    boss: 'rstudio',
    theme: {
      sky: [170, 184, 200],
      tint: [200, 212, 230],
      layers: [
        { sprite: 'bg_labo', band: true, parallax: 0.40, anchor: 'bot', y: 'ground', z: -22 },
      ],
      tiles:   { '=': ['tile_soil', 'tile_soil2'], '-': ['tile_panel', 'tile_panel2'], 'x': ['tile_panel', 'tile_panel2'] }, // obstacles multi-variantes
      enemies: { criquet: ['enemy_criquet', 'enemy_criquet2'], camion: ['enemy_camion', 'enemy_camion2'] },                 // monstres multi-variantes
      pickups: { data: 'pickup_barchart' },
    },
    map: [
      '                                                                                                                              ',
      '                                                        P                                                                     ',
      '                                                      xxxx                                                                    ',
      '                            o              o      ----        o          d         o                                          ',
      '                o       ----        ----      d        ----        d          ----       d        o            xxx           ',
      '      d     ----    d       p    V       J        R         p   V        J         R   p       ----     c                     ',
      '  d     ----    V       A      d     T      A    d     R     V    d    A     T    d     V    A     d   k     d                 ',
      '                                                              xx                                                              ',
      ' @   ^  A  T   J   A   R   d  V  J   A   T   d   R   J   A   V   d   T   J   A   R   d   V   J   A   T   d   R   A      B     * ',
      '==============================================================================================================================',
      '==============================================================================================================================',
    ],
  },

  // --- CONCLUSION : Cendrine — COULOIRS DE L'UNIVERSITE (interieur) ---------
  //  Le niveau le PLUS DUR des 5 (densite max). Collectible 'd' = FEUILLES
  //  (pickup_sheet). Decor INTERIEUR : beige/creme institutionnel, bandeau
  //  bg_couloir, tint neutre.
  niveau5: {
    boss: 'cendrine',
    theme: {
      sky: [228, 220, 198],
      tint: [232, 226, 210],
      layers: [
        { sprite: 'bg_couloir', band: true, parallax: 0.40, anchor: 'bot', y: 'ground', z: -22 },
      ],
      pickups: { data: 'pickup_sheet' },
    },
    map: [
      '                                                                                                                                      ',
      '                                                            P                                                                         ',
      '                                                          xxxx                                                                        ',
      '                          o          o            o   ----        o          o          d        o                                   ',
      '              o      ----      ----       d   ----       d   ----      d  ----      d ----     d      o              xxx              ',
      '     d    ----   d     p   V      J    R      p    A    V    p    J    R     p   V    A     p   J   ----   c                          ',
      ' d    ----  V    A   d    T   A   d   R   V   J  d   A   T   d   R   V   J  d   A   R   V  d  T   A  d   k    d                         ',
      '                                                                  xx                                                                  ',
      '@  ^  A T  J  A R  d V J  A T  R  J  A V  d R  J  A T  d  R  V  J A  R d  V  J  A T  d R  J  A V  d  T  R  A  J  d  A       B        *  ',
      '======================================================================================================================================',
      '======================================================================================================================================',
    ],
  },

  // --- FINAL : Le jury de these (megaboss multi-phases) — nuit dramatique
  jury: {
    boss: 'jury',
    theme: { sky: [70, 86, 140], tint: [150, 162, 205] },   // nuit : tint sur le decor par defaut
    map: [
      '                                                            ',
      '                                                            ',
      '                  o                       o                 ',
      '              ----                    ----                  ',
      '         k              c        d              k           ',
      '                  ----      ----        ----                ',
      '      d                                            d        ',
      '                                                            ',
      '  @         d         c          d          c        B    * ',
      '============================================================',
      '============================================================',
    ],
  },
};
