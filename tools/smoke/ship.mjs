// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HERO SHIP SMOKE TEST — boots the BUILT game (dist/index.html) and, for each hero, walks into their hub, boards their ship
// from the station that flies to Jedha (data/hero-ships.js, ui/hub-ui.js), and on board:
//   · the cabin builds (the ship's wing) with its stations;
//   · the GALAXY MAP opens (ui/galaxy-ui.js), lists the worlds, and picking a world shows what can be played there;
//   · a challenge launched from it runs, and its RETURN button (named for the ship) brings the run back aboard;
//   · walking down the ramp lets you out into the hub, at the foot of it;
//   · (the trooper) STRAIGHT TO THE CITADEL skips the ship, back into the hub at the foot of the ramp.
// SHOTS=dir also saves a picture of each cabin and its galaxy map there.
// Fails on any page error or console error, or a step that doesn't land where it should.
//   npm run build && npm run smoke:ship

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
// the hub's station that boards the ship: [wing, x, z] (data/hub.js: the temple's landing platform, the citadel's gunship, the covert's own ship)
const BOARD = { temple: ['landing', 0, 4.5, Math.PI], kamino: ['deck', -21, -24, Math.PI], covert: ['hangar', -5, -9, Math.PI] };
const VIEW = { width: +(process.env.W || 1280), height: +(process.env.H || 720) };

