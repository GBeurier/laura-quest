/* =====================================================================
 *  CONFIG — Tous les reglages du jeu au meme endroit.
 *  C'est ICI qu'on tune le gameplay et le scenario apres la demo.
 *  (Pas d'accents dans les textes affiches a l'ecran : la police
 *   bitmap par defaut de KAPLAY ne gere pas bien les accents.
 *   Voir README pour activer une vraie police TTF accentuee.)
 * ===================================================================== */
window.CONFIG = {

  // --- Fenetre / rendu ------------------------------------------------
  width: 960,
  height: 528,            // ~ 11 tuiles de 48px : tout le niveau tient a l'ecran en hauteur
  background: [143, 208, 240],   // couleur du ciel (RGB)
  tileSize: 48,

  // --- Physique -------------------------------------------------------
  gravity: 1900,

  // --- Heros : le pot de riz a roulettes ------------------------------
  player: {
    speed: 250,          // vitesse de deplacement horizontal (px/s)
    jumpForce: 760,      // force du saut
    maxJumps: 2,         // 1 = simple saut, 2 = double saut
    maxHp: 5,            // nombre de coeurs
    invulnTime: 1.1,     // secondes d'invincibilite apres un coup
    startAmmo: 'graine', // munition de depart : 'graine' | 'cookie' | 'gateau'
  },

  // --- Tir ------------------------------------------------------------
  shot: {
    rate: 0.26,          // delai minimum entre deux tirs (s)
  },
  // Types de munitions (on switche en jeu avec la touche dediee)
  ammoTypes: {
    graine: { sprite: 'ammo_graine', label: 'GRAINES', damage: 1, speed: 600 },
    cookie: { sprite: 'ammo_cookie', label: 'COOKIES', damage: 2, speed: 500 },
    gateau: { sprite: 'ammo_gateau', label: 'GATEAUX', damage: 3, speed: 440 },
  },
  ammoOrder: ['graine', 'cookie', 'gateau'],   // ordre de cycle

  // --- Sorts ----------------------------------------------------------
  spells: {
    // Pleurer : inonde de larmes, repousse les ennemis proches et efface leurs tirs
    pleurer: { cooldown: 6, radius: 210, knockback: 520, clearBullets: true },
    // Raler : bouclier temporaire + assomme les ennemis proches
    raler:   { cooldown: 9, duration: 3, stunRadius: 230 },
  },

  // --- Jauge "Soleil" (saveur thematique : suivre le soleil) ----------
  sun: {
    enabled: true,
    max: 100,
    drain: 3.5,          // points perdus par seconde
    rayGain: 28,         // points gagnes par rayon ramasse
    lethalAtZero: false, // demo : non letal (juste indicatif / score). true = perd des coeurs a 0.
  },

  // --- Ennemis (modeles) ----------------------------------------------
  //  move: 'static' | 'patrol' | 'chase' | 'shooter'
  enemies: {
    caillou:  { sprite: 'enemy_caillou',  hp: Infinity, touchDamage: 1, move: 'static',  score: 0 },
    camion:   { sprite: 'enemy_camion',   hp: Infinity, touchDamage: 2, move: 'patrol',  speed: 130, range: 130, score: 0 },
    assureur: { sprite: 'enemy_assureur', hp: 2,        touchDamage: 1, move: 'chase',   speed: 80,  aggro: 380, score: 150 },
    ademe:    { sprite: 'enemy_ademe',    hp: 3,        touchDamage: 1, move: 'shooter', shotEvery: 2.2, range: 460, shotSpeed: 240, score: 200 },
  },

  // --- Boss (les directeurs de these) ---------------------------------
  bosses: {
    directeur1: { sprite: 'boss_directeur1', hp: 12, touchDamage: 2, shotEvery: 1.6, shotSpeed: 260, speed: 55, range: 220, score: 1000, name: 'DIRECTEUR DE THESE 1' },
    directeur2: { sprite: 'boss_directeur2', hp: 16, touchDamage: 2, shotEvery: 1.2, shotSpeed: 300, speed: 75, range: 240, score: 1500, name: 'DIRECTEUR DE THESE 2' },
  },

  // --- Collectibles ---------------------------------------------------
  pickups: {
    sunray: { sprite: 'pickup_sunray', score: 50 },           // recharge la jauge soleil
    cafe:   { sprite: 'pickup_cafe',   heal: 2, score: 30 },  // rend des coeurs
  },

  // --- Controles (codes touches KAPLAY ; plusieurs touches possibles) -
  controls: {
    left:       ['left', 'q', 'a'],
    right:      ['right', 'd'],
    jump:       ['space', 'up', 'z', 'w'],
    shoot:      ['x', 'enter'],
    pleurer:    ['c'],
    raler:      ['v'],
    switchAmmo: ['shift'],
  },

  // --- Audio ----------------------------------------------------------
  audio: { enabled: true, volume: 0.5 },

  // --- Enchainement des niveaux (cles dans LEVELS) --------------------
  levels: ['niveau1'],

  // --- Scenario / textes (faciles a tuner) ----------------------------
  story: {
    title:    'LAURA QUEST',
    subtitle: 'La these agrivoltaique',
    intro:    'Aide Laura, le pot de riz a roulettes, a suivre le soleil\n' +
              'jusqu a la soutenance. Evite cailloux, camions, assureurs\n' +
              'et rapports de l ADEME... et affronte tes directeurs de these.',
    hint:     'Fleches/ZQSD bouger   ESPACE sauter   X tirer\n' +
              'C pleurer   V raler   MAJ changer de munition',
    start:    'Appuie sur ESPACE pour commencer',
    win:      'SOUTENANCE VALIDEE !  Bravo Docteure Laura !',
    lose:     'Aie... le soleil t attend, recommence !',
    retry:    'ESPACE pour rejouer',
    bossWarn: 'Un directeur de these approche !',
  },
};
