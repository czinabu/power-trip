// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// LIGHT AND DARK SMOKE TEST — boots the BUILT game (dist/index.html):
//   · the meter (game/profile.js shiftAlign): leaning opens that path's cards (data/alignment.js ALIGN_TREE) and closes
//     the other's, the path's crystal is earned at its mark, the cast has lines for it, the Jedi's eyes take its colour;
//   · MERCY in a real fight (survival): a beaten duellist yields (its blade down, on its knees), F spares it (it bows out,
//     beaten, and the meter moves to the light), and one struck down while it kneels moves it to the dark;
//   · the profile page shows the meter, the cards' LIGHT / DARK tags and lock reasons, and the tree's LIGHT AND DARK. SHOTS=dir writes screenshots there.
// Fails on any page error or console error, or a step that doesn't land where it should.
//   npm run build && npm run smoke:alignment

import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href;
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failed = false;
const check = (ok, what) => { console.log((ok ? 'ok: ' : 'FAIL: ') + what); if (!ok) failed = true; };
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: SHOTS ? 2 : 1 });
await page.addInitScript(() => {
  try {
    localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
    for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
  } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
});
page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
const ticks = async (s = 0.3) => { const gt = await page.evaluate(() => GAME.G.gt); await page.waitForFunction(([gt, s]) => GAME.G.gt > gt + s, [gt, s], { timeout: 30000 }).catch(() => {}); };

