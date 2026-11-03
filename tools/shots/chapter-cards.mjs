// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CHAPTER CARDS, a few from each story (the briefing before a campaign chapter), on the BUILT game:
// node tools/shots/chapter-cards.mjs . <out dir> <tag>   (W=, H= set the viewport; CHROME=<path> to use another Chromium)
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
const [root, out, tag] = process.argv.slice(2);
const SETS = { jedi: [null, 'siege', 'lothal'], mando: [null, 'lothal'], trooper: [null, 'siege'] };
const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
for (const [hero, ids] of Object.entries(SETS)){
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', e => errors.push(hero + ': ' + e.message));
  await page.addInitScript(() => { try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('x', 'NotSupportedError')); }; });
  await page.goto(pathToFileURL(root + '/dist/index.html').href + '?trooper');
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, { timeout: 60000 });
  await page.$eval('#hero-' + hero, el => el.click()); await page.click('#mode-campaign');
  for (let i = 0; i < 10 && !(await page.isVisible('#chapcard.open')); i++){
    if (await page.isVisible('#goText')) await page.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  await page.waitForSelector('#chapcard.open', { timeout: 30000 });
  for (const id of ids){
    if (id){
      const ok = await page.evaluate((id) => { const i = GAME.chapters().findIndex(c => c.id === id); if (i < 0) return GAME.chapters().map(c => c.id).join(','); document.getElementById('chapcard').classList.remove('open'); GAME.G.cardUp = false; GAME.startChapter(i); return true; }, id);
      if (ok !== true){ console.log(hero, 'no', id, ok); continue; }
    }
    await page.waitForTimeout(3500);
    await page.screenshot({ path: out + '/' + tag + '-' + hero + '-' + (id || 'first') + '.png' });
    if (await page.isVisible('#chapcard .cc-more summary')){   // and with its story unfolded
      await page.click('#chapcard .cc-more summary'); await page.waitForTimeout(300);
      await page.screenshot({ path: out + '/' + tag + '-' + hero + '-' + (id || 'first') + '-more.png' });
    }
  }
  if (hero === 'jedi'){   // the archive cleared: the Ledger choice
    await page.evaluate(() => { document.getElementById('chapcard').classList.remove('open'); GAME.G.cardUp = false; GAME.G.chapter = GAME.chapters().findIndex(c => c.id === 'archive'); GAME.nextChapter(); });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: out + '/' + tag + '-jedi-ledger-choice.png' });
  }
  await page.close();
}
console.log('errors', errors.slice(0, 5));
await browser.close();