for (const hero of HEROES){
  const errors = [];
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: SHOTS ? 2 : 1 });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); for (const h of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + h, '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
  // in the hub and free to move (a gun found on the way in puts its card up first: carry what you have)
  const inHub = async (wing) => {
    for (let i = 0; i < 240; i++){
      if (await page.evaluate((w) => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused && !GAME.G.skillSelect && (!w || GAME.G.hubWing === w), wing)) return true;
      if (await page.isVisible('#armory [data-go]').catch(() => false)) await page.click('#armory [data-go]', { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
    return false;
  };
  const stand = (x, z, yaw) => page.evaluate(([x, z, yaw]) => { const { G, player } = GAME; player.group.position.set(x, 0.6, z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0; G.yaw = player.faceYaw = yaw; }, [x, z, yaw]);
  const panelUp = () => page.evaluate(() => document.getElementById('hubpanel').classList.contains('open'));
  // a card that came up on the way (a new gun): carry what you have, so the station can be reached
  // (several can come one after another, a moment apart: clear only once none has shown for a second)
  const clearCards = async () => {
    for (let i = 0, calm = 0; i < 60 && calm < 4; i++){
      if (await page.evaluate(() => !GAME.G.skillSelect && !GAME.G.cardUp && !GAME.G.paused)) calm++; else calm = 0;
      if (await page.isVisible('#armory [data-go]').catch(() => false)) await page.click('#armory [data-go]', { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  };
  const tapF = async (x, z, yaw) => {
    await clearCards();
    await stand(x, z, yaw);
    const gt = await page.evaluate(() => GAME.G.gt);
    await page.waitForFunction((gt) => GAME.G.gt > gt + 0.15 && document.getElementById('hubp').classList.contains('on'), gt, { timeout: 20000 }).catch(() => {});
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open'), null, { timeout: 5000 }).catch(() => {});
    return panelUp();
  };
  const pick = async (label) => { const o = page.locator('#hubpanel .hb-o', { hasText: label }).first(); if (!(await o.count())) return false; await o.click(); return true; };
  const fight = async () => {
    for (let i = 0; i < 40 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
      for (const sel of ['#forms [data-go]', '#armory [data-go]']) if (await page.isVisible(sel)) await page.click(sel, { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  };
  const shot = async (name) => { if (SHOTS && !/galaxy/.test(name)) await clearCards(); if (SHOTS) await page.screenshot({ path: path.join(SHOTS, hero + '-' + name + '.png') }); };
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.$eval('#hero-' + hero, el => el.click());
    await page.$eval('#mode-temple', el => el.click());
    await page.click('#goText');
    check(await inHub(), `${hero}: into the hub`);
    const hubId = await page.evaluate(() => GAME.G.hubId), [bw, bx, bz, byaw] = BOARD[hubId];
    await page.evaluate((w) => { if (GAME.G.hubWing !== w) GAME.hub.goWing(w); }, bw); await inHub(bw);
    // BOARD from the hub's pad
    check(await tapF(bx, bz, byaw), `${hero}: the ${hubId}'s ship station opens`);
    check(await pick('BOARD THE'), `${hero}: the station offers to board the ship`);
    check(await inHub('ship'), `${hero}: aboard the ship`);
    const layout = await page.evaluate(() => GAME.shared.arenaLevel && GAME.shared.arenaLevel.layout);
    check(/^sh[A-Z]/.test(layout || ''), `${hero}: the cabin is built (${layout})`);
    await page.waitForTimeout(1500);
    if (SHOTS){
      // a look down the hold from by the ramp, then the cockpit
      await stand(0, 9, Math.PI); await page.evaluate(() => { GAME.G.pitch = 0.12; }); await page.waitForTimeout(1200); await shot('hold');
      await stand(0, -7.5, Math.PI); await page.evaluate(() => { GAME.G.pitch = -0.05; }); await page.waitForTimeout(1200); await shot('cockpit');
    }
    // the GALAXY MAP
    check(await tapF(0, 3, Math.PI), `${hero}: the galaxy table opens`);
    const worlds = await page.locator('#hubpanel .gx-w').count();
    check(worlds >= 12, `${hero}: the galaxy map shows the worlds (${worlds})`);
    await page.waitForTimeout(400); await shot('galaxy');
    await page.locator('#hubpanel .gx-w[data-w="jedha"]').click();
    await page.waitForTimeout(200);
    check(await panelUp(), `${hero}: picking a world keeps the map up`);
    const jedha = await page.locator('#hubpanel .gx-card .gx-n').textContent();
    check(/JEDHA/.test(jedha || ''), `${hero}: the picked world is shown (${jedha})`);
    check(await page.locator('#hubpanel .gx-list .hb-o', { hasText: 'OPEN ZONE' }).count() > 0, `${hero}: Jedha lists its open zone`);
    await page.waitForTimeout(400); await shot('galaxy-jedha');
    // a challenge from the voyages, and back aboard
    check(await pick('CHALLENGE'), `${hero}: the galaxy map offers a challenge`);
    await fight();
    check(await page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.hub && GAME.G.mission, null, { timeout: 120000 }).then(() => true, () => false), `${hero}: the challenge launches from the ship`);
    await page.waitForTimeout(800);
    await page.evaluate(() => { document.getElementById('overlay').style.display = 'flex'; GAME.G.paused = true; GAME.setOverlayState('pause'); });
    await page.waitForTimeout(300);
    const back = await page.evaluate(() => ({ ret: document.getElementById('templeBtn').textContent, home: document.getElementById('templeHomeBtn').offsetParent ? document.getElementById('templeHomeBtn').textContent : '' }));
    check(/^RETURN TO THE (DAWNREACH|KESTREL|CINDERWAKE)$/.test(back.ret), `${hero}: the way back names the ship (${back.ret})`);
    check(/^STRAIGHT TO THE /.test(back.home), `${hero}: and offers the hub itself (${back.home})`);
    if (hero === 'trooper'){
      // straight to the hub, at the foot of the ship's ramp
      await page.click('#templeHomeBtn'); await page.waitForTimeout(200); if (await page.isVisible('#homeYes')) await page.click('#homeYes');
      check(await inHub(bw), `${hero}: straight back into the ${bw}`);
      const q = await page.evaluate(() => ({ x: GAME.player.group.position.x, z: GAME.player.group.position.z }));
      check(Math.hypot(q.x - bx, q.z - bz) < 16, `${hero}: at the foot of the ship's ramp (${q.x.toFixed(1)}, ${q.z.toFixed(1)})`);
      throw 'done';
    }
    if (await page.isVisible('#templeBtn')){ await page.click('#templeBtn'); await page.waitForTimeout(200); if (await page.isVisible('#homeYes')) await page.click('#homeYes'); }
    check(await inHub('ship'), `${hero}: the run comes back aboard the ship`);
    // down the ramp
    const H = await page.evaluate(() => GAME.shared.arenaHalf);
    await page.waitForTimeout(900);
    await stand(0, H - 1.5, 0); await page.waitForTimeout(300);
    check(await inHub(bw), `${hero}: the ramp lets you out into the ${bw}`);
    const p = await page.evaluate(() => ({ x: GAME.player.group.position.x, z: GAME.player.group.position.z }));
    check(Math.hypot(p.x - bx, p.z - bz) < 16, `${hero}: at the foot of the ship's ramp (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
  } catch(e){ if (e !== 'done') check(false, `${hero}: ${e.message}`); }
  for (const e of errors) check(false, `${hero}: ${e}`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