try {
  await page.goto(page_url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
  await page.$eval('#hero-jedi', el => el.click());

  // ---- the meter, the paths, the crystal, the cast ----
  const m = await page.evaluate(() => {
    const { PROFILE: P, ALIGNMENT: A, SKILLS } = GAME, card = (id) => SKILLS.find(s => s.id === id);
    P.profileOf('jedi').rank = 2;   // (a Master: every tier's card can open)
    const out = { start: P.alignOf('jedi') };
    P.shiftAlign(40, 'jedi', 'test', true);
    out.lean1 = P.leanOf('jedi'); out.serene = P.owns('jedi', card('serene')); out.fear = P.owns('jedi', card('fear'));
    out.vael = A.alignLines('MASTER VAEL', 'jedi').length;
    P.shiftAlign(15, 'jedi', 'test', true);
    out.dawn = (P.profileOf('jedi').parts || []).includes('saber:dawn');
    out.pairs = ['serene', 'fear', 'shelter', 'wrath', 'endures', 'unlimited'].every(id => !!card(id));
    return out;
  });
  check(m.start === 0, 'a new profile starts balanced');
  check(m.lean1 === 'light' && m.serene && !m.fear, 'leaning to the light opens its cards, not the dark\'s');
  check(m.vael > 0, 'Master Vael has words for a Jedi who leans to the light');
  check(m.dawn, 'reaching 50 light earns the Dawnlight crystal');
  check(m.pairs, 'all six path cards are on the run\'s card list');

  // the profile page: the meter row, the cards' LIGHT / DARK tags and lock reasons, the tree's LIGHT AND DARK
  await page.click('#pfBtn');
  await page.waitForSelector('#profile.open .pf-align');
  check(await page.isVisible('#profile .pf-align .pf-al-bar b'), 'the profile shows the meter');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'profile-meter.png') });
  await page.click('#profile [data-filter="locked"]');
  const lk = await page.evaluate(() => [...document.querySelectorAll('#profile .pf-dcard')].filter(c => c.querySelector('.pf-tier-k.al-dark')).map(c => c.querySelector('.pf-lock') && c.querySelector('.pf-lock').textContent));
  check(lk.length === 3 && lk.every(t => t === 'NEEDS DARK ALIGNMENT'), 'LOCKED lists the dark cards, each NEEDS DARK ALIGNMENT (' + lk.join(', ') + ')');
  await page.click('#profile [data-filter="all"]');
  check(await page.evaluate(() => document.querySelectorAll('#profile .pf-dcard .pf-tier-k.al-light').length === 3), 'ALL CARDS shows the three light cards, tagged LIGHT');
  await page.click('#profile [data-view="tree"]');
  check(await page.evaluate(() => document.querySelectorAll('#profile .pf-sides .pf-node').length === 6), 'the Force Tree lists LIGHT AND DARK\'s six cards');
  if (SHOTS){ await page.$eval('#profile .pf-sides-h', el => el.scrollIntoView()); await page.screenshot({ path: path.join(SHOTS, 'profile-sides.png') }); }
  await page.click('#pfclose');

  // ---- MERCY, in survival ----
  await page.evaluate(() => { GAME.PROFILE.shiftAlign(-GAME.PROFILE.alignOf('jedi'), 'jedi', 'test', true); });   // back to balanced
  await page.$eval('#mode-endless', el => el.click());
  for (let i = 0; i < 20 && !(await page.evaluate(() => GAME.G.mode === 'play' && !GAME.G.paused)); i++){
    for (const sel of ['#goText', '#forms [data-go]']) if (await page.isVisible(sel)) await page.click(sel, { timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  check(await page.evaluate(() => GAME.G.mode === 'play' && GAME.G.endless), 'survival is on');
  await page.evaluate(() => { for (const e of GAME.enemies) e.dead = true; GAME.enemies.length = 0; GAME.G.spawnQueue.length = 0; });
  const beat = () => page.evaluate(() => {
    const { player, enemies, G } = GAME, p = player.group.position;
    G.yaw = player.faceYaw = 0; player.hp = 9999;
    GAME.spawnEnemy('duelist', new GAME.camera.position.constructor(p.x + 1.1, 0, p.z + 2.8));
    const e = enemies[enemies.length - 1];
    e.state = 'chase'; e.st = 0; e.hp = e.maxHp * 0.25;
    GAME.damageEnemy(e, e.maxHp * 0.1, new GAME.camera.position.constructor(0, 0, 1), 0);
    const u = e.group.userData, w = u.saber || u.staff;
    return { nid: e.nid, state: e.state, blade: w ? w.visible : null };
  });
  const y1 = await beat();
  check(y1.state === 'yield' && y1.blade === false, 'a beaten duellist yields, its blade thrown down (' + y1.state + ')');
  await ticks(0.6);
  check(await page.evaluate(() => document.getElementById('mercyp').classList.contains('on')), 'the SPARE prompt is up beside it');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'yield-spare.png') });
  const a0 = await page.evaluate(() => GAME.PROFILE.alignOf('jedi'));
  await page.keyboard.press('f');
  await ticks(0.1);
  const sp = await page.evaluate((nid) => { const e = GAME.enemies.find(o => o.nid === nid); return { state: e && e.state, dead: e && e.dead, a: GAME.PROFILE.alignOf('jedi'), spared: GAME.PROFILE.profileOf('jedi').mercy.spared }; }, y1.nid);
  check(sp.state === 'spared' && sp.dead, 'F spares it: it bows out, beaten');
  check(sp.a > a0 && sp.spared === 1, 'sparing moves the meter to the light (' + a0 + ' → ' + sp.a + ')');
  await page.waitForFunction((nid) => !GAME.enemies.some(o => o.nid === nid), y1.nid, { timeout: 60000 }).catch(() => {});
  const gone = await page.evaluate((nid) => { const e = GAME.enemies.find(o => o.nid === nid); return e ? 'still here: ' + e.state + ' st ' + e.st.toFixed(2) + ' gt ' + GAME.G.gt.toFixed(1) + ' ' + JSON.stringify({ m: GAME.G.mode, p: GAME.G.paused, ss: GAME.G.skillSelect, ov: document.getElementById('overlay') && getComputedStyle(document.getElementById('overlay')).display, hid: document.hidden }) : 'gone'; }, y1.nid);
  check(gone === 'gone', 'the spared foe leaves the fight (' + gone + ')');

  const y2 = await beat();
  const a1 = await page.evaluate(() => GAME.PROFILE.alignOf('jedi'));
  const st = await page.evaluate((nid) => { const e = GAME.enemies.find(o => o.nid === nid); GAME.damageEnemy(e, 9999, new GAME.camera.position.constructor(0, 0, 1), 4); return { dead: e.dead, a: GAME.PROFILE.alignOf('jedi'), struck: GAME.PROFILE.profileOf('jedi').mercy.struck }; }, y2.nid);
  check(y2.state === 'yield' && st.dead && st.a < a1 && st.struck === 1, 'striking down a kneeling foe moves the meter to the dark (' + a1 + ' → ' + st.a + ')');

  // ---- the look: a Jedi deep in the dark has gold eyes ----
  const eyes = await page.evaluate(() => {
    const { PROFILE: P, ALIGNMENT: A, player } = GAME;
    const col = () => { let c = null; player.vis.traverse(o => { if (!c && o.isMesh && o.material && o.material.userData && o.material.userData.ink && o.material.userData.ink.key === 'eyes') c = o.material.color.getHexString(); }); return c; };
    A.tintModel(player.vis, 0); const plain = col();
    A.tintModel(player.vis, -80); const dark = col();
    A.tintModel(player.vis, 80); const light = col();
    A.tintModel(player.vis, P.alignOf('jedi'));
    return { plain, dark, light };
  });
  check(eyes.plain && eyes.dark !== eyes.plain && eyes.light !== eyes.plain && eyes.dark !== eyes.light, 'the eyes take the side you lean to (' + eyes.plain + ' · dark ' + eyes.dark + ' · light ' + eyes.light + ')');
  // ---- the dark path's card cuts its own powers' cost ----
  check(await page.evaluate(() => { const { SKILLS, player } = GAME; SKILLS.find(s => s.id === 'wrath').apply(); return player.up.costOf.judge === 0.85 && player.up.costOf.grasp === 0.85; }), 'WRATH cuts Judgement and the Grip by 15%');
} catch(e){ check(false, e.message); }
for (const e of errors) check(false, e);
await browser.close();
process.exit(failed ? 1 : 0);
