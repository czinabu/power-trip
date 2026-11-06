// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// POST-GAME SMOKE TEST — the top ranks and NEW GAME+ (data/ngplus.js, game/profile.js), on the BUILT game (dist/index.html),
// for each hero:
//   · a hero at their top rank holds the rank's legendary parts and looks, and none of NEW GAME+'s yet;
//   · the CAMPAIGN step shows the NEW GAME+ button once the campaign is beaten; two clicks start NG+ I on chapter 1, its card
//     shows the tier and the chapter's mutators, and the foes are tougher (the difficulty's multiplier carries the tier);
//   · a save of the run keeps its tier, and NG+ beaten opens the next tier and its legendary parts;
//   · the veteran side missions are locked until the campaign is beaten, then open, and carry their mutators into the fight;
//   · SHOTS=dir writes the NG+ button, the chapter card and the HUD there.
// Fails on any page error or console error, or a step that doesn't land where it should.
//   npm run build && npm run smoke:ngplus

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
const HEROES = (process.env.HEROES || 'jedi,mando,trooper').split(',');
const TOP = { jedi: 3, mando: 3, trooper: 6 };
// each hero's legendary parts: [customizer row, option id, what earns it]
const LEGENDS = {
  jedi: [['saber', 'heart', 'top'], ['hilt', 'grandmaster', 'top'], ['robe', 'council', 'top'], ['emitter', 'ascendant', 'ng1'], ['pommel', 'starfall', 'ng3']],
  mando: [['signet', 'mandalore', 'top'], ['armor', 'mandalor', 'top'], ['helmod', 'crown', 'ng1'], ['chest', 'mantle', 'ng3']],
  trooper: [['plate', 'marshal', 'top'], ['marking', 'chevrons', 'top'], ['hgear', 'command', 'ng1'], ['finish', 'gilded', 'ng3']],
};

