// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TEMPLE SMOKE TEST — boots the BUILT game (dist/index.html) and walks the hidden temple on Tython (game/hub.js) for each hero:
//   · in from the title screen's tile, the station prompt at the temple map, H opens its panel, fast travel to a wing;
//   · walking through a great door loads the wing beyond, arriving at its door back;
//   · every station's mode launches from its panel (the council's arcade, the sandbox, survival, the training grounds)
//     and RETURN TO THE TEMPLE brings the run back to it; the codex and the forge's customizer open over it and close
//     back into it.
// Fails on any page error or console error, or a step that doesn't land where it should.
//   npm run build && npm run smoke:temple

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href;
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failed = false;
const check = (ok, what) => { console.log((ok ? 'ok: ' : 'FAIL: ') + what); if (!ok) failed = true; };
const HEROES = (process.env.HEROES || 'jedi,mando,trooper').split(',');

for (const hero of HEROES){
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
  const inHub = (wing) => page.waitForFunction((w) => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused && !GAME.G.skillSelect && (!w || GAME.G.hubWing === w), wing, { timeout: 60000 }).then(() => true, () => false);
  const stand = (x, z, yaw) => page.evaluate(([x, z, yaw]) => { const { G, player } = GAME; player.group.position.set(x, 0.6, z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0; G.yaw = player.faceYaw = yaw; }, [x, z, yaw]);   // (a little up: onto a dais, not pushed off its edge)
  // fast travel to a wing (none when already there: a run comes back to the wing it left from)
  const travel = async (w) => { if (await page.evaluate((w) => GAME.G.hubWing === w, w)) return inHub(w); await page.evaluate((w) => GAME.hub.goWing(w), w); return inHub(w); };
  const panelUp = () => page.evaluate(() => document.getElementById('hubpanel').classList.contains('open'));
  // stand at a station and tap F: its panel opens, and the option named `label` is clicked
  const station = async (x, z, yaw, label) => {
    // (the game's own frames place the hero and raise the prompt: a slow software renderer takes a while over them)
    await stand(x, z, yaw);
    const gt = await page.evaluate(() => GAME.G.gt);
    await page.waitForFunction((gt) => GAME.G.gt > gt + 0.15 && document.getElementById('hubp').classList.contains('on'), gt, { timeout: 20000 }).catch(() => {});
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open'), null, { timeout: 5000 }).catch(() => {});
    if (!(await panelUp())){ console.log('  (no panel:', await page.evaluate(() => JSON.stringify({ wing: GAME.G.hubWing, p: GAME.player.group.position, yaw: GAME.G.yaw, prompt: document.getElementById('hubp').textContent, paused: GAME.G.paused, sk: GAME.G.skillSelect, mode: GAME.G.mode, ov: document.getElementById('overlay').style.display, ovc: document.getElementById('overlay').className, card: GAME.G.cardUp, cut: GAME.G.cutscene, hub: GAME.G.hub, gt: GAME.G.gt, loading: !document.querySelector('#boot, #loading')?.hidden })) + ')'); return false; }
    const o = page.locator('#hubpanel .hb-o', { hasText: label }).first();
    if (!(await o.count())) return false;
    await o.click(); return true;
  };
  // the Jedi's forms page (or the Mando's armory) before the fight: FIGHT
  const fight = async () => {
    for (let i = 0; i < 40 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
      for (const sel of ['#forms [data-go]', '#armory [data-go]']) if (await page.isVisible(sel)) await page.click(sel, { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  };
  const runs = (pred) => page.waitForFunction(pred, null, { timeout: 120000 }).then(() => true, () => false);
  // pause the run, RETURN TO THE TEMPLE, confirm
  const backToTemple = async (what) => {
    await page.waitForTimeout(800);
    await page.evaluate(() => { document.getElementById('overlay').style.display = 'flex'; GAME.G.paused = true; GAME.setOverlayState('pause'); });   // (the pause screen, as Tab brings it up)
    await page.waitForTimeout(300);
    const shown = await page.isVisible('#templeBtn');
    check(shown, `${hero}: ${what} offers RETURN TO THE TEMPLE`);
    if (!shown){ await page.evaluate(() => GAME.hub.startHub('hall')); return; }
    await page.click('#templeBtn'); await page.waitForTimeout(200);
    if (await page.isVisible('#homeYes')) await page.click('#homeYes');
    check(await inHub(), `${hero}: back in the temple from ${what}`);
    const gt = await page.evaluate(() => GAME.G.gt);
    check(await page.waitForFunction((gt) => GAME.G.gt > gt + 0.1, gt, { timeout: 20000 }).then(() => true, () => false), `${hero}: the temple runs after ${what}`);
  };
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.$eval('#hero-' + hero, el => el.click());
    await page.click('#mode-temple');
    await page.click('#goText');
    check(await inHub('hall'), `${hero}: the temple tile opens the grand hall`);
    check(await page.evaluate(() => !GAME.G.waveTotal && !GAME.enemies?.length), `${hero}: no foes in the temple`);

    // the TEMPLE MAP: prompt, panel, fast travel
    await stand(0, 5, Math.PI); await page.waitForTimeout(400);
    check(await page.evaluate(() => document.getElementById('hubp').classList.contains('on') && /TEMPLE MAP/.test(document.getElementById('hubp').textContent)), `${hero}: the station prompt shows at the temple map`);
    check(await station(0, 5, Math.PI, 'THE COUNCIL CHAMBER'), `${hero}: H opens the map's panel and lists the wings`);
    check(await inHub('council'), `${hero}: fast travel to the council chamber`);

    // walk out through the council's south door: the hall loads, arriving at its north door
    const H = await page.evaluate(() => GAME.shared?.arenaHalf ?? 32);
    await stand(0, H - 2, 0); await page.waitForTimeout(200);
    check(await inHub('hall'), `${hero}: walking through a door loads the wing beyond`);
    check(await page.evaluate(() => GAME.player.group.position.z < -30), `${hero}: arriving at the door back`);

    // the COUNCIL TABLE: an arcade mission, and back
    check(await travel('council'), `${hero}: travel back to the council`);
    check(await station(0, 7, Math.PI, 'ARCADE'), `${hero}: the council table lists the modes`);
    await fight();
    check(await runs(() => GAME.G.mode === 'play' && !GAME.G.hub && GAME.G.mission), `${hero}: the council table launches an arcade mission`);
    await backToTemple('a mission');

    // the TRAINING WING: sandbox, survival, the training grounds
    check(await travel('training'), `${hero}: travel to the training wing`);
    check(await station(12, 0, Math.PI / 2, 'THE SANDBOX'), `${hero}: the sparring hall offers the sandbox`);
    await fight();
    check(await runs(() => GAME.G.mode === 'play' && !GAME.G.hub && GAME.G.sandbox), `${hero}: the sandbox launches`);
    await page.evaluate(() => { const p = document.getElementById('sandbox'); if (p && p.classList.contains('open')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    await backToTemple('the sandbox');
    await travel('training');
    check(await station(-6, 16, 0, 'SURVIVAL'), `${hero}: the proving ground offers survival`);
    await fight();
    check(await runs(() => GAME.G.mode === 'play' && !GAME.G.hub && GAME.G.endless), `${hero}: survival launches`);
    await backToTemple('survival');
    await travel('training');
    check(await station(-6, -16, Math.PI, 'TRAINING GROUNDS'), `${hero}: the training grounds station`);
    check(await runs(() => GAME.G.mode === 'play' && !GAME.G.hub && GAME.G.training), `${hero}: training launches`);
    await page.evaluate(() => { const b = document.getElementById('lessonboard'); if (b) b.classList.remove('open'); });
    await backToTemple('training');

    // the ARCHIVES: the codex over the temple, and closed back into it
    check(await travel('archives'), `${hero}: travel to the archives`);
    check(await station(3, 0, -Math.PI / 2, 'THE CODEX'), `${hero}: the archive terminal offers the codex`);
    await page.waitForTimeout(400);
    check(await page.evaluate(() => GAME.G.hub && GAME.G.paused && GAME.G.mode === 'play'), `${hero}: the codex opens over the temple`);

    // the FORGE: the customizer, DONE comes back to the forge
    await page.click('#cxclose');
    check(await inHub('archives'), `${hero}: closing the codex goes back to the archives`);
    await travel('forge');
    check(await inHub('forge'), `${hero}: into the forge`);
    check(await station(0, 3, 0, 'CUSTOMIZE YOUR HERO'), `${hero}: the forge bench offers the customizer`);
    await page.waitForTimeout(500);
    check(await page.evaluate(() => document.getElementById('overlay').classList.contains('customizing')), `${hero}: the customizer opens`);
    await page.click('#czdone');
    check(await inHub('forge'), `${hero}: DONE goes back to the forge`);
  } catch(e){ check(false, `${hero}: ${e.message}`); }
  const errs = [...new Set(errors)];
  check(!errs.length, `${hero}: no page or console errors` + (errs.length ? '\n  ' + errs.slice(0, 8).join('\n  ') : ''));
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
