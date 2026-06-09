/* =====================================================================
 *  BOSSES — Une IA de boss differente par niveau.
 *  game.js appelle BOSS_AI[def.behavior](b, p, api) a chaque frame.
 *    b   = entite boss (b.def, b.hp, b.maxHp, b.t, b.homeX, b.pos...)
 *    p   = joueur
 *    api = { TS, bullet(x,y,target,speed,kind), add(kind,x,y), shake(n), poof(x,y),
 *            marker(x,y,dur) = zone d'impact au sol pour telegraphier une chute }
 *  Convention : chaque IA pose b.animWant = 'idle' | 'attack' | 'hurt'
 *  (game.js lit ce champ pour jouer l'animation du boss).
 *
 *  PHILOSOPHIE DE DESIGN (appliquee a tous) :
 *   1. TELEGRAPHE lisible avant chaque attaque (recul, shake, poof, pose
 *      'attack', courte pause) -> Laura voit venir le danger.
 *   2. FENETRE DE PUNITION recurrente : un moment ou le boss est immobile
 *      et vulnerable (idle/hurt) pour que Laura approche et tape.
 *   3. IDENTITE : chaque boss joue differemment (machine a etats dediee).
 *   4. RYTHME : on alterne phases d'agression et phases de repit.
 *
 *  Chaque IA est une machine a etats. Le timing passe par des
 *  accumulateurs (b.ct += dt()) car il n'y a pas de wait() global.
 *  Toutes les durees/reglages se lisent en "b.def.X || <defaut>" pour
 *  rester robustes meme si CONFIG.bosses ne definit pas le champ.
 *  Le boss reste TOUJOURS dans l'arene (homeX +/- range) sinon il
 *  devient injoignable et le niveau se bloque.
 * ===================================================================== */
