// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SAVE FILES SMOKE — boots the BUILT game with an old player's progress (from before save files), checks it is file 1, starts
// a NEW save file 2 from the title screen's line (in place, no reload), checks it starts fresh with the settings shared,
// earns a little there, switches back to file 1 with nothing lost, then deletes file 2.
//   npm run build && npm run smoke:files            (SHOTS=<dir> also saves screenshots)

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shots = process.env.SHOTS;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
const check = (ok, what) => { if (!ok){ console.error('FAIL: ' + what); process.exitCode = 1; } else console.log('ok: ' + what); };
const shot = async (n) => { if (!shots) return; await page.waitForTimeout(700); await page.screenshot({ path: path.join(shots, n + '.png') }); };
const booted = () => page.waitForFunction(() => window.GAME && window.GAME.G && document.body.classList.contains('in-menu'), null, { timeout: 30000 });
// the loading screen has faded in and out again, on file n
const switched = (n) => page.waitForFunction((n) => document.getElementById('boot').hidden && document.querySelector('#fileline .fl-file').textContent === 'SAVE FILE ' + n, n, { timeout: 30000, polling: 200 }).then(() => page.waitForTimeout(500));
const url = pathToFileURL(path.join(root, 'dist/index.html')).href;

// an old player: progress and settings in the plain keys, as before save files
await page.goto(url);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0');
  localStorage.setItem('sw_sens', '1.7');
  localStorage.setItem('sw_camp_jedi', '1'); localStorage.setItem('sw_asktrain', '1');
  localStorage.setItem('sw_profile', JSON.stringify({ v: 1, heroes: { jedi: { xp: 200, rank: 1, cleared: {}, missions: {}, picks: [], forks: {}, sides: {}, secrets: {}, parts: [] } } }));
});
await page.reload(); await booted(); await page.waitForTimeout(1500);
await shot('01-menu-file1');
const card = () => page.evaluate(() => ['.fl-file', '.fl-t', '.fl-rank'].map(c => document.querySelector('#fileline ' + c).textContent).join(' '));
console.log('hero card: ' + await card());
check(await card() === 'SAVE FILE 1 JEDI KNIGHT', 'the old progress is save file 1, with its rank on the hero card');
check(await page.evaluate(() => { const r = document.querySelector('.ov-inner').getBoundingClientRect(); return r.bottom <= innerHeight + 1; }), 'menu still fits the window');

await page.click('#fileline'); await shot('02-files-panel');
check(await page.evaluate(() => document.querySelectorAll('#fllist .sv-slot').length === 3 && !!document.querySelector('#fllist .sv-slot.live')), 'the panel lists three files, file 1 playing');
await page.evaluate(() => { window.__sameDoc = true; });
await page.click('[data-act="use"][data-n="2"]'); await switched(2);
check(await page.evaluate(() => window.__sameDoc === true), 'switching files happens in place (no reload, so fullscreen stays)');
check(await card() === 'SAVE FILE 2 JEDI PADAWAN', 'NEW FILE switched to file 2, a fresh Padawan');
check(await page.evaluate(() => localStorage.getItem('sw_camp_jedi') === null && localStorage.getItem('sw_asktrain') === null && GAME.PROFILE.profileOf('jedi').xp === 0), 'file 2 starts with no wins and a fresh profile');
check(await page.evaluate(() => !document.querySelector('#mode-campaign .md').textContent.includes('beaten')), 'the menu\'s campaign tile follows file 2 (no beaten tick from file 1)');
check(await page.evaluate(() => localStorage.getItem('sw_sens') === '1.7' && GAME.G.mouseSens === 1.7), 'settings are shared across files');
// earn a little in file 2
await page.evaluate(() => localStorage.setItem('sw_mission_pursuit_mando', '1'));
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('sw_profile')); s.heroes.mando = { ...(s.heroes.mando || {}), xp: 150, rank: 1 }; localStorage.setItem('sw_profile', JSON.stringify(s)); });
check(await page.evaluate(() => { const n = []; for (let i = 0; i < localStorage.length; i++) n.push(localStorage.key(i)); return n.includes('sw_mission_pursuit_mando') && !n.some(k => /^sw_f\d:/.test(k)) && !n.includes('sw_camp_jedi'); }), 'walking the keys in file 2 sees only its own and the settings');

await page.click('#fileline'); await shot('03-files-panel-2');
check(await page.evaluate(() => /JEDI KNIGHT/.test(document.querySelector('#fllist .sv-slot:nth-child(1) .sv-d').textContent) && /MANDO VERD/.test(document.querySelector('#fllist .sv-slot:nth-child(2) .sv-d').textContent)), 'each card shows its own file\'s ranks');
await page.click('[data-act="use"][data-n="1"]'); await switched(1);
check(await page.evaluate(() => localStorage.getItem('sw_camp_jedi') === '1' && GAME.PROFILE.profileOf('jedi').xp === 200 && localStorage.getItem('sw_mission_pursuit_mando') === null), 'back on file 1 with nothing lost and nothing from file 2');
check(await page.evaluate(() => GAME.G.hero !== 'jedi' || document.querySelector('#mode-campaign .md').textContent.includes('beaten')), 'the menu\'s campaign tile follows file 1 again');
// a mode started right after a switch plays on the new file: the Jedi campaign from file 1 (training already asked)
await page.$eval('#hero-jedi', el => el.click()); await page.$eval('#mode-campaign', el => el.click()); await page.click('#goText');
if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
await page.waitForFunction(() => GAME.G.mode === 'play', null, { timeout: 90000, polling: 250 });
check(await page.evaluate(() => GAME.PROFILE.profileOf('jedi').xp >= 200 && !document.getElementById('overlay').classList.contains('asktrain')), 'the campaign started after the switch runs on file 1\'s profile');
await page.evaluate(() => { document.getElementById('overlay').style.display = 'flex'; GAME.G.paused = true; GAME.setOverlayState('pause'); });
await page.click('#homeBtn'); await page.click('#homeYes');
await page.waitForFunction(() => GAME.G.mode === 'menu', null, { timeout: 30000, polling: 250 });

await page.click('#fileline');
await page.click('[data-act="del"][data-n="2"]'); await shot('04-delete-confirm');
await page.click('[data-act="del"][data-n="2"]');
check(await page.evaluate(() => document.querySelector('#fllist .sv-slot:nth-child(2)').classList.contains('empty')), 'file 2 deleted, its card empty');
check(await page.evaluate(() => localStorage.getItem('sw_camp_jedi') === '1'), 'deleting file 2 leaves file 1 alone');
check(!errors.length, 'no page errors' + (errors.length ? ':\n' + errors.join('\n') : ''));
await browser.close();
