// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HUB WELCOME SMOKE TEST — the first visit to each hero's hub (game/hub-welcome.js, data/hub-welcome.js), on the BUILT game:
//   · a fresh save file walking into the hub is greeted on the small side panel once the wing's name has faded, with
//     nothing over the screen and nothing held, and the tour's beacon lit;
//   · the tour walks every stop (a beacon at each, the door toward a stop in another wing), and ends at the station
//     that starts a first run;
//   · coming back (a reload, the same file) nobody greets you; the map's WHAT'S WHERE card and SHOW ME AROUND;
//   · opening some other station ends the tour, and so does a mode launched mid-tour (its own panel, no beacon left);
//   · a second save file is welcomed afresh;
//   · coming home with something new opened, the guide walks you to it (game/hub-news.js), once; a save from before
//     the news isn't told what it already has.
// SHOTS=dir saves screenshots of the greeting, the tour and the card. Fails on any page error or console error.
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
    await page.$eval('#mode-temple', el => el.click()); await page.click('#goText');
    return inHub();
  };
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    check(await enter(), `${hero}: into the hub`);
    const hubId = await page.evaluate(() => GAME.G.hubId);
    const greeted = () => page.waitForFunction(() => GAME.hub.welcome.state.greet && document.getElementById('tutor').classList.contains('on'), null, { timeout: 45000 }).then(() => true, () => false);
    check(await greeted(), `${hero}: a fresh file is greeted on arrival (${hubId})`);
    check(/WELCOME TO/.test(await tutor()) && /Follow the light/.test(await tutor()), `${hero}: the guide's hello, with the first stop to follow`);
    check(await page.evaluate(() => !document.getElementById('hubpanel').classList.contains('open') && !GAME.G.skillSelect && !GAME.G.paused), `${hero}: nothing covers the hub or holds the hero`);
    check(await page.evaluate(() => { const r = document.getElementById('tutor').getBoundingClientRect(); return r.left < 60 && r.width < innerWidth * 0.4; }), `${hero}: the line sits small, to the side`);
    check((await st()).seen && (await st()).beacon, `${hero}: the welcome is seen, a beacon lights the first stop`);
    await page.waitForTimeout(400); await shot('greeting');

    // every stop of the walk
    const stops = await page.evaluate(() => GAME.hub.welcome.stops);
    for (let i = 0; i < stops.length; i++){
      const s = stops[i];
      await frames();
      let t = await tutor();
      if (i) check(t.includes((i + 1) + ' / ' + stops.length), `${hero}: tour stop ${i + 1} is on the voice panel`);
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
      await stand(s.x, s.z + (s.z > 0 ? -1.5 : 1.5), s.z > 0 ? Math.PI : 0);
      await frames(0.4);
      if (i < stops.length - 1) check((await st()).i === i + 1, `${hero}: reaching stop ${i + 1} moves the tour on`);
    }
    await frames();
    const last = await tutor();
    check(last.includes('DONE') && /Tap/.test(last), `${hero}: the last stop points to the first run`);
    await shot('tour-done');

    // back again (a reload, the same file): no greeting; the map's WHAT'S WHERE and SHOW ME AROUND
    await page.reload();
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    check(await enter(), `${hero}: back into the hub after a reload`);
    await page.waitForTimeout(5000);
    check(!(await st()).tour && !(await tutor()), `${hero}: a welcomed file isn't greeted again`);
    check(await page.evaluate(() => GAME.hub.welcome.open()), `${hero}: WHAT'S WHERE opens on asking`);
    check(await cardUp(3000), `${hero}: ...the card of every place`);
    const rows = await page.$$eval('#hubpanel .hw-row', r => r.length);
    check(rows >= 5, `${hero}: the card lists the hub's places (${rows})`);
    check(await page.$$eval('#hubpanel .hw-pin', r => r.flatMap(p => p.dataset.ps.trim().split(' ')).length) === rows && await page.$$eval('#hubpanel .hw-plan .hw-you', r => r.length) === 1, `${hero}: the hub's plan pins every place, and where you stand`);
    await page.waitForTimeout(300); await shot('whats-where');
    // a place picked on the card: a light leads there (the first tile: the missions, in another wing)
    await page.locator('#hubpanel .hw-row').first().click(); await frames();
    check(await page.evaluate(() => { const s = GAME.hub.welcome.state; return s.tour && s.beacon && /THIS WAY/.test(document.getElementById('tutor').textContent) && !document.getElementById('hubpanel').classList.contains('open'); }), `${hero}: a place picked on the card lights the way there`);
    await page.evaluate(() => GAME.hub.welcome.open()); await cardUp(3000);
    await page.locator('#hubpanel .hb-o', { hasText: 'SHOW ME AROUND' }).click();
    await frames();
    check((await st()).tour && !(await st()).greet, `${hero}: its SHOW ME AROUND walks the tour again`);

    // opening a station that isn't the stop: the hero is off on their own, and the tour bows out
    const other = await page.evaluate(() => { const st = GAME.hub.welcome.stops, w = GAME.hub.wings[GAME.G.hubWing]; return w.stations.find(s => s.id !== st[0].id && s.act !== 'travel') || null; });
    if (other){
      await stand(other.x, other.z + (other.z > 0 ? -1.5 : 1.5), other.z > 0 ? 0 : Math.PI);   // (facing it: +z is yaw 0)
      await page.waitForFunction(() => document.getElementById('hubp').classList.contains('on'), null, { timeout: 20000 }).catch(() => {});
      await page.keyboard.press('f');
      await page.waitForFunction(() => document.getElementById('hubpanel').classList.contains('open'), null, { timeout: 5000 }).catch(() => {});
      const dbg = await page.evaluate(() => ({ open: document.getElementById('hubpanel').classList.contains('open'), prompt: document.getElementById('hubp').textContent, ...GAME.hub.welcome.state }));
      check(!dbg.tour && !dbg.beacon, `${hero}: opening another station (${other.name}) ends the tour (${JSON.stringify(dbg)})`);
      await page.keyboard.press('Escape');
      await frames();
    }
    await page.evaluate(() => GAME.hub.welcome.tour());
    await frames();
    check((await st()).tour, `${hero}: the map's SHOW ME AROUND starts it again`);

    // a mode launched mid-tour ends it, and leaves the mode's own panel alone
    await page.evaluate(() => GAME.hub.launch('training'));
    check(await page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.training && !GAME.G.hub, null, { timeout: 120000 }).then(() => true, () => false), `${hero}: training launches mid-tour`);
    const s2 = await st();
    check(!s2.tour && !s2.beacon, `${hero}: the tour ends with the first run, its beacon gone`);
    await page.waitForTimeout(600);
    check(!(await tutor()).includes('FIRST STEPS') && !(await page.evaluate(() => document.getElementById('tutor').classList.contains('hw-tour'))), `${hero}: the training's panel is its own, back in its own place`);

    // a second save file is welcomed afresh
    await page.evaluate(() => { localStorage.setItem('sw_files', JSON.stringify({ active: 2, files: { 1: { at: 1 }, 2: { at: 2, fresh: true } } })); });
    await page.reload();
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    check(await enter(), `${hero}: into the hub on save file 2`);
    check(await greeted(), `${hero}: save file 2 gets its own welcome`);

    // NEWS AT HOME (game/hub-news.js): the story moves on (Act I cleared), and coming home the guide walks you to what it
    // opened, one piece a homecoming, the most useful first: the ship to Jedha (two doors from the start), then sparring.
    // (the Jedi: the gunners' Act I also deals a new gun, whose card comes first and holds the news back until it closes)
    if (hero === 'jedi'){
      await page.waitForFunction(() => GAME.hub.welcome.state.seen, null, { timeout: 30000 }).catch(() => {});
      await page.evaluate((h) => localStorage.setItem('sw_camp_ch_' + h, JSON.stringify(['siege', 'archive', 'refuge', 'trial-first'])), hero);
      const news = async (want) => {
        await page.reload();
        await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
        if (!(await enter())) return null;
        return page.waitForFunction((w) => { const s = GAME.hub.welcome.state; return w ? s.tour && s.step.startsWith('NEW') && s : null; }, want, { timeout: want ? 60000 : 1 })
          .then(h => h && h.jsonValue(), () => null);
      };
      const n1 = await news(true);
      check(n1 && n1.stop.wing === 'landing' && n1.beacon, `${hero}: home with Jedha open, the guide leads to the ship (${JSON.stringify(n1 && n1.stop)})`);
      check(/NORTH DOOR/.test(await tutor()) && /Jedha/.test(await tutor()), `${hero}: ...through the door toward it, two wings off, and says why`);
      await shot('news-zone');
      const n2 = await news(true);
      check(n2 && n2.stop.wing === 'training' && /SPARRING/.test(n2.step), `${hero}: the next homecoming, the next news: the sparring hall (${JSON.stringify(n2 && n2.stop)})`);
      await news(false); await page.waitForTimeout(6000);
      check(!(await st()).tour && !(await tutor()), `${hero}: once told, nothing is told again`);
      // a save that had it all before the news existed isn't walked round what it already knows
      await page.evaluate(() => { localStorage.setItem('sw_files', JSON.stringify({ active: 3, files: { 1: { at: 1 }, 2: { at: 2 }, 3: { at: 3, fresh: true } } })); });
      await page.reload();
      await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
      await page.evaluate((h) => { for (const k of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + k, '1'); localStorage.setItem('sw_camp_ch_' + h, JSON.stringify(['siege', 'archive', 'refuge', 'trial-first'])); }, hero);
      await page.reload();
      await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
      check(await enter(), `${hero}: into the hub on a file that played before the news`);
      await page.waitForTimeout(8000);
      check(!(await st()).tour && (await page.evaluate(() => GAME.hub.news.noted)).zone === 1, `${hero}: ...what it already had counts as known`);
    }
  } catch(e){ check(false, `${hero}: ${e.message}`); }
  check(!errors.length, `${hero}: no page or console errors`);
  for (const e of errors.slice(0, 6)) console.log('  ' + e);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
