// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MANDO SIM — scripted, headless Mandalorian fights on the BUILT game (dist/index.html), in the sandbox, through the real
// combat code and as fast as the CPU allows. The in-page bot is the trooper sim's (tools/trooper-sim/bot.js: it drives
// the clock and the hero, and holds each gun the way that gun wants: an automatic held down, the rest clicked).
// Prints JSON lines, one per fight, then a table per plan and gun.
//   npm run build && npm run sim:mando -- <plan> [--reps 3] [--workers 3] [--guns single,carbine] [--bots stand,move] [--out file.jsonl]
// plans:
//   line     a firing line (blaster troopers, a grenadier, an officer) across the floor
//   rush     a melee rush (grunts, a brute, lancers) coming straight at him
//   boss     the Iron Magistrate (the Mando's end boss)
// Every fight is a late run's: the foes at a late wave's health, the hero with about the cards a run has by then.
//   all      every plan
// guns: single (blaster pistol), dual (dual blasters), carbine (pulse carbine), repeater (heavy repeater), disruptor
// bots: stand (plants his feet and shoots, braced) · move (strafes, backs off a rush, dives out of a red tell or a blow)
// What it does not model: the jetpack, gadgets (flamethrower, whistling birds), melee and the Darksaber, so a gun's
// numbers are the gun's own.
import { existsSync, readFileSync, appendFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { launchSimBrowser } from '../sim-browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href;
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }
const BOT = readFileSync(path.join(root, 'tools/trooper-sim/bot.js'), 'utf8');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const PLAN = argv[0] || 'all', REPS = +opt('reps', 3), WORKERS = +opt('workers', 3), OUT = opt('out', null);
const GUNS = opt('guns', 'single,dual,carbine,repeater,disruptor').split(','), BOTS = opt('bots', 'stand,move').split(',');

// the hero at the south end of the floor, the foes at the north
const AT = [0, 14], YAW = Math.PI, FOE_AT = [0, -10];
// (a late run's foes are tougher: game/elites.js enemyHpScale ramps 5% a wave cleared, so about 2.5x by the last act)
const LINE = [{ type: 'blaster', n: 5, at: FOE_AT }, { type: 'grenadier', n: 1, at: [6, -12] }, { type: 'officer', n: 1, at: [-6, -12] }].map(f => ({ ...f, hpMul: 2.5 }));
const RUSH = [{ type: 'grunt', n: 5, at: [0, -4] }, { type: 'brute', n: 1, at: [0, -8] }, { type: 'lancer', n: 2, at: [5, -6] }].map(f => ({ ...f, hpMul: 2.5 }));
// a late run's guns hit harder and his bar is deeper (about what the run's cards add by the last act: data/skills.js)
const LATE = `GAME.player.up.dmg = (GAME.player.up.dmg || 1) * 1.6; GAME.player.up.hpMax = (GAME.player.up.hpMax || 0) + 60; GAME.player.hp += 60;`;

function jobs(){
  const J = []; let s = 1;
  // (every gun and bot meets the same seeds, so a row differs from the next only by the gun or the bot)
  const add = (tag, cfg) => { for (const weapon of GUNS) for (const bot of BOTS){ for (let r = 0; r < REPS; r++) J.push({ tag, bot, weapon, cfg: { bot, weapon, at: AT, yaw: YAW, tmax: 120, seed: (s + r) * 7919, squad: 0, head: true, setup: LATE, ...cfg } }); } s += REPS; };
  if (PLAN === 'line' || PLAN === 'all') add('line', { foes: LINE });
  if (PLAN === 'rush' || PLAN === 'all') add('rush', { foes: RUSH });
  if (PLAN === 'boss' || PLAN === 'all') add('boss', { foes: [{ boss: true }], tmax: 240 });
  return J;
}

