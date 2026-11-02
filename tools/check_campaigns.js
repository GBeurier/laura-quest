/* node tools/check_campaigns.js : contenu + migrations, sans dependance. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const files = ['config', 'levels_data', 'level', 'npc', 'campaigns', 'characters', 'save'];
function boot(storage, blocked = false) {
  const window = {};
  if (blocked) Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  else window.localStorage = {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key),
  };
  const ctx = vm.createContext({ window });
  files.forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), ctx, { filename: file }));
  return window;
}
const storage = new Map();
const legacy = { name: 'ANCIENNE LAURA', createdAt: 123, unlockedMax: 5, cursor: 4,
  levelsDone: [true, true, true, true, true], publis: [true, false, false, false, true],
  dataPct: [100, 80, 50, 0, 100], bestTime: [99, 155, 0, 0, 130],
  medals: [{ t: 3, d: 3, s: 2 }, null, null, null, { t: 2 }, { t: 3 }],
  savedPct: [80], feli: [true], juryDone: true, bestScore: 9999, totalScore: 12345 };
storage.set('lauraquest_slot_0', JSON.stringify(legacy));
let w = boot(storage), api = w.LQ_SAVE;
const migrated = api.load(0, 'laura');
assert.equal(migrated.progress.niveau1.bestTime, 99);
assert.equal(migrated.progress.niveau1.feli, true);
assert.equal(migrated.progress.jury.done, true);
assert.equal(migrated.progress.jury.medals.t, 3);
assert.equal(migrated.cursorLevel, 'niveau5');
assert.equal(migrated.bestScore, 9999);
assert.equal(migrated.createdAt, 123);
assert.equal(storage.get('lauraquest_slot_0'), JSON.stringify(legacy));
assert.equal(api.load(0, 'marcos'), null);
for (const id of ['laura', 'marcos']) {
  for (let i = 0; i < 3; i++) {
    const d = i === 0 && id === 'laura' ? migrated : api.fresh(id);
    d.bestScore = i + (id === 'laura' ? 100 : 200);
    api.save(i, d);
  }
}
api.setPref('musicMuted', true);
w = boot(storage); api = w.LQ_SAVE; // rechargement reel, sans cache memoire
assert.equal(api.loadPrefs().musicMuted, true);
for (let i = 0; i < 3; i++) {
  assert.equal(api.load(i, 'laura').bestScore, i + 100);
  assert.equal(api.load(i, 'marcos').bestScore, i + 200);
}
let marcos = api.load(0, 'marcos');
const MARCOS_LEVELS = ['marcos_rizieres', 'marcos_village', 'marcos_parcelle'];
assert.equal(w.LQ_CAMPAIGNS.marcos_these.levels.join(','), MARCOS_LEVELS.join(',')); // tableaux d'un autre realm (vm) : comparaison par valeur
for (const key of MARCOS_LEVELS) {
  marcos.progress[key] = { done: true, publi: true, dataPct: 100, bestTime: 45,
    medals: { t: 3, d: 3, s: 3 }, savedPct: 100, feli: true };
}
api.save(0, marcos);
assert.equal(api.completion(marcos), 100);
assert.equal(api.finished(marcos), true);
// Insertion / reordonnancement / retrait temporaire : jamais de decalage des records.
const a = w.LQ_CAMPAIGNS.marcos_these;
a.levels.push('marcos_suite');
marcos = api.load(0, 'marcos');
assert.equal(api.isUnlocked(marcos, 'marcos_suite'), true);
assert.equal(api.finished(marcos), false);
assert.equal(api.completion(marcos), 75);
api.save(0, marcos);
a.levels.reverse();
assert.equal(api.load(0, 'marcos').progress.marcos_rizieres.bestTime, 45);
a.levels = ['marcos_suite'];
api.save(0, api.load(0, 'marcos'));
a.levels.push('marcos_rizieres');
assert.equal(api.load(0, 'marcos').progress.marcos_rizieres.medals.s, 3);
api.erase(0, 'marcos');
assert.equal(api.load(0, 'marcos'), null);
assert.equal(api.load(0, 'laura').bestScore, 100);
api.erase(0, 'laura');
assert.equal(boot(storage).LQ_SAVE.load(0, 'laura'), null);
// Stockage corrompu et navigateur bloque.
for (const corrupt of ['null', 'true', '[]', '{', '{"version":3}']) {
  const bad = new Map([['lauraquest_v3_marcos_0', corrupt]]);
  assert.equal(boot(bad).LQ_SAVE.load(0, 'marcos'), null);
}
const memory = boot(new Map(), true).LQ_SAVE;
assert.equal(memory.persistent, false);
memory.save(2, memory.fresh('marcos'));
assert.equal(memory.load(2, 'marcos').characterId, 'marcos');
assert.equal(memory.load(2, 'laura'), null);
// Verifier toutes les references de contenu et les marqueurs indispensables.
w = boot(new Map());
for (const ch of Object.values(w.LQ_CHARACTERS)) {
  const c = w.LQ_CONTENT.campaignFor(ch.id);
  for (const key of c.levels) {
    const lv = w.LEVELS[key];
    assert.ok(w.CONFIG.bosses[lv.boss], key + ': boss manquant');
    const map = lv.map.join('');
    for (const marker of ['@', 'B', '*']) assert.equal(map.split(marker).length - 1, 1, key + ': ' + marker);
  }
  if (ch.rig) for (const name of [ch.rig.body, ch.rig.head, ch.rig.deadBody, ch.rig.deadHead]) {
    assert.ok(fs.existsSync(path.join(root, 'assets/sprites', name + '.png')), name);
  }
  for (const [hero, name0] of Object.entries(ch.sprites || {}).filter(([, n]) => n)) {
    // feuille dediee pas encore produite -> son repli (spriteFallback) doit exister
    const fb = ch.spriteFallback && ch.spriteFallback[hero];
    const has = (n) => fs.existsSync(path.join(root, 'assets/sprites', n + '.png'));
    const name = (!has(name0) && fb) ? fb : name0;
    assert.ok(has(name), name);
    assert.ok(w.CONFIG.anims[name], name + ': animation manquante');
  }
}
console.log('OK : migrations, 6 slots isoles, progression stable, extensions, prefs, stockage bloque et contenu.');
