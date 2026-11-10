// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// EVERY HERO SLICES THEIR OWN WAY — SMOKE TEST (data/slice-ways.js, game/slice-ways.js), on the BUILT game. On a plain
// sabotage console (the Jakku cores, data/missions.js graveyard), for each hero:
//   · the Jedi tears it open faster than the plain pace while the Force lasts, and the Force drains;
//   · the Mando sets a charge by hand, then it burns down with nobody on it, and a foe beside it pulls it back;
//   · the ARC trooper's squad, sent onto it, slices it with nobody else there.
// SHOTS=dir saves a picture of each. Fails on any page or console error.
//   npm run build && npm run smoke:slice

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

for (const hero of (process.env.HEROES || 'jedi,mando,trooper').split(',')){
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); } } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
  const ticks = async (s = 0.3) => { const gt = await page.evaluate(() => GAME.G.gt); await page.waitForFunction(([gt, s]) => GAME.G.gt > gt + s, [gt, s], { timeout: 60000 }).catch(() => {}); };
  const calm = () => page.evaluate(() => { for (const e of [...GAME.enemies]) if (!e.dead) GAME.damageEnemy(e, 99999, null, 0, false, false); GAME.G.spawnQueue.length = 0; GAME.player.hp = 1e4; });
  const cons = () => page.evaluate(() => GAME.missionState().s.cons.map(c => ({ x: c.x, z: c.z, prog: c.prog, done: c.done, charged: !!c.charged, way: c.way || null })));
  const stand = (x, z) => page.evaluate(([x, z]) => { const { player } = GAME; player.group.position.set(x, 0.2, z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); }, [x, z]);
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.$eval('#hero-' + hero, el => el.click());
    await page.evaluate(() => { document.getElementById('overlay').style.display = 'none'; GAME.G.missionId = 'graveyard'; GAME.startMission('graveyard'); GAME.G.mode = 'play'; GAME.G.paused = false; });
    await page.waitForFunction(() => GAME.missionState().o && GAME.missionState().o.kind === 'sabotage', null, { timeout: 90000 });
    const time = await page.evaluate(() => GAME.missionState().o.time);
    const keepCalm = setInterval(() => calm().catch(() => {}), 250);
    let [c0] = await cons();
    if (hero === 'jedi'){
      await calm(); clearInterval(keepCalm);   // (a kill hands Force back: none while it's measured)
      await page.evaluate(() => { GAME.player.force = 100; });
      await stand(c0.x, c0.z); await ticks(1.5);
      const [c] = await cons(), f = await page.evaluate(() => GAME.player.force);
      check(c.way === 'rip' && c.prog > 1.5 * 1.3, `jedi: tears the console open with the Force (${c.prog.toFixed(2)} in 1.5 s, way ${c.way})`);
      check(f < 90, `jedi: the Force drains while tearing (${f.toFixed(0)})`);
    } else if (hero === 'mando'){
      await stand(c0.x, c0.z);
      await page.waitForFunction((t) => GAME.missionState().s.cons[0].charged, time, { timeout: 30000 }).catch(() => {});
      let [c] = await cons();
      check(c.charged, `mando: the charge is set by hand (${c.prog.toFixed(2)} of ${time})`);
      await stand(c0.x + 15, c0.z + 15); const p1 = (await cons())[0].prog; await ticks(1.2);
      if (process.env.DEBUG) console.log(await page.evaluate(([x, z]) => GAME.enemies.map(e => [e.type, e.dead, Math.round(e.hp), Math.round(Math.hypot(e.group.position.x - x, e.group.position.z - z))]), [c0.x, c0.z]));
      c = (await cons())[0];
      check(c.done || c.prog > p1 + 0.6, `mando: it burns down with nobody on it (${p1.toFixed(2)} → ${c.prog.toFixed(2)})`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'mando-charge.png') });
      if (!c.done){
        clearInterval(keepCalm);
        await calm(); await page.evaluate(([x, z]) => { GAME.spawnEnemy('grunt', new GAME.camera.position.constructor(x + 1, 0, z + 1)); }, [c0.x, c0.z]);
        const p2 = (await cons())[0].prog; await ticks(0.8); const p3 = (await cons())[0].prog;
        check(p3 < p2 || (await cons())[0].done, `mando: a foe at the charge pulls it back (${p2.toFixed(2)} → ${p3.toFixed(2)})`);
      }
    } else {
      // the squad sent onto the console, the trooper well away
      await stand(c0.x + 18, c0.z + 18);
      await page.waitForFunction(() => GAME.squad.allies.length > 0, null, { timeout: 20000 }).catch(() => {});
      const put = () => page.evaluate(([x, z]) => { let n = 0; for (const a of GAME.squad.allies){ a.group.position.set(x + (n % 2) * 0.8, 0, z + 0.6); n++; } return n; }, [c0.x, c0.z]);
      const n = await put(); const hold = setInterval(() => put().catch(() => {}), 100);
      await ticks(0.3);
      const p1 = (await cons())[0].prog; await ticks(1.5);
      clearInterval(hold);
      const c = (await cons())[0];
      check(n > 0 && c.way === 'squad' && c.prog > p1 + 0.4, `trooper: the squad (${n}) slices it alone (${p1.toFixed(2)} → ${c.prog.toFixed(2)})`);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'trooper-squad.png') });
    }
    clearInterval(keepCalm);
  } catch(e){ check(false, `${hero}: ${e.message}`); }
  for (const e of errors) check(false, `${hero}: ${e}`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
