// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// APPRENTICE SMOKE TEST (allies/apprentice.js, data/apprentices.js) — boots the BUILT game and, for each hero:
//   · the apprentice's post in the hub stays hidden until they've come to you, then they stand there and F opens their
//     panel, where you take them on (the trooper promotes a squadmate to second);
//   · a mission with a squad of two brings one squadmate and the apprentice (a slot, not an extra); the trooper's pick
//     comes promoted; survival, the sandbox and an open zone bring them too; the training grounds don't;
//   · they fight: the Padawan uses a power the run has, the foundling spots a foe; their kills and your rank XP grow them;
//   · left at home, they don't come.
//   npm run build && npm run smoke:apprentice            (SHOTS=<dir> saves screenshots)

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href;
if (!existsSync(path.join(root, 'dist/index.html'))){ console.error('dist/index.html missing: run `npm run build` first'); process.exit(1); }
const shots = process.env.SHOTS;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failed = false;
const check = (ok, what) => { console.log((ok ? 'ok: ' : 'FAIL: ') + what); if (!ok) failed = true; };
const HEROES = (process.env.HEROES || 'jedi,mando,trooper').split(',');
const POST = { jedi: 'training', mando: 'pit', trooper: 'range' };

for (const hero of HEROES){
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
  const shot = async (n) => { if (!shots) return; await page.waitForTimeout(500); await page.screenshot({ path: path.join(shots, hero + '-' + n + '.png') }); };
  const inHub = (wing) => page.waitForFunction((w) => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused && !GAME.G.skillSelect && (!w || GAME.G.hubWing === w), wing, { timeout: 60000 }).then(() => true, () => false);
  const playing = () => page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.hub, null, { timeout: 60000 }).then(() => true, () => false);
  const frames = async (s) => { const gt = await page.evaluate(() => GAME.G.gt); await page.waitForFunction(([gt, s]) => GAME.G.gt > gt + s, [gt, s], { timeout: 60000 }).catch(() => {}); };
  const fight = async () => {
    for (let i = 0; i < 30 && !(await page.evaluate(() => GAME.G.mode === 'play' && !GAME.G.paused && !GAME.G.skillSelect)); i++){
      for (const sel of ['#forms [data-go]', '#armory [data-go]']) if (await page.isVisible(sel)) await page.$eval(sel, el => el.click()).catch(() => {});
      await page.waitForTimeout(400);
    }
  };
  // (the Mando's armory card for a gun the story carried in, as a covert wing opens: CARRY THESE)
  const settle = async () => {
    for (let i = 0, calm = 0; i < 40 && calm < 3; i++){
      await page.waitForTimeout(1000);
      if (await page.isVisible('#armory [data-go]')){ calm = 0; await page.$eval('#armory [data-go]', el => el.click()).catch(() => {}); }
      else if (await page.evaluate(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.skillSelect)) calm++;
    }
  };
  const apprentice = () => page.evaluate(() => { const n = GAME.APPRENTICE.apprenticeNow(), a = n.ally || n.second; return { has: !!a, name: a && a.name, lead: !!(a && a.lead), allies: GAME.squad.allies.length, names: GAME.squad.allies.map(o => o.name) }; });
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.$eval('#hero-' + hero, el => el.click());
    await page.$eval('#mode-temple', el => el.click()); await page.click('#goText');
    await settle();
    check(await inHub(), `${hero}: into the hub`);
    await page.evaluate((w) => GAME.hub.goWing(w), POST[hero]);
    await settle();
    check(await inHub(POST[hero]), `${hero}: at the apprentice's wing`);
    await frames(0.3);
    check(await page.evaluate(() => !GAME.APPRENTICE.apprenticeNow().fig && !GAME.APPRENTICE.apprenticeMet()), `${hero}: nobody at the post before they've come to you`);

    // they come to you: the side mission (Jedi), the refuge (Mando), Sergeant (trooper)
    await page.evaluate((h) => {
      const p = GAME.PROFILE.profileOf(h);
      if (h === 'jedi'){ p.sides = { ...(p.sides || {}), 'side:ledger-child': 1 }; }
      if (h === 'mando') p.cleared.refuge = 1;
      p.rank = Math.max(p.rank, 1);
    }, hero);
    await frames(0.4);
    check(await page.evaluate(() => GAME.APPRENTICE.apprenticeMet() && !!GAME.APPRENTICE.apprenticeNow().fig), `${hero}: met: they stand at their post in the hub`);
    // stand in front of them and tap F
    await page.evaluate((h) => {
      const P = { jedi: [12, -14], mando: [12, -14], trooper: [12, -14] }[h], { G, player } = GAME;
      player.group.position.set(P[0], 0.6, P[1] + 2.4); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0);
      G.yaw = player.faceYaw = Math.PI; G.pitch = 0.05;
    }, hero);
    await page.waitForFunction(() => document.getElementById('hubp').classList.contains('on'), null, { timeout: 20000 }).catch(() => {});
    check(await page.evaluate(() => document.getElementById('hubp').classList.contains('on')), `${hero}: their post's prompt comes up`);
    await shot('01-post');
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open'), null, { timeout: 5000 }).catch(() => {});
    check(await page.evaluate(() => document.getElementById('hubpanel').classList.contains('open')), `${hero}: F opens their panel`);
    const take = hero === 'trooper' ? 'PROMOTE BRISK' : hero === 'jedi' ? 'TAKE TAVI' : 'TAKE RIN';
    await page.locator('#hubpanel .hb-o', { hasText: take }).first().click();
    check(await page.evaluate(() => GAME.APPRENTICE.apprenticeTaken()), `${hero}: ${take} takes them on`);
    await page.locator('#hubpanel .hb-o', { hasText: 'TALK' }).first().click();
    await shot('02-panel');
    check(await page.evaluate(() => /Fights beside you|Leads the squad/.test(document.getElementById('hubpanel').textContent)), `${hero}: the panel says how they fight with you`);
    await page.click('#hubpanel .hb-x');

    // a mission with a squad of two: one squadmate and the apprentice
    await page.evaluate(() => { GAME.G.unlocked.push = true; GAME.startMission('grassland'); });
    await fight(); check(await playing(), `${hero}: the mission starts`);
    await frames(0.5);
    let s = await apprentice();
    const want = hero === 'trooper' ? s.has && s.lead && s.name === 'BRISK' : s.has && s.allies === 2;
    check(want, `${hero}: the apprentice comes along in a squad slot (${JSON.stringify(s)})`);
    // they fight: some foes in front of them
    await page.evaluate(() => {
      const { G, player, spawnEnemy, APPRENTICE } = GAME, a = APPRENTICE.apprenticeNow().ally || APPRENTICE.apprenticeNow().second, p = a.group.position;
      for (let i = 0; i < 4; i++){ const e = spawnEnemy('grunt', { x: p.x + Math.sin(G.yaw) * 4 + (i - 1.5), y: 0, z: p.z + Math.cos(G.yaw) * 4 }); }
    });
    await frames(4);
    await shot('03-field');
    if (hero === 'mando') check(await page.evaluate(() => GAME.enemies.some(e => e.spotT > GAME.G.gt - 6)), `${hero}: the foundling spots a foe`);
    // they grow: their share of your rank XP, and a stage up once it's enough
    const before = await page.evaluate(() => GAME.PROFILE.apprenticeOf().xp);
    await page.evaluate(() => { for (let i = 0; i < 20; i++) GAME.PROFILE.noteFormRank(); });   // 20 × 40 rank XP
    const after = await page.evaluate(() => ({ xp: GAME.PROFILE.apprenticeOf().xp, stage: GAME.PROFILE.apprenticeOf().stage }));
    check(after.xp >= before + 150 && after.stage >= 1, `${hero}: your rank XP grows them (${before} → ${JSON.stringify(after)})`);
    s = await apprentice();
    check(s.has, `${hero}: still beside you after the stage up (${JSON.stringify(s)})`);
    if (hero === 'jedi'){
      await page.evaluate(() => { const { G, spawnEnemy, APPRENTICE } = GAME, p = APPRENTICE.apprenticeNow().ally.group.position; for (let i = 0; i < 4; i++) spawnEnemy('grunt', { x: p.x + (i - 1.5), y: 0, z: p.z + 3 }); });
      await frames(10);
      await shot('04-padawan-stage');
      check(await page.evaluate(() => GAME.APPRENTICE.apprenticeNow().powers > 0), `${hero}: the Padawan uses a power the run has`);
    }

    // survival, the sandbox: along; the training grounds: not
    await page.evaluate(() => GAME.startEndless());
    await fight(); await playing(); await frames(0.4);
    check((await apprentice()).has, `${hero}: along in survival`);
    await page.evaluate(() => GAME.startSandbox());
    await fight(); await playing(); await frames(0.4);
    check((await apprentice()).has, `${hero}: along in the sandbox`);
    await page.evaluate(() => GAME.startTutorial());
    await fight(); await playing(); await frames(0.4);
    check(!(await apprentice()).has, `${hero}: not in the training grounds`);
    // left at home
    await page.evaluate(() => { GAME.APPRENTICE.setApprenticeHome(true); GAME.startMission('grassland'); });
    await fight(); await playing(); await frames(0.4);
    s = await apprentice();
    check(!s.has && (hero === 'trooper' || s.allies === 2), `${hero}: left at home, a full squad and no apprentice (${JSON.stringify(s)})`);
  } catch(e){ check(false, `${hero}: ${e.message}`); }
  for (const e of errors) check(false, `${hero}: ${e}`);
  if (!errors.length) check(true, `${hero}: no page errors`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
