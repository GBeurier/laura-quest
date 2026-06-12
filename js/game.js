/* =====================================================================
 *  GAME — Le moteur de "Laura l'exploratrice".
 *  Lit CONFIG (js/config.js), LEVELS (js/level.js), LQ_SAVE (js/save.js)
 *  et BOSS_AI (js/bosses.js). Moteur : KAPLAY (engine/kaplay.js), 100% client.
 *
 *  Scenes : title -> slots -> overworld -> game -> chapter -> overworld
 *           ... jury -> win.   (mort : sequence in-scene -> le niveau
 *           redemarre ; la scene 'lose' n'est plus atteinte depuis le jeu)
 * ===================================================================== */
(() => {
  'use strict';
  const C = window.CONFIG;
  const LEVELS = window.LEVELS;
  const SAVEAPI = window.LQ_SAVE;
  // Tactile (web mobile) : js/mobile.js est charge AVANT game.js et a pose ce
  //  flag. Sur mobile on passe en letterbox+stretch (le canvas remplit l'ecran
  //  en gardant le ratio) ; sur desktop, canvas fixe et centre (inchange).
  const TOUCH_ON = !!(window.LQ_TOUCH && window.LQ_TOUCH.active);

  // --- Init KAPLAY (mode global) --------------------------------------
  kaplay({
    width: C.width,
    height: C.height,
    background: C.background,
    global: true,
    crisp: true,            // nearest-neighbour: keep the pixel-art boss sheets crisp
    touchToMouse: true,
    letterbox: TOUCH_ON,    // mobile : adapte le rendu a l'ecran en gardant le ratio
    stretch: TOUCH_ON,
    pixelDensity: (C.art && C.art.pixelDensity) || 1,
  });
  setGravity(C.gravity);

  // ---------------------------------------------------------------------
  //  ZOOM D'AFFICHAGE (desktop) : agrandit le canvas via une transform CSS
  //  centree -> +40% par defaut (CONFIG.desktopZoom) sans toucher au rendu
  //  interne ni au gameplay. Sur mobile (TOUCH_ON) le canvas est deja en
  //  letterbox+stretch plein ecran : pas de zoom CSS (il deborderait).
  // ---------------------------------------------------------------------
  if (!TOUCH_ON && C.desktopZoom && C.desktopZoom !== 1) {
    const cv = document.querySelector('canvas');
    if (cv) {
      cv.style.transformOrigin = 'center center';
      cv.style.transform = `scale(${C.desktopZoom})`;
    }
  }

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
    // Tout ce qui n'est PAS un raccourci navigateur/OS part au jeu, jamais au
    // navigateur : sinon les touches non mappees (le E de l'ecran de save, une
    // lettre au hasard dans un menu, '/' ou "'"...) declenchent la "recherche
    // pendant la frappe" de Firefox qui vole le focus. On laisse filer
    // Ctrl/Cmd/Alt + touche et les F1-F12 (rafraichir, devtools, plein ecran),
    // on bloque tout le reste (lettres, chiffres, espace, fleches, ponctuation).
    const isEditable = (el) => !!el && (el.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || ''));
    window.addEventListener('keydown', (e) => {
      if (isEditable(document.activeElement)) return;   // ne jamais bloquer une saisie texte
      if (cv && document.activeElement !== cv) focusCv();
      if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) return;
      e.preventDefault();
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
  // Musique d'ecran : delegue au lecteur MIDI chiptune (js/music.js). Chaque
  //  scene annonce SA piste (cf. C.music) ; rejouer la piste deja en cours est
  //  un no-op cote lecteur (pas de coupure quand deux scenes partagent une
  //  piste, ex. title <-> slots ; une mort relance scene('game') sur la MEME
  //  piste -> la musique du niveau CONTINUE sans coupure, c'est voulu).
  //  Sans nom (scene non mappee) -> silence.
  //  Le mute (touche M) est gere par le lecteur (C.audio.music + setEnabled).
  const playMusic = (name) => {
    const M = window.LQ_MUSIC;
    if (!M) return;
    try { name ? M.play(name) : M.stop(); } catch (e) {}
  };
  const keysDown = (arr) => arr.some((k) => isKeyDown(k));
  // Tactile assiste (js/mobile.js) : les armes en cloche s'auto-visent et se
  //  tirent en tapotant (pas de charge/visee manuelle au doigt).
  const assistAim = () => !!(window.LQ_TOUCH && window.LQ_TOUCH.active && window.LQ_TOUCH.assist);
  const onKeys = (arr, cb) => arr.forEach((k) => onKeyPress(k, cb));
  // Validation des menus : ESPACE + ENTREE + touche de saut (espace ne saute plus en jeu)
  const onConfirm = (cb) => ['space', 'enter'].concat(C.controls.jump).forEach((k) => onKeyPress(k, cb));
  // Retour a l'ecran precedent (ESC) pour les menus. En jeu, ESC ouvre plutot la confirmation de sortie.
  const onBack = (cb) => onKeys(C.controls.quit, cb);

  // ---------------------------------------------------------------------
  //  CHARGEMENT DES ASSETS (les sprites de CONFIG.anims sont des feuilles)
  // ---------------------------------------------------------------------
  // Liste de secours si les assets ne sont PAS embarques (rare). Sinon on
  // charge TOUT ce qui est dans window.ASSETS -> les variants numerotes
  // (enemy_criquet2, ...) sont pris en compte automatiquement.
  const SPRITES_FALLBACK = [
    'hero_idle', 'hero_run', 'hero_jump', 'hero_hurt', 'hero_throw', 'cat_run',
    'ammo_graine', 'ammo_gateau',
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

  // Sprite-grille SANS clip d'anim (ex. bg_cloud 4x3 = 12 nuages) = banque de
  //  variantes statiques : renvoie un index de frame au hasard, sinon null
  //  (sprite simple OU anime -> on n'impose pas de frame).
  function randGridFrame(name) {
    const a = C.anims && C.anims[baseName(name)];
    if (!a || a.anims) return null;
    const nf = (a.sliceX || 1) * (a.sliceY || 1);
    return nf > 1 ? Math.floor(rand(0, nf)) : null;
  }

  // joue l'anim par defaut d'un sprite s'il en a une -> rend N'IMPORTE QUEL
  // sprite animable (il suffit d'elargir le PNG + declarer sliceX/anims).
  function playIfAnim(o, name) {
    const a = C.anims && C.anims[baseName(name)];
    if (!a || !a.anims) return;
    const key = a.play || Object.keys(a.anims)[0];
    if (key) { try { o.play(key); } catch (e) {} }
  }
  // Les sons sont TOUJOURS charges, meme si le jeu demarre mute (pref S) : le
  //  mute est un gate au play() (cf. sfx), reversible a chaud par la touche S.
  if (C.audio) {
    ['shoot', 'jump', 'hit', 'pickup', 'spell', 'boss', 'win', 'lose']
      .forEach((n) => { try { loadSound(n, SND_SRC(n)); } catch (e) {} });
  }

  // --- FONTS TTF embarquees (assets/fonts/*.ttf -> window.ASSETS.fonts) ------
  //  Servies en data-URI -> FontFace marche meme en file://. Utilisees pour le
  //  TEXTE A ACCENTS (bulles BD des PNJ) : font_bubble = Comic Neue Bold
  //  (latin, OFL), font_bubble_kh = Noto Sans Khmer (OFL), toutes deux
  //  SUBSETTEES (cf. CLAUDE.md). KAPLAY passe la chaine font telle quelle a
  //  ctx.font -> on peut EMPILER 'font_bubble,font_bubble_kh' et le navigateur
  //  fait le repli PAR GLYPHE (khmer -> Noto, grec/symboles -> font systeme).
  //  Une font absente du bundle est juste ignoree (FONTS_LOADED filtre).
  const FONTS_LOADED = new Set();
  Object.entries((window.ASSETS && window.ASSETS.fonts) || {}).forEach(([n, src]) => {
    try { loadFont(n, src); FONTS_LOADED.add(n); } catch (e) {}
  });

  // --- MUET : S = bruitages (C.audio.enabled), M = musique (C.audio.music).
  //  Ecouteur DOM (PAS onKeyPress : les handlers KAPLAY enregistres hors scene
  //  sont perdus au premier go(), ceux d'une scene meurent avec elle) -> actif
  //  PARTOUT (toutes scenes, pause comprise). Capte aussi les touches synthetiques
  //  de mobile.js (bubbles). Pref persistee via LQ_SAVE ('lauraquest_prefs').
  if (C.audio) {
    const SV = window.LQ_SAVE;
    const prefs = (SV && SV.loadPrefs) ? SV.loadPrefs() : {};
    if (prefs.sfx === false) C.audio.enabled = false;
    if (prefs.music === false) C.audio.music = false;
    const toggles = {};
    (C.controls.muteSfx || []).forEach((k) => { toggles[k] = 'sfx'; });
    (C.controls.muteMusic || []).forEach((k) => { toggles[k] = 'music'; });
    document.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      const what = toggles[(e.key || '').toLowerCase()];
      if (!what) return;
      if (what === 'sfx') {
        C.audio.enabled = !C.audio.enabled;
        if (SV && SV.setPref) SV.setPref('sfx', C.audio.enabled);
        flashMsg(C.audio.enabled ? 'SON : OUI' : 'SON : COUPE');
        if (C.audio.enabled) sfx('pickup');       // petit bip temoin au retour du son
      } else {
        C.audio.music = !C.audio.music;
        if (SV && SV.setPref) SV.setPref('music', C.audio.music);
        if (window.LQ_MUSIC && LQ_MUSIC.setEnabled) LQ_MUSIC.setEnabled(C.audio.music);
        flashMsg(C.audio.music ? 'MUSIQUE : OUI' : 'MUSIQUE : COUPEE');
      }
    });
  }
  // Tous les load* ont capture leur data-URI : on relache les ~25 Mo de strings
  //  base64 de window.ASSETS (sinon retenus a vie). Personne ne le relit apres
  //  (hasSprite/variant lisent LOADED/SPRITE_NAMES, captures plus haut).
  window.ASSETS = null;

  // ---------------------------------------------------------------------
  //  ETAT PARTAGE
  // ---------------------------------------------------------------------
  let PLAYER = null;
  let LEVEL = null;     // { width, height, bossesAlive, sun, dataTotal, pageTotal, hasPubli }
  // References directes (PERF) : get(tag) parcourt TOUS les objets racine a
  //  chaque appel -> on garde une ref au chat et la liste des boss du niveau,
  //  testees via exists() (O(1)). Reset par buildLevel a chaque scene game.
  let CAT_REF = null;   // le chat deploye (un seul a la fois)
  let BOSS_LIST = [];   // boss du niveau + invites (spawnBoss les enregistre)
  const EHOTS = new Set();   // tirs ennemis vivants (enemyBullet les enregistre)
  const catOut = () => !!(CAT_REF && CAT_REF.exists());
  let SAVE = null;      // slot courant (objet de save.js)
  let SLOT = 0;         // index du slot courant
  let CUR_IDX = 0;      // index du niveau dans C.levels
  let ENEMY_SEQ = 0;    // compteur d'ennemis -> ecart/phase perso (anti-agglutination)
  let HEAD_DECKS = {};  // pioche de tetes de passants par sexe, SANS REMISE (cf. pickHead) ; reset par niveau
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

  // SAC VIDE : tant que le chat est DEHORS (deploye), Laura porte un sac vide -> on
  //  joue la variante "<spr>_nocat" si elle existe (sinon on garde le sprite avec chat).
  function noCat(spr) {
    return (catOut() && hasSprite(spr + '_nocat')) ? spr + '_nocat' : spr;
  }

  // setAnim pour Laura : un equipement peut remplacer le sprite d'une pose
  // (ex. rollers -> override.run = 'hero_roll'), puis bascule sac-vide si le chat court.
  function heroAnim(o, spr, anim) {
    const eq = o.equipped && C.equipment && C.equipment[o.equipped];
    if (eq && eq.override && eq.override[anim] && hasSprite(eq.override[anim])) spr = eq.override[anim];
    setAnim(o, noCat(spr), anim);
  }

  // CALQUE D'ACTION (rig en couches, cf. SPRITES.md) : pose un sprite act_* (bras
  //  qui lance / lance le chat) PAR-DESSUS Laura, qui continue sa locomotion en
  //  dessous (course/vélo/rollers...). Le calque copie exactement pos/ancre/echelle/
  //  flip de Laura -> aligne par construction (overlay dessine a la taille d'une frame
  //  de Laura). Absent (pas d'asset) -> on ne fait rien (repli gere par l'appelant).
  //  `replay` (nouveau tir) rejoue le calque depuis la 1re frame.
  function setActionOverlay(p, sprName, anim, replay) {
    if (!sprName || !hasSprite(sprName)) {
      if (p._actOv && p._actOv.exists()) { destroy(p._actOv); p._actOv = null; }
      return false;
    }
    const off = (C.player && C.player.actionOffset) || [0, 0];
    if (!p._actOv || !p._actOv.exists()) {
      const ov0 = add([
        sprite(sprName), artScale(), pos(p.pos.x, p.pos.y), anchor('bot'),
        z(7), 'actov', { _spr: null, _anim: null },
      ]);
      ov0.onUpdate(() => { if (!p || !p.exists()) destroy(ov0); });   // filet anti-orphelin
      p._actOv = ov0;
    }
    const ov = p._actOv;
    ov.pos = vec2(p.pos.x + off[0], p.pos.y + off[1]);
    ov.flipX = p.flipX;
    if (replay) ov._anim = null;
    setAnim(ov, sprName, anim);
    return true;
  }

  // ---------------------------------------------------------------------
  //  PROJECTILES
  // ---------------------------------------------------------------------
  // Vitesse de lancer d'une cloche pour une puissance pw (0..1) et l'angle vise
  //  courant de Laura. Sert AU TIR et a l'apercu de trajectoire (meme physique).
  //  ammoOverride = munition utilisee (defaut = gateau, seule arme en cloche).
  function arcLaunch(p, pw, ammoOverride) {
    const fx = p.facing >= 0 ? 1 : -1;
    const ammo = ammoOverride || C.ammoTypes.gateau;
    const mul = C.shot.arcMin + (C.shot.arcMax - C.shot.arcMin) * pw;
    const ang = ((p.aimAngle != null) ? p.aimAngle : C.shot.aimDefault) * Math.PI / 180;
    const spd = ammo.speed * mul;
    return { vx: Math.cos(ang) * spd * fx, vy: -Math.sin(ang) * spd };
  }

  // Cible tactile : ennemi/boss le plus proche de Laura (pondere l'horizontal,
  //  les cloches portent surtout en X). Sert a l'auto-visee mobile.
  function nearestTarget(p) {
    let best = null, bd = Infinity;
    ['enemy', 'boss'].forEach((tag) => get(tag).forEach((e) => {
      if (!e.exists() || e.paused) return;   // pause = culle hors-ecran : ne pas auto-viser l'invisible
      const d = Math.abs(e.pos.x - p.pos.x) + Math.abs(e.pos.y - p.pos.y) * 0.4;
      if (d < bd) { bd = d; best = e; }
    }));
    return best;
  }

  // Auto-visee d'une cloche (mobile assiste) : oriente Laura vers la cible et
  //  resout la PUISSANCE pour l'atteindre a l'angle par defaut (meme balistique
  //  que arcLaunch : v = ammo.speed*mul, mul in [arcMin..arcMax], g = arcGravity).
  //  Renvoie toujours { facing, aimAngle, power } utilisable (defauts si pas de cible).
  function autoAimArc(p, ammoOverride) {
    const ammo = ammoOverride || C.ammoTypes[p.ammoKey];
    const ang = C.shot.aimDefault;
    const t = nearestTarget(p);
    if (!t) return { facing: p.facing, aimAngle: ang, power: 0.7 };
    const facing = (t.pos.x >= p.pos.x) ? 1 : -1;
    const ox = p.pos.x + facing * 22, oy = p.pos.y - TS * 0.6;   // = origine du tir (cf. playerShoot)
    const dx = Math.abs(t.pos.x - ox);
    const dy = t.pos.y - oy;                                     // +y vers le bas
    const r = ang * Math.PI / 180, c = Math.cos(r);
    const denom = 2 * c * c * (dy + dx * Math.tan(r));           // > 0 => une solution existe
    let power = 1;                                               // cible trop haute -> puissance max, bonne direction
    if (denom > 0 && dx > 1) {
      const spd = Math.sqrt(C.shot.arcGravity * dx * dx / denom);
      const mul = spd / ammo.speed;
      power = Math.max(0, Math.min(1, (mul - C.shot.arcMin) / (C.shot.arcMax - C.shot.arcMin)));
    }
    return { facing, aimAngle: ang, power };
  }

  function playerShoot(ammoKey, power, opts) {
    const p = PLAYER;
    opts = opts || {};
    const ammo = C.ammoTypes[ammoKey] || C.ammoTypes.graine;
    const wantSpr = opts.sprite || ammo.sprite;
    const sname = hasSprite(wantSpr) ? wantSpr : (hasSprite(ammo.sprite) ? ammo.sprite : 'ammo_graine');   // garde-fou si PNG absent
    const fx = p.facing >= 0 ? 1 : -1;
    const traj = ammo.traj || 'straight';
    const aoe = opts.aoe || ammo.aoe || null;            // arsenal (patisserie) peut surcharger l'AoE
    const spd = opts.speed || ammo.speed;
    const pw = (power == null) ? 1 : Math.max(0, Math.min(1, power));   // charge 0..1 (cloche)
    const dmg = (opts.damage != null) ? opts.damage : ammo.damage;     // l'arsenal fournit le degat (graines/patisseries)
    const b = add([
      sprite(sname), artScale(opts.projScale || 1),
      pos(p.pos.x + fx * 22, p.pos.y - TS * 0.6),
      anchor('center'), area(),
      offscreen({ distance: 220, destroy: true }),
      'pbullet',
      // channel/bossDmg : canal de tick + degat dedie vs BOSS (v2, cf. hitBoss).
      { dmg: dmg, vx: 0, vy: 0, traj, aoe,
        channel: opts.channel || (aoe ? 'aoe' : 'seed'),
        bossDmg: (opts.bossDmg != null) ? opts.bossDmg : null },
    ]);
    if (opts.flame) { try { b.use(color(255, 138, 40)); } catch (_) {} }   // graine/gateau ENFLAMME : teinte chaude
    playIfAnim(b, sname);
    if (traj === 'arc') {                       // en cloche (lob lourd) : puissance auto-visee -> portee
      const v = arcLaunch(p, pw, { speed: spd });
      b.vx = v.vx; b.vy = v.vy;
    } else {                                    // tout droit (angle eventuel pour l'eventail)
      const off = opts.angleOffset || 0;
      b.vx = fx * spd * Math.cos(off); b.vy = spd * Math.sin(off);
    }
    b.onUpdate(() => {
      if (b.traj === 'arc') b.vy += C.shot.arcGravity * dt();
      b.pos.x += b.vx * dt(); b.pos.y += b.vy * dt();
      if (b.pos.y > LEVEL.height + 100) destroy(b);
    });
    if (aoe) {                                  // PATISSERIE : eclate en AoE a l'impact
      const boom = () => {
        if (!b.exists()) return;
        const bx = b.pos.x, by = b.pos.y; destroy(b);
        explodeAoe(bx, by, aoe.radius, aoe.damage || ammo.damage, 'aoe');
        const sec = opts.secondary || 0;        // GATEAU DES ENFERS : N mini-explosions decalees autour de l'impact
        for (let i = 0; i < sec; i++) {
          const a = (i / sec) * Math.PI * 2, rr = aoe.radius * 0.55;
          // canal 'aoe2' : vs boss, AU PLUS UNE mini-explosion compte (cf. hitBoss)
          wait(0.06 + i * 0.05, () => explodeAoe(bx + Math.cos(a) * rr, by + Math.sin(a) * rr * 0.6, aoe.radius * 0.5, Math.max(1, (aoe.damage || 2) - 1), 'aoe2'));
        }
      };
      b.onCollide('enemy', boom);
      b.onCollide('passant', boom);   // figurant : encaisse les balles (mais rien d'autre)
      b.onCollide('boss', boom);
      // SOL/rochers OUI, mais PANNEAUX NON : le lob est l'arme "par-dessus" — il
      //  ARQUE au-dessus des panneaux-couvert pour retomber sur l'ennemi/le boss
      //  derriere, au lieu d'exploser betement sur le panneau (bug "lob par-dessus
      //  sans degats"). Il eclate quand meme au sol pour ne jamais etre gaspille.
      b.onCollide('solid', (s) => { if (s && s.is && s.is('panel')) return; boom(); });
    } else if (opts.pierce) {                   // PERCANT : traverse plusieurs ennemis sans se detruire
      b.pierce = opts.pierce; b._hit = new Set();
      const through = (e, fn) => { if (b._hit.has(e)) return; b._hit.add(e); fn(e, { dmg: b.dmg, bossDmg: b.bossDmg, channel: b.channel, pos: b.pos }); b.pierce--; if (b.pierce <= 0 && b.exists()) destroy(b); };
      b.onCollide('enemy', (e) => through(e, hitEnemy));
      b.onCollide('passant', (e) => through(e, hitEnemy));
      b.onCollide('boss', (e) => through(e, hitBoss));
      b.onCollide('solid', () => destroy(b));
    } else {
      // garde !b.exists() : deux cibles qui CHEVAUCHENT la balle la meme frame
      //  declenchaient 2 onCollide -> la balle deja consommee blessait (et
      //  tuait des passants) une 2e fois. 1 balle = 1 coup (le multi-hit
      //  legitime passe par `pierce`).
      b.onCollide('enemy', (e) => { if (b.exists()) hitEnemy(e, b); });
      b.onCollide('passant', (e) => { if (b.exists()) hitEnemy(e, b); });   // figurant : seule interaction = prendre une balle
      b.onCollide('boss', (e) => { if (b.exists()) hitBoss(e, b); });
      b.onCollide('solid', () => destroy(b));
    }
    // Pose de lancer : tient un peu PLUS longtemps que la cadence (throwHold > rate)
    //  pour ne pas clignoter entre deux tirs en rafale, et on FORCE le rejeu de
    //  l'anim a chaque tir (throwReplay) -> elle reste vivante au lieu de geler sur
    //  sa derniere frame quand on maintient le tir (au sol comme en l'air).
    p.throwT = (C.shot && C.shot.throwHold) || 0.32;
    p.throwReplay = true;
    sfx('shoot');
  }

  // TIR DE BASE = GRAINES (ESPACE, gratuit). La PUISSANCE (p.power) pilote le
  //  nombre de graines + l'eventail + le feu/percage ; la CADENCE (p.rate) pilote
  //  le delai entre tirs (pose au point d'appel, cf. fireCd). cf. CONFIG.arsenal.graines.
  function fireBase(p) {
    const A = (C.arsenal && C.arsenal.graines) || {};
    const lv = Math.max(1, Math.min((A.levels && A.levels.length) || 1, p.power || 1));
    const L = (A.levels && A.levels[lv - 1]) || { pellets: 1, spread: 0, damage: 1, flame: false, pierce: 0 };
    const n = Math.max(1, L.pellets || 1);
    // degat de TICK vs boss par niveau de puissance (la volee compte pour 1, cf. hitBoss)
    const bossTick = (A.bossTick && A.bossTick[lv - 1] != null) ? A.bossTick[lv - 1] : (L.damage || 1);
    for (let i = 0; i < n; i++) {
      const off = (n === 1) ? 0 : (i - (n - 1) / 2) * (L.spread || 0);   // eventail centre
      playerShoot('graine', 1, {
        angleOffset: off, damage: L.damage || 1, speed: A.speed,
        sprite: L.flame ? 'ammo_graine_fire' : undefined,   // P3 : vrai sprite de graine enflammee (plus de teinte code)
        pierce: L.pierce || 0, projScale: 1,
        channel: 'seed', bossDmg: bossTick,
      });
    }
  }
  // Delai entre deux tirs de graines selon la CADENCE (lu a chaque tir).
  function grainesCd(p) {
    const cad = (C.arsenal && C.arsenal.graines && C.arsenal.graines.cadence) || [C.shot.rate];
    const r = Math.max(1, Math.min(cad.length, p.rate || 1));
    return cad[r - 1] || C.shot.rate;
  }

  // PATISSERIE (X) : lance une cloche AoE auto-visee (autoAimArc). La PUISSANCE
  //  (p.power) choisit cookie -> gateau -> gateau des enfers (taille d'explosion +
  //  mini-explosions) ; la CADENCE (p.rate) son cooldown. Coute du SOLEIL. cf.
  //  CONFIG.arsenal.patisseries.
  function lobShoot() {
    const p = PLAYER;
    if (!p || !p.exists()) return;
    if ((p.lobCd || 0) > 0) return;
    const A = (C.arsenal && C.arsenal.patisseries) || {};
    const lv = Math.max(1, Math.min((A.levels && A.levels.length) || 1, p.power || 1));
    const L = (A.levels && A.levels[lv - 1]) || { sprite: 'ammo_gateau', scale: 1, radius: 94, damage: 3, cost: 30, secondary: 0 };
    const cost = L.cost || 0;
    if (C.sun.enabled && p.sun < cost) { flashMsg('PAS ASSEZ D ENERGIE'); return; }
    if (C.sun.enabled) p.sun = Math.max(0, p.sun - cost);
    const aim = autoAimArc(p, { speed: A.speed || 520 });
    p.facing = aim.facing; p.aimAngle = aim.aimAngle;
    playerShoot('gateau', aim.power, {
      sprite: L.sprite, projScale: L.scale || 1, speed: A.speed,   // sprite dedie par niveau (cookie / gateau / gateau des enfers)
      aoe: { radius: L.radius, damage: L.damage }, secondary: L.secondary || 0,
    });
    const cad = A.cadence || [(C.shot && C.shot.lobCooldown) || 0.6];
    const r = Math.max(1, Math.min(cad.length, p.rate || 1));
    p.lobCd = cad[r - 1] || 0.6;
    p.throwT = 0.32;
  }

  // Explosion de zone (gateau) : onde + miettes + degats a tout dans le rayon.
  //  channel ('aoe' par defaut, 'aoe2' pour les mini-explosions des enfers) =
  //  canal de tick vs BOSS (cf. hitBoss) — vs mobs, degats pleins comme avant.
  function explodeAoe(x, y, radius, dmg, channel) {
    addBoom(x, y);
    safeShake(11);
    sfx('spell');
    const c = vec2(x, y);
    get('enemy').forEach((e) => { if (e.exists() && e.pos.dist(c) < radius) hitEnemy(e, { dmg }); });
    get('passant').forEach((e) => { if (e.exists() && e.pos.dist(c) < radius) hitEnemy(e, { dmg }); });   // souffle = balle -> touche aussi les figurants
    get('boss').forEach((bo) => { if (bo.exists() && bo.pos.dist(c) < radius) hitBoss(bo, { dmg, channel: channel || 'aoe' }); });
    get('ehot').forEach((h) => { if (h.exists() && h.pos.dist(c) < radius) destroy(h); });   // nettoie les tirs ennemis pris dans le souffle
  }

  // Souffle d'une BOMBE de boss : explose, TUE les monstres (enemy + figurants)
  //  dans le rayon, nettoie les tirs ennemis et blesse Laura si elle est dessous.
  //  N'abime PAS le boss (c'est lui qui la lache). Cf. dropBomb.
  function bombBlast(x, y, radius, dmg) {
    addBoom(x, y); safeShake(8); sfx('spell');
    const c = vec2(x, y);
    get('enemy').forEach((e) => { if (e.exists() && e.pos.dist(c) < radius) hitEnemy(e, { dmg }); });
    get('passant').forEach((e) => { if (e.exists() && e.pos.dist(c) < radius) hitEnemy(e, { dmg }); });
    get('ehot').forEach((h) => { if (h.exists() && h.pos.dist(c) < radius) destroy(h); });
    const p = PLAYER;
    if (p && p.exists() && p.pos.dist(c) < radius) damagePlayer(dmg, x);
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

  // PROJECTILE ennemi/boss. v2 : le sprite de boss est PASSE PAR L'APPELANT
  //  (bosses.js fournit b.def.shot en 6e arg de api.bullet) — plus de global
  //  BOSS_SHOT_SPRITE : avec les boss INVITES du jury, plusieurs boss vivent en
  //  meme temps et un global serait ecrase par le dernier spawn. Tirs 'enemy' :
  //  sprite PAR TIREUR (def.shot des shooters, cf. CONFIG.enemies — le sachet de
  //  chips crache une chip, le tuyau une goutte...), repli 'shot_paper' si le
  //  tireur n'en declare pas. Si le PNG manque, retour propre a la forme
  //  generique (cercle rouge boss / rectangle creme).
  function enemyBullet(x, y, target, speed, kind, spr) {
    const dir = target.pos.sub(vec2(x, y)).unit();
    const sname = (kind === 'boss') ? spr : (spr || 'shot_paper');
    const comps = (sname && hasSprite(sname))
      ? [sprite(sname), artScale(), rotate(Math.atan2(dir.y, dir.x) * 180 / Math.PI)]
      : ((kind === 'boss')
          ? [circle(9), color(226, 59, 80), outline(3, rgb(42, 29, 24))]
          : [rect(15, 19, { radius: 2 }), color(244, 241, 232), outline(3, rgb(42, 29, 24))]);
    const b = add([
      ...comps,
      pos(x, y),
      anchor('center'),
      area({ scale: 0.42 }),   // sprite shot_* agrandi (40->64) + halo -> hitbox ~ inchangee
      move(dir, speed),
      offscreen({ distance: 160, destroy: true }),
      'ehot',
      { dmg: 1 },
    ]);
    EHOTS.add(b);
    b.onDestroy(() => EHOTS.delete(b));
    b.onCollide('solid', () => destroy(b));
    // POLISH (dette tech) : rotation + petite trainee -> projectiles moins "plats".
    let trailT = 0;
    b.onUpdate(() => {
      if (b.angle != null) b.angle += 300 * dt();
      trailT += dt();
      if (trailT >= 0.06) {
        trailT = 0;
        add([circle(4), pos(b.pos.x, b.pos.y), anchor('center'),
          color(kind === 'boss' ? rgb(255, 150, 90) : rgb(240, 238, 230)),
          opacity(0.45), z(-0.2), lifespan(0.18, { fade: 0.18 }), 'fx']);
      }
    });
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
        facing: 1, invuln: 0, sunRegenLockT: 0, medNoHit: true, throwT: 0, throwReplay: false,
        catTossT: 0, catRegenT: 0, _actOv: null,   // pose "lance le chat" (brieve) + recharge auto + calque d'action
        aimAngle: C.shot.aimDefault,           // angle de lancer du lob (resolu par autoAimArc)
        jumpsLeft: C.player.maxJumps,
        ammoKey: C.player.startAmmo,
        // ARSENAL : PUISSANCE + CADENCE communs aux 2 armes (cf. CONFIG.arsenal).
        //  Montent via pickups, RESET par niveau (PLAYER recree par scene).
        power: (C.arsenal && C.arsenal.power.start) || 1,
        rate:  (C.arsenal && C.arsenal.rate.start) || 1,
        powerFlash: 0, rateFlash: 0, saveFlash: 0,
        fireCd: 0, lobCd: 0,
        sun: C.sun.max, sunMax: C.sun.max,    // jauge SOLEIL = energie (patisseries) + SURBOUCLIER
        score: 0, kills: 0, saved: 0,          // kills = passants abattus ; saved = passants sauves par le chat
        levelTime: 0,                          // chrono du niveau (time-attack : meilleur temps sur la carte)
        data: 0, pages: 0, gotPubli: false,
        catCharges: C.cat.startCharges,
        catLock: false,
        _sunCharging: false, _sunShaded: false, sunFlash: 0,   // etat de recharge solaire (HUD glow)
        killFlash: 0,                                          // pulse du compteur tete-de-mort a chaque meurtre
        knockX: 0, knockT: 0,
        dashT: 0, dashCd: 0, dashVx: 0,   // dash (ruee + i-frames)
        equipped: null, _overlay: null,
        _spr: 'hero_idle', _anim: null,
      },
    ]);
    // Le BOSS n'est pas un MUR : sa masse ne pousse jamais Laura. Sans ca,
    //  pendant l'invuln post-coup (damagePlayer sort tot : ni degat ni lock),
    //  la RESOLUTION physique du body continuait de la bulldozer devant le
    //  tracteur a pleine vitesse jusqu'a hors de l'arene ("coups lourds
    //  fantomes"). On annule la resolution du couple joueur<->boss DES DEUX
    //  COTES (meme hook maison que les panneaux one-way) ; les EVENEMENTS de
    //  collision restent -> le degat de contact heavy fonctionne toujours
    //  (cf. panneaux cassables : onCollide tire meme sans resolution).
    p.onBeforePhysicsResolve((col) => {
      const o = col.target;
      if (o && o.is && o.is('boss')) col.preventResolution();
    });
    return p;
  }

  // Camionnette d'arrivee : sprite statique au PREMIER PLAN au depart du niveau.
  //  C'est un objet du MONDE (pas fixed) -> il defile vers la gauche et sort du
  //  cadre quand Laura avance. La camionnette regarde a DROITE : son AVANT peint
  //  (cabine, bord DROIT du contenu) est cale `clearance` px a gauche du centre
  //  de Laura -> elle est toujours degagee, et l'arriere part loin hors-champ a
  //  gauche. `scale` retaille la camionnette (1 = taille brute du PNG/ART, qui
  //  est enorme). Mesures du contenu (alpha bbox de bg_startlevel) : bord droit
  //  peint x=987, pad transparent sous les roues 25px (sur 677) -> on en deduit
  //  l'avant peint (FRONT_INSET) et la descente au sol (BOTTOM_PAD), tous deux a
  //  l'echelle. PAS d'offscreen(hide) : l'ancre bas-gauche est loin hors-champ a
  //  gauche, donc screenPos() la croirait hors ecran et masquerait tout le sprite.
  function spawnStartVehicle() {
    const sv = C.startVehicle;
    if (!sv || sv.enabled === false || !PLAYER) return;
    if (!hasSprite(sv.sprite)) return;     // PNG absent -> on n'ajoute rien (pas de crash)
    const s = (sv.scale || 1) / ART;       // echelle d'affichage totale
    const FRONT_INSET = 987 * s;           // px affiches : avant peint depuis le bord gauche du sprite
    const BOTTOM_PAD  = 25 * s;            // px affiches : vide sous les roues -> a descendre pour poser au sol
    const frontX = PLAYER.pos.x - (sv.clearance || 0);   // monde : avant peint vise, a gauche de Laura
    add([
      sprite(sv.sprite), scale(s),
      pos(frontX - FRONT_INSET + (sv.nudgeX || 0), PLAYER.pos.y + BOTTOM_PAD + (sv.sink || 0)),
      anchor('botleft'),
      z(sv.z != null ? sv.z : 40),
      'startvehicle',
    ]);
  }

  function knockPlayer(srcX) {            // recul : s'eloigne de la source
    const p = PLAYER;
    const dir = (srcX != null && srcX > p.pos.x) ? -1 : 1;
    p.knockX = dir * (C.player.knockback || 0);
    p.knockT = C.player.knockTime || 0.2;
  }
  // heavy = ECRASEMENT (contact d'un BOSS, cf. sun.bossTouchPierces) : le coup
  //  TRAVERSE le surbouclier — il le draine au passage mais ne s'y arrete pas,
  //  equipement/coeurs encaissent QUAND MEME (se faire rouler dessus par le
  //  tracteur doit faire tres mal), avec recul et secousse renforces.
  function damagePlayer(dmg, srcX, heavy) {
    const p = PLAYER;
    if (!dmg || dmg <= 0) return;            // contact INOFFENSIF (passant) : ni recul, ni perte d'equip, ni shake
    if (p._god || p.invuln > 0) return;
    knockPlayer(srcX);                     // recul + (l'anim "hurt" se joue via invuln)
    if (heavy) p.knockX *= (C.player.heavyKnockMul || 1.6);   // ejecte de sous les roues
    p.invuln = C.player.invulnTime;
    // v2.2 — TOUTE blessure (absorbee, equipement OU coeur) coupe la regen
    //  passive hitRegenDelay s (sunRegenLockT, jauge HUD grisee) : sans ca, le
    //  bouclier se re-arme en continu et on tanke au spam defensif.
    p.sunRegenLockT = Math.max(p.sunRegenLockT || 0, C.sun.hitRegenDelay || 0);
    // v2 — ORDRE DES DEGATS : SOLEIL -> EQUIPEMENT -> COEURS (GAMEPLAY.md §2).
    // 1) SURBOUCLIER : n'absorbe que si la jauge passe le SEUIL (sun >= hitAbsorb)
    //    — en dessous le soleil est conserve (c'est de la munition) mais ne
    //    protege plus. Un coup HEAVY draine le bouclier SANS etre arrete.
    const absorb = C.sun.enabled ? (C.sun.hitAbsorb || 0) : 0;
    if (absorb > 0 && p.sun >= absorb) {
      p.sun = Math.max(0, p.sun - absorb);
      p.sunFlash = 0.5; p.shieldFlash = 0.6;
      if (!heavy) { safeShake(7); sfx('hit'); return; }
    }
    // 2) EQUIPEMENT : le coup casse le velo/les rollers a la place d'un coeur.
    //  (perdre coeur OU equipement casse la medaille cachee "sans degat" —
    //   le bouclier, lui, a le droit d'absorber : ca reste humain.)
    if (p.equipped) {
      loseEquip();
      p.medNoHit = false;
      safeShake(heavy ? 11 : 8); sfx('hit');
      return;
    }
    // 3) COEURS.
    p.medNoHit = false;
    p.hp -= dmg;
    safeShake(heavy ? 11 : 6);
    sfx('hit');
    if (p.hp <= 0) { p.hp = 0; loseGame(); }
  }

  // ---------------------------------------------------------------------
  //  SOL & PLATEFORMES
  // ---------------------------------------------------------------------
  // tile_soil a ~7px transparents en haut (bord feutre) -> la terre opaque
  //  demarrerait SOUS la surface marchable et laisserait voir une bande de ciel.
  //  On REMONTE donc le VISUEL du sol de SOIL_LIFT px pour que la terre couvre la
  //  surface. La COLLISION, elle, n'est PLUS portee par la tuile : buildLevel pose
  //  des colliders FUSIONNES par segment horizontal de '=' (cf. addGroundColliders)
  //  pile a la surface -> meme geometrie, mais des centaines de body/area en moins.
  //  La tuile n'est qu'un sprite, cache hors-ecran (KAPLAY ne cull pas tout seul).
  const SOIL_LIFT = 8;
  function addSolid(x, y, spr) {
    playIfAnim(add([sprite(spr), artScale(), pos(x, y - SOIL_LIFT), anchor('topleft'),
      offscreen({ hide: true, distance: TS * 2 }), z(-1), 'soiltile']), spr);
  }

  // COLLISION DU SOL FUSIONNEE : un collider invisible par SEGMENT horizontal de
  //  '=' (plafonne a MERGE_MAX tuiles pour garder le broadphase local) au lieu
  //  d'un body+area PAR tuile. L'union des rectangles est EXACTEMENT celle des
  //  tuiles d'avant (surface marchable, couvert anti-tir, murs inchanges), mais
  //  le moteur ne parcourt plus ~600 objets physiques par frame sur les grands
  //  niveaux. '=' n'est jamais retire de la grille (seuls les panneaux 'x'
  //  explosent) -> les colliders n'ont pas besoin de suivre la grille.
  const MERGE_MAX = 16;
  function addGroundColliders(grid) {
    grid.forEach((grow, r) => {
      let c = 0;
      while (c < grow.length) {
        if (grow[c] !== '=') { c++; continue; }
        let len = 1;
        while (len < MERGE_MAX && grow[c + len] === '=') len++;
        add([rect(len * TS, TS), pos(c * TS, r * TS), anchor('topleft'), opacity(0),
          area(), body({ isStatic: true }), 'solid']);
        c += len;
      }
    });
  }

  // --- PIEDS DES FEUILLES GENEREES (regrid) ---------------------------------
  //  Les pipelines posent la baseline des pieds AU-DESSUS du bas de frame :
  //  _monstgen BASE=182 sur CH=192 -> 10px transparents sous les pieds ;
  //  _bossgen -> 16px ; _bodygen (corps de passants) -> 4px. Laura, elle, touche
  //  le bas de frame (~1px). Avec anchor('bot') + boite au bas de frame, tout ce
  //  monde FLOTTAIT de marge x echelle au-dessus du sol. Le fix : remonter la
  //  BOITE de collision de cette marge (offset local = px source, multiplie par
  //  l'echelle de l'objet) -> le body pose les PIEDS DESSINES sur le sol et le
  //  transparent plonge dans la terre. Sans body (static/fly/rocher), on decale
  //  le pos a la place. Si un pipeline change sa baseline, ajuste ICI.
  const FEET_PAD = { enemy: 10, boss: 16, passant: 4 };

  // --- CAILLOUX (obstacles) -------------------------------------------------
  //  Un caillou n'est PLUS un ennemi : c'est un BLOC solide INDESTRUCTIBLE qui
  //  ne fait AUCUN degat mais BLOQUE le passage. C'est un body isStatic tagge
  //  'solid' (pas 'enemy') -> tout corps dynamique s'y cogne (monstres, camions
  //  ET Laura, qui saute par-dessus) et les projectiles s'y arretent (couvert),
  //  mais aucune collision ne retire de vie. anchor 'bot' = pose sur la surface
  //  du sol. On en place un au DEPART (via '^' dans la map) + un a chaque BORD
  //  du niveau (anti-chute, cf. buildLevel).
  function addRock(cx, groundY, invisible) {
    const spr = variant('enemy_caillou');
    // COLLISION : le caillou VISIBLE prend une boite calee sur le dessin (le sujet
    //  ne remplit pas la frame) -> Laura ne bute plus dans le vide ni n'atterrit
    //  sur de l'air au-dessus, et les tirs s'arretent pile sur la pierre. Le mur
    //  de BORD invisible (anti-chute) garde la frame pleine pour bloquer a coup sur.
    //  Statique (pose manuelle, pas de body qui repose) -> on ENFONCE le pos de la
    //  marge FEET_PAD (x echelle 0.8) + 2px dans l'herbe ; la collision suit le
    //  dessin (le bas deborde dans le sol statique, sans effet).
    const ROCK_SINK = invisible ? 0 : FEET_PAD.enemy * 0.8 / ART + 2;
    const comps = [
      sprite(spr), artScale(invisible ? 1 : 0.8), pos(cx, groundY + ROCK_SINK), anchor('bot'),
      area(invisible ? {} : { scale: vec2(0.90, 0.82) }), body({ isStatic: true }), z(-1), 'solid', 'rock',
    ];
    if (invisible) comps.push(opacity(0));   // mur de bord invisible (interieurs) : bloque la chute sans afficher de caillou
    const r = add(comps);
    if (!invisible) playIfAnim(r, spr);
    return r;
  }

  // --- SOL PIEGE ('%') : FOSSE A DEGAT au ras du sol, NON solide. Le sol RESTE
  //  solide (Laura ne TOMBE pas dedans) : elle COURT AU-DESSUS de la gueule, mais
  //  le contact pique -> degat (CONFIG.hazards.touchDamage) gate par l'invuln (un
  //  coup propre, pas un drain). Le DASH (i-frames) traverse.
  //  RENDU = un TROU EN TROMPE-L'OEIL VU DE DESSUS, ENCASTRE DANS LE SOL SOUS LES
  //  PIEDS (pas un objet pose). Comme addPanel separe collision (tuile invisible) et
  //  deco, on separe ici : le VISUEL (sprite ancre 'top', bord arriere remonte de
  //  HAZ_TUCK sous la levre de terre) descend dans la BANDE DE TERRE. Le jeu n'a
  //  quasi pas de hauteur sous le sol (HUD juste dessous) -> l'art est LARGE et BAS
  //  (cf. _hazardgen) et on ne plonge pas plus. Dessine ENTRE le sol (z=-1) et les
  //  acteurs (z=0) -> Laura passe DEVANT, le trou reste SOUS ses pieds. La COLLISION
  //  est une bande FINE au niveau de la SURFACE : on encaisse en passant dessus.
  //  Skin par biome via LEVEL.theme.hazard (riziere = piques de bambou / interieur =
  //  acide). Fallback dessine (trou sombre + lisere) tant que le PNG manque.
  const HAZ_DROP = 12;      // descend le trou SOUS les pieds (bord haut sous la surface)
  const HAZ_SCALE = 1.3;    // grossit le trou (les piques/acide restent lisibles en jeu)
  function spawnHazard(cx, groundY) {
    const th = (LEVEL && LEVEL.theme) || {};
    const sname = pickSkin(th.hazard, 'hazard');
    const deco = [];
    if (sname && hasSprite(sname)) {
      const o = add([sprite(sname), artScale(HAZ_SCALE), pos(cx, groundY + HAZ_DROP), anchor('top'),
        z(-0.5), offscreen({ hide: true, distance: TS * 2 }), 'hazarddeco']);
      playIfAnim(o, sname);
      deco.push(o);
    } else {                                       // bouche-trou : trou sombre + lisere de danger
      deco.push(add([rect(TS * 1.2, TS * 0.5), pos(cx, groundY + HAZ_DROP), anchor('top'),
        color(32, 16, 20), opacity(0.97), z(-0.5), offscreen({ hide: true, distance: TS * 2 }), 'hazarddeco']));
      deco.push(add([rect(TS * 1.0, TS * 0.12), pos(cx, groundY + HAZ_DROP), anchor('top'),
        color(150, 40, 40), opacity(0.95), z(-0.45), offscreen({ hide: true, distance: TS * 2 }), 'hazarddeco']));
    }
    // COLLISION : bande a la SURFACE (la gueule de la fosse), NON solide. Large ~
    //  la fosse visible (degat en passant dessus). deco rattache -> detruit avec
    //  la bande (tampons-piege temporaires des boss via api.hazard + lifespan).
    const hit = add([rect(TS * 1.3, TS * 0.46), pos(cx, groundY), anchor('bot'),
      area(), opacity(0), z(-0.4), 'hazard', { deco }]);
    hit.onDestroy(() => deco.forEach((d) => { if (d.exists()) destroy(d); }));
    return hit;
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
    // CULLING (draw seulement) : marge verticale = surplus des cartes hautes,
    //  comme les ombres (castColumnShade) — l'ancre d'un deck cache AU-DESSUS de
    //  l'ecran est hors-cadre mais ses pieds descendent DANS le cadre.
    const decoMargin = TS * 2 + Math.max(0, (LEVEL ? LEVEL.height : 0) - C.height);
    // PIED de la plateforme : panneau solaire par defaut, ou support d'etagere
    //  pour les niveaux interieurs (LEVEL.theme.panelLeg, ex. 'shelf_leg').
    const leg = (LEVEL && LEVEL.theme && LEVEL.theme.panelLeg) || 'panel_leg';
    if (legH > 4 && hasSprite(leg)) {                         // pieds etires jusqu'au sol
      const comps = [sprite(leg), pos(cx, y + CAP_LIP), anchor('top'),
        scale(vec2(1 / ART, (legH / LEG_NAT_H) / ART)), z(-1.2),
        offscreen({ hide: true, distance: decoMargin }), 'paneldeco'];
      if (tint) comps.push(color(tint[0], tint[1], tint[2]));
      objs.push(add(comps));
    }
    const capComps = [sprite(spr), artScale(), pos(cx, y - CAP_WALK_Y), anchor('top'), z(-1),
      offscreen({ hide: true, distance: decoMargin }), 'paneldeco'];
    if (tint) capComps.push(color(tint[0], tint[1], tint[2]));
    const cap = add(capComps);
    objs.push(cap);
    return { cap, objs };
  }

  function addPanel(x, y, spr, breakable) {
    const comps = [rect(TS, TS), pos(x, y), anchor('topleft'), opacity(0),
      area(), body({ isStatic: true }), z(-3), 'solid', 'panel'];         // tuile de collision invisible
    if (breakable) comps.push('breakable', { crumbling: false });
    const t = add(comps);
    // v2 ONE-WAY (JOUEUR seulement, GAMEPLAY.md §3) : le panneau n'arrete Laura
    //  que PAR LE DESSUS — on annule la resolution physique quand elle MONTE,
    //  quand ses pieds sont SOUS le cap (passage lateral / d'en dessous), ou
    //  pendant un drop-through (BAS+SAUT -> p._dropT). Ennemis / projectiles /
    //  bombes : panneau toujours solide (couvert + abri anti-bombe inchanges).
    //  NB : platformEffector du moteur NON retenu — il s'applique a TOUS les
    //  corps et son filtre par angle de velocite ne couvre pas "pieds sous le
    //  cap" (montee laterale) ; meme hook, filtre maison de 4 lignes.
    t.onBeforePhysicsResolve((col) => {
      const o = col.target;
      if (!o || !o.is || !o.is('player')) return;
      if ((o.vel && o.vel.y < 0) || o.pos.y > t.pos.y + 12 || (o._dropT || 0) > 0) col.preventResolution();
    });
    const deco = addPanelDeco(x, y, spr, breakable ? [255, 150, 120] : null);  // rouge = cassable
    t.deco = deco.objs; t.cap = deco.cap;
    // cassable : ne s'amorce qu'en MARCHANT dessus (curPlatform), plus au simple
    //  contact (sinon le traverser par en dessous l'armait — review v2 #12).
    //  onCollideUpdate (pas onCollide) : traverser le panneau par en dessous
    //  PUIS atterrir dessus sans s'en separer ne re-declenche pas d'entree en
    //  collision -> avec onCollide le panneau ne s'amorcait jamais dans ce cas.
    if (breakable) t.onCollideUpdate('player', (pl) => { if (pl.curPlatform && pl.curPlatform() === t) startCrumblePanel(t); });
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
    // PASSANT (persona) : on tire un SEXE puis un CORPS de ce sexe (la TETE est
    //  montee en enfant apres l'add, cf. attachHead). Sinon : skin standard
    //  (LEVEL.theme.enemies[kind] par niveau, sinon variante globale).
    const isPersona = !!def.persona;
    const pcfg = (isPersona && LEVEL && LEVEL.theme && LEVEL.theme.passant) || {};
    const psex = isPersona
      ? (rand(0, 1) < (pcfg.femaleRatio != null ? pcfg.femaleRatio : 0.5) ? 'f' : 'h')
      : null;
    const phead = isPersona ? pickHead(pcfg.heads && pcfg.heads[psex], psex) : null;
    const psize = isPersona ? passantSize(phead, pcfg) : { key: 'moyen', scale: 1 };
    const sname = isPersona
      ? pickSkin(pcfg.bodies && pcfg.bodies[psex], def.sprite + '_' + psex)
      : pickSkin(LEVEL && LEVEL.theme && LEVEL.theme.enemies[kind], def.sprite);
    const visualScale = (def.scale || 1) * psize.scale;
    // PIEDS (cf. FEET_PAD) : la boite remonte de la marge sous les pieds -> le
    //  body pose le dessin sur le sol. Sans body (static/fly/shooter), c'est le
    //  pos qui descend d'autant (en monde : marge source x echelle affichee).
    const feet = isPersona ? FEET_PAD.passant : FEET_PAD.enemy;
    const ySpawn = y + (needsBody ? 0 : feet * visualScale / ART);
    const comps = [
      sprite(sname),
      artScale(visualScale),
      pos(x, ySpawn),
      anchor('bot'),
      // collisionIgnore -> les monstres ne se bloquent/poussent jamais entre eux
      //  (ils se traversent), mais collisionnent toujours le sol. Le PASSANT
      //  (figurant) ignore EN PLUS le joueur ET le boss : c'est un decor inerte
      //  qui n'interagit avec rien -- il encaisse seulement les balles (cf. la
      //  tag 'passant' ciblee par onCollide, plus bas).
      // COLLISION : le passant garde sa boite generique (0.85x0.9, compensee par
      //  la taille du corps). Les autres prennent leur boite mesuree def.hit
      //  (cf. CONFIG.enemies) -> CENTREE (insensible au flip) et BAS cale au bas
      //  de frame (anchor 'bot' => aucun changement de portance au sol). A defaut
      //  (def.hit absent) : 0.85x0.9 comme avant.
      area({
        scale: isPersona
          ? vec2(0.85 / psize.scale, 0.9 / psize.scale)
          : vec2((def.hit && def.hit.w) || 0.85, (def.hit && def.hit.h) || 0.9),
        offset: vec2(0, -feet),   // boite calee sur les pieds DESSINES (cf. FEET_PAD)
        collisionIgnore: isPersona ? ['enemy', 'boss', 'player'] : ['enemy'],
      }),
      // PERF : hors-ecran -> hidden (pas de dessin) + paused (pas d'IA NI de
      //  collision : la grille saute les objets pauses). Seuls les monstres a
      //  l'ecran consomment du CPU -> un niveau large ne ralentit plus.
      //  distance = marge pour qu'ils se "reveillent" avant d'entrer dans le
      //  cadre (> max aggro/2 : ~720px du centre cam, couvre aggro 700).
      //  unpause:true => le check tourne au niveau SCENE (et pas via l'onUpdate
      //  de l'objet, qui se FIGE une fois l'objet pause) -> l'objet se reveille
      //  en rerentrant dans le cadre. SANS ca, un mob/passant pause hors-ecran
      //  ne revenait JAMAIS (il restait hidden+paused -> disparition definitive).
      offscreen({ hide: true, pause: true, unpause: true, distance: TS * 5 }),
      // PASSANT : tague 'passant' (PAS 'enemy') -> exclu du contact joueur et de
      //  l'auto-visee mobile ; seules les balles le touchent. z<0 -> il passe
      //  TOUJOURS derriere les monstres et Laura (qui
      //  sont a z=0). La tete (enfant) suit le corps, donc rien a regler dessus.
      ...(isPersona ? [z(-0.5), kind] : ['enemy', kind]),
      {
        kind, def, hp: def.hp, dir: (ENEMY_SEQ % 2 ? 1 : -1), t: 0, homeX: x, homeY: ySpawn, stun: 0, knockX: 0, knockT: 0, hopDir: 0,
        passantHead: phead, passantSize: psize.key, passantScale: psize.scale,
        // ANIM facon boss (UNE feuille) : hurtT/atkT pilotent l'etat hurt/attack ;
        //  _spr/_anim memorisent la frame courante (cf. enemyAnim / setAnim).
        hurtT: 0, atkT: 0, animWant: 'walk', _spr: sname, _anim: null,
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
    if (isPersona) attachHead(e, pcfg, psex, phead);   // tete South Park (enfant) au-dessus du corps
    return e;
  }

  // Monte une TETE "South Park" (de face, choisie au hasard dans le pool du
  //  biome) en ENFANT du corps d'un passant. Enfant => suivie / cullee /
  //  detruite avec le corps automatiquement, et NON mirroir quand le corps se
  //  retourne (flipX = drapeau de DESSIN, pas une transfo) -> la tete reste
  //  toujours de face. Elle dodeline (bob vertical + leger balancement au cou).
  //  TIRAGE SANS REMISE : pour ne jamais avoir 2 passants identiques, on tire
  //  les tetes dans une pioche melangee (Fisher-Yates) propre a chaque sexe ;
  //  on epuise toute la liste avant de remelanger et reboucler. Les pioches
  //  sont remises a zero a chaque niveau (buildLevel).
  //  POOL PAR NIVEAU (cle `level` du registre js/npc.js) : chaque PNJ peut
  //  "appartenir" a un niveau (0..4 = index dans C.levels). Les tetes DU
  //  niveau courant sont placees en FIN de pioche (pop() les sort d'abord),
  //  le pool general complete ensuite si la map demande plus de PNJ. Au JURY
  //  (et hors registre / level vide), pas de tri : tout le monde est la.
  function shuffleInPlace(a) {
    for (let i = a.length - 1; i > 0; i--) {   // Fisher-Yates (rand du moteur)
      const j = Math.floor(rand(0, i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  function pickHead(pool, key) {
    const ok = (pool || []).filter(hasSprite);
    if (!ok.length) return null;
    if (ok.length === 1) return ok[0];
    const k = key || 'all';
    let deck = HEAD_DECKS[k];
    if (!deck || !deck.length) {
      const isJury = C.levels[CUR_IDX] === 'jury';
      const own = isJury ? [] : ok.filter((n) => window.NPC && window.NPC[n] && window.NPC[n].level === CUR_IDX);
      const rest = ok.filter((n) => own.indexOf(n) === -1);
      deck = shuffleInPlace(rest).concat(shuffleInPlace(own));
      HEAD_DECKS[k] = deck;
    }
    return deck.pop();
  }

  // TAILLE d'un PNJ. Source de verite = le REGISTRE window.NPC (js/npc.js, cle =
  //  sprite de tete) : sa lettre `taille` P/M/G/TG -> categorie. CONFIG.theme.passant
  //  .sizeScale (pcfg.sizeScale) donne le facteur d'echelle de chaque categorie.
  //  Repli si la tete n'est pas au registre : ancien decoupage headSizes (theme), puis
  //  'moyen'. cf. CLAUDE.md (PNJ).
  const NPC_SIZE_KEY = { P: 'petit', M: 'moyen', G: 'grand', TG: 'tresGrand',
    petit: 'petit', moyen: 'moyen', grand: 'grand', tresGrand: 'tresGrand' };
  function passantSize(headName, pcfg) {
    const sizes = (pcfg && pcfg.sizeScale) || {};
    // 1) registre PNJ (source de verite)
    const rec = (window.NPC && headName && window.NPC[headName]) || null;
    let key = rec && NPC_SIZE_KEY[rec.taille];
    // 2) repli legacy : tranches headSizes par sexe (theme.passant), puis 'moyen'
    if (!key) {
      const groups = (pcfg && pcfg.headSizes) || {};
      const m = /^head_npc_([fh])_([0-9]+)$/.exec(headName || '');
      const sex = m && m[1];
      const num = m ? Number(m[2]) : null;
      const bySex = (sex && groups[sex]) || {};
      const order = ['petit', 'moyen', 'grand', 'tresGrand'];
      key = bySex.default || 'moyen';
      if (num != null) {
        for (let i = 0; i < order.length; i++) {
          const k = order[i];
          if ((bySex[k] || []).indexOf(num) !== -1) { key = k; break; }
        }
      }
    }
    return { key, scale: sizes[key] || 1 };
  }

  function attachHead(e, pcfg, sex, headName) {
    const name = headName || pickHead(pcfg.heads && pcfg.heads[sex]);
    if (!name) return null;                        // pas de tete dispo -> corps seul (OK)
    // TAILLE DE TETE CONSTANTE : seul le CORPS change de taille selon le NPC
    //  (4 tailles, cf. passantSize / sizeScale). La tete etant un ENFANT du corps,
    //  elle herite du scale du parent ; on le COMPENSE (/ parentScale) pour que la
    //  tete fasse toujours la meme taille (petit/grand = meme tete, corps different).
    //  La POSITION du cou (`off`) reste, elle, dans le repere du corps -> elle suit
    //  l'echelle du corps (corps plus grand => tete posee plus haut). headScale
    //  ajuste seulement la taille de la tete.
    const parentScale = (e && e.passantScale) || 1;
    const off = pcfg.headLocal || [0, -90];        // point du COU (repere corps, px @ART)
    const headScale = (pcfg.headScale != null ? pcfg.headScale : 1) / parentScale;
    const amp = ((pcfg.headBob != null ? pcfg.headBob : 4) * ART) / parentScale;   // bob (px ecran -> px @ART, compense le scale du corps)
    const rotA = (pcfg.headRot != null ? pcfg.headRot : 3);
    const h = e.add([
      sprite(name),
      pos(off[0], off[1]),
      scale(headScale),
      anchor('bot'),         // chin/cou pose au point `off` -> la tete pousse vers le haut
      rotate(0),
      z(1),                  // au-dessus du corps (meme parent)
      'passanthead',
      // deadDrop/deadScale : transfo appliquee par corpsify quand le corps s'affale
      //  (tete plus basse + plus petite, cf. CONFIG.theme.passant.deadHead*).
      { t: (e.phase || 0), baseY: off[1],
        deadDrop: (pcfg.deadHeadDrop != null ? pcfg.deadHeadDrop : 0),
        deadScale: (pcfg.deadHeadScale != null ? pcfg.deadHeadScale : 1) },
    ]);
    playIfAnim(h, name);
    h.onUpdate(() => {
      if (h.dead) return;          // CADAVRE : tete zombie figee (cf. corpsify)
      h.t += dt();
      h.pos.y = h.baseY + Math.sin(h.t * 3) * amp;   // dodelinement vertical
      h.angle = Math.sin(h.t * 2) * rotA;            // balancement (nod) autour du cou
    });
    e.head = h;
    return h;
  }

  // ---------------------------------------------------------------------
  //  BULLES BD des PNJ (cle `phrases` du registre js/npc.js)
  // ---------------------------------------------------------------------
  //  De temps en temps, UN PNJ visible "dit" une de ses phrases dans une
  //  bulle BD au-dessus de sa tete. Volontairement RARE : une seule bulle a
  //  la fois + pause aleatoire entre deux (cf. CONFIG.theme.passant.bubble),
  //  encore plus rare au jury (gap x juryGapMult, la scene est bondee). Le
  //  scheduler vit dans scene('game') (npcBubbleLoop). La bulle est un objet
  //  MONDE de premier niveau (pas un enfant) : le texte reste net (echelle 1,
  //  pas de compensation @ART) et suit le PNJ a la main ; elle meurt avec lui
  //  (corpsify/save posent e.dead), a la fin du timer ou s'il sort de l'ecran.
  //  Elle ne NAIT que si le PNJ est vers le MILIEU de l'ecran (centerFrac) :
  //  le filtre !hidden ne suffit pas, la marge du culling reveille les PNJ
  //  AVANT qu'ils entrent dans le cadre -> on voyait la bulle (clampee au bord)
  //  avant son PNJ. Z = celui des passants (-0.5) : la bulle vit DERRIERE les
  //  vivants (z 0), comme son PNJ — pas par-dessus tout le decor.
  //  Le font bitmap rend mal les accents (cf. CLAUDE.md) -> on translitere la
  //  phrase a l'affichage (e accentue -> e ; ecritures non latines best-effort).
  const stripAccents = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

  function npcPhrases(e) {
    const rec = window.NPC && e.passantHead && window.NPC[e.passantHead];
    return (rec && rec.phrases && rec.phrases.length) ? rec.phrases : null;
  }

  // Y MONDE du sommet de la tete d'un PNJ (point d'accroche de la bulle).
  //  h.pos = point du COU en repere CORPS (suit l'echelle du parent), h.height
  //  = hauteur native du PNG de tete, multipliee par les echelles tete+corps.
  function npcHeadTop(e) {
    const h = e.head;
    const ps = (e.scale && e.scale.y != null) ? e.scale.y : 1;
    if (!h || !h.exists()) return e.pos.y - TS * 2.1 * (e.passantScale || 1);
    const hs = (h.scale && h.scale.y != null) ? h.scale.y : 1;
    return e.pos.y + (h.pos.y - h.height * hs) * ps;
  }

  // Pile de fonts de la bulle : on garde celles du bundle effectivement
  //  chargees. null = aucune -> repli font bitmap + translitteration.
  function bubbleFont(cfg) {
    const want = ((cfg && cfg.font) || 'font_bubble,font_bubble_kh').split(',');
    const ok = want.map((s) => s.trim()).filter((n) => FONTS_LOADED.has(n));
    return ok.length ? ok.join(',') : null;
  }

  function npcBubble(e, phrase, dur) {
    const pad = 9, tail = 13;
    const cfg = (LEVEL && LEVEL.theme && LEVEL.theme.passant && LEVEL.theme.passant.bubble) || {};
    // Avec les fonts TTF embarquees, la phrase s'affiche TELLE QUELLE (accents,
    //  khmer...) ; sans elles, repli font bitmap + accents translitteres.
    const fnt = bubbleFont(cfg);
    const topts = { size: 13, width: 175, align: 'center' };
    if (fnt) topts.font = fnt;
    const b = add([pos(e.pos.x, npcHeadTop(e)), z(-0.5), 'bubble', { t: 0 }]);
    const label = b.add([
      text(fnt ? phrase : stripAccents(phrase), topts),
      color(40, 32, 26), anchor('center'), pos(0, 0), z(2),
    ]);
    const w = Math.max(label.width + pad * 2, 36), h = label.height + pad * 2;
    if (hasSprite('ui_bubble')) {
      // sprite BD etire pour couvrir le corps (w x h) + la queue (le PNG remplit
      //  bodyFrac de sa hauteur avec le corps de bulle, le reste = la queue ;
      //  mesure sur assets/sprites/ui_bubble.png).
      const bodyFrac = 0.76, H = h / bodyFrac;
      const sp = b.add([sprite('ui_bubble'), anchor('bot'), pos(0, 0), z(0), scale(1)]);
      sp.scale = vec2(w / sp.width, H / sp.height);
      label.pos = vec2(0, -(H - h / 2));
    } else {
      // repli sans sprite : carte blanche arrondie + losange en guise de queue
      b.add([rect(14, 14), rotate(45), anchor('center'), pos(0, -tail + 4), color(255, 255, 252), outline(3, rgb(46, 38, 34)), z(0)]);
      b.add([rect(w, h, { radius: 8 }), anchor('bot'), pos(0, -tail), color(255, 255, 252), outline(3, rgb(46, 38, 34)), z(1)]);
      label.pos = vec2(0, -(tail + h / 2));
    }
    b.onUpdate(() => {
      b.t += dt();
      const cx = getCam().x;
      // meurt avec son PNJ, a la fin du timer, ou des qu'il QUITTE l'ecran
      //  (sans attendre le culling et sa marge : pas de bulle orpheline au bord)
      if (b.t > dur || !e.exists() || e.dead || e.paused || e.hidden
        || Math.abs(e.pos.x - cx) > C.width / 2 + TS) { destroy(b); return; }
      // suit le PNJ, mais reste DANS le cadre camera : un PNJ en bord d'ecran
      //  garde sa bulle lisible (la queue glisse un peu de sa tete, assume)
      const half = w / 2 + 6;
      b.pos = vec2(
        Math.max(cx - C.width / 2 + half, Math.min(cx + C.width / 2 - half, e.pos.x)),
        npcHeadTop(e) - 4);
    });
    return b;
  }

  // Scheduler (appele par scene('game')) : compte a rebours -> tire UN PNJ a
  //  l'ecran qui a des phrases -> bulle -> nouveau compte a rebours.
  function npcBubbleLoop(levelKey) {
    const cfg = (LEVEL && LEVEL.theme && LEVEL.theme.passant && LEVEL.theme.passant.bubble) || {};
    const mult = (levelKey === 'jury') ? (cfg.juryGapMult != null ? cfg.juryGapMult : 2.5) : 1;
    const gap = () => rand(cfg.gapMin != null ? cfg.gapMin : 9, cfg.gapMax != null ? cfg.gapMax : 20) * mult;
    let cur = null, t = gap() * 0.5;          // 1re bulle plus tot (on decouvre la feature)
    onUpdate(() => {
      if (cur && cur.exists()) return;        // UNE bulle a la fois
      t -= dt();
      if (t > 0) return;
      // candidats : PNJ vers le MILIEU de l'ecran seulement (a centerFrac de la
      //  largeur autour du centre camera) — un PNJ encore au bord / hors cadre
      //  (le culling le reveille en avance) ne parle pas.
      const cx = getCam().x, cw = C.width * (cfg.centerFrac != null ? cfg.centerFrac : 0.3);
      const cands = get('passant').filter((o) => o.exists() && !o.dead && !o.paused && !o.hidden
        && Math.abs(o.pos.x - cx) <= cw && npcPhrases(o));
      if (!cands.length) { t = 1.5; return; } // personne d'eloquent au centre -> retente bientot
      const e = cands[Math.floor(rand(0, cands.length))];
      const ph = npcPhrases(e);
      cur = npcBubble(e, ph[Math.floor(rand(0, ph.length))], cfg.dur != null ? cfg.dur : 4);
      t = gap();
    });
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

  // Une feuille de monstre = clips walk/hurt/attack. enemyAnim joue le clip
  //  voulu en RETOMBANT proprement : si l'etat demande (hurt/attack) n'existe
  //  pas sur la feuille (corbeau 'fly', criquet 'hop', monstres encore en 2
  //  frames), on garde la boucle (def.anim || 'walk') -> aucun crash, le flash
  //  d'opacite reste alors le seul retour visuel de degat.
  function animHasClip(spr, clip) {
    const a = C.anims && C.anims[baseName(spr)];
    return !!(a && a.anims && a.anims[clip]);
  }
  function enemyAnim(e, want) {
    const loop = e.def.anim || 'walk';
    const name = (want === 'walk' || !animHasClip(e._spr, want)) ? loop : want;
    setAnim(e, e._spr, name);
  }

  function enemyBehavior(e) {
    if (e.dead) return;            // CADAVRE : inerte, ne bouge plus (cf. corpsify)
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
          e.t = 0; e.atkT = 0.35;   // fenetre d'anim 'attack' au moment du tir
          enemyBullet(e.pos.x, e.pos.y - TS * 0.6, p, e.def.shotSpeed, 'enemy', e.def.shot);
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
      default: e.flipX = e.facing < 0; break;   // static : regarde le joueur
    }

    // --- ANIM (apres l'IA) : priorite hurt > attack > walk. Les monstres en
    //  contact (mêlée/immobile) jouent 'attack' quand le joueur est colle ; les
    //  shooters via atkT au tir. enemyAnim retombe sur la boucle si le clip manque.
    if (e.hurtT > 0) e.hurtT -= dt();
    if (e.atkT > 0) e.atkT -= dt();
    let want = 'walk';
    if (e.hurtT > 0) want = 'hurt';
    else if (e.atkT > 0) want = 'attack';
    else if (e.def.move !== 'shooter' && Math.abs(toP) < TS * 0.95) want = 'attack';
    enemyAnim(e, want);
  }

  function hitEnemy(e, bullet) {
    if (bullet && bullet.exists && bullet.exists()) destroy(bullet);
    if (!e.exists()) return;
    if (e.hp === Infinity) return;
    e.hp -= (bullet ? bullet.dmg : 1);
    if (e.hp <= 0) {
      PLAYER.score += e.def.score || 0;
      addPoof(e.pos.x, e.pos.y - TS * 0.5);
      if (e.def.persona) { registerKill(); corpsify(e); }   // passant abattu -> reste en CADAVRE sur la carte (ne disparait pas)
      else destroy(e);
    } else {
      e.hurtT = 0.2;                 // declenche la frame 'hurt' (cf. enemyAnim)
      e.opacity = 0.5;
      wait(0.08, () => { if (e.exists()) e.opacity = 1; });
    }
  }

  // PASSANTS = figurants INOFFENSIFS. Les abattre ne rapporte rien et n'affaiblit
  //  PLUS l'arme (la morale n'est pas une ressource de combat, cf. GAMEPLAY.md) :
  //  ca laisse juste un CADAVRE + incremente p.kills (compteur "meurtre" du HUD,
  //  pese sur les medailles). Le CHAT, lui, SAUVE les figurants (savePassant).
  function registerKill() {
    const p = PLAYER; if (!p) return;
    p.kills = (p.kills || 0) + 1;
    p.killFlash = 0.6;                       // declenche le pulse du compteur HUD
    // MORALITE : abattre un figurant n'affaiblit plus l'arme (cf. GAMEPLAY.md :
    //  la morale n'est PAS une ressource de combat). Reste une stat (kills) qui
    //  pese sur le score-conscience / les medailles "sauves".
    flashMsg(npcNoun() + ' ABATTU');
  }

  // Nom AFFICHE des PNJ : des "POTES" au niveau 1, des "COLLEGUES" ensuite
  //  (le tag interne reste 'passant', cf. CLAUDE.md). Pas d'accents (font bitmap).
  const npcNoun = () => (CUR_IDX === 0 ? 'POTE' : 'COLLEGUE');

  // Le CHAT sauve un figurant qu'il croise (cf. GAMEPLAY.md) : +score, +compteur
  //  "sauves", le PNJ s'envole en se dissipant (pas de cadavre). Meme regle que
  //  corpsify : on DIFFERE le retrait area/body (jamais d'unuse en plein onCollide).
  function savePassant(e) {
    if (!e || !e.exists() || e.dead || e.saved) return;
    e.saved = true; e.dead = true;              // dead=true AUSSI -> bloque un corpsify() concurrent (meme garde)
    const p = PLAYER;
    if (p) { p.saved = (p.saved || 0) + 1; p.score += 120; p.saveFlash = 0.6; }
    flashMsg('SAUVE !  +120');
    sfx('pickup');
    addPoof(e.pos.x, e.pos.y - TS * 0.6);
    e.untag('passant'); e.tag('saved');        // hors IA / souffle de zone passant
    wait(0, () => { if (e.exists()) { try { e.unuse('area'); } catch (_) {} try { e.unuse('body'); } catch (_) {} } });
    let tt = 0;
    e.onUpdate(() => {
      if (!e.exists()) return;                  // garde : peut survivre 1 tick a un destroy externe (transition de scene)
      tt += dt();
      e.pos.y -= 46 * dt();                     // s'envole doucement
      e.opacity = Math.max(0, 1 - tt / 1.0);
      if (e.head && e.head.exists()) e.head.opacity = e.opacity;   // l'opacite ne s'herite pas -> fade la tete aussi
      if (tt > 1.0) destroy(e);
    });
  }

  // PASSANT abattu -> CADAVRE permanent. Le figurant ne disparait plus : il
  //  devient un decor inerte qui RESTE sur la carte. On le rend immobile (plus
  //  d'IA ni de gravite), intraversable des balles (area retiree -> les tirs le
  //  traversent), on le sort des systemes passant (untag) et on remplace sa
  //  tete vivante par la version ZOMBIE (head_npc_..._dead, figee). Le corps
  //  prend une pose affalee : sprite dedie <body>_dead (1 frame) s'il existe,
  //  sinon on bascule le corps debout au sol (repli en attendant le sprite).
  //  offscreen(hide/pause) recycle les cadavres hors-cadre -> ils s'accumulent
  //  sans cout CPU et reapparaissent quand on revient.
  function corpsify(e) {
    if (!e || !e.exists() || e.dead) return;
    e.dead = true;
    try { e.stop(); } catch (_) {}            // fige l'anim de marche
    // CHIRURGIE DE COMPOSANTS DIFFEREE D'UN TICK : corpsify arrive depuis un
    //  onCollide, donc EN PLEIN parcours de la grille de collision du moteur.
    //  destroy() y est sur (le moteur re-teste !exists() sur chaque paire),
    //  mais unuse() est IMMEDIAT : retirer 'area' ici supprime worldArea /
    //  collisionIgnore sous les pieds du parcours -> TypeError sporadiques.
    //  wait(0) repousse le retrait a la phase timers (hors parcours). Entre
    //  temps le corps est deja inerte cote gameplay (dead + untag ce frame).
    wait(0, () => {
      if (!e.exists()) return;
      try { e.unuse('body'); } catch (_) {}   // plus de gravite
      try { e.unuse('area'); } catch (_) {}   // inerte : les balles le traversent
    });
    e.untag('passant');                       // hors IA / souffle de zone passant
    e.tag('corpse');
    e.z = -0.6;                               // toujours sous les vivants

    const deadBody = (e._spr || '') + '_dead';
    if (hasSprite(deadBody)) {                 // corps affale dedie (1 sprite)
      e.use(sprite(deadBody));
      playIfAnim(e, deadBody);
    } else {                                   // repli : bascule au sol (pivot = pieds)
      e.angle = (e.facing >= 0 ? 90 : -90);
    }

    const h = e.head;                          // tete vivante -> tete zombie
    if (h && h.exists()) {
      h.dead = true;
      // Corps affale : on DESCEND la tete (deadDrop) pour qu'elle touche le corps
      //  et on la RETRECIT (deadScale) pour suivre la perspective du cadavre.
      h.pos.y = h.baseY + (h.deadDrop || 0);
      if (h.deadScale && h.deadScale !== 1) h.scale = h.scale.scale(h.deadScale);
      h.angle = rand(-8, 8);                    // petit tilt aleatoire : les cadavres ne sont pas tous parfaitement droits
      const dn = (e.passantHead || '') + '_dead';
      if (hasSprite(dn)) { try { h.stop(); } catch (_) {} h.use(sprite(dn)); }
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

  // Marqueur de ZONE D'IMPACT au sol : anneau aplati (lu comme une ombre) qui
  //  GROSSIT + clignote pendant le delai d'alerte d'une chute du ciel. Telegraphe
  //  lisible "ca va tomber ICI, degage la colonne" -> esquive juste et claire.
  function addImpactMarker(x, y, dur) {
    const life = dur || 0.6;
    const m = add([
      circle(24), pos(x, y - 2), anchor('center'),
      color(244, 92, 54), opacity(0.5), scale(vec2(1, 0.42)),  // aplati = ombre au sol
      z(2), 'fx', { t: 0 },
    ]);
    m.onUpdate(() => {
      m.t += dt();
      const s = 0.7 + 0.6 * Math.min(1, m.t / life);            // grossit a l'approche
      m.scale = vec2(s, s * 0.42);
      m.opacity = 0.3 + 0.4 * Math.abs(Math.sin(m.t * 16));     // clignote = urgence
      if (m.t >= life) destroy(m);
    });
  }

  // Haut (y monde) du PREMIER solide de la colonne sous atX, en partant du ciel :
  //  sol '=', panneau '-'/'x', caillou '^'. C'est la surface ou la bombe s'ecrase
  //  (-> bloquee par un panneau au-dessus du joueur). null si colonne vide (trou).
  function surfaceTopAt(atX) {
    const grid = LEVEL && LEVEL.grid;
    if (!grid) return null;
    const c = Math.floor(atX / TS);
    if (c < 0) return null;
    for (let r = 0; r < grid.length; r++) {
      const ch = grid[r] && grid[r][c];
      if (ch === '=' || ch === '-' || ch === 'x' || ch === '^') return r * TS;
    }
    return null;
  }

  // Surface (sol/panneau) AU NIVEAU OU SOUS les pieds (atY) — PAS le solide le
  //  plus haut de la colonne. surfaceTopAt remontait sur un deck de panneaux
  //  AU-DESSUS de Laura -> le cadavre etait pose tout en haut ("trop haut") ;
  //  ici on part de la rangee des pieds et on descend jusqu'au 1er solide.
  function surfaceUnderFeet(atX, atY) {
    const grid = LEVEL && LEVEL.grid;
    if (!grid) return null;
    const c = Math.floor(atX / TS);
    if (c < 0) return null;
    for (let r = Math.max(0, Math.floor((atY - 1) / TS)); r < grid.length; r++) {
      const ch = grid[r] && grid[r][c];
      if (ch === '=' || ch === '-' || ch === 'x' || ch === '^') return r * TS;
    }
    return null;
  }

  // Ombre de chute : feuille fx_bomb_shadow (6 frames qui grossissent), posee SUR
  //  LA SURFACE visee (sol/panneau), PAS au niveau du perso. La frame suit
  //  l'avancement de la chute = telegraphe lisible. Repli cercle si le PNG manque.
  function addBombShadow(atX, surfaceY, dur) {
    const life = dur || 0.6;
    if (!hasSprite('fx_bomb_shadow')) { addImpactMarker(atX, surfaceY, life); return; }
    const a = C.anims && C.anims.fx_bomb_shadow;
    const NF = (a && a.sliceX) || 6;
    const m = add([
      sprite('fx_bomb_shadow'), artScale(), pos(atX, surfaceY - 2), anchor('center'),
      opacity(0.9), z(2), 'fx', { t: 0 },
    ]);
    m.onUpdate(() => {
      m.t += dt();
      const k = Math.min(1, m.t / life);
      m.frame = Math.min(NF - 1, Math.floor(k * NF));   // la feuille EST l'anim (grossit)
      if (m.t >= life) destroy(m);
    });
  }

  // BOMBE QUI TOMBE : un vrai projectile descend pendant le telegraphe (ombre qui
  //  grandit sur la SURFACE visee), puis EXPLOSE au PREMIER impact -> souffle qui
  //  TUE les monstres autour + blesse Laura (bombBlast). Bloquee par le 1er solide
  //  de la colonne : se planquer SOUS un panneau protege. DASH/saut lateral esquive.
  //  sprName = sprite de bombe (fallback cercle).
  function dropBomb(atX, groundY, delay, sprName) {
    const cfg = C.bombs || {};
    const d = delay || 0.6;
    const landY = surfaceTopAt(atX);             // 1er solide de la colonne (sol/panneau)
    const surfaceY = (landY != null) ? landY : groundY;
    addBombShadow(atX, surfaceY, d);
    const startY = surfaceY - (cfg.fallFrom || 320);
    const spr = (sprName && hasSprite(sprName)) ? sprName : 'shot_bomb';
    const useSpr = hasSprite(spr);
    const bomb = add([
      ...(useSpr ? [sprite(spr), artScale(cfg.size || 0.6)] : [circle(9), color(26, 22, 24), outline(3, rgb(255, 150, 70))]),
      pos(atX, startY), anchor('center'), z(10),
      offscreen({ distance: 600, destroy: true }), 'fx', { t: 0, boom: false },
    ]);
    if (useSpr) playIfAnim(bomb, spr);
    bomb.onUpdate(() => {
      if (bomb.boom) return;
      bomb.t += dt();
      bomb.pos.y = startY + (surfaceY - startY) * Math.min(1, bomb.t / d);
      if (bomb.angle != null) bomb.angle += 240 * dt();
      if (bomb.t >= d) {                          // 1er impact sur la surface = explosion
        bomb.boom = true;
        const bx = bomb.pos.x; destroy(bomb);
        bombBlast(bx, surfaceY, cfg.blast || 64, cfg.damage || 2);
      }
    });
  }

  // ---------------------------------------------------------------------
  //  BOSS (IA deportee dans js/bosses.js)
  // ---------------------------------------------------------------------
  // --- ONDE DE CHOC AU SOL (seisme LOCALISE, v2 — remplace les shakes de
  //  telegraphe, cf. CONFIG.quake) : vague qui parcourt LE SOL (elle passe SOUS
  //  les panneaux, cf. columnGroundY) depuis x dans la direction dir ; blesse le
  //  joueur s'il est AU SOL sur son passage -> sauter / dasher / etre sur un
  //  panneau l'evite. Visuel : feuille fx_quake si embarquee + poussiere.
  function spawnQuake(x, dir, range) {
    const q = C.quake || {};
    const gy = columnGroundY(Math.floor(x / TS));
    const e = add([rect(q.width || 26, 18), pos(x, gy), anchor('bot'), area(), opacity(0), z(1),
      'quakewave', { vx: (dir >= 0 ? 1 : -1) * (q.speed || 300), traveled: 0, range: range || 300, dustT: 0 }]);
    let vis = null;
    if (hasSprite('fx_quake')) {
      vis = add([sprite('fx_quake'), artScale(), pos(x, gy + 2), anchor('bot'), z(1.2), 'fx']);
      vis.flipX = dir < 0;
      playIfAnim(vis, 'fx_quake');
    }
    e.onUpdate(() => {
      e.pos.x += e.vx * dt();
      e.pos.y = columnGroundY(Math.floor(e.pos.x / TS));   // suit le SOL, pas les plateformes
      e.traveled += Math.abs(e.vx) * dt();
      e.dustT -= dt();
      if (e.dustT <= 0) {
        e.dustT = 0.045;
        add([circle(rand(3, 6)), pos(e.pos.x + rand(-8, 8), e.pos.y - rand(0, 9)), anchor('center'),
          color(168, 142, 96), opacity(0.7), z(1.1), lifespan(0.28, { fade: 0.22 }), 'fx']);
      }
      if (vis && vis.exists()) { vis.pos.x = e.pos.x; vis.pos.y = e.pos.y + 2; }
      if (e.traveled >= e.range) destroy(e);
    });
    e.onDestroy(() => { if (vis && vis.exists()) destroy(vis); });
    e.onCollide('player', (pl) => { if (pl.isGrounded()) damagePlayer(q.damage || 1, e.pos.x); });
    return e;
  }

  // --- BOSS INVITE (boss-rush du jury, v2, GAMEPLAY.md §4.4) ----------------
  //  Spawn un ancien boss a hpFrac de ses HP : tag 'boss' normal (IA / anims /
  //  clamp d'arene) + flag guest -> hitBoss ne touche ni bossesAlive ni cafe ni
  //  message de victoire, et le HUD lui dessine une mini-barre sous celle du jury.
  function addGuestBoss(key, x, hpFrac) {
    const def = C.bosses[key];
    if (!def) return null;
    const gy = columnGroundY(Math.floor(x / TS));
    const b = spawnBoss(key, x, gy - 2);
    b.guest = true;
    b.hp = Math.max(5, Math.round((def.maxHp || def.hp) * (hpFrac || 0.35)));
    b.maxHp = b.hp;                                 // barre pleine a l'invocation
    b.homeX = x;
    if (LEVEL && LEVEL.bossRange) b.range = LEVEL.bossRange;   // l'invite roame DANS l'arene du jury
    addPoof(x - 16, gy - TS); addPoof(x + 16, gy - TS * 1.5); addPoof(x, gy - TS * 0.5);
    sfx('boss');
    return b;
  }

  // petit texte flottant au-dessus d'un boss (OUVERT ! / GARDE !).
  //  NB : lifespan EXIGE le comp opacity (sinon "Component lifespan requires
  //  component opacity" en console et rien ne s'affiche).
  function bossFloaty(b, txt, col) {
    if (!txt) return;
    const o = add([text(txt, { size: 16 }), pos(b.pos.x, b.pos.y - TS * 2.6), anchor('center'),
      color(col[0], col[1], col[2]), opacity(1), z(60), lifespan(0.9, { fade: 0.5 }), 'fx']);
    o.onUpdate(() => { o.pos.y -= 24 * dt(); });
  }

  // "tink" : tir encaisse par la GARDE du boss (degats reduits / tick absorbe).
  //  1er tink d'un boss -> floaty pedagogique "GARDE !".
  function bossTink(b, x, y) {
    add([circle(4), pos(x, y), anchor('center'), color(205, 205, 205), opacity(0.85), z(46),
      lifespan(0.14, { fade: 0.12 }), 'fx']);
    if (!b._guardMsgDone) { b._guardMsgDone = true; bossFloaty(b, C.story.bossGuard, [185, 185, 185]); }
  }

  // --- VERROU D'ARENE (v2.3) -----------------------------------------------
  //  Reponse au playtest "on entre/sort de l'arene a volonte -> regen gratuite
  //  (bouclier soleil 18/s hors de portee du boss), boucle sans risque" : des
  //  que Laura ENTRE dans l'arene du boss (trigger POSITION dans PLAYER.onUpdate),
  //  des murs invisibles bloquant LE JOUEUR SEULEMENT ferment l'arene.
  //  - Gauche : toujours (1 tuile avant le bord d'arene = la ou le clamp du boss
  //    s'arrete). Droite : seulement si la poche entre l'arene et le bord jouable
  //    depasse 3 tuiles (niveau3/4/jury — ailleurs le bord du niveau suffit).
  //  - PLEINE HAUTEUR de map : couvre les rangees hors ecran (niveau5) et les
  //    sauts rollers/velo. Le boss, les monstres, le chat, les projectiles et
  //    les bombes TRAVERSENT (meme hook maison que les panneaux one-way).
  //  - Trigger sur LA POSITION et pas b._awoken : un lob qui reveille le boss de
  //    loin (anti-sniping de hitBoss) ne doit pas enfermer Laura DEHORS.
  //  - Leves a la VICTOIRE (hitBoss — l'etoile '*' est DERRIERE le mur droit en
  //    niveau3/4/jury : teardown obligatoire) et au respawn d'arene (Laura
  //    reapparait dehors ; ils se re-arment a la re-entree).
  //  Les caches de pickups pre-arene restent volontairement DEHORS : on fait le
  //  plein AVANT d'entrer, puis le combat est sans retour (l'anti-exploit vise).
  function addArenaGates() {
    if (!LEVEL || LEVEL.gates || LEVEL.bossX == null) return;
    // SNAPSHOT du loadout AVANT-BOSS (1re entree d'arene) : "reprendre au boss"
    //  restaure EXACTEMENT ce setup (armes/equipement d'avant l'arene), pas l'etat
    //  a la mort ni un refill max. cf. restartBoss.
    if (!LEVEL.bossLoadout && PLAYER && PLAYER.exists()) {
      const p = PLAYER;
      LEVEL.bossLoadout = { power: p.power, rate: p.rate, equipped: p.equipped, catCharges: p.catCharges, sunMax: p.sunMax, ammoKey: p.ammoKey };
    }
    const bx = LEVEL.bossX, r = LEVEL.bossRange || 300;
    const mk = (col) => {
      const gx = col * TS, gy = columnGroundY(col);
      const g = add([rect(TS, LEVEL.height), pos(gx, 0), anchor('topleft'), opacity(0),
        area(), body({ isStatic: true }), 'arenagate']);
      g.onBeforePhysicsResolve((c2) => {
        const o = c2.target;
        if (!o || !o.is || !o.is('player')) c2.preventResolution();
      });
      // VISUEL : pilier d'energie dore translucide qui pulse — le verrou doit se
      //  VOIR (un mur invisible serait lu comme un bug de collision).
      const vis = add([rect(10, gy), pos(gx + TS / 2, 0), anchor('top'),
        color(255, 206, 71), opacity(0.3), z(30), 'arenagatefx', { t: 0 }]);
      vis.onUpdate(() => { vis.t += dt(); vis.opacity = 0.2 + 0.16 * Math.abs(Math.sin(vis.t * 3)); });
      g.onDestroy(() => {
        if (vis.exists()) destroy(vis);
        addPoof(gx + TS / 2, gy - TS * 0.5); addPoof(gx + TS / 2, gy - TS * 1.6);
      });
      addPoof(gx + TS / 2, gy - TS * 0.5); addPoof(gx + TS / 2, gy - TS * 1.6);
      return g;
    };
    const gates = [mk(Math.floor((bx - r) / TS) - 1)];
    if (LEVEL.maxX - (bx + r) > TS * 3) gates.push(mk(Math.ceil((bx + r) / TS)));
    LEVEL.gates = gates;
    flashMsg(C.story.arenaClose);
    sfx('boss');
  }
  function openArenaGates() {
    if (!LEVEL || !LEVEL.gates) return;
    LEVEL.gates.forEach((g) => { if (g.exists()) destroy(g); });
    LEVEL.gates = null;
  }

  const BOSS_API = {
    TS: TS,
    bullet: enemyBullet,
    add: (kind, x, y) => spawnEnemy(kind, x, y),
    quake: spawnQuake,                        // v2 : seisme localise au sol
    addGuestBoss: addGuestBoss,               // v2 : boss-rush du jury
    // (api.shake supprime en v2 : les telegraphes de boss sont des FX localises
    //  — poofs/quake — et plus aucun appelant dans bosses.js. Les explosions
    //  gardent leur shake via safeShake direct cote game.js.)
    poof: addPoof,
    marker: addImpactMarker,
    dropBomb: dropBomb,                       // bombe qui tombe + explose (dette tech 2)
    hazard: (atX, groundY, dur, delay) => {   // tampon-piege au sol temporaire (Cendrine / jury)
      const dl = delay || 0;
      // RECALE LA CIBLE SUR LA SURFACE (meme logique que dropBomb) : l'IA vise
      //  p.pos.y, or Laura saute en permanence -> sans ca le piege (et sa
      //  hitbox) restait SUSPENDU en l'air a la hauteur du saut.
      const gy = surfaceTopAt(atX);
      const fy = (gy != null) ? gy : groundY;
      if (dl > 0) addImpactMarker(atX, fy, dl);
      wait(dl, () => {
        const h = spawnHazard(atX, fy);
        if (h && dur) { h.temp = true; h.use(lifespan(dur, { fade: 0.3 })); }   // temp -> purge a la mort du boss
      });
    },
  };

  function spawnBoss(key, x, y) {
    const def = C.bosses[key];
    const sname = variant(def.sprite);          // feuille DEPLACEMENT (idle/hurt)
    // feuille ATTAQUE separee (def.attackSprite) ; null si le PNG manque -> on
    //  reste sur la feuille de deplacement (pas de crash).
    const aname = (def.attackSprite && hasSprite(def.attackSprite)) ? variant(def.attackSprite) : null;
    const b = add([
      sprite(sname),
      artScale(def.scale || 1),    // jury (def.scale) rend plus gros (megaboss a 3 membres) ; autres = 1x
      pos(x, y),
      anchor('bot'),
      // offset : la feuille boss a 16px transparents sous les pieds (cf. FEET_PAD)
      //  -> boite remontee d'autant, le body pose les pieds DESSINES sur le sol.
      // collisionIgnore 'panel' : les decks de panneaux dans l'arene sont les
      //  PERCHOIRS de Laura (esquive/lob) -> le boss balaie DESSOUS sans etre
      //  bloque. Sans ca, un deck bas (h3 < hauteur du boss) coincait le
      //  tracteur en plein 'drive' : edge jamais atteint -> plus de stall ni de
      //  demi-tour, boss fige qui bombarde (bug boss niveau1). Les BALLES, elles,
      //  collisionnent toujours les panneaux (couvert inchange).
      area({ scale: vec2(0.8, 0.92), offset: vec2(0, -FEET_PAD.boss), collisionIgnore: ['panel'] }),
      body(),
      opacity(1),
      'boss',
      {
        key, def, spr: sname, sprAtk: aname, hp: def.hp, maxHp: def.maxHp || def.hp,
        // range PER-INSTANCE (lu par bosses.js) : def.range par defaut, surcharge
        //  par les bornes d'arene '['/']' de la map (cf. buildLevel). Demi-largeur
        //  de l'arene autour de homeX.
        range: def.range || 360,
        t: 0, dir: -1, homeX: x, stun: 0, knockX: 0, knockT: 0,
        hurtT: 0, animWant: 'idle', _spr: sname, _anim: null,
        // garde posee DES LE SPAWN (meme formule que bossBehavior) : sans ca le
        //  tir qui REVEILLE un boss endormi passait a degats pleins sans tink
        //  (hitBoss traite guard == null comme une fenetre ouverte).
        guard: (def.guard != null) ? def.guard : 0.35,
      },
    ]);
    // cote boss du no-shove joueur<->boss (cf. spawnPlayer) : il TRAVERSE Laura,
    //  il ne la pousse pas (le degat passe par l'evenement de contact, heavy).
    b.onBeforePhysicsResolve((col) => {
      const o = col.target;
      if (o && o.is && o.is('player')) col.preventResolution();
    });
    // ANTI-ENFONCEMENT (bug "le jury rentre dans le sol quand on s'approche") : un
    //  boss est TOUJOURS au sol d'une arene PLATE et ne saute jamais. La gravite +
    //  la resolution physique d'un GROS corps (jury x1.32) chevauchant Laura ou un
    //  invite pouvaient le faire DERIVER vers le bas dans le sol. On memorise sa
    //  hauteur posee (1er contact sol) et on l'y REVISSE chaque frame (jamais plus
    //  bas). Horizontal et knockback inchanges ; aucun boss ne bouge en Y.
    b.onUpdate(() => {
      if (b._restY == null) { if (b.isGrounded && b.isGrounded()) b._restY = b.pos.y; return; }
      if (b.pos.y > b._restY) { b.pos.y = b._restY; if (b.vel) b.vel = vec2(b.vel.x, 0); }
    });
    BOSS_LIST.push(b);   // ref directe pour le HUD (cf. buildHUD, plus de get('boss') par frame)
    return b;
  }

  function bossBehavior(b) {
    const p = PLAYER;
    if (!p || !p.exists()) return;
    if (b.stun > 0) { b.stun -= dt(); setAnim(b, b.spr, 'idle'); return; }
    if (b.knockT > 0) { b.knockT -= dt(); b.move(b.knockX, 0); }
    // --- v2.1 ARENE : boss en VEILLE tant que Laura n'a pas atteint son arene ---
    //  Avant ca : aucune IA -> aucune bombe/tir/charge (fini les bombes qui
    //  pleuvent jusqu'au spawn, cf. agriculteur niveau1 / michael niveau4). Le
    //  boss se REVEILLE une fois pour toutes des qu'elle entre dans l'arene OU
    //  qu'elle le touche (hitBoss -> b._awoken, anti-sniping). Les INVITES du
    //  jury (b.guest) spawnent deja engages -> jamais en veille.
    if (!b.guest && !b._awoken) {
      // REVEIL = FRANCHISSEMENT de la ligne d'arene (MEME seuil que addArenaGates :
      //  homeX - range + 1 tuile). Avant : IMMOBILE en idle, AUCUNE attaque ni
      //  deplacement (plus d'arenaPad qui le reveillait trop tot). Le coup encaisse
      //  (hitBoss -> _awoken) reste un reveil legitime (anti-sniping hors arene).
      if (p.pos.x >= b.homeX - (b.range || 300) + TS) b._awoken = true;
    }
    if (!b.guest && !b._awoken) {
      b.flipX = (p.pos.x - b.pos.x) >= 0;     // regarde Laura (sprites boss pointent a gauche)
      b.animWant = 'idle';
      bossAnim(b, 'idle');
      return;
    }
    // --- v2 garde/fenetres (GAMEPLAY.md §4.1) : prepare l'etat AVANT l'IA ---
    //  guard est RESET chaque frame a la valeur de config ; l'IA le repasse a 1
    //  dans ses etats de punition (bosses.js). vulnT = fenetre forcee (chat),
    //  catVulnLock = re-arm du chat, _chCd = ticks de degat par canal (hitBoss).
    //  p2/p2Just = bascule de PHASE 2 a 50% des HP (lue par l'IA).
    b.guard = (b.def.guard != null) ? b.def.guard : 0.35;
    if (b.vulnT > 0) b.vulnT -= dt();
    if (b.catVulnLock > 0) b.catVulnLock -= dt();
    if (b._chCd) { for (const k in b._chCd) if (b._chCd[k] > 0) b._chCd[k] -= dt(); }
    const p2 = (b.hp / b.maxHp) <= 0.5;
    b.p2Just = p2 && !b.p2;
    b.p2 = p2;
    if (b.p2Just) { addPoof(b.pos.x - 18, b.pos.y - TS); addPoof(b.pos.x + 18, b.pos.y - TS * 1.4); sfx('boss'); }
    const AI = window.BOSS_AI || {};
    const ai = AI[b.def.behavior] || AI.default;
    if (ai) ai(b, p, BOSS_API);
    // --- v2 : surlignage DORE pendant une fenetre (guard >= 1 ou vulnT) ----
    const open = (b.vulnT > 0) || b.guard >= 1;
    if (open && !b._openVis) {
      b._openVis = true;
      try { b.use(color(255, 214, 120)); } catch (_) {}
      if ((b._openMsgT || 0) <= 0) { bossFloaty(b, C.story.bossOpen, [255, 210, 90]); b._openMsgT = 3; }
    } else if (!open && b._openVis) {
      b._openVis = false;
      try { b.unuse('color'); } catch (_) {}
    }
    if (b._openMsgT > 0) b._openMsgT -= dt();
    // FLINCH : hurtT n'ecrase l'anim QUE sur les poses passives (idle). Pendant
    //  une attaque (feuille _atk), l'ecraser faisait STROBOSCOPER le boss sous
    //  tir soutenu : swap _atk -> _move 0.12s a chaque tick, puis play() qui
    //  REDEMARRE le clip d'attaque a la frame 0 — le jet/la charge ne depassait
    //  jamais la frame ~2. Le flash d'opacite (hitBoss) suffit comme feedback.
    if (b.hurtT > 0) { b.hurtT -= dt(); if (b.animWant === 'idle') b.animWant = 'hurt'; }
    // Garde le boss SUR le sol jouable : empeche une IA (teleport de Cendrine,
    //  charges, va-et-vient) de l'envoyer au-dela du bord droit -> chute dans
    //  le vide -> boss injoignable -> niveau infinissable.
    if (LEVEL && LEVEL.maxX) {
      const lo = TS * 0.5, hi = LEVEL.maxX - TS * 0.5;
      if (b.pos.x < lo) b.pos.x = lo; else if (b.pos.x > hi) b.pos.x = hi;
    }
    bossAnim(b, b.animWant || 'idle');
  }

  // Bascule entre les DEUX feuilles du boss : 'attack' ET les clips dedies de la
  //  feuille _atk ('windup'/'dash'/'throw', poses par l'IA charger) -> feuille
  //  _atk ; tout le reste (idle/hurt) -> feuille de deplacement. Un clip dedie
  //  ABSENT de la feuille (autres boss, vieux PNG) retombe sur 'attack' — sans
  //  ce repli, play() jetterait (avale par setAnim) et la feuille resterait
  //  FIGEE sur sa frame courante.
  const BOSS_ATK_CLIPS = { attack: 1, windup: 1, dash: 1, throw: 1 };
  function bossAnim(b, want) {
    const useAtk = BOSS_ATK_CLIPS[want] && b.sprAtk;
    if (useAtk && want !== 'attack' && !animHasClip(b.sprAtk, want)) want = 'attack';
    setAnim(b, useAtk ? b.sprAtk : b.spr, want);
  }

  function hitBoss(b, bullet) {
    if (bullet && bullet.exists && bullet.exists()) destroy(bullet);
    if (!b.exists()) return;
    b._awoken = true;                        // etre touche REVEILLE le boss (anti-sniping hors arene)
    // --- v2 (GAMEPLAY.md §4.1) : TICK par canal + GARDE ---------------------
    //  'seed'        : 1 coup / bossHit.seedCd — la volee de graines compte
    //                  pour 1, degat du tick = bullet.bossDmg (arsenal.bossTick).
    //  'aoe'/'aoe2'  : 1 explosion / bossHit.aoeCd par canal (la patisserie
    //                  principale + AU PLUS une mini-explosion des enfers).
    //  'cat'         : pas de tick (1 seul coup par chat de toute facon).
    //  Hors fenetre (guard < 1 et pas de vulnT) : degats x guard, "tink" gris.
    const BH = C.bossHit || {};
    const ch = (bullet && bullet.channel) || 'seed';
    const hx = (bullet && bullet.pos) ? bullet.pos.x : b.pos.x;
    const hy = (bullet && bullet.pos) ? bullet.pos.y : b.pos.y - TS;
    // INVULNERABLE (jury en interlude 'invite' : l'IA pose guard = 0 chaque
    //  frame, contrat bosses.js) : AUCUN degat — ni le plancher des 5%, ni le
    //  chat. Tink gris = feedback "ca ne sert a rien". Ne consomme pas de tick.
    //  guard <= 0 est ABSOLU : une fenetre vulnT ouverte par le chat juste avant
    //  l'interlude ne doit pas le percer (l'echappatoire !(vulnT>0) laissait le
    //  jury "en concertation" encaisser des degats pleins pendant 1.5s).
    if (b.guard != null && b.guard <= 0) { bossTink(b, hx, hy); return; }
    const cds = { seed: BH.seedCd || 0.25, aoe: BH.aoeCd || 0.5, aoe2: BH.aoeCd || 0.5 };
    if (cds[ch] != null) {
      if (!b._chCd) b._chCd = {};
      if ((b._chCd[ch] || 0) > 0) { if (ch === 'seed') bossTink(b, hx, hy); return; }   // tick absorbe
      b._chCd[ch] = cds[ch];
    }
    //  Le CHAT ignore la garde (c'est l'ouvre-boite des boss) : sans ca son coup
    //  RETOUR (apres vulnOpen ecoule) serait ampute par guard et l'aller-retour
    //  ne ferait pas ses ~2x bossDamage promis (cf. CONFIG.cat).
    const open = (b.vulnT > 0) || (b.guard == null) || b.guard >= 1 || ch === 'cat';
    const raw = bullet ? (bullet.bossDmg != null ? bullet.bossDmg : (bullet.dmg || 1)) : 1;
    if (!open && ch === 'seed') bossTink(b, hx, hy);   // encaisse en garde : feedback
    b.hp -= raw * (open ? 1 : Math.max(0.05, b.guard));
    b.hurtT = 0.12;
    b.opacity = 0.55;
    wait(0.08, () => { if (b.exists()) b.opacity = 1; });
    if (b.hp <= 0) {
      b.hp = 0;
      if (b.guest) {
        // boss INVITE (jury) : pas de cafe / message / bossesAlive — le jury reprend.
        PLAYER.score += Math.round((b.def.score || 0) * 0.25);
        for (let i = 0; i < 10; i++) addPoof(b.pos.x + rand(-26, 26), b.pos.y - rand(0, TS * 1.6));
        destroy(b);
        safeShake(8); sfx('boss');
        return;
      }
      PLAYER.score += b.def.score || 0;
      LEVEL.bossesAlive = Math.max(0, LEVEL.bossesAlive - 1);
      for (let i = 0; i < 14; i++) addPoof(b.pos.x + rand(-30, 30), b.pos.y - rand(0, TS * 2));
      spawnPickup('cafe', b.pos.x, b.pos.y - TS);
      destroy(b);
      if (LEVEL.bossesAlive === 0) {
        // VICTOIRE PROPRE : purge les dangers residuels (bombe encore en vol,
        //  tampons temporaires, ondes, tirs) — mourir 0.5s APRES "BOSS BATTU !"
        //  se vivait comme une injustice. Meme menage que respawnAtArena.
        get('ehot').forEach((h) => destroy(h));
        get('quakewave').forEach((q) => destroy(q));
        get('fx').forEach((o) => { if (o.boom !== undefined) destroy(o); });
        get('hazard').forEach((h) => { if (h.temp) destroy(h); });
        openArenaGates();          // verrou d'arene leve (l'etoile '*' est parfois derriere)
      }
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
    if (catOut()) return;                     // un seul chat a la fois
    if (p.catCharges <= 0) { flashMsg(C.story.catEmpty); return; }
    p.catCharges--;
    p.catRegenT = 0;                          // (re)demarre le compteur de recharge auto a chaque lancer
    p.catTossT = C.cat.tossTime || 0.4;       // brieve pose "lance le chat" puis Laura reprend ses anims
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
      { dir, startX, baseY: p.pos.y, hitOnPass: new Set(), phase: 'run' },
    ]);
    CAT_REF = cat;
    cat.flipX = dir < 0;
    try { cat.play('run'); } catch (e) {}
    // ALLER-RETOUR : le chat blesse a CHAQUE passage. A l'ALLER (phase 'run') il
    //  ne fait que outMul x les degats (l'ennemi survit, affaibli) ; au RETOUR
    //  (phase 'back'), degats PLEINS (il l'acheve). 1 coup par entite et par
    //  passage (hitOnPass, vide au demi-tour) -> jamais de multi-hit sur une passe.
    //  onCollideUpdate (pas onCollide) : si le chat CHEVAUCHE encore la cible au
    //  moment du demi-tour, le coup du retour partirait jamais avec un simple
    //  onCollide (pas de nouvelle entree en collision).
    cat.onCollideUpdate('enemy', (e) => {
      if (cat.hitOnPass.has(e)) return;
      cat.hitOnPass.add(e);
      const mul = (cat.phase === 'run') ? (C.cat.outMul != null ? C.cat.outMul : 0.5) : 1;
      hitEnemy(e, { exists: () => false, dmg: C.cat.damage * mul });
    });
    cat.onCollideUpdate('boss', (bo) => {
      if (cat.hitOnPass.has(bo)) return;          // 1 coup PAR PASSAGE -> aller + retour = ~2x sur les boss
      cat.hitOnPass.add(bo);
      // v2 : le chat OUVRE une fenetre de vulnerabilite (l'ouvre-boite des boss),
      //  re-armable au plus tot cat.vulnRelock s plus tard sur le meme boss.
      //  Sauf boss INVULNERABLE (jury en interlude, guard=0) : pas d'ouverture
      //  (ni de relock gaspille) sur un boss qu'on ne peut pas toucher.
      if ((bo.catVulnLock || 0) <= 0 && (C.cat.vulnOpen || 0) > 0 && !(bo.guard != null && bo.guard <= 0)) {
        bo.vulnT = Math.max(bo.vulnT || 0, C.cat.vulnOpen);
        bo.catVulnLock = C.cat.vulnRelock || 8;
        bossFloaty(bo, C.story.bossOpen, [255, 210, 90]);
      }
      hitBoss(bo, { exists: () => false, dmg: C.cat.bossDamage, channel: 'cat' });
    });
    cat.onCollide('passant', (e) => savePassant(e));   // le chat SAUVE les figurants qu'il croise
    cat.onUpdate(() => {
      const sp = C.cat.speed;
      EHOTS.forEach((h) => { if (h.exists() && h.pos.dist(cat.pos) < C.cat.cleanRadius) destroy(h); });  // nettoie les tirs (Set direct, pas de scan get())
      if (cat.phase === 'run') {                 // ALLER : court vers l'avant
        cat.move(cat.dir * sp, 0);
        if (Math.abs(cat.pos.x - cat.startX) > C.cat.range) { cat.dir = -cat.dir; cat.flipX = cat.dir < 0; cat.phase = 'back'; cat.hitOnPass.clear(); }   // demi-tour : on peut re-frapper (degats PLEINS au retour)
      } else {                                   // RETOUR : revient vers Laura, disparait en la touchant
        const target = (PLAYER && PLAYER.exists()) ? PLAYER.pos.x : cat.startX;
        cat.dir = target >= cat.pos.x ? 1 : -1;
        cat.flipX = cat.dir < 0;
        cat.move(cat.dir * sp, 0);
        if (Math.abs(cat.pos.x - target) <= (C.cat.catchDist || 26)) {
          addPoof(cat.pos.x, cat.pos.y - 20);   // le chat revient et disparait ; Laura n'est plus figee
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
      // PERF : meme culling que les mobs (hors-ecran = ni dessin, ni bob, ni
      //  collision ; seul le joueur les ramasse et il est toujours a l'ecran).
      //  Marge verticale = surplus des cartes hautes (pickups des decks caches).
      offscreen({ hide: true, pause: true, unpause: true, distance: TS * 5 + Math.max(0, (LEVEL ? LEVEL.height : 0) - C.height) }),
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
      case 'sunray': p.sun = Math.min(p.sunMax, p.sun + C.sun.rayGain); break;
      case 'cafe':   p.hp = Math.min(p.maxHp, p.hp + (it.def.heal || 1)); break;
      case 'data':   p.data++; break;               // donnee de terrain : score + % data (plus de lien au TIER)
      case 'page':   p.pages++; break;
      case 'publi':  p.gotPubli = true; flashMsg(C.story.publi); break;
      case 'croquette': p.catCharges = Math.min(C.cat.maxCharges, p.catCharges + 1); break;
      default: break;
    }
    if (it.def.upgrade) {                          // UPGRADE D'ARSENAL : +1 PUISSANCE ou +1 CADENCE (commun aux 2 armes)
      const ax = it.def.upgrade;                   // 'power' | 'rate'
      const cap = (C.arsenal && C.arsenal[ax] && C.arsenal[ax].max) || 3;
      if (ax === 'power') { if (p.power < cap) { p.power++; } p.powerFlash = 0.8; flashMsg('PUISSANCE ' + p.power); }
      else                { if (p.rate  < cap) { p.rate++;  } p.rateFlash  = 0.8; flashMsg('CADENCE ' + p.rate); }
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
  //  seq:true -> la liste `sprite` = les MORCEAUX CONSECUTIFS d'un panorama
  //  (decoupe en tranches <= 4096 px : MAX_TEXTURE_SIZE de pas mal de GPU
  //  mobiles), repetes DANS L'ORDRE (periode = largeur cumulee). Sans seq,
  //  liste = variantes (une au hasard, comportement historique). Les copies
  //  entierement hors-cadre sont masquees (hidden) : KAPLAY ne cull pas seul.
  function addBandLayer(spec, th) {
    const list = Array.isArray(spec.sprite) ? spec.sprite : [spec.sprite];
    const seq = !!spec.seq && list.length > 1 && list.every(hasSprite);
    const par = spec.parallax != null ? spec.parallax : 1;
    // vpar = parallax VERTICAL (revele/cache en grimpant, cf. zone-ciel '|').
    //  Defaut = horizontal SAUF le panorama INTERIEUR (band 'ground' d'un niveau
    //  indoor) : c'est le mur autour de Laura -> vpar 1 (colle au monde, defile
    //  hors-champ en grimpant pour DECOUVRIR le plafond-ciel). worldY != null
    //  (couches du plafond-ciel) : vpar 1 aussi. cf. addSkyCeiling / setCam.
    const indoorPano = !!(LEVEL && LEVEL.theme && LEVEL.theme.indoor) && spec.worldY == null && (spec.y == null || spec.y === 'ground');
    const vpar = spec.vpar != null ? spec.vpar : (indoorPano ? 1 : par);
    const z0  = spec.z != null ? spec.z : -20;
    const op  = spec.opacity != null ? spec.opacity : 1;
    const anc = spec.anchor || 'bot';
    const baseCamY0 = (LEVEL && LEVEL.baseCamY != null) ? LEVEL.baseCamY : (C.height / 2 - CAM_DROP);
    const y   = (spec.worldY != null) ? (spec.worldY - baseCamY0 + C.height / 2)
              : ((spec.y == null || spec.y === 'ground') ? HORIZON_Y : spec.y);
    const sc  = (spec.scale || 1) / ART;
    const tw0 = spec.tileW || 320;
    const n   = seq ? list.length : 1;
    // seq : morceaux larges (panorama) -> 3 groupes couvrent toujours l'ecran.
    const count = seq ? 3 * n : Math.ceil(C.width / tw0) + 2;
    const sname0 = seq ? null : pickSkin(list, list[0]);
    if (!seq && (!sname0 || !hasSprite(sname0))) return;
    const objs = [];
    for (let i = 0; i < count; i++) {
      const sname = seq ? list[i % n] : sname0;
      const o = add([sprite(sname), scale(sc), pos(-9999, y), anchor(anc), fixed(), z(z0), opacity(op), 'bg'].concat(layerTint(spec, th)));
      playIfAnim(o, sname);
      objs.push(o);
    }
    objs[0].onUpdate(() => {
      const tw = spec.tileW || ((objs[0].width || 0) * sc) || tw0;   // largeur d'UN morceau
      const period = tw * n;
      const off = (((getCam().x * par) % period) + period) % period;
      // defilement VERTICAL (zone-ciel) : vy = (base - courant) * vpar.
      const vy = ((LEVEL && LEVEL.baseCamY != null) ? (LEVEL.baseCamY - LEVEL.camY) : 0) * vpar;
      for (let i = 0; i < objs.length; i++) {
        const x = Math.floor(i / n) * period + (i % n) * tw - off;
        objs[i].pos.x = x;
        objs[i].pos.y = y + vy;
        // copie surement hors-cadre -> pas de draw. Marge d'UNE largeur de
        //  morceau de chaque cote : couvre toute ancre (bot/top = centre-x).
        objs[i].hidden = (x - tw > C.width) || (x + tw < 0);
      }
    });
  }

  // SPRITES DISPERSES (nuages, oiseaux...) : derivent en X dans une fenetre
  //  de largeur `span` et se recyclent -> defilement infini.
  function addScatterLayer(spec, th) {
    const list = Array.isArray(spec.sprite) ? spec.sprite : [spec.sprite];
    const par  = spec.parallax != null ? spec.parallax : 0.3;
    const vpar = spec.vpar != null ? spec.vpar : par;
    const z0   = spec.z != null ? spec.z : -22;
    const op   = spec.opacity != null ? spec.opacity : 1;
    const sc   = (spec.scale || 1) / ART;
    const n    = spec.count || 7;
    const yMin = spec.yMin != null ? spec.yMin : 36;
    const yMax = spec.yMax != null ? spec.yMax : 150;
    // worldY != null : les sprites sont disperses AU-DESSUS d'une ancre MONDE
    //  (plafond-ciel interieur) -> on convertit en Y ecran a la cam de base.
    const baseCamY0 = (LEVEL && LEVEL.baseCamY != null) ? LEVEL.baseCamY : (C.height / 2 - CAM_DROP);
    const yBase = (spec.worldY != null) ? (spec.worldY - baseCamY0 + C.height / 2) : 0;
    const span = spec.span || (C.width + 260);
    const margin = 130;
    const items = [];
    for (let i = 0; i < n; i++) {
      const sname = pickSkin(list, list[0]);
      if (!sname || !hasSprite(sname)) continue;
      const bx = ((i + 0.5) / n) * span + rand(-span / (n * 2.5), span / (n * 2.5));
      const by = yBase + yMin + rand(0, Math.max(0, yMax - yMin));
      const fr = randGridFrame(sname);   // grille de variantes (bg_cloud 4x3) -> une au hasard
      const spr = fr != null ? sprite(sname, { frame: fr }) : sprite(sname);
      const o = add([spr, scale(sc * rand(0.7, 1.15)), pos(-9999, by), anchor('center'), fixed(), z(z0), opacity(op), 'bg'].concat(layerTint(spec, th)));
      playIfAnim(o, sname);
      items.push({ o, bx, by });
    }
    if (!items.length) return;
    items[0].o.onUpdate(() => {
      const scroll = getCam().x * par;
      const vy = ((LEVEL && LEVEL.baseCamY != null) ? (LEVEL.baseCamY - LEVEL.camY) : 0) * vpar;
      for (const it of items) {
        const x = (((it.bx - scroll) % span) + span) % span;
        it.o.pos.x = x - margin;
        it.o.pos.y = it.by + vy;
      }
    });
  }

  // PLAFOND-CIEL (niveaux INTERIEURS en hauteur, cf. zone-ciel '|') : au-dessus du
  //  panorama il n'y a que la couleur de fond plate -> on pose un CIEL (bleu +
  //  montagnes + nuages) ANCRE AU MONDE (vpar 1 = se revele en grimpant) et DERRIERE
  //  le panorama (z < -22 -> cache en bas, decouvert en hauteur). Reglages via
  //  theme.ceiling { row|worldY, sky:[r,g,b], mountains, clouds, tint, ... }.
  function addSkyCeiling(th) {
    if (!LEVEL) return;
    const cfg = (th && th.ceiling) || {};
    const rows = Math.round(LEVEL.height / TS);
    // plafond = juste au-dessus de la bande TOUJOURS visible (les 11 du bas).
    const cy = (cfg.worldY != null) ? cfg.worldY
             : ((cfg.row != null ? cfg.row : Math.max(0, rows - 12)) * TS);
    const sky = cfg.sky || [126, 192, 238];                 // bleu ciel (pas la teinte interieure)
    const skyTh = Object.assign({}, th, { tint: cfg.tint || null });   // pas de teinte interieure sur le ciel
    // 1) pan de ciel : rect plein largeur ancre au plafond (monte vers le haut).
    const sr = add([rect(C.width * 3, LEVEL.height + C.height * 2), pos(C.width / 2, 0), anchor('bot'),
      fixed(), z(-39), color(sky[0], sky[1], sky[2]), 'bg']);
    sr.onUpdate(() => { sr.pos.x = C.width / 2; sr.pos.y = cy - LEVEL.camY + C.height / 2; });
    // 2) montagnes (base calee sous le plafond -> tuckee derriere le panorama, cimes au ciel).
    addBandLayer({ sprite: cfg.mountains || 'bg_mountains', band: true, parallax: cfg.mpar != null ? cfg.mpar : 0.20,
      vpar: 1, anchor: 'bot', worldY: cy + (cfg.mDrop != null ? cfg.mDrop : 10), z: -38, tileW: cfg.mTileW || 480 }, skyTh);
    // 3) nuages disperses AU-DESSUS du plafond.
    addScatterLayer({ sprite: cfg.clouds || 'bg_cloud', scatter: true, parallax: cfg.cpar != null ? cfg.cpar : 0.35,
      vpar: 1, count: cfg.cloudN || 6, worldY: cy, yMin: -210, yMax: -40, z: -37, scale: cfg.cloudScale || 0.85 }, skyTh);
  }

  // ---------------------------------------------------------------------
  //  CONSTRUCTION DU NIVEAU depuis l'ASCII
  // ---------------------------------------------------------------------
  function buildLevel(def) {
    ENEMY_SEQ = 0;
    PLAYER = null;     // sans ca, le garde-fou "Pas de @ dans la map" etait mort des la 2e partie
    CAT_REF = null;    // refs de la partie precedente (les objets sont detruits par go())
    BOSS_LIST = [];
    EHOTS.clear();     // filet : si la teardown de scene ne declenche pas onDestroy
    HEAD_DECKS = {};   // nouveau niveau -> nouvelles pioches de tetes (sans remise)
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
      hazard:  lT.hazard || dT.hazard,                       // skin du sol piege ('%') : riziere / acide (sinon fallback 'hazard')
      panelLeg: lT.panelLeg || dT.panelLeg,                  // pied des plateformes (panneau / etagere)
      indoor: lT.indoor || dT.indoor,                        // interieur : bords invisibles (pas de caillou)
      // passant : fusion PEU PROFONDE (un niveau qui fournit `passant` remplace
      //  bodies/heads/headLocal ; les champs absents retombent sur le defaut).
      passant: Object.assign({}, dT.passant, lT.passant),
    };
    // grid MUTABLE (tableaux de caracteres) : un panneau cassable qui explose
    //  remet sa case a ' ' -> inShade() et l'ombre projetee se mettent a jour.
    LEVEL = { width: levelW, height: rows.length * TS, bossesAlive: 0, sun: null, dataTotal: 0, pageTotal: 0, hasPubli: false, grid: rows.map((r) => r.split('')), shadeByCol: {}, theme };
    // Cadrage vertical : baseCamY = vue EPINGLEE en bas (comportement historique,
    //  ex-const camY). camY = position COURANTE de la cam, suivie par la boucle de
    //  jeu (zone-ciel '|' -> suit Laura vers le haut). Lue par les couches parallax
    //  pour leur defilement VERTICAL. cf. setCam + addBandLayer/addScatterLayer.
    LEVEL.baseCamY = C.height / 2 - CAM_DROP + Math.max(0, LEVEL.height - C.height);
    LEVEL.camY = LEVEL.baseCamY;

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

    let exitCx = null;   // centre X de la sortie '*' -> sert a poser le caillou de bord DROIT au-dela
    let skyMinC = Infinity, skyMaxC = -1;   // ZONE-CIEL '|' : colonnes ou la cam suit en hauteur
    let arenaLcol = null, arenaRcol = null; // BORNES D'ARENE '['/']' (optionnel) : taille de l'arene du boss
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
          case 'e': spawnPickup('puissance', cx, y + TS / 2); break;     // upgrade arsenal : +1 PUISSANCE
          case 'i': spawnPickup('cadence', cx, y + TS / 2); break;       // upgrade arsenal : +1 CADENCE
          case '^': addRock(cx, groundY); break;
          case '%': spawnHazard(cx, groundY); break;   // sol piege (degat au contact)
          case '|': if (c < skyMinC) skyMinC = c; if (c > skyMaxC) skyMaxC = c; break;   // ZONE-CIEL : la cam suit en hauteur (rien d'autre pose ; cf. skyZone)
          case '[': arenaLcol = (arenaLcol == null) ? c : Math.min(arenaLcol, c); break;   // BORD GAUCHE d'arene (rien d'autre pose)
          case ']': arenaRcol = (arenaRcol == null) ? c : Math.max(arenaRcol, c); break;   // BORD DROIT d'arene (rien d'autre pose)
          case 'T': spawnEnemy('camion', cx, groundY); break;
          case 'A': spawnEnemy('assureur', cx, groundY); break;
          case 'R': spawnEnemy('ademe', cx, groundY); break;
          case 'V': spawnEnemy('corbeau', cx, groundY - TS * 1.5); break;
          case 'J': spawnEnemy('criquet', cx, groundY); break;
          // --- nouveaux monstres (design definitif) ---
          case 'M': spawnEnemy('moustique', cx, groundY - TS * 1.6); break;   // VOLANT
          case 'E': spawnEnemy('abeille', cx, groundY - TS * 1.6); break;     // VOLANT
          case 'K': spawnEnemy('cafard', cx, groundY); break;                 // SOL (rampe)
          case 'W': spawnEnemy('transpalette', cx, groundY); break;           // VEHICULE
          case 'G': spawnEnemy('livreur', cx, groundY); break;                // VEHICULE
          case 'C': spawnEnemy('coursier', cx, groundY); break;               // VEHICULE
          case 'I': spawnEnemy('imprimante', cx, groundY); break;             // TIR
          case 'H': spawnEnemy('chips', cx, groundY); break;                  // TIR
          case 'U': spawnEnemy('tuyau', cx, groundY); break;                  // TIR
          case 'S': spawnEnemy('sac', cx, groundY); break;                    // IMMOBILE
          case 'F': spawnEnemy('fontaine', cx, groundY); break;               // IMMOBILE
          case 'D': spawnEnemy('dossiers', cx, groundY); break;               // IMMOBILE
          case 'N':   // figurant (corps biome + tete au hasard) + compte pour la medaille SAUVES
            LEVEL.passantTotal = (LEVEL.passantTotal || 0) + 1;
            spawnEnemy('passant', cx, groundY);
            break;
          case 'B':
            LEVEL.bossesAlive++;
            // v2 : retient la position/portee du boss pour le CHECKPOINT d'arene
            LEVEL.bossX = cx;
            LEVEL.bossRange = (C.bosses[def.boss] && C.bosses[def.boss].range) || 300;
            spawnBoss(def.boss, cx, groundY);
            break;
          case '*': exitCx = cx; LEVEL.sun = spawnSun(cx, y + TS / 2); break;
          default: break;
        }
      }
    });

    // BORNES D'ARENE ('['/']') : redimensionnent l'arene du boss (gates, reveil,
    //  clamp IA, checkpoint). Sans symbole -> taille par defaut (def.range). On
    //  garde le boss AU CENTRE de son 'B' (modele symetrique homeX +/- range) :
    //  range = distance max de bossX a l'un des bords -> l'arene couvre les 2.
    if ((arenaLcol != null || arenaRcol != null) && LEVEL.bossX != null) {
      const bx = LEVEL.bossX;
      const L = (arenaLcol != null) ? arenaLcol * TS : (bx - LEVEL.bossRange);
      const R = (arenaRcol != null) ? (arenaRcol + 1) * TS : (bx + LEVEL.bossRange);
      LEVEL.bossRange = Math.max(TS * 4, bx - L, R - bx);   // garde-fou mini 4 tuiles
      BOSS_LIST.forEach((b) => { b.range = LEVEL.bossRange; });
    }

    // ZONE-CIEL (trigger '|') : plage X ou la cam suit Laura vers le haut pour
    //  reveler un niveau cache en hauteur ; desactivee passe toX. cf. setCam.
    if (skyMaxC >= 0) {
      LEVEL.skyZone = { fromX: skyMinC * TS, toX: (skyMaxC + 1) * TS };
      // INTERIEUR : au-dessus du panorama il n'y a que la couleur de fond plate.
      //  On pose un PLAFOND-CIEL (ciel bleu + montagnes + nuages, parallax) DERRIERE
      //  le panorama (z < panorama) -> cache en bas, revele en grimpant. cf. addSkyCeiling.
      if (theme.indoor) addSkyCeiling(theme);
    }

    // COLLISION du sol '=' : colliders fusionnes par segment (cf. addGroundColliders).
    addGroundColliders(LEVEL.grid);

    // OMBRES PROJETEES sous les panneaux (cf. castColumnShade) : une par colonne.
    for (let c = 0; c < cols; c++) castColumnShade(c);

    // CAILLOUX DE BORD : un bloc solide (sans degat) a CHAQUE extremite du
    //  niveau -> ni Laura ni les monstres ne tombent hors de la map. Le bord
    //  DROIT est pose AU-DELA de la sortie '*' et du clamp du boss (maxX) ->
    //  il ne gene jamais l'acces a la sortie ni le combat de boss.
    if (PLAYER) {
      const ry = PLAYER.pos.y;                                       // surface jouable (pieds de Laura)
      const wall = !!(theme && theme.indoor);                        // interieurs : bords invisibles (pas de caillou)
      addRock(TS / 2, ry, wall);                                     // bord GAUCHE (colonne 0)
      const exitRight = (exitCx != null) ? exitCx + TS / 2 : 0;
      addRock(Math.max(LEVEL.maxX, exitRight) + TS / 2, ry, wall);   // bord DROIT
    }
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
    // Haut de l'ombre = base VISIBLE du panneau (bord avant du cap = haut de la
    //  tuile, tr*TS). Avant c'etait (tr+1)*TS = BAS de la tuile -> l'ombre
    //  demarrait 1 tuile trop bas (decalee sous le panneau).
    const x0 = c * TS, yTop = tr * TS;
    if (yBot - yTop <= 0) return;
    const dx = (yBot - yTop) * SHADE_SLOPE;                 // decalage horizontal au sol (penche)
    // PERF : ombre ancree a SA colonne (pos x0) + points RELATIFS -> offscreen()
    //  la cache hors-cadre (sinon toutes les ombres se redessinent chaque frame).
    //  Cam fixe en Y -> culling en X. Marge TS+dx : couvre le penche vers la droite.
    //  + le SURPLUS de hauteur des cartes hautes (rangees AU-DESSUS de l'ecran,
    //  cf. camY) : l'ancre (x0, 0) y est hors ecran en haut, et l'ombre d'un
    //  panneau hors-champ DOIT rester visible — les toits/decks caches projettent
    //  leur ombre dans l'aire de jeu, c'est un element de gameplay (zones sans
    //  regen + indice qu'il existe un etage secret). inShade() est deja base
    //  grille (insensible a l'ecran) ; ceci aligne le VISUEL dessus.
    const sMargin = TS + dx + Math.max(0, (LEVEL ? LEVEL.height : 0) - C.height);
    reg[c].push(add([pos(x0, 0), polygon([                  // parallelogramme penche
      vec2(0, yTop), vec2(TS, yTop), vec2(TS + dx, yBot), vec2(dx, yBot),
    ]), color(40, 56, 100), opacity(0.24), z(-0.5), offscreen({ hide: true, distance: sMargin }), 'shade', { col: c }]));
    reg[c].push(add([rect(TS, 7), pos(x0, yTop), color(22, 30, 60), opacity(0.20), z(-0.5), offscreen({ hide: true, distance: sMargin }), 'shade', { col: c }])); // contact
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
  // ---------------------------------------------------------------------
  // ---------------------------------------------------------------------
  //  HUD v3 : 3 panneaux fond brun chaud semi-transparent.
  //    Haut-gauche  : coeurs · jauge soleil · objectifs
  //    Haut-droite  : timer (dixiemes) + score
  //    Bas-centre   : armes · munitions (bas de l'ecran)
  //  Barre boss     : haut-centre entre les deux panneaux, seulement engagee.
  // ---------------------------------------------------------------------
  const HUD_FRAME_W = {
    heart: 56, pickup_data: 64, pickup_page: 64, pickup_publi: 64,
    pickup_croquette: 64, ammo_graine: 52, ammo_graine_fire: 56,
    ammo_cookie: 52, ammo_gateau: 60, ammo_gateau_enfer: 72,
    cat_run: 120, pickup_sunray: 64, pickup_cafe: 64,
    skull: 56, pickup_puissance: 64, pickup_cadence: 64,
  };

  function buildHUD() {
    const W = C.width, H = C.height;
    const COL = {
      ink:    rgb(44, 27, 15),    cream:  rgb(252, 245, 224),
      dim:    rgb(200, 175, 140), gold:   rgb(255, 208, 74),
      goldHi: rgb(255, 238, 168), leaf:   rgb(140, 212, 96),
      red:    rgb(244, 88, 74),   rose:   rgb(252, 156, 136),
      panel:  rgb(130, 82, 34),
    };

    const R = (x, y, w, h, o) => drawRect(Object.assign({ pos: vec2(x, y), width: w, height: h }, o));

    function panel(x, y, w, h) {
      R(x + 2, y + 4, w, h, { radius: 10, color: COL.ink, opacity: 0.40 });
      R(x, y, w, h, { radius: 10, color: COL.panel, opacity: 0.62 });
      R(x, y, w, h, { radius: 10, fill: false, outline: { width: 2, color: rgb(210, 155, 72) } });
    }

    // CACHE DE LAYOUT TEXTE : drawText refait un formatText (layout complet,
    //  boucle glyphes, allocations) A CHAQUE appel — et inkT dessine chaque
    //  label 9 fois (contour 8 directions + face) -> ~80-100 layouts/frame.
    //  On met en cache le texte FORMATE (couleur/opacite bakees dans les
    //  glyphes) et on ne paye plus que 9 drawFormattedText par label, chacun
    //  translate via la pile de transfos -> pixels strictement identiques.
    //  Cache dans la closure de buildHUD = reset a chaque entree de scene.
    const ftCache = new Map();
    function fmtCached(s, sz, anchor, col, op) {
      const k = s + '|' + sz + '|' + anchor + '|' + col.r + ',' + col.g + ',' + col.b + '|' + op;
      let ft = ftCache.get(k);
      if (!ft) {
        if (ftCache.size > 300) ftCache.clear();   // borne anti-croissance (timer/score = cles changeantes)
        ft = formatText({ text: s, pos: vec2(0, 0), anchor: anchor, size: sz, color: col, opacity: op });
        ftCache.set(k, ft);
      }
      return ft;
    }
    function inkT(s, x, y, sz, fill, anchor, op) {
      op = (op == null) ? 1 : op;
      anchor = anchor || 'left';
      const o = sz >= 16 ? 2.0 : 1.6;
      const ftInk = fmtCached(s, sz, anchor, COL.ink, op);
      for (let a = 0; a < 8; a++) {
        pushTransform();
        pushTranslate(x + Math.cos(a * Math.PI / 4) * o, y + Math.sin(a * Math.PI / 4) * o);
        drawFormattedText(ftInk);
        popTransform();
      }
      const ftFill = fmtCached(s, sz, anchor, fill, op);
      pushTransform(); pushTranslate(x, y); drawFormattedText(ftFill); popTransform();
    }

    function icon(name, x, y, tpx, opt) {
      opt = opt || {};
      if (!hasSprite(name)) return;
      const fw = HUD_FRAME_W[name] || 64;
      drawSprite({ sprite: name, frame: opt.frame || 0, pos: vec2(x, y), anchor: 'center', scale: vec2(tpx / fw), opacity: (opt.opacity == null) ? 1 : opt.opacity });
    }

    function bar(x, y, w, h, t, fill, hi) {
      t = Math.max(0, Math.min(1, t));
      const r = h / 2;
      R(x, y + 1.5, w, h, { radius: r, color: COL.ink, opacity: 0.35 });
      R(x, y, w, h, { radius: r, color: COL.ink, opacity: 0.55 });
      if (t > 0) {
        const barW = Math.max(h, w * t);
        R(x, y, barW, h, { radius: r, color: fill });
        R(x + 2.5, y + 1.5, Math.max(2, barW - 5), Math.max(1, h * 0.32), { radius: r, color: hi, opacity: 0.9 });
      }
      R(x, y, w, h, { radius: r, fill: false, outline: { width: 1.5, color: COL.ink } });
    }

    function keycap(lbl, cx, cy) {
      if (TOUCH_ON) return;
      const w = 12 + lbl.length * 7, h = 17;
      R(cx - w / 2, cy - h / 2 + 2, w, h, { radius: 4, color: COL.ink, opacity: 0.45 });
      R(cx - w / 2, cy - h / 2, w, h, { radius: 4, color: COL.cream, opacity: 0.95 });
      R(cx - w / 2, cy - h / 2, w, h, { radius: 4, fill: false, outline: { width: 1.5, color: COL.ink } });
      drawText({ text: lbl, pos: vec2(cx, cy + 0.5), anchor: 'center', size: 10, color: COL.ink });
    }

    function chev(x, y, on, col, pulse) {
      const pts = [vec2(x - 4, y - 6), vec2(x + 5, y), vec2(x - 4, y + 6)];
      if (on && pulse) drawCircle({ pos: vec2(x, y), radius: 9, color: col, opacity: 0.35 });
      drawPolygon({ pts, color: on ? col : COL.dim, opacity: on ? 1 : 0.45 });
      if (on) drawPolygon({ pts, fill: false, outline: { width: 1.2, color: COL.ink } });
    }

    function pip(x, y, on) {
      drawCircle({ pos: vec2(x, y), radius: 6, color: on ? COL.leaf : COL.ink, opacity: on ? 1 : 0.35 });
      drawCircle({ pos: vec2(x, y), radius: 6, fill: false, outline: { width: 1.5, color: COL.ink } });
    }

    function star(x, y, r, col) {
      for (let i = 0; i < 5; i++) {
        const a0 = -Math.PI / 2 + i * Math.PI * 2 / 5;
        const aL = a0 - Math.PI / 5, aR = a0 + Math.PI / 5, ri = r * 0.46;
        drawPolygon({
          pts: [vec2(x, y), vec2(x + Math.cos(aL) * ri, y + Math.sin(aL) * ri),
            vec2(x + Math.cos(a0) * r, y + Math.sin(a0) * r), vec2(x + Math.cos(aR) * ri, y + Math.sin(aR) * ri)],
          color: col,
        });
      }
    }

    const layer = add([pos(0, 0), fixed(), z(120)]);
    layer.onDraw(() => {
      const p = PLAYER; if (!p) return;
      const t = time();

      // =====================================================================
      // PANNEAU HAUT GAUCHE : coeurs · jauge soleil · objectifs
      // =====================================================================
      const PL_W = 288, PL_H = 106, PL_X = 8, PL_Y = 8;
      panel(PL_X, PL_Y, PL_W, PL_H);

      // Ligne 1 : coeurs + crane
      const R1Y = PL_Y + 30;
      const lowHp = p.hp === 1;
      for (let i = 0; i < p.maxHp; i++) {
        const full = i < p.hp;
        const panic = (full && lowHp) ? 1 + 0.10 * Math.sin(t * 9) : 1;
        const bob = full ? Math.sin(t * 4 + i * 0.6) * 1.2 : 0;
        icon('heart', PL_X + 18 + i * 30, R1Y + bob, 28 * panic, { frame: full ? 0 : 1, opacity: full ? 1 : 0.28 });
      }
      if (p.kills > 0) {
        const skx = PL_X + 18 + p.maxHp * 30 + 10;
        const fk = Math.min(1, (p.killFlash || 0) / 0.6);
        if (fk > 0) drawCircle({ pos: vec2(skx, R1Y), radius: 13 + fk * 8, color: COL.red, opacity: 0.28 * fk });
        icon('skull', skx, R1Y + Math.sin(t * 3) * 0.7, 24 * (1 + 0.28 * fk));
        inkT('x' + p.kills, skx + 16, R1Y, 15, COL.red);
      }

      // Ligne 2 : icone soleil + jauge pleine largeur
      const R2Y = PL_Y + 62;
      const absMax = C.sun.max || 1;
      const sf = Math.max(0, Math.min(1, p.sun / absMax));
      const sbx = PL_X + 36, sbw = PL_W - 50, sbh = 14, sby = R2Y - sbh / 2;
      const sunBarFw = Math.max(sbh, sbw * sf);
      const charging = p._sunCharging || p.sunFlash > 0;
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      if (charging) {
        const base = 0.26 + 0.24 * pulse + (p.sunFlash || 0) * 0.9;
        for (let g = 0; g < 2; g++) {
          const pad = 2.5 + g * 3.5 + (p.sunFlash || 0) * 8;
          R(sbx - pad, sby - pad, sunBarFw + pad * 2, sbh + pad * 2,
            { radius: (sbh + pad * 2) / 2, color: COL.goldHi, opacity: Math.max(0, base * (0.5 - g * 0.18)) });
        }
      }
      bar(sbx, sby, sbw, sbh, sf, COL.gold, COL.goldHi);
      if (charging) {
        R(sbx, sby, sunBarFw, sbh, { radius: sbh / 2, color: COL.goldHi, opacity: 0.25 + 0.35 * pulse });
        const sweep = (t * 0.8) % 1;
        const sweepX = sbx + sweep * sunBarFw, sweepW = 18;
        const sweepX0 = Math.max(sbx, sweepX - sweepW / 2), sweepX1 = Math.min(sbx + sunBarFw, sweepX + sweepW / 2);
        if (sweepX1 > sweepX0) R(sweepX0, sby + 1, sweepX1 - sweepX0, sbh - 2, { radius: (sbh - 2) / 2, color: COL.cream, opacity: 0.9 });
      }
      // v2 SURBOUCLIER : cran de SEUIL a hitAbsorb (au-dessus = un coup absorbe),
      //  jauge GRISEE pendant le lock "bouclier brise" (pas de regen passive),
      //  anneau dore autour de l'icone soleil quand le bouclier est ARME.
      const sunLocked = (p.sunRegenLockT || 0) > 0;
      if (sunLocked) R(sbx, sby, sunBarFw, sbh, { radius: sbh / 2, color: rgb(110, 104, 96), opacity: 0.62 });
      const thF = Math.max(0, Math.min(1, (C.sun.hitAbsorb || 0) / absMax));
      if (thF > 0 && thF < 1) {
        const thX = sbx + sbw * thF;
        R(thX - 1.5, sby - 3, 3, sbh + 6, { radius: 1.5, color: COL.cream, opacity: 0.85 });
      }
      const shieldOn = !sunLocked && (C.sun.hitAbsorb || 0) > 0 && p.sun >= C.sun.hitAbsorb;
      if (shieldOn) drawCircle({ pos: vec2(PL_X + 17, R2Y), radius: 16 + Math.sin(t * 5) * 1.2, fill: false, outline: { width: 2.5, color: COL.goldHi }, opacity: 0.8 });
      const sunPulse = p._sunCharging ? 1 + Math.sin(t * 6) * 0.14 : 1;
      icon('pickup_sunray', PL_X + 17, R2Y, 26 * sunPulse, { opacity: (p._sunShaded && !p._sunCharging) ? 0.5 : 1 });

      // Ligne 3 : objectifs data / pages / publi
      const R3Y = PL_Y + 92;
      const dataSkin = (LEVEL.theme.pickups && LEVEL.theme.pickups.data && hasSprite(LEVEL.theme.pickups.data)) ? LEVEL.theme.pickups.data : 'pickup_data';
      let cx2 = PL_X + 12;
      icon(dataSkin, cx2 + 11, R3Y, 22); inkT(p.data + '/' + LEVEL.dataTotal, cx2 + 25, R3Y, 14, COL.cream); cx2 += 76;
      icon('pickup_page', cx2 + 11, R3Y, 22); inkT(p.pages + '/' + LEVEL.pageTotal, cx2 + 25, R3Y, 14, COL.cream); cx2 += 76;
      if (LEVEL.hasPubli) {
        const got = p.gotPubli;
        icon('pickup_publi', cx2 + 11, R3Y + (got ? Math.sin(t * 5) * 1.2 : 0), 22, { opacity: got ? 1 : 0.38 });
        if (got) inkT('100%', cx2 + 26, R3Y, 14, COL.gold);
      }

      // =====================================================================
      // PANNEAU HAUT DROITE : timer (dixiemes de seconde) + score
      // =====================================================================
      const lt = p.levelTime || 0;
      const mmn = Math.floor(lt / 60), ssn = Math.floor(lt % 60), tn = Math.floor((lt % 1) * 10);
      const tstr = (mmn < 10 ? '0' : '') + mmn + ':' + (ssn < 10 ? '0' : '') + ssn;
      const PR_W = 170, PR_H = 72, PR_X = W - PR_W - 8, PR_Y = 8;
      panel(PR_X, PR_Y, PR_W, PR_H);

      // Horloge + temps principal
      const ckx = PR_X + 20, cky = PR_Y + 28;
      drawCircle({ pos: vec2(ckx, cky), radius: 11, color: COL.cream, opacity: 0.9 });
      drawCircle({ pos: vec2(ckx, cky), radius: 11, fill: false, outline: { width: 1.8, color: COL.ink } });
      const aS = lt / 60 * Math.PI * 2 - Math.PI / 2;
      const aM = lt / 3600 * Math.PI * 2 - Math.PI / 2;
      drawLine({ p1: vec2(ckx, cky), p2: vec2(ckx + Math.cos(aS) * 8, cky + Math.sin(aS) * 8), width: 2, color: COL.ink });
      drawLine({ p1: vec2(ckx, cky), p2: vec2(ckx + Math.cos(aM) * 5, cky + Math.sin(aM) * 5), width: 2, color: COL.ink });
      inkT(tstr, PR_X + 38, cky, 26, COL.cream);
      inkT('.' + tn, PR_X + PR_W - 8, PR_Y + 44, 16, COL.goldHi, 'right');

      // Score : etoile + nombre
      const scoreStr = '' + p.score;
      star(PR_X + 18, PR_Y + 58, 9, COL.ink);
      star(PR_X + 18, PR_Y + 58, 7, COL.gold);
      inkT(scoreStr, PR_X + 34, PR_Y + 58, 17, COL.cream);

      // =====================================================================
      // PANNEAU BAS CENTRE : armes · munitions (ancre en bas de l'ecran)
      // =====================================================================
      const WEP_H = 56, WEP_W = 650;
      const WEP_X = (W - WEP_W) / 2;
      const WEP_Y = H - WEP_H - 6;
      const WEP_ROW = WEP_Y + WEP_H / 2;
      panel(WEP_X, WEP_Y, WEP_W, WEP_H);

      let wx = WEP_X + 18;
      // Graine + ESPACE
      icon('ammo_graine', wx + 13, WEP_ROW, 28);
      wx += 28;
      keycap('ESPACE', wx + 30, WEP_ROW);
      wx += TOUCH_ON ? 16 : 64;
      drawLine({ p1: vec2(wx, WEP_Y + 9), p2: vec2(wx, WEP_Y + WEP_H - 9), width: 1, color: rgb(115, 78, 42) });
      wx += 16;
      // Patisserie + cout + X
      const PA = (C.arsenal && C.arsenal.patisseries) || {};
      const plv = Math.max(1, Math.min((PA.levels && PA.levels.length) || 1, p.power || 1));
      const PL = (PA.levels && PA.levels[plv - 1]) || { sprite: 'ammo_gateau', cost: 0 };
      const poor = C.sun.enabled && p.sun < (PL.cost || 0);
      icon(hasSprite(PL.sprite) ? PL.sprite : 'ammo_gateau', wx + 16, WEP_ROW, 30, { opacity: poor ? 0.55 : 1 });
      wx += 34;
      const costStr = '-' + (PL.cost || 0);
      inkT(costStr, wx, WEP_ROW, 14, poor ? COL.red : COL.gold);
      wx += costStr.length * 9 + 4;
      icon('pickup_sunray', wx + 7, WEP_ROW, 15);
      wx += 18;
      keycap('X', wx + 9, WEP_ROW);
      wx += TOUCH_ON ? 12 : 24;
      drawLine({ p1: vec2(wx, WEP_Y + 9), p2: vec2(wx, WEP_Y + WEP_H - 9), width: 1, color: rgb(210, 155, 72) });
      wx += 16;
      // Upgrades puissance + cadence
      const pmax = (C.arsenal && C.arsenal.power && C.arsenal.power.max) || 3;
      const rmax = (C.arsenal && C.arsenal.rate && C.arsenal.rate.max) || 3;
      icon('pickup_puissance', wx + 11, WEP_ROW, 22);
      wx += 25;
      for (let i = 0; i < pmax; i++) chev(wx + i * 15, WEP_ROW, i < (p.power || 1), COL.red, (p.powerFlash || 0) > 0);
      wx += pmax * 15 + 16;
      icon('pickup_cadence', wx + 11, WEP_ROW, 22);
      wx += 25;
      for (let i = 0; i < rmax; i++) chev(wx + i * 15, WEP_ROW, i < (p.rate || 1), rgb(96, 196, 244), (p.rateFlash || 0) > 0);
      wx += rmax * 15 + 12;
      drawLine({ p1: vec2(wx, WEP_Y + 9), p2: vec2(wx, WEP_Y + WEP_H - 9), width: 1, color: rgb(210, 155, 72) });
      wx += 16;
      // Chat + charges + SAUVES
      icon('cat_run', wx + 20, WEP_ROW, 32);
      wx += 48;
      for (let i = 0; i < C.cat.maxCharges; i++) pip(wx + i * 16, WEP_ROW, i < p.catCharges);
      if ((C.cat.regenTime || 0) > 0 && p.catCharges < C.cat.maxCharges) {
        const frac = Math.min(1, (p.catRegenT || 0) / C.cat.regenTime);
        drawCircle({ pos: vec2(wx + p.catCharges * 16, WEP_ROW), radius: 1 + 5 * frac, color: COL.leaf, opacity: 0.9 });
      }
      wx += C.cat.maxCharges * 16 + 8;
      keycap('C', wx + 9, WEP_ROW);
      wx += TOUCH_ON ? 12 : 24;
      const savedN = p.saved || 0;
      if ((p.saveFlash || 0) > 0) drawCircle({ pos: vec2(wx + 40, WEP_ROW), radius: 13, color: COL.leaf, opacity: 0.38 });
      inkT('SAUVES ' + savedN, wx, WEP_ROW, 14, savedN > 0 ? COL.leaf : COL.dim);

      // =====================================================================
      // BOSS : fin ruban haut-centre, entre les deux panneaux.
      //  v2 : barre PRINCIPALE = le boss du niveau (jamais un invite) ; elle
      //  PULSE en dore pendant une fenetre de vulnerabilite ("tape maintenant").
      //  Boss INVITE (boss-rush du jury) : mini-barre dessous.
      // =====================================================================
      let boss = null, anyBoss = null, guest = null;
      for (let i = 0; i < BOSS_LIST.length; i++) {
        const bb = BOSS_LIST[i];
        if (!bb.exists()) continue;
        if (!anyBoss) anyBoss = bb;
        if (!boss && !bb.guest) boss = bb;
      }
      if (!boss) boss = anyBoss;
      for (let i = 0; i < BOSS_LIST.length; i++) {
        const bb = BOSS_LIST[i];
        if (bb.exists() && bb.guest && bb !== boss) { guest = bb; break; }
      }
      if (boss && (boss.hp < boss.maxHp || Math.abs(boss.pos.x - p.pos.x) < W * 0.62)) {
        const open = (boss.vulnT > 0) || (boss.guard != null && boss.guard >= 1);
        if (open) {
          const pw = 0.5 + 0.5 * Math.sin(t * 8);
          R(W / 2 - 149, 32, 298, 17, { radius: 8, color: COL.goldHi, opacity: 0.22 + 0.3 * pw });
        }
        inkT(boss.def.name || 'BOSS', W / 2, 24, 14, open ? COL.gold : COL.rose, 'center');
        bar(W / 2 - 145, 36, 290, 9, Math.max(0, boss.hp) / boss.maxHp, COL.red, COL.rose);
        if (guest && guest.exists()) {
          inkT(guest.def.name || 'INVITE', W / 2, 54, 11, COL.cream, 'center');
          bar(W / 2 - 95, 63, 190, 6, Math.max(0, guest.hp) / guest.maxHp, COL.red, COL.rose);
        }
      }
    });

    return layer;
  }

  // ---------------------------------------------------------------------
  //  FIN DE NIVEAU / SAUVEGARDE
  // ---------------------------------------------------------------------
  function persist() { if (SAVE) SAVEAPI.save(SLOT, SAVE); }

  // v2 : MENTION TRES HONORABLE = or partout (t/d/s) sur les 5 niveaux + jury battu.
  function hasMention(d) {
    if (!d || !d.juryDone || !d.medals) return false;
    for (let i = 0; i < SAVEAPI.N_LEVELS; i++) {
      const m = d.medals[i];
      if (!m || m.t < 3 || m.d < 3 || m.s < 3) return false;
    }
    return true;
  }

  function completeLevel() {
    const p = PLAYER;
    const total = LEVEL.dataTotal + LEVEL.pageTotal;
    const got = p.data + p.pages;
    const pct = total > 0 ? Math.round(got / total * 100) : 100;
    const tsec = p.levelTime || 0;               // chrono du niveau (time-attack)
    // --- v2 MEDAILLES (GAMEPLAY.md §5.1) : TEMPS (pars du niveau) / DATA / SAUVES.
    //  Paliers : 3=or, 2=argent, 1=bronze, 0=rien. SAUVES = sauves/spawnes (un
    //  passant tue n'est plus sauvable -> le pacifisme paie) ; niveau sans
    //  passant => 100 (pas de medaille impossible).
    const lvDef = LEVELS[C.levels[CUR_IDX]] || {};
    const par = lvDef.par || null;
    const medT = (par && tsec > 0) ? (tsec <= par.or ? 3 : (tsec <= par.argent ? 2 : (tsec <= par.bronze ? 1 : 0))) : 0;
    const medD = pct >= 100 ? 3 : (pct >= 80 ? 2 : (pct >= 60 ? 1 : 0));
    const passTot = LEVEL.passantTotal || 0;
    const savedPct = passTot > 0 ? Math.round((p.saved || 0) / passTot * 100) : 100;
    const medS = savedPct >= 100 ? 3 : (savedPct >= 60 ? 2 : (savedPct >= 30 ? 1 : 0));
    const meds = { t: medT, d: medD, s: medS };
    if (SAVE) {
      SAVE.totalScore += p.score;
      SAVE.bestScore = Math.max(SAVE.bestScore, p.score);
      if (!SAVE.medals) SAVE.medals = [];
      if (CUR_IDX < SAVEAPI.N_LEVELS) {
        SAVE.levelsDone[CUR_IDX] = true;
        if (p.gotPubli) SAVE.publis[CUR_IDX] = true;
        SAVE.dataPct[CUR_IDX] = Math.max(SAVE.dataPct[CUR_IDX] || 0, pct);
        if (tsec > 0) {                           // MEILLEUR TEMPS : garde le plus court. tsec>0 ignore une
          if (!SAVE.bestTime) SAVE.bestTime = [];  //  fin INSTANTANEE (triche '0') qui sinon ecraserait un vrai temps via Math.min(.,0).
          const prev = SAVE.bestTime[CUR_IDX] || 0;
          SAVE.bestTime[CUR_IDX] = (prev > 0) ? Math.min(prev, tsec) : tsec;
        }
        // medailles : on garde le MEILLEUR palier atteint par categorie
        const pm = SAVE.medals[CUR_IDX] || { t: 0, d: 0, s: 0 };
        SAVE.medals[CUR_IDX] = { t: Math.max(pm.t || 0, medT), d: Math.max(pm.d || 0, medD), s: Math.max(pm.s || 0, medS) };
        if (!SAVE.savedPct) SAVE.savedPct = [];
        SAVE.savedPct[CUR_IDX] = Math.max(SAVE.savedPct[CUR_IDX] || 0, savedPct);
        if (p.medNoHit && tsec > 0) {              // medaille cachee "sans degat" (pas via triche '0')
          if (!SAVE.feli) SAVE.feli = [];
          SAVE.feli[CUR_IDX] = true;
        }
        SAVE.unlockedMax = Math.max(SAVE.unlockedMax, CUR_IDX + 1);
        SAVE.cursor = Math.min(C.levels.length - 1, CUR_IDX + 1);
      } else {
        SAVE.juryDone = true;
        // jury : medaille TEMPS seulement (pas de data/sauves — que des invoques)
        const pj = SAVE.medals[SAVEAPI.N_LEVELS] || { t: 0 };
        SAVE.medals[SAVEAPI.N_LEVELS] = { t: Math.max(pj.t || 0, medT) };
      }
      persist();
    }
    sfx('win');
    if (CUR_IDX >= SAVEAPI.N_LEVELS) go('win', { score: p.score });
    else go('chapter', { idx: CUR_IDX, score: p.score, meds, tsec, pct, savedPct, par, feli: !!(p.medNoHit && tsec > 0) });
  }

  // Arme par scene('game') : ouvre le popup de mort (recommencer niveau / boss).
  //  Defini DANS la scene (acces a setPaused + respawnAtArena in-scene) ; null
  //  hors de la scene game -> deathSequence retombe sur un simple redemarrage.
  let openDeathBox = null;

  function loseGame() {
    if (PLAYER && PLAYER._dying) return;     // sequence de mort deja en cours
    // v2 CHECKPOINT BOSS (GAMEPLAY.md §2.4) : mourir PENDANT le boss -> respawn
    //  IN-SCENE a la porte d'arene (pas de re-traversee du niveau, pas de rebuild
    //  -> pas de re-farm de pickups), boss reset, chrono qui CONTINUE (la penalite
    //  time-attack est naturelle). Mourir hors boss : sequence de mort in-scene.
    //  DESACTIVABLE en bloc (tous niveaux) via CONFIG.bossCheckpoint.
    if (C.bossCheckpoint && LEVEL && LEVEL.checkpoint && LEVEL.bossesAlive > 0 && PLAYER && PLAYER.exists()) {
      respawnAtArena();
      return;
    }
    deathSequence();
  }

  // MORT (v3) : plus d'ecran 'lose' ni de detour par la carte — Laura s'affale
  //  en CADAVRE sur place (sprite dedie hero_dead s'il est embarque, sinon le
  //  repli corpsify : bascule au sol, pivot = pieds), message dedie + flash
  //  rouge KO, puis le NIVEAU REDEMARRE tout seul (scene 'game' relancee ->
  //  run propre, score/chrono remis a zero ; meme piste musicale = la musique
  //  ne coupe pas, playMusic est no-op). Le joueur n'est PAS detruit (les
  //  onUpdate de scene le referencent) : cache + pause (un objet pause sort de
  //  la grille de collision -> plus aucun degat possible) ; le cadavre est un
  //  objet a part pose au SOL (la mort peut arriver en l'air). Mort par CHUTE
  //  sous le niveau : pas de cadavre visible, message seul. La scene 'lose'
  //  reste definie mais n'est plus atteinte depuis le jeu.
  function deathSequence() {
    const p = PLAYER;
    if (!p || !p.exists()) return;
    p._dying = true;
    p.invuln = 9999;
    sfx('lose');
    const fell = p.pos.y > LEVEL.height + 100;          // tombee dans un trou
    if (!fell) {
      // surfaceUnderFeet (PAS surfaceTopAt) : le cadavre se pose sur le sol SOUS
      //  Laura, jamais sur un deck de panneaux au-dessus. CORPSE_SINK : on
      //  l'enfonce un poil dans le sol (sprite couche) pour qu'il y repose.
      const CORPSE_SINK = 12;
      const gy = surfaceUnderFeet(p.pos.x, p.pos.y);
      const c = add([
        sprite(hasSprite('hero_dead') ? 'hero_dead' : 'hero_hurt'),
        artScale(), pos(p.pos.x, (gy != null ? gy : p.pos.y) + CORPSE_SINK),
        anchor('bot'), z(-0.6), 'corpse',
      ]);
      if (hasSprite('hero_dead')) playIfAnim(c, 'hero_dead');
      else c.angle = (p.facing >= 0 ? 90 : -90);        // repli : bascule au sol
    }
    p.hidden = true; p.paused = true;
    add([rect(C.width, C.height), pos(0, 0), fixed(), color(200, 30, 30),
      opacity(0.45), z(190), lifespan(0.6, { fade: 0.5 })]);
    safeShake(12);
    add([
      text(C.story.dead, { size: 34, align: 'center' }), pos(C.width / 2, C.height / 2 - 36),
      anchor('center'), fixed(), z(951), color(255, 255, 255), opacity(1),
      lifespan(1.6, { fade: 0.5 }),
    ]);
    // v3 : plus de redemarrage AUTO -> on ouvre un popup (recommencer niveau /
    //  reprendre au boss). Hors scene game (openDeathBox null) : repli redemarrage.
    wait(1.2, () => { if (openDeathBox) openDeathBox(); else go('game', C.levels[CUR_IDX]); });
  }

  function respawnAtArena() {
    const p = PLAYER, ck = LEVEL.checkpoint;
    p.hp = p.maxHp;
    p.sun = Math.min(p.sunMax, Math.max(p.sun, 50));
    p.sunRegenLockT = 0;
    p.pos.x = ck.x; p.pos.y = ck.y;
    p.invuln = 1.2; p.knockT = 0; p.dashT = 0; p._dropT = 0;
    if (p.vel) p.vel = vec2(0, 0);
    p.medNoHit = false;                          // la medaille "sans degat" est perdue de toute facon
    get('boss').forEach((b) => {
      if (b.guest) { destroy(b); return; }       // les invites du jury disparaissent
      b.hp = b.maxHp;
      b.pos.x = b.homeX;
      // machine d'etats vierge : chaque IA se re-initialise sur champ undefined
      b.cs = b.ts = b.ms = b.state = b.ps = b.jPhase = undefined;
      b.t = 0; b.stun = 0; b.hurtT = 0; b.knockT = 0;
      b.vulnT = 0; b.catVulnLock = 0; b.openT = 0; b.p2 = false; b.p2Just = false;
      b._guest = null; b._chCd = null; b._guardMsgDone = false;
      if (b._baseScale) { b.scale = b._baseScale.clone(); }   // cendrine morte mi-implosion
      b.opacity = 1; b.animWant = 'idle';
      // NB : unuse('color') est sur meme depuis un onCollide — la regle "jamais
      //  d'unuse en plein onCollide" ne vise que area/body (parcours de collision).
      if (b._openVis) { b._openVis = false; try { b.unuse('color'); } catch (_) {} }
    });
    get('ehot').forEach((h) => destroy(h));
    get('quakewave').forEach((q) => destroy(q));
    get('fx').forEach((o) => { if (o.boom !== undefined) destroy(o); });   // bombes encore EN VOL (pas de pluie sur le checkpoint)
    openArenaGates();   // Laura respawne DEHORS : le verrou se re-arme a la re-entree
    // KO LISIBLE : sans feedback fort, mourir au contact du boss se lisait comme
    //  un BUG ("ejectee + vie pleine d'un coup") — la teleport + le refill
    //  passaient pour un glitch. Jingle de defaite + flash rouge plein ecran +
    //  message en gros : on COMPREND qu'on est morte et qu'on reprend a l'arene.
    add([rect(C.width, C.height), pos(0, 0), fixed(), color(200, 30, 30),
      opacity(0.45), z(190), lifespan(0.55, { fade: 0.45 })]);
    safeShake(12);
    flashMsg(C.story.checkpoint, 30);
    sfx('lose');
  }

  function tryReachSun() {
    if (LEVEL.bossesAlive > 0) { flashMsg(C.story.bossWarn); return; }
    completeLevel();
  }

  let _msg = null;
  function flashMsg(txt, size) {
    if (!txt) return;
    if (_msg && _msg.exists()) destroy(_msg);
    _msg = add([
      text(txt, { size: size || 22, align: 'center' }), pos(C.width / 2, 90), anchor('center'),
      fixed(), z(950), color(255, 255, 255), opacity(1), lifespan(1.6, { fade: 0.6 }),
    ]);
    // Les toggles S/M marchent PENDANT la pause (listener DOM) mais lifespan
    //  est gele par getTreeRoot().paused -> le toast restait fige a l'ecran.
    //  Le draw, lui, continue : on double le fondu a l'horloge REELLE via
    //  onDraw (hidden apres expiration ; lifespan detruit l'objet a la
    //  reprise). z(950) : au-dessus de la boite pause (z 900).
    const m = _msg;
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    m.onDraw(() => {
      const el = (((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0) / 1000;
      if (el > 2.2) m.hidden = true;
      else if (el > 1.6) m.opacity = Math.min(m.opacity, 1 - (el - 1.6) / 0.6);
    });
  }

  // ---------------------------------------------------------------------
  //  SCENE PRINCIPALE (game)
  // ---------------------------------------------------------------------
  scene('game', (levelKey) => {
    CUR_IDX = C.levels.indexOf(levelKey);
    const def = LEVELS[levelKey];
    playMusic((def && def.music) || levelKey);   // piste du niveau (niveau1.mid... ou override LEVELS[x].music)
    buildLevel(def);
    if (!PLAYER) { add([text('Pas de @ dans la map !', { size: 24 }), pos(40, 40)]); return; }
    spawnStartVehicle();
    npcBubbleLoop(levelKey);   // bulles BD des PNJ (rares, cf. theme.passant.bubble)

    buildHUD();
    // Cadrage Y : par DEFAUT epingle en bas (LEVEL.baseCamY, calcule dans buildLevel)
    //  -> un niveau plus HAUT que l'ecran garde le meme cadrage du sol, le surplus
    //  devient du hors-champ en haut. Une ZONE-CIEL ('|') laisse la cam SUIVRE Laura
    //  vers le haut (revele le niveau cache), cf. la boucle d'update (setCam).

    // --- ESC : confirmation avant d'abandonner le niveau (gele le jeu) -----
    //  getTreeRoot().paused gele update + physique (le draw, lui, continue) ; les
    //  actions clavier de jeu passent par onPlayKey/onPlayPress et sont ignorees
    //  tant que la pause est active. ESC ouvre/ferme, ESPACE/ENTREE confirment.
    let paused = false, quitBox = null;
    const setPaused = (v) => { paused = v; getTreeRoot().paused = v; };
    const onPlayKey = (arr, cb) => onKeys(arr, (...a) => { if (!paused) cb(...a); });
    const onPlayPress = (k, cb) => onKeyPress(k, (...a) => { if (!paused) cb(...a); });
    //  Ecran de pause facon "carnet de terrain ensoleille" : parchemin a cadre
    //  dore pose sur une gerbe de rayons (theme agrivoltaique), ruban PAUSE, titre
    //  en typo native a contour, deux options keycap. Anime a l'horloge REELLE
    //  (performance.now) car time()/dt() sont geles pendant la pause.
    const nowMs = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const openQuit = () => {
      if (quitBox) return;
      setPaused(true);
      const t0 = nowMs();
      quitBox = add([pos(0, 0), fixed(), z(900)]);
      quitBox.onDraw(() => {
        const W = C.width, H = C.height, cx = W / 2, cy = H / 2;
        const T = Math.max(0, (nowMs() - t0) / 1000);
        const e = Math.min(1, T / 0.26), ap = 1 - Math.pow(1 - e, 3);   // easeOutCubic -> apparition
        const scl = 0.9 + 0.1 * ap, rise = (1 - ap) * 16;

        // palette du jeu (or / creme / encre / terracotta / feuille)
        const GOLD = rgb(255, 206, 71), GOLDHI = rgb(255, 233, 150), CREAM = rgb(252, 245, 224),
          CREAMLO = rgb(241, 226, 192), INK = rgb(58, 36, 22), INKSOFT = rgb(124, 90, 54),
          RED = rgb(226, 74, 60), REDDK = rgb(150, 40, 30), GREEN = rgb(112, 178, 64),
          GREENDK = rgb(56, 110, 36), BROWN = rgb(92, 62, 36);
        // texte a contour 8-directions (la typo des ecrans titre/carte)
        const ink = (s, x, y, sz, fill, op) => {
          for (let a = 0; a < 8; a++) drawText({ text: s, pos: vec2(x + Math.cos(a * Math.PI / 4) * 2, y + Math.sin(a * Math.PI / 4) * 2), anchor: 'center', size: sz, color: INK, opacity: op == null ? 1 : op });
          drawText({ text: s, pos: vec2(x, y), anchor: 'center', size: sz, color: fill, opacity: op == null ? 1 : op });
        };

        const bw = 520, bh = 290, top = cy - bh / 2, L = cx - bw / 2;
        const sunY = top;                                            // foyer du soleil (derriere le ruban)

        // 1) FOND : illustration plein ecran (ui_popup_bg) si embarquee, sinon voile chaud
        if (hasSprite('ui_popup_bg')) {
          drawSprite({ sprite: 'ui_popup_bg', pos: vec2(0, 0), width: W, height: H, opacity: ap });
          drawRect({ pos: vec2(0, 0), width: W, height: H, color: rgb(24, 15, 9), opacity: 0.26 * ap });
        } else {
          drawRect({ pos: vec2(0, 0), width: W, height: H, color: rgb(24, 15, 9), opacity: 0.54 * ap });
        }

        // 2) atmosphere : halo radial + gerbe de rayons tournant lentement
        for (let i = 8; i >= 1; i--)
          drawCircle({ pos: vec2(cx, sunY + 28), radius: i * 44 * (1 + Math.sin(T * 1.4) * 0.03), color: rgb(255, 196, 96), opacity: 0.05 * ap });
        const rot = T * 0.22;
        for (let i = 0; i < 12; i++) {
          const a = rot + i * Math.PI / 6, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx, r0 = 24, r1 = 262, wd = 9;
          drawTriangle({
            p1: vec2(cx + dx * r1, sunY + dy * r1),
            p2: vec2(cx + dx * r0 + px * wd, sunY + dy * r0 + py * wd),
            p3: vec2(cx + dx * r0 - px * wd, sunY + dy * r0 - py * wd),
            color: rgb(255, 214, 108), opacity: 0.09 * ap,
          });
        }

        // 3) la carte parchemin (groupe anime : montee + zoom d'apparition)
        pushTransform(); pushTranslate(cx, cy + rise); pushScale(scl, scl); pushTranslate(-cx, -cy);

        drawRect({ pos: vec2(L + 5, top + 9), width: bw, height: bh, radius: 20, color: rgb(18, 11, 6), opacity: 0.34 });    // ombre portee
        drawRect({ pos: vec2(L, top), width: bw, height: bh, radius: 18, color: CREAMLO });                                  // fond parchemin
        drawRect({ pos: vec2(L, top), width: bw, height: bh * 0.55, radius: 18, color: CREAM });                             // degrade haut
        drawRect({ pos: vec2(L + 8, top + 7), width: bw - 16, height: 3, radius: 2, color: rgb(255, 255, 255), opacity: 0.55 }); // brillance
        drawRect({ pos: vec2(L, top), width: bw, height: bh, radius: 18, fill: false, outline: { width: 4.5, color: GOLD } });   // cadre dore
        drawRect({ pos: vec2(L + 6, top + 6), width: bw - 12, height: bh - 12, radius: 13, fill: false, outline: { width: 1.5, color: INKSOFT }, opacity: 0.5 }); // liseré interne
        [[L + 18, top + 18], [L + bw - 18, top + 18], [L + 18, top + bh - 18], [L + bw - 18, top + bh - 18]].forEach((c) => {     // rivets dores
          drawCircle({ pos: vec2(c[0], c[1]), radius: 5, color: GOLD });
          drawCircle({ pos: vec2(c[0], c[1]), radius: 5, fill: false, outline: { width: 1.5, color: INK } });
        });

        // 4) ruban "PAUSE" a cheval sur le bord haut + soleil au sommet
        const rbw = 186, rbh = 44, rt = top - rbh / 2;
        drawRect({ pos: vec2(cx - rbw / 2 + 3, rt + 4), width: rbw, height: rbh, radius: rbh / 2, color: rgb(18, 11, 6), opacity: 0.3 });
        drawRect({ pos: vec2(cx - rbw / 2, rt), width: rbw, height: rbh, radius: rbh / 2, color: RED });
        drawRect({ pos: vec2(cx - rbw / 2, rt), width: rbw, height: rbh, radius: rbh / 2, fill: false, outline: { width: 3, color: REDDK } });
        drawRect({ pos: vec2(cx - rbw / 2 + 8, rt + 5), width: rbw - 16, height: 6, radius: 3, color: rgb(255, 255, 255), opacity: 0.18 });
        const eY = rt - 9;                                           // soleil-embleme cresting au-dessus du ruban
        for (let i = 0; i < 8; i++) { const a = -rot * 1.3 + i * Math.PI / 4; drawTriangle({ p1: vec2(cx + Math.cos(a) * 27, eY + Math.sin(a) * 27), p2: vec2(cx + Math.cos(a + 0.16) * 15, eY + Math.sin(a + 0.16) * 15), p3: vec2(cx + Math.cos(a - 0.16) * 15, eY + Math.sin(a - 0.16) * 15), color: GOLD }); }
        drawCircle({ pos: vec2(cx, eY), radius: 13, color: GOLDHI });
        drawCircle({ pos: vec2(cx, eY), radius: 13, fill: false, outline: { width: 2.5, color: rgb(196, 120, 30) } });
        drawCircle({ pos: vec2(cx - 4, eY - 4), radius: 4, color: rgb(255, 255, 255), opacity: 0.5 });
        ink('PAUSE', cx, top + 1, 22, CREAM, 1);

        // 5) titre (typo native a contour) + ombre douce
        ink('Quitter le niveau ?', cx, cy - 83, 30, GOLD, 1);

        // 6) jalon decoratif (motif carte) entre titre et sous-titre
        drawRect({ pos: vec2(cx - 84, cy - 58), width: 168, height: 2, radius: 1, color: INKSOFT, opacity: 0.4 });
        drawTriangle({ p1: vec2(cx, cy - 64), p2: vec2(cx - 6, cy - 57), p3: vec2(cx + 6, cy - 57), color: GOLD });
        drawTriangle({ p1: vec2(cx, cy - 50), p2: vec2(cx - 6, cy - 57), p3: vec2(cx + 6, cy - 57), color: GOLD });
        drawCircle({ pos: vec2(cx, cy - 57), radius: 1.6, color: REDDK });

        // 7) avertissement
        drawText({ text: 'Ta progression dans ce niveau sera perdue.', pos: vec2(cx, cy - 30), anchor: 'center', size: 15, color: BROWN });

        // 8) deux options : keycap colore + label, la "sure" (continuer) pulse doucement
        const opt = (y, cap, capCol, capDk, label, glow) => {
          const ow = 432, oh = 48, ox = cx - ow / 2;
          if (glow) drawRect({ pos: vec2(ox - 5, y - oh / 2 - 5), width: ow + 10, height: oh + 10, radius: 16, color: GREEN, opacity: 0.16 + 0.16 * (0.5 + 0.5 * Math.sin(T * 4)) });
          drawRect({ pos: vec2(ox + 3, y - oh / 2 + 4), width: ow, height: oh, radius: 13, color: rgb(18, 11, 6), opacity: 0.16 });
          drawRect({ pos: vec2(ox, y - oh / 2), width: ow, height: oh, radius: 13, color: CREAM });
          drawRect({ pos: vec2(ox, y - oh / 2), width: ow, height: oh, radius: 13, fill: false, outline: { width: 2.5, color: INKSOFT } });
          const kw = 104, kh = 32, kx = ox + 12, ky = y - kh / 2;    // keycap (style HUD, en relief)
          drawRect({ pos: vec2(kx, ky + 3), width: kw, height: kh, radius: 8, color: capDk });
          drawRect({ pos: vec2(kx, ky), width: kw, height: kh, radius: 8, color: capCol });
          drawRect({ pos: vec2(kx + 4, ky + 3), width: kw - 8, height: 7, radius: 4, color: rgb(255, 255, 255), opacity: 0.32 });
          drawText({ text: cap, pos: vec2(kx + kw / 2, ky + kh / 2), anchor: 'center', size: 15, color: rgb(255, 248, 232) });
          drawText({ text: label, pos: vec2(kx + kw + 18, y), anchor: 'left', size: 18, color: INK });
        };
        opt(cy + 24, TOUCH_ON ? 'OUI' : 'ESPACE', RED, REDDK, 'Oui, retour a la carte', false);
        opt(cy + 82, TOUCH_ON ? 'NON' : 'ESC', GREEN, GREENDK, 'Non, je continue', true);
        if (TOUCH_ON) drawText({ text: '(tape une option)', pos: vec2(cx, cy + 122), anchor: 'center', size: 13, color: BROWN, opacity: 0.85 });

        popTransform();
      });
    };
    const closeQuit = () => { if (quitBox) { destroy(quitBox); quitBox = null; } setPaused(false); };
    const confirmQuit = () => { if (!quitBox) return; setPaused(false); go('overworld'); };

    // --- MORT : popup "recommencer" (niveau / reprendre au boss) -----------
    //  Affiche par deathSequence (apres le cadavre + KO). Deux choix :
    //   0 = RECOMMENCER LE NIVEAU  -> scene rebuild (arsenal/equipement RESET).
    //   1 = REPRENDRE AU BOSS      -> checkpoint arme JUSTE devant l'arene +
    //       respawnAtArena IN-SCENE (arsenal CONSERVE, pas de re-traversee).
    //  Gele le jeu via setPaused (neutralise onPlayKey/onPlayPress + la boucle
    //  d'update). Selection ◀▶, validation ESPACE/ENTREE/saut/OK ou tap direct.
    let deathBox = null, deathSel = 0;
    const bossRetryOK = () => !!(LEVEL && LEVEL.bossX != null && LEVEL.bossesAlive > 0);
    const closeDeath = () => { if (deathBox) { destroy(deathBox); deathBox = null; } setPaused(false); };
    const restartLevel = () => { closeDeath(); go('game', C.levels[CUR_IDX]); };
    const restartBoss = () => {
      // checkpoint JUSTE DEVANT le boss (meme calcul que la pose auto d'arene)
      if (!LEVEL.checkpoint && LEVEL.bossX != null) {
        const edge = LEVEL.bossX - (LEVEL.bossRange || 300) - TS * 2;
        LEVEL.checkpoint = { x: Math.max(TS * 1.5, edge - TS), y: columnGroundY(Math.floor(edge / TS)) - 2 };
      }
      get('corpse').forEach((o) => destroy(o));      // on relance Laura sur place
      const p = PLAYER;
      if (p) { p.hidden = false; p.paused = false; p._dying = false; }
      closeDeath();
      respawnAtArena();                              // refill HP/soleil + teleport arene + boss reset + KO rouge
      // RESTAURE le loadout d'AVANT-BOSS (snapshot a l'entree d'arene) : on garde
      //  exactement les armes/equipement qu'on avait en arrivant (pas l'etat a la
      //  mort, pas un max). cf. addArenaGates.
      const lo = LEVEL.bossLoadout;
      if (p && lo) {
        p.power = lo.power; p.rate = lo.rate; p.equipped = lo.equipped;
        p.catCharges = lo.catCharges; p.sunMax = lo.sunMax; p.ammoKey = lo.ammoKey;
        p.sun = Math.min(p.sunMax, p.sun);
      }
    };
    const deathConfirm = () => {
      if (!deathBox) return;
      if (deathSel === 1 && bossRetryOK()) restartBoss();
      else restartLevel();
    };
    const deathSelMove = (d) => {
      if (!deathBox || !bossRetryOK()) return;       // 1 seule option dispo -> rien a deplacer
      deathSel = Math.max(0, Math.min(1, deathSel + d));
    };
    openDeathBox = () => {
      if (deathBox) return;
      // defaut : REPRENDRE AU BOSS si Laura est morte DANS la zone du boss
      //  (gates d'arene posees, ou x dans l'arene) -> sinon RECOMMENCER LE NIVEAU.
      const arenaEdge = (LEVEL.bossX != null) ? (LEVEL.bossX - (LEVEL.bossRange || 300) - TS * 2) : Infinity;
      const atBoss = bossRetryOK() && (LEVEL.gates || (PLAYER && PLAYER.exists() && PLAYER.pos.x >= arenaEdge));
      deathSel = atBoss ? 1 : 0;
      setPaused(true);
      const t0 = nowMs();
      deathBox = add([pos(0, 0), fixed(), z(900)]);
      deathBox.onDraw(() => {
        const W = C.width, H = C.height, cx = W / 2, cy = H / 2;
        const T = Math.max(0, (nowMs() - t0) / 1000);
        const e = Math.min(1, T / 0.26), ap = 1 - Math.pow(1 - e, 3);
        const scl = 0.9 + 0.1 * ap, rise = (1 - ap) * 16;
        const GOLD = rgb(255, 206, 71), GOLDHI = rgb(255, 233, 150), CREAM = rgb(252, 245, 224),
          CREAMLO = rgb(241, 226, 192), INK = rgb(58, 36, 22), INKSOFT = rgb(124, 90, 54),
          RED = rgb(226, 74, 60), REDDK = rgb(150, 40, 30), GREEN = rgb(112, 178, 64),
          GREENDK = rgb(56, 110, 36), BROWN = rgb(92, 62, 36);
        const ink = (s, x, y, sz, fill, op) => {
          for (let a = 0; a < 8; a++) drawText({ text: s, pos: vec2(x + Math.cos(a * Math.PI / 4) * 2, y + Math.sin(a * Math.PI / 4) * 2), anchor: 'center', size: sz, color: INK, opacity: op == null ? 1 : op });
          drawText({ text: s, pos: vec2(x, y), anchor: 'center', size: sz, color: fill, opacity: op == null ? 1 : op });
        };
        const bw = 560, bh = 250, top = cy - bh / 2, L = cx - bw / 2;

        // FOND : illustration plein ecran (ui_popup_bg) si embarquee, sinon voile.
        if (hasSprite('ui_popup_bg')) {
          drawSprite({ sprite: 'ui_popup_bg', pos: vec2(0, 0), width: W, height: H, opacity: ap });
          drawRect({ pos: vec2(0, 0), width: W, height: H, color: rgb(24, 9, 7), opacity: 0.28 * ap });
        } else {
          drawRect({ pos: vec2(0, 0), width: W, height: H, color: rgb(24, 9, 7), opacity: 0.6 * ap });
        }

        pushTransform(); pushTranslate(cx, cy + rise); pushScale(scl, scl); pushTranslate(-cx, -cy);
        drawRect({ pos: vec2(L + 5, top + 9), width: bw, height: bh, radius: 20, color: rgb(18, 11, 6), opacity: 0.34 });
        drawRect({ pos: vec2(L, top), width: bw, height: bh, radius: 18, color: CREAMLO });
        drawRect({ pos: vec2(L, top), width: bw, height: bh * 0.55, radius: 18, color: CREAM });
        drawRect({ pos: vec2(L, top), width: bw, height: bh, radius: 18, fill: false, outline: { width: 4.5, color: GOLD } });

        // ruban KO + soleil
        const rbw = 168, rbh = 44, rt = top - rbh / 2;
        drawRect({ pos: vec2(cx - rbw / 2 + 3, rt + 4), width: rbw, height: rbh, radius: rbh / 2, color: rgb(18, 11, 6), opacity: 0.3 });
        drawRect({ pos: vec2(cx - rbw / 2, rt), width: rbw, height: rbh, radius: rbh / 2, color: RED });
        drawRect({ pos: vec2(cx - rbw / 2, rt), width: rbw, height: rbh, radius: rbh / 2, fill: false, outline: { width: 3, color: REDDK } });
        ink('K.O. !', cx, top + 1, 22, CREAM, 1);

        ink('On recommence ?', cx, top + 54, 26, GOLD, 1);

        // deux cartes cote a cote (◀ niveau | boss ▶) ; la selectionnee pulse en vert
        const opts = bossRetryOK()
          ? [{ cap: 'NIVEAU', sub: 'Tout le niveau' }, { cap: 'BOSS', sub: 'Juste le boss' }]
          : [{ cap: 'NIVEAU', sub: 'Tout le niveau' }];
        const single = opts.length === 1;
        const ow = single ? 300 : 252, oh = 96, gap = 16;
        const totW = opts.length * ow + (opts.length - 1) * gap;
        const oy = cy + 40;
        opts.forEach((o, i) => {
          const ox = cx - totW / 2 + i * (ow + gap);
          const on = (i === deathSel);
          if (on) drawRect({ pos: vec2(ox - 5, oy - oh / 2 - 5), width: ow + 10, height: oh + 10, radius: 16, color: GREEN, opacity: 0.18 + 0.18 * (0.5 + 0.5 * Math.sin(T * 4)) });
          drawRect({ pos: vec2(ox + 3, oy - oh / 2 + 4), width: ow, height: oh, radius: 13, color: rgb(18, 11, 6), opacity: 0.16 });
          drawRect({ pos: vec2(ox, oy - oh / 2), width: ow, height: oh, radius: 13, color: CREAM });
          drawRect({ pos: vec2(ox, oy - oh / 2), width: ow, height: oh, radius: 13, fill: false, outline: { width: on ? 3.5 : 2.5, color: on ? GREENDK : INKSOFT } });
          ink(o.cap, ox + ow / 2, oy - 14, 24, on ? GREENDK : INK, 1);
          drawText({ text: o.sub, pos: vec2(ox + ow / 2, oy + 22), anchor: 'center', size: 15, color: BROWN });
        });

        const hint = TOUCH_ON ? '(tape une carte)' : (single ? 'ESPACE pour valider' : '◀ ▶ pour choisir  -  ESPACE pour valider');
        drawText({ text: hint, pos: vec2(cx, top + bh + 22), anchor: 'center', size: 14, color: GOLDHI, opacity: 0.9 });
        popTransform();
      });
    };

    // SAUT MODULABLE : relacher SAUT en pleine montee coupe la courbe (petit saut).
    const onKeysRelease = (arr, cb) => arr.forEach((k) => onKeyRelease(k, cb));
    onPlayKey(C.controls.jump, () => {
      const p = PLAYER;
      const eq = p.equipped && C.equipment && C.equipment[p.equipped];
      const jf = C.player.jumpForce * ((eq && eq.jumpMul) || 1);   // rollers/velo : saute plus haut
      // v2 DROP-THROUGH : BAS+SAUT debout sur un PANNEAU ('-'/'x') -> on DESCEND
      //  a travers (le one-way d'addPanel ignore Laura tant que _dropT > 0). Ne
      //  consomme AUCUN saut. Tactile : double-tap ▼ synthetise ce combo (mobile.js).
      if (p.isGrounded() && keysDown(C.controls.crouch)) {
        const plat = p.curPlatform && p.curPlatform();
        if (plat && plat.is && plat.is('panel')) {
          p._dropT = 0.25;
          p.pos.y += 2;            // decolle du cap pour amorcer la chute immediatement
          return;
        }
      }
      if (p.isGrounded()) { p.jump(jf); p.jumpsLeft = C.player.maxJumps - 1; sfx('jump'); }
      else if (p.jumpsLeft > 0) { p.jump(jf); p.jumpsLeft--; sfx('jump'); }
    });
    onKeysRelease(C.controls.jump, () => {
      if (!PLAYER || !PLAYER.exists()) return;
      if (!PLAYER.isGrounded() && PLAYER.vel && PLAYER.vel.y < 0) PLAYER.vel = vec2(PLAYER.vel.x, PLAYER.vel.y * 0.45);
    });
    onPlayKey(C.controls.lob, lobShoot);
    // DASH (Maj) : ruee horizontale + i-frames (via p.invuln). GRATUIT (cf.
    //  GAMEPLAY.md), simple cooldown. La ruee elle-meme est appliquee dans la
    //  boucle d'update via move() (transitoire) -> aucune vitesse residuelle.
    onPlayKey(C.controls.dash, () => {
      const p = PLAYER; if (!p || !p.exists()) return;
      const d = C.player.dash; if (!d) return;
      if (p.dashT > 0 || (p.dashCd || 0) > 0 || p.knockT > 0) return;
      p.dashT = d.duration || 0.16;
      p.dashVx = (p.facing || 1) * (d.speed || 540);
      p.dashCd = d.cooldown || 0.5;
      p.invuln = Math.max(p.invuln || 0, d.iframes || 0.2);
      if (p.vel) p.vel = vec2(0, p.vel.y);       // repart d'une vitesse horizontale NULLE (anti-glissade)
      addPoof(p.pos.x, p.pos.y - TS * 0.4);
    });
    //  Le popup de MORT a priorite : tant qu'il est ouvert, ESC/ESPACE/ENTREE
    //  pilotent SON choix (pas la confirmation de sortie).
    onKeys(C.controls.quit, () => { if (deathBox) return; quitBox ? closeQuit() : openQuit(); });   // ESC : ouvre/ferme la confirmation
    onKeyPress('space', () => { if (deathBox) { deathConfirm(); return; } confirmQuit(); });        // ESPACE/ENTREE : valide
    onKeyPress('enter', () => { if (deathBox) { deathConfirm(); return; } confirmQuit(); });
    // popup mort : saut = valider aussi (OK tactile) ; ◀▶ deplacent la selection.
    C.controls.jump.forEach((k) => onKeyPress(k, () => { if (deathBox) deathConfirm(); }));
    C.controls.left.forEach((k) => onKeyPress(k, () => deathSelMove(-1)));
    C.controls.right.forEach((k) => onKeyPress(k, () => deathSelMove(1)));
    // Tactile/souris : taper directement une rangee de la boite "quitter" ou une
    //  carte du popup de mort (touchToMouse mappe le tap -> souris ; les boites
    //  sont en repere ecran, donc mousePos() est dans le meme repere 960x528).
    onMousePress(() => {
      if (deathBox) {
        const m = mousePos(), cx = C.width / 2, cy = C.height / 2;
        if (Math.abs(m.y - (cy + 40)) <= 54) {                    // bande des cartes -> selectionne + valide
          deathSel = (bossRetryOK() && m.x > cx) ? 1 : 0;
          deathConfirm();
        }
        return;
      }
      if (!quitBox) return;
      const m = mousePos(), cx = C.width / 2, cy = C.height / 2;
      if (Math.abs(m.x - cx) > 224) return;                       // hors des rangees
      if (Math.abs(m.y - (cy + 24)) <= 28) confirmQuit();         // rangee "Oui" -> carte
      else if (Math.abs(m.y - (cy + 82)) <= 28) closeQuit();      // rangee "Non" -> reprendre
    });

    // --- CHEATS de test (CONFIG.cheats). Mets cheats:false pour le cadeau.
    if (C.cheats) {
      const CK = C.cheatKeys || { god: 'g', finish: '0', refill: 'delete' };
      C.levels.forEach((lk, i) => onPlayPress(String(i + 1), () => go('game', lk)));  // 1-6
      if (CK.finish) onPlayPress(CK.finish, () => { LEVEL.bossesAlive = 0; completeLevel(); });  // finir
      if (CK.god) onPlayPress(CK.god, () => { PLAYER._god = !PLAYER._god; flashMsg('DIEU ' + (PLAYER._god ? 'ON' : 'OFF')); });
      if (CK.refill) onPlayPress(CK.refill, () => {                                   // Suppr : plein + armes a fond
        PLAYER.hp = PLAYER.maxHp; PLAYER.kills = 0; PLAYER.sunMax = C.sun.max; PLAYER.sun = C.sun.max;
        PLAYER.power = (C.arsenal && C.arsenal.power.max) || 3;   // ARSENAL au max
        PLAYER.rate = (C.arsenal && C.arsenal.rate.max) || 3;
        PLAYER.powerFlash = 0.8; PLAYER.rateFlash = 0.8;
        PLAYER.catCharges = C.cat.maxCharges; flashMsg('PLEIN !');
      });
    }

    PLAYER.onCollide('enemy', (e) => damagePlayer(e.def ? e.def.touchDamage : 1, e.pos.x));
    // contact BOSS = coup LOURD (ecrasement) : traverse le surbouclier (cf.
    //  damagePlayer heavy + sun.bossTouchPierces) — un tracteur qui te roule
    //  dessus ne se tanke pas a la jauge de soleil.
    //  onCollideUPDATE (pas onCollide) : la resolution joueur<->boss est annulee
    //  des deux cotes (no-shove) -> les hitboxes peuvent rester SUPERPOSEES sans
    //  nouvel evenement d'entree. Avec onCollide, dasher DANS le boss pendant
    //  les i-frames permettait de camper a l'interieur et de tirer a bout
    //  portant sans plus jamais subir le contact (meme piege moteur que le coup
    //  retour du chat). Le tick effectif reste ~1 coup lourd/s (gate p.invuln).
    PLAYER.onCollideUpdate('boss', (b) => damagePlayer(b.def ? b.def.touchDamage : 2, b.pos.x, C.sun.bossTouchPierces !== false));
    PLAYER.onCollide('ehot', (h) => { damagePlayer(h.dmg || 1, h.pos.x); if (h.exists()) destroy(h); });
    PLAYER.onCollide('hazard', (h) => damagePlayer((C.hazards && C.hazards.touchDamage) || 1, h.pos.x));   // sol piege : degat au contact (gate par invuln ; dash = i-frames)
    PLAYER.onCollide('pickup', (it) => collectPickup(it));
    PLAYER.onCollide('sun', () => tryReachSun());

    onUpdate('enemy', enemyBehavior);
    onUpdate('passant', enemyBehavior);   // figurant : meme va-et-vient, mais tag a part (cf. spawnEnemy)
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
        loop(0.25, () => { if (PLAYER.exists()) playerShoot('graine', 1); });
        loop(2.0, () => { if (PLAYER.exists()) lobShoot(); });
        loop(3.0, () => { if (PLAYER.exists()) PLAYER.jump(C.player.jumpForce); });
        loop(4.0, () => { if (PLAYER.exists()) deployCat(); });
      } catch (e) {}
    }

    PLAYER.onUpdate(() => {
      const p = PLAYER;
      p.levelTime = (p.levelTime || 0) + dt();   // chrono du niveau (fige quand le jeu est en pause)
      let moving = false;
      const eqv = p.equipped && C.equipment && C.equipment[p.equipped];
      const spd = C.player.speed * ((eqv && eqv.speedMul) || 1);   // rollers = plus rapide
      const crouching = p.isGrounded() && keysDown(C.controls.crouch);   // accroupi (au sol ; BAS = SEUL usage)
      // CHAT : il part en aller-retour tout seul ; Laura n'est PLUS figee, elle
      //  continue de bouger / tirer / sauter pendant ce temps (cf. calque d'action).
      if (p.dashCd > 0) p.dashCd -= dt();
      if (p._dropT > 0) p._dropT -= dt();        // drop-through en cours (one-way des panneaux)

      // v2 : pose le CHECKPOINT d'arene la 1re fois que Laura entre dans la zone
      //  du boss (boss encore vivant) -> mourir au boss = respawn ici (loseGame).
      //  Gate par CONFIG.bossCheckpoint (false = jamais de checkpoint, tous
      //  niveaux : mourir au boss suit le chemin lose normal).
      if (C.bossCheckpoint && !LEVEL.checkpoint && LEVEL.bossX != null && LEVEL.bossesAlive > 0) {
        const edge = LEVEL.bossX - (LEVEL.bossRange || 300) - TS * 2;
        if (p.pos.x >= edge) {
          LEVEL.checkpoint = { x: Math.max(TS * 1.5, edge - TS), y: columnGroundY(Math.floor(edge / TS)) - 2 };
        }
      }
      // v2.3 VERROU D'ARENE : Laura ENTRE dans l'arene (>= 1 tuile apres le bord
      //  gauche -> jamais dans la colonne du mur) avec le boss vivant -> on ferme.
      if (!LEVEL.gates && LEVEL.bossX != null && LEVEL.bossesAlive > 0 &&
          p.pos.x >= LEVEL.bossX - (LEVEL.bossRange || 300) + TS) addArenaGates();
      // DASH : ruee horizontale TRANSITOIRE via move() (PAS via p.vel, qui est
      //  PERSISTE par le body de KAPLAY -> l'ancienne ecriture de vel.x ne se
      //  remettait jamais a 0 et Laura glissait sans fin). La gravite (vel.y)
      //  reste geree par le body. A la sortie, on annule toute vx residuelle.
      if (p.dashT > 0) {
        p.dashT -= dt();
        p.move(p.dashVx, 0);
        if (p.dashT <= 0 && p.vel) p.vel = vec2(0, p.vel.y);
      }
      else if (p.knockT > 0) { p.knockT -= dt(); p.move(p.knockX, 0); }  // recul : pas de controle
      else if (!crouching) {
        if (keysDown(C.controls.left)) { p.move(-spd, 0); p.facing = -1; moving = true; }
        if (keysDown(C.controls.right)) { p.move(spd, 0); p.facing = 1; moving = true; }
      }

      // TIR DE BASE (graine, gratuit) : rafale en maintenant ESPACE. Le lob lourd
      //  (X) part via onPlayKey(C.controls.lob, lobShoot), pas ici.
      p.fireCd -= dt();
      if (p.lobCd > 0) p.lobCd -= dt();
      if (keysDown(C.controls.shoot) && p.fireCd <= 0) {   // rollers/velo = powerup positif : on garde le tir
        fireBase(p);
        p.fireCd = grainesCd(p);                 // cadence pilotee par la CADENCE (p.rate)
      }

      // CHAT INSTANTANE : deploiement a la PRESSION de C (verrou anti-repetition).
      const canCat = p.catCharges > 0 && !catOut();
      if (canCat && keysDown(C.controls.cat) && !p.catLock) { deployCat(); p.catLock = true; }
      if (!keysDown(C.controls.cat)) p.catLock = false;

      // RECHARGE AUTO DU CHAT : une charge revient seule toutes les cat.regenTime s
      //  (jamais bloquee a 0). Les croquettes ('k') donnent EN PLUS un +1 instantane.
      if ((C.cat.regenTime || 0) > 0 && p.catCharges < C.cat.maxCharges) {
        p.catRegenT = (p.catRegenT || 0) + dt();
        if (p.catRegenT >= C.cat.regenTime) { p.catRegenT -= C.cat.regenTime; p.catCharges = Math.min(C.cat.maxCharges, p.catCharges + 1); sfx('pickup'); }
      } else p.catRegenT = 0;

      if (p.isGrounded()) p.jumpsLeft = C.player.maxJumps;

      // animation selon l'etat. Priorite : ACTION (lancer/chat) > accroupi > saut >
      // touche > course > idle. heroAnim applique l'override d'equipement
      // (velo/rollers -> sprite "Laura sur l'engin").
      // accroupissement progressif : duckProg 0 (debout) -> 1 (accroupi a fond).
      //  En MAINTENANT bas la planche se joue a l'endroit (se baisse) ; au
      //  relachement on la rejoue a l'envers pour se relever. La frame est posee
      //  a la main (pas de play()), donc l'anim suit exactement la progression.
      const dDown = C.player.duckDown || 0.12, dUp = C.player.duckUp || 0.12;
      p.duckProg = crouching
        ? Math.min(1, (p.duckProg || 0) + dt() / dDown)
        : Math.max(0, (p.duckProg || 0) - dt() / dUp);
      const duckSpr = p.isGrounded() && p.duckProg > 0 && hasSprite('hero_duck');

      // --- ACTION (lancer / chat) : CALQUE superpose OU plein-corps selon equipement
      //  + assets dispos (cf. SPRITES.md "rig en couches"). word = 'throw' | 'cat'.
      //   1. equipe + feuille dediee <base>_<word> -> swap plein-corps (ex. velo : hero_bike_throw).
      //   2. calque act_<word> dispo -> base (course/roule) INCHANGEE + overlay (rollers ; a pied si fourni).
      //   3. repli : a pied -> plein-corps (hero_throw / hero_cat_out) ; equipe sans asset -> pose de roule.
      let actWord = null, actReplay = false, actAmmoSpr = null;
      if (p.catTossT > 0) { p.catTossT -= dt(); actWord = 'cat'; }   // PRIORITE sur le tir : la pose "lance le chat"
      else if (p.throwT > 0) {                                       // PRIORITE sur le saut : on tire meme en l'air
        p.throwT -= dt(); actWord = 'throw';
        if (p.throwReplay) { actReplay = true; p.throwReplay = false; }   // rejoue depuis la 1re frame
        const ts = C.ammoTypes[p.ammoKey] && C.ammoTypes[p.ammoKey].throwSprite;   // anim de lancer par arme
        actAmmoSpr = (ts && hasSprite(ts)) ? ts : 'hero_throw';
      }
      let actBody = null, actOvSpr = null;          // sprite plein-corps | calque bras superpose
      const actClip = actWord === 'cat' ? 'cat' : 'throw';
      if (actWord === 'cat') {
        actBody = 'hero_cat_out';                   // pose plein-corps "lance le chat"
      } else if (actWord === 'throw') {
        // BRAS DE LANCER PAR LOCOMOTION : run/bike/roll/duck ont un calque bras dedie
        //  (hero_<loco>_throw, ~3 frames transparentes) pose PAR-DESSUS la locomotion qui
        //  CONTINUE dessous. idle / saut n'en ont pas -> plein-corps hero_throw.
        let loco;
        if (p.equipped === 'velo') loco = 'bike';        // en velo on reste sur le velo, meme en l'air
        else if (!p.isGrounded()) loco = 'jump';
        else if (duckSpr) loco = 'duck';
        else if (p.equipped === 'rollers') loco = 'roll';
        else if (moving) loco = 'run';
        else loco = 'idle';
        const arm = 'hero_' + loco + '_throw';
        if (hasSprite(arm)) actOvSpr = arm;          // calque bras : locomotion inchangee dessous
        else actBody = hasSprite('hero_throw') ? 'hero_throw' : actAmmoSpr;   // idle/saut -> plein-corps
      }
      setActionOverlay(p, actOvSpr, actClip, actReplay);            // (de)pose le calque d'action

      if (actBody) { if (actReplay) p._anim = null; setAnim(p, noCat(actBody), actClip); }
      // DASH : feuille dediee hero_dash (elan penche) si embarquee — mais PAS en
      //  velo/rollers (on reste sur l'engin : heroAnim applique l'override 'run').
      else if (p.dashT > 0) {
        const dashSpr = !p.equipped && hasSprite('hero_dash');
        heroAnim(p, dashSpr ? 'hero_dash' : 'hero_run', dashSpr ? 'dash' : 'run');
      }
      else if (duckSpr) {                               // scrub manuel : frame = progression
        const ds = noCat('hero_duck');                 // sac vide si le chat est dehors
        if (p._spr !== ds) { p.use(sprite(ds)); p._spr = ds; p._anim = null; }
        const lastF = ((C.anims.hero_duck && C.anims.hero_duck.sliceX) || 7) - 1;
        p.frame = Math.max(0, Math.min(lastF, Math.round(p.duckProg * lastF)));
      }
      // HURT AVANT le saut : une blessure prise EN L'AIR (bombe, piquet en
      //  cloche, contact pendant un saut) doit se voir — avant, la branche
      //  aerienne masquait la pose hurt et le seul feedback etait le clignotement.
      else if (p.invuln > C.player.invulnTime - 0.25) heroAnim(p, 'hero_hurt', 'hurt');
      // En velo, le saut ne change PAS d'anim : on reste sur le velo (cycle de
      //  pedalage course/idle), pas de pose de saut figee.
      else if (!p.isGrounded() && p.equipped === 'velo') heroAnim(p, moving ? 'hero_run' : 'hero_idle', moving ? 'run' : 'idle');
      else if (!p.isGrounded()) heroAnim(p, 'hero_jump', 'jump');
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
      p.killFlash = Math.max(0, (p.killFlash || 0) - dt());
      p.powerFlash = Math.max(0, (p.powerFlash || 0) - dt());
      p.rateFlash = Math.max(0, (p.rateFlash || 0) - dt());
      p.saveFlash = Math.max(0, (p.saveFlash || 0) - dt());
      p.shieldFlash = Math.max(0, (p.shieldFlash || 0) - dt());

      // RECHARGE SOLAIRE (photosynthese) : la jauge remonte toute seule au
      //  soleil, pas a l'ombre d'un panneau. Le front montant (reprise de
      //  recharge : passage ombre->soleil, ou apres avoir depense une arme
      //  lourde) declenche un petit flash de glow dans le HUD.
      if (C.sun.enabled) {
        // BOUCLIER BRISE (v2) : apres un coup absorbe, la regen PASSIVE est
        //  coupee sunRegenLockT s (les rayons 'o', eux, creditent toujours).
        p.sunRegenLockT = Math.max(0, (p.sunRegenLockT || 0) - dt());
        const shaded = inShade(p);
        const rate = shaded ? (C.sun.regenShade || 0) : (C.sun.regen || 0);
        const charging = (rate > 0 && p.sun < p.sunMax && p.sunRegenLockT <= 0);
        if (charging) p.sun = Math.min(p.sunMax, p.sun + rate * dt());
        if (charging && !p._sunCharging) p.sunFlash = 0.5;
        p.sunFlash = Math.max(0, (p.sunFlash || 0) - dt());
        p._sunCharging = charging;
        p._sunShaded = shaded;
      }

      if (p.pos.y > LEVEL.height + 200) loseGame();

      const half = C.width / 2;
      const cx = Math.max(half, Math.min(LEVEL.width - half, p.pos.x));
      // CAM VERTICALE : dans une ZONE-CIEL ('|'), la cam suit Laura vers le HAUT
      //  pour reveler le niveau cache. Mais : ZONE MORTE en bas (PAS de suivi sur
      //  les sauts au ras du sol — ca ne demarre que quand Laura APPROCHE DU HAUT
      //  de l'ecran) ET cadrage ~CENTRE quand ca suit (pas de sol visible -> Laura
      //  en bas fait bizarre). Hors zone / passe toX -> retour epingle en bas.
      const baseY = LEVEL.baseCamY;
      let targetY = baseY;
      const sz = LEVEL.skyZone;
      if (sz && p.pos.x >= sz.fromX && p.pos.x < sz.toX) {
        // ou serait Laura A L'ECRAN si la cam restait epinglee en bas (0=haut, C.height=bas)
        const screenAtBase = p.pos.y - baseY + C.height / 2;
        const TRIG = C.height * (LEVEL.skyTrig != null ? LEVEL.skyTrig : 0.22);   // declenche quand Laura entre dans le HAUT (> double-saut depuis le sol)
        const BLEND = C.height * 0.16;                                            // transition douce vers le suivi (pas de saut de cadrage)
        const t = Math.max(0, Math.min(1, (TRIG - screenAtBase) / BLEND));
        if (t > 0) {
          const framed = p.pos.y - C.height * 0.05;                              // Laura un poil SOUS le centre (un peu plus de ciel au-dessus)
          const top = (LEVEL.skyTop != null) ? LEVEL.skyTop : -TS * 4;
          targetY = Math.max(top, baseY + (framed - baseY) * t);                 // lerp(base -> centre) selon t
        }
      }
      LEVEL.camY += (targetY - LEVEL.camY) * Math.min(1, dt() * 6);     // lissage (ease)
      setCam(cx, LEVEL.camY);
    });
  });

  // ---------------------------------------------------------------------
  //  SCENES UI
  // ---------------------------------------------------------------------
  function bigText(str, y, size, col, w) {
    add([text(str, { size, align: 'center', width: w || (C.width - 80) }), pos(C.width / 2, y), anchor('center'), color(col[0], col[1], col[2])]);
  }

  // --- UI partagee des ecrans de victoire (meme langage que title/overworld) ---
  const UI = {
    INK:   [58, 36, 22],    // brun encre (contours)
    GOLD:  [255, 206, 71],  // soleil
    CREAM: [255, 244, 219], // creme (texte sur fond sombre)
    RED:   [226, 74, 60],   // terracotta (ruban accent)
    GREEN: [86, 158, 74],   // vert riziere
    NIGHT: [40, 30, 54],    // bleu nuit (cartouche)
  };
  // fond peint plein ecran (ou aplat de secours si le PNG manque)
  function uiBg(name, fb) {
    return hasSprite(name)
      ? add([sprite(name, { width: C.width, height: C.height }), pos(0, 0), anchor('topleft'), z(-10)])
      : add([rect(C.width, C.height), pos(0, 0), anchor('topleft'), color(fb[0], fb[1], fb[2]), z(-10)]);
  }
  // voile translucide pour poser du texte sur l'art
  function uiScrim(y, h, col, op) {
    return add([rect(C.width, h), pos(0, y), anchor('topleft'), color(col[0], col[1], col[2]), opacity(op), z(-9)]);
  }
  const uiPill = (x, y, w, h, col, op, r, zz) => add([
    rect(w, h, { radius: r == null ? h / 2 : r }), pos(x, y), anchor('center'),
    color(col[0], col[1], col[2]), opacity(op == null ? 1 : op), z(zz == null ? 4 : zz),
  ]);
  // texte a contour 8-directions : lisible par-dessus n'importe quel fond peint
  function uiText(str, x, y, size, fill, opts) {
    opts = opts || {};
    const w = opts.width || (C.width - 80);
    const ow = opts.outline == null ? 3 : opts.outline;
    const ink = opts.ink || UI.INK;
    const z0 = opts.z == null ? 6 : opts.z;
    const group = [];
    const mk = (dx, dy, col, zz, op) => {
      const o = add([
        text(str, { size, align: 'center', width: w, lineSpacing: opts.lineSpacing }),
        pos(x + dx, y + dy), anchor('center'), color(col[0], col[1], col[2]),
        z(zz), opacity(op == null ? 1 : op),
      ]);
      group.push(o); return o;
    };
    if (opts.shadow) mk(0, ow + 3, [20, 12, 8], z0 - 1, 0.4);
    for (let a = 0; a < 8; a++) mk(Math.round(Math.cos(a * Math.PI / 4) * ow), Math.round(Math.sin(a * Math.PI / 4) * ow), ink, z0);
    const face = mk(0, 0, fill, z0 + 1);
    face.group = group;   // contour + face : pour animer tout le bloc ensemble
    return face;
  }
  // apparition etagee : fade-in + petit glissement (delay en s, dy = decalage de depart)
  function uiAppear(obj, delay, dy) {
    const group = obj.group || [obj];
    const baseOp = group.map((o) => o.opacity);
    const baseY = group.map((o) => o.pos.y);
    dy = dy || 0;
    group.forEach((o, i) => { o.opacity = 0; o.pos.y = baseY[i] + dy; });
    let t = -(delay || 0);
    obj.onUpdate(() => {
      t += dt();
      const k = t <= 0 ? 0 : Math.min(1, t / 0.45);
      const e = 1 - Math.pow(1 - k, 3);   // easeOutCubic
      group.forEach((o, i) => { o.opacity = baseOp[i] * e; o.pos.y = baseY[i] + dy * (1 - e); });
    });
    return obj;
  }
  // pop d'entree (easeOutBack) + leger battement, sur un sprite (base = echelle d'affichage)
  function uiPop(obj, base, delay, bob) {
    let t = -(delay || 0);
    obj.scale = vec2(0.0001);
    obj.onUpdate(() => {
      t += dt();
      if (t <= 0) { obj.scale = vec2(0.0001); return; }
      const k = Math.min(1, t / 0.5);
      const s = 1.70158;
      const back = 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
      obj.scale = vec2(k < 1 ? base * back : base * (1 + (bob ? 0.05 * Math.sin(t * 3) : 0)));
    });
    return obj;
  }
  // pastille "ESPACE pour continuer" clignotante (apparait apres `delay`)
  function uiPrompt(str, x, y, delay) {
    const cap = uiPill(x, y, Math.max(300, str.length * 12), 40, [40, 26, 16], 0.8, 20, 5);
    uiAppear(cap, delay, 10);
    const p = uiText(str, x, y, 19, UI.GOLD, { outline: 3, z: 8 });
    p.group.forEach((g) => { g.opacity = 0; });
    let bt = -(delay + 0.02);
    p.onUpdate(() => { bt += dt(); if (bt < 0) return; const o = 0.45 + 0.55 * Math.abs(Math.sin(bt * 2.6)); p.group.forEach((g) => { g.opacity = o; }); });
    return p;
  }
  // confettis / etincelles qui pleuvent (ou montent si dir=270)
  function uiConfetti(cols, rate, opts) {
    opts = opts || {};
    const dir = opts.dir == null ? 90 : opts.dir;
    const host = add([pos(0, 0), { acc: 0 }]);
    host.onUpdate(() => {
      host.acc += dt();
      while (host.acc > rate) {
        host.acc -= rate;
        const c = cols[Math.floor(rand(0, cols.length))];
        const sz = rand(opts.min || 5, opts.max || 11);
        const a = (dir + rand(-12, 12)) * Math.PI / 180;   // direction en vec2 (KAPLAY ici n'utilise que des vec2)
        const p = add([
          rect(sz, sz * rand(0.9, 1.5), { radius: 2 }),
          pos(rand(-10, C.width + 10), opts.y == null ? -20 : opts.y), anchor('center'),
          color(c[0], c[1], c[2]), rotate(rand(0, 360)),
          move(vec2(Math.cos(a), Math.sin(a)), rand(opts.vmin || 70, opts.vmax || 180)),
          opacity(0.95), z(3), lifespan(opts.life || 5.5, { fade: 1.2 }),
        ]);
        p.spin = rand(-220, 220);
        p.onUpdate(() => { p.angle += p.spin * dt(); });
      }
    });
    return host;
  }

  scene('title', () => {
    playMusic((C.music || {}).title);
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
      const layers = [];
      const mk = (dx, dy, col, zz) => {
        const o = add([
          text(str, { size, align: 'center', width: w, lineSpacing: ls }),
          pos(x + dx, y + dy), anchor('center'), color(col[0], col[1], col[2]), z(zz), opacity(1),
        ]);
        layers.push(o);
        return o;
      };
      const z0 = opts.z || 6;
      if (opts.shadow) mk(0, ow + 3, [20, 12, 8], z0 - 1).use(opacity(0.45));
      for (let a = 0; a < 8; a++) mk(Math.round(Math.cos(a * Math.PI / 4) * ow), Math.round(Math.sin(a * Math.PI / 4) * ow), ink, z0);
      const out = mk(0, 0, fill, z0 + 1);
      out.layers = layers;       // contour + remplissage : permet de faire clignoter le bloc entier
      return out;
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
    inkText('Des rizières à la soutenance : bats chaque boss et rédige ta thèse !', C.width / 2, 178, 17, CREAM, { outline: 2, z: 6 });

    // --- bandeau bas : controles -------------------------------------
    pill(C.width / 2, C.height - 22, C.width, 56, [26, 18, 12], 0.5, 0, 3);
    inkText('Q/D ou Fleches : bouger     HAUT : sauter     ESPACE : tir de base', C.width / 2, C.height - 33, 14, CREAM, { outline: 2, z: 6 });
    inkText('X : lob lourd     MAJ : dash     C : chat', C.width / 2, C.height - 13, 14, [220, 214, 198], { outline: 2, z: 6 });

    // --- invite "ESPACE pour commencer" : pastille doree clignotante ---
    const startPill = pill(C.width / 2, 430, 500, 44, [40, 26, 16], 0.78, 22, 5);
    const start = inkText(C.story.start, C.width / 2, 430, 22, GOLD, { outline: 3, z: 7 });

    let t = 0;
    onUpdate(() => {
      t += dt();
      title.pos.y = titleY + Math.sin(t * 2) * 3;
      const blink = Math.abs(Math.sin(t * 2.6));   // pastille + texte clignotent ensemble
      const tOp = 0.45 + 0.55 * blink;
      start.layers.forEach((o) => { o.opacity = tOp; });
      startPill.opacity = 0.30 + 0.50 * blink;
    });

    const go1 = () => go('slots');
    onConfirm(go1);
    onClick(go1);
  });

  // --- SELECTION DE SAUVEGARDE (3 slots) ------------------------------
  scene('slots', () => {
    playMusic((C.music || {}).slots);
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
    add([text('Flèches : choisir     ESPACE : valider     E : effacer', { size: 15, align: 'center' }), pos(480, C.height - 33), anchor('center'), color(255, 244, 222), z(6)]);
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
    onKeys(C.controls.left, () => { cur = (cur + 2) % 3; render(); });    // fleches ET Q/D (annonces a l'ecran titre)
    onKeys(C.controls.right, () => { cur = (cur + 1) % 3; render(); });
    onKeyPress('e', () => { SAVEAPI.erase(cur); render(); });
    onConfirm(pick);
    onBack(() => go('title'));   // ESC : retour ecran titre
  });

  // --- CARTE DU MONDE (overworld facon Dora) --------------------------
  scene('overworld', () => {
    if (!SAVE) { go('title'); return; }
    playMusic((C.music || {}).overworld);
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
      // nom du boss (sous le noeud) — masque tant que le niveau n'est pas fini
      inkText(done ? n.boss : '? ? ?', n.x, n.y + R + 12, 11, done ? [255, 236, 206] : [210, 216, 222], { outline: 2, z: 3 });
      // MEILLEUR TEMPS (time-attack) sous le nom du boss, si le niveau est fini
      if (done && i < SAVEAPI.N_LEVELS && SAVE.bestTime && SAVE.bestTime[i] > 0) {
        const bt = SAVE.bestTime[i], bm = Math.floor(bt / 60), bs = Math.floor(bt % 60);
        inkText('TEMPS ' + (bm < 10 ? '0' : '') + bm + ':' + (bs < 10 ? '0' : '') + bs,
          n.x, n.y + R + 25, 10, [255, 222, 128], { outline: 2, z: 3 });
      }
      // v2 : pastilles MEDAILLES sous le noeud (TEMPS/DATA/SAUVES ; jury = temps seul)
      const md = done && SAVE.medals ? SAVE.medals[(i < SAVEAPI.N_LEVELS) ? i : SAVEAPI.N_LEVELS] : null;
      if (md) {
        const vals = (i < SAVEAPI.N_LEVELS) ? [md.t, md.d, md.s] : [md.t];
        const tcol = (v) => v >= 3 ? [255, 206, 71] : (v === 2 ? [206, 212, 222] : (v === 1 ? [206, 140, 80] : [96, 90, 84]));
        vals.forEach((v, k) => {
          const cc = tcol(v || 0);
          add([circle(5), pos(n.x + (k - (vals.length - 1) / 2) * 15, n.y + R + 38), anchor('center'),
            color(cc[0], cc[1], cc[2]), outline(2, rgb(INK[0], INK[1], INK[2])), opacity((v || 0) > 0 ? 1 : 0.45), z(3)]);
        });
      }
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
    onKeys(C.controls.left, () => move(-1));     // fleches ET Q/D (annonces a l'ecran titre)
    onKeys(C.controls.right, () => move(1));
    const enter = () => { if (cur <= SAVE.unlockedMax) go('game', nodes[cur].key); };
    onConfirm(enter);
    onBack(() => go('slots'));   // ESC : retour selection de sauvegarde
  });

  // --- CHAPITRE GAGNE -------------------------------------------------
  // --- CHAPITRE ECRIT (apres chaque boss de niveau) : bureau de redaction ---
  scene('chapter', (data) => {
    playMusic((C.music || {}).chapter);
    setCam(C.width / 2, C.height / 2);
    const idx = (data && data.idx) || 0;
    const N = SAVEAPI.N_LEVELS;
    const gotPubli = !!(SAVE && SAVE.publis && SAVE.publis[idx]);
    const done = SAVE ? SAVE.levelsDone.filter(Boolean).length : (idx + 1);

    uiBg('bg_chapter', [34, 28, 46]);
    uiScrim(0, 150, [20, 14, 30], 0.34);                 // voile haut -> titre lisible
    uiConfetti([UI.GOLD, UI.CREAM, [255, 226, 120]], 0.2, // fine poussiere doree qui monte
      { dir: 270, y: C.height + 10, vmin: 22, vmax: 52, min: 3, max: 6, life: 4.2 });

    // titre sur ruban terracotta
    uiAppear(uiPill(C.width / 2, 74, 470, 46, UI.RED, 0.92, 23, 4), 0.12, -14);
    uiAppear(uiText(C.story.chapterDone, C.width / 2, 74, 29, UI.GOLD, { outline: 3, shadow: true, z: 7 }), 0.15, -14);

    // progression du manuscrit (+ mention publi si 100%)
    let prog = 'Manuscrit : ' + Math.min(done, N) + ' / ' + N + ' chapitres';
    if (gotPubli) prog += '     +  PUBLICATION !';
    uiAppear(uiText(prog, C.width / 2, 118, 15, UI.CREAM, { outline: 2, z: 7 }), 0.26, -8);

    // --- v2 : recap des 3 MEDAILLES du niveau (sprite medal_* si embarque,
    //  pastille dessinee sinon ; seuil or rappele en petit, gris = ratee) ----
    const meds = data && data.meds;
    if (meds) {
      const par = data.par;
      const fmtT = (s) => { const m = Math.floor(s / 60), ss = Math.floor(s % 60); return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss; };
      const rows = [
        { v: meds.t, name: (C.story.medals || [])[0] || 'TEMPS',  info: (data.tsec ? fmtT(data.tsec) : '--') + (par ? '  (or ' + fmtT(par.or) + ')' : '') },
        { v: meds.d, name: (C.story.medals || [])[1] || 'DATA',   info: (data.pct != null ? data.pct : 0) + '%  (or 100%)' },
        { v: meds.s, name: (C.story.medals || [])[2] || 'SAUVES', info: (data.savedPct != null ? data.savedPct : 0) + '%  (or 100%)' },
      ];
      rows.forEach((m, i) => {
        const mx = C.width / 2 + (i - 1) * 196, my = 174;
        const sprName = m.v >= 3 ? 'medal_or' : (m.v === 2 ? 'medal_argent' : (m.v === 1 ? 'medal_bronze' : 'medal_lock'));
        if (hasSprite(sprName)) {
          uiAppear(add([sprite(sprName), pos(mx - 56, my), anchor('center'), artScale(0.9), z(7), opacity(m.v > 0 ? 1 : 0.55)]), 0.3 + i * 0.06, -8);
        } else {
          const cc = m.v >= 3 ? [255, 206, 71] : (m.v === 2 ? [206, 212, 222] : (m.v === 1 ? [206, 140, 80] : [96, 90, 84]));
          uiAppear(add([circle(13), pos(mx - 56, my), anchor('center'), color(cc[0], cc[1], cc[2]), outline(3, rgb(58, 36, 22)), z(7), opacity(m.v > 0 ? 1 : 0.5)]), 0.3 + i * 0.06, -8);
        }
        uiAppear(uiText(m.name, mx + 8, my - 9, 14, m.v > 0 ? UI.GOLD : UI.CREAM, { outline: 2, z: 7 }), 0.32 + i * 0.06, -8);
        uiAppear(uiText(m.info, mx + 8, my + 11, 11, UI.CREAM, { outline: 2, z: 7 }), 0.34 + i * 0.06, -8);
      });
      if (data.feli) uiAppear(uiText(C.story.feliJury + '  (sans degat !)', C.width / 2, 210, 13, UI.GOLD, { outline: 2, z: 7 }), 0.5, -6);
    }

    // cartouche : le texte du chapitre (pose sur le bas, laisse voir le decor)
    uiAppear(uiPill(C.width / 2, 420, 772, 116, UI.NIGHT, 0.72, 16, 4), 0.32, 16);
    uiAppear(uiText(C.story.chapters[idx] || '', C.width / 2, 418, 17, UI.CREAM, { outline: 2, z: 7, width: 724, lineSpacing: 6 }), 0.4, 16);

    uiPrompt(C.story.retry, C.width / 2, 492, 0.58);
    const next = () => go('overworld');
    onConfirm(next); onClick(next); onBack(next);
  });

  // --- SOUTENANCE REUSSIE (apres le jury) : remise du diplome ---------------
  scene('win', (data) => {
    playMusic((C.music || {}).win);
    setCam(C.width / 2, C.height / 2);
    const parts = String(C.story.win).split(/\s{2,}/).filter(Boolean);
    const head = parts[0] || String(C.story.win);
    const sub = parts.slice(1).join(' ');
    const comp = SAVE ? SAVEAPI.completion(SAVE) : 0;
    const best = SAVE ? SAVE.bestScore : (data ? data.score : 0);

    uiBg('bg_win', [255, 206, 110]);
    uiConfetti([UI.GOLD, UI.RED, UI.CREAM, [120, 200, 255], UI.GREEN], 0.05, {});  // pluie de confettis

    // --- Cortege d'applaudissements ------------------------------------
    //  Au bout de quelques secondes, un defile de collegues traverse le BAS
    //  de l'ecran en applaudissant Laura : corps generique body_clap_<sexe>
    //  (teinte au hasard -> habits varies) surmonte d'une tete du pool
    //  partage (visages varies, de face, non teintee). Defilent de la droite
    //  vers la gauche, MAX 10 a l'ecran. Au premier plan (z 2/3) MAIS sous
    //  les pastilles/texte (z>=4) -> score et consigne restent lisibles.
    const PARADE_MAX = 10, PARADE_DELAY = 3, PARADE_GAP = 1.0;
    const pc = (C.theme && C.theme.passant) || {};
    const CLAP_TINTS = [
      [255, 138, 120], [120, 190, 255], [150, 220, 150], [255, 214, 120],
      [210, 150, 235], [255, 180, 210], [140, 222, 232], [240, 232, 170],
      [255, 170, 110], [186, 196, 255], [120, 210, 180], [236, 150, 150],
    ];
    // DECK de collegues : chaque TETE du pool = une personne (un visage). On
    //  defile la liste ENTIERE (melangee) avant que quiconque repasse -> jamais
    //  de tirage au hasard avec remise, donc jamais 2 fois le meme a l'ecran.
    //  Quand le deck est vide, on le reconstruit + remelange (boucle infinie).
    const buildDeck = () => {
      const all = []
        .concat(((pc.heads && pc.heads.f) || []).map((head) => ({ sex: 'f', head })))
        .concat(((pc.heads && pc.heads.h) || []).map((head) => ({ sex: 'h', head })))
        .filter((c) => hasSprite(c.head));
      for (let i = all.length - 1; i > 0; i--) {   // Fisher-Yates (rand du moteur)
        const j = Math.floor(rand(0, i + 1));
        const tmp = all[i]; all[i] = all[j]; all[j] = tmp;
      }
      return all;
    };
    let deck = [];
    let clapSeq = 0;
    const spawnClapper = () => {
      if (!deck.length) deck = buildDeck();
      if (!deck.length) return;                    // aucune tete dispo -> rien a defiler
      // Au raccord (remelange), evite quand meme un doublon avec ceux DEJA a
      //  l'ecran : on prend la 1ere carte dont la tete n'est pas visible.
      const onScreen = new Set(get('parade').map((p) => p.head));
      let idx = deck.findIndex((c) => !onScreen.has(c.head));
      if (idx < 0) idx = 0;
      const card = deck.splice(idx, 1)[0];
      const sex = card.sex;
      const headName = card.head;
      const bodyName = hasSprite('body_clap_' + sex) ? 'body_clap_' + sex
        : ((pc.bodies && pc.bodies[sex] && pc.bodies[sex][0]) || ('body_champ_' + sex));
      if (!hasSprite(bodyName)) return;
      // TAILLE = celle des passants ingame (sizeScale tire selon la tete) ; seul
      //  le CORPS grandit, la tete reste constante (attachHead lit passantScale).
      //  Les 2 plus grands (tresGrand) : un peu plus grands que l'ingame pour
      //  qu'ils depassent bien de la foule (cortege uniquement).
      const ps = passantSize(headName, pc);
      const vs = ps.key === 'tresGrand' ? ps.scale * 1.1 : ps.scale;
      const tint = CLAP_TINTS[(clapSeq++) % CLAP_TINTS.length];
      const e = add([
        sprite(bodyName), artScale(vs),
        pos(C.width + rand(20, 90), 528), anchor('bot'), z(20),
        color(tint[0], tint[1], tint[2]),
        'parade', { phase: rand(0, Math.PI * 2), spd: rand(64, 104), passantScale: vs, head: headName },
      ]);
      try { e.play('clap'); } catch (er) { playIfAnim(e, bodyName); }
      e.onUpdate(() => { e.pos.x -= e.spd * dt(); if (e.pos.x < -90) destroy(e); });
      // tete : MEME attache que l'ingame (attachHead -> meme stitch du cou,
      //  meme headLocal/headScale/dodelinement). Le cortege passe DEVANT tout
      //  (plaque/pastilles/texte/consigne, z<=8) -> corps z20, tete z21.
      const h = attachHead(e, pc, sex, headName);
      if (h) h.use(z(21));
      return e;
    };
    const parade = add([pos(0, 0), { t: 0, acc: PARADE_GAP }]);
    parade.onUpdate(() => {
      parade.t += dt();
      if (parade.t < PARADE_DELAY) return;
      parade.acc += dt();
      if (parade.acc >= PARADE_GAP && get('parade').length < PARADE_MAX) { parade.acc = 0; spawnClapper(); }
    });

    // plaque-diplome en bas : tout le texte pose sur un fond sombre borde d'or
    // (l'art de Laura diplomee reste entierement degage au-dessus)
    add([rect(884, 216, { radius: 22 }), pos(C.width / 2, 424), anchor('center'),
      color(UI.NIGHT[0], UI.NIGHT[1], UI.NIGHT[2]), opacity(0.52), outline(3, rgb(255, 206, 71)), z(1)]);

    uiAppear(uiText(head, C.width / 2, 348, 26, UI.GOLD, { outline: 4, shadow: true, z: 7 }), 0.12, -14);
    if (sub) uiAppear(uiText(sub, C.width / 2, 386, 18, UI.CREAM, { outline: 2, z: 7 }), 0.26, -8);

    const mkChip = (cx, cy, label, value) => {
      const box = uiPill(cx, cy, 224, 60, [26, 19, 36], 0.92, 13, 4);
      const lab = uiText(label, cx, cy - 12, 12, [255, 214, 150], { outline: 2, z: 7 });
      const val = uiText(value, cx, cy + 10, 24, UI.GOLD, { outline: 3, z: 7 });
      box.group = [box].concat(lab.group, val.group);
      return box;
    };
    uiAppear(mkChip(C.width / 2 - 128, 436, 'COMPLETION', comp + '%'), 0.4, 12);
    uiAppear(mkChip(C.width / 2 + 128, 436, 'MEILLEUR SCORE', String(best)), 0.46, 12);

    // --- v2 : MENTION TRES HONORABLE (or partout + jury battu) -------------
    //  Banniere doree TOUT EN HAUT (le bas est occupe par la plaque-diplome).
    if (hasMention(SAVE)) {
      uiAppear(uiPill(C.width / 2, 26, 470, 34, UI.GOLD, 0.94, 17, 3), 0.52, -10);
      uiAppear(uiText(C.story.mention, C.width / 2, 26, 18, UI.NIGHT, { outline: 0, z: 7 }), 0.55, -10);
      if (hasSprite('trophy_mention')) {
        uiAppear(add([sprite('trophy_mention'), pos(C.width / 2 - 268, 26), anchor('center'), artScale(0.6), z(7)]), 0.58, -10);
        uiAppear(add([sprite('trophy_mention'), pos(C.width / 2 + 268, 26), anchor('center'), artScale(0.6), z(7)]), 0.58, -10);
      }
    }

    uiPrompt(C.story.retry, C.width / 2, 490, 0.58);
    const again = () => go('overworld');
    onConfirm(again); onClick(again); onBack(again);
  });

  scene('lose', (data) => {
    playMusic((C.music || {}).lose);
    setCam(C.width / 2, C.height / 2);
    add([rect(C.width, C.height), pos(0, 0), color(90, 110, 130)]);
    add([sprite('hero_hurt'), pos(C.width / 2, 200), anchor('center'), artScale(1.6)]).play('hurt');
    bigText(C.story.lose, 300, 28, [255, 255, 255]);
    bigText('SCORE : ' + (data ? data.score : 0), 350, 24, [255, 226, 120]);
    bigText(C.story.retry, 420, 22, [255, 255, 255]);
    const again = () => go(SAVE ? 'overworld' : 'title');
    onConfirm(again); onClick(again); onBack(again);
  });

  // debug handle
  window.LQ = {
    get player() { return PLAYER; }, get level() { return LEVEL; }, get save() { return SAVE; },
    // debug : abat le i-eme passant a l'ecran (teste le cadavre) ; sans arg, tous
    kill: (i) => { const l = get('passant'); (i == null ? l : [l[i]]).forEach((e) => e && e.exists() && hitEnemy(e, { dmg: 99 })); },
    // debug : bulle BD immediate sur le i-eme passant (0 par defaut) ; phrase du
    //  registre js/npc.js si le PNJ en a, sinon une phrase de test
    bubble: (i, txt) => { const e = get('passant')[i || 0]; if (!e) return null; const ph = npcPhrases(e); return npcBubble(e, txt || (ph ? ph[0] : 'Coucou Laura !'), 6); },
    // debug : lache une bombe sur la colonne du joueur (teste chute/ombre/souffle)
    bomb: (delay) => { if (PLAYER && PLAYER.exists()) dropBomb(PLAYER.pos.x, PLAYER.pos.y, delay || 0.9, 'shot_bomb'); },
  };

  // --- GO ! ------------------------------------------------------------
  if (typeof location !== 'undefined' && location.hash.indexOf('game') >= 0) {
    SLOT = 0; SAVE = SAVEAPI.load(0) || SAVEAPI.fresh('DEV');
    // #game (niveau 1), #gameauto (autopilote), ou cible : #game/niveau4, #gamejury...
    const m = location.hash.match(/(niveau[1-9]|jury)/);
    go('game', (m && C.levels.indexOf(m[1]) >= 0) ? m[1] : C.levels[0]);
  } else if (typeof location !== 'undefined' && location.hash.indexOf('map') >= 0) {
    SLOT = 0; SAVE = SAVEAPI.load(0) || SAVEAPI.fresh('DEV');   // #map : carte du monde (dev)
    go('overworld');
  } else if (typeof location !== 'undefined' && location.hash.indexOf('winscreen') >= 0) {
    SLOT = 0; SAVE = SAVEAPI.fresh('DEV');   // #winscreen : apercu ecran soutenance (save jetable, non persistee)
    SAVE.levelsDone.fill(true); SAVE.publis.fill(true); SAVE.dataPct.fill(100); SAVE.juryDone = true; SAVE.bestScore = 4200;
    SAVE.medals = SAVE.medals.map((_, i) => (i < SAVEAPI.N_LEVELS) ? { t: 3, d: 3, s: 3 } : { t: 3 });  // apercu MENTION
    go('win', { score: 4200 });
  } else if (typeof location !== 'undefined' && location.hash.indexOf('chapterscreen') >= 0) {
    SLOT = 0; SAVE = SAVEAPI.fresh('DEV');   // #chapterscreen[0-4] : apercu ecran chapitre (save jetable)
    const cm = location.hash.match(/chapterscreen([0-4])/); const ci = cm ? parseInt(cm[1], 10) : 1;
    for (let i = 0; i <= ci; i++) SAVE.levelsDone[i] = true;
    if (ci % 2 === 0) SAVE.publis[ci] = true;
    go('chapter', { idx: ci, score: 1500,        // apercu : medailles factices (recap v2)
      meds: { t: 2, d: 3, s: 1 }, tsec: 137, pct: 100, savedPct: 40,
      par: { or: 115, argent: 175, bronze: 255 }, feli: true });
  } else {
    go('title');
  }
})();