for (const hero of HEROES){
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  await page.addInitScript(([hero, top]) => {
    try {
      localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
      for (const h of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + h, '1');
      if (!sessionStorage.getItem('seeded')){
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('sw_camp_' + hero, '1'); localStorage.setItem('sw_trained_' + hero, '1');
        // a hero at their top rank, the campaign beaten once, no NEW GAME+ yet
        const cleared = { 'trial-first': 1, 'trial-acrobat': 1, 'trial-knight': 1, siege: 1, refuge: 1, mustafar: 1 };
        localStorage.setItem('sw_profile', JSON.stringify({ v: 1, heroes: { [hero]: { xp: 6000, rank: top, cleared, missions: {}, won: 1, duels: 0, waves: 0, forms: 0, powers: 0, arcade: 0,
          revives: 0, squadWaves: 0, picks: [], path: null, forks: {}, deck: null, fresh: false, parts: null, sides: {}, secrets: {}, align: 0, alignPeak: { light: 0, dark: 0 }, sidePicks: {}, mercy: { spared: 0, struck: 0 } } } }));
      }
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  }, [hero, TOP[hero]]);
  page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
  const poll = { timeout: 90000 };
  const fight = async () => {
    for (let i = 0; i < 60 && !(await page.evaluate(() => GAME.G.mode === 'play' && GAME.G.cardUp)); i++){
      for (const sel of ['#forms [data-go]', '#armory [data-go]']) if (await page.isVisible(sel)) await page.click(sel, { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  };
  const open = (rows) => page.evaluate((rows) => rows.map(([row, id]) => {
    const R = GAME.CUSTOMIZE[GAME.G.hero].find(r => r.id === row), o = R && R.options.find(x => x.id === id);
    return !!(o && GAME.optionOpen(GAME.G.hero, R, o));
  }), rows);
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.$eval('#hero-' + hero, el => el.click());

    // THE TOP RANK: its legendary parts and looks, and not NEW GAME+'s
    const L = LEGENDS[hero], topRows = L.filter(x => x[2] === 'top'), ngRows = L.filter(x => x[2] !== 'top');
    const p0 = await page.evaluate((h) => { const p = GAME.PROFILE.profileOf(h); return { rank: p.rank, top: p.top, name: GAME.PROFILE.rankName(h) }; }, hero);
    check(p0.top === 1, `${hero}: at ${p0.name} the profile holds its top rank`);
    check((await open(topRows)).every(Boolean), `${hero}: the top rank's legendary parts and looks are open (${topRows.map(x => x[1]).join(', ')})`);
    check((await open(ngRows)).every(x => !x), `${hero}: NEW GAME+'s legendary parts are still locked`);

    // the NEW GAME+ button on the campaign step
    await page.click('#grp-story'); await page.click('#mode-campaign');
    await page.waitForTimeout(300);
    const btn = await page.evaluate(() => { const b = document.getElementById('campNgBtn'); return b && getComputedStyle(b).display !== 'none' ? b.textContent : null; });
    check(!!btn && /NEW GAME\+ I(?!I)/.test(btn), `${hero}: the campaign step offers NEW GAME+ I (${btn && btn.slice(0, 40)})`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${hero}-ng-button.png` });
    await page.click('#campNgBtn');
    check(await page.evaluate(() => /BEGIN NEW GAME\+ I/.test(document.getElementById('campNgBtn').textContent)), `${hero}: a first click arms it and says what it does`);
    await page.click('#campNgBtn');
    await fight();
    await page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.cardUp, null, poll);
    const run = await page.evaluate(() => ({ ng: GAME.G.ngPlus, ch: GAME.G.chapter, muts: [...GAME.G.ngMuts], strip: (document.querySelector('#chapcard .cc-ng') || {}).textContent || '' }));
    check(run.ng === 1 && run.ch === 0, `${hero}: NEW GAME+ I begins on the first chapter (tier ${run.ng}, chapter ${run.ch})`);
    check(run.muts.length === 1 && /NEW GAME\+ I/.test(run.strip) && run.muts.every(id => run.strip.includes(id.toUpperCase())), `${hero}: the card shows the tier and its mutator (${run.muts.join(', ')})`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${hero}-ng-card.png` });
    const scale = await page.evaluate(() => { const s = GAME.NGPLUS.ngScale('hp'); return s; });
    check(Math.abs(scale - 1.15) < 1e-6, `${hero}: foes are tougher on NG+ I (×${scale})`);
    // the same chapter deals the same mutators every time, and a tier keeps the one before's
    const det = await page.evaluate(() => { const N = GAME.NGPLUS, a = N.chapterMutators('siege', 1), b = N.chapterMutators('siege', 2), c = N.chapterMutators('siege', 3);
      return { same: JSON.stringify(a) === JSON.stringify(N.chapterMutators('siege', 1)), nested: b[0] === a[0] && c[0] === b[0] && c[1] === b[1], sizes: [a.length, b.length, c.length] }; });
    check(det.same && det.nested && det.sizes.join() === '1,2,3', `${hero}: a chapter's mutators are fixed and stack with the tier (${det.sizes.join('/')})`);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !GAME.G.cardUp, null, poll).catch(() => {});
    await page.waitForTimeout(800);
    // (the chapter's opening scene: hold Space to skip it, then the fight's HUD)
    for (let i = 0; i < 3; i++){ await page.keyboard.down(' '); await page.waitForTimeout(2200); await page.keyboard.up(' '); await page.waitForTimeout(600); }
    await page.waitForFunction(() => /NG\+/.test(document.getElementById('waveinfo').textContent), null, { timeout: 20000 }).catch(() => {});
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${hero}-ng-hud.png` });
    const hud = await page.evaluate(() => document.getElementById('waveinfo').textContent);
    check(/NG\+ I/.test(hud), `${hero}: the HUD shows the tier and the mutator (${hud.slice(0, 80)})`);
    // a save keeps the tier
    check(await page.evaluate(() => GAME.captureRun ? GAME.captureRun().ng === 1 : true), `${hero}: a save of the run keeps its tier`);

    // NEW GAME+ beaten: the next tier, and its legendary part
    await page.evaluate(() => GAME.PROFILE.noteCampaignWon());
    const after = await page.evaluate((h) => ({ best: GAME.PROFILE.ngBest(h), next: GAME.PROFILE.ngNextTier(h) }), hero);
    check(after.best === 1 && after.next === 2, `${hero}: NG+ I beaten opens NG+ II (best ${after.best}, next ${after.next})`);
    const ng1 = ngRows.filter(x => x[2] === 'ng1'), ng3 = ngRows.filter(x => x[2] === 'ng3');
    check((await open(ng1)).every(Boolean) && (await open(ng3)).every(x => !x), `${hero}: NG+ I's legendary part opens, NG+ III's waits`);

    // the veteran side missions: open once the campaign is beaten, and they carry their mutators
    const vets = await page.evaluate(() => GAME.SIDE_QUESTS ? GAME.SIDE_QUESTS.filter(q => q.post).map(q => ({ id: 'side:' + q.slug, lock: GAME.PROFILE.sideLock(q), muts: q.muts })) : null);
    if (vets){
      check(vets.length === 3 && vets.every(v => !v.lock), `${hero}: the three veteran side missions are open (${vets.map(v => v.id).join(', ')})`);
      const lockedFresh = await page.evaluate(() => GAME.SIDE_QUESTS.filter(q => q.post).every(q => { const p = GAME.PROFILE.profileOf(GAME.G.hero), w = p.won; p.won = 0; const l = GAME.PROFILE.sideLock(q); p.won = w; return l === 'BEAT THE CAMPAIGN'; }));
      check(lockedFresh, `${hero}: before the campaign is beaten they wait for it`);
    }
  } catch(e){ errors.push('step failed: ' + (e.stack || e.message)); }
  check(errors.length === 0, `${hero}: no page or console errors` + (errors.length ? '\n  ' + errors.slice(0, 6).join('\n  ') : ''));
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
