/* Verification navigateur optionnelle. Playwright est un outil de dev externe,
 * aucune dependance ajoutee au runtime. NODE_PATH peut pointer son installation.
 * node tools/smoke_campaigns.cjs ; LQ_BROWSER_CHANNEL=msedge/chrome si necessaire.
 * Contextes jetables : aucune sauvegarde du navigateur utilisateur n'est lue. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const url = pathToFileURL(path.join(root, 'index.html')).href;
const shots = path.join(root, '_campaigngen', 'checks');
fs.mkdirSync(shots, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    channel: process.env.LQ_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true, args: ['--enable-unsafe-swiftshader'],
  });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    const scene = (name) => page.waitForFunction((s) => window.LQ && getSceneName() === s, name);
    const press = async (key) => { await page.keyboard.press(key, { delay: 60 }); await page.waitForTimeout(150); };
    const shot = (name) => page.screenshot({ path: path.join(shots, name + '.png') });
    const click = async (x, y) => {
      const box = await page.locator('canvas').boundingBox();
      await page.mouse.click(box.x + x * box.width / 960, box.y + y * box.height / 528);
      await page.waitForTimeout(180);
    };
    await page.goto(url); await scene('title');
    await press('Enter'); await scene('characters');
    await click(686, 272); await shot('characters');
    await click(480, 473); await scene('slots');
    assert.equal(await page.evaluate(() => LQ.character), 'marcos');
    await click(480, 282); await click(480, 459); await scene('introduction');
    await shot('introduction'); await press('Enter'); await scene('overworld');
    await shot('map'); await press('Enter'); await scene('game');
    await page.waitForFunction(() => LQ.player.isGrounded()); await shot('marcos');
    assert.ok((await page.evaluate(() => LQ.player._spr)).startsWith('marcos_'));
    await page.keyboard.down('ArrowDown'); await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => LQ.player._spr), 'marcos_duck');
    await shot('marcos-duck'); await page.keyboard.up('ArrowDown'); await page.waitForTimeout(200);
    const x = await page.evaluate(() => LQ.player.pos.x);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => LQ.player._spr), 'marcos_run');
    await shot('marcos-run'); await page.waitForTimeout(250); await page.keyboard.up('ArrowRight');
    assert.ok(await page.evaluate((before) => LQ.player.pos.x > before + 50, x));
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(140);
    assert.equal(await page.evaluate(() => LQ.player.isGrounded()), false);
    assert.equal(await page.evaluate(() => LQ.player._spr), 'marcos_jump');
    await shot('marcos-jump');
    await page.keyboard.up('ArrowUp'); await page.waitForTimeout(500);
    await press('c'); assert.equal(await page.evaluate(() => get('cat').length), 0);
    assert.equal(await page.evaluate(() => LQ.player.catCharges), 0);
    assert.equal(await page.evaluate(() => get('croquette').length), 0);
    await press('Space'); await shot('marcos-throw'); assert.equal(await page.evaluate(() => get('actov').length), 0); assert.ok((await page.evaluate(() => LQ.player._spr)).startsWith('marcos_'));
    await page.waitForTimeout(400);
    await page.keyboard.down('Shift');
    await page.waitForFunction(() => LQ.player._spr === 'marcos_dash');
    await shot('marcos-dash'); await page.keyboard.up('Shift'); await page.waitForTimeout(250);
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => LQ.player.flipX), true);
    await page.keyboard.down('Space');
    await page.waitForFunction(() => LQ.player._spr === 'marcos_throw');
    assert.equal(await page.evaluate(() => get('actov').length), 0);
    await page.keyboard.up('Space'); await page.keyboard.up('ArrowLeft');
    await press('Escape'); await press('Enter'); await scene('overworld');
    await press('Escape'); await scene('slots'); await shot('slots');
    await press('e'); await shot('delete-confirm'); await press('Escape');
    assert.ok(await page.evaluate(() => LQ_SAVE.load(1, 'marcos')));
    await press('Escape'); await scene('characters'); await press('ArrowLeft'); await press('Enter'); await scene('slots');
    assert.equal(await page.evaluate(() => LQ_SAVE.list('laura').filter(Boolean).length), 0);
    await press('Enter'); await scene('introduction'); await press('Enter'); await scene('overworld'); await press('Enter'); await scene('game');
    await page.waitForFunction(() => LQ.player.isGrounded());
    assert.equal(await page.evaluate(() => LQ.character), 'laura');
    assert.ok((await page.evaluate(() => LQ.player._spr)).startsWith('hero_'));
    await press('c'); assert.ok(await page.evaluate(() => get('cat').length > 0));
    await press('0'); await scene('chapter'); await press('Enter'); await scene('overworld');
    assert.equal(await page.evaluate(() => LQ_SAVE.load(0, 'laura').progress.niveau1.done), true);
    assert.equal(await page.evaluate(() => LQ_SAVE.load(1, 'marcos').progress.marcos_rizieres), undefined);
    await page.reload(); await scene('title'); await press('Enter'); await scene('characters');
    await press('ArrowRight'); await press('Enter'); await scene('slots'); await press('Enter');
    await scene('overworld'); // reprendre saute bien l'introduction
    await press('Enter'); await scene('game'); await page.waitForFunction(() => LQ.player.isGrounded());
    await page.evaluate(() => { const p = LQ.player; p.hp = 1; p.sun = 0; p.invuln = 0; LQ.bomb(0.1); });
    await page.waitForFunction(() => LQ.player._dying);
    await page.waitForTimeout(1400); await shot('death');
    assert.equal(await page.evaluate(() => get('deathcaption').length), 0);
    assert.equal(await page.evaluate(() => get('corpse')[0].sprite), 'marcos_dead');
    await press('Enter'); await page.waitForFunction(() => !LQ.player._dying && LQ.player.isGrounded());
    // Combat reel (projectiles / collisions / sortie), HP reduits pour un smoke court.
    await page.evaluate(() => {
      const p = LQ.player, b = get('boss')[0];
      p._god = true; p.pos.x = b.homeX - 220; p.pos.y = b.pos.y; p.facing = 1;
      b.hp = 0.1; b.vulnT = 30;
    });
    await page.keyboard.down('Space');
    await page.waitForFunction(() => LQ.level.bossesAlive === 0);
    await page.keyboard.up('Space'); await shot('combat');
    await page.evaluate(() => { const door = get('sun')[0]; LQ.player.pos = door.pos.clone(); });
    // 1er chapitre de Marcos (3 au total) -> retour carte, pas encore la soutenance
    await scene('chapter'); await shot('chapter'); await press('Enter'); await scene('overworld');
    assert.equal(await page.evaluate(() => LQ_SAVE.load(1, 'marcos').progress.marcos_rizieres.done), true);
    await press('Escape'); await scene('slots');
    // Effacement confirme de Marcos B ; Laura A et les autres slots restent intacts.
    await press('e'); await press('e');
    assert.equal(await page.evaluate(() => LQ_SAVE.load(1, 'marcos')), null);
    assert.equal(await page.evaluate(() => LQ_SAVE.load(0, 'laura').progress.niveau1.done), true);
    for (const hash of ['#gameauto', '#gameauto/marcos', '#winscreen', '#map/marcos']) {
      await page.goto(url + hash); await page.reload(); await page.waitForFunction(() => window.LQ);
      await page.waitForTimeout(hash.includes('auto') ? 4500 : 800);
      assert.ok(await page.evaluate(() => !!LQ.save));
    }
    // Le mode dev ne doit pas ressusciter Marcos B ni modifier Laura A.
    assert.equal(await page.evaluate(() => LQ_SAVE.load(1, 'marcos')), null);
    // Petite fenetre desktop : le canvas tient dans le viewport.
    await page.setViewportSize({ width: 900, height: 600 }); await page.goto(url + '#characters'); await page.reload(); await scene('characters');
    const box = await page.locator('canvas').boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 900 && box.y + box.height <= 600);
    await shot('small-window');
    const mobile = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    const phone = await mobile.newPage(); phone.on('pageerror', (e) => errors.push(String(e)));
    await phone.goto(url + '?touch=1#characters');
    await phone.waitForFunction(() => window.LQ && getSceneName() === 'characters');
    await phone.waitForTimeout(300);
    await phone.screenshot({ path: path.join(shots, 'mobile.png') });
    // La manette tactile choisit Marcos puis valide (bouton SAUT devient OK).
    await phone.locator('.lq-dirR').tap(); await phone.waitForTimeout(150);
    await phone.locator('.lq-jump').tap();
    await phone.waitForFunction(() => getSceneName() === 'slots');
    assert.equal(await phone.evaluate(() => LQ.character), 'marcos');
    await phone.goto(url + '?touch=1#game/marcos'); await phone.reload();
    await phone.waitForFunction(() => window.LQ && getSceneName() === 'game');
    await phone.waitForTimeout(250);
    assert.equal(await phone.locator('.lq-cat').isVisible(), false);
    await phone.goto(url + '?touch=1#game'); await phone.reload();
    await phone.waitForFunction(() => window.LQ && getSceneName() === 'game');
    await phone.waitForTimeout(250);
    assert.equal(await phone.locator('.lq-cat').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('OK navigateur : selection souris/clavier/tactile, isolation/reprise, combat, KO, sortie, fin, effacement, autopilotes et petite fenetre.');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
