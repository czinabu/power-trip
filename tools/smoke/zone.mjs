// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// OPEN ZONE SMOKE TEST — boots the BUILT game (dist/index.html) and roams the old city of Jedha (game/zone.js, data/zones.js)
// as each hero:
//   · in from the hub: each hub's ship (the temple's landing platform, the citadel's gunship, the covert's ship) and the
//     council table (the war room, the clan hall) list the zone, and it launches straight in;
//   · the streets stream: only the chunks round the hero are built, a far jump builds the new ones and drops the old
//     (world/zone-stream.js), and every wall collides from the first frame;
//   · walking into a district names it on the HUD; walking up to a waystone touches it (and the profile keeps it);
//   · F at a waystone opens its panel, and travel lands at a touched one;
//   · a fall wakes the hero at the nearest touched waystone, whole;
//   · the minimap is up; M opens the full map, and travel from it lands at a touched waystone (ui/zone-map.js);
//   · the gate's waystone takes you home, back into the hub.
// Fails on any page error or console error, or a step that doesn't land where it should.
//   npm run build && npm run smoke:zone          (HEROES=jedi only that hero)

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
const COUNCIL = { temple: 'council', kamino: 'warroom', covert: 'clan' };
// each hub's ship to Jedha: [wing, x, z] of its station (data/hub.js: the temple's landing platform, the citadel's gunship, the covert's own ship)
const SHIP = { temple: ['landing', 0, 3], kamino: ['deck', -21, -24], covert: ['hangar', -5, -9] };

