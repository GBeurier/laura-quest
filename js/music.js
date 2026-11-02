/* =====================================================================
 *  MUSIC — Lecteur MIDI "chiptune" en Web Audio pur (window.LQ_MUSIC).
 *
 *  Les musiques du jeu sont des .mid embarques en base64 dans
 *  window.ASSETS.music (genere par gen_assets_data.py). Ce fichier les
 *  parse (SMF format 0/1 : running status, tempo map, VLQ) et les joue
 *  avec une synthese VOLONTAIREMENT lo-fi facon console 8-bit : ondes
 *  carrees / triangle / dent de scie pour les canaux melodiques, bruit
 *  blanc enveloppe pour les percussions (canal 9). Zero dependance,
 *  zero reseau, marche en file://.
 *
 *  Contrat (consomme par game.js, charge APRES assets_data/config) :
 *    LQ_MUSIC.play(name)    -> demande une piste ; no-op total si c'est
 *                              deja la piste en cours (les scenes rappellent
 *                              play() a chaque ecran -> pas de coupure)
 *    LQ_MUSIC.stop()        -> coupe et oublie la piste desiree
 *    LQ_MUSIC.setEnabled(b) -> mute/unmute a chaud (touche M dans game.js)
 *    LQ_MUSIC.current       -> nom de la piste desiree (ou null)
 *
 *  IMPORTANT : game.js fait window.ASSETS = null apres son chargement pour
 *  liberer la memoire -> on CAPTURE la reference music ICI, au chargement.
 *  Tout est defensif : pas de window.ASSETS.music / pas d'AudioContext /
 *  .mid illisible -> no-op silencieux, JAMAIS de crash.
 * ===================================================================== */