window.BOSS_AI = (() => {
  'use strict';
  const TS = window.CONFIG.tileSize;

  // --- helpers communs -------------------------------------------------
  function faceOnly(b, p) {
    b.facing = (p.pos.x - b.pos.x) >= 0 ? 1 : -1;
    b.flipX = b.facing > 0;          // sprites boss dessines pointant a gauche
  }
  // avance vers le joueur en restant dans l'arene (autour de homeX)
  function moveClamp(b, p, spd) {
    if (Math.abs(p.pos.x - b.homeX) < 640 && Math.abs(b.pos.x - b.homeX) < b.def.range) {
      b.move(Math.sign(p.pos.x - b.pos.x) * spd, 0);
    }
  }
  // deplacement horizontal libre borne a l'arene (utilise pour dash/drive/tp)
  function moveDirClamp(b, dir, spd) {
    const nx = b.pos.x + dir * spd * dt();
    if (Math.abs(nx - b.homeX) < b.def.range) b.move(dir * spd, 0);
    return Math.abs(b.pos.x - b.homeX) >= b.def.range; // true = bord atteint
  }
  // borne dure de la position au cas ou (securite anti-sortie d'arene)
  function clampHome(b) {
    const r = b.def.range || 360;
    if (b.pos.x < b.homeX - r) b.pos.x = b.homeX - r;
    if (b.pos.x > b.homeX + r) b.pos.x = b.homeX + r;
  }
  // tir vise le joueur, avec un ecart angulaire "spread" (radians)
  function shoot(b, p, api, speed, spread) {
    const base = p.pos.sub(b.pos.add(0, -api.TS)).unit();
    const c = Math.cos(spread), s = Math.sin(spread);
    const d = vec2(base.x * c - base.y * s, base.x * s + base.y * c);
    api.bullet(b.pos.x, b.pos.y - api.TS, { pos: b.pos.add(d.scale(100)) }, speed, 'boss');
  }
  // tir dans une DIRECTION precise (dir = vec2 unitaire), pas vers le joueur
  function shootDir(b, api, dir, speed, kind) {
    api.bullet(b.pos.x, b.pos.y - api.TS, { pos: b.pos.add(dir.scale(100)) }, speed, kind || 'boss');
  }
  // jet en cloche (biais vers le haut) : piquets / fourches
  function lob(b, p, api, spread) {
    const sp = b.def.shotSpeed || 220;
    const base = p.pos.sub(b.pos.add(0, -api.TS)).unit();
    const up = vec2(base.x, base.y - 0.7).unit();
    const c = Math.cos(spread), s = Math.sin(spread);
    const d = vec2(up.x * c - up.y * s, up.x * s + up.y * c);
    api.bullet(b.pos.x, b.pos.y - api.TS, { pos: b.pos.add(d.scale(100)) }, sp * 0.85, 'boss');
  }
  // danger qui tombe sur une colonne VERROUILLEE (x, sol fige a l'instant du tell).
  //  Trajectoire strictement verticale -> coherente avec le marqueur au sol.
  function skyHazard(api, atX, groundY) {
    api.bullet(atX, groundY - 380, { pos: vec2(atX, groundY + 400) }, 320, 'enemy');
  }

  // SPAWN-EN-FACE (dette tech 3) : pose un minion ENTRE le boss et le joueur
  //  (jamais derriere la camera) + poof de telegraphe. Clampe a l'arene.
  function spawnEnFace(b, p, api, kind) {
    const r = b.def.range || 360;
    let x = (b.pos.x + p.pos.x) / 2;
    x = Math.max(b.homeX - r, Math.min(b.homeX + r, x));
    api.poof(x, b.pos.y - api.TS);
    api.add(kind, x, b.pos.y - api.TS);
  }

  // TRIPLE-SHOOT : 3 bullets HORIZONTAUX vers le joueur a 3 hauteurs.
  //  haut (passe au-dessus) / MILIEU (hauteur torse = DUCKABLE) / bas.
  //  Le joueur se baisse pour esquiver le tir du milieu.
  function tripleShoot(b, p, api, speed) {
    const sp = speed || 255;
    const dir = Math.sign(p.pos.x - b.pos.x) || -1;
    const ys = [b.pos.y - TS * 1.3, b.pos.y - TS * 0.6, b.pos.y - TS * 0.12];
    for (const y of ys) {
      api.bullet(b.pos.x, y, { pos: vec2(b.pos.x + dir * 600, y) }, sp, 'boss');
    }
  }

  const AI = {};

  // --- defaut : tir en eventail + avance lente (filet de securite) -----
  AI.default = function (b, p, api) {
    faceOnly(b, p); moveClamp(b, p, b.def.speed);
    b.animWant = 'idle';
    b.t += dt();
    if (b.t >= b.def.shotEvery) {
      b.t = 0; b.animWant = 'attack';
      [-0.18, 0, 0.18].forEach((s) => shoot(b, p, api, b.def.shotSpeed, s));
    }
  };

  /* =====================================================================
   *  PROPRIETAIRE TERRIEN — 1er boss, le plus FACILE (pedagogique).
   *  Machine a etats lisible : pace -> wind -> dash -> stagger -> throw.
   *  Apprend a Laura : "telegraphe -> esquive -> punition".
   * ===================================================================== */
  AI.charger = function (b, p, api) {
    if (b.cs === undefined) { b.cs = 'pace'; b.ct = 0; b.dashDir = -1; b.cyc = 0; b.shotDone = false; }
    b.ct += dt();
    const paceT = b.def.paceTime || 1.0;
    const windT = b.def.windTime || 0.7;
    const dashT = b.def.dashTime || 0.9;
    const stagT = b.def.staggerTime || 1.2;
    const throwT = b.def.throwTime || 0.5;
    const dashSpd = b.def.dashSpeed || 520;
    const shotSpeed = b.def.shotSpeed || 255;

    if (b.cs === 'pace') {
      // approche lente, regarde le joueur, prepare la charge. 1 fois sur 2,
      //  apres un court telegraphe, tire un TRIPLE missile (milieu = duckable).
      faceOnly(b, p);
      moveClamp(b, p, (b.def.speed || 90) * 0.6);
      if (b.cyc % 2 === 1) {
        // cycle de tir : breve pose 'attack' (~0.2s) puis triple horizontal
        b.animWant = (b.ct < 0.2) ? 'attack' : 'idle';
        if (!b.shotDone && b.ct >= 0.2) { tripleShoot(b, p, api, shotSpeed); b.shotDone = true; }
      } else {
        b.animWant = 'idle';
      }
      if (b.ct > paceT) {
        b.cs = 'wind'; b.ct = 0; b.cyc++; b.shotDone = false;
        b.dashDir = Math.sign(p.pos.x - b.pos.x) || -1;  // verrouille la cible
      }
    } else if (b.cs === 'wind') {
      // TELEGRAPHE net : se cabre (recule a l'oppose), tremble
      b.animWant = 'attack';
      faceOnly(b, p);
      b.move(-b.dashDir * 70, 0);
      if (b.ct < 0.06) api.shake(2);
      if (b.ct > windT) {
        b.cs = 'dash'; b.ct = 0; api.shake(4);
        // SEISME LOCALISE : cracks au sol au depart du dash
        api.poof(b.pos.x, b.pos.y); api.poof(b.pos.x - 22, b.pos.y); api.poof(b.pos.x + 22, b.pos.y);
      }
    } else if (b.cs === 'dash') {
      // ruee a pleine vitesse dans la direction verrouillee : seisme localise
      //  (shake continu) + contact (gere par le contact-damage normal du boss).
      b.animWant = 'attack';
      const edge = moveDirClamp(b, b.dashDir, dashSpd);
      api.shake(1);
      if (edge || b.ct > dashT) { b.cs = 'stagger'; b.ct = 0; api.poof(b.pos.x, b.pos.y); }
    } else if (b.cs === 'stagger') {
      // ESSOUFFLE : totalement immobile -> FENETRE DE PUNITION
      b.animWant = 'hurt';
      if (b.ct < 0.06) { api.poof(b.pos.x, b.pos.y); api.poof(b.pos.x - 20, b.pos.y - 10); }
      if (b.ct > stagT) { b.cs = 'throw'; b.ct = 0; }
    } else {
      // jette un eventail de 3 piquets puis repart en pace
      b.animWant = 'attack';
      faceOnly(b, p);
      if (b.ct < 0.06) [-0.22, 0, 0.22].forEach((s) => lob(b, p, api, s));
      if (b.ct > throwT) { b.cs = 'pace'; b.ct = 0; b.cyc++; b.shotDone = false; }
    }
    clampHome(b);
  };

  /* =====================================================================
   *  AGRICULTEUR FOU — tracteur en va-et-vient + fourches + dangers ciel.
   *  Cycle : rev (rev moteur, telegraphe) -> drive (traverse l'arene en
   *  semant fourches & chutes) -> stall (moteur cale = punition).
   * ===================================================================== */
  AI.tracteur = function (b, p, api) {
    if (b.ts === undefined) { b.ts = 'rev'; b.tt = 0; b.dir = -1; b.skyT = 0; }
    b.tt += dt();
    const revT = b.def.revTime || 0.5;
    const stallT = b.def.stallTime || 1.8;
    const driveSpd = b.def.driveSpeed || (b.def.speed || 120) * 1.6;
    const skyEvery = b.def.skyEvery || 2.2;     // cadence des bombes en drive
    const skyDelay = b.def.skyDelay || 0.8;     // fenetre de telegraphe (ombre qui grandit)
    const skyMinDist = b.def.skyMinDist || 160; // bombe SEULEMENT si joueur a distance

    if (b.ts === 'rev') {
      // TELEGRAPHE : choisit la direction, fait vrombir (shake), reste sur place
      faceOnly(b, p);
      b.animWant = 'attack';
      // vise le joueur si loin, sinon repart vers le centre pour ne pas se coincer
      if (b.tt < 0.06) {
        const towardP = Math.sign(p.pos.x - b.pos.x) || -1;
        const towardHome = Math.sign(b.homeX - b.pos.x) || -1;
        b.dir = (Math.abs(b.pos.x - b.homeX) > b.def.range * 0.7) ? towardHome : towardP;
        api.shake(2);
      }
      if (b.tt > revT) { b.ts = 'drive'; b.tt = 0; b.skyT = 0; }
    } else if (b.ts === 'drive') {
      // traverse l'arene a fond, lache des BOMBES verticales telegraphees
      b.animWant = 'attack';
      b.flipX = b.dir > 0;             // oriente le tracteur dans le sens de marche
      b.facing = b.dir;
      const edge = moveDirClamp(b, b.dir, driveSpd);
      b.skyT += dt();
      if (b.skyT >= skyEvery) {
        b.skyT = 0;
        if (Math.abs(p.pos.x - b.pos.x) > skyMinDist) {
          // bombe qui tombe sur la position du joueur : ombre qui grandit (telegraphe
          //  skyDelay) puis explose. Esquive : dash/saut lateral sous la bombe.
          api.dropBomb(p.pos.x, p.pos.y, skyDelay, 'shot_bomb');
        }
      }
      if (edge) { b.ts = 'stall'; b.tt = 0; }
    } else {
      // MOTEUR CALE : immobile, fume -> FENETRE DE PUNITION
      faceOnly(b, p);
      b.animWant = 'idle';
      if (b.tt < 0.06) { api.poof(b.pos.x, b.pos.y - api.TS); api.poof(b.pos.x + 14, b.pos.y - api.TS - 18); }
      if (b.tt > stallT) { b.ts = 'rev'; b.tt = 0; b.dir = -b.dir; }  // repart en sens inverse
    }
    clampHome(b);
  };

  /* =====================================================================
   *  MICHAEL DINGKHUN — chercheur dangereux (modeles stats).
   *  Force le combat A DISTANCE : garde ses distances, alterne tir vise
   *  serre ("modele cale") et large vague lente ("bruit"), spawn des
   *  chercheurs, et marque une fenetre "recalcul" ou il ne tire pas.
   *  Cycle : aim -> burst/wave -> recalc.
   * ===================================================================== */
  AI.modeles = function (b, p, api) {
    if (b.ms === undefined) { b.ms = 'aim'; b.mt = 0; b.cyc = 0; b.threw = false; }
    faceOnly(b, p);
    b.mt += dt();
    const aimT = b.def.aimTime || 1.0;
    const recalcT = b.def.recalcTime || 1.0;
    const keepMin = b.def.keepMin || 220;    // distance mini avant de reculer
    const keepMax = b.def.keepMax || 440;    // distance maxi avant d'avancer
    const sp = b.def.shotSpeed || 220;

    // REPOSITIONNEMENT permanent : garde la bonne distance (combat a distance)
    const dx = p.pos.x - b.pos.x;
    const dist = Math.abs(dx);
    if (dist < keepMin) { moveDirClamp(b, -Math.sign(dx) || 1, (b.def.speed || 90) * 0.8); }
    else if (dist > keepMax) { moveDirClamp(b, Math.sign(dx) || -1, (b.def.speed || 90) * 0.5); }

    if (b.ms === 'aim') {
      // verrouille la visee : pose idle marquee (telegraphe)
      b.animWant = 'idle';
      if (b.mt > aimT) {
        b.mt = 0; b.threw = false;
        b.cyc++;
        // 1 cycle sur 3 = OVERLOAD (eventail telegraphe), sinon BOMBE EN PAPIER.
        b.ms = (b.cyc % 3 === 0) ? 'overload' : 'throw';
      }
    } else if (b.ms === 'throw') {
      // BOMBE EN PAPIER : memo froisse qui tombe sur la position du joueur ->
      //  le force a BOUGER lateralement (ombre qui grandit = telegraphe).
      b.animWant = 'attack';
      if (!b.threw) { b.threw = true; api.dropBomb(p.pos.x, p.pos.y, 0.7, 'shot_paper'); }
      if (b.mt > 0.5) { b.ms = 'recalc'; b.mt = 0; }
    } else if (b.ms === 'overload') {
      // OVERLOAD : telegraphe (shake) puis eventail de 3 tirs VISES (corrige le
      //  bug "tire dans le sol" : shoot() vise bien le joueur depuis le torse).
      b.animWant = 'attack';
      if (!b.threw && b.mt < 0.06) { api.shake(4); }
      if (!b.threw && b.mt > 0.3) {
        b.threw = true;
        [-0.2, 0, 0.2].forEach((s) => shoot(b, p, api, sp, s));
      }
      if (b.mt > 0.6) { b.ms = 'recalc'; b.mt = 0; }
    } else {
      // RECALCUL : ne tire plus -> FENETRE DE PUNITION (spawn occasionnel)
      b.animWant = 'idle';
      if (b.mt < 0.06 && (b.cyc % 3 === 1)) spawnEnFace(b, p, api, 'cafard');
      if (b.mt > recalcT) { b.ms = 'aim'; b.mt = 0; }
    }
    clampHome(b);
  };

  /* =====================================================================
   *  RSTUDIO — erreurs / bugs. Alternance attack <-> loading (gardee).
   *  En plus : UNE fois par phase attack, un "stack trace" = mur VERTICAL
   *  de projectiles avec UN TROU aligne loin du joueur (a esquiver en se
   *  placant dans le trou). Telegraphe par shake + poof.
   * ===================================================================== */
  AI.errors = function (b, p, api) {
    faceOnly(b, p);
    if (b.state === undefined) { b.state = 'fire'; b.st = 0; b.t = 0; b.burst = 0; b.summoned = false; }
    b.st += dt();
    const attackT = b.def.attackTime || 2.5;   // FIRE : 3 salves de tripleShoot
    const summonT = b.def.summonTime || 2.0;   // SUMMON : cafards fragiles
    const loadT = b.def.loadTime || 1.5;       // LOAD : punition
    const burstGap = b.def.burstGap || 0.8;
    const sp = b.def.shotSpeed || 255;

    if (b.state === 'fire') {
      // 3 salves de tripleShoot horizontal espacees de burstGap (le joueur
      //  esquive en se baissant sous le tir du milieu / dash lateral).
      b.animWant = 'attack';
      const need = Math.min(3, Math.floor(b.st / burstGap) + 1);
      while (b.burst < need && b.burst < 3) {
        tripleShoot(b, p, api, sp);
        b.burst++;
      }
      if (b.st > attackT) { b.state = 'summon'; b.st = 0; b.summoned = false; }
    } else if (b.state === 'summon') {
      // invoque des cafards TRES fragiles (1 PV) en face du joueur ; +1 si bas HP.
      b.animWant = 'idle';
      if (!b.summoned && b.st < 0.06) {
        b.summoned = true;
        const n = (b.hp / b.maxHp < 0.5) ? 3 : 2;
        for (let i = 0; i < n; i++) spawnEnFace(b, p, api, 'cafard');
      }
      if (b.st > summonT) { b.state = 'load'; b.st = 0; b.burst = 0; }
    } else {
      // LOAD ("loading...") : ne tire plus, immobile -> FENETRE DE PUNITION
      b.animWant = 'idle';
      if (b.st > loadT) { b.state = 'fire'; b.st = 0; b.burst = 0; }
    }
    clampHome(b);
  };

  /* =====================================================================
   *  CENDRINE la secretaire — le boss le plus DUR des 5.
   *  Teleportation TELEGRAPHEE (poof a la destination future) + eventail
   *  de formulaires + tampon qui tombe du ciel. Fenetre de vulnerabilite
   *  apres chaque salve. Cycle : pre -> tp -> throw -> window.
   * ===================================================================== */
  AI.paperasse = function (b, p, api) {
    if (b.ps === undefined) { b.ps = 'pre'; b.pt = 0; b.destX = b.homeX; b.threw = false; }
    if (b._baseScale === undefined) { b._baseScale = b.scale ? b.scale.clone() : vec2(1, 1); }
    b.pt += dt();
    const preT = b.def.preTime || 0.4;
    const imploT = b.def.implodeTime || 0.18;   // duree de l'implosion spectaculaire
    const throwT = b.def.throwTime || 0.3;
    const windowT = b.def.windowTime || 1.2;
    const formN = b.def.formN || 4;
    const sp = b.def.shotSpeed || 220;
    const range = b.def.range || 360;

    if (b.ps === 'pre') {
      // choisit la destination (clampee a l'ecran, ELOIGNEE du joueur >=200px)
      //  et la TELEGRAPHE (poof a l'avance).
      faceOnly(b, p);
      b.animWant = 'idle';
      if (b.pt < 0.06) {
        let dx = b.homeX + rand(-range, range);
        if (Math.abs(dx - p.pos.x) < 200) dx = p.pos.x + (dx >= p.pos.x ? 200 : -200);
        b.destX = Math.max(b.homeX - range, Math.min(b.homeX + range, dx));
        api.poof(b.destX, b.pos.y - api.TS);   // fantome a la future place
      } else if (b.pt > preT * 0.5) {
        api.poof(b.destX, b.pos.y - api.TS);   // re-pulse pour appuyer le telegraphe
      }
      if (b.pt > preT) { b.ps = 'implosion'; b.pt = 0; }
    } else if (b.ps === 'implosion') {
      // TELEPORT SPECTACULAIRE : le boss implose (scale->0 + clignote) sur place,
      //  poof dense, puis reapparait a destX en flash, restaure scale/opacite.
      faceOnly(b, p);
      b.animWant = 'idle';
      const k = Math.min(1, b.pt / imploT);
      const s = 1 - k;
      b.scale = b._baseScale.scale(s);
      b.opacity = (Math.floor(b.pt * 40) % 2 === 0) ? 0.35 : 1;
      if (b.pt < 0.04) { api.poof(b.pos.x, b.pos.y - api.TS); api.poof(b.pos.x - 16, b.pos.y - api.TS - 12); }
      if (b.pt >= imploT) {
        // TP effectif : flash a l'arrivee, restaure l'echelle/l'opacite.
        b.pos.x = b.destX;
        b.scale = b._baseScale.clone();
        b.opacity = 1;
        api.poof(b.pos.x, b.pos.y - api.TS); api.poof(b.pos.x + 16, b.pos.y - api.TS - 12);
        faceOnly(b, p);
        b.ps = 'throw'; b.pt = 0; b.threw = false;
      }
    } else if (b.ps === 'throw') {
      // eventail de formulaires + TAMPON-PIEGE au sol (zone interdite 2.5s,
      //  telegraphe 0.5s) sur la position du joueur -> on dash a l'oppose.
      b.animWant = 'attack';
      faceOnly(b, p);
      if (!b.threw) {
        b.threw = true;
        const half = (formN - 1) / 2;
        for (let i = 0; i < formN; i++) shoot(b, p, api, sp, (i - half) * 0.16);
        api.hazard(p.pos.x, p.pos.y, 2.5, 0.5);
        api.shake(2);
      }
      if (b.pt > throwT) { b.ps = 'window'; b.pt = 0; }
    } else {
      // FENETRE DE PUNITION : vulnerable, immobile (plus d'huissiers)
      b.animWant = 'idle';
      faceOnly(b, p);
      if (b.pt > windowT) { b.ps = 'pre'; b.pt = 0; }
    }
    clampHome(b);
  };

  /* =====================================================================
   *  JURY DE THESE — megaboss final, 3 phases selon HP.
   *   >66%  (calme, Q&A)      : volees visees, deplacement lent, eventails 3.
   *   33-66% (debat)          : + minions chercheurs + salves en ANNEAU.
   *   <33%  (verdict/panique) : pluie de dangers du ciel + larges eventails
   *                             plus rapides + shake.
   *  Telegraphe d'"enrage" (shake + breve pose) au franchissement de seuil.
   * ===================================================================== */
  AI.jury = function (b, p, api) {
    faceOnly(b, p);
    if (b.jPhase === undefined) { b.jPhase = 0; b.t = 0; b.cyc = 0; b.enrage = 0; }
    const frac = b.hp / b.maxHp;
    const phase = frac > 0.66 ? 0 : (frac > 0.33 ? 1 : 2);
    const sp = b.def.shotSpeed || 220;
    const baseEvery = b.def.shotEvery || 1.4;
    const range = b.def.range || 360;

    // --- detection de transition de phase : petite pose d'enrage ---
    if (phase !== b.jPhase) {
      b.jPhase = phase;
      b.enrage = b.def.enrageTime || 0.7;     // declenche le telegraphe
      api.shake(6);
    }
    if (b.enrage > 0) {
      b.enrage -= dt();
      b.animWant = 'attack';                  // pose marquee, pas de tir
      if (b.enrage > (b.def.enrageTime || 0.7) - 0.1) api.shake(4);
      b.t = 0;
      return;                                 // on saute l'attaque pendant l'enrage
    }

    moveClamp(b, p, (b.def.speed || 90) * (phase === 0 ? 0.4 : 0.55));
    b.animWant = 'idle';
    b.t += dt();
    const every = (phase === 0) ? baseEvery : (phase === 1 ? baseEvery * 0.75 : baseEvery * 0.55);

    if (b.t >= every) {
      b.t = 0; b.animWant = 'attack'; b.cyc++;

      if (phase === 0) {
        // Q&A calme : eventail vise de 3
        [-0.14, 0, 0.14].forEach((s) => shoot(b, p, api, sp, s));
      } else if (phase === 1) {
        // debat : eventail de 5 + un anneau de 8 un coup sur deux + minion fragile
        const half = 2;
        for (let i = 0; i < 5; i++) shoot(b, p, api, sp, (i - half) * 0.14);
        if (b.cyc % 2 === 0) {
          const ringN = b.def.ringN || 8;
          for (let i = 0; i < ringN; i++) {
            const a = (i / ringN) * Math.PI * 2;
            shootDir(b, api, vec2(Math.cos(a), Math.sin(a)), sp * 0.7, 'boss');
          }
          api.shake(2);
        }
        if (b.cyc % 3 === 0) spawnEnFace(b, p, api, 'bug');   // vrai minion fragile (pas de passant)
      } else {
        // verdict / panique : large eventail rapide + bombes + MUR A TROU a dasher.
        const n = b.def.panicN || 7;
        const half = (n - 1) / 2;
        for (let i = 0; i < n; i++) shoot(b, p, api, sp * 1.1, (i - half) * 0.16);
        api.dropBomb(p.pos.x, p.pos.y, 0.6, 'shot_bomb');
        if (b.cyc % 2 === 0) api.dropBomb(b.pos.x + rand(-range, range), p.pos.y, 0.6, 'shot_bomb');
        // MUR A TROU (dash-pertinent) : colonne verticale de bullets avec UN trou
        //  (~1.5 tile) annonce par poof -> Laura dash dans le trou.
        if (b.cyc % 2 === 1) {
          const wallX = b.pos.x - b.facing * (b.def.range || 360) * 0.5;
          const gapY = p.pos.y - api.TS * (1 + rand(0, 1.5));   // hauteur du trou
          api.poof(wallX, gapY);                                // annonce du trou
          const top = b.pos.y - api.TS * 6, bot = b.pos.y + api.TS * 0.5, step = api.TS * 0.75;
          for (let y = top; y <= bot; y += step) {
            if (Math.abs(y - gapY) < api.TS * 0.75) continue;   // laisse le trou (~1.5 tile)
            api.bullet(wallX, y, { pos: vec2(wallX + b.facing * 600, y) }, sp * 0.9, 'boss');
          }
          // tampon-piege au sol pour densifier l'area denial
          api.hazard(p.pos.x, p.pos.y, 2.0, 0.5);
        }
        api.shake(3);
      }
    }
    clampHome(b);
  };

  return AI;
})();
