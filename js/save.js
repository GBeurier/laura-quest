/* =====================================================================
 *  SAVE — Trois sauvegardes facon borne d'arcade.
 *  100% cote client (localStorage). Si localStorage est indisponible
 *  (ex. Chrome en file://), on retombe sur une memoire de session :
 *  les slots marchent pendant la partie mais ne sont pas persistes.
 *  Pour une vraie persistance : servir via http (python3 -m http.server)
 *  ou deployer (itch.io / GitHub Pages).
 * ===================================================================== */
window.LQ_SAVE = (() => {
  'use strict';
  const KEY = (i) => 'lauraquest_slot_' + i;
  const N_LEVELS = 5;        // 5 chapitres (le jury n'est pas un "chapitre")
  const SLOTS = 3;

  // Detecte un localStorage utilisable, sinon shim memoire.
  const mem = {};
  let store;
  try {
    const t = '__lq_test__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    store = window.localStorage;
  } catch (e) {
    store = {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; },
    };
  }
  const persistent = (store === window.localStorage);

  function fresh(name) {
    return {
      name: name || 'LAURA',
      createdAt: Date.now(),
      levelsDone: new Array(N_LEVELS).fill(false),
      publis: new Array(N_LEVELS).fill(false),
      dataPct: new Array(N_LEVELS).fill(0),
      juryDone: false,
      bestScore: 0,
      totalScore: 0,
      unlockedMax: 0,   // index du plus haut niveau accessible sur la carte
      cursor: 0,        // position du curseur sur la carte
    };
  }

  function load(i) {
    try {
      const raw = store.getItem(KEY(i));
      if (!raw) return null;
      const d = JSON.parse(raw);
      // garde-fous de forme (versions futures)
      d.levelsDone = (d.levelsDone || []).slice(0, N_LEVELS);
      while (d.levelsDone.length < N_LEVELS) d.levelsDone.push(false);
      d.publis = (d.publis || []).slice(0, N_LEVELS);
      while (d.publis.length < N_LEVELS) d.publis.push(false);
      d.dataPct = (d.dataPct || []).slice(0, N_LEVELS);
      while (d.dataPct.length < N_LEVELS) d.dataPct.push(0);
      if (typeof d.unlockedMax !== 'number') d.unlockedMax = 0;
      if (typeof d.cursor !== 'number') d.cursor = 0;
      return d;
    } catch (e) { return null; }
  }

  function save(i, data) {
    try { store.setItem(KEY(i), JSON.stringify(data)); } catch (e) {}
    return data;
  }

  function erase(i) { try { store.removeItem(KEY(i)); } catch (e) {} }

  function list() {
    const out = [];
    for (let i = 0; i < SLOTS; i++) out.push(load(i));
    return out;
  }

  // % de completion global d'un slot (chapitres + publis + data + jury)
  function completion(d) {
    if (!d) return 0;
    let got = 0, total = 0;
    for (let i = 0; i < N_LEVELS; i++) {
      total += 3;                                  // chapitre + publi + data
      if (d.levelsDone[i]) got += 1;
      if (d.publis[i]) got += 1;
      got += Math.max(0, Math.min(1, (d.dataPct[i] || 0) / 100));
    }
    total += 1; if (d.juryDone) got += 1;          // PhD final
    return Math.round((got / total) * 100);
  }

  return { fresh, load, save, erase, list, completion, persistent, N_LEVELS, SLOTS };
})();
