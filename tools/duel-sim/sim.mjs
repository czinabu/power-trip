// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DUEL SIM — scripted, headless saber duels on the BUILT game (dist/index.html), the real combat code end to end, run as
// fast as the CPU allows (tools/duel-sim/bot.js drives the clock and the hero). Prints JSON lines, one per fight.
//   npm run build && node tools/duel-sim/sim.mjs <plan> [--workers 3] [--reps 4] [--out file.jsonl]
// plans:
//   matrix   every hero form against every foe form, ranks I to IV (acolytes in that form at that rank)
//   adapt    masters that switch form, against a hero who answers back (3-form loadout) or stays put
//   crowd    every form against a pack of acolytes and a pack of troopers
//   early    the first waves' acolytes (Shii-Cho adepts) against the forms a run has then
//   one      a single fight: --form ataru --foe djemso --rank knight
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { FORM_FAMILY as FAMILY, FAMILIES } from '../../src/data/foe-forms.js';
import { bossFoes } from './bosses.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href;
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }
const BEATS = Object.fromEntries(Object.entries(FAMILIES).map(([k, f]) => [k, f.beats]));
const BOT = readFileSync(path.join(root, 'tools/duel-sim/bot.js'), 'utf8')
  .replace('__FORM_FAMILY__', JSON.stringify(FAMILY)).replace('__BEATS__', JSON.stringify(BEATS));

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const PLAN = argv[0] || 'one';
const WORKERS = +opt('workers', 3), REPS = +opt('reps', 4), OUT = opt('out', null);
// the hero's skill (tools/duel-sim/bot.js): good = reads most guards and lands most parries; average = mashes more, reads less
const PRESETS = { good: null, average: { parry: 0.35, sigma: 0.1, read: 0.5, mash: 0.5, gap: 0.65, bite: 0.5, see: 0.3 } };
const SK = opt('skill', 'good'), SKILL = SK in PRESETS ? PRESETS[SK] : JSON.parse(SK);

const FORMS = ['shiicho', 'makashi', 'soresu', 'ataru', 'djemso', 'shien', 'niman', 'juyo', 'vaapad', 'staff', 'jarkai'];
const RANKS = ['initiate', 'adept', 'knight', 'master'];
const DEPTH = { initiate: 1, adept: 4, knight: 9, master: 14 };   // where in a run each rank is met (the foes' skill ramp)
const HPM = (d) => 1 + d * 0.05;   // a campaign foe's health this deep (enemies/elites.js enemyHpScale)
// a hero's loadout around its form: one form from each family, so a wrong form is a choice (the counter penalty applies)
const PICK = { speed: 'ataru', guard: 'soresu', power: 'djemso' };
const loadoutFor = (form) => { const out = [form]; for (const f of ['speed', 'guard', 'power']) if (FAMILY[form] !== f && out.length < 3) out.push(PICK[f]); return out; };

// a master that switches: the sandbox's foe picks only one form, so a switcher is an acolyte master given the full
// acolyte repertoire, starting in a form the hero's form counters (it will switch off it)
const SWITCH_REP = ['shiicho', 'makashi', 'ataru', 'soresu', 'djemso', 'shien', 'juyo'];
function pickSwitcher(cfg){
  const fam = FAMILY[cfg.form], weak = SWITCH_REP.filter(f => fam && FAMILIES[fam].beats === FAMILY[f]);
  cfg.foes[0].form = weak.length ? weak[cfg.seed % weak.length] : SWITCH_REP[cfg.seed % SWITCH_REP.length];
  cfg.__rep = SWITCH_REP;
}

