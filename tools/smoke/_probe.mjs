import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('ERR', e.message));
await page.addInitScript(() => { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('x','NotSupportedError')); }; });
const url = pathToFileURL('/home/user/power-trip/dist/index.html').href;
await page.goto(url); await page.waitForTimeout(4000);
const HERO = process.argv[2] || 'jedi';
await page.evaluate(() => { GAME.calm.cfg.max = 0.5; GAME.calm.cfg.min = 0; GAME.calm.cfg.markAt = 0; });
await page.$eval('#hero-' + HERO, el => el.click()); await page.$eval('#mode-campaign', el => el.click()); await page.$eval('#goText', el => el.click());
const st = () => page.evaluate(() => { const d = JSON.parse(localStorage.getItem('sw_save_auto') || 'null'); return JSON.stringify({ mode: GAME.G.mode, ch: GAME.G.chapter, cl: GAME.G.chapterClosed, ph: GAME.shared.levelPhase, auto: d && d.run && [d.run.chapter, d.run.closed, d.where] }); });
for (let i = 0; i < 400; i++){
  const ch = await page.evaluate(() => {
    if (GAME.G.cutscene) GAME.cutscene.skipScene();
    for (const sel of ['#trainNo', '#forms [data-go]', '#chapcard.open [data-go]', '#meditation.open [data-go]', '.mx-actions [data-go]']){ const b = document.querySelector(sel); if (b && b.offsetParent) b.click(); }
    if (GAME.G.skillSelect && document.getElementById('skilltree').style.display === 'flex') document.getElementById('continueBtn').click();
    const ab = document.querySelector('.ac-go, #abilitycard.open [data-go]'); if (ab) ab.click();
    const t = GAME.calm.target(); if (t){ const P = GAME.player.vis ? null : null; const pos = GAME.player.pos || (GAME.players && GAME.players[0].pos); }
    if (GAME.calm.on()){ const t2 = GAME.calm.target(); if (t2){ const pp = GAME.arena && GAME.player; } }
    if (GAME.G.mission && GAME.missionState().o) GAME.skipObjective();
    else if (!GAME.G.mission && GAME.shared.levelPhase === 'fighting'){ for (const e of GAME.enemies) if (!e.dead) GAME.damageEnemy(e, 1e6, null, 0); GAME.G.spawnQueue.length = 0; }
    return GAME.G.chapter;
  });
  if (i % 20 === 0) console.log(i, await st());
  if (ch >= 3) break;
  await page.waitForTimeout(400);
}
await page.waitForTimeout(2000);
console.log('reached', await st());
// home, then LOAD GAME → AUTO
await page.evaluate(() => { document.getElementById('overlay').style.display = 'flex'; GAME.G.paused = true; GAME.setOverlayState('pause'); });
await page.click('#homeBtn'); await page.click('#homeYes'); await page.waitForTimeout(1000);
console.log('menu', await page.evaluate(() => JSON.stringify({ rr: GAME.G.resumeRun && [GAME.G.resumeRun.chapter, GAME.G.resumeRun.closed], go: document.getElementById('goText').textContent })));
await page.$eval('#campLoadBtn', el => el.click()); await page.click('[data-act="load"][data-i="auto"]'); await page.waitForTimeout(800);
console.log('loaded', await page.evaluate(() => JSON.stringify({ rr: GAME.G.resumeRun && [GAME.G.resumeRun.chapter, GAME.G.resumeRun.closed], go: document.getElementById('goText').textContent, ms: GAME.G.modeSel })));
await page.$eval('#goText', el => el.click()); await page.waitForTimeout(5000);
console.log('after', await st());
await page.goto(url); await page.waitForTimeout(4000);
await page.$eval('#mode-campaign', el => el.click()); await page.waitForTimeout(500);
console.log('relaunch', await page.evaluate(() => JSON.stringify({ rr: GAME.G.resumeRun && [GAME.G.resumeRun.chapter, GAME.G.resumeRun.closed], go: document.getElementById('goText').textContent, hero: GAME.G.hero })));
await browser.close();
