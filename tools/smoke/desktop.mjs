// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DESKTOP SMOKE TEST — opens the desktop app (desktop/main.cjs, Electron) on the built game, checks it loads from its
// own app:// origin with no errors, that its /api/turn route answers, that online co-op connects between the desktop
// app (hosting) and a plain browser on the website build (joining), through a local PeerServer, and that EXIT GAME
// (the app only) asks first and then closes it.
//   npm run desktop:prepare && npm run smoke:desktop      (Linux needs a display: xvfb-run -a npm run smoke:desktop)

import { chromium, _electron } from 'playwright';
import { PeerServer } from 'peer';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const desktop = path.join(root, 'desktop');
const electronPath = createRequire(path.join(desktop, 'package.json'))('electron');
const peer = '?peerhost=127.0.0.1&peerport=9019';
const server = PeerServer({ port: 9019, host: '127.0.0.1', path: '/' });
const errors = [];
const prefs = () => {
  try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
};
const watch = (page, name) => {
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/api\/turn|status of 50[23]/.test(m.text())) errors.push(name + ': ' + m.text()); });
};
const ready = (page) => page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 60000, polling: 250 });
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, { timeout: 30000, polling: 250 });

let app, browser, ok = false;
try {
  app = await _electron.launch({ executablePath: electronPath, args: [desktop, '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], env: { ...process.env, POWER_TRIP_MULTI: '1' } });
  const win = await app.firstWindow();
  watch(win, 'desktop');
  await ready(win);
  const where = await win.evaluate(() => location.href);
  if (!where.startsWith('app://game/')) throw new Error('the desktop app should load the game from app://game/, not ' + where);
  // the TURN route is answered by the app (200 from the website, or 503 when offline: either way JSON, never a crash)
  const turn = await win.evaluate(async () => { const r = await fetch('/api/turn'); return { status: r.status, json: !!(await r.json().catch(() => null)) }; });
  if (!turn.json) throw new Error('/api/turn should answer with JSON, got ' + JSON.stringify(turn));
  console.log('desktop: loaded from', where, '· /api/turn', turn.status);
  // EXIT GAME shows in the app (never in a browser, checked below) and asks first; Esc backs out of it
  const shown = (sel) => win.evaluate((s) => { const el = document.querySelector(s); return !!el && el.offsetParent !== null; }, sel);
  if (!(await shown('#exitBtn'))) throw new Error('EXIT GAME should show on the desktop app\'s title screen');
  await win.click('#exitBtn');
  if (!(await shown('#exitYes')) || await shown('#exitBtn')) throw new Error('EXIT GAME should swap the buttons for a confirm');
  await win.keyboard.press('Escape');
  if (await shown('#exitYes') || !(await shown('#exitBtn'))) throw new Error('Esc should cancel the exit confirm');

  // co-op: the desktop app hosts, a browser on the website build joins with the code
  await win.evaluate(prefs);
  await win.goto('app://game/index.html' + peer); await ready(win);
  browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const guest = await browser.newPage({ viewport: { width: 480, height: 270 } });
  watch(guest, 'browser');
  await guest.addInitScript(prefs);
  await guest.goto(pathToFileURL(path.join(root, 'dist/index.html')).href + peer); await ready(guest);
  await win.click('#mode-coop'); await win.fill('#coopname', 'Desktop'); await win.click('#coophost');
  await win.waitForFunction(() => document.querySelector('#coopstatus .code'), null, { timeout: 20000, polling: 250 });
  const code = await win.evaluate(() => document.querySelector('#coopstatus .code').textContent);
  await guest.click('#mode-coop'); await guest.fill('#coopname', 'Browser'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
  await Promise.all([connected(win), connected(guest)]);
  await win.waitForFunction(() => /BROWSER/.test(document.getElementById('cooproster').textContent), null, { timeout: 15000, polling: 250 });
  await guest.waitForFunction(() => /DESKTOP/.test(document.getElementById('cooproster').textContent), null, { timeout: 15000, polling: 250 });
  console.log('desktop: co-op room', code, 'connected desktop host <-> browser guest');
  if (process.env.SHOT) await win.screenshot({ path: process.env.SHOT });
  if (await guest.evaluate(() => { const el = document.getElementById('exitBtn'); return !!el && el.offsetParent !== null; })) throw new Error('EXIT GAME must not show in a browser');
  // ...and EXIT GAME, confirmed, closes the app
  await win.click('#coopclose');
  const closed = new Promise((res) => app.once('close', res));
  await win.click('#exitBtn'); await win.click('#exitYes');
  await Promise.race([closed, new Promise((_, rej) => setTimeout(() => rej(new Error('EXIT GAME did not close the app')), 10000))]);
  app = null;
  console.log('desktop: EXIT GAME asks first, then closes the app');
  if (errors.length) throw new Error('errors:\n  ' + errors.join('\n  '));
  ok = true;
} catch(e){
  console.error('DESKTOP SMOKE FAILED:', e.message);
} finally {
  await app?.close().catch(() => {}); await browser?.close().catch(() => {}); server.close?.();
}
console.log(ok ? 'desktop smoke: ok' : 'desktop smoke: FAILED');
process.exit(ok ? 0 : 1);
