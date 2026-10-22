/* Trois slots PAR PERSONNAGE. v3 : resultats indexes par identifiant stable
 * de niveau. Les anciennes saves Laura sont migrees sans supprimer la source.
 * Aucun reseau ; repli memoire si le navigateur refuse localStorage. */
window.LQ_SAVE = (() => {
  'use strict';
  const SLOTS = 3;
  const CONTENT = window.LQ_CONTENT;
  const LEGACY_LEVELS = ['niveau1', 'niveau2', 'niveau3', 'niveau4', 'niveau5', 'jury'];
  const KEY = (i, id) => 'lauraquest_v3_' + id + '_' + i;
  const LEGACY_KEY = (i) => 'lauraquest_slot_' + i;
  const mem = Object.create(null);
  let store, persistent = false;
  try {
    store = window.localStorage;
    store.setItem('__lq_test__', '1'); store.removeItem('__lq_test__');
    persistent = true;
  } catch (e) { store = null; }
  // Les valeurs restent utilisables dans la session meme si une ecriture
  // echoue (quota / reglages modifies pendant la partie).
  function read(key) {
    if (Object.hasOwn(mem, key)) return mem[key];
    try { return store ? store.getItem(key) : null; } catch (e) { return null; }
  }
  function write(key, value) {
    mem[key] = value;
    try { if (store) store.setItem(key, value); } catch (e) { persistent = false; }
  }
  function remove(key) {
    mem[key] = null;
    try { if (store) store.removeItem(key); } catch (e) { persistent = false; }
  }
  const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const num = (v, max) => Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
  const validSlot = (i) => Number.isInteger(i) && i >= 0 && i < SLOTS;
  const record = () => ({ done: false, publi: false, dataPct: 0, bestTime: 0,
    medals: { t: 0, d: 0, s: 0 }, savedPct: 0, feli: false });
  function normalizeRecord(v) {
    v = object(v) ? v : {};
    const m = object(v.medals) ? v.medals : {};
    return { done: v.done === true, publi: v.publi === true,
      dataPct: num(v.dataPct, 100), bestTime: num(v.bestTime, Number.MAX_SAFE_INTEGER),
      savedPct: num(v.savedPct, 100), feli: v.feli === true,
      medals: { t: num(m.t, 3), d: num(m.d, 3), s: num(m.s, 3) } };
  }
  function fresh(characterId = 'laura', name) {
    const a = CONTENT.campaignFor(characterId);
    return { version: 3, characterId, campaignId: a.id,
      name: name || window.LQ_CHARACTERS[characterId].name.toUpperCase(), createdAt: Date.now(),
      progress: {}, unlocked: [a.levels[0]], cursorLevel: a.levels[0],
      bestScore: 0, totalScore: 0 };
  }
  function progress(d, key) {
    return d && Object.hasOwn(d.progress, key) ? d.progress[key] : record();
  }
  function isUnlocked(d, key) {
    if (!d) return false;
    const a = CONTENT.campaignFor(d.characterId);
    const idx = a.levels.indexOf(key);
    return idx >= 0 && (idx === 0 || d.unlocked.includes(key) || progress(d, key).done
      || progress(d, a.levels[idx - 1]).done);
  }
  function finished(d) {
    return !!d && CONTENT.campaignFor(d.characterId).levels.every((key) => progress(d, key).done);
  }
  function normalize(d, id) {
    const out = fresh(id, typeof d.name === 'string' ? d.name : undefined);
    if (d.version !== 3 || d.characterId !== id || d.campaignId !== out.campaignId) return null;
    out.createdAt = num(d.createdAt, Number.MAX_SAFE_INTEGER) || out.createdAt;
    out.bestScore = num(d.bestScore, Number.MAX_SAFE_INTEGER);
    out.totalScore = num(d.totalScore, Number.MAX_SAFE_INTEGER);
    if (object(d.progress)) Object.keys(d.progress).forEach((key) => {
      // Conserver aussi les resultats d'un niveau temporairement retire.
      if (!['__proto__', 'constructor', 'prototype'].includes(key)) out.progress[key] = normalizeRecord(d.progress[key]);
    });
    out.unlocked = Array.isArray(d.unlocked) ? [...new Set(d.unlocked.filter((key) => typeof key === 'string'))] : [];
    const a = CONTENT.campaignFor(id);
    a.levels.forEach((key) => { if (isUnlocked(out, key) && !out.unlocked.includes(key)) out.unlocked.push(key); });
    out.cursorLevel = a.levels.includes(d.cursorLevel) && isUnlocked(out, d.cursorLevel) ? d.cursorLevel : a.levels[0];
    return out;
  }
  function migrate(d) {
    const out = fresh('laura', typeof d.name === 'string' ? d.name : undefined);
    out.createdAt = num(d.createdAt, Number.MAX_SAFE_INTEGER) || out.createdAt;
    out.bestScore = num(d.bestScore, Number.MAX_SAFE_INTEGER);
    out.totalScore = num(d.totalScore, Number.MAX_SAFE_INTEGER);
    LEGACY_LEVELS.forEach((key, i) => {
      const at = (field) => Array.isArray(d[field]) ? d[field][i] : undefined;
      out.progress[key] = normalizeRecord({ done: i === 5 ? d.juryDone : at('levelsDone'),
        publi: at('publis'), dataPct: at('dataPct'), bestTime: at('bestTime'),
        medals: at('medals'), savedPct: at('savedPct'), feli: at('feli') });
    });
    out.unlocked = LEGACY_LEVELS.slice(0, Math.floor(num(d.unlockedMax, 5)) + 1);
    out.cursorLevel = LEGACY_LEVELS[Math.floor(num(d.cursor, 5))];
    return normalize(out, 'laura');
  }
  function load(i, characterId = 'laura') {
    if (!validSlot(i)) return null;
    try {
      const raw = read(KEY(i, characterId));
      if (raw !== null) {
        const d = JSON.parse(raw);
        return object(d) ? normalize(d, characterId) : null;
      }
      if (characterId !== 'laura') return null;
      const old = JSON.parse(read(LEGACY_KEY(i)) || 'null');
      if (!object(old)) return null;
      const d = migrate(old);
      save(i, d);
      return d;
    } catch (e) { return null; }
  }
  function save(i, d) {
    if (!validSlot(i)) throw new Error('Slot invalide');
    const out = normalize(d, d.characterId);
    if (!out) throw new Error('Sauvegarde incompatible');
    write(KEY(i, d.characterId), JSON.stringify(out));
    return d;
  }
  function erase(i, id = 'laura') {
    if (!validSlot(i)) return;
    CONTENT.campaignFor(id);
    // Sinon la sauvegarde legacy ressusciterait au prochain load.
    if (id === 'laura') remove(LEGACY_KEY(i));
    remove(KEY(i, id));
  }
  function list(id = 'laura') { return Array.from({ length: SLOTS }, (_, i) => load(i, id)); }
  function completion(d) {
    if (!d) return 0;
    const a = CONTENT.campaignFor(d.characterId);
    let got = 0, total = 0;
    a.levels.forEach((key) => {
      const p = progress(d, key);
      total++; if (p.done) got++;
      if (key !== a.finalLevel) { total += 2; if (p.publi) got++; got += num(p.dataPct, 100) / 100; }
    });
    return total ? Math.round(got / total * 100) : 0;
  }
  const PREFS_KEY = 'lauraquest_prefs';
  function loadPrefs() {
    try { const p = JSON.parse(read(PREFS_KEY) || '{}'); return object(p) ? p : {}; }
    catch (e) { return {}; }
  }
  function setPref(k, v) { const p = loadPrefs(); p[k] = v; write(PREFS_KEY, JSON.stringify(p)); return p; }
  return { fresh, load, save, erase, list, progress, isUnlocked, finished, completion,
    loadPrefs, setPref, get persistent() { return persistent; }, SLOTS };
})();
