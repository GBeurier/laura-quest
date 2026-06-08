/* =====================================================================
 *  GAME — Le moteur de "Laura Quest".
 *  Lit CONFIG (js/config.js) et LEVELS (js/level.js).
 *  Moteur : KAPLAY (engine/kaplay.js), 100% cote client.
 * ===================================================================== */
(() => {
  'use strict';
  const C = window.CONFIG;
  const LEVELS = window.LEVELS;

  // --- Init KAPLAY (mode global : add(), sprite(), etc. accessibles) ---
  kaplay({
    width: C.width,
    height: C.height,
    background: C.background,
    global: true,
    crisp: false,
    touchToMouse: true,
    pixelDensity: 1,
  });
  setGravity(C.gravity);

  // ---------------------------------------------------------------------
  //  CAPTURE CLAVIER (IMPORTANT)
  //  KAPLAY ecoute le clavier SUR LE CANVAS : il faut donc que le canvas
  //  garde le focus, sinon les touches partent au navigateur (recherche
  //  dans la page) et le jeu ne recoit plus rien.
  // ---------------------------------------------------------------------
  (function keepKeyboard() {
    const cv = document.querySelector('canvas');
    const focusCv = () => { try { cv && cv.focus({ preventScroll: true }); } catch (e) {} };
    if (cv) {
      cv.setAttribute('tabindex', '0');
      cv.style.outline = 'none';
      focusCv();
      // re-attrape le focus a la moindre interaction et s'il s'echappe
      ['load', 'pointerdown', 'pointerup', 'click', 'touchstart'].forEach((ev) =>
        window.addEventListener(ev, focusCv, true));
      cv.addEventListener('focusout', focusCv);
    }
    // empeche le navigateur d'agir sur les touches du jeu (recherche, scroll)
    const toKey = (k) => ({
      left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
      space: ' ', enter: 'Enter', shift: 'Shift', escape: 'Escape', tab: 'Tab',
    }[k] || k);
    const block = new Set(['/', "'"]);   // declencheurs de recherche rapide (Firefox)
    Object.values(C.controls).forEach((arr) => arr.forEach((k) => block.add(toKey(k))));
    window.addEventListener('keydown', (e) => {
      if (cv && document.activeElement !== cv) focusCv();
      if (block.has(e.key)) e.preventDefault();
    }, true);
  })();

  // --- Petits helpers compat / utilitaires -----------------------------
  const setCam = (x, y) =>
    (typeof setCamPos === 'function' ? setCamPos(vec2(x, y)) : camPos(vec2(x, y)));
  const safeShake = (n) => { try { shake(n); } catch (e) {} };
  const sfx = (name, opts) => {
    if (!C.audio || !C.audio.enabled) return;
    try { play(name, Object.assign({ volume: C.audio.volume }, opts || {})); } catch (e) {}
  };
  const keysDown = (arr) => arr.some((k) => isKeyDown(k));
  const onKeys = (arr, cb) => arr.forEach((k) => onKeyPress(k, cb));

  // ---------------------------------------------------------------------
  //  CHARGEMENT DES ASSETS
  // ---------------------------------------------------------------------
  const SPRITES = [
    'hero_idle', 'hero_run', 'hero_jump', 'hero_hurt',
    'ammo_graine', 'ammo_cookie', 'ammo_gateau',
    'enemy_caillou', 'enemy_camion', 'enemy_assureur', 'enemy_ademe',
    'boss_directeur1', 'boss_directeur2',
    'pickup_sunray', 'pickup_cafe', 'sun_goal',
    'tile_soil', 'tile_panel', 'heart', 'fx_tear', 'fx_grumble',
    'bg_field', 'bg_cloud',
  ];
  // Source d'un asset : embarque en base64 (window.ASSETS, marche en file://)
  // sinon fichier sur disque (necessite un serveur local).
  const SPR_SRC = (n) => (window.ASSETS && window.ASSETS.sprites[n]) || ('assets/sprites/' + n + '.png');
  const SND_SRC = (n) => (window.ASSETS && window.ASSETS.sounds[n]) || ('assets/sounds/' + n + '.wav');
  SPRITES.forEach((n) => loadSprite(n, SPR_SRC(n)));
  if (C.audio && C.audio.enabled) {
    ['shoot', 'jump', 'hit', 'pickup', 'spell', 'boss', 'win', 'lose']
      .forEach((n) => { try { loadSound(n, SND_SRC(n)); } catch (e) {} });
  }

  // ---------------------------------------------------------------------
  //  ETAT PARTAGE (rempli a chaque demarrage de niveau)
  // ---------------------------------------------------------------------
  let PLAYER = null;
  let LEVEL = null;      // { width, height, bossesAlive, sun }
  const TS = C.tileSize;

  const setSpr = (o, name) => {
    if (o._spr !== name) { o.use(sprite(name)); o._spr = name; }
  };

  // ---------------------------------------------------------------------
  //  PROJECTILES
  // ---------------------------------------------------------------------
  function playerShoot() {
    const p = PLAYER;
    const ammo = C.ammoTypes[p.ammoKey];
    const dir = p.facing >= 0 ? RIGHT : LEFT;
    const b = add([
      sprite(ammo.sprite),
      pos(p.pos.x + p.facing * 22, p.pos.y - TS * 0.6),
      anchor('center'),
      area(),
      move(dir, ammo.speed),
      offscreen({ distance: 120, destroy: true }),
      'pbullet',
      { dmg: ammo.damage },
    ]);
    b.onCollide('enemy', (e) => hitEnemy(e, b));
    b.onCollide('boss', (e) => hitEnemy(e, b));
    b.onCollide('solid', () => destroy(b));
    sfx('shoot');
  }

  function enemyBullet(x, y, target, speed, kind) {
    const dir = target.pos.sub(vec2(x, y)).unit();
    const comps = (kind === 'boss')
      ? [circle(9), color(226, 59, 80), outline(3, rgb(42, 29, 24))]
      : [rect(15, 19, { radius: 2 }), color(244, 241, 232), outline(3, rgb(42, 29, 24))];
    const b = add([
      ...comps,
      pos(x, y),
      anchor('center'),
      area(),
      move(dir, speed),
      offscreen({ distance: 140, destroy: true }),
      'ehot',
      { dmg: 1 },
    ]);
    b.onCollide('solid', () => destroy(b));
  }

  // ---------------------------------------------------------------------
  //  HEROS
  // ---------------------------------------------------------------------
  function spawnPlayer(x, y) {
    const p = add([
      sprite('hero_idle'),
      pos(x, y),
      anchor('bot'),
      area({ scale: vec2(0.68, 0.86) }),
      body({ jumpForce: C.player.jumpForce }),
      opacity(1),
      'player',
      {
        hp: C.player.maxHp, maxHp: C.player.maxHp,
        facing: 1, invuln: 0, shielded: 0,
        jumpsLeft: C.player.maxJumps,
        ammoKey: C.player.startAmmo,
        fireCd: 0,
        spellCd: { pleurer: 0, raler: 0 },
        sun: C.sun.max,
        score: 0,
        _spr: 'hero_idle',
      },
    ]);
    return p;
  }

  function damagePlayer(dmg) {
    const p = PLAYER;
    if (p.invuln > 0 || p.shielded > 0) return;
    p.hp -= dmg;
    p.invuln = C.player.invulnTime;
    safeShake(6);
    sfx('hit');
    if (p.hp <= 0) {
      p.hp = 0;
      loseGame();
    }
  }

  // ---------------------------------------------------------------------
  //  SOL & PLATEFORMES
  // ---------------------------------------------------------------------
  function addSolid(x, y, spr) {
    add([
      sprite(spr),
      pos(x, y),
      anchor('topleft'),
      area(),
      body({ isStatic: true }),
      z(-1),
      'solid',
    ]);
  }

  // ---------------------------------------------------------------------
  //  ENNEMIS
  // ---------------------------------------------------------------------
  function spawnEnemy(kind, x, y) {
    const def = C.enemies[kind];
    const needsBody = def.move === 'chase';   // seuls les marcheurs ont la gravite
    const comps = [
      sprite(def.sprite),
      pos(x, y),
      anchor('bot'),
      area({ scale: vec2(0.85, 0.9) }),
      'enemy', kind,
      { kind, def, hp: def.hp, dir: -1, t: 0, homeX: x, stun: 0, knockX: 0, knockT: 0 },
    ];
    if (needsBody) comps.splice(4, 0, body());
    return add(comps);
  }

  function enemyBehavior(e) {
    const p = PLAYER;
    if (!p || !p.exists()) return;

    // assomme (sort raler)
    if (e.stun > 0) { e.stun -= dt(); e.t = 0; return; }
    // recul (sort pleurer)
    if (e.knockT > 0) { e.knockT -= dt(); e.move(e.knockX, 0); }

    const toP = p.pos.x - e.pos.x;
    e.facing = toP >= 0 ? 1 : -1;

    switch (e.def.move) {
      case 'patrol': {            // camion : va-et-vient
        e.move(e.dir * e.def.speed, 0);
        if (Math.abs(e.pos.x - e.homeX) > e.def.range) e.dir *= -1;
        e.flipX = e.dir > 0;      // sprite dessine vers la gauche par defaut
        break;
      }
      case 'chase': {             // assureur : te suit
        if (Math.abs(toP) < e.def.aggro) e.move(Math.sign(toP) * e.def.speed, 0);
        e.flipX = e.facing < 0;
        break;
      }
      case 'shooter': {           // rapport ADEME : tire la paperasse
        e.t += dt();
        if (Math.abs(toP) < e.def.range && e.t >= e.def.shotEvery) {
          e.t = 0;
          enemyBullet(e.pos.x, e.pos.y - TS * 0.6, p, e.def.shotSpeed, 'enemy');
        }
        e.flipX = e.facing < 0;
        break;
      }
      default: break;             // caillou : statique
    }
  }

  function hitEnemy(e, bullet) {
    if (bullet && bullet.exists()) destroy(bullet);
    if (!e.exists()) return;
    if (e.hp === Infinity) { return; }   // caillou/camion : indestructibles
    e.hp -= (bullet ? bullet.dmg : 1);
    if (e.hp <= 0) {
      PLAYER.score += e.def.score || 0;
      addPoof(e.pos.x, e.pos.y - TS * 0.5);
      destroy(e);
    } else {
      // petit flash : on baisse l'opacite un instant
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
        lifespan(0.4, { fade: 0.2 }),
        'fx',
      ]);
    }
  }

  // ---------------------------------------------------------------------
  //  BOSS
  // ---------------------------------------------------------------------
  function spawnBoss(key, x, y) {
    const def = C.bosses[key];
    const b = add([
      sprite(def.sprite),
      pos(x, y),
      anchor('bot'),
      area({ scale: vec2(0.8, 0.92) }),
      body(),
      opacity(1),
      'boss',
      { key, def, hp: def.hp, maxHp: def.hp, t: 0, dir: -1, homeX: x, stun: 0, knockX: 0, knockT: 0 },
    ]);
    return b;
  }

  function bossBehavior(b) {
    const p = PLAYER;
    if (!p || !p.exists()) return;
    if (b.stun > 0) { b.stun -= dt(); return; }

    const toP = p.pos.x - b.pos.x;
    b.facing = toP >= 0 ? 1 : -1;
    b.flipX = b.facing > 0;        // boss dessine en pointant vers la gauche

    // avance lentement vers le joueur en restant dans son arene
    if (Math.abs(p.pos.x - b.homeX) < 600 && Math.abs(b.pos.x - b.homeX) < b.def.range) {
      b.move(Math.sign(toP) * b.def.speed, 0);
    }
    // tirs en eventail
    b.t += dt();
    if (b.t >= b.def.shotEvery) {
      b.t = 0;
      const base = p.pos.sub(b.pos.add(0, -TS)).unit();
      [-0.18, 0, 0.18].forEach((spread) => {
        const d = base.rotate(spread * 57.3);
        const tgt = { pos: b.pos.add(d.scale(100)) };
        enemyBullet(b.pos.x, b.pos.y - TS, tgt, b.def.shotSpeed, 'boss');
      });
    }
  }

  function hitBoss(b, bullet) {
    if (bullet && bullet.exists()) destroy(bullet);
    if (!b.exists()) return;
    b.hp -= (bullet ? bullet.dmg : 1);
    b.opacity = 0.55;
    wait(0.08, () => { if (b.exists()) b.opacity = 1; });
    if (b.hp <= 0) {
      PLAYER.score += b.def.score || 0;
      LEVEL.bossesAlive = Math.max(0, LEVEL.bossesAlive - 1);
      for (let i = 0; i < 14; i++) addPoof(b.pos.x + rand(-30, 30), b.pos.y - rand(0, TS * 2));
      // le boss laisse tomber un cafe
      spawnPickup('cafe', b.pos.x, b.pos.y - TS);
      destroy(b);
      safeShake(14);
      sfx('boss');
    }
  }

  // ---------------------------------------------------------------------
  //  COLLECTIBLES & SOLEIL
  // ---------------------------------------------------------------------
  function spawnPickup(kind, x, y) {
    const def = C.pickups[kind];
    const it = add([
      sprite(def.sprite),
      pos(x, y),
      anchor('center'),
      area(),
      'pickup', kind,
      { kind, def, baseY: y, t: rand(0, 6.28) },
    ]);
    it.onUpdate(() => {            // petit flottement
      it.t += dt() * 3;
      it.pos.y = it.baseY + Math.sin(it.t) * 4;
    });
    return it;
  }

  function spawnSun(x, y) {
    const s = add([
      sprite('sun_goal'),
      pos(x, y),
      anchor('center'),
      area({ scale: 0.7 }),
      scale(1),
      'sun',
      { t: 0 },
    ]);
    s.onUpdate(() => { s.t += dt(); s.scale = vec2(1 + Math.sin(s.t * 2) * 0.04); });
    return s;
  }

  function collectPickup(it) {
    if (!it.exists()) return;
    const p = PLAYER;
    if (it.kind === 'sunray') {
      p.sun = Math.min(C.sun.max, p.sun + C.sun.rayGain);
    } else if (it.kind === 'cafe') {
      p.hp = Math.min(p.maxHp, p.hp + (it.def.heal || 1));
    }
    p.score += it.def.score || 0;
    sfx('pickup');
    destroy(it);
  }

  // ---------------------------------------------------------------------
  //  SORTS
  // ---------------------------------------------------------------------
  function castPleurer() {
    const p = PLAYER, sp = C.spells.pleurer;
    if (p.spellCd.pleurer > 0) return;
    p.spellCd.pleurer = sp.cooldown;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      add([
        sprite('fx_tear'), pos(p.pos.x, p.pos.y - TS * 0.6), anchor('center'),
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
    if (p.spellCd.raler > 0) return;
    p.spellCd.raler = sp.cooldown;
    p.shielded = sp.duration;
    const bubble = add([
      sprite('fx_grumble'), pos(p.pos.x, p.pos.y - TS * 1.4), anchor('center'),
      opacity(1), lifespan(sp.duration, { fade: 0.3 }), z(50), 'fx',
    ]);
    bubble.onUpdate(() => { if (p.exists()) bubble.pos = vec2(p.pos.x, p.pos.y - TS * 1.4); });
    get('enemy').concat(get('boss')).forEach((e) => {
      if (e.pos.dist(p.pos) < sp.stunRadius) e.stun = Math.max(e.stun || 0, sp.duration);
    });
    sfx('spell');
  }

  // ---------------------------------------------------------------------
  //  DECOR DE FOND (parallax simple)
  // ---------------------------------------------------------------------
  function buildBackground(levelW) {
    // bande de riziere + panneaux, repetee sur toute la largeur
    for (let x = 0; x < levelW + 320; x += 318) {
      add([sprite('bg_field'), pos(x, C.height - 128), anchor('topleft'), z(-20), opacity(0.95), 'bg']);
    }
    // quelques nuages
    const clouds = [[120, 70], [520, 110], [900, 60], [1400, 95], [1900, 70], [2500, 100], [3100, 65], [3700, 90]];
    clouds.forEach(([cx, cy]) => {
      if (cx < levelW) add([sprite('bg_cloud'), pos(cx, cy), anchor('center'), z(-18), 'bg']);
    });
  }

  // ---------------------------------------------------------------------
  //  CONSTRUCTION DU NIVEAU depuis l'ASCII
  // ---------------------------------------------------------------------
  function buildLevel(def) {
    let cols = 0;
    const rows = def.map;
    rows.forEach((r) => { cols = Math.max(cols, r.length); });
    const levelW = cols * TS;

    buildBackground(levelW);

    LEVEL = { width: levelW, height: rows.length * TS, bossesAlive: 0, sun: null };

    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === ' ') continue;
        const x = c * TS, y = r * TS;
        const cx = x + TS / 2, groundY = y + TS;   // pied de case
        switch (ch) {
          case '=': addSolid(x, y, 'tile_soil'); break;
          case '-': addSolid(x, y, 'tile_panel'); break;
          case '@': PLAYER = spawnPlayer(cx, groundY); break;
          case 'o': spawnPickup('sunray', cx, y + TS / 2); break;
          case 'c': spawnPickup('cafe', cx, y + TS / 2); break;
          case '^': spawnEnemy('caillou', cx, groundY); break;
          case 'T': spawnEnemy('camion', cx, groundY); break;
          case 'A': spawnEnemy('assureur', cx, groundY); break;
          case 'R': spawnEnemy('ademe', cx, groundY); break;
          case 'B': LEVEL.bossesAlive++; spawnBoss(def.boss, cx, groundY); break;
          case '*': LEVEL.sun = spawnSun(cx, y + TS / 2); break;
          default: break;
        }
      }
    });
  }

  // ---------------------------------------------------------------------
  //  HUD (interface fixe a l'ecran)
  // ---------------------------------------------------------------------
  function buildHUD() {
    const hud = {};
    hud.hearts = [];
    for (let i = 0; i < PLAYER.maxHp; i++) {
      hud.hearts.push(add([
        sprite('heart'), pos(16 + i * 30, 16), anchor('topleft'), fixed(), z(100), scale(0.9),
      ]));
    }
    // jauge soleil
    hud.sunBg = add([rect(180, 14, { radius: 7 }), pos(16, 50), color(40, 40, 50), opacity(0.6), fixed(), z(100)]);
    hud.sunBar = add([rect(176, 10, { radius: 5 }), pos(18, 52), color(255, 210, 63), fixed(), z(101)]);
    hud.sunLbl = add([text('SOLEIL', { size: 12 }), pos(204, 49), fixed(), z(101), color(255, 255, 255)]);

    hud.score = add([text('SCORE 0', { size: 18 }), pos(C.width - 16, 16), anchor('topright'), fixed(), z(100), color(255, 255, 255)]);
    hud.ammo = add([text('', { size: 16 }), pos(16, C.height - 28), fixed(), z(100), color(255, 255, 255)]);
    hud.spells = add([text('', { size: 14 }), pos(C.width - 16, C.height - 26), anchor('topright'), fixed(), z(100), color(255, 255, 255)]);

    // barre de boss (cachee tant qu'aucun boss en vie)
    hud.bossBg = add([rect(360, 16, { radius: 8 }), pos(C.width / 2, 18), anchor('top'), color(40, 40, 50), opacity(0), fixed(), z(100)]);
    hud.bossBar = add([rect(354, 12, { radius: 6 }), pos(C.width / 2, 20), anchor('top'), color(226, 59, 80), opacity(0), fixed(), z(101)]);
    return hud;
  }

  function updateHUD(hud) {
    const p = PLAYER;
    for (let i = 0; i < hud.hearts.length; i++) hud.hearts[i].opacity = i < p.hp ? 1 : 0.2;
    hud.sunBar.width = 176 * Math.max(0, p.sun) / C.sun.max;
    hud.score.text = 'SCORE ' + p.score;
    const am = C.ammoTypes[p.ammoKey];
    hud.ammo.text = 'MUNITION : ' + am.label + '  (MAJ)';
    const cdP = Math.max(0, p.spellCd.pleurer), cdR = Math.max(0, p.spellCd.raler);
    hud.spells.text =
      'PLEURER ' + (cdP > 0 ? Math.ceil(cdP) + 's' : 'PRET') +
      '   RALER ' + (cdR > 0 ? Math.ceil(cdR) + 's' : 'PRET');

    const boss = get('boss')[0];
    if (boss) {
      hud.bossBg.opacity = 0.6; hud.bossBar.opacity = 1;
      hud.bossBar.width = 354 * Math.max(0, boss.hp) / boss.maxHp;
    } else {
      hud.bossBg.opacity = 0; hud.bossBar.opacity = 0;
    }
  }

  // ---------------------------------------------------------------------
  //  FIN DE PARTIE
  // ---------------------------------------------------------------------
  let LEVEL_IDX = 0;
  function winGame() { sfx('win'); go('win', { score: PLAYER ? PLAYER.score : 0 }); }
  function loseGame() { sfx('lose'); go('lose', { score: PLAYER ? PLAYER.score : 0 }); }

  function tryReachSun() {
    if (LEVEL.bossesAlive > 0) {
      flashMsg(C.story.bossWarn);
      return;
    }
    winGame();
  }

  let _msg = null;
  function flashMsg(txt) {
    if (_msg && _msg.exists()) destroy(_msg);
    _msg = add([
      text(txt, { size: 22, align: 'center' }), pos(C.width / 2, 90), anchor('center'),
      fixed(), z(200), color(255, 255, 255), opacity(1), lifespan(1.6, { fade: 0.6 }),
    ]);
  }

  // ---------------------------------------------------------------------
  //  SCENE PRINCIPALE
  // ---------------------------------------------------------------------
  scene('game', (levelKey) => {
    const def = LEVELS[levelKey];
    buildLevel(def);
    if (!PLAYER) { add([text('Pas de @ dans la map !', { size: 24 }), pos(40, 40)]); return; }

    const hud = buildHUD();
    const camY = Math.min(LEVEL.height, C.height) / 2;

    // --- controles "presses" -----------------------------------------
    onKeys(C.controls.jump, () => {
      const p = PLAYER;
      if (p.isGrounded()) { p.jump(C.player.jumpForce); p.jumpsLeft = C.player.maxJumps - 1; sfx('jump'); }
      else if (p.jumpsLeft > 0) { p.jump(C.player.jumpForce); p.jumpsLeft--; sfx('jump'); }
    });
    onKeys(C.controls.pleurer, castPleurer);
    onKeys(C.controls.raler, castRaler);
    onKeys(C.controls.switchAmmo, () => {
      const order = C.ammoOrder;
      const i = order.indexOf(PLAYER.ammoKey);
      PLAYER.ammoKey = order[(i + 1) % order.length];
    });

    // --- collisions du joueur ----------------------------------------
    PLAYER.onCollide('enemy', (e) => damagePlayer(e.def ? e.def.touchDamage : 1));
    PLAYER.onCollide('boss', (b) => damagePlayer(b.def ? b.def.touchDamage : 2));
    PLAYER.onCollide('ehot', (h) => { damagePlayer(h.dmg || 1); if (h.exists()) destroy(h); });
    PLAYER.onCollide('pickup', (it) => collectPickup(it));
    PLAYER.onCollide('sun', () => tryReachSun());

    // --- tirs ennemis qui touchent le pbullet ? (ignore) -------------
    onCollide('pbullet', 'boss', (b, bo) => hitBoss(bo, b));

    // --- update global -----------------------------------------------
    onUpdate('enemy', enemyBehavior);
    onUpdate('boss', bossBehavior);

    // --- autopilote de TEST (index.html#gameauto) : exerce tir/sorts -
    if (typeof location !== 'undefined' && location.hash.indexOf('auto') >= 0) {
      PLAYER.onUpdate(() => { PLAYER.move(C.player.speed, 0); PLAYER.facing = 1; });
      try {
        loop(0.25, () => { if (PLAYER.exists()) playerShoot(); });
        loop(1.8, () => { if (PLAYER.exists()) castPleurer(); });
        loop(2.3, () => { if (PLAYER.exists()) castRaler(); });
        loop(3.0, () => { if (PLAYER.exists()) PLAYER.jump(C.player.jumpForce); });
      } catch (e) {}
    }

    PLAYER.onUpdate(() => {
      const p = PLAYER;

      // deplacement horizontal
      let moving = false;
      if (keysDown(C.controls.left)) { p.move(-C.player.speed, 0); p.facing = -1; moving = true; }
      if (keysDown(C.controls.right)) { p.move(C.player.speed, 0); p.facing = 1; moving = true; }

      // tir (auto-feu en maintenant)
      p.fireCd -= dt();
      if (keysDown(C.controls.shoot) && p.fireCd <= 0) { playerShoot(); p.fireCd = C.shot.rate; }

      // saut : reset du double saut au sol
      if (p.isGrounded()) p.jumpsLeft = C.player.maxJumps;

      // sprite selon l'etat
      if (!p.isGrounded()) setSpr(p, 'hero_jump');
      else if (p.invuln > C.player.invulnTime - 0.25) setSpr(p, 'hero_hurt');
      else if (moving) setSpr(p, 'hero_run');
      else setSpr(p, 'hero_idle');
      p.flipX = p.facing < 0;

      // timers
      if (p.invuln > 0) { p.invuln -= dt(); p.opacity = (Math.floor(time() * 20) % 2) ? 0.4 : 1; }
      else p.opacity = 1;
      if (p.shielded > 0) { p.shielded -= dt(); p.opacity = 0.85; }
      p.spellCd.pleurer = Math.max(0, p.spellCd.pleurer - dt());
      p.spellCd.raler = Math.max(0, p.spellCd.raler - dt());

      // jauge soleil
      if (C.sun.enabled) {
        p.sun = Math.max(0, p.sun - C.sun.drain * dt());
        if (p.sun <= 0 && C.sun.lethalAtZero && p.invuln <= 0) damagePlayer(1);
      }

      // garde-fou : si on tombe sous le niveau
      if (p.pos.y > LEVEL.height + 200) loseGame();

      // camera : suit le joueur en X, bornee au niveau
      const half = C.width / 2;
      const cx = Math.max(half, Math.min(LEVEL.width - half, p.pos.x));
      setCam(cx, camY);

      updateHUD(hud);
    });
  });

  // ---------------------------------------------------------------------
  //  SCENES TITRE / WIN / LOSE
  // ---------------------------------------------------------------------
  function bigText(str, y, size, col) {
    add([text(str, { size, align: 'center', width: C.width - 80 }), pos(C.width / 2, y), anchor('center'), color(col[0], col[1], col[2])]);
  }

  scene('title', () => {
    add([rect(C.width, C.height), pos(0, 0), color(143, 208, 240)]);
    // un petit soleil + heros pour l'ambiance
    add([sprite('sun_goal'), pos(C.width - 130, 120), anchor('center'), scale(0.9)]);
    add([sprite('hero_idle'), pos(150, C.height - 120), anchor('bot'), scale(1.6)]);
    bigText(C.story.title, 120, 64, [42, 29, 24]);
    bigText(C.story.subtitle, 175, 26, [226, 59, 80]);
    bigText(C.story.intro, 280, 20, [42, 29, 24]);
    bigText(C.story.hint, 370, 18, [60, 60, 70]);
    bigText(C.story.start, 450, 22, [42, 29, 24]);
    const go1 = () => { LEVEL_IDX = 0; go('game', C.levels[0]); };
    C.controls.jump.forEach((k) => onKeyPress(k, go1));
    onKeyPress('enter', go1);
    onClick(go1);
  });

  scene('win', (data) => {
    add([rect(C.width, C.height), pos(0, 0), color(255, 226, 120)]);
    add([sprite('sun_goal'), pos(C.width / 2, 150), anchor('center'), scale(1.2)]);
    bigText(C.story.win, 290, 30, [42, 29, 24]);
    bigText('SCORE : ' + (data ? data.score : 0), 350, 26, [226, 59, 80]);
    bigText(C.story.retry, 420, 22, [42, 29, 24]);
    const again = () => go('title');
    C.controls.jump.forEach((k) => onKeyPress(k, again));
    onKeyPress('enter', again); onClick(again);
  });

  scene('lose', (data) => {
    add([rect(C.width, C.height), pos(0, 0), color(90, 110, 130)]);
    add([sprite('hero_hurt'), pos(C.width / 2, 200), anchor('center'), scale(1.6)]);
    bigText(C.story.lose, 300, 28, [255, 255, 255]);
    bigText('SCORE : ' + (data ? data.score : 0), 350, 24, [255, 226, 120]);
    bigText(C.story.retry, 420, 22, [255, 255, 255]);
    const again = () => go('title');
    C.controls.jump.forEach((k) => onKeyPress(k, again));
    onKeyPress('enter', again); onClick(again);
  });

  // poignee de debug (utile pour les tests automatises)
  window.LQ = { get player() { return PLAYER; }, get level() { return LEVEL; } };

  // --- GO ! ------------------------------------------------------------
  // Astuce dev : ouvrir index.html#game lance directement le niveau 1
  // (#gameauto active en plus l'autopilote de test).
  if (typeof location !== 'undefined' && location.hash.indexOf('game') >= 0) go('game', C.levels[0]);
  else go('title');
})();
