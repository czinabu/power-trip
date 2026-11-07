// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// MASTERY SHOTS — boots the BUILT game and screenshots each hero's mastery page: the Jedi's FORMS & MASTERY and the
// gunners' ARMORY (ui/forms-ui.js, ui/armory-ui.js), on the pause screen of a survival run and from the title screen,
// each tab, and a phone.   npm run build && node tools/shots/mastery.mjs [out-dir]   (HEROES=jedi PHONE=1 TAG=before)
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { mkdirSync } from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href;
const out = process.argv[2] || path.join(root, 'shots-out'); mkdirSync(out, { recursive: true });
const HEROES = (process.env.HEROES || 'jedi,mando,trooper').split(',');
const phone = !!process.env.PHONE, tag = process.env.TAG ? process.env.TAG + '-' : '';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const hero of HEROES){
  const page = await browser.newPage(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF || 2) } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: +(process.env.DSF || 2) });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
      for (const h of ['jedi', 'mando', 'trooper']){ localStorage.setItem('sw_camp_' + h, '1'); localStorage.setItem('sw_trained_' + h, '1'); }
    } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('shot', 'NotSupportedError')); };
  });
  page.on('pageerror', e => console.log('page error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('console error: ' + m.text()); });
  const until = (fn, arg, ms = 90000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  const shot = (name) => page.screenshot({ timeout: 120000, path: path.join(out, tag + hero + (phone ? '-phone' : '') + '-' + name + '.png') });
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 30000 });
  await page.$eval('#hero-' + hero, el => el.click());
  if (process.env.MENU){   // MASTERY from the title screen (the saved run, or as far as the story has reached)
    await page.waitForTimeout(800);
    await page.$eval('#formsBtn', el => el.click()); await page.waitForTimeout(700); await shot('menu');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  }
  if (process.env.PREFIGHT){   // BEFORE THE FIGHT on a mission: pick what to carry
    await page.evaluate(() => { for (const k of ['soresu', 'ataru', 'makashi', 'dual', 'carbine']) try { localStorage.setItem('sw_story_' + k, '1'); } catch(e){} });
    await page.$eval('#mode-mission', el => el.click()); await page.waitForTimeout(500);
    const go = await page.$('#overlay [data-mission]'); if (go) await go.click().catch(() => {});
    await page.$eval('#goText', el => el.click()); await page.waitForTimeout(900);
    await shot('prefight'); await page.close(); continue;
  }
  await page.$eval('#mode-endless', el => el.click()); await page.$eval('#goText', el => el.click());
  await page.waitForTimeout(600);
  for (const s of ['#forms [data-go]', '#armory [data-go]']) if (await page.isVisible(s)) await page.click(s).catch(() => {});
  await until(() => GAME.G.mode === 'play' && !GAME.G.paused);
  await page.waitForTimeout(1500);
  // a run some way in: a few forms or guns, ranks and a Force Level, so the page has something to show
  await page.evaluate((hero) => {
    const G = GAME.G;
    if (hero === 'jedi'){
      G.forceLevel = 4;
      for (const id of ['soresu', 'ataru', 'makashi']) (G.stanceUnlocked || (G.stanceUnlocked = {}))[id] = true;
      G.formRank = Object.assign(G.formRank || {}, { shiicho: 2, soresu: 1 });
      G.formUse = Object.assign(G.formUse || {}, { shiicho: 300, soresu: 120, ataru: 40 });
    } else if (hero === 'mando') Object.assign(G.unlocked, { dual: true, carbine: true });
    else Object.assign(G.unlocked, { modAuto: true });
    G.paused = true; document.getElementById('overlay').style.display = 'flex'; GAME.setOverlayState('pause');
  }, hero);
  await page.waitForTimeout(400);
  await page.$eval('#formsBtn', el => el.click());
  await until(() => document.querySelector('#forms.open'), null, 5000);
  await page.waitForTimeout(1200);
  console.log(hero, await page.evaluate(() => { const p = document.querySelector('#forms .mx'); const cs = p && getComputedStyle(p); return p ? [cs.opacity, cs.transform, cs.animationName, p.className, p.getBoundingClientRect().width] : 'none'; }));
  await shot('pause');
  // every tab, and the second item in the list
  const tabs = await page.$$eval('#forms [data-tab]', els => els.map(e => e.dataset.tab));
  for (const t of tabs.slice(1)){ await page.click('#forms [data-tab="' + t + '"]'); await page.waitForTimeout(250); await shot('tab-' + t); }
  if (tabs.length) await page.click('#forms [data-tab="' + tabs[0] + '"]');
  const items = await page.$$('#forms [data-form], #forms [data-gun]');
  if (items[1]){ await items[1].click(); await page.waitForTimeout(250); await shot('pick2'); }
  const sub = await page.$$eval('#forms [data-dtab]', els => els.map(e => e.dataset.dtab));
  for (const d of sub.slice(1)){ await page.click('#forms [data-dtab="' + d + '"]'); await page.waitForTimeout(200); await shot('detail-' + d); }
  await page.close();
}
await browser.close();
