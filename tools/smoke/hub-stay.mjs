// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HUB STAY SMOKE TEST — opening and closing menus in a hub leaves you where you stood (game/hub.js keepHubSpot), on the
// BUILT game, in every hero's hub:
//   · the forge's CUSTOMIZE YOUR HERO (a page by way of the title screen) and DONE: back on the same spot, facing the same way;
//   · the council's EVERY MODE and the title screen's way back to the hub: the same spot;
//   · pause, MAIN MENU, then the hub tile again: the same spot;
//   · the pause screen, and a page over the hub (the codex): never moved;
//   · a wing picked on the map, and the ship boarded: their own arrival, never the spot left before.
//   npm run build && npm run smoke:hub-stay   (HEROES=jedi,mando,trooper)

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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('smoke_init')) return;
      sessionStorage.setItem('smoke_init', '1');
      localStorage.clear();
      localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
    } catch(e){}
  });
  await page.addInitScript(() => { Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); }; });
  page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
  const inHub = (wing) => page.waitForFunction((w) => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused && (!w || GAME.G.hubWing === w), wing, { timeout: 60000 }).then(() => true, () => false);
  const frames = async (n = 0.3) => { const gt = await page.evaluate(() => GAME.G.gt); await page.waitForFunction(([gt, n]) => GAME.G.gt > gt + n, [gt, n], { timeout: 20000 }).catch(() => {}); };
  const pose = () => page.evaluate(() => { const p = GAME.player.group.position; return { wing: GAME.G.hubWing, x: p.x, z: p.z, yaw: GAME.G.yaw }; });
  const same = (a, b) => a.wing === b.wing && Math.hypot(a.x - b.x, a.z - b.z) < 0.6 && Math.abs(a.yaw - b.yaw) < 0.05;
  const fmt = (p) => `${p.wing} (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) yaw ${p.yaw.toFixed(2)}`;
  // stand a little off a station's centre, facing it, and tap F: its panel opens
  const atStation = async (act) => {
    const s = await page.evaluate((act) => { const W = GAME.hub.wings[GAME.G.hubWing]; return W.stations.find(s => s.act === act) || null; }, act);
    if (!s) return null;
    await page.evaluate(([x, z]) => { const { G, player } = GAME, px = x + 1.3, pz = z + 1.1; player.group.position.set(px, 0.6, pz); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0); player.vy = 0; G.yaw = player.faceYaw = Math.atan2(x - px, z - pz); }, [s.x, s.z]);
    await frames(0.5);
    const at = await pose();
    await page.keyboard.press('f');
    const up = await page.waitForFunction(() => document.querySelector('#hubpanel.open'), null, { timeout: 5000 }).then(() => true, () => false);
    return up ? at : null;
  };
  const pick = (text) => page.evaluate((t) => { const o = [...document.querySelectorAll('#hubpanel .hb-o')].find(o => o.innerText.includes(t)); if (o) o.click(); return !!o; }, text);
  const wingWith = (act) => page.evaluate((act) => Object.entries(GAME.hub.wings).find(([, W]) => W.stations.some(s => s.act === act))?.[0], act);
  const go = async (wing) => { if (await page.evaluate(() => GAME.G.hubWing) !== wing){ await page.evaluate((w) => GAME.hub.goWing(w), wing); await inHub(wing); await frames(0.9); } };
  try {
    await page.goto(page_url);
    await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
    await page.$eval('#hero-' + hero, el => el.click());
    await page.click('#mode-temple'); await page.click('#goText');
    check(await inHub(), `${hero}: into the hub`);
    await frames(1.2);

    // the forge: CUSTOMIZE YOUR HERO, then DONE
    await go(await wingWith('forge'));
    let at = await atStation('forge');
    check(!!at, `${hero}: the forge's panel opens`);
    if (at){
      check(await pick('CUSTOMIZE'), `${hero}: CUSTOMIZE YOUR HERO`);
      await page.waitForFunction(() => document.getElementById('overlay').classList.contains('customizing'), null, { timeout: 10000 }).catch(() => {});
      await page.click('#czdone');
      check(await inHub(at.wing), `${hero}: DONE goes back into the hub`);
      await frames(0.5);
      const now = await pose();
      check(same(at, now), `${hero}: back where you stood after the customizer: ${fmt(at)} → ${fmt(now)}`);
    }

    // the council: EVERY MODE, then the title screen's way back
    await go(await wingWith('council'));
    at = await atStation('council');
    check(!!at, `${hero}: the council's panel opens`);
    if (at){
      check(await pick('EVERY MODE'), `${hero}: EVERY MODE`);
      await page.waitForFunction(() => GAME.G.mode === 'menu', null, { timeout: 10000 }).catch(() => {});
      await page.click('#mode-temple');   // (its tile picks the hub, then the hero step's ENTER: the title screen's way back)
      if (await page.isVisible('#stepTemple')) check(true, `${hero}: the hero step offers the way back to the hub`);
      await page.click('#goText');
      check(await inHub(at.wing), `${hero}: the title screen's way back goes into the hub`);
      await frames(0.5);
      const now = await pose();
      check(same(at, now), `${hero}: back where you stood after the title screen: ${fmt(at)} → ${fmt(now)}`);
    }

    // pause, MAIN MENU, and the hub tile again
    at = await pose();
    await page.evaluate(() => { document.getElementById('overlay').style.display = 'flex'; GAME.G.paused = true; GAME.setOverlayState('pause'); });   // (what Esc does, with no lock to let go)
    await frames(0.2);
    const paused = await pose();
    check(same(at, paused), `${hero}: the pause screen never moves you`);
    await page.$eval('#homeBtn', el => el.click());   // (a click with no mouse travel: the unlocked cursor sliding to the button would turn the view)
    await page.waitForFunction(() => GAME.G.mode === 'menu', null, { timeout: 10000 }).catch(() => {});
    await page.click('#mode-temple'); await page.click('#goText');
    check(await inHub(at.wing), `${hero}: the hub tile goes back in`);

    await frames(0.5);
    let now = await pose();
    check(same(paused, now), `${hero}: back where you stood after MAIN MENU: ${fmt(paused)} → ${fmt(now)}`);

    // a wing picked: its own arrival
    const Hb = await page.evaluate(() => ({ wings: Object.keys(GAME.hub.wings), spawn: Object.fromEntries(Object.entries(GAME.hub.wings).map(([k, W]) => [k, W.spawn])) }));
    const other = Hb.wings.find(w => w !== at.wing && w !== 'ship');
    await go(other);
    now = await pose();
    check(Math.hypot(now.x - Hb.spawn[other][0], now.z - Hb.spawn[other][1]) < 4, `${hero}: a wing picked arrives at its own spot (${fmt(now)})`);
    if (Hb.wings.includes('ship')){
      await go('ship');
      now = await pose();
      check(Math.hypot(now.x - Hb.spawn.ship[0], now.z - Hb.spawn.ship[1]) < 4, `${hero}: boarding the ship arrives aboard (${fmt(now)})`);
    }
  } catch(e){ check(false, `${hero}: ${e.message}`); }
  check(!errors.length, `${hero}: no page or console errors` + (errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''));
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
