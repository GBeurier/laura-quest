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
  // Zoom d'AFFICHAGE sur desktop (1 = taille native 960x528 CSS px ; 1.4 = +40%).
  //  Applique en CSS (transform centree) sur le canvas APRES kaplay() -> n'affecte
  //  NI la resolution interne NI le gameplay (camera/HUD/collisions inchanges),
  //  c'est juste un agrandissement de l'image. Ignore sur mobile (le canvas y est
  //  deja en letterbox+stretch plein ecran, cf. js/mobile.js).
  desktopZoom: 1.4,
  // Decalage VERTICAL du monde, en PIXELS : on descend tout le jeu de
  //  `groundDrop` px (sol + bas, + de ciel, collines/montagnes du parallax
  //  remontees avec l'horizon). 0 = monde centre comme a l'origine.
  //  Le HUD (bandeau dans la bande de terre, buildHUD de js/game.js) suit
  //  groundDrop automatiquement ; au-dela de ~16 sa 2e ligne sort de l'ecran.
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

  // --- Bombes qui tombent (boss tracteur / michael / jury) -------------
  //  Un projectile descend pendant le telegraphe (ombre fx_bomb_shadow qui
  //  grandit au SOL/sur le PANNEAU vise) puis EXPLOSE au PREMIER impact :
  //  bloquee par le 1er solide de la colonne (sol '=', panneau '-'/'x',
  //  caillou '^') -> se planquer SOUS un panneau protege. Le souffle tue les
  //  monstres dans blast et blesse Laura. size = facteur de taille du sprite.
  bombs: { size: 0.6, fallFrom: 320, blast: 64, damage: 2 },

  // --- Vehicule d'arrivee (camionnette CIRAD) -------------------------
  //  Sprite statique pose AU PREMIER PLAN au depart de CHAQUE niveau : le
  //  vehicule dans lequel Laura arrive. La camionnette regarde a DROITE (cabine
  //  a droite du sprite, arriere a gauche) ; on cale son AVANT peint `clearance`
  //  px a gauche du centre de Laura -> elle reste toujours degagee (le spawn
  //  varie : col 2 au jury, col 3 ailleurs), et l'arriere part loin hors-champ
  //  a gauche. Objet du MONDE (pas fixed) -> il defile et sort de l'ecran quand
  //  Laura avance. `z` au-dessus du joueur (premier plan). `scale` retaille la
  //  camionnette (1 = taille brute du PNG, enorme ; 0.55 ~ 2.1x la taille de
  //  Laura). `clearance` = ecart en px entre l'avant peint et le centre de Laura
  //  (plus petit = plus de camionnette visible mais plus pres d'elle). `nudgeX`
  //  (+ = droite) et `sink` (+ = bas) = decalages MANUELS en plus (le calage au
  //  sol est deja auto via le pad transparent du PNG).
  startVehicle: { enabled: true, sprite: 'bg_startlevel', scale: 0.55, clearance: 42, z: 40, nudgeX: 70, sink: 65 },

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
    //  - sizeScale : facteur d'echelle des 4 tailles de PNJ (petit/moyen/grand/
    //             tresGrand). QUELLE personne a quelle taille = registre js/npc.js
    //             (window.NPC, lettre `taille` P/M/G/TG par tete). ATTENTION : SEUL
    //             LE CORPS change de taille -> la TETE garde toujours la meme taille
    //             (les grands/petits ont juste un corps plus/moins grand, cf.
    //             attachHead qui compense le scale du parent). C'est voulu : pas de
    //             grosse tete sur grand corps.
    //  - headScale   : taille de la tete (constante, independante de la taille du corps).
    //  - headLocal   : position de la tete dans le repere du CORPS (px @ART,
    //             ancre tete = 'bot' -> c'est le point du COU ; la tete pousse
    //             vers le haut). headBob = amplitude du dodelinement (px ecran),
    //             headRot = amplitude du balancement (degres).
    //  Tout asset absent est ignore -> retombe sur la base / pas de tete.
    passant: {
      femaleRatio: 23 / 49,
      headScale: 0.9,
      headLocal: [0, -90], headBob: 1, headRot: 3,
      //  - deadHeadDrop / deadHeadScale : CADAVRE. Quand le passant tombe, le corps
      //    s'affale (sprite <body>_dead) -> le cou descend. On fait DESCENDRE la
      //    tete zombie (drop = px @ART ajoutes au cou, repere corps -> suit la
      //    taille du corps) pour qu'elle TOUCHE le corps, et on la RETRECIT un peu
      //    (scale, multiplie la taille de tete) pour epouser la perspective affalee.
      deadHeadDrop: 34, deadHeadScale: 0.85,
      //  - bubble : BULLES BD (phrases perso du registre js/npc.js -> cle
      //    `phrases`). De temps en temps UN PNJ visible "parle" : bulle BD
      //    au-dessus de sa tete avec une de ses phrases au hasard. UNE bulle
      //    a la fois + pause aleatoire gapMin..gapMax (secondes) entre deux
      //    -> volontairement RARE. dur = duree d'affichage (s). Au JURY la
      //    pause est multipliee par juryGapMult (la scene est bondee -> encore
      //    plus rare pour ne pas saturer). `font` = pile de fonts TTF embarquees
      //    (assets/fonts/, repli par glyphe : latin -> Comic Neue, khmer -> Noto)
      //    -> les phrases s'affichent AVEC leurs accents ; si aucune n'est
      //    chargee, repli font bitmap + accents translitteres.
      //    centerFrac = un PNJ ne parle que s'il est vers le MILIEU de l'ecran
      //    (a +/- centerFrac * largeur du centre camera) — sinon la bulle
      //    apparaissait clampee au bord AVANT que son PNJ entre dans le cadre.
      //    cf. npcBubble() dans game.js.
      bubble: { gapMin: 9, gapMax: 20, dur: 4, juryGapMult: 2.5, centerFrac: 0.3,
                font: 'font_bubble,font_bubble_kh' },
      bodies: { h: ['body_champ_h'], f: ['body_champ_f'] },
      // pool partage COMPLET (26 h / 23 f embarques, cf. CLAUDE.md PNJ) : la
      //  liste 21/17 d'avant datait d'un lot precedent -> 9 collegues manquaient
      //  au cortege de victoire (scene win, qui lit CE pool par defaut).
      heads:  { h: Array.from({ length: 26 }, (_, i) => 'head_npc_h_' + (i + 1)),
                f: Array.from({ length: 23 }, (_, i) => 'head_npc_f_' + (i + 1)) },
      sizeScale: { petit: 1, moyen: 1.14, grand: 1.28, tresGrand: 1.42 },
      // La TAILLE de chaque personne (lettre P/M/G/TG) vit desormais dans le
      //  REGISTRE des PNJ -> js/npc.js (window.NPC, une entree par tete). Ici on
      //  ne garde que le FACTEUR d'echelle de chaque lettre (sizeScale, tuning
      //  global). cf. CLAUDE.md (PNJ) et passantSize() dans game.js.
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
    maxHp: 4,             // v2 : 4 coeurs (le bouclier soleil encaisse devant, cf. GAMEPLAY.md §2)
    invulnTime: 1.1,
    startAmmo: 'graine',  // tir de base
    knockback: 300,       // recul quand Laura touche un monstre / un tir
    knockTime: 0.22,      // duree du recul
    heavyKnockMul: 1.6,   // multiplicateur du recul sur un coup LOURD (contact boss, ejecte de sous les roues)
    // DASH : ruee horizontale courte avec i-frames (esquive). GRATUIT (cf.
    //  GAMEPLAY.md : le deplacement ne taxe pas l'energie), simple cooldown.
    //  Direction = sens courant de Laura. cost=0 -> jamais bloque.
    dash: { speed: 560, duration: 0.16, cooldown: 0.5, cost: 0, iframes: 0.22 },
    // Accroupissement : la planche hero_duck est "scrubbee" selon la progression.
    //  duckDown = temps pour se baisser a fond (rapide, anim jouee a l'endroit) ;
    //  duckUp   = temps pour rejouer l'anim a l'envers et se relever.
    duckDown: 0.12,
    duckUp: 0.12,
    // CALQUE D'ACTION (lancer / chat superpose au-dessus de Laura, cf. SPRITES.md "rig").
    //  Sur rollers/a pied, un sprite act_* (bras qui lance / lance le chat) est pose
    //  EXACTEMENT sur Laura (meme pos/ancre/echelle). actionOffset = petit decalage
    //  [x,y] px optionnel si une base assoit Laura differemment (defaut: aucun).
    actionOffset: [0, 0],
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

  // Munitions de BASE (sprite/vitesse/anim de lancer). Le LEVELING (nb de graines,
  //  taille d'explosion, cadence, cout) vit dans CONFIG.arsenal ; ici on ne garde
  //  que les 2 munitions reellement tirees : graine (droit) + gateau (cloche AoE).
  //  traj : 'straight' (tout droit) ou 'arc' (en cloche). cost/damage/aoe sont
  //  surcharges par arsenal au moment du tir (cf. fireBase / lobShoot dans game.js).
  ammoTypes: {
    // throwSprite : les feuilles dediees hero_throw_seed/cake ont ete retirees
    //  des assets -> les deux armes utilisent la pose de lancer generique.
    graine:   { sprite: 'ammo_graine', label: 'GRAINES', damage: 1, speed: 620, cost: 0,  traj: 'straight', throwSprite: 'hero_throw' },
    gateau:   { sprite: 'ammo_gateau', label: 'GATEAUX', damage: 3, speed: 520, cost: 0,  traj: 'arc',      throwSprite: 'hero_throw', aoe: { radius: 94, damage: 3 } },
  },

  // --- Chat angora (allie deploye) ------------------------------------
  //  ALLER-RETOUR : Laura le pose au sol juste devant elle (anim hero_cat_out),
  //  il court vers l'avant en nettoyant tout (ennemis + tirs), fait demi-tour a
  //  'range', revient vers Laura et disparait en la touchant (poof).
  cat: {
    sprite: 'cat_run',
    speed: 560,       // vitesse de course du chat
    range: 560,       // distance parcourue avant le demi-tour
    scale: 0.62,      // taille du chat (1 = taille du sprite) -> plus petit que Laura
    spawnAhead: 42,   // distance devant Laura ou le chat est pose au sol
    catchDist: 26,    // distance a Laura ou le chat est "rattrape" (disparait) au retour
    // ALLER-RETOUR (cf. deployCat) : le chat blesse a l'ALLER **puis** au RETOUR.
    //  A l'aller il ne fait que outMul x les degats (l'ennemi survit, affaibli) ;
    //  au RETOUR il fait les degats PLEINS (= il l'acheve). Sur un BOSS il frappe
    //  AUX DEUX passages -> ~2x bossDamage par chat ("2x plus sur les boss").
    damage: 4,        // degats PLEINS vs ennemis ordinaires (passage RETOUR)
    outMul: 0.5,      // multiplicateur des degats a l'ALLER (0.5 = moitie ; 1 = aller = retour)
    bossDamage: 6,    // degats vs boss PAR PASSAGE, INSENSIBLES a la garde (cf. hitBoss) -> aller + retour = 2x par chat
    // v2 : le chat est l'OUVRE-BOITE des boss — le toucher OUVRE une fenetre de
    //  vulnerabilite (vulnOpen s, degats x1 au lieu de la garde), rouvrable au
    //  plus tot vulnRelock s plus tard sur le meme boss. cf. hitBoss/deployCat.
    vulnOpen: 1.5,    // duree de la fenetre ouverte par le chat (s)
    vulnRelock: 8,    // delai mini entre deux ouvertures sur le meme boss (s)
    cleanRadius: 46,  // rayon de nettoyage des tirs ennemis
    maxCharges: 3,    // reserve de chats (arcade)
    startCharges: 2,
    chargeTime: 0,    // chat INSTANTANE (plus de maintien) : deploiement a la pression de C
    regenTime: 40,    // RECHARGE AUTO : une charge revient seule toutes les 40s (jamais bloquee a 0).
    //                   Les croquettes ('k', pickup_croquette) donnent EN PLUS un +1 instantane.
    tossTime: 0.4,    // duree de la pose "lance le chat" avant que Laura reprenne ses anims normales
    //  Laura n'est PLUS figee pendant que le chat court : il part, fait son aller-retour
    //  tout seul, et Laura continue de bouger / tirer / sauter (cf. calque d'action, SPRITES.md).
  },

  // --- Jauge "Soleil" = ENERGIE / STAMINA -----------------------------
  //  Laura EST un panneau solaire : la jauge se RECHARGE toute seule au
  //  soleil (regen), mais PAS a l'ombre d'un panneau (regenShade). Tirer
  //  le lob lourd COUTE de l'energie. Les rayons 'o' = bonus instant.
  //  (La MORALITE ne touche plus cette jauge : elle est passee sur le TIER.)
  sun: {
    enabled: true,
    max: 100,
    regen: 18,            // recharge/s EN PLEIN SOLEIL (photosynthese) -> genereuse mais plus gratuite (v2)
    regenShade: 0,        // recharge/s A L'OMBRE sous un panneau ('-'/'x') -> 0 = zone de tension
    rayGain: 30,          // bonus instantane d'un rayon 'o' ramasse (EXEMPTE du hitRegenDelay)
    // SURBOUCLIER v2 (cf. GAMEPLAY.md §2) : un coup n'est absorbe que si
    //  sun >= hitAbsorb (en dessous, le soleil est CONSERVE — c'est de la
    //  munition — mais ne protege plus : equipement puis coeur encaissent).
    //  v2.2 : apres TOUTE blessure (absorbee, equipement ou coeur), la regen
    //  PASSIVE est coupee hitRegenDelay s ("bouclier brise", jauge grisee +
    //  cran HUD a hitAbsorb) -> pas de spam defensif au bouclier ; les rayons
    //  'o' creditent toujours pendant le lock. cf. damagePlayer.
    hitAbsorb: 40,        // soleil draine par coup absorbe (= aussi le SEUIL mini pour proteger)
    hitRegenDelay: 2,     // s sans regen passive apres une blessure (v2.2, anti spam bouclier).
                          //  0 = autoregen continue. C'EST le reglage de la duree -> ajuste ici.
    bossTouchPierces: true, // v2.2 : le CONTACT d'un boss (ecrasement) TRAVERSE le surbouclier —
                          //  il draine hitAbsorb ET blesse quand meme (equipement/coeurs, recul
                          //  renforce). false = retour a l'absorption totale. cf. damagePlayer.
    bossDropEvery: 9,     // rayons plus RARES pendant un boss (le passif fait le gros)
  },

  // --- ARSENAL : 2 armes x 2 axes (cf. GAMEPLAY.md) -------------------
  //  Remplace l'ancien systeme TIER. Les DEUX armes (graines ESPACE / patisseries
  //  X) partagent UN SEUL niveau de PUISSANCE et UN SEUL de CADENCE. Ils montent
  //  via pickups (pickup_puissance / pickup_cadence, caracteres 'e'/'i' dans les
  //  maps), plafonnent a max, et RESET a chaque niveau (PLAYER recree par scene).
  //   - PUISSANCE = force : nb de graines (1->3->5) + taille des explosions de
  //     patisserie (cookie->gateau->gateau des enfers).
  //   - CADENCE   = vitesse de tir (delai graines / cooldown du lob).
  arsenal: {
    power: { max: 3, start: 1 },
    rate:  { max: 3, start: 1 },
    // GRAINES (ESPACE, GRATUIT). levels[power-1] : pellets/spread/damage/flame/pierce.
    //  P3 = 5 graines ENFLAMMEES (flame) et TRANSPERCANTES (pierce).
    graines: {
      speed: 620,
      cadence: [0.40, 0.30, 0.20],                                   // delai entre tirs par niveau de CADENCE (rallonge v3 : tir de base + upgrades moins spammables)
      bossTick: [1, 2, 3],                                           // degat d'UN TICK vs BOSS par niveau de PUISSANCE (cf. CONFIG.bossHit)
      levels: [
        { pellets: 1, spread: 0,    damage: 1, flame: false, pierce: 0 },
        { pellets: 3, spread: 0.17, damage: 1, flame: false, pierce: 0 },
        { pellets: 5, spread: 0.28, damage: 1, flame: true,  pierce: 1 },   // v3 : P3 ne one-shot plus les mobs (degat 2->1, pierce 2->1)
      ],
    },
    // PATISSERIES (X, COUTE DU SOLEIL). levels[power-1] : sprite/scale/radius (AoE)
    //  /damage/cost(soleil)/secondary(mini-explosions du "gateau des enfers").
    patisseries: {
      speed: 520,
      cadence: [0.88, 0.70, 0.55],                                   // cooldown du lob par niveau de CADENCE (rallonge v3)
      levels: [
        { sprite: 'ammo_cookie',       scale: 0.95, radius: 60,  damage: 1, cost: 30, secondary: 0 },
        { sprite: 'ammo_gateau',       scale: 1.0,  radius: 96,  damage: 2, cost: 45, secondary: 0 },
        { sprite: 'ammo_gateau_enfer', scale: 1.1,  radius: 132, damage: 3, cost: 48, secondary: 4, enfers: true },   // v3 : degats AoE baisses (cookie 2->1, gateau 3->2, enfer 4->3)
      ],
    },
  },

  // --- Degats VS BOSS : ticks par canal + garde (v2, cf. GAMEPLAY.md §4.1) ---
  //  Un boss n'encaisse qu'UN coup de graines tous les seedCd s (une volee de 5
  //  compte pour 1 ; degat du tick = arsenal.graines.bossTick[puissance-1]) et
  //  qu'UNE explosion de patisserie tous les aoeCd s (degat AoE plein). Hors
  //  fenetre de punition tout est multiplie par bosses.<x>.guard ; pendant une
  //  fenetre (etat IA, b.vulnT du chat, b.openT post-salve) le multiplicateur
  //  passe a 1 et le boss est surligne dore. cf. hitBoss (game.js).
  bossHit: { seedCd: 0.25, aoeCd: 0.5 },

  // --- Checkpoint d'arene (v2) : mourir PENDANT un boss resparne a l'entree
  //  de l'arene (vie pleine, boss reset, chrono qui continue, K.O. rouge).
  //  DESACTIVE (demande playtest) pour TOUS les niveaux + jury : mourir au
  //  boss = ecran lose / retour carte, comme partout. Le mecanisme reste
  //  cable (respawnAtArena, game.js) -> repasser a true pour le reactiver.
  bossCheckpoint: false,

  // --- Onde de choc au sol (seisme LOCALISE des boss, cf. api.quake) --------
  //  Remplace les tremblements d'ecran de telegraphe (Todo "virer les
  //  tremblements") : vague de poussiere qui parcourt le sol et blesse le
  //  joueur s'il est AU SOL sur son passage (sauter / dasher l'evite).
  quake: { speed: 300, damage: 1, width: 26 },

  // --- Sols pieges ('%') : FOSSE A DEGAT encastree dans le sol (perspective),
  //  blesse au CONTACT en passant dessus (le sol reste solide -> on ne tombe pas).
  //  Skin par biome via LEVELS[x].theme.hazard : EXTERIEUR 'hazard_paddy' (piques
  //  de bambou dans l'eau, riziere) / INTERIEUR 'hazard_acid' (acide renverse).
  //  Le DASH (i-frames) permet de traverser. Dans les maps : le caractere '%'.
  //  Rendu/collision : spawnHazard (game.js) ; art : _hazardgen/ + placeholders
  //  tools/gen_hazard_placeholders.py. Spec sprite : SPRITES.md.
  hazards: { touchDamage: 1 },

  // --- Ennemis (modeles) ----------------------------------------------
  //  move: 'static' | 'patrol' | 'chase' | 'shooter' | 'fly' | 'jump'
  enemies: {
    // NB: 'caillou' n'est plus un ennemi -> c'est un OBSTACLE solide sans degat
    //     (cf. addRock dans game.js ; pose par '^' dans la map + auto aux 2 bords).
    camion:   { sprite: 'enemy_camion',   hp: 6,        touchDamage: 2, move: 'patrol',  speed: 130, range: 130, aggro: 460, score: 250, hit: { w: 0.86, h: 0.84 } },
    assureur: { sprite: 'enemy_assureur', hp: 2,        touchDamage: 1, move: 'chase',   speed: 80,  range: 110, aggro: 380, score: 150, hit: { w: 0.88, h: 0.83 } },
    //  shot : sprite du PROJECTILE du tireur (cf. enemyBullet). Chaque tireur a
    //  le sien, assorti a son geste d'attaque (l'ancien defaut unique shot_paper
    //  — un avion en papier — collait mal a un sachet de chips ou un tuyau).
    ademe:    { sprite: 'enemy_ademe',    hp: 3,        touchDamage: 1, move: 'shooter', shotEvery: 2.2, range: 460, shotSpeed: 240, score: 200, shot: 'shot_courrier', hit: { w: 0.72, h: 0.82 } },
    // nouveaux archetypes (variete / difficulte)
    corbeau:  { sprite: 'enemy_corbeau',  hp: 2,        touchDamage: 1, move: 'fly',     speed: 95,  range: 150, amp: 34, anim: 'fly', score: 180, scale: 0.32, hit: { w: 0.90, h: 0.95 } },
    //  criquet : feuille re-griddee en cellule LARGE 302px (regrid.py, frames de
    //  saut etirees a la meme echelle que la marche) -> hit.w re-derive (0.92*176/302).
    criquet:  { sprite: 'enemy_criquet',  hp: 1,        touchDamage: 1, move: 'jump',    speed: 150, jumpForce: 560, jumpEvery: 1.1, aggro: 520, scale: 0.6, anim: 'walk', score: 140, hit: { w: 0.54, h: 0.82 } },

    // --- NOUVEAUX ARCHETYPES (design definitif) ------------------------
    //  6 familles par niveau : IMMOBILE (static) / VEHICULE (patrol) / VOLANT
    //  (fly) / SOL (chase) / TIR (shooter) / RANDOM (passant). Chaque feuille
    //  enemy_<kind> = 6 frames (walk 0-2 / hurt 3 / attack 4-5, cf. anims).
    //  scale = taille a l'ecran (humanoide/engin ~1 ; petits insectes < 0.5).
    //  hit = boite de COLLISION en FRACTION de la frame, mesuree sur le DESSIN
    //   reel des frames de marche (cf. analyse des PNG). { w, h } : largeur et
    //   hauteur ; la boite reste CENTREE (insensible au flip) et son BAS reste
    //   cale au bas de la frame (= sol, pas de changement de physique). A defaut
    //   spawnEnemy retombe sur 0.85x0.9. C'est surtout vital pour les GROS
    //   sprites (immobiles, tourelles, vehicules) dont le sujet ne remplit pas la
    //   frame : sans ca on se prenait des degats / on butait dans le vide.
    //  VOLANT
    moustique:    { sprite: 'enemy_moustique',    hp: 1, touchDamage: 1, move: 'fly',     speed: 120, range: 160, amp: 42, anim: 'walk', score: 120, scale: 0.45, hit: { w: 0.90, h: 0.92 } },
    abeille:      { sprite: 'enemy_abeille',      hp: 1, touchDamage: 1, move: 'fly',     speed: 130, range: 150, amp: 36, anim: 'walk', score: 130, scale: 0.5 , hit: { w: 0.86, h: 0.87 } },
    //  SOL (rampe vite, bas)
    cafard:       { sprite: 'enemy_cafard',       hp: 1, touchDamage: 1, move: 'chase',   speed: 165, range: 90,  aggro: 500, anim: 'walk', score: 100, scale: 0.5, hit: { w: 0.92, h: 0.68 } },
    //  VEHICULE (va-et-vient, gros degats)
    transpalette: { sprite: 'enemy_transpalette', hp: 6, touchDamage: 2, move: 'patrol',  speed: 150, range: 140, aggro: 460, anim: 'walk', score: 260, scale: 1.0, hit: { w: 0.68, h: 0.80 } },
    livreur:      { sprite: 'enemy_livreur',      hp: 6, touchDamage: 2, move: 'patrol',  speed: 120, range: 130, aggro: 460, anim: 'walk', score: 260, scale: 1.0, hit: { w: 0.90, h: 0.82 } },
    coursier:     { sprite: 'enemy_coursier',     hp: 6, touchDamage: 2, move: 'patrol',  speed: 140, range: 140, aggro: 460, anim: 'walk', score: 260, scale: 1.0, hit: { w: 0.90, h: 0.85 } },
    //  TIR (shooter)
    imprimante:   { sprite: 'enemy_imprimante',   hp: 4, touchDamage: 1, move: 'shooter', shotEvery: 2.0, range: 440, shotSpeed: 260, anim: 'walk', score: 230, scale: 0.95, shot: 'shot_boulette', hit: { w: 0.92, h: 0.78 } },
    chips:        { sprite: 'enemy_chips',        hp: 2, touchDamage: 1, move: 'shooter', shotEvery: 2.4, range: 400, shotSpeed: 230, anim: 'walk', score: 160, scale: 0.7 , shot: 'shot_chip', hit: { w: 0.92, h: 0.88 } },
    tuyau:        { sprite: 'enemy_tuyau',        hp: 3, touchDamage: 1, move: 'shooter', shotEvery: 1.8, range: 420, shotSpeed: 240, anim: 'walk', score: 200, scale: 0.9 , shot: 'shot_eau', hit: { w: 0.92, h: 0.82 } },
    //  IMMOBILE (static, degat au contact / petite attaque de proximite)
    sac:          { sprite: 'enemy_sac',          hp: 3, touchDamage: 1, move: 'static',  anim: 'walk', score: 120, scale: 0.8, hit: { w: 0.92, h: 0.86 } },
    fontaine:     { sprite: 'enemy_fontaine',     hp: 4, touchDamage: 1, move: 'static',  anim: 'walk', score: 150, scale: 0.9, hit: { w: 0.58, h: 0.84 } },
    dossiers:     { sprite: 'enemy_dossiers',     hp: 4, touchDamage: 1, move: 'static',  anim: 'walk', score: 150, scale: 0.9, hit: { w: 0.86, h: 0.84 } },

    // minions de boss (reutilisent des sprites existants)
    //  anim 'walk' : la feuille criquet regeneree n'a plus de clip 'hop' (cf.
    //  enemy_criquet plus bas) — 'hop' laissait le minion FIGE frame 0.
    bug:      { sprite: 'enemy_criquet',  hp: 1,        touchDamage: 1, move: 'chase',   speed: 130, range: 130, aggro: 700, anim: 'walk', score: 60, hit: { w: 0.54, h: 0.82 } },   // sprite criquet -> meme hit.w re-derive (cellule 302)
    chercheur:{ sprite: 'enemy_assureur', hp: 2,        touchDamage: 1, move: 'chase',   speed: 95,  range: 120, aggro: 600, score: 120, hit: { w: 0.88, h: 0.83 } },
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
  //    (Universite, le + dur des 5) -> jury (megaboss boss-rush).
  //  v2 (GAMEPLAY.md §4) : les HP paraissent enormes mais le boss n'encaisse
  //    que des TICKS plafonnes (CONFIG.bossHit) x sa GARDE (guard, multiplicateur
  //    hors fenetre de punition ; 1 pendant les fenetres). Duree visee : ~25s
  //    (agriculteur) -> ~2min30 (jury). PHASE 2 a 50% HP : champs p2X lus par
  //    bosses.js (b.def.p2X || defaut code).
  //  Champs de tuning IA (windTime, revTime, aimTime, ...) lus par bosses.js ;
  //  l'IA a des defauts, donc aucun champ n'est obligatoire pour eviter un crash.
  bosses: {
    // === FINETUNING : pour chaque boss, TOUS les params de timing lus par
    //  js/bosses.js sont exposes ici (avant, beaucoup n'avaient qu'un defaut code
    //  en dur, et certaines valeurs ici etaient PERIMEES et ecrasaient l'IA).
    //  Edite ces nombres + reload pour ajuster le game feel. 2e ligne = reglages IA. ===
    //  `range` = demi-largeur de l'ARENE (px) : verrou de portes a bossX +/- range
    //  (addArenaGates) ET rayon de deambulation du boss (homeX +/- range, bosses.js).
    //  v3 : +80px sur les 5 boss de niveau (arenes jugees trop etroites au playtest) ;
    //  le jury garde 320 (son niveau entier EST l'arene). Si tu retouches, garde
    //  tools/check_levels.py (META.boss_range) SYNCHRO et relance-le : il verifie
    //  qu'aucune fosse '%' ne tombe dans l'arene agrandie.

    // niveau1 (Riziere) — agriculteur (IA 'tracteur') : LE PLUS FACILE.
    //  rev (vrombit, revTime) -> drive (traverse, lache une BOMBE tous les skyEvery,
    //  chute apres skyDelay) -> stall (cale, immobile stallTime = PUNITION). La bombe
    //  tombe desormais MEME quand Laura est tout pres (plus de skyMinDist) ; c'est la
    //  GARDE D'ARENE (bossBehavior) qui empeche le bombardement hors combat. arenaPad
    //  = marge d'entree d'arene (en TUILES) avant que le boss se reveille.
    //  Esquive : lob depuis panneaux + saut/dash sous bombes.
    agriculteur:  { sprite: 'boss_agriculteur_move', attackSprite: 'boss_agriculteur_atk', behavior: 'tracteur',
                    hp: 42, maxHp: 42, guard: 0.5, touchDamage: 2, shotSpeed: 240, speed: 150, range: 500, score: 1000, name: 'L AGRICULTEUR FOU', shot: 'shot_fork',
                    //  skyEvery DOIT etre < duree d'une traversee (2*range/driveSpd ~ 2.5s),
                    //  sinon AUCUNE bombe ne part en drive (bug v1 : 3.4 > 2.5).
                    revTime: 0.5, stallTime: 1.8, skyEvery: 1.6, skyDelay: 0.9, arenaPad: 2,
                    p2DriveMul: 1.25, p2SkyEvery: 1.1 },

    // niveau2 (Appart) — proprio (IA 'charger').
    //  pace (approche ; 1 cycle/2 tire un TRIPLE missile, milieu DUCKABLE ; paceTime)
    //  -> wind (se cabre, windTime) -> dash (rue dashSpeed pdt dashTime, seisme local)
    //  -> stagger (essouffle = PUNITION, staggerTime) -> throw (eventail 3, throwTime).
    //  shot 'shot_bail' = le ROULEAU de bail a ruban rouge (ex-shot_chart, renomme) :
    //  c'est EXACTEMENT ce que Francois brandit/jette sur sa feuille _atk (l'ancien
    //  shot_stake — un piquet en bois — ne correspondait a aucun de ses gestes).
    proprietaire: { sprite: 'boss_proprietaire_move', attackSprite: 'boss_proprietaire_atk', behavior: 'charger',
                    hp: 72, maxHp: 72, guard: 0.4, touchDamage: 2, shotSpeed: 255, speed: 55, range: 500, dashSpeed: 480, score: 1300, name: 'FRANCOIS LE PROPRIO', shot: 'shot_bail',
                    paceTime: 1.0, windTime: 0.7, dashTime: 0.9, staggerTime: 1.2, throwTime: 0.5,
                    p2StaggerTime: 0.9, p2RewindTime: 0.3 },

    // niveau3 (Serre) — rstudio (IA 'errors').
    //  fire (3 salves de triple-missile espacees de burstGap, pdt attackTime) ->
    //  summon (cafards fragiles spawnes EN FACE, summonTime) -> load (immobile =
    //  PUNITION, loadTime). Esquive : dash + petites plateformes.
    rstudio:      { sprite: 'boss_rstudio_move', attackSprite: 'boss_rstudio_atk', behavior: 'errors',
                    hp: 100, maxHp: 100, guard: 0.35, touchDamage: 2, shotSpeed: 280, speed: 60, range: 470, score: 1700, name: 'RSTUDIO', shot: 'shot_error',
                    attackTime: 2.5, burstGap: 0.8, summonTime: 2.0, loadTime: 1.5,
                    p2BurstGap: 0.6 },

    // niveau4 (Labo) — michael (IA 'modeles').
    //  garde ses distances (keepMin..keepMax) ; vise (aimTime) puis lache une BOMBE
    //  EN PAPIER sur le joueur ; 1 cycle/3 = overload (eventail 3) ; recalc (ne tire
    //  pas = PUNITION, recalcTime). Esquive : bouger lateralement / double-saut.
    //  shot_chart (regenere) = FEUILLE de graphiques plate (bar-chart + courbe),
    //  comme sur sa feuille _atk. bomb 'shot_boulette' = boulette de papier froisse
    //  pour la "bombe en papier" (avant : shot_paper, un avion en papier qui
    //  CHUTAIT en tournoyant — le fameux "feuille qui se transforme en avion").
    michael:      { sprite: 'boss_michael_move', attackSprite: 'boss_michael_atk', behavior: 'modeles',
                    hp: 125, maxHp: 125, guard: 0.3, touchDamage: 2, shotSpeed: 300, speed: 80, range: 500, score: 2100, name: 'MICHAEL LE DIRECTEUR', shot: 'shot_chart', bomb: 'shot_boulette',
                    aimTime: 1.0, recalcTime: 1.0, keepMin: 220, keepMax: 440,
                    p2KeepMin: 180, p2KeepMax: 380 },

    // niveau5 (Universite) — cendrine (IA 'paperasse') : LE PLUS DUR DES 5.
    //  pre (annonce la destination du TP, preTime) -> implosion (retrecit+clignote,
    //  implodeTime) -> TP + eventail de formN formulaires + TAMPON-PIEGE (throwTime)
    //  -> window (PUNITION, windowTime). Esquive : dash apres le TP / les tampons.
    cendrine:     { sprite: 'boss_cendrine_move', attackSprite: 'boss_cendrine_atk', behavior: 'paperasse',
                    hp: 165, maxHp: 165, guard: 0.3, touchDamage: 2, shotSpeed: 330, speed: 90, range: 520, score: 2600, name: 'CENDRINE LA RESPONSABLE', shot: 'shot_form',
                    preTime: 0.4, implodeTime: 0.18, throwTime: 0.3, windowTime: 1.2, formN: 4,
                    p2FormN: 6, p2HazardDur: 3.5, p2WindowTime: 0.9 },

    // FINAL — jury (IA 'jury') : megaboss 3 phases selon HP. >66% Q&A (eventail 3,
    //  cadence shotEvery) ; 33-66% debat (eventail 5 + anneau de ringN + minion) ;
    //  <33% verdict (eventail de panicN + bombes + MUR A TROU a dasher). enrageTime
    //  = pose marquee au changement de phase. Esquive : lob a distance puis DASH.
    //  shot 'shot_page' = page de these volante : c'est ce que les 3 jures JETTENT
    //  sur leur feuille _atk (le marteau shot_gavel etait iconique mais aucun jure
    //  n'en brandit ; il reste sur disque si on veut revenir en arriere).
    jury:         { sprite: 'boss_jury_move', attackSprite: 'boss_jury_atk', behavior: 'jury',
                    hp: 270, maxHp: 270, guard: 0.35, touchDamage: 3, shotEvery: 0.9, shotSpeed: 340, speed: 75, range: 420, score: 5000, name: 'LE JURY DE THESE', shot: 'shot_page', scale: 1.32,
                    enrageTime: 0.7, ringN: 8, panicN: 9, openTime: 0.8 },   // openTime = battement VULNERABLE apres chaque salve
  },

  // --- Collectibles ---------------------------------------------------
  pickups: {
    sunray:    { sprite: 'pickup_sunray',    score: 50 },             // recharge la jauge soleil
    cafe:      { sprite: 'pickup_cafe',      heal: 1, score: 30 },    // rend UN coeur (v2 : un soin, pas un full-heal)
    data:      { sprite: 'pickup_data',      score: 75 },             // donnee de terrain
    page:      { sprite: 'pickup_page',      score: 100 },            // page de manuscrit
    publi:     { sprite: 'pickup_publi',     score: 1000 },           // PUBLI cachee (100%)
    croquette: { sprite: 'pickup_croquette', score: 20 },             // recharge le chat
    rollers:   { sprite: 'pickup_rollers',   score: 40, equip: 'rollers' }, // equipement rollers
    velo:      { sprite: 'pickup_velo',      score: 60, equip: 'velo' },     // equipement velo
    // UPGRADES D'ARSENAL (cf. GAMEPLAY.md) : montent un axe COMMUN aux 2 armes,
    //  plafonne a arsenal.{power,rate}.max, RESET par niveau. Places dans les maps
    //  via 'e' (puissance) / 'i' (cadence) -> buildLevel. Fallback propre si PNG absent.
    puissance: { sprite: 'pickup_puissance', score: 60, upgrade: 'power' },  // +1 PUISSANCE (force)
    cadence:   { sprite: 'pickup_cadence',   score: 60, upgrade: 'rate'  },  // +1 CADENCE (vitesse de tir)
  },

  // --- Equipements (objets a ramasser qui changent Laura) -------------
  //  overlay  : sprite superpose qui SUIT Laura + copie sa pose (si l'overlay
  //             a des anims idle/run/jump...).
  //  speedMul : vitesse de course.   jumpMul : hauteur de saut.
  //  override : remplace le sprite d'une pose (ex. run -> 'hero_roll').
  //  IMPORTANT v2 : ordre des degats = SOLEIL (bouclier) -> EQUIPEMENT -> COEUR.
  //  L'equipement n'est perdu que si le bouclier solaire n'a pas absorbe le coup
  //  (cf. damagePlayer) -> on profite enfin du velo/des rollers.
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
    //  hurt : speed 16 (pas 10) — la pose n'est affichee que ~0.25s (cf. branche
    //  anim de game.js) ; a 10 fps on ne voyait que 2-3 frames de la feuille.
    hero_hurt:        { sliceX: 8, sliceY: 1, anims: { hurt:  { from: 0, to: 7, loop: true,  speed: 16 } } },
    hero_duck:        { sliceX: 7, sliceY: 1, anims: { duck:  { from: 0, to: 6, loop: true,  speed: 8  } } },
    // DASH (ruee + i-frames) : feuille 6 frames (impulsion -> fente -> freinage)
    //  mais le dash ne dure que 0.16s -> le clip ne joue que l'ELAN (0-3) a
    //  vitesse haute ; les frames 4-5 (freinage/redressement) restent dispo si
    //  on allonge la duree un jour. Le branchement (game.js) retombe sur
    //  hero_run tant que le PNG n'est pas embarque.
    hero_dash:        { sliceX: 6, sliceY: 1, anims: { dash:  { from: 0, to: 3, loop: false, speed: 24 } } },
    // lancer du chat (le retour au sac n'a pas de pose dediee : poof + disparition)
    hero_cat_out:     { sliceX: 5, sliceY: 1, anims: { cat:   { from: 0, to: 4, loop: false, speed: 12 } } },
    // pose de lancer plein-corps commune aux deux armes (les feuilles dediees
    //  hero_throw_seed/cake ont ete retirees des assets).
    hero_throw:       { sliceX: 6, sliceY: 1, anims: { throw: { from: 0, to: 5, loop: false, speed: 18 } } },
    // CALQUES BRAS de lancer PAR LOCOMOTION (3 frames transparentes, poses par-dessus la
    //  locomotion via setActionOverlay). run/bike/roll/duck ; idle & saut -> plein-corps hero_throw.
    hero_run_throw:   { sliceX: 3, sliceY: 1, anims: { throw: { from: 0, to: 2, loop: false, speed: 12 } } },
    hero_bike_throw:  { sliceX: 3, sliceY: 1, anims: { throw: { from: 0, to: 2, loop: false, speed: 12 } } },
    hero_roll_throw:  { sliceX: 3, sliceY: 1, anims: { throw: { from: 0, to: 2, loop: false, speed: 12 } } },
    hero_duck_throw:  { sliceX: 3, sliceY: 1, anims: { throw: { from: 0, to: 2, loop: false, speed: 12 } } },
    // sprites complets "Laura sur l'engin" (remplacent le sprite via equipment.override)
    hero_bike:        { sliceX: 7, sliceY: 1, anims: { idle: { from: 0, to: 6, loop: true, speed: 6 }, run: { from: 0, to: 6, loop: true, speed: 14 }, jump: { from: 3, to: 3 } } },
    hero_roll:        { sliceX: 8, sliceY: 1, anims: { idle: { from: 0, to: 7, loop: true, speed: 6 }, run: { from: 0, to: 7, loop: true, speed: 16 }, jump: { from: 4, to: 4 } } },
    // Clones "SAC VIDE" (chat parti) : memes feuilles SANS le chat, jouees tant que
    //  le chat est DEHORS (cf. noCat() dans game.js). Memes sliceX/clips que la base.
    hero_idle_nocat:  { sliceX: 8, sliceY: 1, anims: { idle:  { from: 0, to: 7, loop: true,  speed: 8  } } },
    hero_run_nocat:   { sliceX: 8, sliceY: 1, anims: { run:   { from: 0, to: 7, loop: true,  speed: 14 } } },
    hero_hurt_nocat:  { sliceX: 8, sliceY: 1, anims: { hurt:  { from: 0, to: 7, loop: true,  speed: 16 } } },
    hero_jump_nocat:  { sliceX: 8, sliceY: 1, anims: { jump:  { from: 0, to: 7, loop: true,  speed: 10 } } },
    hero_duck_nocat:  { sliceX: 7, sliceY: 1, anims: { duck:  { from: 0, to: 6, loop: true,  speed: 8  } } },
    hero_dash_nocat:  { sliceX: 6, sliceY: 1, anims: { dash:  { from: 0, to: 3, loop: false, speed: 24 } } },
    hero_throw_nocat: { sliceX: 6, sliceY: 1, anims: { throw: { from: 0, to: 5, loop: false, speed: 18 } } },
    hero_bike_nocat:  { sliceX: 7, sliceY: 1, anims: { idle: { from: 0, to: 6, loop: true, speed: 6 }, run: { from: 0, to: 6, loop: true, speed: 14 }, jump: { from: 3, to: 3 } } },
    hero_roll_nocat:  { sliceX: 8, sliceY: 1, anims: { idle: { from: 0, to: 7, loop: true, speed: 6 }, run: { from: 0, to: 7, loop: true, speed: 16 }, jump: { from: 4, to: 4 } } },
    cat_run:          { sliceX: 8, sliceY: 1, anims: { run:   { from: 0, to: 7, loop: true,  speed: 16 } } },
    enemy_corbeau:    { sliceX: 6, sliceY: 1, anims: { fly:   { from: 0, to: 5, loop: true,  speed: 8  } } },
    enemy_criquet:    { sliceX: 6, sliceY: 1, anims: { walk: { from: 0, to: 2, loop: true, speed: 10 }, hurt: { from: 3, to: 3 }, attack: { from: 4, to: 5, loop: true, speed: 14 } } },
    // --- Boss : DEUX feuilles par boss (cf. tools/gen_boss_sheets.py) ---
    //  _move : DEPLACEMENT — frames 0-4 = cycle idle/menace, frame 5 = touche (hurt)
    //  _atk  : ATTAQUE     — frames 0-5 = montee -> frappe -> retour (attack)
    //  game.js (bossAnim) bascule sur la feuille _atk pour animWant 'attack' ET
    //  pour les CLIPS DEDIES ('windup'/'dash'/'throw', poses par l'IA charger) ;
    //  un clip dedie absent de la feuille retombe sur 'attack' (autres boss).
    boss_proprietaire_move: { sliceX: 6, sliceY: 1, anims: { idle: { from: 0, to: 4, loop: true, speed: 7 }, hurt: { from: 5, to: 5 } } },
    //  Contenu reel de la feuille atk du proprio : f0 quasi-idle, f1 leve le bail,
    //  f2 bail a l'epaule (arme), f3 JET bras tendu, f4 pose de COURSE penchee
    //  (poussiere), f5 ~ f0. Avant, l'unique clip attack {0..5 loop} servait aux
    //  4 etats de l'IA -> pendant la CHARGE le boss "jetait ses cles" en boucle
    //  (bug anim niveau2). Clips dedies : windup (se cabre et arme, fige sur f2),
    //  dash (frame de course seule), throw (leve -> jet, fige sur la frame de jet).
    boss_proprietaire_atk:  { sliceX: 6, sliceY: 1, anims: { attack: { from: 0, to: 5, loop: true, speed: 10 },
                                                             windup: { from: 0, to: 2, loop: false, speed: 10 },
                                                             dash:   { from: 4, to: 4 },
                                                             throw:  { from: 1, to: 3, loop: false, speed: 12 } } },
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
    // upgrades d'arsenal (medaillons power-up) : meme bump 4 frames que les autres pickups
    pickup_puissance: { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_cadence:   { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    // collectibles thematiques 'd' par niveau (re-skin via theme.pickups)
    pickup_graine:    { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_plant:     { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_chart:     { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_sheet:     { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },
    pickup_pilule:    { sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },   // skin 'd'/'p' (Appart / Arene)
    pickup_champignon:{ sliceX: 4, anims: { idle: { from: 0, to: 3, loop: true, speed: 6 } } },   // skin 'p' (Arene)
    // --- Munitions (6 frames : tournent) ---
    ammo_graine:      { sliceX: 6, anims: { spin: { from: 0, to: 5, loop: true, speed: 16 } } },
    ammo_graine_fire: { sliceX: 6, anims: { spin: { from: 0, to: 5, loop: true, speed: 18 } } },   // graine enflammee (P3)
    ammo_cookie:      { sliceX: 6, anims: { spin: { from: 0, to: 5, loop: true, speed: 14 } } },
    ammo_gateau:      { sliceX: 6, anims: { spin: { from: 0, to: 5, loop: true, speed: 16 } } },
    ammo_gateau_enfer:{ sliceX: 6, anims: { spin: { from: 0, to: 5, loop: true, speed: 18 } } },   // gateau des enfers (P3)
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
    // ombre de chute d'une bombe : 6 frames qui GROSSISSENT (telegraphe). Le
    //  moteur regle la frame sur l'avancement de la chute (cf. addBombShadow).
    fx_bomb_shadow:   { sliceX: 6, anims: { grow: { from: 0, to: 5, loop: false, speed: 8 } } },
    // onde de choc au sol (seisme localise, cf. api.quake) : 6 frames naissance
    //  -> pleine vague -> dissipation. Fallback dessine si le PNG manque.
    fx_quake:         { sliceX: 6, anims: { roll: { from: 0, to: 5, loop: true, speed: 14 } } },
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
    muteSfx:    ['s'],           // coupe/retablit les bruitages (toutes scenes)
    muteMusic:  ['m'],           // coupe/retablit la musique (lecteur MIDI js/music.js)
  },

  // --- Audio ----------------------------------------------------------
  //  enabled = bruitages (toggle en jeu : touche S) ; music = musique (touche M).
  //  Les deux flags sont persistes (LQ_SAVE prefs) et relus au boot (game.js).
  //  musicVolume = volume du lecteur MIDI chiptune (js/music.js), independant
  //  de volume (les ondes carrees sortent fort, rester bas).
  audio: { enabled: true, volume: 0.5, music: true, musicVolume: 0.25 },

  // --- Musique (MIDI chiptune, js/music.js) ---------------------------
  //  Piste par SCENE (cle = piste dans assets/music/*.mid, reembarquer via
  //  gen_assets_data.py). En jeu : piste = LEVELS[clef].music || clef du
  //  niveau (niveau1.mid, ..., jury.mid). Piste absente = silence, rien ne
  //  casse. Scene absente de cette table = la musique s'arrete.
  music: { title: 'title', slots: 'title', overworld: 'map', chapter: 'chapter', win: 'win', lose: 'lose' },

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
  //  En jeu (touches declarees ci-dessous, cf. cheatKeys) :
  //    1-6   = aller directement au niveau (derive de CONFIG.levels)
  //    0     = finir le niveau en cours
  //    G     = bascule mode DIEU (invincible)
  //    Suppr = PLEIN : armes a fond (puissance + cadence) + recharge tout
  //            (PV, energie/soleil, charges du chat)
  cheats: true,
  cheatKeys: {
    god:    'g',        // bascule DIEU
    finish: '0',        // termine le niveau
    refill: 'delete',   // touche "Suppr" : armes a fond + recharge tout
  },

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
              'ESPACE tir   X lob lourd   MAJ dash   C chat   BAS+SAUT descend d un panneau   ESC quitter',
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
    // v2 : boss (garde/fenetres), checkpoint d'arene, medailles (cf. GAMEPLAY.md)
    bossOpen:  'OUVERT !',                    // fenetre de vulnerabilite du boss
    bossGuard: 'GARDE !',                     // 1er tir encaisse en garde (pedagogie)
    arenaClose:'L ARENE SE FERME !',          // verrou d'arene (v2.3) : murs poses a l'entree
    checkpoint:'K.O. ! REPRISE A L ARENE',    // mort pendant un boss -> respawn au checkpoint (jingle + flash rouge)
    // v3 MORT : message dedie sur place (cadavre au sol, flash rouge) puis le
    //  niveau REDEMARRE tout seul — plus d'ecran lose ni de retour carte.
    dead:      'LAURA EST K.O. !',
    deadSub:   'ON REPREND LE CHAPITRE...',
    mention:   'MENTION TRES HONORABLE',      // toutes les medailles d'or
    feliJury:  'FELICITATIONS DU JURY',       // medaille cachee : niveau sans perdre coeur ni equipement
    medals:    ['TEMPS', 'DATA', 'SAUVES'],   // noms des 3 medailles (recap + carte)
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
