// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TROOPER SIM — scripted, headless ARC trooper fights on the BUILT game (dist/index.html), in the sandbox's hangar, the
// real combat code end to end and as fast as the CPU allows (tools/trooper-sim/bot.js drives the clock and the hero).
// Prints JSON lines, one per fight, then a table per plan.
//   npm run build && npm run sim:trooper -- <plan> [--reps 4] [--workers 2] [--out file.jsonl] [--trace]
// plans:
//   line     a firing line (blaster troopers and a grenadier) against the bot standing in the open, then taking cover
//   boss     the Marshal (the trooper's end boss) the same two ways, with a late run's cards
//   duel     a mission's named gunman (the Marshal's duels) and his troopers: before the armour rule (stand), and after
//   forks    a late-run fight (blasters, a grenadier, a brute, an officer) with each signature path fully upgraded, both bots
//   all      every plan
// bots: stand (plants his feet and shoots, aim held) · cover (takes cover, leans out, moves when flanked)
import { chromium } from 'playwright';
import { existsSync, readFileSync, appendFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?trooper';
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }
const BOT = readFileSync(path.join(root, 'tools/trooper-sim/bot.js'), 'utf8');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const PLAN = argv[0] || 'all', REPS = +opt('reps', 4), WORKERS = +opt('workers', 2), OUT = opt('out', null);

// where the fights stand in the hangar: the hero at the south end, the foes at the north, cover between
const AT = [0, 18], YAW = Math.PI, FOE_AT = [0, -12];
// the stand bot plants his feet off to the side of the near wall, in the open (behind it he'd be in cover without taking it)
const STAND_AT = [3.2, 17];
// the cover course (boxes: x, z, half-widths, height): low walls and tall pillars on his side, in the middle and on theirs
const COURSE = [
  { x: 0, z: 14.5, hx: 1.8, hz: 0.4, h: 1.2 }, { x: -6, z: 13, hx: 0.8, hz: 0.8, h: 2.4 }, { x: 6, z: 13, hx: 0.8, hz: 0.8, h: 2.4 },
  { x: -4, z: 5, hx: 1.6, hz: 0.4, h: 1.2 }, { x: 4, z: 5, hx: 1.6, hz: 0.4, h: 1.2 }, { x: 0, z: 2, hx: 0.9, hz: 0.9, h: 2.4 },
  { x: -10, z: 8, hx: 0.4, hz: 2.0, h: 1.2 }, { x: 10, z: 8, hx: 0.4, hz: 2.0, h: 1.2 },
  { x: -5, z: -7, hx: 0.8, hz: 0.8, h: 2.4 }, { x: 5, z: -7, hx: 0.8, hz: 0.8, h: 2.4 }, { x: 0, z: -9, hx: 0.9, hz: 0.9, h: 2.4 },
  { x: -9, z: -4, hx: 1.6, hz: 0.4, h: 1.2 }, { x: 9, z: -4, hx: 1.6, hz: 0.4, h: 1.2 },
];
const LINE = [{ type: 'blaster', n: 4, at: FOE_AT }, { type: 'grenadier', n: 1, at: [6, -14] }];
// (a late run's foes are tougher: game/elites.js enemyHpScale ramps 5% a wave cleared, so about 2.5x by the last act)
const LATE = [{ type: 'blaster', n: 4, at: FOE_AT }, { type: 'grenadier', n: 1, at: [6, -14] }, { type: 'officer', n: 1, at: [-6, -14] }, { type: 'brute', n: 1, at: [0, -6] },
  { type: 'blaster', n: 2, at: [-12, -8] }, { type: 'blaster', n: 2, at: [12, -8] }].map(f => ({ ...f, hpMul: 2.5 }));
// a fully upgraded run's cards: the plate, the marksman, the drill and the capstones (data/trooper-progression.js)
const FULL = (fork) => `
  const P = GAME.trooperProg, T = P.TROOPER_SKILLS, S = P.TROOPER_STORE;
  for (const id of ['tplate','tplate','tplate','marks','marks','marks','drill','drill','cool','cool','lead','lead','vent','vent']) { const k = T.find(s => s.id === id); if (k) k.apply(); }
  for (const id of ['arcvet','firepower','brothers']) { const k = T.find(s => s.id === id); if (k) k.apply(); }
  const sig = S.find(s => s.id === '${fork}'); if (sig) sig.buy();
  GAME.G.unlocked.modAuto = true;`;