function jobs(){
  const J = [];
  let s = 1;
  if (PLAN === 'matrix'){
    const ranks = opt('ranks', RANKS.join()).split(','), forms = opt('forms', FORMS.join()).split(','), foes = opt('foes', FORMS.join()).split(',');
    for (const rank of ranks) for (const form of forms) for (const foe of foes) for (let r = 0; r < REPS; r++)
      J.push({ tag: 'matrix', form, foe, rank, cfg: { form, loadout: loadoutFor(form), foes: [{ type: 'acolyte', form: foe, rank, hpMul: HPM(DEPTH[rank]) }], depth: DEPTH[rank], seed: s++ * 7919 + r, tmax: 90 } });
  } else if (PLAN === 'adapt'){
    for (const adaptive of [true, false]) for (const form of FORMS) for (let r = 0; r < REPS; r++)
      J.push({ tag: 'adapt', form, foe: 'switcher', rank: 'master', adaptive, cfg: { form, loadout: loadoutFor(form), adaptive, foes: [{ type: 'acolyte', form: null, rank: 'master', master: true, hpMul: HPM(14) }], depth: 14, seed: s++ * 104729 + r, tmax: 120 } });
  } else if (PLAN === 'crowd'){
    const packs = { acolytes: [{ type: 'acolyte', rank: 'adept', form: 'shiicho' }, { type: 'acolyte', rank: 'adept', form: 'shiicho' }, { type: 'acolyte', rank: 'adept', form: 'ataru' }],
                    troopers: Array.from({ length: 6 }, (_, i) => ({ type: i % 3 === 2 ? 'blaster' : 'grunt' })),
                    guards: Array.from({ length: 3 }, () => ({ type: 'duelist' })) };
    for (const [pack, foes] of Object.entries(packs)) for (const form of FORMS) for (let r = 0; r < REPS; r++)
      J.push({ tag: 'crowd', form, foe: pack, rank: '-', cfg: { form, loadout: loadoutFor(form), foes, depth: 6, seed: s++ * 31337 + r, tmax: 120, spread: 6 } });
  } else if (PLAN === 'early'){
    for (const depth of [1, 2, 3, 4, 5, 6, 7, 8]) for (const form of ['shiicho', 'soresu', 'ataru']) for (let r = 0; r < REPS; r++)
      J.push({ tag: 'early', form, foe: 'wave' + depth, rank: depth >= 8 ? 'knight' : 'adept', cfg: { form, loadout: [form], foes: [{ type: 'acolyte', form: 'shiicho', rank: depth >= 8 ? 'knight' : 'adept', hpMul: HPM(depth) }], depth, seed: s++ * 4099 + r, tmax: 90 } });
  } else if (PLAN === 'bosses'){
    // the boss duels: Darth Vexis, survival's warbringer and the Jedi story's named duellists, scaled the way their
    // missions scale them (data/missions.js duel entries, game/mission.js spawnInquisitor), against every form
    const B = bossFoes(HPM), only = opt('foes', null);
    const forms = opt('forms', FORMS.join()).split(',');
    for (const [foe, b] of Object.entries(B)) if (!only || only.split(',').includes(foe)) for (const form of forms) for (let r = 0; r < REPS; r++)
      J.push({ tag: 'bosses', form, foe, rank: b.foes[0].rank || '-', cfg: { form, loadout: loadoutFor(form), foes: b.foes, depth: b.depth, seed: s++ * 6007 + r, tmax: b.tmax || 180 } });
  } else {
    const form = opt('form', 'niman'), foe = opt('foe', 'niman'), rank = opt('rank', 'knight');
    for (let r = 0; r < REPS; r++) J.push({ tag: 'one', form, foe, rank, cfg: { form, loadout: loadoutFor(form), foes: [{ type: 'acolyte', form: foe, rank, hpMul: HPM(DEPTH[rank] || 9) }], depth: DEPTH[rank] || 9, seed: 17 + r, tmax: 90 } });
  }
  if (SKILL) for (const j of J) j.cfg.skill = SKILL;
  return J;
}

async function worker(browser, queue, onDone){
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0');
      localStorage.setItem('sw_camp_jedi', '1'); localStorage.setItem('sw_trained_jedi', '1');
      localStorage.setItem('sw_sandbox_map', 'room');
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('sim', 'NotSupportedError')); };
  });
  await page.addInitScript(BOT);
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(page_url, { timeout: 120000 });   // (four workers loading the built page at once can take longer than the default 30 s)
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 60000 });
  await page.evaluate(() => {
    const { G } = GAME;
    G.hero = 'jedi'; GAME.setHero('jedi');
    GAME.setSandboxMap('room'); GAME.startSandbox();
    G.mode = 'play'; G.paused = false;
    GAME.gfx.composer.render = () => {};   // no drawing: the fight is all that's needed
    GAME.gfx.renderer.render = () => {};
  });
  await page.waitForTimeout(1500);
  while (queue.length){
    const j = queue.shift();
    let r;
    try {
      if (j.cfg.foes[0].master) pickSwitcher(j.cfg);
      r = await page.evaluate((cfg) => {
        const pre = GAME.enemies.length;
        if (cfg.__rep){
          // hand the repertoire over right after the spawn (inside fight, via a one-shot hook on spawnEnemy)
          const orig = GAME.spawnEnemy;
          GAME.spawnEnemy = function(...a){ const r = orig.apply(this, a); const e = GAME.enemies[GAME.enemies.length - 1]; if (e) e.ffRep = cfg.__rep.slice(); GAME.spawnEnemy = orig; return r; };
        }
        return window.__duelSim.fight(cfg);
      }, j.cfg);
    } catch(e){ r = { end: 'error', err: e.message.split('\n')[0] }; }
    if (errs.length){ r.errors = errs.splice(0).slice(0, 3); }
    onDone({ skill: SK, tag: j.tag, form: j.form, foe: j.foe, rank: j.rank, adaptive: j.adaptive, ...r });
  }
  await page.close();
}

const queue = jobs();
const total = queue.length;
console.error(`${PLAN}: ${total} fights on ${WORKERS} workers`);
if (OUT) writeFileSync(OUT, '');
let done = 0;
const t0 = Date.now();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
await Promise.all(Array.from({ length: Math.min(WORKERS, total) }, () => worker(browser, queue, (r) => {
  done++;
  const line = JSON.stringify(r);
  if (OUT) appendFileSync(OUT, line + '\n'); else console.log(line);
  if (done % 20 === 0 || done === total) console.error(`${done}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})));
await browser.close();
