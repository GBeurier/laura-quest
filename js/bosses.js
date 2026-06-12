/* =====================================================================
 *  BOSSES — Une IA de boss differente par niveau.
 *  game.js appelle BOSS_AI[def.behavior](b, p, api) a chaque frame.
 *    b   = entite boss (b.def, b.hp, b.maxHp, b.t, b.homeX, b.pos...)
 *    p   = joueur
 *    api = { TS, bullet(x,y,target,speed,kind,spr), add(kind,x,y), poof(x,y),
 *            marker(x,y,dur), dropBomb(x,y,delay,spr), hazard(x,y,dur,delay),
 *            quake(x,dir,range)*, addGuestBoss(key,x,hpFrac)*, shake(n)** }
 *      *  = nouvelles API (passe boss v2), deployees EN PARALLELE cote game.js
 *           -> TOUJOURS appelees avec un guard defensif (api.quake && ...) :
 *           bosses.js doit booter sans crash meme sur l'ancien game.js.
 *      ** = api.shake existe encore cote game.js mais bosses.js NE L'UTILISE
 *           PLUS (Todo : "virer les tremblements"). Tous les telegraphes
 *           passent par des FX localises (api.poof aux pieds / autour du
 *           boss). Seules les explosions (dropBomb -> bombBlast, cote
 *           game.js) gardent leur shake.
 *
 *  CONTRAT game.js <-> IA (passe "difficulte & boss" v2) :
 *   - b.guard : multiplicateur des degats ENCAISSES hors fenetre. game.js le
 *     re-pose a (b.def.guard != null ? b.def.guard : 0.35) AVANT chaque frame
 *     d'IA ; l'IA le force a 1 A CHAQUE FRAME de ses etats de punition
 *     (charger->stagger, tracteur->stall, errors->load, modeles->recalc,
 *     paperasse->window, jury->battement openT) et a 0 quand elle veut etre
 *     invulnerable (jury->interlude 'invite').
 *   - b.p2 : pose par game.js (hp/maxHp <= 0.5). b.p2Just : true UNE seule
 *     frame a la transition -> l'IA joue un petit telegraphe (p2Tell : 3
 *     poofs autour du boss + breve pose 'attack' via b.p2PoseT/p2Pose). Les
 *     parametres de phase 2 se lisent en "b.def.p2X || <defaut>" pour rester
 *     tunables depuis CONFIG.bosses. Le jury IGNORE p2/p2Just : il a ses
 *     propres phases HP (jPhase) + interludes 'invite' qui font le show.
 *   - b.vulnT (fenetre forcee par le chat) et b.catVulnLock : geres et
 *     decrementes par game.js. L'IA n'y touche JAMAIS.
 *   - b.openT (jury) : battement de vulnerabilite apres CHAQUE salve, pose
 *     ET decremente par l'IA elle-meme (guard = 1 tant que > 0).
 *   - Tirs : api.bullet prend un 6e parametre optionnel = nom du sprite du
 *     projectile (l'ancien global BOSS_SHOT_SPRITE disparait). TOUS les tirs
 *     de boss passent b.def.shot — les helpers shoot/shootDir/lob/
 *     tripleShoot/wallWithHole le font automatiquement.
 *
 *  Convention : chaque IA pose b.animWant = 'idle' | 'attack' | 'hurt'
 *  (game.js lit ce champ pour jouer l'animation du boss).
 *
 *  PHILOSOPHIE DE DESIGN (appliquee a tous) :
 *   1. TELEGRAPHE lisible avant chaque attaque (recul, poofs localises,
 *      pose 'attack', courte pause) -> Laura voit venir le danger.
 *   2. FENETRE DE PUNITION recurrente (guard = 1) : un moment ou le boss est
 *      immobile et vulnerable pour que Laura approche et tape. Hors fenetre,
 *      la garde (b.guard < 1) absorbe le gros des degats.
 *   3. IDENTITE : chaque boss joue differemment (machine a etats dediee) et
 *      sa PHASE 2 (<= 50% HP) AMPLIFIE son identite sans la changer.
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
    if (Math.abs(p.pos.x - b.homeX) < 640 && Math.abs(b.pos.x - b.homeX) < b.range) {
      b.move(Math.sign(p.pos.x - b.pos.x) * spd, 0);
    }
  }
  // deplacement horizontal libre borne a l'arene (utilise pour dash/drive/tp)
  function moveDirClamp(b, dir, spd) {
    const x0 = b.pos.x;
    const step = spd * dt();
    // DETECTION DE BLOCAGE physique (rocher, mur...) : move() translate tout de
    //  suite mais la resolution des solides REPOUSSE le corps plus tard dans la
    //  frame -> on compare la position d'ENTREE de frame a celle de la frame
    //  precedente. Quasi pas avance plusieurs frames d'affilee malgre la demande
    //  => on traite l'obstacle comme un BORD (sinon 'drive'/'dash' ne finissent
    //  jamais : boss fige qui spamme son attaque, cf. bug tracteur niveau1).
    if (b._mdcDir === dir && b._mdcX != null && step > 0) {
      b._mdcBlock = (Math.abs(x0 - b._mdcX) < step * 0.2) ? (b._mdcBlock || 0) + 1 : 0;
    } else b._mdcBlock = 0;
    b._mdcDir = dir; b._mdcX = x0;
    const nx = x0 + dir * step;
    const inside = Math.abs(nx - b.homeX) < b.range;
    if (inside) b.move(dir * spd, 0);
    // bord atteint si la position depasse range OU si le gate vient de refuser
    //  le pas (pos collee au bord, a <1 pas de la limite). Sans le 2e test,
    //  "edge" n'etait JAMAIS vrai par auto-deplacement (move() du moteur =
    //  translation immediate par le MEME calcul que nx -> toujours < range)
    //  -> le drive du tracteur ne finissait jamais tout seul.
    return !inside || Math.abs(x0 - b.homeX) >= b.range || (b._mdcBlock || 0) >= 4;
  }
  // borne dure de la position au cas ou (securite anti-sortie d'arene)
  function clampHome(b) {
    const r = b.range || 360;
    if (b.pos.x < b.homeX - r) b.pos.x = b.homeX - r;
    if (b.pos.x > b.homeX + r) b.pos.x = b.homeX + r;
  }
  // tir vise le joueur, avec un ecart angulaire "spread" (radians)
  function shoot(b, p, api, speed, spread) {
    const base = p.pos.sub(b.pos.add(0, -api.TS)).unit();
    const c = Math.cos(spread), s = Math.sin(spread);
    const d = vec2(base.x * c - base.y * s, base.x * s + base.y * c);
    api.bullet(b.pos.x, b.pos.y - api.TS, { pos: b.pos.add(d.scale(100)) }, speed, 'boss', b.def.shot);
  }
  // tir dans une DIRECTION precise (dir = vec2 unitaire), pas vers le joueur
  function shootDir(b, api, dir, speed, kind) {
    api.bullet(b.pos.x, b.pos.y - api.TS, { pos: b.pos.add(dir.scale(100)) }, speed, kind || 'boss', b.def.shot);
  }
  // jet en cloche (biais vers le haut) : piquets / fourches
  function lob(b, p, api, spread) {
    const sp = b.def.shotSpeed || 220;
    const base = p.pos.sub(b.pos.add(0, -api.TS)).unit();
    const up = vec2(base.x, base.y - 0.7).unit();
    const c = Math.cos(spread), s = Math.sin(spread);
    const d = vec2(up.x * c - up.y * s, up.x * s + up.y * c);
    api.bullet(b.pos.x, b.pos.y - api.TS, { pos: b.pos.add(d.scale(100)) }, sp * 0.85, 'boss', b.def.shot);
  }
  // ATTAQUES CIBLEES (bombe / tampon-piege sur p.pos) : ne partent que si le
  //  joueur est DANS l'arene (+ marge 6 tuiles, meme gate que le drive du
  //  tracteur). Ceinture de securite du verrou d'arene cote game.js : sans ca,
  //  michael / cendrine / le jury bombardaient jusqu'au spawn une fois reveilles
  //  (b._awoken ne redescend jamais) — exactement le bug que la veille v2.1
  //  pretendait corriger.
  function inArena(b, p, api) {
    return Math.abs(p.pos.x - b.homeX) < (b.range || 300) + api.TS * 6;
  }

  // SPAWN-EN-FACE (dette tech 3) : pose un minion ENTRE le boss et le joueur
  //  (jamais derriere la camera) + poof de telegraphe. Clampe a l'arene.
  function spawnEnFace(b, p, api, kind) {
    const r = b.range || 360;
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
      api.bullet(b.pos.x, y, { pos: vec2(b.pos.x + dir * 600, y) }, sp, 'boss', b.def.shot);
    }
  }

  // MUR A TROU ("stack trace") : colonne VERTICALE de projectiles qui balaye
  //  l'arene, avec UN trou (~1.5 tuile) annonce par un poof -> Laura se place
  //  ou dashe dans le trou. Factorise depuis AI.jury (verdict) ; aussi utilise
  //  par AI.errors en phase 2.
  //  opts = { gapY    : hauteur du trou (null/absent = hauteur du joueur +- alea),
  //           dirX    : sens de balayage +1/-1 (defaut : b.facing, vers le joueur),
  //           speedMul: multiplicateur de vitesse (defaut 0.9) }
  function wallWithHole(b, p, api, opts) {
    const o = opts || {};
    const dirX = o.dirX || b.facing || (Math.sign(p.pos.x - b.pos.x) || -1);
    const sp = (b.def.shotSpeed || 220) * (o.speedMul || 0.9);
    const wallX = b.pos.x - dirX * (b.range || 360) * 0.5;   // nait derriere le boss
    const gapY = (o.gapY != null) ? o.gapY : p.pos.y - api.TS * (1 + rand(0, 1.5));
    api.poof(wallX, gapY);                                       // annonce du trou
    const top = b.pos.y - api.TS * 6, bot = b.pos.y + api.TS * 0.5, step = api.TS * 0.75;
    for (let y = top; y <= bot; y += step) {
      if (Math.abs(y - gapY) < api.TS * 0.75) continue;          // laisse le trou (~1.5 tuile)
      api.bullet(wallX, y, { pos: vec2(wallX + dirX * 600, y) }, sp, 'boss', b.def.shot);
    }
  }

  // TELEGRAPHE DE PHASE 2 : appele quand game.js pose b.p2Just (UNE frame au
  //  passage sous 50% HP). 3 poofs autour du boss + arme une breve pose
  //  'attack' (b.p2PoseT, lue par p2Pose en fin d'IA). Pas de shake (Todo).
  function p2Tell(b, api) {
    api.poof(b.pos.x, b.pos.y - api.TS);
    api.poof(b.pos.x - 24, b.pos.y - api.TS * 1.7);
    api.poof(b.pos.x + 24, b.pos.y - api.TS * 0.5);
    b.p2PoseT = 0.3;
  }
  // pose 'attack' breve apres p2Tell — appelee en FIN d'IA : n'altere QUE
  //  l'animation (la machine a etats continue de tourner normalement).
  function p2Pose(b) {
    if (b.p2PoseT > 0) { b.p2PoseT -= dt(); b.animWant = 'attack'; }
  }

  const AI = {};

  // --- defaut : tir en eventail + avance lente (filet de securite) -----
  AI.default = function (b, p, api) {
    faceOnly(b, p); moveClamp(b, p, b.def.speed);
    if (b.p2Just) p2Tell(b, api);
    b.animWant = 'idle';
    b.t += dt();
    if (b.t >= b.def.shotEvery) {
      b.t = 0; b.animWant = 'attack';
      [-0.18, 0, 0.18].forEach((s) => shoot(b, p, api, b.def.shotSpeed, s));
    }
    p2Pose(b);
  };

  /* =====================================================================
   *  PROPRIETAIRE TERRIEN — 1er boss "charger", le plus simple a lire.
   *  Machine a etats : pace -> wind -> dash -> stagger -> throw.
   *  Apprend a Laura : "telegraphe -> esquive -> punition".
   *  ONDE AU SOL (api.quake) a la fin du dash : on SAUTE pour l'eviter.
   *  PHASE 2 : dash ALLER-RETOUR (rewind court au bord puis dash inverse),
   *  triple missile a CHAQUE pace (milieu toujours duckable), stagger
   *  raccourci (p2StaggerTime), onde au sol des DEUX cotes a l'arret.
   * ===================================================================== */
  AI.charger = function (b, p, api) {
    if (b.cs === undefined) { b.cs = 'pace'; b.ct = 0; b.dashDir = -1; b.cyc = 0; b.shotDone = false; b.didReturn = false; b.dust = 0; }
    if (b.p2Just) p2Tell(b, api);
    b.ct += dt();
    const paceT = b.def.paceTime || 1.0;
    const windT = b.def.windTime || 0.7;
    const dashT = b.def.dashTime || 0.9;
    const stagT = b.p2 ? (b.def.p2StaggerTime || 0.9) : (b.def.staggerTime || 1.2);
    const rewindT = b.def.p2RewindTime || 0.3;
    const throwT = b.def.throwTime || 0.5;
    const dashSpd = b.def.dashSpeed || 520;
    const shotSpeed = b.def.shotSpeed || 255;

    if (b.cs === 'pace') {
      // approche lente, regarde le joueur, prepare la charge. P1 : 1 fois sur 2,
      //  apres un court telegraphe, tire un TRIPLE missile (milieu = duckable).
      //  P2 : triple missile a CHAQUE cycle.
      faceOnly(b, p);
      moveClamp(b, p, (b.def.speed || 90) * 0.6);
      if (b.p2 || b.cyc % 2 === 1) {
        // tir CALE SUR LA FRAME DE JET : pose 'throw' (clip dedie de la feuille
        //  _atk : leve -> epaule -> bras tendu) demarree a 0.1s, missile a 0.3s
        //  = pile la frame de jet affichee. Avant, le missile partait a
        //  l'instant exact ou l'anim REVENAIT a idle (telegraphe inverse).
        b.animWant = (b.ct >= 0.1 && b.ct < 0.5) ? 'throw' : 'idle';
        if (!b.shotDone && b.ct >= 0.3) { tripleShoot(b, p, api, shotSpeed); b.shotDone = true; }
      } else {
        b.animWant = 'idle';
      }
      if (b.ct > paceT) {
        b.cs = 'wind'; b.ct = 0; b.cyc++; b.shotDone = false;
        b.dashDir = Math.sign(p.pos.x - b.pos.x) || -1;  // verrouille la cible
      }
    } else if (b.cs === 'wind') {
      // TELEGRAPHE net : se cabre (recule a l'oppose) + poussiere aux pieds.
      //  'windup' = clip dedie (leve -> arme, fige sur la pose armee) ; les
      //  feuilles sans ce clip retombent sur 'attack' (cf. bossAnim).
      b.animWant = 'windup';
      faceOnly(b, p);
      b.move(-b.dashDir * 70, 0);
      if (b.ct < 0.06) { api.poof(b.pos.x, b.pos.y); api.poof(b.pos.x - b.dashDir * 18, b.pos.y - 6); }
      if (b.ct > windT) {
        b.cs = 'dash'; b.ct = 0; b.didReturn = false; b.dust = 0;
        // SEISME LOCALISE : cracks au sol au depart du dash
        api.poof(b.pos.x, b.pos.y); api.poof(b.pos.x - 22, b.pos.y); api.poof(b.pos.x + 22, b.pos.y);
      }
    } else if (b.cs === 'dash') {
      // ruee a pleine vitesse dans la direction verrouillee : trainee de
      //  poussiere localisee + contact (contact-damage normal du boss).
      //  'dash' = frame de COURSE de la feuille _atk (avant : le clip complet
      //  bouclait -> le boss "jetait ses cles" en boucle pendant la charge).
      b.animWant = 'dash';
      const edge = moveDirClamp(b, b.dashDir, dashSpd);
      b.dust += dt();
      if (b.dust >= 0.09) { b.dust = 0; api.poof(b.pos.x - b.dashDir * 16, b.pos.y); }
      if (edge || b.ct > dashT) {
        if (b.p2 && !b.didReturn) {
          // PHASE 2 : ALLER-RETOUR — courte pause armee puis dash inverse
          b.cs = 'rewind'; b.ct = 0;
          api.poof(b.pos.x, b.pos.y);
        } else {
          b.cs = 'stagger'; b.ct = 0;
          api.poof(b.pos.x, b.pos.y);
          // ONDE AU SOL : P1 = dans le sens du dash ; P2 = des DEUX cotes
          if (api.quake) {
            if (b.p2) { api.quake(b.pos.x, 1, 260); api.quake(b.pos.x, -1, 260); }
            else api.quake(b.pos.x, b.dashDir, 260);
          }
        }
      }
    } else if (b.cs === 'rewind') {
      // PHASE 2 : re-armement court SUR PLACE (telegraphe du dash retour)
      b.animWant = 'windup';
      faceOnly(b, p);
      if (b.ct < 0.05) { api.poof(b.pos.x, b.pos.y); api.poof(b.pos.x + b.dashDir * 20, b.pos.y - 8); }
      if (b.ct > rewindT) { b.cs = 'dash'; b.ct = 0; b.dashDir = -b.dashDir; b.didReturn = true; b.dust = 0; }
    } else if (b.cs === 'stagger') {
      // ESSOUFFLE : totalement immobile -> FENETRE DE PUNITION (garde levee)
      b.animWant = 'hurt';
      b.guard = 1;
      if (b.ct < 0.06) { api.poof(b.pos.x, b.pos.y); api.poof(b.pos.x - 20, b.pos.y - 10); }
      if (b.ct > stagT) { b.cs = 'throw'; b.ct = 0; }
    } else {
      // jette UN eventail de 3 baux puis repart en pace. Flag b.shotDone :
      //  l'ancien test "ct < 0.06" durait plusieurs frames -> eventail double/
      //  triple selon le framerate (le flag rend le tir deterministe).
      //  Tir a 0.25s = la frame de JET (le clip 'throw' redemarre a l'entree de
      //  l'etat : leve 0-0.08, epaule 0.08-0.17, bras tendu des 0.17). Avant,
      //  l'eventail partait frame 0 (bras baisses) et la pose de jet arrivait
      //  0.3s APRES que les projectiles aient quitte le boss.
      b.animWant = 'throw';
      faceOnly(b, p);
      if (!b.shotDone && b.ct >= 0.25) { b.shotDone = true; [-0.22, 0, 0.22].forEach((s) => lob(b, p, api, s)); }
      // NB : cyc ne s'incremente plus ici (il s'incremente deja a pace->wind ;
      //  le double ++ le gardait toujours PAIR pendant pace -> le triple
      //  missile "1 cycle sur 2" de p1 ne partait JAMAIS).
      if (b.ct > throwT) { b.cs = 'pace'; b.ct = 0; b.shotDone = false; }
    }
    p2Pose(b);
    clampHome(b);
  };

  /* =====================================================================
   *  AGRICULTEUR FOU — tracteur en va-et-vient + fourches + dangers ciel.
   *  Cycle : rev (rev moteur, telegraphe) -> drive (traverse l'arene en
   *  semant des bombes) -> stall (moteur cale = punition, garde levee).
   *  PHASE 2 : drive plus rapide (p2DriveMul), bombes plus frequentes
   *  (p2SkyEvery), et UNE bombe ciblee tombe a MI-STALL -> punir le stall
   *  devient un risque calcule, plus un open bar.
   * ===================================================================== */
  AI.tracteur = function (b, p, api) {
    if (b.ts === undefined) { b.ts = 'rev'; b.tt = 0; b.dir = -1; b.skyT = 0; b.stallBomb = false; b.bombPose = 0; b.revInit = false; }
    if (b.p2Just) p2Tell(b, api);
    b.tt += dt();
    const revT = b.def.revTime || 0.5;
    const stallT = b.def.stallTime || 1.8;
    const driveSpd = (b.def.driveSpeed || (b.def.speed || 120) * 1.6) * (b.p2 ? (b.def.p2DriveMul || 1.25) : 1);
    const skyEvery = b.p2 ? (b.def.p2SkyEvery || 2.4) : (b.def.skyEvery || 2.2);  // cadence des bombes en drive
    const skyDelay = b.def.skyDelay || 0.8;     // fenetre de telegraphe (ombre qui grandit)

    if (b.ts === 'rev') {
      // TELEGRAPHE : choisit la direction, vrombit (fumee d'echappement), sur place
      faceOnly(b, p);
      b.animWant = 'attack';
      // vise le joueur si loin, sinon repart vers le centre pour ne pas se coincer.
      //  FLAG revInit (pas "tt < 0.06") : une frame longue (>60ms, mobile charge)
      //  sautait la fenetre -> direction jamais rechoisie, fumee jamais emise.
      if (!b.revInit) {
        b.revInit = true;
        const towardP = Math.sign(p.pos.x - b.pos.x) || -1;
        const towardHome = Math.sign(b.homeX - b.pos.x) || -1;
        b.dir = (Math.abs(b.pos.x - b.homeX) > b.range * 0.7) ? towardHome : towardP;
        // VROMBISSEMENT localise : fumee aux echappements + poussiere aux roues
        api.poof(b.pos.x - 14, b.pos.y - api.TS * 1.5);
        api.poof(b.pos.x + 10, b.pos.y - api.TS * 1.1);
        api.poof(b.pos.x, b.pos.y);
        // PHASE 2 : UNE fourche lobee pendant le vrombissement — def.shot
        //  (shot_fork) etait de la config morte (l'IA ne tirait jamais) ; ca
        //  donne a l'agriculteur un poil de menace a distance sans toucher P1.
        if (b.p2 && inArena(b, p, api)) lob(b, p, api, 0);
      }
      if (b.tt > revT) { b.ts = 'drive'; b.tt = 0; b.skyT = 0; }
    } else if (b.ts === 'drive') {
      // traverse l'arene a fond : anim de CONDUITE (feuille _move) + une BOMBE
      //  telegraphee tous les skyEvery. Pose d'ATTAQUE BREVE (bombPose) a chaque
      //  bombe seulement -> le tracteur ne joue plus sa feuille d'attaque EN
      //  BOUCLE pendant tout le trajet (l'anim "conduite" reste propre).
      b.flipX = b.dir > 0;             // oriente le tracteur dans le sens de marche
      b.facing = b.dir;
      if (b.bombPose > 0) b.bombPose -= dt();
      b.animWant = (b.bombPose > 0) ? 'attack' : 'idle';
      const edge = moveDirClamp(b, b.dir, driveSpd);
      b.skyT += dt();
      if (b.skyT >= skyEvery) {
        b.skyT = 0;
        // bombe sur la position du joueur (ombre qui grandit = telegraphe skyDelay),
        //  lachee MEME quand Laura est tout pres (fini "plus de bombes quand on est
        //  pres"), mais JAMAIS hors de l'arene (jamais jusqu'au spawn, meme si Laura
        //  a fui apres avoir reveille le boss). Esquive : dash/saut lateral.
        if (inArena(b, p, api)) {
          b.bombPose = 0.25;
          api.dropBomb(p.pos.x, p.pos.y, skyDelay, 'shot_bomb');
        }
      }
      if (edge) { b.ts = 'stall'; b.tt = 0; b.stallBomb = false; }
    } else {
      // MOTEUR CALE : immobile, fume -> FENETRE DE PUNITION (garde levee)
      faceOnly(b, p);
      b.animWant = 'idle';
      b.guard = 1;
      if (b.tt < 0.06) { api.poof(b.pos.x, b.pos.y - api.TS); api.poof(b.pos.x + 14, b.pos.y - api.TS - 18); }
      // PHASE 2 : UNE bombe ciblee a mi-stall — taper la fenetre reste possible
      //  mais demande de bouger (ou de tirer a distance).
      if (b.p2 && !b.stallBomb && b.tt >= stallT * 0.5) {
        b.stallBomb = true;
        if (inArena(b, p, api)) api.dropBomb(p.pos.x, p.pos.y, 0.9, 'shot_bomb');
      }
      if (b.tt > stallT) { b.ts = 'rev'; b.tt = 0; b.dir = -b.dir; b.revInit = false; }  // repart en sens inverse
    }
    p2Pose(b);
    clampHome(b);
  };

  /* =====================================================================
   *  MICHAEL DINGKHUN — chercheur dangereux (modeles stats).
   *  Force le combat A DISTANCE : garde ses distances, alterne bombe papier
   *  et overload (eventail vise), spawn des cafards, et marque une fenetre
   *  "recalcul" ou il ne tire pas (garde levee).
   *  PHASE 2 : 2 bombes papier (joueur + decalee de +/-120 px), overload 1
   *  cycle sur 2, colle plus (p2KeepMin/p2KeepMax), 2 cafards par recalc.
   *  Cycle : aim -> throw/overload -> recalc.
   * ===================================================================== */
  AI.modeles = function (b, p, api) {
    if (b.ms === undefined) { b.ms = 'aim'; b.mt = 0; b.cyc = 0; b.threw = false; b.spawned = false; }
    faceOnly(b, p);
    if (b.p2Just) p2Tell(b, api);
    b.mt += dt();
    const aimT = b.def.aimTime || 1.0;
    const recalcT = b.def.recalcTime || 1.0;
    const keepMin = b.p2 ? (b.def.p2KeepMin || 180) : (b.def.keepMin || 220);  // distance mini avant de reculer
    const keepMax = b.p2 ? (b.def.p2KeepMax || 380) : (b.def.keepMax || 440);  // distance maxi avant d'avancer
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
        // P1 : 1 cycle sur 3 = OVERLOAD (eventail telegraphe), sinon BOMBE EN
        //  PAPIER. P2 : overload 1 cycle sur 2.
        b.ms = (b.cyc % (b.p2 ? 2 : 3) === 0) ? 'overload' : 'throw';
      }
    } else if (b.ms === 'throw') {
      // BOMBE EN PAPIER : memo froisse qui tombe sur la position du joueur ->
      //  le force a BOUGER lateralement (ombre qui grandit = telegraphe).
      //  P2 : une 2e bombe decalee de +/-120 px coupe l'esquive paresseuse.
      //  Sprite via b.def.bomb (boulette de papier froisse — l'ancien defaut
      //  shot_paper etait un AVION en papier qui chutait en tournoyant).
      //  Gate inArena : fini les bombes qui suivaient Laura jusqu'au spawn.
      b.animWant = 'attack';
      if (!b.threw) {
        b.threw = true;
        const bombSpr = b.def.bomb || 'shot_paper';
        if (inArena(b, p, api)) {
          api.dropBomb(p.pos.x, p.pos.y, 0.7, bombSpr);
          if (b.p2) api.dropBomb(p.pos.x + (rand(0, 1) < 0.5 ? -120 : 120), p.pos.y, 0.7, bombSpr);
        }
      }
      if (b.mt > 0.5) { b.ms = 'recalc'; b.mt = 0; b.spawned = false; }
    } else if (b.ms === 'overload') {
      // OVERLOAD : telegraphe (poofs autour du boss) puis eventail de 3 tirs
      //  VISES (shoot() vise bien le joueur depuis le torse).
      b.animWant = 'attack';
      if (!b.threw && b.mt < 0.06) {
        api.poof(b.pos.x - 20, b.pos.y - api.TS * 1.4);
        api.poof(b.pos.x + 20, b.pos.y - api.TS * 0.8);
        api.poof(b.pos.x, b.pos.y - api.TS * 2);
      }
      if (!b.threw && b.mt > 0.3) {
        b.threw = true;
        [-0.2, 0, 0.2].forEach((s) => shoot(b, p, api, sp, s));
      }
      if (b.mt > 0.6) { b.ms = 'recalc'; b.mt = 0; b.spawned = false; }
    } else {
      // RECALCUL : ne tire plus -> FENETRE DE PUNITION (garde levee).
      //  Spawn UNE seule fois par recalc (flag b.spawned — l'ancien test
      //  "mt < 0.06" durait plusieurs frames -> nb de cafards framerate-
      //  dependant). P1 : 1 cafard occasionnel ; P2 : 2 cafards a CHAQUE recalc.
      b.animWant = 'idle';
      b.guard = 1;
      if (!b.spawned) {
        b.spawned = true;
        if (b.p2) { spawnEnFace(b, p, api, 'cafard'); spawnEnFace(b, p, api, 'cafard'); }
        else if (b.cyc % 3 === 1) spawnEnFace(b, p, api, 'cafard');
      }
      if (b.mt > recalcT) { b.ms = 'aim'; b.mt = 0; }
    }
    p2Pose(b);
    clampHome(b);
  };

  /* =====================================================================
   *  RSTUDIO — erreurs / bugs. Alternance fire <-> summon <-> load.
   *  PHASE 2 : salves plus serrees (p2BurstGap) + le "STACK TRACE" promis :
   *  UNE fois par phase fire, un mur vertical a trou (wallWithHole) dont le
   *  trou est parfois EN HAUTEUR (~40% : TS*3..5 au-dessus du sol) -> force
   *  a utiliser les plateformes de l'arene.
   * ===================================================================== */
  AI.errors = function (b, p, api) {
    faceOnly(b, p);
    if (b.state === undefined) { b.state = 'fire'; b.st = 0; b.t = 0; b.burst = 0; b.summoned = false; b.wallDone = false; }
    if (b.p2Just) p2Tell(b, api);
    b.st += dt();
    const attackT = b.def.attackTime || 2.5;   // FIRE : 3 salves de tripleShoot
    const summonT = b.def.summonTime || 2.0;   // SUMMON : cafards fragiles
    const loadT = b.def.loadTime || 1.5;       // LOAD : punition
    const burstGap = b.p2 ? (b.def.p2BurstGap || 0.6) : (b.def.burstGap || 0.8);
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
      // PHASE 2 : "STACK TRACE" — UNE fois par phase fire, mur vertical a trou.
      //  ~40% des cas le trou est EN HAUTEUR (TS*3..5 au-dessus du sol) ->
      //  monter sur une plateforme ; sinon a hauteur de joueur (se placer/dash).
      if (b.p2 && !b.wallDone && b.st > attackT * 0.45) {
        b.wallDone = true;
        const gapY = (rand(0, 1) < 0.4) ? b.pos.y - api.TS * rand(3, 5) : null;
        wallWithHole(b, p, api, { gapY });
      }
      if (b.st > attackT) { b.state = 'summon'; b.st = 0; b.summoned = false; }
    } else if (b.state === 'summon') {
      // invoque des cafards TRES fragiles (1 PV) en face du joueur ; +1 si bas HP.
      //  Flag PUR (pas "st < 0.06") : une frame longue sautait la fenetre ->
      //  AUCUNE invocation du cycle (st incremente avant le test).
      b.animWant = 'idle';
      if (!b.summoned) {
        b.summoned = true;
        const n = (b.hp / b.maxHp < 0.5) ? 3 : 2;
        for (let i = 0; i < n; i++) spawnEnFace(b, p, api, 'cafard');
      }
      if (b.st > summonT) { b.state = 'load'; b.st = 0; b.burst = 0; }
    } else {
      // LOAD ("loading...") : ne tire plus, immobile -> FENETRE DE PUNITION
      b.animWant = 'idle';
      b.guard = 1;
      if (b.st > loadT) { b.state = 'fire'; b.st = 0; b.burst = 0; b.wallDone = false; }
    }
    p2Pose(b);
    clampHome(b);
  };

  /* =====================================================================
   *  CENDRINE la secretaire — le boss le plus DUR des 5.
   *  Teleportation TELEGRAPHEE (poof a la destination future) + eventail
   *  de formulaires + tampon-piege au sol. Fenetre de vulnerabilite apres
   *  chaque salve (garde levee). Cycle : pre -> implosion/tp -> throw -> window.
   *  PHASE 2 : DOUBLE TP enchaine (apres le 1er throw, re-pre RACCOURCI
   *  (preTime x0.5) -> implosion -> 2e throw, PUIS window), formN p2FormN,
   *  tampon-piege plus long (p2HazardDur), window plus courte (p2WindowTime).
   * ===================================================================== */
  AI.paperasse = function (b, p, api) {
    if (b.ps === undefined) { b.ps = 'pre'; b.pt = 0; b.destX = b.homeX; b.threw = false; b.chain = 0; b.destDone = false; }
    if (b._baseScale === undefined) { b._baseScale = b.scale ? b.scale.clone() : vec2(1, 1); }
    if (b.p2Just) p2Tell(b, api);
    b.pt += dt();
    const preT = (b.def.preTime || 0.4) * (b.chain ? 0.5 : 1);  // 2e TP du combo p2 : annonce raccourcie
    const imploT = b.def.implodeTime || 0.18;   // duree de l'implosion spectaculaire
    const throwT = b.def.throwTime || 0.3;
    const windowT = b.p2 ? (b.def.p2WindowTime || 0.9) : (b.def.windowTime || 1.2);
    const formN = b.p2 ? (b.def.p2FormN || 6) : (b.def.formN || 4);
    const hazardDur = b.p2 ? (b.def.p2HazardDur || 3.5) : 2.5;
    const sp = b.def.shotSpeed || 220;
    const range = b.range || 360;

    if (b.ps === 'pre') {
      // choisit la destination (clampee a l'ecran, ELOIGNEE du joueur >=200px)
      //  et la TELEGRAPHE (poof a l'avance). Flag destDone (pas "pt < 0.06") :
      //  une frame longue gardait le destX du TP PRECEDENT -> le telegraphe
      //  annoncait la mauvaise destination.
      faceOnly(b, p);
      b.animWant = 'idle';
      if (!b.destDone) {
        b.destDone = true;
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
      // eventail de formulaires + TAMPON-PIEGE au sol (zone interdite, telegraphe
      //  0.5s) sur la position du joueur -> on dash a l'oppose.
      b.animWant = 'attack';
      faceOnly(b, p);
      if (!b.threw) {
        b.threw = true;
        const half = (formN - 1) / 2;
        for (let i = 0; i < formN; i++) shoot(b, p, api, sp, (i - half) * 0.16);
        if (inArena(b, p, api)) api.hazard(p.pos.x, p.pos.y, hazardDur, 0.5);   // pas de tampon jusqu'au spawn
        api.poof(b.pos.x, b.pos.y - api.TS);   // recul du jet (FX localise, pas de shake)
      }
      if (b.pt > throwT) {
        if (b.p2 && !b.chain) { b.chain = 1; b.ps = 'pre'; b.pt = 0; b.destDone = false; }  // PHASE 2 : DOUBLE TP enchaine
        else { b.chain = 0; b.ps = 'window'; b.pt = 0; }
      }
    } else {
      // FENETRE DE PUNITION : vulnerable, immobile (garde levee)
      b.animWant = 'idle';
      b.guard = 1;
      faceOnly(b, p);
      if (b.pt > windowT) { b.ps = 'pre'; b.pt = 0; b.destDone = false; }
    }
    p2Pose(b);
    clampHome(b);
  };

  /* =====================================================================
   *  JURY DE THESE — megaboss final : BOSS RUSH en 3 phases selon HP.
   *   >66%  (calme, Q&A)      : volees visees, deplacement lent, eventails 3.
   *   33-66% (debat)          : + minions + salves en ANNEAU.
   *   <33%  (verdict/panique) : pluie de bombes + larges eventails rapides +
   *                             MUR A TROU (wallWithHole) a dasher.
   *  Aux transitions 0->1 et 1->2 : INTERLUDE 'invite' — le jury "se
   *  concerte" (recule au fond, INVULNERABLE guard=0, aucun tir) et invoque
   *  un ANCIEN boss via api.addGuestBoss (0->1 : agriculteur ; 1->2 :
   *  rstudio ou michael au hasard, ~35% de leurs HP). L'invite vaincu, pose
   *  d'enrage puis reprise. Sans api.addGuestBoss (ancien game.js),
   *  l'interlude est saute proprement (enrage seul, comportement historique).
   *  BATTEMENT DE VULNERABILITE : apres CHAQUE volee, b.openT = openTime
   *  (defaut 0.8s) pendant lequel guard = 1 -> on apprend a taper apres
   *  chaque salve.
   * ===================================================================== */
  AI.jury = function (b, p, api) {
    faceOnly(b, p);
    if (b.jPhase === undefined) {
      b.jPhase = 0; b.t = 0; b.cyc = 0; b.enrage = 0;
      b.openT = 0; b.jMode = 'fight'; b._guest = null;
    }
    const frac = b.hp / b.maxHp;
    const phase = frac > 0.66 ? 0 : (frac > 0.33 ? 1 : 2);
    const sp = b.def.shotSpeed || 220;
    const baseEvery = b.def.shotEvery || 1.4;
    const range = b.range || 360;

    // --- transition de phase : BOSS RUSH (interlude 'invite') ou enrage ---
    if (phase !== b.jPhase) {
      const from = b.jPhase;
      b.jPhase = phase;
      let invited = false;
      if (api.addGuestBoss && phase > from && b.jMode !== 'invite') {
        // 0->1 : l'agriculteur ; 1->2 : rstudio OU michael (au hasard)
        const key = (from === 0) ? 'agriculteur' : (rand(0, 1) < 0.5 ? 'rstudio' : 'michael');
        b._guest = api.addGuestBoss(key, b.homeX, 0.35) || null;
        if (b._guest) {
          invited = true;
          b.jMode = 'invite';
          // annonce localisee de la concertation (pas de shake)
          api.poof(b.pos.x, b.pos.y - api.TS);
          api.poof(b.pos.x - 26, b.pos.y - api.TS * 1.8);
          api.poof(b.pos.x + 26, b.pos.y - api.TS * 0.6);
        }
      }
      if (!invited) b.enrage = b.def.enrageTime || 0.7;   // pas d'API / pas d'invite -> enrage direct
      b.t = 0;
    }

    // --- INTERLUDE 'invite' : se concerte au fond, INVULNERABLE, aucun tir ---
    if (b.jMode === 'invite') {
      b.guard = 0;                              // invulnerable pendant la concertation
      b.animWant = 'idle';
      // recule vers le fond de l'arene, du cote OPPOSE au joueur
      const back = b.homeX + (p.pos.x >= b.homeX ? -1 : 1) * range * 0.7;
      if (Math.abs(b.pos.x - back) > 10) {
        moveDirClamp(b, Math.sign(back - b.pos.x) || 1, (b.def.speed || 90) * 0.6);
      }
      if (!b._guest || !b._guest.exists || !b._guest.exists()) {
        // invite vaincu -> pose d'enrage existante puis reprise du combat
        b._guest = null;
        b.jMode = 'fight';
        b.enrage = b.def.enrageTime || 0.7;
        b.t = 0;
      }
      clampHome(b);
      return;
    }

    // --- pose d'enrage au changement de phase (telegraphe localise) ---
    if (b.enrage > 0) {
      b.enrage -= dt();
      b.animWant = 'attack';                  // pose marquee, pas de tir
      if (b.enrage > (b.def.enrageTime || 0.7) - 0.1) {
        api.poof(b.pos.x - 24, b.pos.y - api.TS);
        api.poof(b.pos.x + 24, b.pos.y - api.TS);
      }
      b.t = 0;
      return;                                 // on saute l'attaque pendant l'enrage
    }

    // --- battement de vulnerabilite : garde ouverte openT s apres chaque salve ---
    if (b.openT > 0) { b.openT -= dt(); b.guard = 1; }

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
        }
        if (b.cyc % 3 === 0) spawnEnFace(b, p, api, 'bug');   // vrai minion fragile (pas de passant)
      } else {
        // verdict / panique : large eventail rapide + bombes + MUR A TROU a dasher.
        //  Les frappes CIBLEES (bombe / tampon sur p.pos) sont gatees inArena :
        //  pas de pluie sur une Laura qui serait hors de l'arene.
        const n = b.def.panicN || 7;
        const half = (n - 1) / 2;
        for (let i = 0; i < n; i++) shoot(b, p, api, sp * 1.1, (i - half) * 0.16);
        if (inArena(b, p, api)) api.dropBomb(p.pos.x, p.pos.y, 0.6, 'shot_bomb');
        if (b.cyc % 2 === 0) api.dropBomb(b.pos.x + rand(-range, range), p.pos.y, 0.6, 'shot_bomb');
        if (b.cyc % 2 === 1) {
          // MUR A TROU (helper factorise wallWithHole) + tampon-piege au sol
          wallWithHole(b, p, api, {});
          if (inArena(b, p, api)) api.hazard(p.pos.x, p.pos.y, 2.0, 0.5);
        }
      }
      // apres CHAQUE volee (tous modes) : battement de garde ouverte
      b.openT = b.def.openTime || 0.8;
    }
    clampHome(b);
  };

  return AI;
})();
