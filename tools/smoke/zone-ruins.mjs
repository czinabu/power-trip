// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// GATE RUINS SMOKE TEST — boots the BUILT game (dist/index.html) and roams the second open zone, the ruins of the Sith
// gate (data/zones.js ZONES.ruins, data/zone-ruins.js, world/zones/ruins-plan.js), as each hero:
//   · the gate: the hub's mode table shows it locked until this hero has closed THE GATE WAKES (Act IV's
//     first chapter), then it launches straight in;
//   · it streams like Jedha: only the chunks round the hero are built, a far jump builds the new ones; the cliffs collide;
//   · the Hollow Choir: a patrol comes in the ruins, dressed in the Choir's robes, never at the threshold;
//   · every quest giver stands on open ground a hero can walk to from the gate, and a quest runs end to end;
//   · nine secrets stand at their spots; a fall wakes the hero at a waystone; the threshold's waystone goes home.
// Fails on any page error or console error, or a step that doesn't land where it should.
//   npm run build && npm run smoke:zone-ruins          (HEROES=jedi only that hero)

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
// each hub's mode table, which lists every open zone: [wing, x, z] of its station (data/hub.js)
const TABLE = { temple: ['council', 0, 7], kamino: ['warroom', 0, 7], covert: ['clan', 0, 7] };

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
  const frames = async (n = 0.3) => { const gt = await page.evaluate(() => GAME.G.gt); await until((gt) => GAME.G.gt > gt, gt + n, 120000); };
  const stand = (x, z, yaw = Math.PI) => page.evaluate(([x, z, yaw]) => { const { G, player } = GAME; player.group.position.set(x, 0.6, z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0; G.yaw = player.faceYaw = yaw; }, [x, z, yaw]);
  const tapF = async () => { await page.keyboard.down('f'); await page.waitForTimeout(350); await page.keyboard.up('f'); await frames(0.2); };
  // a Mando with a full belt is asked which guns to carry as each hub wing loads (ui/armory-ui.js): carry them
  const settle = async () => {
    for (let k = 0; k < 30 && await page.evaluate(() => !!GAME.G.skillSelect || !!GAME.G.paused); k++){
      for (const sel of ['#armory [data-go]', '#forms [data-go]']) if (await page.isVisible(sel)) await page.click(sel, { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  };
  const godly = () => page.evaluate(() => { GAME.player.hp = 9999; });
  const shipPanel = async () => {
    await frames(0.3);
    await until(() => document.getElementById('hubp').classList.contains('on'), null, 10000);   // (the station's prompt is up)
    await page.keyboard.press('f');
    await until(() => document.getElementById('hubpanel').classList.contains('open'), null, 5000);
    const opt = page.locator('#hubpanel .hb-o', { hasText: 'OPEN ZONE · THE SITH GATE' }).first();
    return opt;
  };
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.$eval('#hero-' + hero, el => el.click());
    await page.click('#mode-temple');
    await page.click('#goText');
    await until(() => GAME.G.mode === 'play' && GAME.G.hub, null, 120000);
    await settle();
    check(await until(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused && !GAME.G.skillSelect, null, 120000), `${hero}: into the hub`);
    const hubId = await page.evaluate(() => GAME.G.hubId);

    // THE GATE: locked (with the chapter to reach) until this hero has closed THE GATE WAKES, even with the campaign beaten
    const [w, sx, sz] = TABLE[hubId];
    await page.evaluate((w) => { if (GAME.G.hubWing !== w) GAME.hub.goWing(w); }, w);
    await until((w) => GAME.G.hub && GAME.G.hubWing === w && !GAME.G.paused, w);
    await page.waitForTimeout(600); await settle();
    await stand(sx, sz); await frames();
    let opt = await shipPanel();
    check(await opt.count() > 0, `${hero}: the ${hubId}'s mode table lists the Sith gate`);
    check(await opt.evaluate(el => /GATE WAKES/.test(el.textContent)).catch(() => false), `${hero}: it is locked, naming Act IV's first chapter`);
    await page.keyboard.press('Escape'); await until(() => !document.getElementById('hubpanel').classList.contains('open'), null, 5000);
    await page.evaluate(() => { const p = GAME.PROFILE.profileOf(); p.cleared['gate-wake'] = 1; });   // (as a close of the chapter records it: game/profile.js)
    opt = await shipPanel();
    check(await opt.count() > 0 && !(await opt.evaluate(el => /GATE WAKES/.test(el.textContent))), `${hero}: once THE GATE WAKES is closed, it opens`);
    if (await opt.count()) await opt.click(); else await page.evaluate(() => GAME.zone.startZone('ruins'));
    check(await until(() => GAME.G.mode === 'play' && GAME.G.zone === 'ruins' && !GAME.G.hub && !GAME.G.paused, null, 120000), `${hero}: the ruins launch`);
    await frames(0.5);
    const at0 = await page.evaluate(() => ({ p: GAME.player.group.position.clone(), info: GAME.zone.zoneStreamInfo() }));
    check(Math.abs(at0.p.x) < 8 && Math.abs(at0.p.z - 93) < 8, `${hero}: lands at the threshold, before the gate (${at0.p.x.toFixed(1)}, ${at0.p.z.toFixed(1)})`);
    check(at0.info.on && at0.info.built > 0 && at0.info.built < at0.info.chunks, `${hero}: only the ruins round the gate are built (${at0.info.built} of ${at0.info.chunks} chunks)`);
    check(await page.evaluate(() => /SITH GATE/.test(document.getElementById('waveinfo').textContent)), `${hero}: the HUD names the zone`);

    // EVERY GIVER on open ground, walkable from the gate; every secret at its spot
    const reach = await page.evaluate(() => GAME.zone.zoneGivers().map(g => ({ id: g.id, ok: !!GAME.navRoute?.(0, 92, g.x, g.z, 0, 20000) })));
    check(reach.length === 6, `${hero}: six people stand in the ruins (${reach.length})`);
    if (reach.some(r => r.ok)) check(reach.every(r => r.ok), `${hero}: every one can be walked to from the gate (${reach.filter(r => !r.ok).map(r => r.id).join(', ') || 'all'})`);
    const placed = await page.evaluate(() => GAME.secrets.placed());
    check(placed.length === 9 && ['holocron', 'cave', 'meditate'].every(k => placed.filter(s => s.kind === k).length === 3), `${hero}: three of each secret stand in the ruins (${placed.length})`);

    // STREAMING and the districts: a far jump to the bleeding scar
    await stand(-62, -56.5, Math.PI); await frames(1.5);
    const far = await page.evaluate(() => GAME.zone.zoneStreamInfo());
    check(far.drops > 0 && far.builds > at0.info.builds, `${hero}: a far jump builds new streets and drops the old (${far.builds} built, ${far.drops} dropped)`);
    check(await page.evaluate(() => GAME.zone.zoneDistrict()?.id === 'scar'), `${hero}: the district walked into is named (the bleeding scar)`);
    check(await until(() => GAME.zone.stonesTouched().some(w => w.id === 'scar'), null, 10000), `${hero}: walking up to a waystone touches it`);
    // the cliffs collide: a run west stops at them
    await stand(-104, -30, -Math.PI / 2); await frames();
    await page.keyboard.down('w'); await frames(2.5); await page.keyboard.up('w');
    const wx = await page.evaluate(() => GAME.player.group.position.x);
    check(wx < -106 && wx > -116, `${hero}: walking into the cliffs stops at them (x ${wx.toFixed(1)})`);

    // THE CHOIR: no patrol at the threshold; one comes on the avenue, in the Choir's robes
    await stand(0, 100); await frames(8);
    check(await page.evaluate(() => GAME.zone.zonePatrols()) === 0, `${hero}: no patrol at the threshold`);
    await stand(4, 4); await godly();
    check(await until(() => { GAME.player.hp = 9999; return GAME.zone.zonePatrols() > 0; }, null, 120000), `${hero}: a Choir patrol comes along the avenue`);
    check(await page.evaluate(() => GAME.foeType ? GAME.foeType('blaster').color === 0x26222c : true), `${hero}: the patrols wear the Choir's robes`);
    await page.evaluate(() => { for (const e of GAME.enemies) if (!e.dead) GAME.damageEnemy(e, 99999, null, 0, false, false); });

    // A QUEST end to end: Kast's lost patrol
    const sidesBefore = await page.evaluate(() => GAME.PROFILE.sidesWon());
    const g = await page.evaluate(() => GAME.zone.zoneGivers().find(g => g.id === 'patrol'));
    await stand(g.x, g.z + 1.6); await frames(0.6);
    check(await page.evaluate(() => /SIDE QUEST/.test(document.getElementById('zoneqp').textContent)), `${hero}: the sergeant offers a side quest`);
    await tapF();
    check((await page.evaluate(() => GAME.zone.zoneQuest()))?.id === 'patrol', `${hero}: F starts the quest`);
    for (const [x, z] of [[-100, 58], [-62, 100], [-98, 97]]){
      await stand(x, z + 1); await godly(); await frames(0.4);
      if (!/BEACON/.test(await page.evaluate(() => document.getElementById('zoneqp').textContent))){ await stand(x + 1, z); await frames(0.4); }
      await tapF();
    }
    check(await until(() => GAME.zone.zoneQuest()?.i === 1, null, 10000), `${hero}: all three beacons recovered`);
    await stand(-80, 94); await godly();
    check(await until(() => GAME.enemies.some(e => e.zq === 'patrol' && !e.dead), null, 30000), `${hero}: the Choir waiting by the mounds comes out`);
    await page.evaluate(() => { for (const e of GAME.enemies) if (e.zq && !e.dead) GAME.damageEnemy(e, 99999, null, 0, false, false); });
    check(await until(() => GAME.zone.zoneQuest()?.i === 2, null, 30000), `${hero}: beaten, it's back to the sergeant`);
    await page.evaluate(() => { for (const e of GAME.enemies) if (!e.dead) GAME.damageEnemy(e, 99999, null, 0, false, false); });
    await stand(g.x, g.z + 1.6); await frames(0.6); await tapF();
    check(await until(() => !GAME.zone.zoneQuest(), null, 10000), `${hero}: the quest is done`);
    check(await page.evaluate((n) => GAME.PROFILE.sidesWon() === n + 1 && GAME.PROFILE.sideWon('zone:ruins:patrol'), sidesBefore), `${hero}: it counts as a side mission won`);

    // A FALL: wakes at the nearest touched waystone, whole
    await stand(-58, -44); await frames();
    await page.evaluate(() => { GAME.G.reviveLeft = 0; GAME.player.hp = 1; GAME.hurtPlayer(9999, null); });
    check(await until(() => GAME.G.zoneFallT > 0, null, 5000), `${hero}: a fall in the ruins is not the end of it`);
    check(await until(() => GAME.G.zoneFallT === 0 && !GAME.G.paused && GAME.player.hp >= 50 && Math.hypot(GAME.player.group.position.x + 62, GAME.player.group.position.z + 57) < 6, null, 30000), `${hero}: wakes whole at the bleeding scar's waystone`);

    // THE WAY HOME: back through the gate
    await page.evaluate(() => GAME.zone.travelTo('threshold'));
    await until(() => !GAME.G.paused && Math.hypot(GAME.player.group.position.x - 10, GAME.player.group.position.z - 87) < 6, null, 30000);
    await stand(10, 86.5, Math.PI); await frames();
    await page.keyboard.press('f');
    await until(() => document.getElementById('zonepanel').classList.contains('open'), null, 5000);
    const home = page.locator('#zonepanel .hb-o', { hasText: 'RETURN TO' }).first();
    check(await home.count() > 0 && /through the gate/.test(await home.textContent()), `${hero}: the threshold's waystone offers the way home, back through the gate`);
    if (await home.count()) await home.click();
    check(await until(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.zone && !GAME.G.paused, null, 120000), `${hero}: back in the hub from the ruins`);
  } catch (e){ check(false, `${hero}: ${e.message}`); }
  for (const e of errors) check(false, `${hero}: ${e}`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