// a page in the sandbox as the Mandalorian, ready to fight (a fresh one after a fight that ends the sandbox)
async function open(browser){
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', e => console.error('page error: ' + e.message));
  await page.addInitScript(BOT);
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0');
      for (const h of ['jedi', 'mando', 'trooper']) localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_asktrain', '1');
      localStorage.setItem('sw_sandbox_map', 'room'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('sim', 'NotSupportedError')); };
  });
  await page.goto(page_url, { timeout: 120000 });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 60000 });
  await page.$eval('#hero-mando', el => el.click());
  await page.$eval('#mode-sandbox', el => el.click());
  for (let i = 0; i < 10; i++){
    // (DOM clicks: Playwright's own waits for a still button never settle on a page whose clock the bot runs)
    for (const sel of ['#goText', '#trainNo']) if (await page.isVisible(sel)) await page.$eval(sel, el => el.click()).catch(() => {});
    if (await page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.paused, null, { timeout: 3000 }).then(() => true, () => false)) break;
  }
  if (!(await page.evaluate(() => GAME.G.mode === 'play'))) throw new Error('the sandbox did not start (still on ' + await page.evaluate(() => GAME.G.mode) + ')');
  await page.evaluate(() => { GAME.gfx.composer.render = () => {}; GAME.gfx.renderer.render = () => {}; });
  await page.evaluate(() => { const { G, camera } = GAME; G.pitch = 0; TSIM.frame(3); const a = camera.getWorldDirection(camera.position.clone()).y; G.pitch = 0.2; TSIM.frame(3); const b = camera.getWorldDirection(camera.position.clone()).y; TSIM.AIM.sign = b < a ? 1 : -1; G.pitch = 0.05; });
  return page;
}

async function worker(browser, queue, results){
  let page = await open(browser);
  while (queue.length){
    if (!(await page.evaluate(() => GAME.G.mode === 'play').catch(() => false))){ await page.close(); page = await open(browser); }
    const j = queue.shift();
    const res = await page.evaluate(cfg => TSIM.run(cfg), j.cfg).catch(e => ({ error: e.message }));
    const line = { tag: j.tag, gun: j.weapon, bot: j.bot, seed: j.cfg.seed, ...res };
    results.push(line);
    console.log(JSON.stringify(line));
    if (OUT) appendFileSync(OUT, JSON.stringify(line) + '\n');
  }
  await page.close();
}

const browser = await launchSimBrowser();
const queue = jobs(), results = [];
console.error(`${PLAN}: ${queue.length} fights on ${WORKERS} workers`);
await Promise.all(Array.from({ length: Math.min(WORKERS, queue.length) }, () => worker(browser, queue, results)));
await browser.close();

// the table: per plan, gun and bot, the win rate, the time, the health lost, the dives and the boss's bar left
const groups = new Map();
for (const r of results){ const k = r.tag + ' · ' + r.gun + ' · ' + r.bot; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
const avg = (a, f) => a.length ? a.reduce((s, r) => s + (f(r) || 0), 0) / a.length : 0;
const broke = results.filter(r => r.error || r.endMode); if (broke.length) console.log(`\n${broke.length} fight(s) ended early (an error, or the game left play): see their lines`);
console.log('\nplan · gun · bot                fights  won   time s  hp lost  downs  dives  kills  boss hp left');
for (const [k, a] of groups){
  console.log(k.padEnd(31) + String(a.length).padStart(6) + (Math.round(avg(a, r => r.win ? 100 : 0)) + '%').padStart(6)
    + avg(a, r => r.t).toFixed(1).padStart(9) + avg(a, r => r.hpLost).toFixed(0).padStart(9) + avg(a, r => r.downs).toFixed(2).padStart(7)
    + avg(a, r => r.dives).toFixed(1).padStart(7) + avg(a, r => r.kills).toFixed(1).padStart(7) + (a.some(r => r.bossHp != null) ? avg(a, r => r.bossHp).toFixed(2).padStart(14) : ''));
}
