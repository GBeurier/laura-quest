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
    if (b.cs === undefined) { b.cs = 'pace'; b.ct = 0; b.dashDir = -1; }
    b.ct += dt();
    const paceT = b.def.paceTime || 1.0;
    const windT = b.def.windTime || 0.7;
    const dashT = b.def.dashTime || 0.9;
    const stagT = b.def.staggerTime || 1.2;
    const throwT = b.def.throwTime || 0.5;
    const dashSpd = b.def.dashSpeed || 520;

    if (b.cs === 'pace') {
      // approche lente, regarde le joueur, prepare la charge
      faceOnly(b, p);
      b.animWant = 'idle';
      moveClamp(b, p, (b.def.speed || 90) * 0.6);
      if (b.ct > paceT) {
        b.cs = 'wind'; b.ct = 0;
        b.dashDir = Math.sign(p.pos.x - b.pos.x) || -1;  // verrouille la cible
      }
    } else if (b.cs === 'wind') {
      // TELEGRAPHE net : se cabre (recule a l'oppose), tremble
      b.animWant = 'attack';
      faceOnly(b, p);
      b.move(-b.dashDir * 70, 0);
      if (b.ct < 0.06) api.shake(2);
      if (b.ct > windT) { b.cs = 'dash'; b.ct = 0; api.shake(4); }
    } else if (b.cs === 'dash') {
      // ruee a pleine vitesse dans la direction verrouillee
      b.animWant = 'attack';
      const edge = moveDirClamp(b, b.dashDir, dashSpd);
      if (b.ct < 0.06 || (b.cyc = (b.cyc || 0) + 1) % 8 === 0) api.shake(1);
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
      if (b.ct > throwT) { b.cs = 'pace'; b.ct = 0; }
    }
    clampHome(b);
  };

  /* =====================================================================
   *  AGRICULTEUR FOU — tracteur en va-et-vient + fourches + dangers ciel.
   *  Cycle : rev (rev moteur, telegraphe) -> drive (traverse l'arene en
   *  semant fourches & chutes) -> stall (moteur cale = punition).
   * ===================================================================== */
  AI.tracteur = function (b, p, api) {
    if (b.ts === undefined) { b.ts = 'rev'; b.tt = 0; b.dir = -1; b.forkT = 0; b.skyT = 0; }
    b.tt += dt();
    const revT = b.def.revTime || 0.5;
    const stallT = b.def.stallTime || 1.5;
    const driveSpd = b.def.driveSpeed || (b.def.speed || 120) * 1.6;
    const forkEvery = b.def.forkEvery || 0.45;
    const skyEvery = b.def.skyEvery || 2.0;     // (B) cadence calmee (etait 1.1)
    const skyDelay = b.def.skyDelay || 0.6;     // (A) fenetre de telegraphe lisible
    const skyMinDist = b.def.skyMinDist || 150; // (B) chute SEULEMENT si joueur a distance

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
      if (b.tt > revT) { b.ts = 'drive'; b.tt = 0; b.forkT = 0; b.skyT = 0; }
    } else if (b.ts === 'drive') {
      // traverse l'arene a fond, seme fourches + dangers du ciel telegraphes
      b.animWant = 'attack';
      b.flipX = b.dir > 0;             // oriente le tracteur dans le sens de marche
      b.facing = b.dir;
      const edge = moveDirClamp(b, b.dir, driveSpd);
      b.forkT += dt();
      if (b.forkT >= forkEvery) { b.forkT = 0; lob(b, p, api, rand(-0.15, 0.15)); }
      b.skyT += dt();
      if (b.skyT >= skyEvery) {
        if (Math.abs(p.pos.x - b.pos.x) > skyMinDist) {
          // (A) telegraphe : colonne ET sol VERROUILLES maintenant (plus de drift),
          //  marqueur au sol au point d'impact, puis chute apres skyDelay.
          b.skyT = -skyDelay;          // delai negatif = fenetre d'alerte avant la chute
          b._skyX = p.pos.x;
          b._skyY = p.pos.y;
          api.marker(b._skyX, b._skyY, skyDelay);
        } else {
          b.skyT = 0;                  // (B) joueur au contact -> on reporte (pas de spam)
        }
      } else if (b.skyT >= 0 && b._skyX !== undefined) {
        skyHazard(api, b._skyX, b._skyY); api.shake(2); b._skyX = undefined;
      }
      if (edge) { b.ts = 'stall'; b.tt = 0; b._skyX = undefined; }
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
    if (b.ms === undefined) { b.ms = 'aim'; b.mt = 0; b.cyc = 0; b.shotN = 0; }
    faceOnly(b, p);
    b.mt += dt();
    const aimT = b.def.aimTime || 0.6;
    const recalcT = b.def.recalcTime || 1.0;
    const burstGap = b.def.burstGap || 0.16;
    const idealMin = b.def.keepMin || 200;   // distance mini avant de reculer
    const idealMax = b.def.keepMax || 420;   // distance maxi avant d'avancer
    const sp = b.def.shotSpeed || 220;

    // REPOSITIONNEMENT permanent : garde la bonne distance (combat a distance)
    const dx = p.pos.x - b.pos.x;
    const dist = Math.abs(dx);
    if (dist < idealMin) { moveDirClamp(b, -Math.sign(dx) || 1, (b.def.speed || 90) * 0.8); }
    else if (dist > idealMax) { moveDirClamp(b, Math.sign(dx) || -1, (b.def.speed || 90) * 0.5); }

    if (b.ms === 'aim') {
      // verrouille la visee : pose idle marquee (telegraphe)
      b.animWant = 'idle';
      if (b.mt > aimT) {
        b.mt = 0; b.shotN = 0;
        b.cyc++;
        // une vague de bruit un cycle sur deux, sinon salve visee
        b.ms = (b.cyc % 2 === 0) ? 'wave' : 'burst';
        if (b.ms === 'wave') {
          // large arc de 5-7 tirs LENTS a slalomer (le "bruit du modele")
          const n = b.def.waveN || 6;
          const half = (n - 1) / 2;
          for (let i = 0; i < n; i++) shoot(b, p, api, sp * 0.6, (i - half) * 0.22);
          api.shake(1);
          b.ms = 'recalc'; b.mt = 0;
        }
      }
    } else if (b.ms === 'burst') {
      // salve serree de 3 tirs VISES, espaces dans le temps
      b.animWant = 'attack';
      const need = Math.floor(b.mt / burstGap);
      while (b.shotN < need && b.shotN < 3) {
        shoot(b, p, api, sp, rand(-0.05, 0.05));
        b.shotN++;
      }
      if (b.shotN >= 3) { b.ms = 'recalc'; b.mt = 0; }
    } else {
      // RECALCUL : ne tire plus -> FENETRE DE PUNITION
      b.animWant = 'idle';
      if (b.mt < 0.06 && (b.cyc % 3 === 0)) api.add('chercheur', b.pos.x, b.pos.y - api.TS);
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
    if (b.state === undefined) { b.state = 'attack'; b.st = 0; b.t = 0; b.cyc = 0; b.wall = 0; }
    b.st += dt();
    const attackT = b.def.attackTime || 4;
    const loadT = b.def.loadTime || 2;
    const shotEvery = b.def.shotEvery || 0.7;
    const sp = b.def.shotSpeed || 220;

    if (b.state === 'attack') {
      b.animWant = 'attack';
      moveClamp(b, p, (b.def.speed || 90) * 0.5);
      b.t += dt();
      if (b.t >= shotEvery) {
        b.t = 0;
        [-0.25, 0, 0.25].forEach((s) => shoot(b, p, api, sp, s));
        b.cyc++;
        if (b.cyc % 3 === 0) api.add('bug', b.pos.x, b.pos.y - api.TS);
      }

      // STACK TRACE : une fois par phase, vers le milieu de l'attaque
      if (b.wall === 0 && b.st > attackT * 0.5) {
        b.wall = 1;                  // telegraphe : on previent
        api.shake(4); api.poof(b.pos.x, b.pos.y - api.TS);
      } else if (b.wall === 1 && b.st > attackT * 0.5 + 0.4) {
        b.wall = 2;                  // tir du mur (apres le delai de telegraphe)
        // trou aligne du COTE OPPOSE au joueur -> Laura doit se replacer
        const holeSide = (p.pos.x < b.pos.x) ? 1 : -1;
        const holeX = b.homeX + holeSide * (b.def.range || 360) * 0.55;
        const top = b.pos.y - 360, bot = b.pos.y + 60;
        const step = 56;
        for (let y = top; y <= bot; y += step) {
          if (Math.abs((b.pos.x) - holeX) < 1) continue;
          // mur vertical : projectiles partant du x du boss, descendant tout droit
          api.bullet(holeX, y, { pos: vec2(holeX, y + 100) }, sp * 0.9, 'enemy');
        }
        // marque visuellement le trou (rien dedans = passage sur)
        api.poof(holeX, p.pos.y - 8);
      }
      if (b.st > attackT) { b.state = 'load'; b.st = 0; b.wall = 0; }
    } else {
      // "loading..." : ne tire plus -> FENETRE DE PUNITION
      b.animWant = 'idle';
      if (b.st > loadT) { b.state = 'attack'; b.st = 0; b.t = 0; }
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
    b.pt += dt();
    const preT = b.def.preTime || 0.4;
    const throwT = b.def.throwTime || 0.3;
    const windowT = b.def.windowTime || 1.2;
    const formN = b.def.formN || 4;
    const sp = b.def.shotSpeed || 220;

    if (b.ps === 'pre') {
      // choisit la destination et la TELEGRAPHE (poof a l'avance)
      faceOnly(b, p);
      b.animWant = 'idle';
      if (b.pt < 0.06) {
        b.destX = b.homeX + rand(-b.def.range, b.def.range);
        api.poof(b.destX, b.pos.y - api.TS);   // fantome a la future place
      } else if (b.pt > preT * 0.5) {
        api.poof(b.destX, b.pos.y - api.TS);   // re-pulse pour appuyer le telegraphe
      }
      if (b.pt > preT) { b.ps = 'tp'; b.pt = 0; }
    } else if (b.ps === 'tp') {
      // teleportation effective vers la destination annoncee
      api.poof(b.pos.x, b.pos.y - api.TS);
      b.pos.x = b.destX;
      api.poof(b.pos.x, b.pos.y - api.TS);
      faceOnly(b, p);
      b.ps = 'throw'; b.pt = 0; b.threw = false;
    } else if (b.ps === 'throw') {
      // eventail de formulaires + un tampon qui tombe sur le joueur
      b.animWant = 'attack';
      faceOnly(b, p);
      if (!b.threw) {
        b.threw = true;
        const half = (formN - 1) / 2;
        for (let i = 0; i < formN; i++) shoot(b, p, api, sp, (i - half) * 0.16);
        skyHazard(api, p.pos.x, p.pos.y);   // le "tampon" administratif tombe sur le joueur
        api.shake(2);
      }
      if (b.pt > throwT) { b.ps = 'window'; b.pt = 0; }
    } else {
      // FENETRE DE PUNITION : vulnerable, immobile, spawn occasionnel
      b.animWant = 'idle';
      faceOnly(b, p);
      if (b.pt < 0.06) {
        b.cyc = (b.cyc || 0) + 1;
        if (b.cyc % 2 === 0) api.add('chercheur', b.pos.x, b.pos.y - api.TS);
      }
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
        // debat : eventail de 5 + un anneau de 8 un coup sur deux + minion
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
        if (b.cyc % 3 === 0) api.add('passant', b.pos.x, b.pos.y - api.TS);   // jury : invoque un random (tous biomes)
      } else {
        // verdict / panique : large eventail rapide + pluie du ciel + shake
        const n = b.def.panicN || 7;
        const half = (n - 1) / 2;
        for (let i = 0; i < n; i++) shoot(b, p, api, sp * 1.1, (i - half) * 0.16);
        skyHazard(api, p.pos.x, p.pos.y);
        if (b.cyc % 2 === 0) skyHazard(api, b.pos.x + rand(-b.def.range, b.def.range), p.pos.y);
        if (b.cyc % 4 === 0) api.add('passant', b.pos.x, b.pos.y - api.TS);   // jury : invoque un random (tous biomes)
        api.shake(3);
      }
    }
    clampHome(b);
  };

  return AI;
})();