window.LQ_MUSIC = (() => {
  'use strict';
  const C = window.CONFIG || {};
  // Capture AVANT que game.js ne fasse window.ASSETS = null.
  const MUSIC = (window.ASSETS && window.ASSETS.music) || {};

  // typeof : musicVolume = 0 (silence voulu) est falsy, un `||` le mangerait
  const masterVol = () => (C.audio && typeof C.audio.musicVolume === 'number') ? C.audio.musicVolume : 0.25;
  const enabledCfg = () => !(C.audio && C.audio.music === false);

  // --- Reglages de l'ordonnanceur lookahead ----------------------------
  const LOOKAHEAD = 0.35;   // s : on programme les notes des 0.35 s a venir
  const TICK_MS = 120;      // periode du setInterval de l'ordonnanceur
  const LOOP_PAD = 0.5;     // s de silence entre la derniere note et la reprise
  const ORPHAN_DUR = 2;     // s : duree d'un note-on jamais ferme
  const NOTE_GAIN = 0.12;   // les ondes carrees sont fortes -> gain par note bas

  /* ===================================================================
   *  PARSEUR MIDI (SMF format 0 et 1)
   *  Sortie : { notes: [{t, dur, note, vel, ch}] triees par t,
   *             end: fin de la derniere note (s), waveOf: {ch: forme} }
   * =================================================================== */
  function parseMidi(bytes) {
    const u32 = (p) => (((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0);
    const u16 = (p) => ((bytes[p] << 8) | bytes[p + 1]);
    const tag = (p) => String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);

    if (bytes.length < 14 || tag(0) !== 'MThd') throw new Error('pas un fichier MIDI');
    const hlen = u32(4);
    const division = u16(12);
    if (division & 0x8000) throw new Error('division SMPTE non geree');
    const tpq = division || 480;            // ticks par noire

    const raw = [];      // notes en ticks absolus {onTick, offTick|null, note, vel, ch}
    const tempos = [];   // tempo map {tick, us} (us par noire), toutes pistes fondues
    let eotTick = 0;     // tick du meta End-of-Track le plus tardif (souvent cale sur la mesure)

    // --- Une piste MTrk ------------------------------------------------
    function parseTrack(start, end) {
      let p = start, tick = 0, running = 0;
      const pend = {};   // (ch*128+note) -> pile de {tick, vel} (note-on ouverts)
      const vlq = () => {
        let v = 0, b;
        do { b = bytes[p++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80 && p < end);
        return v;
      };
      while (p < end) {
        tick += vlq();                       // delta-time
        if (p >= end) break;
        let st = bytes[p];
        if (st < 0x80) st = running;         // RUNNING STATUS : on reutilise le dernier
        else { p++; if (st < 0xf0) running = st; }
        if (st === 0xff) {                   // meta : type, longueur VLQ, donnees
          const type = bytes[p++];
          const len = vlq();
          if (type === 0x51 && len === 3)    // Set Tempo (il peut y en avoir plusieurs)
            tempos.push({ tick: tick, us: (bytes[p] << 16) | (bytes[p + 1] << 8) | bytes[p + 2] });
          p += len;
          if (type === 0x2f) {               // End of Track : son tick sert de longueur de boucle
            if (tick > eotTick) eotTick = tick;
            break;
          }
        } else if (st === 0xf0 || st === 0xf7) {
          p += vlq();                        // sysex : longueur VLQ, on saute
        } else if (st >= 0x80 && st < 0xf0) {
          const kind = st & 0xf0, ch = st & 0x0f;
          const d1 = bytes[p++];
          // program change (0xC0) / channel pressure (0xD0) : 1 octet ; le reste 2
          const d2 = (kind === 0xc0 || kind === 0xd0) ? 0 : bytes[p++];
          if (kind === 0x90 && d2 > 0) {     // note-on
            (pend[ch * 128 + d1] = pend[ch * 128 + d1] || []).push({ tick: tick, vel: d2 });
          } else if (kind === 0x80 || (kind === 0x90 && d2 === 0)) {  // note-off (velocite 0 = off !)
            const stk = pend[ch * 128 + d1];
            const on = stk && stk.pop();
            if (on) raw.push({ onTick: on.tick, offTick: tick, note: d1, vel: on.vel, ch: ch });
          }
          // 0xA0/0xB0/0xE0 (2 oct) et 0xC0/0xD0 (1 oct) : deja sautes ci-dessus
        } else {
          break;                             // statut systeme inattendu : on abandonne la piste
        }
      }
      // note-on jamais fermes -> duree bornee plus tard (offTick null)
      for (const k in pend) for (const on of pend[k])
        raw.push({ onTick: on.tick, offTick: null, note: k & 127, vel: on.vel, ch: (k / 128) | 0 });
    }

    // --- Chunks : MThd puis n MTrk (les chunks inconnus sont sautes) ---
    let pos = 8 + hlen;
    while (pos + 8 <= bytes.length) {
      const id = tag(pos), clen = u32(pos + 4);
      const start = pos + 8, end = Math.min(start + clen, bytes.length);
      if (id === 'MTrk') parseTrack(start, end);
      pos = start + clen;
    }

    // --- Tempo map : ticks -> secondes (defaut 120 BPM = 500000 us/noire)
    tempos.sort((a, b) => a.tick - b.tick);
    const segs = [{ tick: 0, sec: 0, spt: 500000 / (tpq * 1e6) }];
    for (const t of tempos) {
      const prev = segs[segs.length - 1];
      const sec = prev.sec + (t.tick - prev.tick) * prev.spt;
      if (t.tick === prev.tick) { prev.spt = t.us / (tpq * 1e6); prev.sec = sec; }
      else segs.push({ tick: t.tick, sec: sec, spt: t.us / (tpq * 1e6) });
    }
    const tickToSec = (tick) => {
      let s = segs[0];
      for (let i = segs.length - 1; i >= 0; i--) if (segs[i].tick <= tick) { s = segs[i]; break; }
      return s.sec + (tick - s.tick) * s.spt;
    };

    // --- Notes en secondes, triees ; fin de piste ; forme d'onde par canal
    const notes = [];
    let last = 0;
    for (const r of raw) {
      const t = tickToSec(r.onTick);
      const dur = r.offTick == null ? ORPHAN_DUR : Math.max(0.04, tickToSec(r.offTick) - t);
      notes.push({ t: t, dur: dur, note: r.note, vel: r.vel / 127, ch: r.ch });
      if (t + dur > last) last = t + dur;
    }
    notes.sort((a, b) => a.t - b.t);
    // Formes d'onde par canal : le canal le plus GRAVE (pitch moyen) = basse
    //  (triangle), les autres = carre puis dent de scie en alternance dans
    //  l'ordre du premier note-ON. PAS l'ordre du tableau `notes` : une note
    //  n'y entre qu'a son note-OFF, donc deux canaux qui demarrent au meme
    //  tick y "apparaissent" dans l'ordre de leurs FINS (basse et melodie
    //  s'inversaient sur la moitie des pistes). Canal 9 = percussions, a part.
    const stat = {};
    for (const r of raw) {
      if (r.ch === 9) continue;
      const s = stat[r.ch] || (stat[r.ch] = { first: r.onTick, sum: 0, n: 0 });
      if (r.onTick < s.first) s.first = r.onTick;
      s.sum += r.note; s.n++;
    }
    const chans = Object.keys(stat).sort((a, b) => (stat[a].first - stat[b].first) || (a - b));
    const waveOf = {};
    let bass = null;
    if (chans.length > 1) {                  // un seul canal = melodie seule, pas de basse
      bass = chans.reduce((m, c) => (stat[c].sum / stat[c].n < stat[m].sum / stat[m].n ? c : m), chans[0]);
      waveOf[bass] = 'triangle';
    }
    let i = 0;
    for (const c of chans) {
      if (c === bass) continue;
      waveOf[c] = (i++ % 2 === 0) ? 'square' : 'sawtooth';
    }
    return { notes: notes, end: last, eot: eotTick ? tickToSec(eotTick) : 0, waveOf: waveOf };
  }

  // --- Cache de pistes parsees (base64 -> notes ; un seul parse par nom)
  const cache = Object.create(null);
  const warned = Object.create(null);
  function getTrack(name) {
    if (name in cache) return cache[name];
    let out = null;
    try {
      const bin = atob(MUSIC[name]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      out = parseMidi(bytes);
    } catch (e) {
      console.warn('[LQ_MUSIC] piste illisible :', name, e && e.message);
      out = null;     // piste consideree vide, pas de crash
    }
    cache[name] = out;
    return out;
  }

  /* ===================================================================
   *  SYNTHESE — AudioContext paresseux + ordonnanceur lookahead
   * =================================================================== */
  let ctx = null, master = null, noiseBuf = null;
  let session = null;   // lecture en cours : {name, gain, timer, trk, t0, idx, loopLen}
  let desired = null;   // piste demandee (retenue meme muette / inconnue)

  // Politique autoplay + interruptions : un contexte peut etre 'suspended' au
  //  boot (pas encore de geste) mais AUSSI se re-suspendre plus tard ('interrupted'
  //  webkit : verrouillage d'ecran / appel sur iOS) -> listeners PERMANENTS
  //  (legers) : tout geste utilisateur et tout retour d'onglet retentent un
  //  resume() tant que l'etat n'est pas 'running'.
  function tryResume() {
    try {
      if (!ctx || ctx.state === 'running') return;
      const pr = ctx.resume();
      if (pr && pr.catch) pr.catch(() => {});
    } catch (e) {}
  }

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = masterVol();
      master.connect(ctx.destination);
      // Bruit blanc PARTAGE pour toutes les percussions (cree une fois).
      const len = Math.floor(ctx.sampleRate * 0.4);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      window.addEventListener('pointerdown', tryResume);
      window.addEventListener('keydown', tryResume);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) tryResume(); });
    } catch (e) { ctx = null; }
    return ctx;
  }

  // --- Une note melodique : oscillateur + enveloppe anti-clic ----------
  function schedTone(s, n, t) {
    const osc = ctx.createOscillator();
    osc.type = s.trk.waveOf[n.ch] || 'square';
    osc.frequency.value = 440 * Math.pow(2, (n.note - 69) / 12);
    const g = ctx.createGain();
    const peak = n.vel * NOTE_GAIN;
    const dur = Math.max(0.05, n.dur), rel = 0.03;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.005);                       // attaque ~5 ms
    g.gain.linearRampToValueAtTime(peak * 0.7, t + Math.min(0.08, dur * 0.5)); // petite decroissance
    g.gain.setValueAtTime(peak * 0.7, t + dur);                            // tenue
    g.gain.linearRampToValueAtTime(0, t + dur + rel);                      // release court, pas de clic
    osc.connect(g); g.connect(s.gain);
    osc.start(t); osc.stop(t + dur + rel + 0.01);                          // pas de ref retenue -> GC
  }

  // --- Une percussion (canal 9 GM) : bruit blanc, decroissance rapide --
  function schedDrum(s, n, t) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    let rate = 1.0, dec = 0.09;                       // defaut : caisse claire
    if (n.note <= 36) { rate = 0.3; dec = 0.14; }     // grosse caisse : sourde et grave
    else if (n.note >= 42 && n.note <= 46) { rate = 2.2; dec = 0.035; }  // charley : claquant
    else if (n.note >= 49) { rate = 1.5; dec = 0.25; }                   // cymbales : trainantes
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.05, n.vel) * 0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    src.connect(g); g.connect(s.gain);
    src.start(t); src.stop(t + dec + 0.02);
  }

  // --- Ordonnanceur : programme les notes des LOOKAHEAD s a venir ------
  //  La BOUCLE est geree ici (offset t0 repousse de loopLen), pas par un
  //  setTimeout -> reprise sans trou alignee sur l'horloge audio.
  function tick() {
    const s = session;
    if (!s || !ctx) return;
    const horizon = ctx.currentTime + LOOKAHEAD;
    let guard = 0;
    while (guard++ < 4000) {
      if (s.idx < s.trk.notes.length) {
        const n = s.trk.notes[s.idx];
        const at = s.t0 + n.t;
        if (at > horizon) break;
        s.idx++;
        const when = Math.max(at, ctx.currentTime);
        if (n.ch === 9) schedDrum(s, n, when); else schedTone(s, n, when);
      } else {
        if (s.t0 + s.loopLen > horizon) break;   // fin de piste pas encore atteinte
        s.t0 += s.loopLen;                       // on reboucle au debut
        s.idx = 0;
      }
    }
  }

  // Couper la session = clearInterval + debrancher son GainNode : toutes
  // les notes deja programmees passaient par lui -> silence net immediat.
  function killSession() {
    if (!session) return;
    clearInterval(session.timer);
    try { session.gain.disconnect(); } catch (e) {}
    session = null;
  }

  function startSession(name) {
    killSession();
    const trk = getTrack(name);
    if (!trk || !trk.notes.length) return;       // piste vide / illisible : silence
    if (!ensureCtx()) return;                    // pas d'AudioContext : no-op
    tryResume();
    master.gain.value = masterVol();             // relit la config a chaque lancement
    const gain = ctx.createGain();
    gain.connect(master);
    session = {
      name: name, gain: gain, trk: trk,
      t0: ctx.currentTime + 0.06,                // petite marge avant la 1re note
      idx: 0,
      // Longueur de boucle : le tick End-of-Track quand il est APRES la
      //  derniere note (les .mid du jeu le calent pile sur la fin de mesure
      //  -> reprise alignee sur le beat) ; sinon fin de note + petit pad.
      loopLen: (trk.eot && trk.eot >= trk.end) ? trk.eot : trk.end + LOOP_PAD,
      timer: setInterval(tick, TICK_MS),
    };
    tick();                                      // premiere fournee tout de suite
  }

  /* ===================================================================
   *  API PUBLIQUE
   * =================================================================== */
  function play(name) {
    desired = name || null;                      // TOUJOURS retenue (meme muette)
    if (!desired) { killSession(); return; }
    if (!(desired in MUSIC)) {                   // piste inconnue : silence propre
      if (!warned[desired] && Object.keys(MUSIC).length) {
        warned[desired] = true;
        console.warn('[LQ_MUSIC] piste inconnue :', desired);
      }
      killSession();
      return;
    }
    if (!enabledCfg()) { killSession(); return; }  // muet : on attend setEnabled(true)
    if (session && session.name === desired) return;  // deja en lecture : no-op total
    startSession(desired);
  }

  function stop() {
    desired = null;
    killSession();
  }

  function setEnabled(on) {
    // game.js met C.audio.music a jour AVANT d'appeler ; l'argument fait foi.
    const want = (typeof on === 'boolean') ? on : enabledCfg();
    if (!want) { killSession(); return; }        // silence immediat, desiree gardee
    if (desired) { const n = desired; killSession(); play(n); }  // reprend du debut
  }

  return {
    play: play,
    stop: stop,
    setEnabled: setEnabled,
    get current() { return desired; },
    _debugTrack: getTrack,    // debug uniquement (inspection du parse en console)
  };
})();