function jobs(){
  const J = []; let s = 1;
  const add = (tag, bot, cfg) => { for (let r = 0; r < REPS; r++) J.push({ tag, bot, cfg: { bot, at: bot === 'stand' ? STAND_AT : AT, yaw: YAW, tmax: 120, seed: s++ * 7919 + r, course: COURSE, squad: 2, trace: argv.includes('--trace'), ...cfg } }); };
  if (PLAN === 'line' || PLAN === 'all'){ add('line', 'stand', { foes: LINE }); add('line', 'cover', { foes: LINE }); }
  if (PLAN === 'boss' || PLAN === 'all'){ // (he meets the Marshal at the end of a run: the cards bought, no signature yet)
    const B = { foes: [{ boss: true }], head: true, tmax: 180, setup: FULL('none') };
    add('boss', 'stand', B); add('boss', 'cover', B); }
  // a mission's named gunman (the Marshal's duels: an officer at 4× its bar and 1.1× its damage), with his trickle of
  // troopers: before (old: no armour rule) and after
  if (PLAN === 'duel' || PLAN === 'all'){
    const D = (old) => [{ type: 'officer', n: 1, at: [0, -10], champ: { hp: 4, dmg: 1.1, old } }, { type: 'blaster', n: 2, at: [0, -14] }];
    add('duel:before', 'stand', { foes: D(true), head: true }); add('duel', 'stand', { foes: D(false), head: true }); add('duel', 'cover', { foes: D(false), head: true });
  }
  if (PLAN === 'forks' || PLAN === 'all'){
    for (const fork of ['commander', 'commando']) for (const bot of ['cover', 'stand']) add('forks:' + fork, bot, { foes: LATE, squad: fork === 'commander' ? 4 : 3, setup: FULL(fork), tmax: 150 });
  }
  return J;
}

// a page in the sandbox, ready to fight (a fresh one after a fight that ends the sandbox, as beating the Marshal does)
async function open(browser){
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', e => console.error('page error: ' + e.message));
  await page.addInitScript(BOT);
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0');
      for (const h of ['jedi', 'mando', 'trooper']) localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('sim', 'NotSupportedError')); };
  });
  await page.goto(page_url, { timeout: 120000 });
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 60000 });
  await page.$eval('#hero-trooper', el => el.click());
  await page.click('#mode-sandbox');
  for (let i = 0; i < 10; i++){
    for (const sel of ['#goText', '#trainNo']) if (await page.isVisible(sel)) await page.click(sel, { timeout: 1500 }).catch(() => {});
    if (await page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.paused, null, { timeout: 3000 }).then(() => true, () => false)) break;
  }
  await page.evaluate(() => { GAME.gfx.composer.render = () => {}; GAME.gfx.renderer.render = () => {}; });
  // which way G.pitch turns the lens (so the bot's aim converges)
  await page.evaluate(() => { const { G, camera } = GAME; G.pitch = 0; TSIM.frame(3); const a = camera.getWorldDirection(camera.position.clone()).y; G.pitch = 0.2; TSIM.frame(3); const b = camera.getWorldDirection(camera.position.clone()).y; TSIM.AIM.sign = b < a ? 1 : -1; G.pitch = 0.05; });
  return page;
}

async function worker(browser, queue, results){
  let page = await open(browser);
  while (queue.length){
    if (!(await page.evaluate(() => GAME.G.mode === 'play').catch(() => false))){ await page.close(); page = await open(browser); }
    const j = queue.shift();
    const res = await page.evaluate(cfg => TSIM.run(cfg), j.cfg).catch(e => ({ error: e.message }));
    const line = { tag: j.tag, bot: j.bot, seed: j.cfg.seed, ...res };
    results.push(line);
    console.log(JSON.stringify(line));
    if (OUT) appendFileSync(OUT, JSON.stringify(line) + '\n');
  }
  await page.close();
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const queue = jobs(), results = [];
await Promise.all(Array.from({ length: Math.min(WORKERS, queue.length) }, () => worker(browser, queue, results)));
await browser.close();

// the table: per plan and bot, the win rate, the time, the health lost and how he spent it
const groups = new Map();
for (const r of results){ const k = r.tag + ' · ' + r.bot; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
const avg = (a, f) => a.length ? a.reduce((s, r) => s + (f(r) || 0), 0) / a.length : 0;
console.log('\nplan · bot                 fights  won   time s  hp lost  downs  in cover  peeking  flanked  boss hp left');
for (const [k, a] of groups){
  console.log(k.padEnd(26) + String(a.length).padStart(6) + (Math.round(avg(a, r => r.win ? 100 : 0)) + '%').padStart(6)
    + avg(a, r => r.t).toFixed(1).padStart(9) + avg(a, r => r.hpLost).toFixed(0).padStart(9) + avg(a, r => r.downs).toFixed(2).padStart(7)
    + (avg(a, r => r.coverT / Math.max(1, r.t)) * 100).toFixed(0).padStart(9) + '%' + (avg(a, r => r.peekT / Math.max(1, r.t)) * 100).toFixed(0).padStart(8) + '%'
    + (avg(a, r => r.flankedT / Math.max(1, r.t)) * 100).toFixed(0).padStart(8) + '%' + (a.some(r => r.bossHp != null) ? avg(a, r => r.bossHp).toFixed(2).padStart(14) : ''));
}
