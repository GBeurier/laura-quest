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
 *   - b.dmgMult : MULTIPLICATEUR des degats infliges au boss (defaut 1, re-pose
 *     a 1 par game.js AVANT chaque frame d'IA, lu par hitBoss apres la garde).
 *     Une IA le passe > 1 pour ouvrir une fenetre de FAIBLESSE ponctuelle sans
 *     toucher a la garde (Cendrine : 2 pendant toute l'implosion de teleport,
 *     champ b.teleporting). api.hazard a un 5e parametre `merge` (px) : si une
 *     flaque de boss (temp) est plus proche que `merge`, les deux FUSIONNENT en
 *     une plaque plus large (cf. spawnHazardSpan / '%' contigus, cote game.js).
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
  //  CIBLE = TORSE du joueur (p.pos.y - TS), PAS ses pieds (p.pos) : joueur et
  //  boss sont ancres 'bot', donc viser p.pos depuis le torse du boss
  //  (b.pos.y - TS) ajoutait un biais de +TS vers le BAS -> a hauteur de sol
  //  egale l'eventail entier plongeait dans le plancher (et partait en bas-gauche
  //  quand Laura etait a gauche : le "boss qui tire dans le sol de droite a
  //  gauche" signale). Meme intention que shootH plus bas, mais ici on garde un
  //  vrai vecteur visee (pour toucher en surplomb) : on PLAFONNE juste la pente
  //  VERS LE BAS (SHOOT_DOWN_MAX) pour qu'aucun tir ne pique raide dans le sol
  //  meme joueur colle au boss. La visee VERS LE HAUT (y<0) reste LIBRE -> un
  //  boss qui doit tirer sur un joueur en surplomb continue de le viser.
  const SHOOT_DOWN_MAX = 0.30;   // pente max vers le bas (~17 deg) : a plat -> a peine descendant
  function shoot(b, p, api, speed, spread) {
    const torso = vec2(p.pos.x, p.pos.y - api.TS);         // vise le torse, pas les pieds
    let base = torso.sub(b.pos.add(0, -api.TS)).unit();
    // repere ecran : y>0 = vers le BAS -> on borne UNIQUEMENT la composante
    //  descendante (les tirs vers le haut, y<0, ne sont jamais touches).
    if (base.y > SHOOT_DOWN_MAX) base = vec2(base.x, SHOOT_DOWN_MAX).unit();
    const c = Math.cos(spread), s = Math.sin(spread);
    const d = vec2(base.x * c - base.y * s, base.x * s + base.y * c);
    api.bullet(b.pos.x, b.pos.y - api.TS, { pos: b.pos.add(d.scale(100)) }, speed, 'boss', b.def.shot);
  }
  // tir HORIZONTAL vers le joueur (cote gauche/droite), depuis le TORSE du boss.
  //  base = (sign(dx), 0) -> Y nul : ne plonge JAMAIS dans le sol (le joueur et
  //  le boss sont ancres 'bot', donc viser p.pos vers le bas envoyait le tir au
  //  ras du sol). "spread" est ici un ecart VERTICAL leger (eventail) en
  //  tournant ce vecteur horizontal -> reste quasi a plat. Le point de DEPART et
  //  le point VISE sont au MEME y (torse = b.pos.y - TS) : sinon le decalage TS
  //  entre spawn (torse) et cible (ancree b.pos = pieds) rajoutait un biais vers
  //  le bas (le tir "horizontal" plongeait quand meme de ~25 deg). api.bullet vise
  //  target.pos depuis (x,y), donc on construit la cible relative a CE meme y.
  function shootH(b, p, api, speed, spread) {
    const dir = Math.sign(p.pos.x - b.pos.x) || (b.dir || -1);
    const c = Math.cos(spread), s = Math.sin(spread);
    const ox = b.pos.x, oy = b.pos.y - api.TS;       // origine = torse
    const aim = vec2(ox + dir * 100 * c, oy + dir * 100 * s);  // cible au meme niveau (oy)
    api.bullet(ox, oy, { pos: aim }, speed, 'boss', b.def.shot);
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
      //  HORIZONTAUX vers le joueur (shootH = depuis le torse, Y nul -> ne
      //  plonge plus dans le sol ; l'ancien shoot() visait p.pos = pieds du
      //  joueur vers le bas et enfoncait les graphiques dans le plancher).
      b.animWant = 'attack';
      if (!b.threw && b.mt < 0.06) {
        api.poof(b.pos.x - 20, b.pos.y - api.TS * 1.4);
        api.poof(b.pos.x + 20, b.pos.y - api.TS * 0.8);
        api.poof(b.pos.x, b.pos.y - api.TS * 2);
      }
      if (!b.threw && b.mt > 0.3) {
        b.threw = true;
        [-0.12, 0, 0.12].forEach((s) => shootH(b, p, api, sp, s));
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
    const summonDelay = b.def.summonDelay || 0;// SUMMON : +delai apres le dernier tir avant l'invocation
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
      // +summonDelay : on attend ce delai apres le dernier tir (fin de salve =
      //  entree dans 'summon', b.st=0) avant de lancer l'invocation.
      if (!b.summoned && b.st >= summonDelay) {
        b.summoned = true;
        const n = (b.hp / b.maxHp < 0.5) ? 3 : 2;
        for (let i = 0; i < n; i++) spawnEnFace(b, p, api, 'cafard');
      }
      if (b.st > summonT + summonDelay) { b.state = 'load'; b.st = 0; b.burst = 0; }
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
   *  Teleportation TELEGRAPHEE (poof a la destination future) + eventail de
   *  formulaires HORIZONTAUX (shootH : ne plonge plus dans le sol) + FLAQUE au
   *  sol. Fenetre de vulnerabilite apres chaque salve (garde levee).
   *  Cycle : pre -> implosion/tp -> throw -> cast(flaque) -> window.
   *  TELEPORT = fenetre de FAIBLESSE : pendant TOUTE l'implosion (longue,
   *  implodeTime), b.teleporting -> b.dmgMult = 2 (DOUBLE degats, lu par hitBoss).
   *  FLAQUE : lobee apres une INCANTATION (castTime), elle TOMBE au sol (gere
   *  cote game.js : surfaceUnderFeet) et FUSIONNE avec une flaque voisine
   *  (< hazardMerge px) en une plaque plus large/plus durable. Espacees dans le
   *  temps (hazardEvery : pas a chaque salve).
   *  PHASE 2 : DOUBLE TP enchaine (apres le 1er throw, re-pre RACCOURCI
   *  (preTime x0.5) -> implosion -> 2e throw, PUIS cast/window), formN p2FormN,
   *  flaque plus longue (p2HazardDur), window plus courte (p2WindowTime).
   * ===================================================================== */
  AI.paperasse = function (b, p, api) {
    if (b.ps === undefined) { b.ps = 'pre'; b.pt = 0; b.destX = b.homeX; b.threw = false; b.chain = 0; b.destDone = false; b.hazCd = 0; b.casted = false; }
    if (b._baseScale === undefined) { b._baseScale = b.scale ? b.scale.clone() : vec2(1, 1); }
    if (b.p2Just) p2Tell(b, api);
    b.pt += dt();
    if (b.hazCd > 0) b.hazCd -= dt();          // cooldown de FLAQUE (espace les flaques dans le temps)
    const preT = (b.def.preTime || 0.4) * (b.chain ? 0.5 : 1);  // 2e TP du combo p2 : annonce raccourcie
    const imploT = b.def.implodeTime || 0.36;   // duree de l'implosion (TP LENT = fenetre de double-degats)
    const throwT = b.def.throwTime || 0.3;
    const castT = b.def.castTime || 0.45;       // INCANTATION avant que la flaque sorte
    const windowT = b.p2 ? (b.def.p2WindowTime || 0.9) : (b.def.windowTime || 1.2);
    const formN = b.p2 ? (b.def.p2FormN || 6) : (b.def.formN || 4);
    const hazardDur = b.p2 ? (b.def.p2HazardDur || 3.5) : (b.def.hazardDur || 2.5);
    const hazardEvery = b.def.hazardEvery || 4.2;     // delai mini entre deux flaques
    const hazardMerge = b.def.hazardMerge || 130;     // distance de FUSION de deux flaques (px)
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
      //  TP LENT (imploT double) + FENETRE DE FAIBLESSE : pendant TOUTE l'implosion
      //  Cendrine prend le DOUBLE de degats (b.teleporting -> b.dmgMult lu par
      //  hitBoss). On NE leve PAS guard (la garde reste la garde) : c'est juste un
      //  multiplicateur -> taper pendant le TP fait mal.
      faceOnly(b, p);
      b.animWant = 'idle';
      b.teleporting = true;
      b.dmgMult = b.def.teleDmgMult || 2;
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
        b.teleporting = false;
        api.poof(b.pos.x, b.pos.y - api.TS); api.poof(b.pos.x + 16, b.pos.y - api.TS - 12);
        faceOnly(b, p);
        b.ps = 'throw'; b.pt = 0; b.threw = false;
      }
    } else if (b.ps === 'throw') {
      // eventail de formulaires HORIZONTAUX (shootH : depuis le torse, Y nul -> ne
      //  plonge plus dans le sol ; l'ancien shoot() visait p.pos = pieds du joueur
      //  vers le bas et enfoncait les formulaires dans le plancher).
      b.animWant = 'attack';
      faceOnly(b, p);
      if (!b.threw) {
        b.threw = true;
        const half = (formN - 1) / 2;
        for (let i = 0; i < formN; i++) shootH(b, p, api, sp, (i - half) * 0.16);
        api.poof(b.pos.x, b.pos.y - api.TS);   // recul du jet (FX localise, pas de shake)
      }
      if (b.pt > throwT) { b.ps = 'cast'; b.pt = 0; b.casted = false; }
    } else if (b.ps === 'cast') {
      // INCANTATION DE FLAQUE : Cendrine prend son temps (castTime) puis projette
      //  une FLAQUE qui TOMBE au sol (surfaceUnderFeet cote game.js) sous Laura.
      //  hazCd : pas a chaque salve (hazardEvery). merge = fusion des flaques
      //  proches. Telegraphe : poofs montants qui s'intensifient pendant le cast.
      b.animWant = 'attack';
      faceOnly(b, p);
      api.poof(b.pos.x, b.pos.y - api.TS * (1 + b.pt / castT));   // incantation qui monte
      if (!b.casted && b.pt >= castT) {
        b.casted = true;
        if (b.hazCd <= 0 && inArena(b, p, api)) {
          // flaque au sol, telegraphe 0.5s, FUSION si une flaque est proche (<= merge)
          api.hazard(p.pos.x, p.pos.y, hazardDur, 0.5, hazardMerge);
          b.hazCd = hazardEvery;
        }
      }
      if (b.pt > castT + 0.1) {
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
   *  V3 : 4 PHASES en quarts (calme -> debat -> panique -> panique).
   *   >75%  (calme, Q&A)      : volees visees, deplacement lent, eventails 3.
   *   50-75% (debat)          : + minions + salves en ANNEAU.
   *   <50%  (verdict/panique) : "tir a fond" DES la phase 2 (et continue en
   *                             phase 3, <25% — MEME pattern) : ROTATION d'UNE
   *                             menace par beat (eventail rapide de panicN / MUR A
   *                             TROU a dasher / bombe ciblee + tampon), 1 esquive/beat.
   *  Aux transitions 0->1, 1->2 et 2->3 : INTERLUDE 'invite' — le jury "se
   *  concerte" (recule au fond, INVULNERABLE guard=0, aucun tir) et invoque
   *  un ANCIEN boss via api.addGuestBoss (0->1 agriculteur ; 1->2 rstudio ou
   *  michael ; 2->3 le complement — 3 invites DISTINCTS, ~30% de leurs HP). L'invite vaincu, pose
   *  d'enrage puis reprise. Sans api.addGuestBoss (ancien game.js),
   *  l'interlude est saute proprement (enrage seul, comportement historique).
   *  BATTEMENT DE VULNERABILITE : apres CHAQUE volee, b.openT = openTime
   *  (defaut 0.8s) pendant lequel guard = 1 -> on apprend a taper apres
   *  chaque salve.
   * ===================================================================== */
  AI.jury = function (b, p, api) {
    faceOnly(b, p);
    if (b.jPhase === undefined) {
      b.t = 0; b.cyc = 0; b.enrage = 0;
      b.openT = 0; b.jMode = 'fight'; b._guest = null; b.intangible = false;
      // CHECKPOINT DE PHASE (rebalance "combat final trop dur") : jPhase est
      //  initialise d'apres les HP COURANTS (pas toujours 0). A la mort, le joueur
      //  reprend AU DEBUT DE LA PHASE (respawnAtArena restaure b.hp = jCheckpointHp,
      //  cf. game.js) -> on RE-ENTRE dans la phase SANS rejouer l'interlude boss-rush
      //  (l'invite deja vaincu n'est pas reconvoque). jCheckpointHp = HP de debut de
      //  la phase courante = point de reprise.
      const f0 = b.hp / b.maxHp;
      b.jPhase = f0 > 0.75 ? 0 : (f0 > 0.5 ? 1 : (f0 > 0.25 ? 2 : 3));   // 4 phases en quarts
      b.jCheckpointHp = b.hp;
    }
    const frac = b.hp / b.maxHp;
    // 4 PHASES en quarts (V3) : 0 calme (>75%), 1 debat (50-75%), 2 ET 3 panique
    //  ("tir a fond" DES la phase 2, <50%, et continue en phase 3, <25%). Le
    //  dispatch d'attaque et la cadence traitent deja tout phase>=2 comme panique
    //  (branche 'else'), donc la 4e phase = 2e phase de panique, MEME intensite.
    const phase = frac > 0.75 ? 0 : (frac > 0.5 ? 1 : (frac > 0.25 ? 2 : 3));
    const sp = b.def.shotSpeed || 220;
    const baseEvery = b.def.shotEvery || 1.4;
    const range = b.range || 360;

    // --- transition de phase : BOSS RUSH (interlude 'invite') ou enrage ---
    if (phase !== b.jPhase) {
      const from = b.jPhase;
      b.jPhase = phase;
      // point de reprise = HP de DEBUT de la nouvelle phase (cf. respawnAtArena).
      //  floor (PAS round) : le checkpoint doit retomber STRICTEMENT dans la phase
      //  (frac <= seuil) -> sinon, restaure a frac > seuil, le joueur recroise le
      //  seuil et RE-declenche l'interlude boss-rush (invite reconvoque). cf. AI init.
      b.jCheckpointHp = Math.floor(b.maxHp * (phase === 1 ? 0.75 : phase === 2 ? 0.5 : 0.25));
      let invited = false;
      if (api.addGuestBoss && phase > from && b.jMode !== 'invite') {
        // 4 phases -> 3 invites (une par transition 0->1, 1->2, 2->3) :
        //  0->1 l'agriculteur ; 1->2 rstudio OU michael (au hasard, on retient
        //  lequel via b._jGuest1) ; 2->3 le COMPLEMENT (l'autre des deux) -> les
        //  trois invites sont distincts. "tout le reste identique" : on n'a fait
        //  qu'AJOUTER la 3e invite a la nouvelle transition.
        let key;
        if (from === 0) key = 'agriculteur';
        else if (from === 1) { key = (rand(0, 1) < 0.5 ? 'rstudio' : 'michael'); b._jGuest1 = key; }
        else key = (b._jGuest1 === 'rstudio') ? 'michael' : 'rstudio';
        b._guest = api.addGuestBoss(key, b.homeX, 0.30) || null;   // rebalance : 35% -> 30% des HP de l'invite
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
      b.intangible = true;                      // ...et ECARTE du combat : balles le traversent, ne bloque ni ne blesse (cf. hitBoss / no-collision boss<->boss). Sinon il sert de bouclier pare-balles a l'invite place derriere lui -> softlock.
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
        b.intangible = false;                   // redevient solide/touchable pour la reprise
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
    // PANIQUE (phases 2 ET 3, verdict <50% HP) : cadence DIVISEE PAR DEUX (delai
    //  double : 0.7 -> 1.4) -> le verdict tire MOITIE MOINS souvent que la phase
    //  0/1, le temps de lire chaque telegraphe rotatif. Tiers 0/1 inchanges.
    //  (phase>=2 tombe dans la meme branche -> la 4e phase tire comme la 3e.)
    const every = (phase === 0) ? baseEvery : (phase === 1 ? baseEvery * 0.85 : baseEvery * 1.4);

    if (b.t >= every) {
      b.t = 0; b.animWant = 'attack'; b.cyc++;

      if (phase === 0) {
        // Q&A calme : eventail vise de 3
        [-0.14, 0, 0.14].forEach((s) => shoot(b, p, api, sp, s));
      } else if (phase === 1) {
        // debat : eventail de 5 + un anneau de 8 (rebalance : 1 coup sur 3 au lieu
        //  d'1 sur 2 -> mur de balles moins dense) + minion fragile (1 sur 4)
        const half = 2;
        for (let i = 0; i < 5; i++) shoot(b, p, api, sp, (i - half) * 0.14);
        if (b.cyc % 3 === 0) {
          const ringN = b.def.ringN || 8;
          for (let i = 0; i < ringN; i++) {
            const a = (i / ringN) * Math.PI * 2;
            shootDir(b, api, vec2(Math.cos(a), Math.sin(a)), sp * 0.7, 'boss');
          }
        }
        if (b.cyc % 4 === 0) spawnEnFace(b, p, api, 'bug');   // vrai minion fragile (pas de passant)
      } else {
        // verdict / panique : on ROTATIONNE entre 3 menaces LISIBLES (une seule
        //  par beat) au lieu de toutes les empiler. Avant, chaque demi-seconde
        //  cumulait eventail de 9 + bombe ciblee + (bombe alea OU mur+tampon) :
        //  l'eventail couvrait l'horizontal, le mur le vertical, la bombe la
        //  position de Laura, le hazard le sol -> AUCUN espace sur, rencontre
        //  ingagnable (retour playtest "trop de missiles"). Desormais chaque beat
        //  = UN telegraphe a lire, puis on punit (le jury reste vulnerable :
        //  openTime > cadence). Les frappes CIBLEES restent gatees inArena.
        const n = b.def.panicN || 7;
        const half = (n - 1) / 2;
        const k = b.cyc % 3;
        if (k === 0) {
          // large eventail rapide (la signature de la panique)
          for (let i = 0; i < n; i++) shoot(b, p, api, sp * 1.05, (i - half) * 0.16);
        } else if (k === 1) {
          // MUR A TROU a dasher — menace VERTICALE seule (plus d'eventail simultane)
          wallWithHole(b, p, api, {});
        } else if (inArena(b, p, api)) {
          // frappe CIBLEE : UNE bombe sur Laura + tampon-piege au sol (pas d'eventail)
          api.dropBomb(p.pos.x, p.pos.y, 0.6, 'shot_bomb');
          api.hazard(p.pos.x, p.pos.y, 2.0, 0.5);
        }
      }
      // apres CHAQUE volee (tous modes) : battement de garde ouverte
      b.openT = b.def.openTime || 0.8;
    }
    clampHome(b);
  };

  /* =====================================================================
   *  CAMPAGNE MARCOS (Java) — 3 boss. Helpers communs : arcTo (projectile en
   *  cloche qui ATTERRIT sur une cible en T s), api.arc / api.mud / api.net
   *  (cf. game.js BOSS_API). Toutes les APIs Marcos sont gardees (api.arc && ...)
   *  pour ne jamais crasher sur un game.js plus ancien.
   * ===================================================================== */
  function arcTo(api, x, y, tx, ty, T, spr, o) {
    if (!api.arc) return null;
    const g = (o && o.g != null) ? o.g : 1100;
    const vx = (tx - x) / T;
    const vy = (ty - y - 0.5 * g * T * T) / T;
    return api.arc(x, y, vx, vy, spr, Object.assign({ g: g }, o || {}));
  }
  // eventail d'epines depuis un point d'impact (durian qui eclate) : demi-cercle vers le HAUT
  function spineBurst(b, api, at, n) {
    const spr = b.def.spine || b.def.shot;
    const k = Math.max(2, n || 4);
    for (let i = 0; i < k; i++) {
      const a = Math.PI + (i / (k - 1)) * Math.PI;
      api.bullet(at.x, at.y - 8, { pos: vec2(at.x + Math.cos(a) * 100, at.y - 8 + Math.sin(a) * 100) }, (b.def.shotSpeed || 280) * 0.8, 'boss', spr);
    }
  }
  // JUICE des boss Marcos (appele en FIN d'IA) : squash/stretch (b._sq : >0 etire,
  //  <0 ecrase, amorti tout seul), inclinaison lissee vers b.tilt (degres, remis a 0
  //  chaque frame -> l'IA le repose tant qu'elle le veut). rotate() ajoute a la volee.
  function juice(b) {
    if (!b._bs) b._bs = b.scale ? vec2(b.scale.x, b.scale.y) : vec2(1, 1);
    if (!b._rotOk) { try { b.use(rotate(0)); } catch (e) {} b._rotOk = true; }
    b._sq = (b._sq || 0) * Math.pow(0.0004, dt());
    b.scale = vec2(b._bs.x * (1 - b._sq * 0.55), b._bs.y * (1 + b._sq));
    b._ang = (b._ang || 0) + ((b.tilt || 0) - (b._ang || 0)) * Math.min(1, 12 * dt());
    b.angle = b._ang;
    b.tilt = 0;
  }
  // OMBRE au sol d'un boss volant (Garuda) : ellipse qui retrecit avec l'altitude.
  function flyShadow(b, gY) {
    if (!b._shadow) {
      b._shadow = add([circle(34), pos(b.pos.x, gY), anchor('center'), color(20, 30, 20), opacity(0.28), scale(1, 0.26), z(-0.45)]);
      b.onDestroy(() => { if (b._shadow && b._shadow.exists()) destroy(b._shadow); });
    }
    const alt = Math.max(0, gY - b.pos.y), k = Math.max(0.35, 1 - alt / (TS * 6));
    b._shadow.pos = vec2(b.pos.x, gY - 2);
    b._shadow.scale = vec2(k, 0.26 * k);
    b._shadow.opacity = 0.12 + 0.2 * k;
  }

  // borne un X dans l'arene du boss (marge pad px aux bords)
  function arenaX(b, x, pad) {
    const r = (b.range || 360) - (pad == null ? TS * 1.2 : pad);
    return Math.max(b.homeX - r, Math.min(b.homeX + r, x));
  }

  /* ---------------------------------------------------------------------
   *  RAJA TIKUS, le roi des rats (marcos_rizieres) — IA 'tikus'.
   *  scurry -> burrow -> under -> warn -> erupt -> dazed (PUNITION) [-> squeak 1/2].
   *  Sous terre il est INTANGIBLE et INVISIBLE : seule une bosse de boue qui
   *  file vers Marcos le trahit. Il JAILLIT apres un marqueur (eruptWarn) en
   *  crachant des mottes de boue, puis reste SONNE. P2 : deux plongees
   *  enchainees et chaque jaillissement laisse des flaques de boue temporaires.
   * --------------------------------------------------------------------- */
  AI.tikus = function (b, p, api) {
    if (b.ks === undefined) { b.ks = 'scurry'; b.kt = 0; b.cyc = 0; b.dives = 0; b.fx = 0; b.shot = false; }
    if (b.p2Just) p2Tell(b, api);
    b.kt += dt();
    const D = b.def;
    const groundY = b._restY != null ? b._restY : b.pos.y;
    const setHidden = (h) => { b.intangible = h; b.hidden = h; };

    if (b.ks === 'scurry') {
      faceOnly(b, p);
      setHidden(false);
      // s'approche mais garde une distance (keepGap) : il menace, il ne colle pas.
      //  kt < 0 = recuperation apres la phase sonnee (il se secoue sur place).
      if (b.kt >= 0 && Math.abs(p.pos.x - b.pos.x) > TS * (D.keepGap || 0)) moveClamp(b, p, D.speed || 190);
      // coup de queue de proximite : pose d'attaque (le contact fait mal)
      b.animWant = (Math.abs(p.pos.x - b.pos.x) < TS * ((D.keepGap || 1.5) + 0.4)) ? 'whip' : 'idle';
      if (b.kt > (D.scurryTime || 2.2)) { b.ks = 'burrow'; b.kt = 0; b.dives = b.p2 ? 2 : 1; }
    } else if (b.ks === 'burrow') {
      // TELEGRAPHE : creuse (pose attaque + gerbes de boue) puis disparait
      b.animWant = 'attack';
      faceOnly(b, p);
      b.fx += dt();
      if (b.fx > 0.08) { b.fx = 0; api.poof(b.pos.x + rand(-20, 20), groundY - 4); }
      b.animWant = 'burrow';
      if (b.kt > 0.5) { b.intangible = true; b.ks = 'under'; b.kt = 0; }
    } else if (b.ks === 'under') {
      // INTANGIBLE : il file SOUS la boue, on ne voit que sa bosse de terre et sa couronne
      b.animWant = 'under';
      b.tilt = Math.sin(b.kt * 18) * 4;
      moveDirClamp(b, Math.sign(p.pos.x - b.pos.x) || 1, (D.speed || 190) * 1.25);
      b.fx += dt();
      if (b.fx > 0.07) { b.fx = 0; api.poof(b.pos.x + rand(-8, 8), groundY - 2); }
      if (b.kt > (D.burrowTime || 1.5) || Math.abs(p.pos.x - b.pos.x) < TS * 0.5) {
        b.ex = arenaX(b, b.pos.x, TS * 0.6);      // jaillit LA OU EST LA BOSSE (lisible : on s'en ecarte)
        if (api.marker) api.marker(b.ex, groundY, D.eruptWarn || 0.75);
        b.ks = 'warn'; b.kt = 0;
      }
    } else if (b.ks === 'warn') {
      // le marqueur au sol = la ou il va JAILLIR : il faut s'en ecarter (la bosse tremble)
      b.animWant = 'under';
      b.pos.x = b.ex + Math.sin(b.kt * 70) * 3;
      b.fx += dt();
      if (b.fx > 0.1) { b.fx = 0; api.poof(b.ex + rand(-14, 14), groundY - 2); }
      if (b.kt > (D.eruptWarn || 0.75)) {
        b.pos.x = b.ex; setHidden(false);
        b.animWant = 'erupt'; b._sq = 0.38;
        if (b.jump) { try { b.jump(520); } catch (e) {} }
        for (let i = 0; i < 6; i++) api.poof(b.ex + rand(-30, 30), groundY - rand(0, 30));
        // mottes de boue en eventail ; P2 : chaque motte laisse une flaque temporaire
        const n = (b.p2 && D.p2ClodN) ? D.p2ClodN : (D.clodN || 5);
        for (let i = 0; i < n; i++) {
          const tx = b.ex + (i - (n - 1) / 2) * TS * 1.5;
          arcTo(api, b.ex, groundY - TS, tx, groundY - 4, 0.75, D.shot, {
            col: [96, 66, 40], r: 9,
            onLand: (b.p2 && api.mud) ? ((at) => api.mud(at.x, at.y - 6, D.mudDur || 5, 1)) : null,
          });
        }
        if (api.mud && b.p2) api.mud(b.ex, groundY - 6, D.mudDur || 5, 2);
        b.ks = 'erupt'; b.kt = 0; b.dives--;
      }
    } else if (b.ks === 'erupt') {
      b.animWant = 'erupt';
      if (b.kt > 0.45) {
        if (b.dives > 0) { b.ks = 'burrow'; b.kt = 0.2; }     // P2 : replonge aussitot
        else { b.ks = 'dazed'; b.kt = 0; }
      }
    } else if (b.ks === 'dazed') {
      // SONNE (etoiles au-dessus de la tete) : FENETRE DE PUNITION
      b.animWant = 'hurt';
      b.tilt = Math.sin(b.kt * 5) * 7;
      b.guard = 1;
      b.fx += dt();
      if (b.fx > 0.3) { b.fx = 0; api.poof(b.pos.x + rand(-16, 16), b.pos.y - TS * 2.2); }
      if (b.kt > (b.p2 ? (D.p2DazedTime || 1.4) : (D.dazedTime || 1.9))) {
        b.cyc++;
        b.ks = (b.cyc % (D.squeakEvery || 2) === 0) ? 'squeak' : 'scurry'; b.kt = (b.ks === 'scurry') ? -0.6 : 0; b.shot = false;
      }
    } else {
      // SQUEAK : appelle ses rats (ils debarquent des bords de l'arene)
      faceOnly(b, p);
      b.animWant = 'erupt';
      if (b.kt < 0.05) b._sq = 0.2;
      if (!b.shot && b.kt > 0.35) {
        b.shot = true;
        const n = b.p2 ? (D.p2RatN || 3) : (D.ratN || 2);
        for (let i = 0; i < n; i++) {
          const side = (i % 2 === 0) ? -1 : 1;
          const x = arenaX(b, b.homeX + side * (b.range || 400), TS * 1.5);
          api.poof(x, groundY - TS * 0.4);
          api.add('rat', x, groundY);
        }
      }
      if (b.kt > 0.8) { b.ks = 'scurry'; b.kt = 0; }
    }
    if (!b.intangible) p2Pose(b);
    b.harmless = (b.ks === 'dazed');                 // sonne : on peut venir taper au contact sans se blesser
    if (b.ks === 'scurry' && b.animWant === 'idle') b.tilt = Math.sin(b.kt * 16) * 3;   // trottine
    clampHome(b);
    juice(b);
  };

  /* ---------------------------------------------------------------------
   *  PAK DURIAN, le vendeur a scooter (marcos_village) — IA 'scooter'.
   *  honk (klaxon, telegraphe) -> charge (traverse l'arene, seme des durians-
   *  mines) [P2 : rewind + charge retour] -> lob (durians en cloche qui
   *  eclatent en epines) -> panne (fumee : PUNITION). P2 : pluie de durians
   *  pendant le klaxon.
   * --------------------------------------------------------------------- */
  AI.scooter = function (b, p, api) {
    if (b.ss === undefined) { b.ss = 'honk'; b.st = 0; b.dir = -1; b.mineT = 0; b.returned = false; b.shot = false; b.fx = 0; b.mines = []; }
    if (b.p2Just) p2Tell(b, api);
    b.st += dt();
    const D = b.def;
    const groundY = b._restY != null ? b._restY : b.pos.y;
    b.mines = b.mines.filter((m) => m && m.exists && m.exists());

    if (b.ss === 'honk') {
      faceOnly(b, p);
      b.animWant = 'honk';
      b._sq = Math.sin(b.st * 40) * 0.035;
      if (!b.shot) {
        b.shot = true;
        const towardP = Math.sign(p.pos.x - b.pos.x) || -1;
        const towardHome = Math.sign(b.homeX - b.pos.x) || -1;
        b.dir = (Math.abs(b.pos.x - b.homeX) > b.range * 0.6) ? towardHome : towardP;
        if (api.sfx) api.sfx('boss');
        // P2 : pluie de durians (bombes ombrees) autour de Marcos
        if (b.p2 && inArena(b, p, api) && api.dropBomb) {
          const n = D.rainN || 4;
          for (let i = 0; i < n; i++) api.dropBomb(arenaX(b, p.pos.x + (i - (n - 1) / 2) * TS * 2.2, TS), p.pos.y, 0.9 + i * 0.18, D.bomb || D.shot);
        }
      }
      // phare qui clignote devant le scooter = "il va charger"
      b.fx += dt();
      if (b.fx > 0.12) { b.fx = 0; api.poof(b.pos.x + b.dir * TS * 1.1, b.pos.y - TS * 0.7); }
      if (b.st > (D.honkTime || 0.8)) { b.ss = 'charge'; b.st = 0; b.mineT = 0; b.returned = false; }
    } else if (b.ss === 'charge') {
      b.flipX = b.dir > 0; b.facing = b.dir;
      b.animWant = 'charge';
      b.tilt = -b.dir * (7 + Math.sin(b.st * 22) * 2);          // roue arriere qui sautille
      const edge = moveDirClamp(b, b.dir, D.chargeSpeed || 520);
      b.mineT += dt();
      if (b.mineT >= (D.mineEvery || 0.32) && b.mines.length < 7) {
        b.mineT = 0;
        const m = api.add('durian', b.pos.x - b.dir * TS * 0.6, groundY);   // durian-mine semee derriere lui
        if (m) {
          b.mines.push(m);
          wait(D.mineLife || 4.5, () => { if (m.exists()) { api.poof(m.pos.x, m.pos.y - 10); destroy(m); } });
        }
      }
      b.fx += dt();
      if (b.fx > 0.08) { b.fx = 0; api.poof(b.pos.x - b.dir * TS, b.pos.y - 6); }
      if (edge) {
        if (b.p2 && !b.returned) { b.ss = 'rewind'; b.st = 0; }
        else { b.ss = 'lob'; b.st = 0; b.shot = false; }
      }
    } else if (b.ss === 'rewind') {
      b.animWant = 'settle';
      b.tilt = b.dir * 6;                                       // derapage avant le demi-tour
      if (b.st < 0.05) api.poof(b.pos.x, b.pos.y - TS);
      if (b.st > 0.4) { b.dir = -b.dir; b.returned = true; b.ss = 'charge'; b.st = 0; }
    } else if (b.ss === 'lob') {
      faceOnly(b, p);
      b.animWant = 'throw';
      if (!b.shot && b.st > 0.3) {
        b.shot = true; b._sq = 0.14;
        const n = (b.p2 && D.p2LobN) ? D.p2LobN : (D.lobN || 3);
        for (let i = 0; i < n; i++) {
          const tx = arenaX(b, p.pos.x + (i - (n - 1) / 2) * TS * 1.8, TS * 0.5);
          arcTo(api, b.pos.x, b.pos.y - TS * 1.4, tx, groundY - 6, 0.85 + i * 0.12, D.shot, {
            col: [120, 160, 50], r: 12, spin: 200,
            onLand: (at) => spineBurst(b, api, at, b.p2 ? 5 : 4),
          });
        }
      }
      if (b.st > (D.lobTime || 1.2)) { b.ss = 'panne'; b.st = 0; }
    } else {
      // PANNE : le scooter cale et fume -> FENETRE DE PUNITION
      b.animWant = 'hurt';
      b.tilt = Math.sin(b.st * 26) * 2.5;
      b.guard = 1;
      b.fx += dt();
      if (b.fx > 0.22) { b.fx = 0; api.poof(b.pos.x - (b.facing || 1) * TS * 0.8, b.pos.y - TS * 0.8); }
      if (b.st > (b.p2 ? (D.p2BreakTime || 1.5) : (D.breakTime || 2.0))) { b.ss = 'honk'; b.st = 0; b.shot = false; b._sq = 0.12; }
    }
    b.harmless = (b.ss === 'panne');                 // scooter en panne : contact sans danger
    p2Pose(b);
    clampHome(b);
    juice(b);
  };

  /* ---------------------------------------------------------------------
   *  GARUDA, l'homme-oiseau (marcos_parcelle, boss FINAL de Marcos) — IA 'garuda'.
   *  Il VOLE (gravite coupee) : hover -> UNE attaque par cycle, en rotation :
   *   flock : lache des piafs tete-chercheuse ;
   *   net   : jette un FILET en cloche qui immobilise (marteler SAUT) ;
   *   dive  : marque la cible au sol, PIQUE en coup de bec -> bec PLANTE dans
   *           le sol = PUNITION (stuck), onde de choc des 2 cotes a l'impact.
   *  P2 : plus haut, filet -> pique ENCHAINES, eventail de plumes, 2 piques.
   * --------------------------------------------------------------------- */
  const GARUDA_P1 = ['flock', 'net', 'dive'];
  const GARUDA_P2 = ['feathers', 'net', 'flock', 'dive'];
  AI.garuda = function (b, p, api) {
    if (b.gs === undefined) {
      b.gs = 'takeoff'; b.gt = 0; b.cyc = 0; b.shot = false; b.fx = 0; b.side = 1; b.divesLeft = 0;
      b.gY = b._restY != null ? b._restY : b.pos.y;
    }
    if (b.p2Just) p2Tell(b, api);
    b.gt += dt();
    const D = b.def;
    const gY = b.gY;
    const alt = (b.p2 ? (D.p2HoverAlt || 3.0) : (D.hoverAlt || 2.4)) * TS;
    const fly = () => { try { b.gravityScale = 0; } catch (e) {} if (b.vel) b.vel = vec2(0, 0); };
    const glideTo = (tx, ty, k) => {
      const r = (b.range || 400) - TS;
      const cx = Math.max(b.homeX - r, Math.min(b.homeX + r, tx));
      b.pos.x += (cx - b.pos.x) * Math.min(1, k * dt());
      b.pos.y += (ty - b.pos.y) * Math.min(1, k * dt());
    };
    fly();

    if (b.gs === 'takeoff') {
      faceOnly(b, p); b.animWant = 'flap';
      if (b.gt < 0.05) b._sq = -0.2;
      glideTo(b.pos.x, gY - alt, 3);
      if (b.gt < 0.05) { api.poof(b.pos.x - 20, gY - 4); api.poof(b.pos.x + 20, gY - 4); }
      if (b.gt > 0.8) { b.gs = 'hover'; b.gt = 0; }
    } else if (b.gs === 'hover') {
      faceOnly(b, p); b.animWant = 'idle';
      b.tilt = Math.sin(b.gt * 2.4) * 4;
      // plane a cote de Marcos (cote alterne a chaque cycle), en ondulant
      glideTo(p.pos.x + b.side * TS * 3, gY - alt + Math.sin(b.gt * 2.4) * 10, 2.2);
      if (b.gt > (D.hoverTime || 1.6)) {
        const rot = b.p2 ? GARUDA_P2 : GARUDA_P1;
        b.gs = rot[b.cyc % rot.length]; b.cyc++; b.gt = 0; b.shot = false; b.side = -b.side;
        if (b.gs === 'dive') b.divesLeft = b.p2 ? 2 : 1;
      }
    } else if (b.gs === 'flock') {
      faceOnly(b, p); b.animWant = 'summon';
      glideTo(b.pos.x, gY - alt, 2);
      if (!b.shot && b.gt > 0.3) {
        b.shot = true;
        const n = D.piafN || 3;
        for (let i = 0; i < n; i++) {
          const x = b.pos.x + (i - (n - 1) / 2) * 30, y = b.pos.y - TS * 1.6 - i * 10;
          api.poof(x, y);
          api.add('piaf', x, y);
        }
      }
      if (b.gt > 0.9) { b.gs = 'hover'; b.gt = 0; }
    } else if (b.gs === 'net') {
      faceOnly(b, p); b.animWant = 'net';
      glideTo(b.pos.x, gY - alt, 2);
      if (!b.shot && b.gt > 0.35) {
        b.shot = true;
        const ox = b.pos.x, oy = b.pos.y - TS * 1.2;
        const nets = [p.pos.x];
        if (b.p2) nets.push(p.pos.x + (p.facing || 1) * TS * 2.5);   // P2 : un 2e filet qui anticipe la fuite
        nets.forEach((tx, i) => arcTo(api, ox, oy, tx, p.pos.y - TS * 0.6, 0.75 + i * 0.15, D.net, {
          net: true, netTime: D.netTime || 1.6, dmg: 0, g: 900, spin: 70, col: [235, 225, 195], r: 14,
        }));
      }
      if (b.gt > 0.8) {
        // P2 : filet -> PIQUE enchaine (le vrai danger : se liberer a temps)
        if (b.p2) { b.gs = 'dive'; b.divesLeft = 1; } else b.gs = 'hover';
        b.gt = 0; b.shot = false;
      }
    } else if (b.gs === 'feathers') {
      faceOnly(b, p); b.animWant = 'flap';
      if (!b.shot && b.gt > 0.3) {
        b.shot = true; b._sq = 0.18;
        const n = D.featherN || 5;
        for (let i = 0; i < n; i++) shoot(b, p, api, D.shotSpeed || 330, (i - (n - 1) / 2) * 0.17);
      }
      if (b.gt > 0.75) { b.gs = 'hover'; b.gt = 0; }
    } else if (b.gs === 'dive') {
      // TELEGRAPHE : s'eleve un peu, marque la cible au sol, se ramasse avant de piquer
      faceOnly(b, p); b.animWant = 'flap';
      b.tilt = -(b.facing || 1) * 10;
      if (!b.shot) {
        b.shot = true;
        b.tx = Math.max(b.homeX - b.range + TS, Math.min(b.homeX + b.range - TS, p.pos.x));
        if (api.marker) api.marker(b.tx, gY, D.diveWarn || 0.6);
      }
      glideTo(b.tx + (b.tx > b.pos.x ? -TS * 2 : TS * 2), gY - alt - TS * 0.6, 3);
      if (b.gt > (D.diveWarn || 0.6)) { b.gs = 'diving'; b.gt = 0; }
    } else if (b.gs === 'diving') {
      b.animWant = 'dive';
      b.tilt = (b.tx > b.pos.x ? 1 : -1) * 24;                 // pique bec en avant
      const to = vec2(b.tx - b.pos.x, gY - b.pos.y);
      const step = (D.diveSpeed || 720) * dt();
      b.flipX = to.x > 0;
      if (to.len() <= step || b.pos.y >= gY - 2 || b.gt > 1.2) {
        b.pos.x = b.tx; b.pos.y = gY;
        // BEC PLANTE : onde de choc des 2 cotes (sauter !) + poussiere
        for (let i = 0; i < 5; i++) api.poof(b.pos.x + rand(-30, 30), gY - rand(0, 16));
        if (api.quake) { api.quake(b.pos.x, 1, 200); api.quake(b.pos.x, -1, 200); }
        b._sq = -0.3;
        b.divesLeft--;
        b.gs = 'stuck'; b.gt = 0;
      } else b.pos = b.pos.add(to.unit().scale(step));
    } else if (b.gs === 'stuck') {
      // BEC COINCE dans le sol : FENETRE DE PUNITION. P2 : 2e pique s'il en reste
      b.pos.y = gY;
      b.animWant = 'hurt';
      b.tilt = Math.sin(b.gt * 30) * 3;                         // se debat, bec coince
      b.guard = 1;
      const stuckT = b.p2 ? (D.p2StuckTime || 1.4) : (D.stuckTime || 1.9);
      if (b.divesLeft > 0 && b.gt > stuckT * 0.45) { b.gs = 'dive'; b.gt = 0; b.shot = false; }
      else if (b.gt > stuckT) { b.gs = 'recover'; b.gt = 0; }
    } else {
      // REDECOLLE vers son altitude
      faceOnly(b, p); b.animWant = 'flap';
      glideTo(b.pos.x, gY - alt, 3);
      if (b.gt > 0.6) { b.gs = 'hover'; b.gt = 0; }
    }
    p2Pose(b);
    clampHome(b);
    flyShadow(b, gY);
    juice(b);
  };

  return AI;
})();
