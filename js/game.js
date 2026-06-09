/* =====================================================================
 *  GAME — Le moteur de "Laura l'exploratrice".
 *  Lit CONFIG (js/config.js), LEVELS (js/level.js), LQ_SAVE (js/save.js)
 *  et BOSS_AI (js/bosses.js). Moteur : KAPLAY (engine/kaplay.js), 100% client.
 *
 *  Scenes : title -> slots -> overworld -> game -> chapter -> overworld
 *           ... jury -> win.   (lose -> overworld)
 * ===================================================================== */
(() => {
  'use strict';
  const C = window.CONFIG;
  const LEVELS = window.LEVELS;
  const SAVEAPI = window.LQ_SAVE;

  // --- Init KAPLAY (mode global) --------------------------------------
  kaplay({
    width: C.width,
    height: C.height,
    background: C.background,
    global: true,
    crisp: true,            // nearest-neighbour: keep the pixel-art boss sheets crisp
    touchToMouse: true,
    pixelDensity: (C.art && C.art.pixelDensity) || 1,
  });
  setGravity(C.gravity);

  // ---------------------------------------------------------------------
  //  CAPTURE CLAVIER : garder le focus sur le canvas (sinon les touches
  //  partent au navigateur). Inchange depuis la demo.
  // ---------------------------------------------------------------------
  (function keepKeyboard() {
    const cv = document.querySelector('canvas');
    const focusCv = () => { try { cv && cv.focus({ preventScroll: true }); } catch (e) {} };
    if (cv) {
      cv.setAttribute('tabindex', '0');
      cv.style.outline = 'none';
      focusCv();
      ['load', 'pointerdown', 'pointerup', 'click', 'touchstart'].forEach((ev) =>
        window.addEventListener(ev, focusCv, true));
      cv.addEventListener('focusout', focusCv);
    }
    const toKey = (k) => ({
      left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
      space: ' ', enter: 'Enter', shift: 'Shift', escape: 'Escape', tab: 'Tab',
    }[k] || k);
    const block = new Set(['/', "'"]);
    Object.values(C.controls).forEach((arr) => arr.forEach((k) => block.add(toKey(k))));
    // Touches de triche (CONFIG.cheats) : sinon Firefox/Chrome les capte
    // (recherche dans la page / "find as you type") au lieu du jeu.
    if (C.cheats) ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'g', 'G', 'h', 'H']
      .forEach((k) => block.add(k));
    window.addEventListener('keydown', (e) => {
      if (cv && document.activeElement !== cv) focusCv();
      if (block.has(e.key)) e.preventDefault();
    }, true);
  })();

  // --- Helpers ----------------------------------------------------------
  const setCam = (x, y) =>
    (typeof setCamPos === 'function' ? setCamPos(vec2(x, y)) : camPos(vec2(x, y)));
  // lecture de la position camera (pour le parallax)
  const getCam = () =>
    (typeof getCamPos === 'function' ? getCamPos()
      : (typeof camPos === 'function' ? camPos() : vec2(C.width / 2, C.height / 2)));
  const safeShake = (n) => { try { shake(n); } catch (e) {} };
  const sfx = (name, opts) => {
    if (!C.audio || !C.audio.enabled) return;
    try { play(name, Object.assign({ volume: C.audio.volume }, opts || {})); } catch (e) {}
  };
  const keysDown = (arr) => arr.some((k) => isKeyDown(k));
  const onKeys = (arr, cb) => arr.forEach((k) => onKeyPress(k, cb));
  // Validation des menus : ESPACE + ENTREE + touche de saut (espace ne saute plus en jeu)
  const onConfirm = (cb) => ['space', 'enter'].concat(C.controls.jump).forEach((k) => onKeyPress(k, cb));

  // ---------------------------------------------------------------------
  //  CHARGEMENT DES ASSETS (les sprites de CONFIG.anims sont des feuilles)
  // ---------------------------------------------------------------------
  // Liste de secours si les assets ne sont PAS embarques (rare). Sinon on
  // charge TOUT ce qui est dans window.ASSETS -> les variants numerotes
  // (enemy_criquet2, ...) sont pris en compte automatiquement.
  const SPRITES_FALLBACK = [
    'hero_idle', 'hero_run', 'hero_jump', 'hero_hurt', 'hero_throw', 'cat_run',
    'ammo_graine', 'ammo_riz', 'ammo_cookie', 'ammo_gateau',
    'enemy_caillou', 'enemy_camion', 'enemy_assureur', 'enemy_ademe', 'enemy_corbeau', 'enemy_criquet',
    'boss_proprietaire_move', 'boss_proprietaire_atk', 'boss_agriculteur_move', 'boss_agriculteur_atk',
    'boss_michael_move', 'boss_michael_atk', 'boss_rstudio_move', 'boss_rstudio_atk',
    'boss_cendrine_move', 'boss_cendrine_atk', 'boss_jury_move', 'boss_jury_atk',
    'pickup_sunray', 'pickup_cafe', 'pickup_data', 'pickup_page', 'pickup_publi', 'pickup_croquette',
    'sun_goal', 'tile_soil', 'tile_panel', 'heart', 'fx_tear', 'fx_grumble', 'bg_field', 'bg_cloud',
  ];
  const SPR_SRC = (n) => (window.ASSETS && window.ASSETS.sprites[n]) || ('assets/sprites/' + n + '.png');
  const SND_SRC = (n) => (window.ASSETS && window.ASSETS.sounds[n]) || ('assets/sounds/' + n + '.wav');

  // nom de base = nom sans suffixe numerique de variant (criquet2 -> criquet)
  const baseName = (n) => n.replace(/[0-9]+$/, '');
  const SPRITE_NAMES = (window.ASSETS && window.ASSETS.sprites)
    ? Object.keys(window.ASSETS.sprites) : SPRITES_FALLBACK;
  const LOADED = new Set(SPRITE_NAMES);
  const hasSprite = (n) => LOADED.has(n);

  // index des variants/skins : base -> [base, base2, base3, ...]
  const VARIANTS = {};
  SPRITE_NAMES.forEach((n) => { const b = baseName(n); (VARIANTS[b] = VARIANTS[b] || []).push(n); });
  // choisit au hasard une variante parmi les sprites numerotes (sinon le base)
  const variant = (base) => {
    const l = VARIANTS[base];
    return (l && l.length > 1) ? l[Math.floor(rand(0, l.length))] : base;
  };

  // Skin PAR NIVEAU : `list` = sprites declares dans LEVEL.theme (tiles/enemies/
  //  layers). On en choisit un au hasard parmi ceux qui existent vraiment ;
  //  sinon on retombe sur le systeme de variantes numerotees global.
  function pickSkin(list, fallbackBase) {
    if (list && list.length) {
      const ok = list.filter(hasSprite);
      if (ok.length) return ok.length > 1 ? ok[Math.floor(rand(0, ok.length))] : ok[0];
    }
    return variant(fallbackBase);
  }

  // chargement : chaque sprite herite des anims de son nom de base
  SPRITE_NAMES.forEach((n) => {
    const a = C.anims && C.anims[baseName(n)];
    if (a) loadSprite(n, SPR_SRC(n), { sliceX: a.sliceX || 1, sliceY: a.sliceY || 1, anims: a.anims || {} });
    else loadSprite(n, SPR_SRC(n));
  });

  // joue l'anim par defaut d'un sprite s'il en a une -> rend N'IMPORTE QUEL
  // sprite animable (il suffit d'elargir le PNG + declarer sliceX/anims).
  function playIfAnim(o, name) {
    const a = C.anims && C.anims[baseName(name)];
    if (!a || !a.anims) return;
    const key = a.play || Object.keys(a.anims)[0];
    if (key) { try { o.play(key); } catch (e) {} }
  }
  if (C.audio && C.audio.enabled) {
    ['shoot', 'jump', 'hit', 'pickup', 'spell', 'boss', 'win', 'lose']
      .forEach((n) => { try { loadSound(n, SND_SRC(n)); } catch (e) {} });
  }

  // ---------------------------------------------------------------------
  //  ETAT PARTAGE
  // ---------------------------------------------------------------------
  let PLAYER = null;
  let LEVEL = null;     // { width, height, bossesAlive, sun, dataTotal, pageTotal, hasPubli }
  let SAVE = null;      // slot courant (objet de save.js)
  let SLOT = 0;         // index du slot courant
  let CUR_IDX = 0;      // index du niveau dans C.levels
  let ENEMY_SEQ = 0;    // compteur d'ennemis -> ecart/phase perso (anti-agglutination)
  const TS = C.tileSize;
  // --- Cadrage vertical : on descend tout le monde de CAM_DROP px (cf.
  //  C.groundDrop) -> sol plus bas, plus de ciel. GROUND_ROWS = epaisseur de
  //  sol des maps (rangees '=').
  const GROUND_ROWS = 2;
  const CAM_DROP = C.groundDrop != null ? C.groundDrop : 0;
  // Y ECRAN de la surface du sol (= ligne d'horizon) apres ce decalage. Les
  //  bandes parallax 'ground' s'ancrent ici pour monter depuis le sol visible.
  const HORIZON_Y = (C.height - GROUND_ROWS * TS) + CAM_DROP;
  // Pente de l'ombre projetee par les panneaux (soleil rasant) : decalage
  //  horizontal vers la DROITE par pixel de profondeur sous le panneau.
  //  Partagee par le visuel (cone) ET par inShade() -> les deux restent alignes.
  const SHADE_SLOPE = 0.45;

  // Les sprites sont generes a ART x la resolution (cf. CONFIG.art.scale /
  // artkit.py). On les reduit de 1/ART pour garder EXACTEMENT la meme taille
  // a l'ecran (et les memes hitboxes), mais avec une bien meilleure definition.
  const ART = (C.art && C.art.scale) || 1;
  const artScale = (m) => scale((m || 1) / ART);

  // bascule de sprite + animation (ne rejoue que si ca change)
  function setAnim(o, spr, anim) {
    if (o._spr !== spr) { o.use(sprite(spr)); o._spr = spr; o._anim = null; }
    if (anim && o._anim !== anim) { try { o.play(anim); } catch (e) {} o._anim = anim; }
  }

  // setAnim pour Laura : un equipement peut remplacer le sprite d'une pose
  // (ex. rollers -> override.run = 'hero_roll').
  function heroAnim(o, spr, anim) {
    const eq = o.equipped && C.equipment && C.equipment[o.equipped];
    if (eq && eq.override && eq.override[anim] && hasSprite(eq.override[anim])) spr = eq.override[anim];
    setAnim(o, spr, anim);
  }

  // ---------------------------------------------------------------------
  //  PROJECTILES
  // ---------------------------------------------------------------------
  //  Laura est-elle en train de VISER une cloche ? (arme 'arc' + maintien du tir,
  //  sans equipement). Pendant ce temps HAUT/BAS reglent l'angle (pas saut/accroupi)
  //  et la fleche de visee s'affiche (cf. aimGuide dans la scene 'game').
  function aimingLob(p) {
    if (!p || p.equipped) return false;
    const a = C.ammoTypes[p.ammoKey];
    return !!(a && a.traj === 'arc' && keysDown(C.controls.shoot));
  }

  // Vitesse de lancer d'une cloche pour une puissance pw (0..1) et l'angle vise
  //  courant de Laura. Sert AU TIR et a l'apercu de trajectoire (meme physique).
  function arcLaunch(p, pw) {
    const fx = p.facing >= 0 ? 1 : -1;
    const ammo = C.ammoTypes[p.ammoKey];
    const mul = C.shot.arcMin + (C.shot.arcMax - C.shot.arcMin) * pw;
    const ang = ((p.aimAngle != null) ? p.aimAngle : C.shot.aimDefault) * Math.PI / 180;
    const spd = ammo.speed * mul;
    return { vx: Math.cos(ang) * spd * fx, vy: -Math.sin(ang) * spd };
  }

  function playerShoot(power) {
    const p = PLAYER;
    const ammo = C.ammoTypes[p.ammoKey];
    const sname = hasSprite(ammo.sprite) ? ammo.sprite : 'ammo_graine';   // garde-fou si PNG absent
    const fx = p.facing >= 0 ? 1 : -1;
    const traj = ammo.traj || 'straight';
    const aoe = ammo.aoe || null;
    const pw = (power == null) ? 1 : Math.max(0, Math.min(1, power));   // charge 0..1 (cloche)
    const b = add([
      sprite(sname), artScale(),
      pos(p.pos.x + fx * 22, p.pos.y - TS * 0.6),
      anchor('center'), area(),
      offscreen({ distance: 220, destroy: true }),
      'pbullet',
      { dmg: ammo.damage, vx: 0, vy: 0, traj, aoe },
    ]);
    playIfAnim(b, sname);
    if (traj === 'arc') {                       // en cloche : charge -> portee, HAUT/BAS -> angle
      const v = arcLaunch(p, pw);
      b.vx = v.vx; b.vy = v.vy;
    } else {                                    // tout droit, horizontal
      b.vx = fx * ammo.speed; b.vy = 0;
    }
    b.onUpdate(() => {
      if (b.traj === 'arc') b.vy += C.shot.arcGravity * dt();
      b.pos.x += b.vx * dt(); b.pos.y += b.vy * dt();
      if (b.pos.y > LEVEL.height + 100) destroy(b);
    });
    if (aoe) {                                  // GATEAU : eclate en AoE a l'impact
      const boom = () => { if (!b.exists()) return; const bx = b.pos.x, by = b.pos.y; destroy(b); explodeAoe(bx, by, aoe.radius, aoe.damage || ammo.damage); };
      b.onCollide('enemy', boom);
      b.onCollide('boss', boom);
      b.onCollide('solid', boom);
    } else {
      b.onCollide('enemy', (e) => hitEnemy(e, b));
      b.onCollide('boss', (e) => hitBoss(e, b));
      b.onCollide('solid', () => destroy(b));
    }
    p.throwT = 0.26;   // = cadence de tir : la pose de lancer tient pendant la rafale
    sfx('shoot');
  }

  // Explosion de zone (gateau) : onde + miettes + degats a tout dans le rayon.
  function explodeAoe(x, y, radius, dmg) {
    addBoom(x, y);
    safeShake(11);
    sfx('spell');
    const c = vec2(x, y);
    get('enemy').forEach((e) => { if (e.exists() && e.pos.dist(c) < radius) hitEnemy(e, { dmg }); });
    get('boss').forEach((bo) => { if (bo.exists() && bo.pos.dist(c) < radius) hitBoss(bo, { dmg }); });
    get('ehot').forEach((h) => { if (h.exists() && h.pos.dist(c) < radius) destroy(h); });   // nettoie les tirs ennemis pris dans le souffle
  }

  // FX d'explosion : flash + onde de choc qui s'etend + eclats chauds (miettes).
  function addBoom(x, y) {
    add([circle(26), pos(x, y), anchor('center'), color(255, 250, 230), opacity(0.85), z(46), lifespan(0.12, { fade: 0.1 }), 'fx']);  // flash
    const ring = add([circle(10), pos(x, y), anchor('center'), color(255, 236, 180), opacity(0.55), z(45), 'fx', { t: 0 }]);          // onde
    ring.onUpdate(() => {
      ring.t += dt();
      ring.radius = 10 + ring.t * 280;
      ring.opacity = Math.max(0, 0.55 - ring.t * 1.7);
      if (ring.opacity <= 0) destroy(ring);
    });
    const cols = [[255, 196, 58], [255, 150, 70], [214, 120, 60], [120, 80, 40]];   // miettes : doree -> caramel -> croute
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand(-0.2, 0.2);
      const cc = cols[i % cols.length];
      add([
        circle(rand(2.5, 5)), color(cc[0], cc[1], cc[2]), opacity(1),
        pos(x, y), anchor('center'),
        move(vec2(Math.cos(a), Math.sin(a)), rand(160, 320)),
        lifespan(rand(0.3, 0.55), { fade: 0.25 }), 'fx',
      ]);
    }
  }

  // PROJECTILE du boss courant : son def.shot (sprite themE). Pose par spawnBoss.
  let BOSS_SHOT_SPRITE = null;
  function enemyBullet(x, y, target, speed, kind) {
    const dir = target.pos.sub(vec2(x, y)).unit();
    // Projectile THEMATIQUE : boss -> sprite de son def.shot (ex. Michael lance des
    //  courbes, Cendrine des formulaires) ; tirs 'enemy' (ADEME, tampons, chutes du
    //  ciel) -> 'shot_paper'. Sprite oriente vers sa trajectoire. Si le PNG manque,
    //  retour propre a la forme generique (cercle rouge boss / rectangle creme).
    const sname = (kind === 'boss') ? BOSS_SHOT_SPRITE : 'shot_paper';
    const comps = (sname && hasSprite(sname))
      ? [sprite(sname), artScale(), rotate(Math.atan2(dir.y, dir.x) * 180 / Math.PI)]
      : ((kind === 'boss')
          ? [circle(9), color(226, 59, 80), outline(3, rgb(42, 29, 24))]
          : [rect(15, 19, { radius: 2 }), color(244, 241, 232), outline(3, rgb(42, 29, 24))]);
    const b = add([
      ...comps,
      pos(x, y),
      anchor('center'),
      area({ scale: 0.6 }),
      move(dir, speed),
      offscreen({ distance: 160, destroy: true }),
      'ehot',
      { dmg: 1 },
    ]);
    b.onCollide('solid', () => destroy(b));
  }

  // ---------------------------------------------------------------------
  //  HEROS (Laura)
  // ---------------------------------------------------------------------
  function spawnPlayer(x, y) {
    const p = add([
      sprite('hero_idle'),
      artScale(),
      pos(x, y),
      anchor('bot'),
      area({ scale: vec2(0.68, 0.86) }),
      body({ jumpForce: C.player.jumpForce }),
      opacity(1),
      'player',
      {
        hp: C.player.maxHp, maxHp: C.player.maxHp,
        facing: 1, invuln: 0, shielded: 0, throwT: 0, catOutT: 0, catInT: 0,
        aimAngle: C.shot.aimDefault, aiming: false,   // angle de la cloche (deg) regle par HAUT/BAS
        jumpsLeft: C.player.maxJumps,
        ammoKey: C.player.startAmmo,
        fireCd: 0,
        spellCd: { pleurer: 0, raler: 0 },
        sun: C.sun.max,
        score: 0,
        data: 0, pages: 0, gotPubli: false,
        catCharges: C.cat.startCharges,
        catCharge: 0, catLock: false,
        shootCharge: 0,
        _sunCharging: false, _sunShaded: false, sunFlash: 0,   // etat de recharge solaire (HUD glow)
        knockX: 0, knockT: 0,
        equipped: null, _overlay: null,
        _spr: 'hero_idle', _anim: null,
      },
    ]);
    return p;
  }

  function knockPlayer(srcX) {            // recul : s'eloigne de la source
    const p = PLAYER;
    const dir = (srcX != null && srcX > p.pos.x) ? -1 : 1;
    p.knockX = dir * (C.player.knockback || 0);
    p.knockT = C.player.knockTime || 0.2;
  }
  function damagePlayer(dmg, srcX) {
    const p = PLAYER;
    if (p._god || p.invuln > 0 || p.shielded > 0) return;
    knockPlayer(srcX);                     // recul + (l'anim "hurt" se joue via invuln)
    if (p.equipped) {                       // l'equipement encaisse le coup A LA PLACE d'une vie
      loseEquip();
      p.invuln = C.player.invulnTime;
      safeShake(8); sfx('hit');
      return;
    }
    p.hp -= dmg;
    p.invuln = C.player.invulnTime;
    safeShake(6);
    sfx('hit');
    if (p.hp <= 0) { p.hp = 0; loseGame(); }
  }

  // ---------------------------------------------------------------------
  //  SOL & PLATEFORMES
  // ---------------------------------------------------------------------
  function addSolid(x, y, spr) {
    playIfAnim(add([sprite(spr), artScale(), pos(x, y), anchor('topleft'), area(), body({ isStatic: true }), z(-1), 'solid']), spr);
  }

  // --- PANNEAUX SOLAIRES (plateformes) en perspective + pieds au sol -------
  //  La COLLISION reste une tuile invisible 48x48 (surface marchable = haut de
  //  tuile). Le VISUEL est decoratif : un "cap" en perspective (penche vers le
  //  soleil haut-gauche, donc colineaire a l'ombre, cf. SHADE_SLOPE) dont le
  //  bord avant s'aligne sur le haut de tuile, + des pieds (panel_leg) etires
  //  en Y jusqu'au sol de la colonne -> hauteur variable selon l'altitude.

  // Sol (y monde) de la colonne c : haut de la 1ere rangee de terre '='.
  function columnGroundY(c) {
    const grid = LEVEL && LEVEL.grid;
    if (!grid) return LEVEL ? LEVEL.height : C.height;
    for (let r = 0; r < grid.length; r++) if (grid[r] && grid[r][c] === '=') return r * TS;
    return LEVEL.height;
  }

  // ligne marchable a CAP_WALK_Y du haut du cap ; pieds des CAP_LIP sous la tuile.
  const CAP_WALK_Y = 30, LEG_NAT_H = 24, CAP_LIP = 6;

  function addPanelDeco(x, y, spr, tint) {
    const cx = x + TS / 2, c = Math.round(x / TS), objs = [];
    const legH = columnGroundY(c) - (y + CAP_LIP);
    if (legH > 4 && hasSprite('panel_leg')) {                 // pieds etires jusqu'au sol
      const comps = [sprite('panel_leg'), pos(cx, y + CAP_LIP), anchor('top'),
        scale(vec2(1 / ART, (legH / LEG_NAT_H) / ART)), z(-1.2), 'paneldeco'];
      if (tint) comps.push(color(tint[0], tint[1], tint[2]));
      objs.push(add(comps));
    }
    const capComps = [sprite(spr), artScale(), pos(cx, y - CAP_WALK_Y), anchor('top'), z(-1), 'paneldeco'];
    if (tint) capComps.push(color(tint[0], tint[1], tint[2]));
    const cap = add(capComps);
    objs.push(cap);
    return { cap, objs };
  }

  function addPanel(x, y, spr, breakable) {
    const comps = [rect(TS, TS), pos(x, y), anchor('topleft'), opacity(0),
      area(), body({ isStatic: true }), z(-3), 'solid'];                  // tuile de collision invisible
    if (breakable) comps.push('breakable', { crumbling: false });
    const t = add(comps);
    const deco = addPanelDeco(x, y, spr, breakable ? [255, 150, 120] : null);  // rouge = cassable
    t.deco = deco.objs; t.cap = deco.cap;
    if (breakable) t.onCollide('player', (pl) => { if (pl.pos.y <= t.pos.y + 14) startCrumblePanel(t); });
    return t;
  }

  // Panneau cassable : clignote (sur le cap) puis explose -> detruit cap+pieds
  //  + collision, et recalcule l'ombre de la colonne.
  function startCrumblePanel(t) {
    if (t.crumbling) return;
    t.crumbling = true;
    let w = 0;
    t.onUpdate(() => { w += dt(); if (t.cap && t.cap.exists()) t.cap.opacity = (Math.floor(w * 18) % 2) ? 0.35 : 1; });
    wait((C.tile && C.tile.crumbleDelay) || 0.4, () => {
      if (!t.exists()) return;
      for (let i = 0; i < 5; i++) addPoof(t.pos.x + rand(4, TS - 4), t.pos.y + rand(4, TS - 4));
      safeShake(3);
      const gc = Math.round(t.pos.x / TS), gr = Math.round(t.pos.y / TS);
      (t.deco || []).forEach((o) => { if (o.exists()) destroy(o); });
      destroy(t);
      if (LEVEL && LEVEL.grid && LEVEL.grid[gr]) {   // panneau disparu -> son ombre aussi
        LEVEL.grid[gr][gc] = ' ';
        castColumnShade(gc);
      }
    });
  }

  // ---------------------------------------------------------------------
  //  ENNEMIS
  // ---------------------------------------------------------------------
  function spawnEnemy(kind, x, y) {
    const def = C.enemies[kind];
    // Tout ce qui marche au sol a un corps (gravite) -> jamais en l'air :
    //  patrol (camion), chase, jump. fly/shooter/static restent sans corps.
    const needsBody = (def.move === 'patrol' || def.move === 'chase' || def.move === 'jump');
    // skin du monstre : LEVEL.theme.enemies[kind] (par niveau) sinon variante globale
    const sname = pickSkin(LEVEL && LEVEL.theme && LEVEL.theme.enemies[kind], def.sprite);
    const comps = [
      sprite(sname),
      artScale(def.scale),
      pos(x, y),
      anchor('bot'),
      // collisionIgnore 'enemy' -> les monstres ne se bloquent/poussent jamais
      //  entre eux (ils se traversent), mais collisionnent toujours le sol.
      area({ scale: vec2(0.85, 0.9), collisionIgnore: ['enemy'] }),
      // PERF : hors-ecran -> hidden (pas de dessin) + paused (pas d'IA NI de
      //  collision : la grille saute les objets pauses). Seuls les monstres a
      //  l'ecran consomment du CPU -> un niveau large ne ralentit plus.
      //  distance = marge pour qu'ils se "reveillent" avant d'entrer dans le
      //  cadre (> max aggro/2 : ~720px du centre cam, couvre aggro 700).
      offscreen({ hide: true, pause: true, distance: TS * 5 }),
      'enemy', kind,
      {
        kind, def, hp: def.hp, dir: (ENEMY_SEQ % 2 ? 1 : -1), t: 0, homeX: x, homeY: y, stun: 0, knockX: 0, knockT: 0, hopDir: 0,
        // ANTI-EMPILEMENT : decalage perso (cote alterne + distance croissante,
        //  cycle de 8) -> chaque monstre patrouille autour d'un point DECALE du
        //  joueur au lieu de converger sur sa colonne. Mieux pour le jeu (ils
        //  encerclent au lieu de fusionner en un tas) ET pour le CPU (ils
        //  tombent dans des cellules de collision distinctes -> pas de O(k2)).
        standoff: ((ENEMY_SEQ % 2) ? 1 : -1) * TS * (0.6 + (Math.floor(ENEMY_SEQ / 2) % 4) * 0.6),
        phase: (ENEMY_SEQ++ * 1.7) % (Math.PI * 2),
        _patrolling: false, _patrolCenter: x,
      },
    ];
    if (needsBody) comps.splice(4, 0, body());
    const e = add(comps);
    if (def.anim) { try { e.play(def.anim); } catch (er) {} }
    else playIfAnim(e, sname);
    return e;
  }

  // Va-et-vient horizontal : avance dans e.dir et rebrousse aux bords de la
  //  bande [center-half, center+half]. center suit le joueur (poursuite) ou un
  //  point fixe (patrouille locale).
  function patrolSweep(e, center, half) {
    const r = Math.max(half, TS * 0.5);
    e.move(e.dir * e.def.speed, 0);
    if (e.dir > 0 && e.pos.x > center + r) e.dir = -1;
    else if (e.dir < 0 && e.pos.x < center - r) e.dir = 1;
  }

  function enemyBehavior(e) {
    const p = PLAYER;
    if (!p || !p.exists()) return;
    if (e.stun > 0) { e.stun -= dt(); e.t = 0; return; }
    if (e.knockT > 0) { e.knockT -= dt(); e.move(e.knockX, 0); }

    const toP = p.pos.x - e.pos.x;
    e.facing = toP >= 0 ? 1 : -1;

    switch (e.def.move) {
      case 'patrol': {
        e.t += dt();
        if (e.def.aggro && Math.abs(toP) < e.def.aggro) {  // joueur a portee
          // Aller-retour AUTOUR de la colonne du joueur (centre = joueur) :
          //  on patrouille sous lui (meme s'il est sur un panneau) sans jamais
          //  se garer pile dessous. L'ecart perso (gap) etale les exemplaires.
          e._patrolling = false;
          patrolSweep(e, p.pos.x + e.standoff, e.def.range);
        } else {                                            // patrouille locale autour du point d'arret
          if (!e._patrolling) { e._patrolCenter = e.pos.x; e._patrolling = true; }
          patrolSweep(e, e._patrolCenter, e.def.range);
        }
        e.flipX = e.dir > 0;
        break;
      }
      case 'chase': {
        e.t += dt();
        if (Math.abs(toP) < e.def.aggro) {   // patrouille en aller-retour sous le joueur
          patrolSweep(e, p.pos.x + e.standoff, e.def.range || TS * 2.4);
        }
        e.flipX = e.dir > 0;
        break;
      }
      case 'shooter': {
        e.t += dt();
        if (Math.abs(toP) < e.def.range && e.t >= e.def.shotEvery) {
          e.t = 0;
          enemyBullet(e.pos.x, e.pos.y - TS * 0.6, p, e.def.shotSpeed, 'enemy');
        }
        e.flipX = e.facing < 0;
        break;
      }
      case 'fly': {                 // corbeau : patrouille en l'air + ondule
        e.t += dt();
        e.move(e.dir * e.def.speed, 0);
        if (Math.abs(e.pos.x - e.homeX) > e.def.range) e.dir *= -1;
        e.pos.y = e.homeY + Math.sin(e.t * 3) * (e.def.amp || 30);
        e.flipX = e.dir < 0;          // sprite par defaut face a droite -> on ne mirror que vers la gauche
        break;
      }
      case 'jump': {                // criquet : bondit vers le joueur
        e.t += dt();
        const grounded = e.isGrounded ? e.isGrounded() : true;
        if (grounded) {
          e.hopDir = 0;
          if (Math.abs(toP) < e.def.aggro && e.t >= e.def.jumpEvery) {
            e.t = 0; e.hopDir = Math.sign(toP) || 1; e.jump(e.def.jumpForce);
          }
        } else if (e.hopDir) {
          e.move(e.hopDir * e.def.speed, 0);
        }
        e.flipX = e.facing < 0;
        break;
      }
      default: break;               // static
    }
  }

  function hitEnemy(e, bullet) {
    if (bullet && bullet.exists && bullet.exists()) destroy(bullet);
    if (!e.exists()) return;
    if (e.hp === Infinity) return;
    e.hp -= (bullet ? bullet.dmg : 1);
    if (e.hp <= 0) {
      PLAYER.score += e.def.score || 0;
      addPoof(e.pos.x, e.pos.y - TS * 0.5);
      destroy(e);
    } else {
      e.opacity = 0.5;
      wait(0.08, () => { if (e.exists()) e.opacity = 1; });
    }
  }

  function addPoof(x, y) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add([
        circle(4), color(255, 210, 63), opacity(1),
        pos(x, y), anchor('center'),
        move(vec2(Math.cos(a), Math.sin(a)), 180),
        lifespan(0.4, { fade: 0.2 }), 'fx',
      ]);
    }
  }

  // ---------------------------------------------------------------------
  //  BOSS (IA deportee dans js/bosses.js)
  // ---------------------------------------------------------------------
  const BOSS_API = {
    TS: TS,
    bullet: enemyBullet,
    add: (kind, x, y) => spawnEnemy(kind, x, y),
    shake: safeShake,
    poof: addPoof,
  };

  function spawnBoss(key, x, y) {
    const def = C.bosses[key];
    BOSS_SHOT_SPRITE = def.shot || null;         // projectile themE de ce boss (cf. enemyBullet)
    const sname = variant(def.sprite);          // feuille DEPLACEMENT (idle/hurt)
    // feuille ATTAQUE separee (def.attackSprite) ; null si le PNG manque -> on
    //  reste sur la feuille de deplacement (pas de crash).
    const aname = (def.attackSprite && hasSprite(def.attackSprite)) ? variant(def.attackSprite) : null;
    const b = add([
      sprite(sname),
      artScale(def.scale || 1),    // jury (def.scale) rend plus gros (megaboss a 3 membres) ; autres = 1x
      pos(x, y),
      anchor('bot'),
      area({ scale: vec2(0.8, 0.92) }),
      body(),
      opacity(1),
      'boss',
      {
        key, def, spr: sname, sprAtk: aname, hp: def.hp, maxHp: def.maxHp || def.hp,
        t: 0, dir: -1, homeX: x, stun: 0, knockX: 0, knockT: 0,
        hurtT: 0, animWant: 'idle', _spr: sname, _anim: null,
      },
    ]);
    return b;
  }

  function bossBehavior(b) {
    const p = PLAYER;
    if (!p || !p.exists()) return;
    if (b.stun > 0) { b.stun -= dt(); setAnim(b, b.spr, 'idle'); return; }
    if (b.knockT > 0) { b.knockT -= dt(); b.move(b.knockX, 0); }
    const AI = window.BOSS_AI || {};
    const ai = AI[b.def.behavior] || AI.default;
    if (ai) ai(b, p, BOSS_API);
    if (b.hurtT > 0) { b.hurtT -= dt(); b.animWant = 'hurt'; }
    // Garde le boss SUR le sol jouable : empeche une IA (teleport de Cendrine,
    //  charges, va-et-vient) de l'envoyer au-dela du bord droit -> chute dans
    //  le vide -> boss injoignable -> niveau infinissable.
    if (LEVEL && LEVEL.maxX) {
      const lo = TS * 0.5, hi = LEVEL.maxX - TS * 0.5;
      if (b.pos.x < lo) b.pos.x = lo; else if (b.pos.x > hi) b.pos.x = hi;
    }
    bossAnim(b, b.animWant || 'idle');
  }

  // Bascule entre les DEUX feuilles du boss : 'attack' -> feuille _atk (si elle
  //  existe), tout le reste (idle/hurt) -> feuille de deplacement.
  function bossAnim(b, want) {
    const useAtk = want === 'attack' && b.sprAtk;
    setAnim(b, useAtk ? b.sprAtk : b.spr, want);
  }

  function hitBoss(b, bullet) {
    if (bullet && bullet.exists && bullet.exists()) destroy(bullet);
    if (!b.exists()) return;
    b.hp -= (bullet ? bullet.dmg : 1);
    b.hurtT = 0.12;
    b.opacity = 0.55;
    wait(0.08, () => { if (b.exists()) b.opacity = 1; });
    if (b.hp <= 0) {
      PLAYER.score += b.def.score || 0;
      LEVEL.bossesAlive = Math.max(0, LEVEL.bossesAlive - 1);
      for (let i = 0; i < 14; i++) addPoof(b.pos.x + rand(-30, 30), b.pos.y - rand(0, TS * 2));
      spawnPickup('cafe', b.pos.x, b.pos.y - TS);
      destroy(b);
      safeShake(14);
      sfx('boss');
      flashMsg('BOSS BATTU !  Va ecrire ton chapitre (->)');
    }
  }

  // ---------------------------------------------------------------------
  //  CHAT ANGORA (allie deploye)
  // ---------------------------------------------------------------------
  function deployCat() {
    const p = PLAYER;
    if (!p || !p.exists()) return;
    if (get('cat').length) return;            // un seul chat a la fois
    if (p.catCharges <= 0) { flashMsg(C.story.catEmpty); return; }
    p.catCharges--;
    // Laura reste figee sur la pose "chat lance" (sac vide) et immobile tant que le
    //  chat est dehors : gere dans PLAYER.onUpdate via get('cat') (jusqu'au retour).
    const dir = p.facing >= 0 ? 1 : -1;
    const startX = p.pos.x + dir * (C.cat.spawnAhead || 42);  // pose au sol, juste devant Laura
    const cat = add([
      sprite('cat_run'),
      artScale(C.cat.scale || 1),               // plus petit que Laura
      pos(startX, p.pos.y),
      anchor('bot'),
      area({ scale: vec2(0.9, 0.7) }),
      z(40),
      'cat',
      { dir, startX, baseY: p.pos.y, hitBosses: new Set(), phase: 'run' },
    ]);
    cat.flipX = dir < 0;
    try { cat.play('run'); } catch (e) {}
    cat.onCollide('enemy', (e) => hitEnemy(e, { exists: () => false, dmg: C.cat.damage }));
    cat.onCollide('boss', (bo) => {
      if (cat.hitBosses.has(bo)) return;          // 1 seul coup par boss et par chat
      cat.hitBosses.add(bo);
      hitBoss(bo, { exists: () => false, dmg: C.cat.bossDamage });
    });
    cat.onUpdate(() => {
      const sp = C.cat.speed;
      get('ehot').forEach((h) => { if (h.pos.dist(cat.pos) < C.cat.cleanRadius) destroy(h); });  // nettoie les tirs
      if (cat.phase === 'run') {                 // ALLER : court vers l'avant
        cat.move(cat.dir * sp, 0);
        if (Math.abs(cat.pos.x - cat.startX) > C.cat.range) { cat.dir = -cat.dir; cat.flipX = cat.dir < 0; cat.phase = 'back'; }
      } else {                                   // RETOUR : revient vers Laura, disparait en la touchant
        const target = (PLAYER && PLAYER.exists()) ? PLAYER.pos.x : cat.startX;
        cat.dir = target >= cat.pos.x ? 1 : -1;
        cat.flipX = cat.dir < 0;
        cat.move(cat.dir * sp, 0);
        if (Math.abs(cat.pos.x - target) <= (C.cat.catchDist || 26)) {
          if (PLAYER && PLAYER.exists()) PLAYER.catInT = 0.45;   // Laura rattrape le chat (anim de retour)
          addPoof(cat.pos.x, cat.pos.y - 20);
          destroy(cat);
        }
      }
    });
    sfx('spell');
  }

  // ---------------------------------------------------------------------
  //  COLLECTIBLES & SORTIE-CHAPITRE
  // ---------------------------------------------------------------------
  function spawnPickup(kind, x, y) {
    const def = C.pickups[kind];
    if (!def) return null;
    // SKIN PAR NIVEAU : LEVEL.theme.pickups[kind] remplace le sprite du pickup
    //  (ex. 'data' -> 'pickup_graine' au niveau 1). Asset absent -> retour au defaut.
    const themed = LEVEL && LEVEL.theme && LEVEL.theme.pickups && LEVEL.theme.pickups[kind];
    const spr = (themed && hasSprite(themed)) ? themed : def.sprite;
    if (!hasSprite(spr)) return null;                  // asset absent -> on ignore (pas de crash)
    const it = add([
      sprite(variant(spr)), artScale(), pos(x, y), anchor('center'), area(),
      'pickup', kind, { kind, def, baseY: y, t: rand(0, 6.28) },
    ]);
    it.onUpdate(() => { it.t += dt() * 3; it.pos.y = it.baseY + Math.sin(it.t) * 4; });
    playIfAnim(it, spr);
    return it;
  }

  function spawnSun(x, y) {
    const s = add([
      sprite('sun_goal'), pos(x, y), anchor('center'), area({ scale: 0.7 }), artScale(), z(-3), 'sun', { t: 0 },
    ]);
    s.onUpdate(() => { s.t += dt(); s.scale = vec2((1 + Math.sin(s.t * 2) * 0.04) / ART); });
    playIfAnim(s, 'sun_goal');
    return s;
  }

  function collectPickup(it) {
    if (!it.exists()) return;
    const p = PLAYER;
    switch (it.kind) {
      case 'sunray': p.sun = Math.min(C.sun.max, p.sun + C.sun.rayGain); break;
      case 'cafe':   p.hp = Math.min(p.maxHp, p.hp + (it.def.heal || 1)); break;
      case 'data':   p.data++; break;
      case 'page':   p.pages++; break;
      case 'publi':  p.gotPubli = true; flashMsg(C.story.publi); break;
      case 'croquette': p.catCharges = Math.min(C.cat.maxCharges, p.catCharges + 1); break;
      default: break;
    }
    if (it.def.equip) equip(it.def.equip);       // equipement (rollers, etc.)
    p.score += it.def.score || 0;
    sfx('pickup');
    destroy(it);
  }

  // ---------------------------------------------------------------------
  //  EQUIPEMENTS (objets qui changent Laura : rollers, etc.)
  //  overlay = sprite superpose qui suit Laura + copie sa pose.
  // ---------------------------------------------------------------------
  function makeOverlay(eq) {
    if (!eq.overlay || !hasSprite(eq.overlay)) return null;   // pas d'asset -> ignore
    const off = eq.offset || [0, 0];
    const ov = add([
      sprite(eq.overlay), artScale(), pos(PLAYER.pos.x, PLAYER.pos.y), anchor('bot'),
      z(eq.overlayZ != null ? eq.overlayZ : 6), 'overlay', { _pose: null },
    ]);
    playIfAnim(ov, eq.overlay);
    ov.onUpdate(() => {
      const p = PLAYER;
      if (!p || !p.exists()) { destroy(ov); return; }
      ov.pos = vec2(p.pos.x + off[0], p.pos.y + off[1]);
      ov.flipX = p.flipX;
      const a = C.anims && C.anims[eq.overlay];          // synchro de pose si l'overlay l'a
      if (a && a.anims && p._anim && a.anims[p._anim] && ov._pose !== p._anim) {
        try { ov.play(p._anim); ov._pose = p._anim; } catch (e) {}
      }
    });
    return ov;
  }

  function equip(name) {
    const eq = C.equipment && C.equipment[name];
    if (!eq || !PLAYER) return;
    PLAYER.equipped = name;
    if (PLAYER._overlay && PLAYER._overlay.exists()) destroy(PLAYER._overlay);
    PLAYER._overlay = makeOverlay(eq);
    flashMsg(eq.msg || ('EQUIPE : ' + name.toUpperCase()));
  }

  // Laura perd son equipement (au lieu d'une vie) quand elle est touchee.
  function loseEquip() {
    const p = PLAYER;
    if (!p || !p.equipped) return;
    const name = p.equipped;
    if (p._overlay && p._overlay.exists()) { addPoof(p._overlay.pos.x, p._overlay.pos.y - 16); destroy(p._overlay); }
    p._overlay = null; p.equipped = null;
    flashMsg('AIE !  ' + name.toUpperCase() + ' perdu !');
  }

  // ---------------------------------------------------------------------
  //  SORTS
  // ---------------------------------------------------------------------
  function castPleurer() {
    const p = PLAYER, sp = C.spells.pleurer;
    if (p.equipped) return;                 // velo/rollers : on ne peut QUE se deplacer
    if (p.spellCd.pleurer > 0) return;
    p.spellCd.pleurer = sp.cooldown;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      add([
        sprite('fx_tear'), artScale(), pos(p.pos.x, p.pos.y - TS * 0.6), anchor('center'),
        move(vec2(Math.cos(a), Math.sin(a)), 320), opacity(1),
        lifespan(0.5, { fade: 0.25 }), 'fx',
      ]);
    }
    get('enemy').concat(get('boss')).forEach((e) => {
      if (e.pos.dist(p.pos) < sp.radius) {
        const dir = e.pos.x >= p.pos.x ? 1 : -1;
        e.knockX = dir * sp.knockback; e.knockT = 0.3;
      }
    });
    if (sp.clearBullets) get('ehot').forEach((h) => { if (h.pos.dist(p.pos) < sp.radius) destroy(h); });
    sfx('spell');
  }

  function castRaler() {
    const p = PLAYER, sp = C.spells.raler;
    if (p.equipped) return;                 // velo/rollers : on ne peut QUE se deplacer
    if (p.spellCd.raler > 0) return;
    p.spellCd.raler = sp.cooldown;
    p.shielded = sp.duration;
    const bubble = add([
      sprite('fx_grumble'), artScale(), pos(p.pos.x, p.pos.y - TS * 1.4), anchor('center'),
      opacity(1), lifespan(sp.duration, { fade: 0.3 }), z(50), 'fx',
    ]);
    playIfAnim(bubble, 'fx_grumble');
    bubble.onUpdate(() => { if (p.exists()) bubble.pos = vec2(p.pos.x, p.pos.y - TS * 1.4); });
    get('enemy').concat(get('boss')).forEach((e) => {
      if (e.pos.dist(p.pos) < sp.stunRadius) e.stun = Math.max(e.stun || 0, sp.duration);
    });
    sfx('spell');
  }

  // ---------------------------------------------------------------------
  //  DECOR DE FOND
  // ---------------------------------------------------------------------
  //  PARALLAX multi-couches, configurable par niveau (lit LEVEL.theme, qui
  //  derive de CONFIG.theme + LEVELS[x].theme). Chaque couche est en repere
  //  ECRAN (fixed) et defile a `parallax` x la camera : 0 = immobile (ciel),
  //  1 = colle au sol. 'band' = bandeau repete sans couture ; 'scatter' =
  //  sprites disperses qui derivent et se recyclent.
  function buildBackground() {
    const th = (LEVEL && LEVEL.theme) || {};
    if (th.sky) add([rect(C.width, C.height), pos(0, 0), fixed(), z(-40), color(th.sky[0], th.sky[1], th.sky[2]), 'bg']);
    (th.layers || []).forEach((spec) => { spec.scatter ? addScatterLayer(spec, th) : addBandLayer(spec, th); });
  }

  // teinte d'une couche : couche.color > theme.tint -> composant color() (ou rien)
  function layerTint(spec, th) {
    const t = spec.color || th.tint;
    return t ? [color(t[0], t[1], t[2])] : [];
  }

  // BANDEAU repete (sol, collines, ciel...) : N copies fixes que l'on fait
  //  coulisser modulo leur largeur -> defilement infini sans couture.
  function addBandLayer(spec, th) {
    const list = Array.isArray(spec.sprite) ? spec.sprite : [spec.sprite];
    const sname = pickSkin(list, list[0]);
    if (!sname || !hasSprite(sname)) return;
    const par = spec.parallax != null ? spec.parallax : 1;
    const z0  = spec.z != null ? spec.z : -20;
    const op  = spec.opacity != null ? spec.opacity : 1;
    const anc = spec.anchor || 'bot';
    const y   = (spec.y == null || spec.y === 'ground') ? HORIZON_Y : spec.y;
    const sc  = (spec.scale || 1) / ART;
    const tw0 = spec.tileW || 320;
    const count = Math.ceil(C.width / tw0) + 2;
    const objs = [];
    for (let i = 0; i < count; i++) {
      const o = add([sprite(sname), scale(sc), pos(-9999, y), anchor(anc), fixed(), z(z0), opacity(op), 'bg'].concat(layerTint(spec, th)));
      playIfAnim(o, sname);
      objs.push(o);
    }
    objs[0].onUpdate(() => {
      const tw = spec.tileW || ((objs[0].width || 0) * sc) || tw0;
      const off = (((getCam().x * par) % tw) + tw) % tw;
      for (let i = 0; i < objs.length; i++) objs[i].pos.x = i * tw - off;
    });
  }

  // SPRITES DISPERSES (nuages, oiseaux...) : derivent en X dans une fenetre
  //  de largeur `span` et se recyclent -> defilement infini.
  function addScatterLayer(spec, th) {
    const list = Array.isArray(spec.sprite) ? spec.sprite : [spec.sprite];
    const par  = spec.parallax != null ? spec.parallax : 0.3;
    const z0   = spec.z != null ? spec.z : -22;
    const op   = spec.opacity != null ? spec.opacity : 1;
    const sc   = (spec.scale || 1) / ART;
    const n    = spec.count || 7;
    const yMin = spec.yMin != null ? spec.yMin : 36;
    const yMax = spec.yMax != null ? spec.yMax : 150;
    const span = spec.span || (C.width + 260);
    const margin = 130;
    const items = [];
    for (let i = 0; i < n; i++) {
      const sname = pickSkin(list, list[0]);
      if (!sname || !hasSprite(sname)) continue;
      const bx = ((i + 0.5) / n) * span + rand(-span / (n * 2.5), span / (n * 2.5));
      const by = yMin + rand(0, Math.max(0, yMax - yMin));
      const o = add([sprite(sname), scale(sc * rand(0.7, 1.15)), pos(-9999, by), anchor('center'), fixed(), z(z0), opacity(op), 'bg'].concat(layerTint(spec, th)));
      playIfAnim(o, sname);
      items.push({ o, bx });
    }
    if (!items.length) return;
    items[0].o.onUpdate(() => {
      const scroll = getCam().x * par;
      for (const it of items) {
        const x = (((it.bx - scroll) % span) + span) % span;
        it.o.pos.x = x - margin;
      }
    });
  }

  // ---------------------------------------------------------------------
  //  CONSTRUCTION DU NIVEAU depuis l'ASCII
  // ---------------------------------------------------------------------
  function buildLevel(def) {
    ENEMY_SEQ = 0;
    let cols = 0;
    const rows = def.map;
    rows.forEach((r) => { cols = Math.max(cols, r.length); });
    const levelW = cols * TS;

    // THEME du niveau = defaut (CONFIG.theme) + surcharge (LEVELS[x].theme).
    //  tiles/enemies fusionnent cle a cle ; layers/sky/tint se remplacent.
    const dT = C.theme || {}, lT = def.theme || {};
    const theme = {
      sky:     lT.sky || dT.sky,
      tint:    lT.tint || dT.tint,
      layers:  lT.layers || dT.layers || [],
      tiles:   Object.assign({}, dT.tiles, lT.tiles),
      enemies: Object.assign({}, dT.enemies, lT.enemies),
      pickups: Object.assign({}, dT.pickups, lT.pickups),
    };
    // grid MUTABLE (tableaux de caracteres) : un panneau cassable qui explose
    //  remet sa case a ' ' -> inShade() et l'ombre projetee se mettent a jour.
    LEVEL = { width: levelW, height: rows.length * TS, bossesAlive: 0, sun: null, dataTotal: 0, pageTotal: 0, hasPubli: false, grid: rows.map((r) => r.split('')), shadeByCol: {}, theme };

    // Bord droit JOUABLE = derniere case de SOL des 2 rangees du bas. Les
    //  rangees ASCII ne sont pas toujours de meme longueur (la ligne du boss
    //  depasse souvent celle du sol) : sans cette borne, un boss qui avance ou
    //  se teleporte au-dela du sol tombe dans le vide et devient injoignable
    //  -> niveau bloque (cf. clamp dans bossBehavior).
    {
      const g = LEVEL.grid; let gright = 0;
      for (let r = Math.max(0, g.length - 2); r < g.length; r++) {
        const row = g[r] || [];
        for (let c = row.length - 1; c >= 0; c--) {
          if (row[c] === '=' || row[c] === '-' || row[c] === 'x') { if (c > gright) gright = c; break; }
        }
      }
      LEVEL.maxX = (gright + 1) * TS;
    }

    buildBackground();

    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === ' ') continue;
        const x = c * TS, y = r * TS;
        const cx = x + TS / 2, groundY = y + TS;
        switch (ch) {
          case '=': addSolid(x, y, pickSkin(theme.tiles['='], 'tile_soil')); break;
          case '-': addPanel(x, y, pickSkin(theme.tiles['-'], 'tile_panel'), false); break;
          case 'x': addPanel(x, y, pickSkin(theme.tiles['x'], 'tile_panel'), true); break;
          case '@': PLAYER = spawnPlayer(cx, groundY); break;
          case 'o': spawnPickup('sunray', cx, y + TS / 2); break;
          case 'c': spawnPickup('cafe', cx, y + TS / 2); break;
          case 'd': LEVEL.dataTotal++; spawnPickup('data', cx, y + TS / 2); break;
          case 'p': LEVEL.pageTotal++; spawnPickup('page', cx, y + TS / 2); break;
          case 'P': LEVEL.hasPubli = true; spawnPickup('publi', cx, y + TS / 2); break;
          case 'k': spawnPickup('croquette', cx, y + TS / 2); break;
          case 'L': spawnPickup('rollers', cx, y + TS / 2); break;
          case 'Y': spawnPickup('velo', cx, y + TS / 2); break;
          case '^': spawnEnemy('caillou', cx, groundY); break;
          case 'T': spawnEnemy('camion', cx, groundY); break;
          case 'A': spawnEnemy('assureur', cx, groundY); break;
          case 'R': spawnEnemy('ademe', cx, groundY); break;
          case 'V': spawnEnemy('corbeau', cx, groundY - TS * 1.5); break;
          case 'J': spawnEnemy('criquet', cx, groundY); break;
          case 'B': LEVEL.bossesAlive++; spawnBoss(def.boss, cx, groundY); break;
          case '*': LEVEL.sun = spawnSun(cx, y + TS / 2); break;
          default: break;
        }
      }
    });

    // OMBRES PROJETEES sous les panneaux (cf. castColumnShade) : une par colonne.
    for (let c = 0; c < cols; c++) castColumnShade(c);
  }

  // (Re)construit l'ombre PENCHEE d'une colonne depuis l'etat COURANT de la
  //  grille (soleil rasant : cone bleute qui glisse vers la droite jusqu'au
  //  sol, cf. SHADE_SLOPE). Appele au build ET quand un panneau cassable
  //  explose -> son ombre disparait (ou recule au panneau d'en dessous).
  function castColumnShade(c) {
    if (!LEVEL || !LEVEL.grid) return;
    const reg = LEVEL.shadeByCol || (LEVEL.shadeByCol = {});
    if (reg[c]) reg[c].forEach((o) => { if (o.exists()) destroy(o); });
    reg[c] = [];
    const grid = LEVEL.grid, H = grid.length, yBot = H * TS;
    let tr = -1;
    for (let r = 0; r < H; r++) {
      const ch = grid[r] && grid[r][c];
      if (ch === '-' || ch === 'x') { tr = r; break; }     // panneau le plus haut de la colonne
    }
    if (tr < 0) return;
    const x0 = c * TS, yTop = (tr + 1) * TS;
    if (yBot - yTop <= 0) return;
    const dx = (yBot - yTop) * SHADE_SLOPE;                 // decalage horizontal au sol
    // PERF : ombre ancree a SA colonne (pos x0) + points RELATIFS -> offscreen()
    //  peut la cacher hors-cadre (sinon toutes les ombres se redessinent chaque
    //  frame). Cam fixe en Y -> culling en X seul. Marge = TS + dx : couvre le
    //  penche vers la droite pour ne jamais couper une ombre encore visible.
    const sMargin = TS + dx;
    reg[c].push(add([pos(x0, 0), polygon([                  // parallelogramme penche
      vec2(0, yTop), vec2(TS, yTop), vec2(TS + dx, yBot), vec2(dx, yBot),
    ]), color(44, 62, 108), opacity(0.16), z(-0.5), offscreen({ hide: true, distance: sMargin }), 'shade', { col: c }]));
    reg[c].push(add([rect(TS, 7), pos(x0, yTop), color(26, 36, 70), opacity(0.13), z(-0.5), offscreen({ hide: true, distance: sMargin }), 'shade', { col: c }])); // contact
  }

  // Laura est-elle A L'OMBRE PROJETEE d'un panneau ? Le soleil est rasant :
  //  l'ombre d'un panneau '-'/'x' glisse vers la droite a mesure qu'on descend
  //  (cf. SHADE_SLOPE). On remonte donc la diagonale : pour chaque rangee au
  //  dessus de Laura, on regarde la case decalee d'ou viendrait l'ombre.
  function inShade(p) {
    if (!LEVEL || !LEVEL.grid) return false;
    const px = p.pos.x, py = p.pos.y;             // pieds (anchor 'bot')
    const pr = Math.floor(py / TS);
    for (let r = 0; r < pr; r++) {
      const row = LEVEL.grid[r];
      if (!row) continue;
      const shift = Math.max(0, py - (r + 1) * TS) * SHADE_SLOPE;   // sous la base du panneau
      const ch = row[Math.floor((px - shift) / TS)];
      if (ch === '-' || ch === 'x') return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------
  //  HUD — style "carnet de terrain" cosy (Animal Crossing / Dora) :
  //  des cartes cremes arrondies, ombres douces, icones et une jauge
  //  soleil doree. TOUT est peint dans un seul calque fixe (onDraw) :
  //  zero scroll, ordre maitrise, et de vrais panneaux qui ne bavent
  //  plus sur la zone de jeu. Le HUD lit l'etat du joueur en direct.
  //  Largeur d'une frame (= PNG / sliceX) pour dimensionner les icones.
  // ---------------------------------------------------------------------
  const HUD_FRAME_W = {
    heart: 56, pickup_data: 64, pickup_page: 64, pickup_publi: 64,
    pickup_croquette: 56, ammo_graine: 52, ammo_riz: 52, ammo_cookie: 30,
    ammo_gateau: 60, cat_run: 112, pickup_sunray: 64, pickup_cafe: 64,
  };

  function buildHUD() {
    const W = C.width, H = C.height;
    // palette chaude, accordee au ciel (#8FD0F0) et au soleil (#FFD23F)
    const COL = {
      ink: rgb(74, 53, 36), inkSoft: rgb(140, 110, 78),
      cream: rgb(252, 245, 224), creamLo: rgb(241, 226, 192),
      edge: rgb(150, 108, 58), sheen: rgb(255, 253, 243), shadow: rgb(35, 26, 16),
      gold: rgb(255, 196, 58), goldHi: rgb(255, 232, 150),
      track: rgb(108, 90, 64), leaf: rgb(112, 178, 64), sky: rgb(86, 176, 224),
      rose: rgb(228, 96, 112), red: rgb(226, 59, 80), redDk: rgb(150, 28, 46),
    };

    // ---- primitives de dessin (toutes en coordonnees ecran) ----
    const R = (x, y, w, h, o) => drawRect(Object.assign({ pos: vec2(x, y), width: w, height: h }, o));
    function panel(x, y, w, h, r) {
      r = (r == null) ? 12 : r;
      R(x + 3, y + 5, w, h, { radius: r, color: COL.shadow, opacity: 0.20 });               // ombre portee
      R(x, y, w, h, { radius: r, color: COL.creamLo });                                      // fond
      R(x, y, w, Math.max(r + 2, h * 0.5), { radius: r, color: COL.cream });                 // degrade haut
      R(x + 4, y + 4, w - 8, 2, { radius: 1, color: COL.sheen, opacity: 0.8 });              // brillance
      R(x, y, w, h, { radius: r, fill: false, outline: { width: 2.5, color: COL.edge } });   // liseré
    }
    function bar(x, y, w, h, t, fill, hi) {
      t = Math.max(0, Math.min(1, t));
      const r = h / 2;
      R(x, y, w, h, { radius: r, color: COL.track, opacity: 0.85 });
      if (t > 0) {
        const fw = Math.max(h, w * t);
        R(x, y, fw, h, { radius: r, color: fill });
        R(x + 3, y + 2, Math.max(2, fw - 6), Math.max(1, h * 0.34), { radius: r, color: hi, opacity: 0.85 });
      }
      R(x, y, w, h, { radius: r, fill: false, outline: { width: 1.5, color: COL.edge } });
    }
    function icon(name, x, y, tpx, opt) {
      opt = opt || {};
      if (!hasSprite(name)) return;
      const fw = HUD_FRAME_W[name] || 64;
      drawSprite({
        sprite: name, frame: opt.frame || 0, pos: vec2(x, y), anchor: 'center',
        scale: vec2(tpx / fw), opacity: (opt.opacity == null) ? 1 : opt.opacity,
      });
    }
    const T = (txt, x, y, size, col, anchor, opacity) => drawText({
      text: txt, pos: vec2(x, y), size: size, color: col,
      anchor: anchor || 'left', opacity: (opacity == null) ? 1 : opacity,
    });
    function keycap(lbl, x, y) {                 // petite touche clavier
      const w = 8 + lbl.length * 8, h = 18;
      R(x, y, w, h, { radius: 5, color: COL.ink, opacity: 0.85 });
      R(x + 2, y + 2, w - 4, 5, { radius: 3, color: COL.inkSoft, opacity: 0.5 });
      T(lbl, x + w / 2, y + h / 2 + 1, 11, COL.cream, 'center');
    }
    function pip(x, y, on) {                      // pastille (charges du chat)
      drawCircle({ pos: vec2(x, y), radius: 5.5, color: on ? COL.leaf : COL.track, opacity: on ? 1 : 0.5 });
      drawCircle({ pos: vec2(x, y), radius: 5.5, fill: false, outline: { width: 1.5, color: COL.edge } });
    }

    const layer = add([pos(0, 0), fixed(), z(120)]);
    layer.onDraw(() => {
      const p = PLAYER; if (!p) return;
      const t = time();

      // ===== CARTE VITALE (haut-gauche) : coeurs + soleil + recoltes =====
      const vx = 14, vy = 12, vw = 232, vh = 96;
      panel(vx, vy, vw, vh);
      // coeurs (manquants estompes, presents qui respirent)
      for (let i = 0; i < p.maxHp; i++) {
        const full = i < p.hp;
        const bob = full ? Math.sin(t * 4 + i * 0.6) * 1.2 : 0;
        icon('heart', vx + 26 + i * 24, vy + 24 + bob, 21, { frame: full ? 0 : 1, opacity: full ? 1 : 0.28 });
      }
      // jauge soleil = energie = munitions lourdes (avec GLOW de recharge)
      const sy = vy + 47;
      const sbx = vx + 38, sbw = vw - 38 - 16, sbh = 13;
      const sf = p.sun / C.sun.max;
      const fw = Math.max(sbh, sbw * sf);
      const charging = p._sunCharging || p.sunFlash > 0;
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      // halo lumineux derriere la portion remplie tant que ca recharge
      //  (+ flash plus large quand la recharge (re)demarre)
      if (charging) {
        const base = 0.42 + 0.34 * pulse + p.sunFlash * 1.1;
        for (let g = 0; g < 3; g++) {
          const pad = 4 + g * 4 + p.sunFlash * 11;
          R(sbx - pad, sy - pad, fw + pad * 2, sbh + pad * 2,
            { radius: (sbh + pad * 2) / 2, color: COL.goldHi, opacity: Math.max(0, base * (0.55 - g * 0.15)) });
        }
      }
      bar(sbx, sy, sbw, sbh, sf, COL.gold, COL.goldHi);
      // HIGHLIGHT bien visible DANS la barre : tout le remplissage s'eclaire
      //  par a-coups + une bande brillante qui balaye de gauche a droite.
      if (charging) {
        R(sbx, sy, fw, sbh, { radius: sbh / 2, color: COL.goldHi, opacity: 0.30 + 0.40 * pulse });
        const sweep = (t * 0.8) % 1;                 // 0..1 en boucle le long du remplissage
        const bandX = sbx + sweep * fw, bandW = 18;
        const x0 = Math.max(sbx, bandX - bandW / 2), x1 = Math.min(sbx + fw, bandX + bandW / 2);
        if (x1 > x0) R(x0, sy + 1, x1 - x0, sbh - 2, { radius: (sbh - 2) / 2, color: COL.cream, opacity: 0.9 });
      }
      // icone soleil : pulse quand ca recharge, ternie a l'ombre
      const sunPulse = p._sunCharging ? (1 + Math.sin(t * 6) * 0.16) : 1;
      const sunOp = (p._sunShaded && !p._sunCharging) ? 0.45 : 1;
      icon('pickup_sunray', vx + 22, sy + 6, 24 * sunPulse, { opacity: sunOp });
      // recoltes : data / pages / publi
      const cy = vy + 76;
      let cx = vx + 18;
      const dataSkin = (LEVEL.theme.pickups && LEVEL.theme.pickups.data && hasSprite(LEVEL.theme.pickups.data)) ? LEVEL.theme.pickups.data : 'pickup_data';
      icon(dataSkin, cx, cy, 21); cx += 16;
      T(p.data + '/' + LEVEL.dataTotal, cx, cy, 15, COL.ink); cx += 52;
      icon('pickup_page', cx, cy, 21); cx += 16;
      T(p.pages + '/' + LEVEL.pageTotal, cx, cy, 15, COL.ink); cx += 52;
      if (LEVEL.hasPubli) {
        const got = p.gotPubli;
        icon('pickup_publi', cx, cy + (got ? Math.sin(t * 5) * 1.5 : 0), 22, { opacity: got ? 1 : 0.45 });
        T(got ? '100%' : '?', cx + 15, cy, 15, got ? COL.gold : COL.inkSoft);
      }

      // ===== SCORE (haut-droite) =====
      const sw = 156, shh = 50, sxx = W - 14 - sw, syy = 12;
      panel(sxx, syy, sw, shh);
      T('SCORE', sxx + 14, syy + 15, 12, COL.inkSoft);
      T('' + p.score, sxx + sw - 14, syy + shh - 17, 23, COL.ink, 'right');

      // ===== ARME (bas-gauche) =====
      const aw = 196, ah = 44, axx = 14, ayy = H - 14 - ah;
      panel(axx, ayy, aw, ah);
      const am = C.ammoTypes[p.ammoKey];
      const cost = am.cost || 0;
      const poor = C.sun.enabled && p.sun < cost;
      icon(hasSprite(am.sprite) ? am.sprite : 'ammo_graine', axx + 26, ayy + ah / 2, 30);
      T(am.label, axx + 48, ayy + 16, 15, COL.ink);
      if (cost > 0) {                                  // armes lourdes : cout en energie
        icon('pickup_sunray', axx + 52, ayy + 31, 14);
        T('-' + cost, axx + 62, ayy + 31, 13, poor ? COL.red : COL.inkSoft);
      } else {                                         // graine : gratuite, jamais de blocage
        T('GRATUIT', axx + 50, ayy + 31, 12, COL.leaf);
      }
      keycap('MAJ', axx + aw - 42, ayy + 7);

      // ===== CHAT (a droite de l'arme) =====
      const kw = 120, kxx = axx + aw + 8, kyy = ayy;
      panel(kxx, kyy, kw, ah);
      icon('cat_run', kxx + 28, kyy + ah / 2, 44, { frame: 0 });
      for (let i = 0; i < C.cat.maxCharges; i++) pip(kxx + 56 + i * 16, kyy + 15, i < p.catCharges);
      keycap('C', kxx + 50, kyy + 24);

      // ===== SORTS (bas-droite) : Pleurer / Raler =====
      const spw = 132, sph = 44, gap = 8;
      const sp2 = W - 14 - spw, sp1 = sp2 - gap - spw, spy = H - 14 - sph;
      spellPill('PLEURER', 'X', p.spellCd.pleurer, C.spells.pleurer.cooldown, COL.sky, sp1, spy, spw, sph);
      spellPill('RALER', 'V', p.spellCd.raler, C.spells.raler.cooldown, COL.rose, sp2, spy, spw, sph);

      function spellPill(name, key, cd, total, accent, x, y, w, h) {
        panel(x, y, w, h);
        const ready = cd <= 0;
        const fillT = ready ? 1 : 1 - cd / total;
        R(x + 3, y + 3, (w - 6) * Math.max(0, Math.min(1, fillT)), h - 6,
          { radius: 9, color: accent, opacity: ready ? 0.28 : 0.16 });
        drawCircle({ pos: vec2(x + 17, y + h / 2), radius: 7, color: ready ? accent : COL.track, opacity: ready ? 1 : 0.6 });
        drawCircle({ pos: vec2(x + 17, y + h / 2), radius: 7, fill: false, outline: { width: 1.5, color: COL.edge } });
        T(name, x + 32, y + 16, 14, COL.ink);
        if (ready) keycap(key, x + 32, y + 24);
        else T(Math.ceil(cd) + 's', x + 32, y + 30, 13, COL.inkSoft);
      }

      // ===== BOSS (haut-centre) — seulement quand il est engage =====
      //  (a portee de l'ecran, ou des qu'on l'a touche) : sinon la barre
      //  squattait le haut de l'ecran tout le niveau alors qu'il est loin.
      const boss = get('boss')[0];
      if (boss && (boss.hp < boss.maxHp || Math.abs(boss.pos.x - p.pos.x) < W * 0.62)) {
        const bw = 420, bh = 46, bx = W / 2 - bw / 2, by = 12;
        panel(bx, by, bw, bh);
        T(boss.def.name || 'BOSS', bx + bw / 2, by + 13, 13, COL.redDk, 'center');
        bar(bx + 16, by + 26, bw - 32, 13, Math.max(0, boss.hp) / boss.maxHp, COL.red, COL.rose);
      }

      // ===== Triche (bas-centre, discret) =====
      if (C.cheats) {
        T('1-6 niveau   0 finir   G dieu   H plein', W / 2, H - 12, 10, COL.inkSoft, 'center', 0.7);
      }
    });

    return layer;
  }

  function updateHUD() { /* le HUD lit l'etat du joueur en direct dans onDraw */ }

  // ---------------------------------------------------------------------
  //  FIN DE NIVEAU / SAUVEGARDE
  // ---------------------------------------------------------------------
  function persist() { if (SAVE) SAVEAPI.save(SLOT, SAVE); }

  function completeLevel() {
    const p = PLAYER;
    const total = LEVEL.dataTotal + LEVEL.pageTotal;
    const got = p.data + p.pages;
    const pct = total > 0 ? Math.round(got / total * 100) : 100;
    if (SAVE) {
      SAVE.totalScore += p.score;
      SAVE.bestScore = Math.max(SAVE.bestScore, p.score);
      if (CUR_IDX < SAVEAPI.N_LEVELS) {
        SAVE.levelsDone[CUR_IDX] = true;
        if (p.gotPubli) SAVE.publis[CUR_IDX] = true;
        SAVE.dataPct[CUR_IDX] = Math.max(SAVE.dataPct[CUR_IDX] || 0, pct);
        SAVE.unlockedMax = Math.max(SAVE.unlockedMax, CUR_IDX + 1);
        SAVE.cursor = Math.min(C.levels.length - 1, CUR_IDX + 1);
      } else {
        SAVE.juryDone = true;
      }
      persist();
    }
    sfx('win');
    if (CUR_IDX >= SAVEAPI.N_LEVELS) go('win', { score: p.score });
    else go('chapter', { idx: CUR_IDX, score: p.score });
  }

  function loseGame() { sfx('lose'); go('lose', { score: PLAYER ? PLAYER.score : 0 }); }

  function tryReachSun() {
    if (LEVEL.bossesAlive > 0) { flashMsg(C.story.bossWarn); return; }
    completeLevel();
  }

  let _msg = null;
  function flashMsg(txt) {
    if (!txt) return;
    if (_msg && _msg.exists()) destroy(_msg);
    _msg = add([
      text(txt, { size: 22, align: 'center' }), pos(C.width / 2, 90), anchor('center'),
      fixed(), z(200), color(255, 255, 255), opacity(1), lifespan(1.6, { fade: 0.6 }),
    ]);
  }

  // ---------------------------------------------------------------------
  //  SCENE PRINCIPALE (game)
  // ---------------------------------------------------------------------
  scene('game', (levelKey) => {
    CUR_IDX = C.levels.indexOf(levelKey);
    const def = LEVELS[levelKey];
    buildLevel(def);
    if (!PLAYER) { add([text('Pas de @ dans la map !', { size: 24 }), pos(40, 40)]); return; }

    const hud = buildHUD();
    const camY = Math.min(LEVEL.height, C.height) / 2 - CAM_DROP;

    // jauges de charge (suivent Laura, visibles seulement pendant la charge)
    const catBarBg = add([rect(48, 8, { radius: 4 }), pos(0, -999), anchor('center'), color(40, 40, 50), opacity(0), z(60)]);
    const catBar = add([rect(44, 4, { radius: 2 }), pos(0, -999), anchor('left'), color(120, 210, 255), opacity(0), z(61)]);
    const shotBarBg = add([rect(48, 8, { radius: 4 }), pos(0, -999), anchor('center'), color(40, 40, 50), opacity(0), z(60)]);
    const shotBar = add([rect(44, 4, { radius: 2 }), pos(0, -999), anchor('left'), color(255, 170, 60), opacity(0), z(61)]);

    // --- FLECHE DE VISEE (cloches) : trainee de miettes + reticule d'impact -----
    //  Apercu de la VRAIE parabole (meme physique que le projectile), peint en
    //  repere MONDE (objet non-fixed). Visible tant que Laura charge une cloche
    //  (HAUT/BAS reglent l'angle). Le reticule montre ou ca retombe -> la cloche
    //  devient enfin controlable. Palette creme/or/encre du jeu.
    const aimGuide = add([pos(0, 0), z(56)]);
    aimGuide.onDraw(() => {
      const p = PLAYER;
      if (!p || !p.exists() || !p.aiming) return;
      const fx = p.facing >= 0 ? 1 : -1;
      const pw = Math.min(1, p.shootCharge / C.shot.chargeTime);      // puissance courante (0..1)
      const v = arcLaunch(p, pw);
      const g = C.shot.arcGravity;
      const sx = p.pos.x + fx * 22, sy = p.pos.y - TS * 0.6;          // depart = spawn du projectile
      const dy = p.pos.y - sy;                                        // chute jusqu'au niveau des pieds
      const tLand = (-v.vy + Math.sqrt(v.vy * v.vy + 2 * g * dy)) / g;
      const tn = time();
      const warm = () => rgb(255, Math.round(150 + 95 * pw), Math.round(40 + 150 * pw));   // ambre -> creme dore
      const INKC = rgb(60, 40, 26);
      // 1) trainee de miettes le long de la parabole (echantillonnee en temps)
      const N = 13;
      for (let i = 1; i <= N; i++) {
        const f = i / (N + 1), t = f * tLand;
        const x = sx + v.vx * t, y = sy + v.vy * t + 0.5 * g * t * t;
        const shimmer = 0.55 + 0.45 * Math.sin(tn * 7 - i * 0.7);     // lumiere qui "coule" vers la cible
        const op = Math.max(0, (0.85 - f * 0.5) * shimmer);
        const r = 3.2 - f * 1.0;
        drawCircle({ pos: vec2(x, y), radius: r + 1, color: INKC, opacity: op * 0.5 });
        drawCircle({ pos: vec2(x, y), radius: r, color: warm(), opacity: op });
      }
      // 2) reticule au point d'impact predit
      const lx = sx + v.vx * tLand, ly = p.pos.y;
      const pulse = 1 + Math.sin(tn * 6) * 0.12, R = 11 * pulse;
      drawCircle({ pos: vec2(lx, ly), radius: R, fill: false, outline: { width: 3, color: INKC }, opacity: 0.85 });
      drawCircle({ pos: vec2(lx, ly), radius: R, fill: false, outline: { width: 1.5, color: warm() } });
      drawCircle({ pos: vec2(lx, ly), radius: 2.4, color: warm() });
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + tn * 0.8;
        drawCircle({ pos: vec2(lx + Math.cos(a) * R, ly + Math.sin(a) * R), radius: 1.6, color: INKC, opacity: 0.8 });
      }
      // 3) pointe de fleche pixel au depart, orientee vers le lancer, pulsation
      const head = Math.atan2(v.vy, v.vx);
      const len = (16 + 11 * pw) * (1 + Math.sin(tn * 8) * 0.05);
      const wdt = 9 + 3 * pw;
      const bx = sx + Math.cos(head) * 12, by = sy + Math.sin(head) * 12;
      const tip = vec2(bx + Math.cos(head) * len, by + Math.sin(head) * len);
      const nx = Math.cos(head + Math.PI / 2), ny = Math.sin(head + Math.PI / 2);
      const q1 = tip, q2 = vec2(bx + nx * wdt, by + ny * wdt), q3 = vec2(bx - nx * wdt, by - ny * wdt);
      drawTriangle({ p1: q1, p2: q2, p3: q3, color: INKC });          // bord sombre (style pixel)
      const cx = (q1.x + q2.x + q3.x) / 3, cy = (q1.y + q2.y + q3.y) / 3, ins = 0.66;
      drawTriangle({
        p1: vec2(cx + (q1.x - cx) * ins, cy + (q1.y - cy) * ins),
        p2: vec2(cx + (q2.x - cx) * ins, cy + (q2.y - cy) * ins),
        p3: vec2(cx + (q3.x - cx) * ins, cy + (q3.y - cy) * ins),
        color: warm(),
      });
      // 4) anneau de pleine charge (pret a partir au max de portee)
      if (pw >= 0.999) {
        const gr = 13 + Math.sin(tn * 8) * 3;
        drawCircle({ pos: vec2(sx, sy), radius: gr, fill: false, outline: { width: 2, color: rgb(255, 240, 190) }, opacity: 0.5 });
      }
    });

    onKeys(C.controls.jump, () => {
      const p = PLAYER;
      if (aimingLob(p)) return;                            // HAUT sert a VISER la cloche, pas a sauter
      if (p.catCharge > 0 || get('cat').length) return;   // immobile pendant la charge / chat dehors
      const eq = p.equipped && C.equipment && C.equipment[p.equipped];
      const jf = C.player.jumpForce * ((eq && eq.jumpMul) || 1);   // rollers/velo : saute plus haut
      if (p.isGrounded()) { p.jump(jf); p.jumpsLeft = C.player.maxJumps - 1; sfx('jump'); }
      else if (p.jumpsLeft > 0) { p.jump(jf); p.jumpsLeft--; sfx('jump'); }
    });
    onKeys(C.controls.pleurer, castPleurer);
    onKeys(C.controls.raler, castRaler);
    onKeys(C.controls.quit, () => go('overworld'));   // ESC : abandonne le niveau, retour carte
    onKeys(C.controls.switchAmmo, () => {
      const order = C.ammoOrder;
      const i = order.indexOf(PLAYER.ammoKey);
      PLAYER.ammoKey = order[(i + 1) % order.length];
    });

    // --- CHEATS de test (CONFIG.cheats). Mets cheats:false pour le cadeau.
    if (C.cheats) {
      C.levels.forEach((lk, i) => onKeyPress(String(i + 1), () => go('game', lk)));  // 1-6
      onKeyPress('0', () => { LEVEL.bossesAlive = 0; completeLevel(); });            // finir
      onKeyPress('g', () => { PLAYER._god = !PLAYER._god; flashMsg('DIEU ' + (PLAYER._god ? 'ON' : 'OFF')); });
      onKeyPress('h', () => {                                                        // plein
        PLAYER.hp = PLAYER.maxHp; PLAYER.sun = C.sun.max;
        PLAYER.catCharges = C.cat.maxCharges; flashMsg('PLEIN !');
      });
    }

    PLAYER.onCollide('enemy', (e) => damagePlayer(e.def ? e.def.touchDamage : 1, e.pos.x));
    PLAYER.onCollide('boss', (b) => damagePlayer(b.def ? b.def.touchDamage : 2, b.pos.x));
    PLAYER.onCollide('ehot', (h) => { damagePlayer(h.dmg || 1, h.pos.x); if (h.exists()) destroy(h); });
    PLAYER.onCollide('pickup', (it) => collectPickup(it));
    PLAYER.onCollide('sun', () => tryReachSun());

    onUpdate('enemy', enemyBehavior);
    onUpdate('boss', bossBehavior);

    // Pendant un combat de boss : des rayons de soleil (energie/munitions)
    // apparaissent regulierement pres de Laura pour soutenir le combat.
    if (C.sun.enabled && LEVEL.bossesAlive > 0) {
      let drops = 0;
      loop(C.sun.bossDropEvery || 5, () => {
        if (!PLAYER.exists() || !get('boss').length || drops >= 1) return;
        const x = Math.max(TS, Math.min(LEVEL.width - TS, PLAYER.pos.x + rand(-240, 240)));
        const y = PLAYER.pos.y - TS * 0.5 - rand(TS * 0.5, TS * 2.5);
        const it = spawnPickup('sunray', x, y);
        if (!it) return;
        drops++;
        it.onDestroy(() => { drops = Math.max(0, drops - 1); });
      });
    }

    // autopilote de TEST (#auto)
    if (typeof location !== 'undefined' && location.hash.indexOf('auto') >= 0) {
      PLAYER.onUpdate(() => { PLAYER.move(C.player.speed, 0); PLAYER.facing = 1; });
      try {
        loop(0.25, () => { if (PLAYER.exists()) playerShoot(); });
        loop(1.8, () => { if (PLAYER.exists()) castPleurer(); });
        loop(2.3, () => { if (PLAYER.exists()) castRaler(); });
        loop(3.0, () => { if (PLAYER.exists()) PLAYER.jump(C.player.jumpForce); });
        loop(4.0, () => { if (PLAYER.exists()) deployCat(); });
      } catch (e) {}
    }

    PLAYER.onUpdate(() => {
      const p = PLAYER;
      let moving = false;
      const eqv = p.equipped && C.equipment && C.equipment[p.equipped];
      const spd = C.player.speed * ((eqv && eqv.speedMul) || 1);   // rollers = plus rapide
      const aiming = aimingLob(p);                                 // vise une cloche : HAUT/BAS reglent l'angle
      p.aiming = aiming;
      if (aiming) {                                                // incline la cloche pendant la charge
        if (keysDown(C.controls.aimUp))   p.aimAngle = Math.min(C.shot.aimMax, p.aimAngle + C.shot.aimSpeed * dt());
        if (keysDown(C.controls.aimDown)) p.aimAngle = Math.max(C.shot.aimMin, p.aimAngle - C.shot.aimSpeed * dt());
      }
      const crouching = p.isGrounded() && keysDown(C.controls.crouch) && !aiming;   // accroupi (au sol ; BAS sert a viser pendant la charge)
      // CHAT : Laura est IMMOBILE pendant la charge ET tant que le chat n'est pas
      //  revenu (il faut etre immobile pour le lancer, on ne bouge pas pendant la charge).
      const catOut = get('cat').length > 0;
      const catCharging = keysDown(C.controls.cat) && p.catCharges > 0 && !catOut && !p.catLock && !eqv;
      const catBusy = catOut || catCharging;
      if (p.knockT > 0) { p.knockT -= dt(); p.move(p.knockX, 0); }       // recul : pas de controle
      else if (!crouching && !catBusy) {
        if (keysDown(C.controls.left)) { p.move(-spd, 0); p.facing = -1; moving = true; }
        if (keysDown(C.controls.right)) { p.move(spd, 0); p.facing = 1; moving = true; }
      }

      // TIR (energie = munitions). Armes DROITES = rafale en maintenant.
      // Armes EN CLOCHE = CHARGE : plus on maintient X, plus ca part loin ;
      // lancer au relachement.
      const ammoNow = C.ammoTypes[p.ammoKey];
      const cost = ammoNow.cost || 0;
      p.fireCd -= dt();
      if (eqv) {                                        // velo/rollers : on ne peut QUE se deplacer
        p.shootCharge = 0;
      } else if (ammoNow.traj === 'arc') {
        if (keysDown(C.controls.shoot)) {
          p.shootCharge = Math.min(C.shot.chargeTime, p.shootCharge + dt());
        } else if (p.shootCharge > 0) {                 // relache -> on lance
          if (!C.sun.enabled || p.sun >= cost) {
            p.sun = Math.max(0, p.sun - cost);
            playerShoot(p.shootCharge / C.shot.chargeTime);
          }
          p.shootCharge = 0;
        }
      } else {                                          // tir droit : rafale
        p.shootCharge = 0;
        if (keysDown(C.controls.shoot) && p.fireCd <= 0) {
          if (!C.sun.enabled || p.sun >= cost) {
            p.sun = Math.max(0, p.sun - cost);
            playerShoot(1);
            p.fireCd = C.shot.rate;
          } else { p.fireCd = 0.2; }                     // plus assez d'energie
        }
      }

      // CHAT : se charge en MAINTENANT la touche (anti-spam), part une fois plein
      const canCat = p.catCharges > 0 && !get('cat').length && !eqv;
      if (canCat && keysDown(C.controls.cat) && !p.catLock) {
        p.catCharge += dt();
        if (p.catCharge >= C.cat.chargeTime) { deployCat(); p.catCharge = 0; p.catLock = true; }
      } else {
        p.catCharge = 0;
        if (!keysDown(C.controls.cat)) p.catLock = false;
      }
      if (p.catCharge > 0) {
        const f = Math.min(1, p.catCharge / C.cat.chargeTime);
        const by = p.pos.y - TS * 2.1;
        catBarBg.pos = vec2(p.pos.x, by); catBarBg.opacity = 0.7;
        catBar.pos = vec2(p.pos.x - 22, by); catBar.width = 44 * f; catBar.opacity = 1;
        catBar.color = f >= 1 ? rgb(120, 255, 150) : rgb(120, 210, 255);
      } else { catBarBg.opacity = 0; catBar.opacity = 0; }
      if (p.shootCharge > 0) {                          // jauge de charge du lancer (cloche)
        const f = Math.min(1, p.shootCharge / C.shot.chargeTime);
        const by = p.pos.y - TS * 2.7;
        shotBarBg.pos = vec2(p.pos.x, by); shotBarBg.opacity = 0.7;
        shotBar.pos = vec2(p.pos.x - 22, by); shotBar.width = 44 * f; shotBar.opacity = 1;
        shotBar.color = f >= 1 ? rgb(120, 255, 150) : rgb(255, 170, 60);
      } else { shotBarBg.opacity = 0; shotBar.opacity = 0; }

      if (p.isGrounded()) p.jumpsLeft = C.player.maxJumps;

      // animation selon l'etat. Priorite : retour chat > depart chat > lancer >
      // accroupi > saut > touche > course > idle. heroAnim applique l'override
      // d'equipement (velo/rollers -> sprite "Laura sur l'engin").
      // accroupissement progressif : duckProg 0 (debout) -> 1 (accroupi a fond).
      //  En MAINTENANT bas la planche se joue a l'endroit (se baisse) ; au
      //  relachement on la rejoue a l'envers pour se relever. La frame est posee
      //  a la main (pas de play()), donc l'anim suit exactement la progression.
      const dDown = C.player.duckDown || 0.12, dUp = C.player.duckUp || 0.12;
      p.duckProg = crouching
        ? Math.min(1, (p.duckProg || 0) + dt() / dDown)
        : Math.max(0, (p.duckProg || 0) - dt() / dUp);
      const duckSpr = p.isGrounded() && p.duckProg > 0 && hasSprite('hero_duck');
      if (p.catInT > 0) { p.catInT -= dt(); heroAnim(p, 'hero_cat_in', 'cat'); }
      else if (catOut) { heroAnim(p, 'hero_cat_out', 'cat'); }   // figee, sac vide, jusqu'au retour
      else if (p.throwT > 0) {
        p.throwT -= dt();
        const ts = C.ammoTypes[p.ammoKey] && C.ammoTypes[p.ammoKey].throwSprite;   // anim de lancer par arme
        heroAnim(p, (ts && hasSprite(ts)) ? ts : 'hero_throw', 'throw');
      }
      else if (duckSpr) {                               // scrub manuel : frame = progression
        if (p._spr !== 'hero_duck') { p.use(sprite('hero_duck')); p._spr = 'hero_duck'; p._anim = null; }
        const lastF = ((C.anims.hero_duck && C.anims.hero_duck.sliceX) || 7) - 1;
        p.frame = Math.max(0, Math.min(lastF, Math.round(p.duckProg * lastF)));
      }
      else if (!p.isGrounded()) heroAnim(p, 'hero_jump', 'jump');
      else if (p.invuln > C.player.invulnTime - 0.25) heroAnim(p, 'hero_hurt', 'hurt');
      else if (moving) heroAnim(p, 'hero_run', 'run');
      else heroAnim(p, 'hero_idle', 'idle');
      p.flipX = p.facing < 0;
      // accroupie : avec un sprite de duck dedie, pas de "tassage" (le sprite est
      // deja baisse) -> on reduit juste la hitbox. Sinon on tasse Laura (ancre bas
      // -> pieds au sol) pour qu'elle passe sous les projectiles.
      const baseS = 1 / ART;
      if (duckSpr) {
        p.scale = vec2(baseS, baseS);
        if (p.area) p.area.scale = vec2(0.68, 0.55);
      } else {
        p.scale = crouching ? vec2(baseS, baseS * 0.6) : vec2(baseS, baseS);
        if (p.area) p.area.scale = vec2(0.68, 0.86);
      }

      if (p.invuln > 0) { p.invuln -= dt(); p.opacity = (Math.floor(time() * 20) % 2) ? 0.4 : 1; }
      else p.opacity = 1;
      if (p.shielded > 0) { p.shielded -= dt(); p.opacity = 0.85; }
      p.spellCd.pleurer = Math.max(0, p.spellCd.pleurer - dt());
      p.spellCd.raler = Math.max(0, p.spellCd.raler - dt());

      // RECHARGE SOLAIRE (photosynthese) : la jauge remonte toute seule au
      //  soleil, pas a l'ombre d'un panneau. Le front montant (reprise de
      //  recharge : passage ombre->soleil, ou apres avoir depense une arme
      //  lourde) declenche un petit flash de glow dans le HUD.
      if (C.sun.enabled) {
        const shaded = inShade(p);
        const rate = shaded ? (C.sun.regenShade || 0) : (C.sun.regen || 0);
        const charging = (rate > 0 && p.sun < C.sun.max);
        if (charging) p.sun = Math.min(C.sun.max, p.sun + rate * dt());
        if (charging && !p._sunCharging) p.sunFlash = 0.5;
        p.sunFlash = Math.max(0, (p.sunFlash || 0) - dt());
        p._sunCharging = charging;
        p._sunShaded = shaded;
      }

      if (p.pos.y > LEVEL.height + 200) loseGame();

      const half = C.width / 2;
      const cx = Math.max(half, Math.min(LEVEL.width - half, p.pos.x));
      setCam(cx, camY);

      updateHUD(hud);
    });
  });

  // ---------------------------------------------------------------------
  //  SCENES UI
  // ---------------------------------------------------------------------
  function bigText(str, y, size, col, w) {
    add([text(str, { size, align: 'center', width: w || (C.width - 80) }), pos(C.width / 2, y), anchor('center'), color(col[0], col[1], col[2])]);
  }

  scene('title', () => {
    setCam(C.width / 2, C.height / 2);
    if (hasSprite('bg_title')) add([sprite('bg_title', { width: C.width, height: C.height }), pos(0, 0), anchor('topleft'), z(-10)]);
    else add([rect(C.width, C.height), pos(0, 0), color(143, 208, 240), z(-10)]);

    const INK = [58, 36, 22];          // brun fonce (contour / encre)
    const GOLD = [255, 206, 71];       // soleil
    const CREAM = [255, 244, 219];     // creme
    const RED = [226, 74, 60];         // terracotta (accent cirad)

    // texte avec contour 8-directions (lisible sur n'importe quel fond)
    function inkText(str, x, y, size, fill, opts) {
      opts = opts || {};
      const w = opts.width || (C.width - 60);
      const ow = opts.outline || 3;
      const ink = opts.ink || INK;
      const ls = opts.lineSpacing;
      const mk = (dx, dy, col, zz) => add([
        text(str, { size, align: 'center', width: w, lineSpacing: ls }),
        pos(x + dx, y + dy), anchor('center'), color(col[0], col[1], col[2]), z(zz),
      ]);
      const z0 = opts.z || 6;
      if (opts.shadow) mk(0, ow + 3, [20, 12, 8], z0 - 1).use(opacity(0.45));
      for (let a = 0; a < 8; a++) mk(Math.round(Math.cos(a * Math.PI / 4) * ow), Math.round(Math.sin(a * Math.PI / 4) * ow), ink, z0);
      return mk(0, 0, fill, z0 + 1);
    }
    const pill = (x, y, w, h, col, op, r, zz) => add([
      rect(w, h, { radius: r == null ? h / 2 : r }), pos(x, y), anchor('center'),
      color(col[0], col[1], col[2]), opacity(op), z(zz == null ? 4 : zz),
    ]);

    // --- decor : Laura plantee sur l'herbe, en bas a gauche -------------
    add([sprite('hero_idle'), pos(132, C.height - 38), anchor('bot'), artScale(1.7), z(4)]).play('idle');

    // --- titre : grand, dore, contour epais + bob ----------------------
    const titleY = 74;
    const title = inkText(C.story.title, C.width / 2, titleY, 50, GOLD, { outline: 4, shadow: true, z: 8 });
    // --- sous-titre : creme sur ruban terracotta -----------------------
    pill(C.width / 2, 128, 470, 38, RED, 0.9, 19, 5);
    inkText(C.story.subtitle, C.width / 2, 128, 22, CREAM, { outline: 2, ink: [120, 30, 24], z: 6 });
    // --- accroche : une ligne qui claque -------------------------------
    inkText('Des rizieres a la soutenance : bats chaque boss et redige ta these !', C.width / 2, 178, 17, CREAM, { outline: 2, z: 6 });

    // --- bandeau bas : controles -------------------------------------
    pill(C.width / 2, C.height - 22, C.width, 56, [26, 18, 12], 0.5, 0, 3);
    inkText('Q/D ou Fleches : bouger     HAUT : sauter     ESPACE : lancer', C.width / 2, C.height - 33, 14, CREAM, { outline: 2, z: 6 });
    inkText('MAJ : changer d arme     C (2s) : chat     X : pleurer     V : raler', C.width / 2, C.height - 13, 14, [220, 214, 198], { outline: 2, z: 6 });

    // --- invite "ESPACE pour commencer" : pastille doree clignotante ---
    pill(C.width / 2, 430, 348, 44, [40, 26, 16], 0.78, 22, 5);
    const start = inkText(C.story.start, C.width / 2, 430, 22, GOLD, { outline: 3, z: 7 });

    let t = 0;
    onUpdate(() => {
      t += dt();
      title.pos.y = titleY + Math.sin(t * 2) * 3;
      start.opacity = 0.45 + 0.55 * Math.abs(Math.sin(t * 2.6));
    });

    const go1 = () => go('slots');
    onConfirm(go1);
    onClick(go1);
  });

  // --- SELECTION DE SAUVEGARDE (3 slots) ------------------------------
  scene('slots', () => {
    setCam(C.width / 2, C.height / 2);
    if (hasSprite('bg_save')) add([sprite('bg_save', { width: C.width, height: C.height }), pos(0, 0), anchor('topleft'), z(-10)]);
    else add([rect(C.width, C.height), pos(0, 0), color(120, 196, 232), z(-10)]);
    // Les cadres (bandeau + 3 panneaux) sont PEINTS dans bg_save : on ne dessine
    // plus de rectangles, on cale juste le texte dedans. Coords mesurees sur l'image.
    const PANEL_CX = [223, 480, 736];   // centre X des 3 panneaux peints
    const PANEL_TOP = 146;              // bord interieur haut (creme)
    const PANEL_CY = 282;               // centre vertical du panneau

    // --- titre cale dans le bandeau peint du haut ----------------------
    add([text(C.story.slots, { size: 27, align: 'center', width: 440 }), pos(481, 61), anchor('center'), color(74, 44, 24), z(6)]);

    // --- bandeau d'aide en bas (pastille sombre pour lisibilite sur l'herbe) ---
    add([rect(652, 46, { radius: 14 }), pos(480, C.height - 26), anchor('center'), color(28, 18, 12), opacity(0.42), z(3)]);
    add([text('Fleches : choisir     ESPACE : valider     E : effacer', { size: 15, align: 'center' }), pos(480, C.height - 33), anchor('center'), color(255, 244, 222), z(6)]);
    if (!SAVEAPI.persistent) add([text('(sauvegarde non persistante en file:// : sers via http pour garder)', { size: 11, align: 'center' }), pos(480, C.height - 14), anchor('center'), color(255, 200, 178), z(6)]);

    let cur = 0;
    const cards = [];
    let selGlow = null, selArrow = null;

    function render() {
      cards.forEach((c) => c.forEach((o) => destroy(o)));
      cards.length = 0;
      selGlow = null; selArrow = null;
      const data = SAVEAPI.list();
      for (let i = 0; i < 3; i++) {
        const cx = PANEL_CX[i];
        const sel = i === cur;
        const objs = [];
        if (sel) {
          // selection : halo dore pulsant sur le panneau + fleche dodelinante
          selGlow = add([rect(208, 262, { radius: 14 }), pos(cx, PANEL_CY), anchor('center'), color(255, 206, 96), opacity(0.16), z(4)]);
          selArrow = add([polygon([vec2(-10, 0), vec2(10, 0), vec2(0, 13)]), pos(cx, PANEL_TOP - 22), anchor('center'), color(231, 74, 60), outline(3, rgb(120, 32, 26)), z(6)]);
          objs.push(selGlow, selArrow);
        }
        const hc = sel ? [201, 44, 54] : [120, 78, 54];
        objs.push(add([text('SLOT ' + String.fromCharCode(65 + i), { size: 23 }), pos(cx, PANEL_TOP + 26), anchor('center'), color(hc[0], hc[1], hc[2]), z(6)]));
        const d = data[i];
        if (!d) {
          objs.push(add([text('Nouvelle\npartie', { size: 21, align: 'center', lineSpacing: 4 }), pos(cx, PANEL_CY + 8), anchor('center'), color(122, 96, 70), opacity(sel ? 1 : 0.7), z(6)]));
        } else {
          const chap = d.levelsDone.filter(Boolean).length;
          const pub = d.publis.filter(Boolean).length;
          const comp = SAVEAPI.completion(d);
          const lines = [
            d.name || 'LAURA',
            'Chapitres : ' + chap + '/' + SAVEAPI.N_LEVELS,
            'Publis : ' + pub + '/' + SAVEAPI.N_LEVELS,
            'PhD : ' + (d.juryDone ? 'OUI' : 'non'),
            'Complete : ' + comp + '%',
            'Best : ' + d.bestScore,
          ];
          objs.push(add([text(lines.join('\n'), { size: 16, align: 'center', lineSpacing: 6 }), pos(cx, PANEL_CY + 16), anchor('center'), color(58, 38, 26), opacity(sel ? 1 : 0.72), z(6)]));
        }
        cards.push(objs);
      }
    }
    render();

    let t = 0;
    onUpdate(() => {
      t += dt();
      if (selGlow) selGlow.opacity = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(t * 5));
      if (selArrow) selArrow.pos.y = (PANEL_TOP - 22) + Math.sin(t * 6) * 3;
    });

    const pick = () => {
      SLOT = cur;
      SAVE = SAVEAPI.load(cur) || SAVEAPI.fresh('LAURA');
      persist();
      go('overworld');
    };
    onKeyPress('left', () => { cur = (cur + 2) % 3; render(); });
    onKeyPress('right', () => { cur = (cur + 1) % 3; render(); });
    onKeyPress('e', () => { SAVEAPI.erase(cur); render(); });
    onConfirm(pick);
  });

  // --- CARTE DU MONDE (overworld facon Dora) --------------------------
  scene('overworld', () => {
    if (!SAVE) { go('title'); return; }
    setCam(C.width / 2, C.height / 2);

    // --- palette + helpers (carte-tresor) ------------------------------
    const INK = [52, 32, 20];          // brun encre (contours)
    const GOLD = [255, 206, 71];
    const CREAM = [255, 244, 219];
    const RED = [226, 74, 60];
    // texte a contour 8-directions : lisible par-dessus la carte chargee
    function inkText(str, x, y, size, fill, opts) {
      opts = opts || {};
      const ow = opts.outline == null ? 2 : opts.outline;
      const zz = opts.z == null ? 6 : opts.z;
      const mk = (dx, dy, c, zi) => add([
        text(str, { size, align: 'center', width: opts.width }),
        pos(x + dx, y + dy), anchor('center'), color(c[0], c[1], c[2]), z(zi),
      ]);
      if (opts.shadow) mk(0, ow + 2, [16, 10, 6], zz - 1).use(opacity(0.4));
      if (ow > 0) for (let a = 0; a < 8; a++)
        mk(Math.round(Math.cos(a * Math.PI / 4) * ow), Math.round(Math.sin(a * Math.PI / 4) * ow), opts.ink || INK, zz);
      return mk(0, 0, fill, zz + 1);
    }
    const pill = (x, y, w, h, col, op, r, zz) => add([
      rect(w, h, { radius: r == null ? h / 2 : r }), pos(x, y), anchor('center'),
      color(col[0], col[1], col[2]), opacity(op == null ? 1 : op), z(zz == null ? 4 : zz),
    ]);
    const starPts = (R, r) => {
      const p = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2) ? r : R;
        p.push(vec2(Math.cos(a) * rr, Math.sin(a) * rr));
      }
      return p;
    };

    // --- fond de carte (vue de dessus) ---------------------------------
    if (hasSprite('bg_map')) add([sprite('bg_map'), pos(0, 0), anchor('topleft'), artScale(1), z(-10)]);
    else add([rect(C.width, C.height), pos(0, 0), color(143, 208, 240), z(-10)]);
    // cadre facon vieille carte (dessine en outline-only, au-dessus de tout)
    add([pos(0, 0), z(7), {
      draw() {
        drawRect({ pos: vec2(7, 7), width: C.width - 14, height: C.height - 14, radius: 12, fill: false, outline: { width: 6, color: rgb(52, 32, 20) } });
        drawRect({ pos: vec2(13, 13), width: C.width - 26, height: C.height - 26, radius: 8, fill: false, outline: { width: 2, color: rgb(255, 244, 219) }, opacity: 0.6 });
      },
    }]);

    const nodes = C.world.nodes;

    // --- chemin : route en terre lissee (Catmull-Rom) reliant les noeuds ---
    const cr = (p0, p1, p2, p3, t) => {
      const t2 = t * t, t3 = t2 * t;
      return vec2(
        0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      );
    };
    const pts = nodes.map((n) => vec2(n.x, n.y));
    const at = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
    const path = [];
    const SEG = 24;
    for (let i = 0; i < pts.length - 1; i++)
      for (let s = 0; s < SEG; s++) path.push(cr(at(i - 1), at(i), at(i + 1), at(i + 2), s / SEG));
    path.push(pts[pts.length - 1]);
    add([pos(0, 0), z(0.6), {
      draw() {
        for (const p of path) drawCircle({ pos: p, radius: 13, color: rgb(60, 40, 26) });   // liseré
        for (const p of path) drawCircle({ pos: p, radius: 9, color: rgb(214, 180, 126) });  // terre
        let acc = 0;
        for (let i = 1; i < path.length; i++) {
          acc += path[i].dist(path[i - 1]);
          if (acc >= 24) { acc = 0; drawCircle({ pos: path[i], radius: 3, color: rgb(255, 246, 224) }); } // pointillés
        }
      },
    }]);

    // --- noeuds : medaillons stylises ----------------------------------
    nodes.forEach((n, i) => {
      const isJury = i === nodes.length - 1;
      const unlocked = i <= SAVE.unlockedMax;
      const done = (i < SAVEAPI.N_LEVELS) ? SAVE.levelsDone[i] : SAVE.juryDone;
      const R = isJury ? 25 : 21;
      const disc = !unlocked ? [110, 122, 134] : done ? [92, 191, 74] : (isJury ? GOLD : RED);
      add([circle(R), pos(n.x, n.y + 7), anchor('center'), color(16, 10, 6), opacity(0.26), z(1.4)]);            // ombre portee
      add([circle(R), pos(n.x, n.y), anchor('center'), color(disc[0], disc[1], disc[2]), outline(4, rgb(INK[0], INK[1], INK[2])), z(2)]); // disque
      add([circle(R * 0.4), pos(n.x - R * 0.28, n.y - R * 0.34), anchor('center'), color(255, 255, 255), opacity(0.3), z(2.1)]);          // reflet
      // icone centrale : etoile (fini ou jury debloque) sinon numero / cadenas
      if (done || (isJury && unlocked)) {
        add([polygon(starPts(R * 0.55, R * 0.24)), pos(n.x, n.y), anchor('center'), color(255, 255, 255), outline(2, rgb(INK[0], INK[1], INK[2])), z(2.3)]);
      } else if (unlocked) {
        inkText(String(i + 1), n.x, n.y + 1, 18, CREAM, { outline: 2.5, z: 2.2 });
      } else {
        inkText('?', n.x, n.y + 1, 18, [225, 232, 238], { outline: 0, z: 2.2 });
      }
      // banniere du chapitre (au-dessus)
      const lw = Math.max(48, n.label.length * 9 + 18);
      pill(n.x, n.y - R - 16, lw, 21, INK, 0.92, 10, 3);
      add([text(n.label, { size: 13, align: 'center' }), pos(n.x, n.y - R - 16), anchor('center'), color(CREAM[0], CREAM[1], CREAM[2]), z(3.1)]);
      // nom du boss (sous le noeud) — masque si verrouille
      inkText(unlocked ? n.boss : '? ? ?', n.x, n.y + R + 12, 11, unlocked ? [255, 236, 206] : [210, 216, 222], { outline: 2, z: 3 });
    });

    // --- bandeaux titre + aide -----------------------------------------
    pill(C.width / 2, 28, 376, 36, [40, 26, 16], 0.66, 18, 6);
    inkText('CARTE  -  ' + SAVEAPI.completion(SAVE) + '% complete', C.width / 2, 28, 22, GOLD, { outline: 3, shadow: true, z: 7 });
    pill(C.width / 2, C.height - 24, 540, 34, [26, 18, 12], 0.62, 17, 6);
    inkText(C.story.overworld, C.width / 2, C.height - 24, 16, CREAM, { outline: 2, z: 7 });

    // --- Laura sur la carte (se deplace vers le noeud selectionne) ------
    let cur = Math.min(SAVE.cursor, SAVE.unlockedMax);
    const ringR = (i) => (i === nodes.length - 1 ? 25 : 21) + 8;
    const cursorRing = add([circle(ringR(cur)), pos(nodes[cur].x, nodes[cur].y), anchor('center'), color(GOLD[0], GOLD[1], GOLD[2]), outline(3, rgb(120, 78, 20)), opacity(0.85), z(1.6), { t: 0 }]);
    cursorRing.onUpdate(() => { cursorRing.t += dt(); cursorRing.scale = vec2(1 + Math.sin(cursorRing.t * 3.2) * 0.09); });
    const laura = add([sprite('hero_idle'), pos(nodes[cur].x, nodes[cur].y - 24), anchor('bot'), artScale(0.9), z(10)]);
    laura._spr = 'hero_idle'; laura._anim = null;

    laura.onUpdate(() => {
      const tx = nodes[cur].x, ty = nodes[cur].y - 26;
      const dx = tx - laura.pos.x;
      if (Math.abs(dx) > 3) { laura.pos.x += Math.sign(dx) * Math.min(Math.abs(dx), 220 * dt()); laura.flipX = dx < 0; setAnim(laura, 'hero_run', 'run'); }
      else { laura.pos.x = tx; setAnim(laura, 'hero_idle', 'idle'); }
      laura.pos.y += (ty - laura.pos.y) * Math.min(1, 6 * dt());
      cursorRing.pos = vec2(nodes[cur].x, nodes[cur].y);
      cursorRing.radius = ringR(cur);
    });

    const move = (d) => { const n = cur + d; if (n >= 0 && n <= SAVE.unlockedMax && n < nodes.length) { cur = n; SAVE.cursor = cur; persist(); } };
    onKeyPress('left', () => move(-1));
    onKeyPress('right', () => move(1));
    const enter = () => { if (cur <= SAVE.unlockedMax) go('game', nodes[cur].key); };
    onConfirm(enter);
  });

  // --- CHAPITRE GAGNE -------------------------------------------------
  scene('chapter', (data) => {
    setCam(C.width / 2, C.height / 2);
    add([rect(C.width, C.height), pos(0, 0), color(255, 226, 120)]);
    add([sprite('pickup_page'), pos(C.width / 2, 150), anchor('center'), artScale(2.2)]);
    bigText(C.story.chapterDone, 250, 34, [42, 29, 24]);
    const txt = (C.story.chapters[data.idx] || '');
    bigText(txt, 330, 22, [60, 50, 30], C.width - 160);
    bigText(C.story.retry, 460, 20, [42, 29, 24]);
    const next = () => go('overworld');
    onConfirm(next); onClick(next);
  });

  scene('win', (data) => {
    setCam(C.width / 2, C.height / 2);
    add([rect(C.width, C.height), pos(0, 0), color(255, 226, 120)]);
    add([sprite('sun_goal'), pos(C.width / 2, 140), anchor('center'), artScale(1.3)]);
    bigText(C.story.win, 280, 30, [42, 29, 24]);
    const comp = SAVE ? SAVEAPI.completion(SAVE) : 0;
    bigText('Completion : ' + comp + '%    Best : ' + (SAVE ? SAVE.bestScore : (data ? data.score : 0)), 340, 22, [226, 59, 80]);
    bigText(C.story.retry, 420, 22, [42, 29, 24]);
    const again = () => go('overworld');
    onConfirm(again); onClick(again);
  });

  scene('lose', (data) => {
    setCam(C.width / 2, C.height / 2);
    add([rect(C.width, C.height), pos(0, 0), color(90, 110, 130)]);
    add([sprite('hero_hurt'), pos(C.width / 2, 200), anchor('center'), artScale(1.6)]).play('hurt');
    bigText(C.story.lose, 300, 28, [255, 255, 255]);
    bigText('SCORE : ' + (data ? data.score : 0), 350, 24, [255, 226, 120]);
    bigText(C.story.retry, 420, 22, [255, 255, 255]);
    const again = () => go(SAVE ? 'overworld' : 'title');
    onConfirm(again); onClick(again);
  });

  // debug handle
  window.LQ = { get player() { return PLAYER; }, get level() { return LEVEL; }, get save() { return SAVE; } };

  // --- GO ! ------------------------------------------------------------
  if (typeof location !== 'undefined' && location.hash.indexOf('game') >= 0) {
    SLOT = 0; SAVE = SAVEAPI.load(0) || SAVEAPI.fresh('DEV');
    // #game (niveau 1), #gameauto (autopilote), ou cible : #game/niveau4, #gamejury...
    const m = location.hash.match(/(niveau[1-9]|jury)/);
    go('game', (m && C.levels.indexOf(m[1]) >= 0) ? m[1] : C.levels[0]);
  } else if (typeof location !== 'undefined' && location.hash.indexOf('map') >= 0) {
    SLOT = 0; SAVE = SAVEAPI.load(0) || SAVEAPI.fresh('DEV');   // #map : carte du monde (dev)
    go('overworld');
  } else {
    go('title');
  }
})();
