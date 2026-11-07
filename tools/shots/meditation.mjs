// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MEDITATION SHOTS — boots the BUILT game into a Jedi's survival run and screenshots the meditation (game/meditation.js):
// Form VII's choice, a learned form's card, and choosing the three.   npm run build && node tools/shots/meditation.mjs [out-dir]   (PHONE=1 TAG=x)
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { mkdirSync } from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href;
const out = process.argv[2] || path.join(root, 'shots-out'); mkdirSync(out, { recursive: true });
const phone = !!process.env.PHONE, tag = process.env.TAG ? process.env.TAG + '-' : '';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF || 2) } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: +(process.env.DSF || 2) });
await page.addInitScript(() => {
  try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
    for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); } } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shot', 'NotSupportedError')); };
});
page.on('pageerror', e => console.log('page error: ' + e.message));
page.on('console', m => { if (m.type() === 'error') console.log('console error: ' + m.text()); });
const shot = (name) => page.screenshot({ timeout: 120000, path: path.join(out, tag + 'meditate' + (phone ? '-phone' : '') + '-' + name + '.png') });
const up = () => page.waitForSelector('#meditate.open', { timeout: 20000 }).then(() => page.waitForTimeout(700));
await page.goto(url);
await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
await page.$eval('#hero-jedi', el => el.click());
await page.$eval('#mode-endless', el => el.click()); await page.$eval('#goText', el => el.click());
await page.waitForTimeout(600);
if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]').catch(() => {});
await page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.paused, null, { timeout: 90000 });
await page.waitForTimeout(1500);
// Form VII: keep one
await page.evaluate(() => { const G = GAME.G; for (const id of ['soresu', 'ataru', 'makashi', 'djemso']) (G.stanceUnlocked || (G.stanceUnlocked = {}))[id] = true; G.formFork = null; GAME.meditation.queue(['juyo', 'vaapad']); });
await up(); await shot('fork');
await page.click('#meditate [data-fork="juyo"]'); await page.waitForTimeout(600); await shot('unlock');
await page.click('#meditate [data-next]'); await page.waitForTimeout(600); await shot('slots');
const t = await page.$('#meditate [data-form="soresu"]'); if (t){ await t.click(); await page.waitForTimeout(300); await shot('slots-pick'); }
await page.click('#meditate [data-go]'); await page.waitForTimeout(300);
console.log('closed:', await page.evaluate(() => !document.getElementById('meditate').classList.contains('open')), await page.evaluate(() => GAME.G.loadout));
await browser.close();
