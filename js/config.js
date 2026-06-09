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
  // Decalage VERTICAL du monde, en PIXELS : on descend tout le jeu de
  //  `groundDrop` px (sol + bas, + de ciel, collines/montagnes du parallax
  //  remontees avec l'horizon). 0 = monde centre comme a l'origine.
  //  ATTENTION : trop grand -> Laura passe derriere la barre HUD du bas
  //  (qui commence a y = height-58 = 470). 8 px reste bien au-dessus.
  groundDrop: 8,

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
    // SPRITE DU PIED des plateformes en perspective (cf. addPanelDeco). Defaut =
    //  pied de panneau solaire. Un niveau "interieur" peut le remplacer par un
    //  support d'etagere via LEVELS[x].theme.panelLeg (+ tiles['-'] pour le cap).
    panelLeg: 'panel_leg',
    layers: [
      { sprite: 'bg_mountains', band: true,  parallax: 0.18, anchor: 'bot', y: 'ground', z: -26, opacity: 0.95 },
      { sprite: 'bg_cloud',     scatter: true, parallax: 0.30, count: 7, yMin: 30, yMax: 140, z: -25, scale: 0.7 },
      { sprite: 'bg_hills',     band: true,  parallax: 0.45, anchor: 'bot', y: 'ground', z: -24 },
      { sprite: 'bg_field',     band: true,  parallax: 0.65, anchor: 'bot', y: 'ground', z: -20, opacity: 0.95 },
    ],
    tiles:   { '=': ['tile_soil'], '-': ['tile_panel'], 'x': ['tile_panel'] },
    // vide => le systeme de variantes numerotees global (enemy_xxx2) s'applique
    enemies: {},
    // skin du collectible 'd' (data) PAR NIVEAU : { data: 'pickup_xxx' }.
    //  Vide => sprite par defaut du pickup. Surcharge via LEVELS[x].theme.pickups.
    pickups: {},
    // skin du PASSANT (figurant, cf. enemies.passant). Surcharge PAR NIVEAU via
    //  LEVELS[x].theme.passant (un biome = un jeu d'habits + un pool de tetes).
    //  - bodies : feuilles de marche du CORPS (sans tete), par sexe 'h'/'f'.
    //             liste => une variante au hasard par exemplaire.
    //  - heads  : tetes "South Park" de face, par sexe ; UNE choisie AU HASARD
    //             par exemplaire au moment du spawn (a la creation du niveau).
    //  - femaleRatio : proba de tirer un corps/tete 'f' (0..1).
    //  - sizeScale / headSizes : 4 tailles de passant. headSizes range chaque
    //             tete (= chaque personne) dans une categorie ; sizeScale donne
    //             le facteur applique. ATTENTION : SEUL LE CORPS change de taille
    //             -> la TETE garde toujours la meme taille (les grands/petits ont
    //             juste un corps plus/moins grand, cf. attachHead qui compense le
    //             scale du parent). C'est voulu : pas de grosse tete sur grand corps.
    //  - headScale   : taille de la tete (constante, independante de la taille du corps).
    //  - headLocal   : position de la tete dans le repere du CORPS (px @ART,
    //             ancre tete = 'bot' -> c'est le point du COU ; la tete pousse
    //             vers le haut). headBob = amplitude du dodelinement (px ecran),
    //             headRot = amplitude du balancement (degres).
    //  Tout asset absent est ignore -> retombe sur la base / pas de tete.
    passant: {
      femaleRatio: 17 / 38,
      headScale: 0.9,
      headLocal: [0, -90], headBob: 1, headRot: 3,
      bodies: { h: ['body_champ_h'], f: ['body_champ_f'] },
      heads:  { h: Array.from({ length: 21 }, (_, i) => 'head_npc_h_' + (i + 1)),
                f: Array.from({ length: 17 }, (_, i) => 'head_npc_f_' + (i + 1)) },
      sizeScale: { petit: 1, moyen: 1.14, grand: 1.28, tresGrand: 1.42 },
      headSizes: {
        f: { default: 'petit', moyen: [1, 3, 4, 7, 8, 10, 16, 17] },
        h: {
          petit: [4, 10, 12, 6, 19],
          moyen: [1, 2, 3, 5, 11, 13, 15, 17, 20, 21],
          grand: [8, 9, 16, 18],
          tresGrand: [7, 14],
        },
      },
    },
  },

  // --- Physique -------------------------------------------------------
  gravity: 1900,

  // --- Heros : Laura l'exploratrice (gameplay CONSERVE tel quel) ------
  player: {
    speed: 250,
    jumpForce: 760,
    maxJumps: 2,
    // SAUT MODULABLE : desormais sur le RELACHEMENT de SAUT (cf. onKeysRelease
    //  dans game.js) -> relacher tot = petit saut. jumpCutG (ancien systeme
    //  "tenir BAS") laisse a 0 : BAS sert UNIQUEMENT a s'accroupir.
    jumpCutG: 0,
    maxHp: 5,
    invulnTime: 1.1,
    startAmmo: 'graine',  // tir de base
    knockback: 300,       // recul quand Laura touche un monstre / un tir
    knockTime: 0.22,      // duree du recul
    // DASH : ruee horizontale courte avec i-frames (esquive). Coute de l'energie
    //  (jauge soleil) et a un cooldown. Direction = sens courant de Laura.
    dash: { speed: 560, duration: 0.16, cooldown: 0.5, cost: 25, iframes: 0.22 },
    // Accroupissement : la planche hero_duck est "scrubbee" selon la progression.
    //  duckDown = temps pour se baisser a fond (rapide, anim jouee a l'endroit) ;
    //  duckUp   = temps pour rejouer l'anim a l'envers et se relever.
    duckDown: 0.12,
    duckUp: 0.12,
  },

  // --- Tir ------------------------------------------------------------
  //  arcGravity = gravite des projectiles "en cloche" (gateau / lob lourd).
  //  arcMin/arcMax = multiplicateur de puissance (donc de portee). aimDefault =
  //  angle de lancer du lob (degres au-dessus de l'horizontale) ; l'auto-visee
  //  (autoAimArc) resout la puissance pour atteindre la cible a cet angle.
  //  lobCooldown = delai minimal entre deux lobs lourds (X).
  shot: {
    rate: 0.26, arcGravity: 1500, arcMin: 0.6, arcMax: 1.6,
    aimDefault: 52, lobCooldown: 0.6,
    // throwHold = duree de la pose de lancer apres CHAQUE tir. DOIT etre > rate
    //  sinon, en rafale (maintien), la pose retombe 1 frame sur course/saut entre
    //  deux tirs (clignotement). L'anim est rejouee a chaque tir (cf. playerShoot)
    //  pour qu'elle reste vivante au lieu de geler sur sa derniere frame.
    throwHold: 0.32,
  },

  // Armes lancees (2) : 2 roles. graine = TIR DE BASE droit GRATUIT (ESPACE) ;
  // gateau = LOB LOURD en cloche AoE auto-vise (X), qui coute de l'energie.
  //  cost = energie consommee par tir (l'energie = la jauge "soleil").
  //  GRAINE = tir de base, cout 0 -> jamais bloque.
  //  traj : 'straight' (tout droit) ou 'arc' (en cloche).
  ammoTypes: {
    graine:   { sprite: 'ammo_graine', label: 'GRAINES',     damage: 1, speed: 600, cost: 0,  traj: 'straight', throwSprite: 'hero_throw_seed'   },
    //  GATEAU = cloche EXPLOSIVE : a l'impact, eclate en AoE (degats a tout ce
    //  qui est dans aoe.radius). C'est le lob lourd "zone".
    gateau:   { sprite: 'ammo_gateau', label: 'GATEAUX',      damage: 3, speed: 500, cost: 20, traj: 'arc',      throwSprite: 'hero_throw_cake', aoe: { radius: 94, damage: 3 } },
    //  BOMBE = tir de base EXPLOSIF droit (famille de powerup 'bombe'). Gratuit, petite AoE.
    bombe:    { sprite: 'ammo_gateau', label: 'BOMBES',       damage: 2, speed: 460, cost: 0,  traj: 'straight', throwSprite: 'hero_throw_seed', aoe: { radius: 58, damage: 2 } },
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
    chargeTime: 0,    // chat INSTANTANE (plus de maintien) : deploiement a la pression de C
  },

  // --- Jauge "Soleil" = ENERGIE / STAMINA -----------------------------
  //  Laura EST un panneau solaire : la jauge se RECHARGE toute seule au
  //  soleil (regen), mais PAS a l'ombre d'un panneau (regenShade). Tirer
  //  le lob lourd COUTE de l'energie. Les rayons 'o' = bonus instant.
  //  (La MORALITE ne touche plus cette jauge : elle est passee sur le TIER.)
  sun: {
    enabled: true,
    max: 100,
    regen: 8,             // recharge/s EN PLEIN SOLEIL (passif, photosynthese)
    regenShade: 0,        // recharge/s A L'OMBRE sous un panneau ('-'/'x') -> 0 = aucune
    rayGain: 28,          // bonus instantane d'un rayon de soleil ramasse
    bossDropEvery: 9,     // rayons plus RARES pendant un boss (le passif fait le gros)
  },

  // --- TIER (pips de "niveau") = conscience / puissance ----------------
  //  3 pastilles discretes, DECOUPLEES de l'energie. +1 en ramassant une
  //  data ('d'). -1 a chaque coup recu (tier 2/3 = bouclier) ET a chaque
  //  passant tue (la conscience). Au tier 1 il n'y a plus de bouclier ->
  //  le coup coute un coeur. Le tir de base (graine) gagne en puissance
  //  avec le tier (damage = tier, plafonne a max). cf. game.js.
  tier: { max: 3, start: 1 },

  // --- Ennemis (modeles) ----------------------------------------------
  //  move: 'static' | 'patrol' | 'chase' | 'shooter' | 'fly' | 'jump'
  enemies: {
    // NB: 'caillou' n'est plus un ennemi -> c'est un OBSTACLE solide sans degat
    //     (cf. addRock dans game.js ; pose par '^' dans la map + auto aux 2 bords).
    camion:   { sprite: 'enemy_camion',   hp: 6,        touchDamage: 2, move: 'patrol',  speed: 130, range: 130, aggro: 460, score: 250 },
    assureur: { sprite: 'enemy_assureur', hp: 2,        touchDamage: 1, move: 'chase',   speed: 80,  range: 110, aggro: 380, score: 150 },
    ademe:    { sprite: 'enemy_ademe',    hp: 3,        touchDamage: 1, move: 'shooter', shotEvery: 2.2, range: 460, shotSpeed: 240, score: 200 },
    // nouveaux archetypes (variete / difficulte)
    corbeau:  { sprite: 'enemy_corbeau',  hp: 2,        touchDamage: 1, move: 'fly',     speed: 95,  range: 150, amp: 34, anim: 'fly', score: 180, scale: 0.32 },
    criquet:  { sprite: 'enemy_criquet',  hp: 1,        touchDamage: 1, move: 'jump',    speed: 150, jumpForce: 560, jumpEvery: 1.1, aggro: 520, anim: 'walk', score: 140 },

    // --- NOUVEAUX ARCHETYPES (design definitif) ------------------------
    //  6 familles par niveau : IMMOBILE (static) / VEHICULE (patrol) / VOLANT
    //  (fly) / SOL (chase) / TIR (shooter) / RANDOM (passant). Chaque feuille
    //  enemy_<kind> = 6 frames (walk 0-2 / hurt 3 / attack 4-5, cf. anims).
    //  scale = taille a l'ecran (humanoide/engin ~1 ; petits insectes < 0.5).
    //  VOLANT
    moustique:    { sprite: 'enemy_moustique',    hp: 1, touchDamage: 1, move: 'fly',     speed: 120, range: 160, amp: 42, anim: 'walk', score: 120, scale: 0.45 },
    abeille:      { sprite: 'enemy_abeille',      hp: 1, touchDamage: 1, move: 'fly',     speed: 130, range: 150, amp: 36, anim: 'walk', score: 130, scale: 0.5  },
    //  SOL (rampe vite, bas)
    cafard:       { sprite: 'enemy_cafard',       hp: 1, touchDamage: 1, move: 'chase',   speed: 165, range: 90,  aggro: 500, anim: 'walk', score: 100, scale: 0.5 },
    //  VEHICULE (va-et-vient, gros degats)
    transpalette: { sprite: 'enemy_transpalette', hp: 6, touchDamage: 2, move: 'patrol',  speed: 150, range: 140, aggro: 460, anim: 'walk', score: 260, scale: 1.0 },
    livreur:      { sprite: 'enemy_livreur',      hp: 6, touchDamage: 2, move: 'patrol',  speed: 120, range: 130, aggro: 460, anim: 'walk', score: 260, scale: 1.0 },
    coursier:     { sprite: 'enemy_coursier',     hp: 6, touchDamage: 2, move: 'patrol',  speed: 140, range: 140, aggro: 460, anim: 'walk', score: 260, scale: 1.0 },
    //  TIR (shooter)
    imprimante:   { sprite: 'enemy_imprimante',   hp: 4, touchDamage: 1, move: 'shooter', shotEvery: 2.0, range: 440, shotSpeed: 260, anim: 'walk', score: 230, scale: 0.95 },
    chips:        { sprite: 'enemy_chips',        hp: 2, touchDamage: 1, move: 'shooter', shotEvery: 2.4, range: 400, shotSpeed: 230, anim: 'walk', score: 160, scale: 0.7  },
    tuyau:        { sprite: 'enemy_tuyau',        hp: 3, touchDamage: 1, move: 'shooter', shotEvery: 1.8, range: 420, shotSpeed: 240, anim: 'walk', score: 200, scale: 0.9  },
    //  IMMOBILE (static, degat au contact / petite attaque de proximite)
    sac:          { sprite: 'enemy_sac',          hp: 3, touchDamage: 1, move: 'static',  anim: 'walk', score: 120, scale: 0.8 },
    fontaine:     { sprite: 'enemy_fontaine',     hp: 4, touchDamage: 1, move: 'static',  anim: 'walk', score: 150, scale: 0.9 },
    dossiers:     { sprite: 'enemy_dossiers',     hp: 4, touchDamage: 1, move: 'static',  anim: 'walk', score: 150, scale: 0.9 },

    // minions de boss (reutilisent des sprites existants)
    bug:      { sprite: 'enemy_criquet',  hp: 1,        touchDamage: 1, move: 'chase',   speed: 130, range: 130, aggro: 700, anim: 'hop', score: 60 },
    chercheur:{ sprite: 'enemy_assureur', hp: 2,        touchDamage: 1, move: 'chase',   speed: 95,  range: 120, aggro: 600, score: 120 },
    // PASSANT = figurant ambiant INOFFENSIF (touchDamage 0) : fait les cent
    //  pas, ne blesse JAMAIS Laura. Le TUER ne rapporte rien (score 0) et fait
    //  PERDRE un TIER (cf. registerKill dans game.js) -> on est cense les
    //  laisser tranquilles.
    //  persona:true -> spawnEnemy (game.js) compose un CORPS (selon le biome +
    //  un sexe tire au hasard, cf. theme.passant.bodies) + une TETE "South Park"
    //  de face, choisie AU HASARD dans le pool du biome (theme.passant.heads),
    //  montee en ENFANT du corps (elle dodeline, ne se mirroir pas). Pose-le
    //  dans une map avec le caractere 'N' (cf. legende level.js). sprite =
    //  base de secours si le theme ne fournit pas de corps ('body_champ_<sexe>').
    passant:  { sprite: 'body_champ',     hp: 2,        touchDamage: 0, move: 'patrol', speed: 48,  range: 70, persona: true, anim: 'walk', score: 0 },
  },

  // --- Boss (1 IA differente par boss, cf. js/bosses.js) --------------
  //  Ordre de difficulte CROISSANT par POSITION (cf. LEVELS / design definitif) :
  //    niveau1 agriculteur (le + facile, Riziere) -> niveau2 Francois (Appart)
  //    -> niveau3 rstudio (Serre) -> niveau4 michael (Labo) -> niveau5 cendrine
  //    (Universite, le + dur des 5) -> jury (megaboss). Les behavior/sprite/shot
  //    NE CHANGENT PAS d'un boss ; seules HP/score/cadence sont recalibrees pour
  //    suivre la POSITION dans la progression (palier 18 -> 24 -> 30 -> 38 -> 46).
  //  Champs de tuning IA (windTime, revTime, aimTime, ...) lus par bosses.js ;
  //  l'IA a des defauts, donc aucun champ n'est obligatoire pour eviter un crash.
  bosses: {
    // niveau1 (Riziere) — LE PLUS FACILE
    agriculteur:  { sprite: 'boss_agriculteur_move',  attackSprite: 'boss_agriculteur_atk',  behavior: 'tracteur',  hp: 18, maxHp: 18, touchDamage: 2, shotEvery: 1.5, shotSpeed: 240, speed: 150,range: 300, dashSpeed: 0,   score: 1000, name: 'L AGRICULTEUR FOU',
                    shot: 'shot_fork', revTime: 0.5, stallTime: 1.5, forkEvery: 0.45,
                    skyEvery: 2.0, skyDelay: 0.6, skyMinDist: 150 },
    // niveau2 (Appart) — Francois le proprio
    proprietaire: { sprite: 'boss_proprietaire_move', attackSprite: 'boss_proprietaire_atk', behavior: 'charger',   hp: 24, maxHp: 24, touchDamage: 2, shotEvery: 1.35, shotSpeed: 255, speed: 55, range: 300, dashSpeed: 480, score: 1300, name: 'FRANCOIS LE PROPRIO',
                    shot: 'shot_stake', windTime: 0.7, dashTime: 0.9, staggerTime: 1.2, throwTime: 0.5 },
    // niveau3 (Serre) — RStudio
    rstudio:      { sprite: 'boss_rstudio_move',      attackSprite: 'boss_rstudio_atk',      behavior: 'errors',    hp: 30, maxHp: 30, touchDamage: 2, shotEvery: 1.2, shotSpeed: 280, speed: 60, range: 280, dashSpeed: 0,   score: 1700, name: 'RSTUDIO',
                    shot: 'shot_error', attackTime: 4, loadTime: 2 },
    // niveau4 (Labo) — Michael le directeur de these
    michael:      { sprite: 'boss_michael_move',      attackSprite: 'boss_michael_atk',      behavior: 'modeles',   hp: 38, maxHp: 38, touchDamage: 2, shotEvery: 1.05, shotSpeed: 300, speed: 80, range: 300, dashSpeed: 0,   score: 2100, name: 'MICHAEL LE DIRECTEUR',
                    shot: 'shot_chart', aimTime: 0.6, recalcTime: 1.0, waveCount: 6 },
    // niveau5 (Universite) — LE PLUS DUR DES 5
    cendrine:     { sprite: 'boss_cendrine_move',     attackSprite: 'boss_cendrine_atk',     behavior: 'paperasse', hp: 46, maxHp: 46, touchDamage: 2, shotEvery: 0.9, shotSpeed: 330, speed: 90, range: 320, dashSpeed: 0,   score: 2600, name: 'CENDRINE LA RESPONSABLE',
                    shot: 'shot_form', preTime: 0.4, throwTime: 0.3, windowTime: 1.2 },
    // FINAL — megaboss multi-phases
    jury:         { sprite: 'boss_jury_move',         attackSprite: 'boss_jury_atk',         behavior: 'jury',      hp: 64, maxHp: 64, touchDamage: 3, shotEvery: 0.9, shotSpeed: 340, speed: 75, range: 320, dashSpeed: 0,   score: 5000, name: 'LE JURY DE THESE', shot: 'shot_gavel', scale: 1.32 },
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
    // POWERUPS D'ARME : changent le tir de base (p.weapon). Placement dans les maps
    //  + sprites pickup_* a venir (passe level design / art) ; fallback propre si absent.
    arme_spread: { sprite: 'pickup_spread', score: 60, weapon: 'spread' },   // tir en eventail
    arme_pierce: { sprite: 'pickup_pierce', score: 60, weapon: 'pierce' },   // tir percant
    arme_bombe:  { sprite: 'pickup_bombe',  score: 60, weapon: 'bombe'  },   // tir explosif
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
    //  ROLLERS : saute + haut, vitesse NORMALE.   VELO : + rapide, saut NORMAL.
    //  POWERUP POSITIF : on GARDE le tir / lob / dash / chat ; perdu si Laura est
    //  touchee (l'equipement encaisse le coup a la place d'un coeur). Le tir se
    //  joue depuis la pose de roule (pas de frame de lancer dediee -> fallback).
    rollers: {
      override: { idle: 'hero_roll', run: 'hero_roll', jump: 'hero_roll' },
      speedMul: 1.0, jumpMul: 1.4, msg: 'ROLLERS !  saute + haut',
    },
    velo: {
      override: { idle: 'hero_bike', run: 'hero_bike', jump: 'hero_bike' },
      speedMul: 1.7, jumpMul: 1.0, msg: 'VELO !  + rapide',
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
    hero_cat_out:     { sliceX: 5, sliceY: 1, anims: { cat:   { from: 0, to: 4, loop: false, speed: 12 } } },
    hero_cat_in:      { sliceX: 4, sliceY: 1, anims: { cat:   { from: 0, to: 3, loop: false, speed: 12 } } },
    // une anim de lancer par arme (mappee depuis ammoTypes[].throwSprite) :
    //  graine -> hero_throw_seed (tir de base) ; gateau -> hero_throw_cake (lob).
    hero_throw:       { sliceX: 6, sliceY: 1, anims: { throw: { from: 0, to: 5, loop: false, speed: 18 } } },
    hero_throw_seed:  { sliceX: 6, sliceY: 1, anims: { throw: { from: 0, to: 5, loop: false, speed: 18 } } },
    hero_throw_cake:  { sliceX: 8, sliceY: 1, anims: { throw: { from: 0, to: 7, loop: false, speed: 18 } } },
    // sprites complets "Laura sur l'engin" (remplacent le sprite via equipment.override)
    hero_bike:        { sliceX: 7, sliceY: 1, anims: { idle: { from: 0, to: 6, loop: true, speed: 6 }, run: { from: 0, to: 6, loop: true, speed: 14 }, jump: { from: 3, to: 3 } } },
    hero_roll:        { sliceX: 8, sliceY: 1, anims: { idle: { from: 0, to: 7, loop: true, speed: 6 }, run: { from: 0, to: 7, loop: true, speed: 16 }, jump: { from: 4, to: 4 } } },
    cat_run:          { sliceX: 8, sliceY: 1, anims: { run:   { from: 0, to: 7, loop: true,  speed: 16 } } },
    enemy_corbeau:    { sliceX: 6, sliceY: 1, anims: { fly:   { from: 0, to: 5, loop: true,  speed: 8  } } },
    enemy_criquet:    { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 10 }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 14 } } },
    // --- Boss : DEUX feuilles par boss (cf. tools/gen_boss_sheets.py) ---
    //  _move : DEPLACEMENT — frames 0-2 = cycle de marche (idle), frame 3 = touche (hurt)
    //  _atk  : ATTAQUE     — frames 0-3 = charge -> frappe -> retour (attack)
    //  game.js bascule sur la feuille _atk uniquement quand animWant === 'attack'.
    boss_proprietaire_move: { sliceX: 6, sliceY: 1, anims: { idle: { from: 0, to: 4, loop: true, speed: 7 }, hurt: { from: 5, to: 5 } } },
    boss_proprietaire_atk:  { sliceX: 6, sliceY: 1, anims: { attack: { from: 0, to: 5, loop: true, speed: 10 } } },
    boss_agriculteur_move:  { sliceX: 6, sliceY: 1, anims: { idle: { from: 0, to: 4, loop: true, speed: 7 }, hurt: { from: 5, to: 5 } } },
    boss_agriculteur_atk:   { sliceX: 6, sliceY: 1, anims: { attack: { from: 0, to: 5, loop: true, speed: 10 } } },
    boss_michael_move:      { sliceX: 6, sliceY: 1, anims: { idle: { from: 0, to: 4, loop: true, speed: 7 }, hurt: { from: 5, to: 5 } } },
    boss_michael_atk:       { sliceX: 6, sliceY: 1, anims: { attack: { from: 0, to: 5, loop: true, speed: 10 } } },
    boss_rstudio_move:      { sliceX: 6, sliceY: 1, anims: { idle: { from: 0, to: 4, loop: true, speed: 7 }, hurt: { from: 5, to: 5 } } },
    boss_rstudio_atk:       { sliceX: 6, sliceY: 1, anims: { attack: { from: 0, to: 5, loop: true, speed: 10 } } },
    boss_cendrine_move:     { sliceX: 6, sliceY: 1, anims: { idle: { from: 0, to: 4, loop: true, speed: 7 }, hurt: { from: 5, to: 5 } } },
    boss_cendrine_atk:      { sliceX: 6, sliceY: 1, anims: { attack: { from: 0, to: 5, loop: true, speed: 10 } } },
    boss_jury_move:         { sliceX: 6, sliceY: 1, anims: { idle: { from: 0, to: 4, loop: true, speed: 7 }, hurt: { from: 5, to: 5 } } },
    boss_jury_atk:          { sliceX: 6, sliceY: 1, anims: { attack: { from: 0, to: 5, loop: true, speed: 10 } } },

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
    pickup_pilule:    { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },   // skin 'd'/'p' (Appart / Arene)
    pickup_champignon:{ sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },   // skin 'p' (Arene)
    // --- Munitions (6 frames : tournent) ---
    ammo_graine:      { sliceX: 6, anims: { spin: { from: 0, to: 5, loop: true, speed: 16 } } },
    ammo_gateau:      { sliceX: 6, anims: { spin: { from: 0, to: 5, loop: true, speed: 16 } } },
    // --- Monstres "historiques" REGENERES en feuille 6 frames (comme les neufs) :
    //  walk 0-2 / hurt 3 / attack 4-5. caillou est un OBSTACLE (addRock) : il joue
    //  juste 'walk' (1er clip). criquet utilise 'walk' (l'ancien 'hop' est retire).
    enemy_caillou:    { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 3 }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 8  } } },
    enemy_camion:     { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 8 }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 10 } } },
    enemy_assureur:   { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 9 }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 12 } } },
    enemy_ademe:      { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 7 }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 10 } } },
    // --- Nouveaux monstres : feuille 6 frames (walk 0-2 / hurt 3 / attack 4-5) ---
    //  game.js pilote l'etat via e.animWant (cf. enemyAnim, mirroir leger des boss).
    enemy_moustique:    { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 12 }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 14 } } },
    enemy_abeille:      { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 12 }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 14 } } },
    enemy_cafard:       { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 12 }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 14 } } },
    enemy_transpalette: { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 8  }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 10 } } },
    enemy_livreur:      { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 8  }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 10 } } },
    enemy_coursier:     { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 8  }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 10 } } },
    enemy_imprimante:   { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 6  }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 10 } } },
    enemy_chips:        { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 6  }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 10 } } },
    enemy_tuyau:        { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 6  }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 10 } } },
    enemy_sac:          { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 5  }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 10 } } },
    enemy_fontaine:     { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 5  }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 10 } } },
    enemy_dossiers:     { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 5  }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 10 } } },
    // --- Decor / FX / UI ---
    // bg_cloud = grille 4x3 (12 nuages) SANS clip d'anim : sliceX/sliceY decoupent
    //  la planche en 12 frames et addScatterLayer en tire une au hasard par nuage.
    bg_cloud:         { sliceX: 4, sliceY: 3 },
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
    jump:       ['up', 'z', 'w'],   // saute (relacher tot = petit saut, cf. onKeysRelease)
    crouch:     ['down'],        // s'accroupir (au sol) : SEUL usage de BAS, hitbox reduite
    shoot:      ['space'],       // tir de base (graine) avec ESPACE
    lob:        ['x'],           // lob lourd (gateau) auto-vise
    cat:        ['c'],           // chat (instantane)
    dash:       ['shift'],       // dash (ruee + i-frames), libere par le retrait du switch d'arme
    quit:       ['escape'],      // quitter le niveau -> carte
  },

  // --- Audio ----------------------------------------------------------
  audio: { enabled: true, volume: 0.5 },

  // --- Mobile / tactile (web, pas de natif) ---------------------------
  //  La manette tactile (js/mobile.js) s'active TOUTE SEULE sur ecran tactile
  //  (pointeur grossier). Override d'URL : ?touch=1 force / ?touch=0 desactive.
  //   enabled   : false => jamais de manette (clavier partout).
  //   assistAim : le lob lourd (gateau) auto-vise l'ennemi le plus proche
  //               (bouton LOB, pas de visee manuelle au doigt).
  //   opacity   : opacite des boutons au repos (0..1).
  //   size      : diametre (px) du gros bouton ; les autres en derivent.
  mobile: { enabled: true, assistAim: true, opacity: 0.34, size: 74 },

  // --- Triche / test (mets cheats:false pour la version cadeau) -------
  //  En jeu : 1-6 = aller au niveau, 0 = finir le niveau, G = dieu, H = plein.
  cheats: true,

  // --- Enchainement des niveaux (cles dans LEVELS) --------------------
  levels: ['niveau1', 'niveau2', 'niveau3', 'niveau4', 'niveau5', 'jury'],

  // --- Carte du monde (overworld facon Dora) --------------------------
  //  Un noeud par niveau. y = altitude du noeud sur la carte.
  world: {
    nodes: [
      { key: 'niveau1', x: 130, y: 360, label: 'INTRODUCTION', boss: 'AGRI' },
      { key: 'niveau2', x: 290, y: 300, label: 'CHAPITRE 1', boss: 'PROPRIO' },
      { key: 'niveau3', x: 450, y: 360, label: 'CHAPITRE 2', boss: 'RSTUDIO' },
      { key: 'niveau4', x: 610, y: 290, label: 'CHAPITRE 3', boss: 'MICHAEL' },
      { key: 'niveau5', x: 770, y: 350, label: 'CONCLUSION', boss: 'CENDRINE' },
      { key: 'jury',    x: 880, y: 250, label: 'JURY', boss: 'JURY' },
    ],
  },

  // --- Scenario / textes ----------------------------------------------
  story: {
    title:    'LAURA L\'EXPLORATRICE',
    subtitle: 'La Quête du Riz Agrivoltaique',
    intro:    'Laura fait sa thèse sur le riz sous panneaux solaires.\n' +
              'Des rizières à la colloc, de la serre au labo puis à la fac,\n' +
              'jusqu à la soutenance : bats chaque boss pour écrire ta thèse !',
    hint:     'Gauche/Droite ou Q/D bouger   HAUT sauter (relache tot = petit saut)\n' +
              'ESPACE tir de base   X lob lourd   MAJ dash   C chat   ESC quitter',
    start:    'Appuie sur ESPACE pour commencer',
    slots:    'CHOISIS TA SAUVEGARDE',
    overworld:'Choisis un chapitre (ESPACE pour entrer)',
    chapterDone: 'CHAPITRE ECRIT !',
    win:      'SOUTENANCE REUSSIE !  Felicitations Docteure Laura !',
    lose:     'Aie... reprends des forces et recommence !',
    retry:    'ESPACE pour continuer',
    bossWarn: 'Bats le boss pour écrire le chapitre !',
    catEmpty: 'Plus de chat ! (ramasse des croquettes)',
    publi:    'PUBLICATION TROUVEE ! +100%',
    // texte affiche a l'ecran "Chapitre gagne" (sans accents).
    //  Ordre = LEVELS niveau1..niveau5 (intro, ch.1, ch.2, ch.3, conclusion).
    chapters: [
      'INTRODUCTION : Installation de la manip.\nRizières : l agriculteur fou se calme, la manip est posée et les premières données récoltées !',
      'CHAPITRE 1 : Installation de la colloc.\nAppart : François le proprio cède, la colloc est installée et la biblio épluchée !',
      'CHAPITRE 2 : Résultats.\nEn serre, RStudio cesse de planter : la manip de précision tourne, données récoltées !',
      'CHAPITRE 3 : Rédaction des publis.\nAu labo, Michael le directeur valide : les résultats sont analysés et les publis rédigées !',
      'CONCLUSION : Rédaction de la thèse.\nÀ l université, Cendrine tamponne : la thèse est rédigée et les démarches faites !',
    ],
  },
};

