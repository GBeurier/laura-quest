/* =====================================================================
 *  CONFIG — Tous les reglages du jeu au meme endroit.
 *  "Laura l'exploratrice" : Laura fait son PhD sur l'agrivoltaisme
 *  (panneaux photovoltaiques au-dessus des rizieres). 5 niveaux + un
 *  jury final. Style Dora / Animal Crossing.
 *
 *  (Pas d'accents dans les textes affiches a l'ecran : la police
 *   bitmap par defaut de KAPLAY ne gere pas bien les accents.
 *   Voir README pour activer une vraie police TTF accentuee.)
 * ===================================================================== */
window.CONFIG = {

  // --- Fenetre / rendu ------------------------------------------------
  width: 960,
  height: 528,
  background: [143, 208, 240],
  tileSize: 48,

  // --- Art / haute definition -----------------------------------------
  //  scale : les sprites sont generes a (scale)x la resolution. CETTE VALEUR
  //          DOIT etre identique a SCALE dans artkit.py. Le jeu reduit les
  //          sprites de 1/scale -> meme taille a l'ecran, mais plus net.
  //  pixelDensity : finesse du rendu interne (2 = plus net sur ecrans HD/retina).
  art: { scale: 2, pixelDensity: 2 },

  // --- Tuiles ---------------------------------------------------------
  //  crumbleDelay = delai avant qu'un panneau cassable ('x') explose une fois
  //  que Laura a saute dessus (assez pour un seul saut).
  tile: { crumbleDelay: 0.4 },

  // --- Decor de fond : PARALLAX + skins (valeurs PAR DEFAUT) ----------
  //  Chaque niveau peut tout surcharger via LEVELS[x].theme (cf. level.js).
  //  - sky    : couleur du ciel [r,g,b] (calque le plus au fond).
  //  - tint   : teinte [r,g,b] appliquee a TOUTES les couches (ambiance).
  //  - layers : du plus LOIN au plus PRES. parallax = vitesse de defilement
  //             vs la camera (0 = immobile, 1 = colle au sol).
  //       band:true    -> bandeau repete a l'infini en X (sol, collines, ciel)
  //       scatter:true -> sprites disperses qui derivent + recyclent (nuages...)
  //       sprite       -> nom OU liste ['a','a2',...] = une variante au hasard
  //       color:[r,g,b]-> teinte propre a la couche (prioritaire sur tint)
  //  - tiles  : skin des OBSTACLES solides, par caractere de map. Liste = variantes.
  //  - enemies: skin des MONSTRES, par nom d'ennemi (cf. enemies). Liste = variantes.
  //  Un sprite absent (PNG non embarque) est ignore proprement -> on retombe
  //  sur le sprite par defaut. Voir CLAUDE.md "Ajouter / changer des assets".
  theme: {
    sky: [143, 208, 240],
    layers: [
      { sprite: 'bg_mountains', band: true,  parallax: 0.18, anchor: 'bot', y: 'ground', tileW: 480, z: -26, opacity: 0.95 },
      { sprite: 'bg_cloud',     scatter: true, parallax: 0.30, count: 7, yMin: 30, yMax: 140, z: -25 },
      { sprite: 'bg_hills',     band: true,  parallax: 0.45, anchor: 'bot', y: 'ground', tileW: 384, z: -24 },
      { sprite: 'bg_field',     band: true,  parallax: 0.65, anchor: 'bot', y: 'ground', tileW: 320, z: -20, opacity: 0.95 },
    ],
    tiles:   { '=': ['tile_soil'], '-': ['tile_panel'], 'x': ['tile_panel'] },
    // vide => le systeme de variantes numerotees global (enemy_xxx2) s'applique
    enemies: {},
    // skin du collectible 'd' (data) PAR NIVEAU : { data: 'pickup_xxx' }.
    //  Vide => sprite par defaut du pickup. Surcharge via LEVELS[x].theme.pickups.
    pickups: {},
  },

  // --- Physique -------------------------------------------------------
  gravity: 1900,

  // --- Heros : Laura l'exploratrice (gameplay CONSERVE tel quel) ------
  player: {
    speed: 250,
    jumpForce: 760,
    maxJumps: 2,
    maxHp: 5,
    invulnTime: 1.1,
    startAmmo: 'graine',  // 'graine' | 'riz'
    knockback: 300,       // recul quand Laura touche un monstre / un tir
    knockTime: 0.22,      // duree du recul
    // Accroupissement : la planche hero_duck est "scrubbee" selon la progression.
    //  duckDown = temps pour se baisser a fond (rapide, anim jouee a l'endroit) ;
    //  duckUp   = temps pour rejouer l'anim a l'envers et se relever.
    duckDown: 0.12,
    duckUp: 0.12,
  },

  // --- Tir ------------------------------------------------------------
  //  arcGravity = gravite des projectiles "en cloche" (cookie/gateau).
  //  Les armes en cloche se CHARGENT : maintenir X plus longtemps -> ca part
  //  plus loin. chargeTime = duree pour charge pleine ; arcMin/arcMax =
  //  multiplicateur de puissance (donc de portee) de 0 a 100% de charge.
  shot: { rate: 0.26, arcGravity: 1500, chargeTime: 0.9, arcMin: 0.6, arcMax: 1.6 },

  // Armes lancees (4) : 2 familles. graine/pied_riz tout droit, cookie/gateau
  // en cloche. On change d'arme avec MAJ (cf. ammoOrder).
  //  cost = energie consommee par tir (l'energie = la jauge "soleil").
  //  GRAINE = GRATUITE (cost 0) : arme de base infinie -> on n'est JAMAIS
  //  bloque. L'energie ne sert qu'aux 3 armes lourdes (riz/cookie/gateau).
  //  traj : 'straight' (tout droit, oriente par HAUT/BAS) ou 'arc' (en cloche).
  //  Deux familles ; dans chaque famille le 2e est plus fort ET plus cher.
  ammoTypes: {
    graine:   { sprite: 'ammo_graine', label: 'GRAINES',     damage: 1, speed: 600, cost: 0,  traj: 'straight', throwSprite: 'hero_throw_seed'   },
    pied_riz: { sprite: 'ammo_riz',    label: 'PIEDS DE RIZ', damage: 2, speed: 520, cost: 14, traj: 'straight', throwSprite: 'hero_throw_rice'   },
    cookie:   { sprite: 'ammo_cookie', label: 'COOKIES',      damage: 2, speed: 540, cost: 10, traj: 'arc',      throwSprite: 'hero_throw_cookie' },
    gateau:   { sprite: 'ammo_gateau', label: 'GATEAUX',      damage: 3, speed: 500, cost: 20, traj: 'arc',      throwSprite: 'hero_throw_cake'   },
  },
  ammoOrder: ['graine', 'pied_riz', 'cookie', 'gateau'],

  // --- Sorts ----------------------------------------------------------
  spells: {
    pleurer: { cooldown: 6, radius: 210, knockback: 520, clearBullets: true },
    raler:   { cooldown: 9, duration: 3, stunRadius: 230 },
  },

  // --- Chat angora (allie deploye) ------------------------------------
  //  ALLER-RETOUR : Laura le pose au sol juste devant elle (anim hero_cat_out),
  //  il court vers l'avant en nettoyant tout (ennemis + tirs), fait demi-tour a
  //  'range', revient vers Laura et disparait en la touchant (anim hero_cat_in).
  cat: {
    sprite: 'cat_run',
    speed: 560,       // vitesse de course du chat
    range: 560,       // distance parcourue avant le demi-tour
    scale: 0.62,      // taille du chat (1 = taille du sprite) -> plus petit que Laura
    spawnAhead: 42,   // distance devant Laura ou le chat est pose au sol
    catchDist: 26,    // distance a Laura ou le chat est "rattrape" (disparait) au retour
    damage: 4,        // degats vs ennemis ordinaires (one-shot la plupart)
    bossDamage: 2,    // degats vs boss (1 seul coup par chat -> evite de trop entamer les boss)
    cleanRadius: 46,  // rayon de nettoyage des tirs ennemis
    maxCharges: 3,    // reserve de chats (arcade)
    startCharges: 2,
    chargeTime: 2.0,  // duree de maintien de la touche AVANT que le chat parte (anti-spam)
  },

  // --- Jauge "Soleil" = ENERGIE = MUNITIONS lourdes -------------------
  //  Laura EST un panneau solaire : la jauge se RECHARGE toute seule au
  //  soleil (regen), mais PAS a l'ombre d'un panneau (regenShade). La
  //  graine etant gratuite, on n'est jamais bloque ; l'energie ne sert
  //  qu'aux armes lourdes. Les rayons 'o' restent un bonus instantane.
  sun: {
    enabled: true,
    max: 100,
    regen: 8,             // recharge/s EN PLEIN SOLEIL (passif, photosynthese)
    regenShade: 0,        // recharge/s A L'OMBRE sous un panneau ('-'/'x') -> 0 = aucune
    rayGain: 28,          // bonus instantane d'un rayon de soleil ramasse
    bossDropEvery: 9,     // rayons plus RARES pendant un boss (le passif fait le gros)
  },

  // --- Ennemis (modeles) ----------------------------------------------
  //  move: 'static' | 'patrol' | 'chase' | 'shooter' | 'fly' | 'jump'
  enemies: {
    caillou:  { sprite: 'enemy_caillou',  hp: Infinity, touchDamage: 1, move: 'static',  score: 0 },
    camion:   { sprite: 'enemy_camion',   hp: 6,        touchDamage: 2, move: 'patrol',  speed: 130, range: 130, aggro: 460, score: 250 },
    assureur: { sprite: 'enemy_assureur', hp: 2,        touchDamage: 1, move: 'chase',   speed: 80,  range: 110, aggro: 380, score: 150 },
    ademe:    { sprite: 'enemy_ademe',    hp: 3,        touchDamage: 1, move: 'shooter', shotEvery: 2.2, range: 460, shotSpeed: 240, score: 200 },
    // nouveaux archetypes (variete / difficulte)
    corbeau:  { sprite: 'enemy_corbeau',  hp: 2,        touchDamage: 1, move: 'fly',     speed: 95,  range: 150, amp: 34, anim: 'fly', score: 180 },
    criquet:  { sprite: 'enemy_criquet',  hp: 1,        touchDamage: 1, move: 'jump',    speed: 150, jumpForce: 560, jumpEvery: 1.1, aggro: 520, anim: 'hop', score: 140 },
    // minions de boss (reutilisent des sprites existants)
    bug:      { sprite: 'enemy_criquet',  hp: 1,        touchDamage: 1, move: 'chase',   speed: 130, range: 130, aggro: 700, anim: 'hop', score: 60 },
    chercheur:{ sprite: 'enemy_assureur', hp: 2,        touchDamage: 1, move: 'chase',   speed: 95,  range: 120, aggro: 600, score: 120 },
  },

  // --- Boss (1 IA differente par boss, cf. js/bosses.js) --------------
  //  Ordre de difficulte CROISSANT par POSITION (cf. LEVELS) :
  //    niveau1 proprietaire (le + facile) -> niveau5 cendrine (le + dur des 5)
  //    -> jury (megaboss). Les behavior/name NE CHANGENT PAS ; seules les
  //    stats sont recalibrees pour suivre la position dans la progression.
  //  Champs de tuning IA (windTime, revTime, aimTime, ...) lus par bosses.js ;
  //  l'IA a des defauts, donc aucun champ n'est obligatoire pour eviter un crash.
  bosses: {
    // niveau1 — LE PLUS FACILE
    proprietaire: { sprite: 'boss_proprietaire_move', attackSprite: 'boss_proprietaire_atk', behavior: 'charger',   hp: 18, maxHp: 18, touchDamage: 2, shotEvery: 1.5, shotSpeed: 240, speed: 55, range: 300, dashSpeed: 480, score: 1000, name: 'LE PROPRIETAIRE TERRIEN',
                    shot: 'shot_stake', windTime: 0.7, dashTime: 0.9, staggerTime: 1.2, throwTime: 0.5 },
    // niveau2
    agriculteur:  { sprite: 'boss_agriculteur_move',  attackSprite: 'boss_agriculteur_atk',  behavior: 'tracteur',  hp: 24, maxHp: 24, touchDamage: 2, shotEvery: 1.3, shotSpeed: 260, speed: 150,range: 300, dashSpeed: 0,   score: 1300, name: 'L AGRICULTEUR FOU',
                    shot: 'shot_fork', revTime: 0.5, stallTime: 1.5, forkEvery: 0.45 },
    // niveau3
    michael:      { sprite: 'boss_michael_move',      attackSprite: 'boss_michael_atk',      behavior: 'modeles',   hp: 30, maxHp: 30, touchDamage: 2, shotEvery: 1.2, shotSpeed: 280, speed: 80, range: 300, dashSpeed: 0,   score: 1700, name: 'MICHAEL DINGKHUN',
                    shot: 'shot_chart', aimTime: 0.6, recalcTime: 1.0, waveCount: 6 },
    // niveau4
    rstudio:      { sprite: 'boss_rstudio_move',      attackSprite: 'boss_rstudio_atk',      behavior: 'errors',    hp: 38, maxHp: 38, touchDamage: 2, shotEvery: 1.0, shotSpeed: 300, speed: 60, range: 280, dashSpeed: 0,   score: 2100, name: 'RSTUDIO',
                    shot: 'shot_error', attackTime: 4, loadTime: 2 },
    // niveau5 — LE PLUS DUR DES 5
    cendrine:     { sprite: 'boss_cendrine_move',     attackSprite: 'boss_cendrine_atk',     behavior: 'paperasse', hp: 46, maxHp: 46, touchDamage: 2, shotEvery: 0.9, shotSpeed: 330, speed: 90, range: 320, dashSpeed: 0,   score: 2600, name: 'CENDRINE',
                    shot: 'shot_form', preTime: 0.4, throwTime: 0.3, windowTime: 1.2 },
    // FINAL — megaboss multi-phases
    jury:         { sprite: 'boss_jury_move',         attackSprite: 'boss_jury_atk',         behavior: 'jury',      hp: 64, maxHp: 64, touchDamage: 3, shotEvery: 0.9, shotSpeed: 340, speed: 75, range: 320, dashSpeed: 0,   score: 5000, name: 'LE JURY DE THESE', shot: 'shot_gavel' },
  },

  // --- Collectibles ---------------------------------------------------
  pickups: {
    sunray:    { sprite: 'pickup_sunray',    score: 50 },             // recharge la jauge soleil
    cafe:      { sprite: 'pickup_cafe',      heal: 2, score: 30 },    // rend des coeurs
    data:      { sprite: 'pickup_data',      score: 75 },             // donnee de terrain
    page:      { sprite: 'pickup_page',      score: 100 },            // page de manuscrit
    publi:     { sprite: 'pickup_publi',     score: 1000 },           // PUBLI cachee (100%)
    croquette: { sprite: 'pickup_croquette', score: 20 },             // recharge le chat
    rollers:   { sprite: 'pickup_rollers',   score: 40, equip: 'rollers' }, // equipement rollers
    velo:      { sprite: 'pickup_velo',      score: 60, equip: 'velo' },     // equipement velo
  },

  // --- Equipements (objets a ramasser qui changent Laura) -------------
  //  overlay  : sprite superpose qui SUIT Laura + copie sa pose (si l'overlay
  //             a des anims idle/run/jump...).
  //  speedMul : vitesse de course.   jumpMul : hauteur de saut.
  //  override : remplace le sprite d'une pose (ex. run -> 'hero_roll').
  //  IMPORTANT : si Laura est touchee, elle PERD l'equipement au lieu d'une vie.
  //  Tout est ignore proprement tant que les PNG d'overlay n'existent pas.
  equipment: {
    // override = remplace le sprite ENTIER de Laura par "Laura sur l'engin"
    // (pas d'overlay separe : le sprite contient deja l'engin).
    rollers: {
      override: { idle: 'hero_roll', run: 'hero_roll', jump: 'hero_roll' },
      speedMul: 1.6, jumpMul: 1.3, msg: 'ROLLERS !  + rapide, saute + haut',
    },
    velo: {
      override: { idle: 'hero_bike', run: 'hero_bike', jump: 'hero_bike' },
      speedMul: 2.0, jumpMul: 1.35, msg: 'VELO !  + rapide, saute + haut',
    },
  },

  // --- Animations (grilles de sprites : bandes horizontales) ----------
  //  Seuls les sprites listes ici sont des feuilles multi-frames ;
  //  les autres restent des PNG simples (1 image).
  anims: {
    hero_idle:        { sliceX: 8, sliceY: 1, anims: { idle:  { from: 0, to: 7, loop: true,  speed: 8  } } },
    hero_run:         { sliceX: 8, sliceY: 1, anims: { run:   { from: 0, to: 7, loop: true,  speed: 14 } } },
    hero_jump:        { sliceX: 8, sliceY: 1, anims: { jump:  { from: 0, to: 7, loop: true,  speed: 10 } } },
    hero_hurt:        { sliceX: 8, sliceY: 1, anims: { hurt:  { from: 0, to: 7, loop: true,  speed: 10 } } },
    hero_duck:        { sliceX: 7, sliceY: 1, anims: { duck:  { from: 0, to: 6, loop: true,  speed: 8  } } },
    // lancer du chat : sortie (depart) / entree (retour au sac)
    hero_cat_out:     { sliceX: 4, sliceY: 1, anims: { cat:   { from: 0, to: 3, loop: false, speed: 12 } } },
    hero_cat_in:      { sliceX: 4, sliceY: 1, anims: { cat:   { from: 0, to: 3, loop: false, speed: 12 } } },
    // une anim de lancer par arme (mappee depuis ammoTypes[].throwSprite)
    hero_throw:       { sliceX: 6, sliceY: 1, anims: { throw: { from: 0, to: 5, loop: false, speed: 18 } } },
    hero_throw_seed:  { sliceX: 6, sliceY: 1, anims: { throw: { from: 0, to: 5, loop: false, speed: 18 } } },
    hero_throw_rice:  { sliceX: 6, sliceY: 1, anims: { throw: { from: 0, to: 5, loop: false, speed: 18 } } },
    hero_throw_cookie:{ sliceX: 6, sliceY: 1, anims: { throw: { from: 0, to: 5, loop: false, speed: 18 } } },
    hero_throw_cake:  { sliceX: 8, sliceY: 1, anims: { throw: { from: 0, to: 7, loop: false, speed: 18 } } },
    // sprites complets "Laura sur l'engin" (remplacent le sprite via equipment.override)
    hero_bike:        { sliceX: 7, sliceY: 1, anims: { idle: { from: 0, to: 6, loop: true, speed: 6 }, run: { from: 0, to: 6, loop: true, speed: 14 }, jump: { from: 3, to: 3 } } },
    hero_roll:        { sliceX: 8, sliceY: 1, anims: { idle: { from: 0, to: 7, loop: true, speed: 6 }, run: { from: 0, to: 7, loop: true, speed: 16 }, jump: { from: 4, to: 4 } } },
    cat_run:          { sliceX: 8, sliceY: 1, anims: { run:   { from: 0, to: 7, loop: true,  speed: 16 } } },
    enemy_corbeau:    { sliceX: 2, sliceY: 1, anims: { fly:   { from: 0, to: 1, loop: true,  speed: 8  } } },
    enemy_criquet:    { sliceX: 2, sliceY: 1, anims: { hop:   { from: 0, to: 1, loop: true,  speed: 6  } } },
    // --- Boss : DEUX feuilles par boss (cf. tools/gen_boss_sheets.py) ---
    //  _move : DEPLACEMENT — frames 0-2 = cycle de marche (idle), frame 3 = touche (hurt)
    //  _atk  : ATTAQUE     — frames 0-3 = charge -> frappe -> retour (attack)
    //  game.js bascule sur la feuille _atk uniquement quand animWant === 'attack'.
    boss_proprietaire_move: { sliceX: 4, sliceY: 1, anims: { idle: { from: 0, to: 2, loop: true, speed: 5 }, hurt: { from: 3, to: 3 } } },
    boss_proprietaire_atk:  { sliceX: 4, sliceY: 1, anims: { attack: { from: 0, to: 3, loop: true, speed: 8 } } },
    boss_agriculteur_move:  { sliceX: 4, sliceY: 1, anims: { idle: { from: 0, to: 2, loop: true, speed: 5 }, hurt: { from: 3, to: 3 } } },
    boss_agriculteur_atk:   { sliceX: 4, sliceY: 1, anims: { attack: { from: 0, to: 3, loop: true, speed: 8 } } },
    boss_michael_move:      { sliceX: 4, sliceY: 1, anims: { idle: { from: 0, to: 2, loop: true, speed: 5 }, hurt: { from: 3, to: 3 } } },
    boss_michael_atk:       { sliceX: 4, sliceY: 1, anims: { attack: { from: 0, to: 3, loop: true, speed: 8 } } },
    boss_rstudio_move:      { sliceX: 4, sliceY: 1, anims: { idle: { from: 0, to: 2, loop: true, speed: 5 }, hurt: { from: 3, to: 3 } } },
    boss_rstudio_atk:       { sliceX: 4, sliceY: 1, anims: { attack: { from: 0, to: 3, loop: true, speed: 8 } } },
    boss_cendrine_move:     { sliceX: 4, sliceY: 1, anims: { idle: { from: 0, to: 2, loop: true, speed: 5 }, hurt: { from: 3, to: 3 } } },
    boss_cendrine_atk:      { sliceX: 4, sliceY: 1, anims: { attack: { from: 0, to: 3, loop: true, speed: 8 } } },
    boss_jury_move:         { sliceX: 4, sliceY: 1, anims: { idle: { from: 0, to: 2, loop: true, speed: 5 }, hurt: { from: 3, to: 3 } } },
    boss_jury_atk:          { sliceX: 4, sliceY: 1, anims: { attack: { from: 0, to: 3, loop: true, speed: 8 } } },

    // --- Collectibles (4 frames : flottent/pulsent) ---
    pickup_sunray:    { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_cafe:      { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_data:      { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_page:      { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_publi:     { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_croquette: { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_rollers:   { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_velo:      { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    // collectibles thematiques 'd' par niveau (re-skin via theme.pickups)
    pickup_graine:    { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_plant:     { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_chart:     { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_barchart:  { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_sheet:     { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    // --- Munitions (4 frames : tournent) ---
    ammo_graine:      { sliceX: 4, anims: { spin: { from: 0, to: 3, loop: true, speed: 14 } } },
    ammo_riz:         { sliceX: 4, anims: { spin: { from: 0, to: 3, loop: true, speed: 14 } } },
    ammo_cookie:      { sliceX: 4, anims: { spin: { from: 0, to: 3, loop: true, speed: 14 } } },
    ammo_gateau:      { sliceX: 4, anims: { spin: { from: 0, to: 3, loop: true, speed: 14 } } },
    // --- Ennemis "fixes" (2 frames : respirent/oscillent) ---
    enemy_caillou:    { sliceX: 2, anims: { idle: { from: 0, to: 1, loop: true, speed: 2 } } },
    enemy_camion:     { sliceX: 2, anims: { idle: { from: 0, to: 1, loop: true, speed: 5 } } },
    enemy_assureur:   { sliceX: 2, anims: { idle: { from: 0, to: 1, loop: true, speed: 5 } } },
    enemy_ademe:      { sliceX: 2, anims: { idle: { from: 0, to: 1, loop: true, speed: 5 } } },
    // --- Decor / FX / UI ---
    sun_goal:         { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    fx_grumble:       { sliceX: 3, anims: { idle: { from: 0, to: 2, loop: true, speed: 8 } } },
    heart:            { sliceX: 2, anims: { idle: { from: 0, to: 1, loop: true, speed: 3 } } },
    // --- Overlays equipement : idle/run/jump pour se caler sur la pose de Laura ---
    gear_rollers:     { sliceX: 4, anims: { idle: { from: 0, to: 1, loop: true, speed: 4 }, run: { from: 0, to: 3, loop: true, speed: 14 }, jump: { from: 2, to: 2 } } },
    gear_velo:        { sliceX: 4, anims: { idle: { from: 0, to: 1, loop: true, speed: 4 }, run: { from: 0, to: 3, loop: true, speed: 12 }, jump: { from: 2, to: 2 } } },
    // Tout sprite peut etre anime : elargis le PNG en N frames + declare-le ici.
  },

  // --- Controles ------------------------------------------------------
  controls: {
    left:       ['left', 'q', 'a'],
    right:      ['right', 'd'],
    jump:       ['up', 'z', 'w'],   // saute avec HAUT
    aimUp:      [],              // viser vers le haut : feature gardee, plus de touche
    aimDown:    [],             // viser vers le bas : feature gardee, plus de touche
    crouch:     ['down'],        // s'accroupir (au sol) : Laura se baisse, hitbox reduite
    shoot:      ['space'],       // tire avec ESPACE
    pleurer:    ['x'],
    raler:      ['v'],
    cat:        ['c'],
    quit:       ['escape'],      // quitter le niveau -> carte
    switchAmmo: ['shift'],
  },

  // --- Audio ----------------------------------------------------------
  audio: { enabled: true, volume: 0.5 },

  // --- Triche / test (mets cheats:false pour la version cadeau) -------
  //  En jeu : 1-6 = aller au niveau, 0 = finir le niveau, G = dieu, H = plein.
  cheats: true,

  // --- Enchainement des niveaux (cles dans LEVELS) --------------------
  levels: ['niveau1', 'niveau2', 'niveau3', 'niveau4', 'niveau5', 'jury'],

  // --- Carte du monde (overworld facon Dora) --------------------------
  //  Un noeud par niveau. y = altitude du noeud sur la carte.
  world: {
    nodes: [
      { key: 'niveau1', x: 130, y: 360, label: 'CH.1', boss: 'PROPRIO' },
      { key: 'niveau2', x: 290, y: 300, label: 'CH.2', boss: 'AGRI' },
      { key: 'niveau3', x: 450, y: 360, label: 'CH.3', boss: 'MICHAEL' },
      { key: 'niveau4', x: 610, y: 290, label: 'CH.4', boss: 'RSTUDIO' },
      { key: 'niveau5', x: 770, y: 350, label: 'CH.5', boss: 'CENDRINE' },
      { key: 'jury',    x: 880, y: 250, label: 'JURY', boss: 'JURY' },
    ],
  },

  // --- Scenario / textes ----------------------------------------------
  story: {
    title:    'LAURA L EXPLORATRICE',
    subtitle: 'Le PhD agrivoltaique sur le riz',
    intro:    'Laura fait sa these sur le riz sous panneaux solaires.\n' +
              'Des rizieres de Camargue a la serre, du labo a la redaction,\n' +
              'jusqu a la soutenance : bats chaque boss pour ecrire ta these !',
    hint:     'Gauche/Droite ou Q/D bouger   HAUT sauter   ESPACE lancer\n' +
              'X pleurer   V raler   C (maintenir 2s) chat   MAJ changer d arme   ESC quitter',
    start:    'Appuie sur ESPACE pour commencer',
    slots:    'CHOISIS TA SAUVEGARDE',
    overworld:'Choisis un chapitre (ESPACE pour entrer)',
    chapterDone: 'CHAPITRE ECRIT !',
    win:      'SOUTENANCE REUSSIE !  Felicitations Docteure Laura !',
    lose:     'Aie... reprends des forces et recommence !',
    retry:    'ESPACE pour continuer',
    bossWarn: 'Bats le boss pour ecrire le chapitre !',
    catEmpty: 'Plus de chat ! (ramasse des croquettes)',
    publi:    'PUBLICATION TROUVEE ! +100%',
    // texte affiche a l'ecran "Chapitre gagne" (sans accents).
    //  Ordre = LEVELS niveau1..niveau5 (proprio, agri, michael, rstudio, cendrine).
    chapters: [
      'CHAPITRE 1 : Etat de l art.\nRizieres de Camargue : le proprietaire cede le terrain, les parcelles sont installees !',
      'CHAPITRE 2 : Materiel & methodes.\nAu champ, l agriculteur fou se calme : les experiences sur le riz tournent !',
      'CHAPITRE 3 : Resultats.\nEn serre, Michael le chercheur est convaincu : les donnees sont recoltees !',
      'CHAPITRE 4 : Analyse.\nAu labo, RStudio cesse de planter : les donnees sont saisies et analysees !',
      'CHAPITRE 5 : Redaction & soumission.\nDans les couloirs, Cendrine tamponne le depot : la these est soumise !',
    ],
  },
};