for (const hero of HEROES){
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
      for (const h of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + h, '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
  const until = (fn, arg, ms = 60000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  const live = () => until(() => GAME.G.mode === 'play' && !GAME.G.paused && !GAME.G.skillSelect, null, 120000);
  const frames = async (n = 0.3) => { const gt = await page.evaluate(() => GAME.G.gt); await until((gt) => GAME.G.gt > gt, gt + n, 30000); };
  const stand = (x, z, yaw = Math.PI) => page.evaluate(([x, z, yaw]) => { const { G, player } = GAME; player.group.position.set(x, 0.6, z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0; G.yaw = player.faceYaw = yaw; }, [x, z, yaw]);
  const panelUp = () => page.evaluate(() => document.getElementById('zonepanel').classList.contains('open'));
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.$eval('#hero-' + hero, el => el.click());
    await page.click('#mode-temple');
    await page.click('#goText');
    check(await until(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused), `${hero}: into the hub`);
    const hubId = await page.evaluate(() => GAME.G.hubId), council = COUNCIL[hubId] || 'council';

    // THE SHIP: each hub has one that flies to Jedha, at its own station
    { const [w, x, z] = SHIP[hubId];
      await page.evaluate((w) => GAME.hub.goWing(w), w);
      check(await until((w) => GAME.G.hub && GAME.G.hubWing === w && !GAME.G.paused, w), `${hero}: to the ${w}, where the ship to Jedha is`);
      await stand(x, z); await frames();
      await page.keyboard.press('f');
      await until(() => document.getElementById('hubpanel').classList.contains('open'), null, 5000);
      check(await page.locator('#hubpanel .hb-o', { hasText: 'FLY TO JEDHA' }).count() > 0, `${hero}: the ${hubId}'s ship offers the flight to Jedha`);
      await page.keyboard.press('Escape'); await until(() => !document.getElementById('hubpanel').classList.contains('open'), null, 5000); }

    // THE COUNCIL TABLE lists the zone, and it launches straight in (no forms page or armory first)
    await page.evaluate((w) => GAME.hub.goWing(w), council);
    check(await until((w) => GAME.G.hub && GAME.G.hubWing === w && !GAME.G.paused, council), `${hero}: to the ${council}`);
    await stand(0, 7); await frames();
    await page.keyboard.press('f');
    await until(() => document.getElementById('hubpanel').classList.contains('open'), null, 5000);
    const zoneOpt = page.locator('#hubpanel .hb-o', { hasText: 'OPEN ZONE' }).first();
    check(await zoneOpt.count() > 0, `${hero}: the ${hubId}'s mode table lists the open zone`);
    if (await zoneOpt.count()) await zoneOpt.click(); else await page.evaluate(() => GAME.zone.startZone('jedha'));
    check(await until(() => GAME.G.mode === 'play' && GAME.G.zone === 'jedha' && !GAME.G.hub && !GAME.G.paused, null, 120000), `${hero}: the open zone launches`);
    await frames(0.5);
    const at0 = await page.evaluate(() => ({ p: GAME.player.group.position.clone(), info: GAME.zone.zoneStreamInfo(), hp: GAME.player.hp, kit: Object.keys(GAME.G.unlocked || {}).length }));
    check(Math.abs(at0.p.x) < 8 && Math.abs(at0.p.z - 96) < 8, `${hero}: lands on the landing pad by the gate (${at0.p.x.toFixed(1)}, ${at0.p.z.toFixed(1)})`);
    check(at0.info.on && at0.info.built > 0 && at0.info.built < at0.info.chunks, `${hero}: only the streets round the gate are built (${at0.info.built} of ${at0.info.chunks} chunks)`);
    check(await page.evaluate(() => document.getElementById('waveinfo').textContent.includes('OPEN ZONE')), `${hero}: the HUD names the zone`);

    // STREAMING: a far jump builds the streets there and lets the old ones go
    await stand(-62, -56.5, Math.PI);   // the Kyber Workings, by its waystone
    await frames(1.5);
    const far = await page.evaluate(() => GAME.zone.zoneStreamInfo());
    check(far.drops > 0 && far.builds > at0.info.builds, `${hero}: a far jump builds new streets and drops the old (${far.builds} built, ${far.drops} dropped)`);
    check(await page.evaluate(() => GAME.zone.zoneDistrict()?.id === 'workings'), `${hero}: the district walked into is named (the Kyber Workings)`);
    check(await until(() => GAME.zone.stonesTouched().some(w => w.id === 'workings'), null, 10000), `${hero}: walking up to a waystone touches it`);
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('sw_profile') || '{}') && GAME.zone.stonesTouched().length >= 2), `${hero}: the profile keeps the touched stones`);
    // every wall collides wherever the hero is: a run into the city wall stops at it
    await stand(-106, -66, -Math.PI / 2); await frames();   // (facing west, the wall a few strides off)
    await page.keyboard.down('w'); await frames(2.5); await page.keyboard.up('w');
    const wx = await page.evaluate(() => GAME.player.group.position.x);
    check(wx < -108 && wx > -116, `${hero}: walking into the city wall stops at it (x ${wx.toFixed(1)})`);

    // F AT A WAYSTONE: the panel lists the stones, and travel lands at a touched one
    await stand(-62, -57.5, 0); await frames();
    check(await page.evaluate(() => document.getElementById('zonep').classList.contains('on')), `${hero}: the waystone prompt shows`);
    await page.keyboard.press('f');
    await until(() => document.getElementById('zonepanel').classList.contains('open'), null, 5000);
    check(await panelUp(), `${hero}: F opens the waystone panel`);
    const gateOpt = page.locator('#zonepanel .hb-o', { hasText: 'PILGRIMS\' GATE' }).first();
    if (await gateOpt.count()) await gateOpt.click();
    check(await until(() => !GAME.G.paused && Math.hypot(GAME.player.group.position.x - 10, GAME.player.group.position.z - 87) < 6, null, 30000), `${hero}: travel lands at the gate's waystone`);

    // THE MAPS (ui/zone-map.js): the minimap is up, M opens the full map (never the music), a touched waystone on it
    // travels, Esc closes it, and a controller's LB + VIEW (an untrusted M) opens it too
    check(await page.evaluate(() => GAME.zoneMap.info().mini && getComputedStyle(document.getElementById('minimap')).display !== 'none'), `${hero}: the minimap is up in the zone`);
    await page.keyboard.press('m');
    check(await until(() => GAME.zoneMap.info().open && GAME.G.skillSelect, null, 5000), `${hero}: M opens the full map`);
    check(await page.evaluate(() => !/MUSIC/.test(document.getElementById('banner').textContent)), `${hero}: M in the zone leaves the music alone`);
    check(await page.evaluate(() => GAME.zoneMap.info().pins >= 2), `${hero}: the touched waystones are pinned on the map`);
    const goWork = page.locator('#zonemap .zm-go', { hasText: 'KYBER WORKINGS' }).first();
    check(await goWork.count() > 0, `${hero}: the map lists the touched waystones to travel to`);
    if (await goWork.count()) await goWork.click(); else await page.evaluate(() => GAME.zone.travelTo('workings'));
    check(await until(() => !GAME.G.paused && !GAME.G.skillSelect && Math.hypot(GAME.player.group.position.x + 62, GAME.player.group.position.z + 57) < 6, null, 30000), `${hero}: travel from the map lands at the waystone`);
    await frames();
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true })));
    check(await until(() => GAME.zoneMap.info().open, null, 5000), `${hero}: the controller's map button opens it`);
    await page.keyboard.press('Escape');
    check(await until(() => !GAME.zoneMap.info().open && !GAME.G.skillSelect, null, 5000), `${hero}: Esc closes the map`);

    // A FALL: the hero wakes at the nearest touched waystone, whole
    await stand(-58, -40); await frames();
    await page.evaluate(() => { GAME.G.reviveLeft = 0; GAME.player.hp = 1; GAME.hurtPlayer(9999, null); });   // (no second chance: the trooper's squad would get them up first)
    check(await until(() => GAME.G.zoneFallT > 0, null, 5000), `${hero}: a fall in the zone is not the end of it`);
    check(await until(() => GAME.G.zoneFallT === 0 && !GAME.G.paused && GAME.player.hp >= 50 && Math.hypot(GAME.player.group.position.x + 62, GAME.player.group.position.z + 57) < 6, null, 30000), `${hero}: wakes whole at the nearest touched waystone`);
    check(await page.evaluate(() => GAME.G.mode === 'play' && GAME.G.zone === 'jedha'), `${hero}: still roaming after the fall`);

    // THE WAY HOME: the gate's stone, RETURN TO …
    await page.evaluate(() => GAME.zone.travelTo('gate'));
    await until(() => !GAME.G.paused && Math.hypot(GAME.player.group.position.x - 10, GAME.player.group.position.z - 87) < 6, null, 30000);
    await stand(10, 86.5, Math.PI); await frames();
    await page.keyboard.press('f');
    await until(() => document.getElementById('zonepanel').classList.contains('open'), null, 5000);
    const home = page.locator('#zonepanel .hb-o', { hasText: 'RETURN TO' }).first();
    check(await home.count() > 0, `${hero}: the gate's waystone offers the way home`);
    if (await home.count()) await home.click();
    check(await until(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.zone && !GAME.G.paused, null, 120000), `${hero}: back in the hub from the zone`);
    check(await page.evaluate(() => !GAME.zone.zoneStreamInfo().on), `${hero}: the zone's streets are let go in the hub`);
    check(await page.evaluate(() => !GAME.zoneMap.info().mini), `${hero}: no minimap in the hub`);
    await live();
  } catch (e){ check(false, `${hero}: ${e.message}`); }
  for (const e of errors) check(false, `${hero}: ${e}`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
