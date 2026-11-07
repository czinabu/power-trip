// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// RAID SMOKE TEST — boots the BUILT game (dist/index.html), for each hero:
//   · the RAID TABLE page (ui/hub-ui.js renderRaid): reached from the hero's own hub (the temple's table in the council
//     chamber, the citadel's and the covert's mission tables), with today's modifiers, the three jobs (yours marked), the
//     hero's rare parts, and a page that fits a phone;
//   · BEGIN THE RAID: the raid mission (data/raids.js) builds Darth Kharel with the day's modifiers, his sunder bar and
//     the squad beside a lone hero;
//   · each hero's job fills the bar (boss/roles.js): a turned bolt for the Jedi, a blow from behind or above for the
//     Mandalorian, the trooper's fire pins him and the trooper gets the fallen up twice as fast;
//   · the warded advance turns blows from in front and not from behind; a full bar breaks him open;
//   · his defeat clears the raid and counts on the profile (game/profile.js raids), and the part's progress moves;
//   · the sandbox calls him up, and the battle simulator keeps him on its floor through a rebuild.
// Fails on any page error or console error, or a step that doesn't land where it should.
//   npm run build && npm run smoke:raid      (SHOTS=dir for screenshots; HEROES=jedi,mando for fewer)

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
      localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); for (const h of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + h, '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
      localStorage.setItem('sw_camp_gate_jedi', '1');   // (Act IV beaten, by any hero: the raid table opens for all three)
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
  const poll = { timeout: 120000 };
  const ticks = async (s = 0.3) => { const gt = await page.evaluate(() => GAME.G.gt); await page.waitForFunction(([gt, s]) => GAME.G.gt > gt + s, [gt, s], { timeout: 60000 }).catch(() => {}); };
  const stand = (x, z, yaw) => page.evaluate(([x, z, yaw]) => { const { G, player } = GAME; player.group.position.set(x, 0.2, z); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0; G.yaw = player.faceYaw = yaw; }, [x, z, yaw]);
  const through = async () => {
    for (let i = 0; i < 60 && !(await page.evaluate(() => GAME.G.mode === 'play' && !GAME.G.hub)); i++){
      for (const sel of ['#forms [data-go]', '#armory [data-go]', '#goText']) if (await page.isVisible(sel)) await page.click(sel, { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  };

  await page.goto(page_url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
  await page.$eval('#hero-' + hero, el => el.click());

  // the table is shut until Act IV is beaten, as any hero
  check(await page.evaluate(() => { localStorage.removeItem('sw_camp_gate_jedi'); const shut = !GAME.raids.raidsOpen(); localStorage.setItem('sw_camp_gate_trooper', '1'); const open = GAME.raids.raidsOpen(); localStorage.removeItem('sw_camp_gate_trooper'); localStorage.setItem('sw_camp_gate_jedi', '1'); return shut && open; }), `${hero}: the raids open once any hero has beaten Act IV`);

  await page.click('#mode-temple');
  await page.click('#goText');
  await page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused, null, poll);

  // THE RAID TABLE: the temple's own (the council chamber), or the RAID button on the hub's mission table
  const st = await page.evaluate(() => { for (const act of ['raid', 'council', 'ship']) for (const [id, W] of Object.entries(GAME.hub.wings)){ const s = W.stations.find(s => s.act === act); if (s) return { act, wing: id, x: s.x, z: s.z, r: s.r || 0, spawnZ: W.spawn[1] }; } return null; });
  check(!!st, `${hero}: the ${await page.evaluate(() => GAME.G.hubId)} has a way to the raid table (${st && st.act} in ${st && st.wing})`);
  if (st.wing !== await page.evaluate(() => GAME.G.hubWing)){
    await page.evaluate((w) => GAME.hub.goWing(w), st.wing);
    await page.waitForFunction((w) => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused && GAME.G.hubWing === w, st.wing, poll);
  }
  { const d = st.spawnZ >= st.z ? 1 : -1, off = st.r ? Math.max(2.2, st.r - 1.5) : 2.2; await stand(st.x, st.z + off * d, d > 0 ? Math.PI : 0); } await ticks();
  await page.keyboard.press('f');
  await page.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open'), null, { timeout: 8000 }).catch(() => {});
  if (st.act !== 'raid'){
    await page.locator('#hubpanel .hb-o', { hasText: 'THE RAID' }).first().click();
    await page.waitForTimeout(300);
  }
  const pg = await page.evaluate(() => { const b = document.querySelector('#hubpanel .rd-box'); if (!b) return null;
    return { mods: b.querySelectorAll('.rd-mod').length, roles: b.querySelectorAll('.rd-role').length, you: (b.querySelector('.rd-role.you') || {}).className, parts: b.querySelectorAll('.rd-part').length, go: (b.querySelector('.rd-main b') || {}).textContent, hero: b.className }; });
  check(!!pg && pg.mods === 2 && pg.roles === 3 && new RegExp('rd-' + hero).test(pg.you || '') && pg.parts >= 2 && pg.go === 'BEGIN THE RAID' && pg.hero.includes('hero-' + hero),
    `${hero}: the raid page: today's two modifiers, three jobs (yours marked), the rare parts, BEGIN THE RAID (${JSON.stringify(pg)})`);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'raid-table-' + hero + '.png') });
  // on a phone: one column, nothing wider than the screen
  await page.setViewportSize({ width: 390, height: 780 }); await page.waitForTimeout(300);
  const ph = await page.evaluate(() => { const b = document.querySelector('#hubpanel .rd-box'), r = b.getBoundingClientRect(), cols = getComputedStyle(b.querySelector('.rd-roles')).gridTemplateColumns.split(' ').length;
    return { left: r.left, right: r.right, cols, wide: [...b.querySelectorAll('*')].some(el => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible' && el.clientWidth > 0 && el.tagName !== 'U') ? 'over' : 'fits' }; });
  check(ph.left >= 0 && ph.right <= 390 && ph.cols === 1, `${hero}: the raid page fits a phone (${JSON.stringify(ph)})`);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'raid-table-' + hero + '-phone.png') });
  await page.setViewportSize({ width: 960, height: 540 }); await page.waitForTimeout(200);

  // BEGIN THE RAID
  const id = await page.evaluate(() => GAME.raids.raidIdFor('kharel'));
  await page.locator('#hubpanel .rd-main').click();
  await through();
  check(await page.waitForFunction((id) => GAME.G.mode === 'play' && GAME.G.mission && GAME.G.missionId === id, id, poll).then(() => true, () => false), `${hero}: BEGIN THE RAID launches today's raid (${id})`);
  for (let i = 0; i < 480 && !(await page.evaluate(() => !!GAME.shared.finale)); i++)   // (he steps down after the duel's entrance: slow on a software renderer)
 { await page.evaluate(() => GAME.cutscene && GAME.cutscene.skipScene && GAME.cutscene.skipScene()); await page.waitForTimeout(500); }
  await ticks(0.5);
  if (!(await page.evaluate(() => !!GAME.shared.finale))){ check(false, `${hero}: Darth Kharel never stepped down`); await page.close(); continue; }
  const up = await page.evaluate((id) => { const e = GAME.shared.finale; if (!e) return null; const F = e.fin, want = GAME.raids.raidMods('kharel', GAME.raids.parseRaidId(id).day);
    return { name: F.id, mods: F.raid && F.raid.mods.join() === want.join(), bar: F.sd && F.sd.max, allies: GAME.squad.allies.filter(a => !a.dead).length, hud: document.getElementById('bossmods').textContent, sunder: getComputedStyle(document.getElementById('bosssunder')).display }; }, id);
  check(!!up && up.name === 'kharel' && up.mods && up.bar > 0 && up.sunder !== 'none' && up.hud.length > 0, `${hero}: Darth Kharel steps down with the day's modifiers and his sunder bar (${JSON.stringify(up)})`);
  check(!!up && up.allies === 3, `${hero}: alone, three of the squad come with you (${up && up.allies})`);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'raid-fight-' + hero + '.png') });
  await page.evaluate(() => { window._keep = setInterval(() => { if (GAME.player.hp < 60) GAME.player.hp = 100; }, 100); });

  // the jobs: what each blow does to his bar (from in front, plain, it does nothing)
  const job = await page.evaluate(() => {
    const e = GAME.shared.finale, F = e.fin, g = e.group.position, P = GAME.player.group.position, out = {};
    const fx = Math.sin(e.group.rotation.y), fz = Math.cos(e.group.rotation.y);
    const hit = (dx, y, dz, opts) => { P.set(g.x + dx, y, g.z + dz); F.bucket = 0; GAME.G.gt += 2; const v = F.sd.v; GAME.damageEnemy(e, 10, null, 0, false, false, opts); return Math.round((F.sd.v - v) * 10) / 10; };
    out.front = hit(fx * 3, 0, fz * 3);
    out.deflect = hit(fx * 3, 0, fz * 3, { deflected: true });
    out.behind = hit(-fx * 3, 0, -fz * 3);
    out.air = hit(fx * 3, 3, fz * 3);
    const s0 = F.sd.supp; hit(fx * 6, 0, fz * 6, { shot: true }); out.pin = F.sd.supp > s0;
    out.revive = GAME.shared.reviveMul && GAME.shared.reviveMul.trooper;
    P.set(g.x + fx * 4, 0, g.z + fz * 4);
    return out;
  });
  check(job.front === 0 && job.deflect > 0 && job.behind > 0 && job.air > 0 && job.pin && job.revive === 2,
    `${hero}: the jobs fill his bar (a turned bolt, from behind, from above), fire pins him, a trooper revives twice as fast (${JSON.stringify(job)})`);

  // a full bar breaks him open
  await page.evaluate(() => { const F = GAME.shared.finale.fin; F.sd.v = F.sd.max; });
  await ticks(0.4);
  check(await page.evaluate(() => { const e = GAME.shared.finale; return e.openUntil > GAME.G.gt && e.fin.sd.v === 0; }), `${hero}: a full bar breaks the vessel open`);
  await ticks(5);

  // the warded advance: his front turns a blow, his back takes it
  await page.evaluate(() => GAME.finaleMove('bulwark', 2));
  await ticks(0.4);
  const bw = await page.evaluate(() => {
    const e = GAME.shared.finale, F = e.fin, g = e.group.position, P = GAME.player.group.position;
    const fx = Math.sin(e.group.rotation.y), fz = Math.cos(e.group.rotation.y);
    const hit = (dx, y, dz) => { P.set(g.x + dx, y, g.z + dz); F.bucket = 0; GAME.G.gt += 2; const h = e.hp; GAME.damageEnemy(e, 10, null, 0, false, false); return h - e.hp; };
    const r = { sig: F.sig && F.sig.id, front: hit(fx * 3, 0, fz * 3), behind: hit(-fx * 3, 0, -fz * 3) };
    P.set(g.x + fx * 8, 0, g.z + fz * 8);
    return r;
  });
  check(bw.sig === 'bulwark' && bw.front === 0 && bw.behind > 0, `${hero}: the warded advance turns a blow from in front, not from behind (${JSON.stringify(bw)})`);
  if (SHOTS && hero === 'mando') await page.screenshot({ path: path.join(SHOTS, 'raid-bulwark.png') });
  await page.evaluate(() => GAME.finaleMove(null));

  // the volley: bolts at the hero
  await page.evaluate(() => GAME.finaleMove('volley', 1));
  check(await page.waitForFunction(() => GAME.bolts.some(b => !b.friendly), null, { timeout: 60000 }).then(() => true, () => false), `${hero}: the dark volley fires at the hero`);
  if (SHOTS && hero === 'jedi') await page.screenshot({ path: path.join(SHOTS, 'raid-volley.png') });

  // his defeat: the raid is cleared and counts
  const parts0 = await page.evaluate(() => GAME.PROFILE.profileOf().raids || 0);
  await page.evaluate(() => GAME.finaleMove('defeat', 3));
  check(await page.waitForFunction(() => GAME.G.mode === 'victory' && /RAID CLEARED/.test(document.getElementById('ovsub').textContent), null, { timeout: 180000 }).then(() => true, () => false), `${hero}: his defeat clears the raid`);
  check(await page.evaluate((n) => GAME.PROFILE.profileOf().raids === n + 1, parts0), `${hero}: the win counts on the profile`);
  if (SHOTS && hero === 'trooper') await page.screenshot({ path: path.join(SHOTS, 'raid-cleared.png') });
  await page.evaluate(() => clearInterval(window._keep));

  // the sandbox calls him; the battle simulator keeps him through a rebuild
  if (hero === HEROES[0]){
    await page.goto(page_url);   // (a fresh page: the sandbox from the title screen, as a player gets there)
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.$eval('#hero-' + hero, el => el.click());
    await page.evaluate(() => { GAME.setSandboxMap('grassland'); GAME.startSandbox(); const { G } = GAME; G.mode = 'play'; G.paused = false; G.skillSelect = false; });   // (as smoke:hitch does: the floor up, no title screen in the way)
    await ticks(0.5);
    await page.evaluate(() => GAME.sandboxSpawn('raid'));
    await ticks(0.5);
    check(await page.evaluate(() => !!GAME.shared.finale && GAME.shared.finale.fin.id === 'kharel' && !!GAME.shared.finale.fin.sd), `${hero}: the sandbox calls up Darth Kharel, sunder bar and all`);
    const bs = await page.evaluate(() => { const st = { mode: GAME.G.mode, sb: GAME.G.sandbox, cg: GAME.G.coopGuest, p: GAME.G.paused }; const ok = GAME.battle.enter(); if (!ok) return { ok, st }; const plan = GAME.battle.BS.plan.map(u => u.id); return { ok, plan, kharel: !!GAME.shared.finale && GAME.shared.finale.fin.id === 'kharel' }; });
    check(bs.ok && bs.plan.includes('raid') && bs.kharel, `${hero}: the battle simulator keeps him on its floor (${JSON.stringify(bs)})`);
    await page.evaluate(() => GAME.battle.start());
    await ticks(0.5);
  }

  check(errors.length === 0, `${hero}: no page or console errors` + (errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''));
  await page.close();
}

await browser.close();
if (failed){ console.log('RAID SMOKE: FAILED'); process.exit(1); }
console.log('RAID SMOKE: PASSED');
