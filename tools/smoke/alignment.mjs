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

  // the profile page: the meter, the cards' LIGHT / DARK tiles and what unlocks them, the LIGHT & DARK tab
  await page.click('#pfBtn');
  await page.waitForSelector('#profile.open .pf-align');
  check(await page.isVisible('#profile .pf-align .pf-al-bar b'), 'the profile shows the meter');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'profile-overview.png') });
  await page.click('#profile .pf-vtabs [data-view="deck"]');
  await page.click('#profile [data-filter="locked"]');
  const darkIds = await page.evaluate(() => [...document.querySelectorAll('#profile .pf-dcard.al-dark.shut')].map(t => t.dataset.card));
  const lk = [];
  for (const id of darkIds){ await page.click('#profile .pf-dcard[data-card="' + id + '"]'); lk.push(await page.evaluate(() => { const u = document.querySelector('#profile .pf-detail .pf-unlock'); return u ? u.textContent : ''; })); }
  check(lk.length === 3 && lk.every(t => /Lean DARK past 30/.test(t)), 'LOCKED lists the three dark cards, and each says to lean DARK past 30 (' + lk.length + ')');
  await page.click('#profile [data-filter="all"]');
  check(await page.evaluate(() => document.querySelectorAll('#profile .pf-dcard .pf-tier-k.al-light').length === 3), 'UNLOCKED shows the three light cards, tagged LIGHT');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'profile-cards.png') });
  await page.click('#profile .pf-vtabs [data-view="sides"]');
  check(await page.evaluate(() => document.querySelectorAll('#profile .pf-sides .pf-pnode').length === 6), 'LIGHT & DARK draws its six cards');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'profile-sides.png') });
  // the page wears the shown hero's look; a rank stop shows that rank; the FORCE TREE is chains of cards with a detail
  check(await page.evaluate(() => document.getElementById('profile').dataset.hero === 'jedi'), 'the profile wears the Jedi look');
  await page.click('#profile .pf-stop[data-rank="0"]');
  const rk = await page.evaluate(() => document.querySelector('#profile .pf-left .pf-next h4').textContent);
  check(/PADAWAN/.test(rk), 'tapping the first rank stop shows that rank (' + rk + ')');
  await page.click('#profile .pf-vtabs [data-view="tree"]');
  const tr = await page.evaluate(() => ({ n: document.querySelectorAll('#profile .pf-tree3 .pf-pnode').length }));
  const nodeIds = await page.evaluate(() => [...document.querySelectorAll('#profile .pf-tree3 .pf-pnode')].map(x => x.dataset.node));
  await page.click('#profile .pf-pnode[data-node="' + nodeIds[nodeIds.length - 1] + '"]');
  const td = await page.evaluate(() => ({ sel: document.querySelector('#profile .pf-pnode.sel').dataset.node, name: document.querySelector('#profile .pf-detail .pf-dh b').textContent, chains: document.querySelectorAll('#profile .pf-tree3 .pf-chain').length }));
  check(tr.n >= 6 && td.chains === 3 && td.sel === nodeIds[nodeIds.length - 1] && td.name, 'the FORCE TREE draws three chains (' + tr.n + ' cards) and a tapped card fills the detail (' + td.name + ')');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'profile-tree.png') });
  await page.click('#pfclose');

  // ---- THE GUNNERS' PATHS: the Mando's HONOUR / RUTHLESS and the trooper's MERCY / RUTHLESS (data/alignment.js) ----
  const gp = await page.evaluate(() => {
    const { PROFILE: P, creed: C } = GAME, out = {};
    for (const [h, set, top] of [['mando', C.MANDO_SKILLS, 'alor'], ['trooper', C.TROOPER_SKILLS, 'commander']]){
      const tree = C.PATH_TREE[h], o = out[h] = {};
      o.inSet = tree.every(n => set.includes(n));
      o.mirrored = [1, 2, 3].every(t => tree.filter(n => n.tier === t && n.align === 'light').length === 1 && tree.filter(n => n.tier === t && n.align === 'dark').length === 1);
      const pr = P.profileOf(h), owns = (side) => tree.filter(n => n.align === side && P.owns(h, n)).length;
      P.shiftAlign(40, h, 'test', true); pr.rank = 0;
      o.lightLow = owns('light'); o.darkLow = owns('dark');   // (only the FOUNDATION card at the first rank)
      pr.rank = P.track(h).ranks.findIndex(r => r.id === top);
      o.light = owns('light'); o.dark = owns('dark');
      o.jediGets = tree.some(n => P.owns('jedi', n));
      P.shiftAlign(-80, h, 'test', true);
      o.light2 = owns('light'); o.dark2 = owns('dark');
    }
    return out;
  });
  for (const h of ['mando', 'trooper']){
    const o = gp[h];
    check(o.inSet && o.mirrored, h + ': six path cards on its card list, a light and a dark at every tier');
    check(o.lightLow === 1 && o.darkLow === 0, h + ': leaning light at the first rank opens only the FOUNDATION light card (' + o.lightLow + ')');
    check(o.light === 3 && o.dark === 0 && !o.jediGets, h + ': at the top rank all three light cards open, none of the dark (' + o.light + '/' + o.dark + ')');
    check(o.light2 === 0 && o.dark2 === 3, h + ': swinging to the dark closes the light cards and opens the dark (' + o.light2 + '/' + o.dark2 + ')');
  }
  // the Mando's profile page: the cards tagged RUTHLESS, and the HONOUR AND RUTHLESS section
  await page.click('#pfBtn');
  await page.waitForSelector('#profile.open', { timeout: 5000 }).catch(() => {});
  await page.click('#profile [data-h="mando"]');
  await page.click('#profile .pf-vtabs [data-view="sides"]');
  const mp = await page.evaluate(() => ({ h: document.querySelector('#profile .pf-vtabs [data-view="sides"]').textContent, nodes: document.querySelectorAll('#profile .pf-sides .pf-pnode').length }));
  check(mp.h === 'HONOUR & RUTHLESS' && mp.nodes === 6, 'the Mando\'s profile has HONOUR & RUTHLESS with its six cards (' + mp.h + ', ' + mp.nodes + ')');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'profile-creed.png') });
  await page.click('#profile .pf-vtabs [data-view="deck"]');
  const tags = await page.evaluate(() => [...document.querySelectorAll('#profile .pf-dcard .pf-tier-k.al-dark')].map(t => t.textContent));
  check(tags.length === 3 && tags.every(t => t === 'RUTHLESS'), 'the Mando\'s dark cards are tagged RUTHLESS (' + tags.join(', ') + ')');
  // with a deck built, a card's detail takes it out and puts it back
  await page.click('#profile [data-deckact="suggest"]');
  const inId = await page.evaluate(() => { const t = document.querySelector('#profile .pf-dcard.indeck'); return t && t.dataset.card; });
  const n0 = await page.evaluate(() => GAME.PROFILE.deckOf('mando').length);
  await page.click('#profile .pf-dcard[data-card="' + inId + '"]'); await page.click('#profile .pf-detail [data-deck]');
  const n1 = await page.evaluate(() => GAME.PROFILE.deckOf('mando').length);
  await page.click('#profile .pf-detail [data-deck]');
  const n2 = await page.evaluate(() => GAME.PROFILE.deckOf('mando').length);
  check(inId && n1 === n0 - 1 && n2 === n0, 'a card\'s detail takes it out of the deck and puts it back (' + n0 + ' → ' + n1 + ' → ' + n2 + ')');
  await page.click('#profile [data-deckact="all"]');
  await page.click('#pfclose').catch(() => {});
  await page.evaluate(() => { for (const h of ['mando', 'trooper']) GAME.PROFILE.shiftAlign(-GAME.PROFILE.alignOf(h), h, 'test', true); });

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
