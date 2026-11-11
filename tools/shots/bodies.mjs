// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// BODY LINEUP SHOTS (testing only): shoots tools/shots/lineup (every body the game draws, in rows, front and side) from
// a running dev server:
//   npx vite --port 5181 &   node tools/shots/bodies.mjs <out-dir> [row ...]
//   rows: heroes foes bosses allies civ (default: all). URL=<another server> shoots that one
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';

const out = path.resolve(process.argv[2] || 'shots/bodies');
const rows = process.argv.slice(3).length ? process.argv.slice(3) : ['heroes', 'foes', 'bosses', 'allies', 'civ'];
const URL = process.env.URL || 'http://localhost:5181';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const row of rows) for (const side of [0, 1]){
  const page = await browser.newPage({ viewport: { width: row === 'foes' ? 2200 : 1400, height: 800 } });
  page.on('console', m => { if (/foe|boss|civ|mandalorian|rror/.test(m.text())) console.log(row, m.text()); });
  page.on('pageerror', e => console.log(row, 'ERR', e.message));
  // (a software-rendered page compiles every shader the game has: slow, so a generous wait and one more try)
  for (let tries = 0; ; tries++){
    await page.goto(`${URL}/tools/shots/lineup/?row=${row}&side=${side}`);
    try { await page.waitForFunction(() => window.__ready, null, { timeout: 480000 }); break; }
    catch(e){ if (tries) throw e; console.log(row, 'slow: trying again'); }
  }
  const name = `${row}-${side ? 'side' : 'front'}.png`;
  await page.screenshot({ path: path.join(out, name) });
  console.log('shot', name);
  await page.close();
}
await browser.close();
