// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// OPEN ZONE LIFE SMOKE TEST: boots the BUILT game (dist/index.html), goes into the old city of Jedha as each hero and
// checks what lives there (data/zone-jedha.js):
//   · the secrets stand at their hand-set spots; a holocron taken opens its own page in the codex and stays found;
//   · a district's patrol comes once a hero has walked it a while, never at the gate, and is let go once left far behind;
//   · a quest end to end: F at the giver starts it, its steps are on the HUD, lamps are lit with F, the foes waiting are
//     beaten, and back at the giver it counts as a side mission won;
//   · a quest's choice is asked once it's done, and the pick moves the hero's meter;
//   · a moment asks its choice there and then.
// Fails on any page error or console error, or a step that doesn't land where it should.
//   npm run build && npm run smoke:zone-life          (HEROES=jedi only that hero)

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
  const pickCard = async (key) => { await until(() => document.getElementById('chapcard').classList.contains('open'), null, 30000); await page.click('#chapcard [data-go="' + key + '"]'); await frames(0.2); };
  const quest = () => page.evaluate(() => GAME.zone.zoneQuest());
  const godly = () => page.evaluate(() => { GAME.player.hp = 9999; });
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.$eval('#hero-' + hero, el => el.click());
    await page.click('#mode-temple');
    await page.click('#goText');
    check(await until(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused, null, 120000), `${hero}: into the hub`);
    await page.evaluate(() => GAME.zone.startZone('jedha'));
    check(await until(() => GAME.G.mode === 'play' && GAME.G.zone === 'jedha' && !GAME.G.paused, null, 120000), `${hero}: into the old city`);
    await frames(1);

    // SECRETS: at their hand-set spots, each its own find
    const placed = await page.evaluate(() => GAME.secrets.placed());
    check(placed.length === 9 && ['holocron', 'cave', 'meditate'].every(k => placed.filter(s => s.kind === k).length === 3), `${hero}: three of each secret stand in the city (${placed.length})`);
    const holo = placed.find(s => s.id === 'zoJedha:holo-gate:holocron');
    check(holo && Math.hypot(holo.x + 100, holo.z - 100) < 8, `${hero}: the pilgrim's holocron stands near its spot`);
    if (holo){
      await stand(holo.x, holo.z + 1.2); await frames(0.6);
      check(await page.evaluate(() => document.getElementById('secp').classList.contains('on')), `${hero}: the holocron's prompt shows`);
      await tapF();
      check(await until(() => !!(GAME.PROFILE.profileOf().secrets || {})['zoJedha:holo-gate:holocron'], null, 10000), `${hero}: the holocron is found, and kept on the profile`);
      check(await page.evaluate(() => { try { return !!JSON.parse(localStorage.getItem('sw_codex') || '{}')['holo-pilgrim']; } catch(e){ return false; } }), `${hero}: its own page opens in the codex`);
    }

    // PATROLS: none at the gate; in the square one comes, and it's let go once left far behind
    await stand(0, 100); await frames(8);
    check(await page.evaluate(() => GAME.zone.zonePatrols()) === 0, `${hero}: no patrol at the pilgrims' gate`);
    await stand(4, 4); await godly();
    check(await until(() => GAME.zone.zonePatrols() > 0, null, 120000), `${hero}: a patrol comes through the square`);
    const far = await page.evaluate(() => { const p = GAME.player.group.position; return Math.min(...GAME.enemies.filter(e => e.zr && !e.dead).map(e => Math.hypot(e.group.position.x - p.x, e.group.position.z - p.z))); });
    check(far > 12, `${hero}: it comes in some way off (${far.toFixed(1)} m)`);
    await stand(-100, 104); await frames(1.5);
    check(await until(() => GAME.zone.zonePatrols() === 0, null, 30000), `${hero}: a patrol left far behind is let go`);

    // A QUEST end to end: the silent lamps
    const sidesBefore = await page.evaluate(() => GAME.PROFILE.sidesWon());
    const g = await page.evaluate(() => GAME.zone.zoneGivers().find(g => g.id === 'lamps'));
    await stand(g.x, g.z + 1.6); await frames(0.6);
    check(await page.evaluate(() => /SIDE QUEST/.test(document.getElementById('zoneqp').textContent)), `${hero}: the old pilgrim offers a side quest`);
    await tapF();
    check(!!(await quest()) && (await quest()).id === 'lamps', `${hero}: F starts the quest`);
    check(await page.evaluate(() => /THE SILENT LAMPS/.test(document.getElementById('waveinfo').textContent)), `${hero}: the HUD shows the quest's step`);
    for (const [x, z] of [[-100, 58], [-58, 102], [-98, 104]]){
      await stand(x, z + 1); await frames(0.4);
      const t = await page.evaluate(() => document.getElementById('zoneqp').textContent);
      if (!/LAMP/.test(t)){ await stand(x + 1, z); await frames(0.4); }
      await tapF();
    }
    check(await until(() => { const q = GAME.zone.zoneQuest(); return q && q.i === 1; }, null, 10000), `${hero}: all three lamps lit, on to the next step`);
    await stand(-80, 96); await godly();
    check(await until(() => GAME.enemies.some(e => e.zq === 'lamps' && !e.dead), null, 30000), `${hero}: the scavengers come to see who lit them`);
    await page.evaluate(() => { for (const e of GAME.enemies) if (e.zq && !e.dead) GAME.damageEnemy(e, 99999, null, 0, false, false); });
    check(await until(() => { const q = GAME.zone.zoneQuest(); return q && q.i === 2; }, null, 30000), `${hero}: beaten, it's back to the pilgrim`);
    await stand(g.x, g.z + 1.6); await frames(0.6); await tapF();
    check(await until(() => !GAME.zone.zoneQuest(), null, 10000), `${hero}: the quest is done`);
    check(await page.evaluate((n) => GAME.PROFILE.sidesWon() === n + 1 && GAME.PROFILE.sideWon('zone:jedha:lamps'), sidesBefore), `${hero}: it counts as a side mission won`);

    // A QUEST'S CHOICE: the trader's strongbox, straight to its end (its steps are the same kinds), then the pick
    const a0 = await page.evaluate(() => GAME.PROFILE.alignOf());
    const g2 = await page.evaluate(() => GAME.zone.zoneGivers().find(g => g.id === 'strongbox'));
    await stand(g2.x, g2.z + 1.6); await frames(0.6); await tapF();
    check((await quest())?.id === 'strongbox', `${hero}: the spice trader's quest begins`);
    await stand(-96, 22); await godly();
    await until(() => GAME.enemies.some(e => e.zq === 'strongbox' && !e.dead), null, 30000);
    await page.evaluate(() => { for (const e of GAME.enemies) if (e.zq && !e.dead) GAME.damageEnemy(e, 99999, null, 0, false, false); });
    await until(() => GAME.zone.zoneQuest()?.i === 1, null, 30000);
    await page.evaluate(() => { for (const e of GAME.enemies) if (!e.dead) GAME.damageEnemy(e, 99999, null, 0, false, false); });
    const box = [-98, 16];
    await stand(box[0], box[1] + 1); await frames(0.4);
    if (!/STRONGBOX/.test(await page.evaluate(() => document.getElementById('zoneqp').textContent))){ await stand(box[0] + 1, box[1]); await frames(0.4); }
    await tapF();
    check(await until(() => GAME.zone.zoneQuest()?.i === 2, null, 10000), `${hero}: the strongbox taken back`);
    await stand(g2.x, g2.z + 1.6); await frames(0.6); await tapF();
    await pickCard('temple');
    check(await page.evaluate((a0) => GAME.PROFILE.alignOf() > a0 && GAME.PROFILE.sidePicked('zone:jedha:strongbox') === 'temple', a0), `${hero}: the quest's choice is asked, and the light pick moves the meter`);

    // A MOMENT: the informer, there and then
    const a1 = await page.evaluate(() => GAME.PROFILE.alignOf());
    const g3 = await page.evaluate(() => GAME.zone.zoneGivers().find(g => g.id === 'informer'));
    await page.evaluate(() => { for (const e of GAME.enemies) if (!e.dead) GAME.damageEnemy(e, 99999, null, 0, false, false); });
    await stand(g3.x, g3.z + 1.6); await frames(0.6);
    check(await page.evaluate(() => /A MOMENT/.test(document.getElementById('zoneqp').textContent)), `${hero}: the informer's moment is offered`);
    await tapF();
    await pickCard('step');
    check(await page.evaluate((a1) => GAME.PROFILE.alignOf() < a1 && GAME.PROFILE.sidePicked('zone:jedha:informer') === 'step', a1), `${hero}: a moment's dark pick moves the meter the other way`);
    await frames(0.6);
    check(await page.evaluate(() => !/A MOMENT/.test(document.getElementById('zoneqp').textContent)), `${hero}: a moment is asked once`);
  } catch (e){ check(false, `${hero}: ${e.message}`); }
  for (const e of errors) check(false, `${hero}: ${e}`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