// --- Anims des PASSANTS generes --------------------------------------------
//  Les 8 corps body_<biome>_<sexe> partagent la MEME grille (feuille de marche
//  de 4 frames). On injecte l'anim 'walk' pour les 8 d'un coup (DRY) plutot que
//  8 blocs identiques dans CONFIG.anims. Les tetes head_npc_<sexe>_<n> sont des
//  feuilles de 3 frames [yeux ouverts, blink, yeux ouverts] ; baseName() retire
//  le numero final, donc head_npc_f_1..17 et head_npc_h_1..21 heritent des
//  anims head_npc_f_ / head_npc_h_.
['champ', 'pote', 'horti', 'labo', 'bureau'].forEach((biome) => ['h', 'f'].forEach((sexe) => {
  window.CONFIG.anims['body_' + biome + '_' + sexe] = {
    sliceX: 4, sliceY: 1, anims: { walk: { from: 0, to: 3, loop: true, speed: 7 } },
  };
}));
['h', 'f'].forEach((sexe) => {
  window.CONFIG.anims['head_npc_' + sexe + '_'] = {
    sliceX: 3, sliceY: 1, anims: { blink: { from: 0, to: 2, loop: true, speed: 2 } },
  };
});
// Corps APPLAUDISSEURS du cortege de victoire (meme grille 4 frames que les
//  passants ; habits gris recolores a la volee). Cf. _clapgen/ et scene('win').
['h', 'f'].forEach((sexe) => {
  window.CONFIG.anims['body_clap_' + sexe] = {
    sliceX: 4, sliceY: 1, anims: { clap: { from: 0, to: 3, loop: true, speed: 9 } },
  };
});
