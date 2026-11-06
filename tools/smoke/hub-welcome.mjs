// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HUB WELCOME SMOKE TEST — the first visit to each hero's hub (game/hub-welcome.js, data/hub-welcome.js), on the BUILT game:
//   · a fresh save file walking into the hub gets the welcome card once the wing's name has faded;
//   · SHOW ME AROUND walks every stop of the tour (a beacon at each, the door toward a stop in another wing), and ends
//     at the station that starts a first run;
//   · coming back (a reload, the same file) the card stays away; any map shows it again (SHOW ME AROUND);
//   · a mode launched mid-tour ends it: the mode's own panel, no beacon left behind;
//   · a second save file is welcomed afresh.
// SHOTS=dir saves a screenshot of the card and of each tour stop. Fails on any page error or console error.
//   npm run build && npm run smoke:welcome   (HEROES=jedi,mando,trooper)

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

for (const hero of HEROES){
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('smoke_init')) return;   // (once: a reload keeps what the file saved)
      sessionStorage.setItem('smoke_init', '1');
      localStorage.clear();
      localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
    } catch(e){}
  });
  await page.addInitScript(() => { Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); }; });
  page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, hero + '-' + name + '.png') }); };
  const inHub = (wing) => page.waitForFunction((w) => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused && (!w || GAME.G.hubWing === w), wing, { timeout: 60000 }).then(() => true, () => false);
  const cardUp = (ms = 45000) => page.waitForFunction(() => document.querySelector('#hubpanel.open .hw-box'), null, { timeout: ms }).then(() => true, () => false);
  const st = () => page.evaluate(() => GAME.hub.welcome.state);
  const tutor = () => page.evaluate(() => document.getElementById('tutor').classList.contains('on') ? document.getElementById('tutor').innerText : '');
  const stand = (x, z, yaw) => page.evaluate(([x, z, yaw]) => { const { G, player } = GAME; player.group.position.set(x, 0.6, z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0; G.yaw = player.faceYaw = yaw; }, [x, z, yaw]);
  const frames = async (n = 0.3) => { const gt = await page.evaluate(() => GAME.G.gt); await page.waitForFunction(([gt, n]) => GAME.G.gt > gt + n, [gt, n], { timeout: 20000 }).catch(() => {}); };
  const enter = async () => {
    await page.$eval('#hero-' + hero, el => el.click());
    await page.click('#mode-temple'); await page.click('#goText');
    return inHub();
  };
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    check(await enter(), `${hero}: into the hub`);
    const hubId = await page.evaluate(() => GAME.G.hubId);
    check(await cardUp(), `${hero}: a fresh file gets the welcome card (${hubId})`);
    const rows = await page.$$eval('#hubpanel .hw-row', r => r.length);
    check(rows >= 5, `${hero}: the card lists the hub's places (${rows})`);
    check(await page.evaluate(() => GAME.G.skillSelect), `${hero}: the card holds the hub still while it's up`);
    await page.waitForTimeout(400); await shot('card');

    // SHOW ME AROUND: every stop
    await page.locator('#hubpanel .hb-o', { hasText: 'SHOW ME AROUND' }).click();
    check(await page.evaluate(() => !document.getElementById('hubpanel').classList.contains('open') && !GAME.G.skillSelect), `${hero}: SHOW ME AROUND closes the card and frees the hero`);
    check((await st()).seen, `${hero}: answering the card marks the hub welcomed`);
    const stops = await page.evaluate(() => GAME.hub.welcome.stops);
    for (let i = 0; i < stops.length; i++){
      const s = stops[i];
      await frames();
      let t = await tutor();
      check(t.includes((i + 1) + ' / ' + stops.length), `${hero}: tour stop ${i + 1} is on the voice panel`);
      check((await st()).beacon, `${hero}: a beacon marks stop ${i + 1}`);
      if (await page.evaluate((w) => GAME.G.hubWing !== w, s.wing)){
        check(/through the .* DOOR/i.test(t), `${hero}: stop ${i + 1} is in another wing: the panel points to the door`);
        if (i === stops.length - 1) await shot('tour-door');
        // through the door the beacon is over (the start wing's door toward it), as walking does
        const door = await page.evaluate(() => { const t = GAME.hub.welcome.target, H = GAME.shared.arenaHalf - 1.5, m = Math.hypot(t.x, t.z); return { x: t.x / m * H, z: t.z / m * H }; });
        await stand(door.x, door.z, Math.atan2(-door.x, -door.z));
        check(await inHub(s.wing), `${hero}: through the door to ${s.wing}`);
        await frames();
        t = await tutor();
        check(t.includes('Walk up to'), `${hero}: in ${s.wing} the panel points to the station`);
      }
      if (i === 0) await shot('tour-1');
      await stand(s.x, s.z + (s.z > 0 ? -1.5 : 1.5), s.z > 0 ? Math.PI : 0);
      await frames(0.4);
      if (i < stops.length - 1) check((await st()).i === i + 1, `${hero}: reaching stop ${i + 1} moves the tour on`);
    }
    await frames();
    const last = await tutor();
    check(last.includes('DONE') && /Tap/.test(last), `${hero}: the last stop points to the first run`);
    await shot('tour-done');

    // back again (a reload, the same file): no card; the map brings it back
    await page.reload();
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    check(await enter(), `${hero}: back into the hub after a reload`);
    check(!(await cardUp(5000)), `${hero}: a welcomed file doesn't see the card again`);
    check(await page.evaluate(() => GAME.hub.welcome.open()), `${hero}: the welcome opens again on asking (a map's SHOW ME AROUND)`);
    check(await cardUp(3000), `${hero}: ...and it's the card`);
    const btns = await page.$$eval('#hubpanel .hb-o b', b => b.map(x => x.textContent));
    check(btns.includes('CLOSE'), `${hero}: seen before, its second button is CLOSE (${btns.join(', ')})`);
    await page.locator('#hubpanel .hb-o', { hasText: 'SHOW ME AROUND' }).click();
    await frames();
    check((await st()).tour, `${hero}: the tour runs again from the replay`);

    // a mode launched mid-tour ends it, and leaves the mode's own panel alone
    await page.evaluate(() => GAME.hub.launch('training'));
    check(await page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.training && !GAME.G.hub, null, { timeout: 120000 }).then(() => true, () => false), `${hero}: training launches mid-tour`);
    const s2 = await st();
    check(!s2.tour && !s2.beacon, `${hero}: the tour ends with the first run, its beacon gone`);
    check(!(await tutor()).includes('FIRST STEPS'), `${hero}: the training's panel isn't the tour's`);

    // a second save file is welcomed afresh
    await page.evaluate(() => { localStorage.setItem('sw_files', JSON.stringify({ active: 2, files: { 1: { at: 1 }, 2: { at: 2, fresh: true } } })); });
    await page.reload();
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    check(await enter(), `${hero}: into the hub on save file 2`);
    check(await cardUp(), `${hero}: save file 2 gets its own welcome`);
    await page.locator('#hubpanel .hb-o', { hasText: 'I KNOW THE WAY' }).click();
    await frames();
    const s3 = await st();
    check(s3.seen && !s3.tour && !(await tutor()), `${hero}: I KNOW THE WAY closes it with no tour`);
  } catch(e){ check(false, `${hero}: ${e.message}`); }
  check(!errors.length, `${hero}: no page or console errors`);
  for (const e of errors.slice(0, 6)) console.log('  ' + e);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
