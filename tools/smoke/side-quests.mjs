// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SIDE MISSIONS AND SECRETS SMOKE TEST — boots the BUILT game (dist/index.html), for each hero:
//   · the temple's CALLS FOR AID stone: its prompt, its panel lists the side missions, the first launches;
//   · every side mission builds (data/side-quests.js) and plays its objectives through to the win, and the win pays the
//     hero's profile (game/profile.js sides);
//   · the secrets on a story map (game/secrets.js) are placed on ground the hero can reach; walking up to one and pressing
//     interact takes it (a holocron's codex page, a cave's shard, a meditation's restore) and it stays found;
//   · SHOTS=dir writes a screenshot of each kind of secret and of the stone's panel there.
// Fails on any page error or console error, or a step that doesn't land where it should.
//   npm run build && npm run smoke:side

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
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
  const poll = { timeout: 90000 };
  const ticks = async (s = 0.3) => { const gt = await page.evaluate(() => GAME.G.gt); await page.waitForFunction(([gt, s]) => GAME.G.gt > gt + s, [gt, s], { timeout: 30000 }).catch(() => {}); };
  const stand = (x, z, yaw) => page.evaluate(([x, z, yaw]) => { const { G, player } = GAME; player.group.position.set(x, 0.2, z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0; G.yaw = player.faceYaw = yaw; }, [x, z, yaw]);
  const fight = async () => {
    for (let i = 0; i < 40 && !(await page.evaluate(() => GAME.G.mode === 'play' && !GAME.G.hub)); i++){
      for (const sel of ['#forms [data-go]', '#armory [data-go]']) if (await page.isVisible(sel)) await page.click(sel, { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  };
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.$eval('#hero-' + hero, el => el.click());
    await page.click('#mode-temple');
    await page.click('#goText');
    await page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused, null, poll);

    // the CALLS FOR AID stone in the hero's own hub (the temple's grand hall, the covert's hangar, the citadel's war room)
    const calls = await page.evaluate(() => { for (const [id, W] of Object.entries(GAME.hub.wings)){ const s = W.stations.find(s => s.act === 'quests'); if (s) return { wing: id, x: s.x, z: s.z, spawnZ: W.spawn[1] }; } return null; });
    check(!!calls, `${hero}: the ${await page.evaluate(() => GAME.G.hubId)} has a CALLS FOR AID stone (${calls && calls.wing})`);
    if (calls.wing !== await page.evaluate(() => GAME.G.hubWing)){
      await page.evaluate((w) => GAME.hub.goWing(w), calls.wing);
      await page.waitForFunction((w) => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused && GAME.G.hubWing === w, calls.wing, poll);
    }
    { const d = calls.spawnZ >= calls.z ? 1 : -1; await stand(calls.x, calls.z + 2.2 * d, d > 0 ? Math.PI : 0); } await ticks();
    check(await page.evaluate(() => /CALLS FOR AID/.test(document.getElementById('hubp').textContent) && document.getElementById('hubp').classList.contains('on')), `${hero}: the CALLS FOR AID prompt shows at the stone`);
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open'), null, { timeout: 5000 }).catch(() => {});
    const listed = await page.evaluate(() => [...document.querySelectorAll('#hubpanel .hb-o b')].map(b => b.textContent));
    check(listed.length >= 6 && listed.some(t => /FOREST SHRINE/.test(t)), `${hero}: the stone lists the side missions (${listed.length})`);
    if (SHOTS && hero === 'jedi') await page.screenshot({ path: path.join(SHOTS, 'calls-for-aid.png') });
    await page.locator('#hubpanel .hb-o', { hasText: 'THE FOREST SHRINE' }).first().click();
    await fight();
    check(await page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.mission && GAME.G.missionId === 'side:forest-shrine' && GAME.missionState().def && GAME.missionState().def.side, null, poll).then(() => true, () => false), `${hero}: the stone launches the side mission`);

    // the SECRETS on its map (the holdfast: a holocron, a cave and a meditation spot)
    await page.waitForFunction(() => GAME.secrets.placed().length > 0, null, { timeout: 30000 }).catch(() => {});
    const placed = await page.evaluate(() => GAME.secrets.placed());
    check(placed.length === 3, `${hero}: the holdfast's three secrets are placed (${placed.map(s => s.kind).join(', ')})`);
    for (const s of placed){
      // stand by it, looking at it from a few metres off for the picture, then step in and press interact
      if (SHOTS && hero === 'jedi'){
        await page.evaluate(() => { for (const e of GAME.enemies) e.hp = 0; });
        await stand(s.x + 2.6, s.z + 7, Math.atan2(-2.6, -7)); await page.evaluate(() => { GAME.G.pitch = -0.12; }); await ticks(0.8);
        await page.screenshot({ path: path.join(SHOTS, 'secret-' + s.kind + '.png') });
      }
      await page.evaluate(() => { for (const e of GAME.enemies) e.hp = 0; });
      await stand(s.x, s.z + (s.kind === "cave" ? 1.0 : 0.6), Math.PI); await ticks();
      const prompt = await page.evaluate(() => document.getElementById('secp').classList.contains('on') ? document.getElementById('secp').textContent : '');
      check(!!prompt, `${hero}: the ${s.kind} prompt shows (${prompt})`);
      await page.keyboard.press('f');
      if (s.kind === 'meditate'){   // (sit it out: foes kept off, pressed again if a foe broke it)
        for (let k = 0; k < 40 && !(await page.evaluate((id) => !!(GAME.PROFILE.profileOf().secrets || {})[id], s.id)); k++){
          await page.evaluate(() => { for (const e of GAME.enemies) e.hp = 0; GAME.player.hp = Math.max(GAME.player.hp, 50); });
          await ticks(0.5);
          if (!(await page.evaluate(() => /MEDITATING/.test(document.getElementById('secp').textContent)))) await page.keyboard.press('f');
        }
      } else await ticks(0.3);
      const got = await page.evaluate((id) => !!(GAME.PROFILE.profileOf().secrets || {})[id], s.id);
      check(got, `${hero}: the ${s.kind} is found and kept on the profile`);
    }
    if (placed.some(s => s.kind === 'holocron')) check(await page.evaluate(() => JSON.parse(localStorage.getItem('sw_codex') || '{}')['holo-holdfast'] >= 1), `${hero}: the holocron opens its codex page`);

    // the side mission plays through to the win and pays the profile
    for (let i = 0; i < 8 && await page.evaluate(() => GAME.G.mode === 'play'); i++){
      await page.waitForFunction(() => GAME.missionState().o || GAME.G.mode !== 'play', null, poll).catch(() => {});
      await page.evaluate(() => GAME.skipObjective()); await ticks(0.5);
    }
    check(await page.waitForFunction(() => GAME.G.mode === 'victory', null, poll).then(() => true, () => false), `${hero}: the side mission is won`);
    check(await page.evaluate(() => !!(GAME.PROFILE.profileOf().sides || {})['side:forest-shrine']), `${hero}: the win is on the profile`);
    // its light-or-dark choice (data/side-quests.js `choice`, game/alignment.js): asked once, before the results
    const card = await page.waitForSelector('#chapcard.open .cc-opt.al-light', { timeout: 15000 }).then(() => true, () => false);
    check(card, `${hero}: the side mission asks its light-or-dark choice`);
    if (SHOTS && card) await page.screenshot({ path: path.join(SHOTS, hero + '-side-choice.png') });
    const al0 = await page.evaluate(() => GAME.PROFILE.alignOf());
    if (card) await page.click('#chapcard .cc-opt.al-light');
    check(await page.evaluate(() => GAME.PROFILE.sidePicked('side:forest-shrine') === 'go'), `${hero}: the pick is kept on the profile`);
    check(await page.evaluate((a) => GAME.PROFILE.alignOf() > a, al0), `${hero}: letting them go moves the meter to the light`);
    check(await page.waitForFunction(() => document.getElementById('overlay').style.display === 'flex', null, { timeout: 10000 }).then(() => true, () => false), `${hero}: the results follow the choice`);

    // every other side mission builds and starts on its map, its objectives in order
    for (const id of ['side:ledger-child', 'side:temple-droid', 'side:relic-thief', 'side:drowned-holocron', 'side:grave-knight']){
      await page.evaluate((id) => { document.getElementById('overlay').style.display = 'none'; GAME.G.missionId = id; GAME.startMission(id); GAME.G.mode = 'play'; GAME.G.paused = false; }, id);
      const ok = await page.waitForFunction((id) => GAME.missionState().on && GAME.missionState().def.id === id && GAME.missionState().o, id, poll).then(() => true, () => false);
      const objs = await page.evaluate(() => GAME.missionState().def.objectives.map(o => o.kind).join(' › '));
      check(ok, `${hero}: ${id} starts (${objs})`);
      for (let i = 0; i < 6 && await page.evaluate(() => GAME.G.mode === 'play' && GAME.missionState().on); i++){
        await page.waitForFunction(() => GAME.missionState().o || GAME.G.mode !== 'play', null, poll).catch(() => {});
        await page.evaluate(() => GAME.skipObjective()); await ticks(0.5);
      }
      check(await page.waitForFunction(() => GAME.G.mode === 'victory', null, poll).then(() => true, () => false), `${hero}: ${id} plays through to the win`);
    }
  } catch(e){ check(false, `${hero}: ${e.message}`); }
  for (const e of errors) check(false, `${hero}: ${e}`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
