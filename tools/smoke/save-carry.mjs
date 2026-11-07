// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SAVE CARRY SMOKE — your save comes with you into every mode, and the game saves as each boss falls:
//   · a Jedi whose story has taught Pull, Makashi and Soresu has them in survival (from its first wave), in a lone mission
//     whose own kit is lower, and in the hub, with no fanfare; and no form the story hasn't taught
//   · form mastery is only ever earned: those modes fight each form at the best rank it has reached in a fight, never at a
//     rank made up from how far the story has gone
//   · the ARC trooper's own story counts toward the sandbox, like the other two heroes'
//   · a Warbringer down in a lone mission writes the AUTO slot
//   · a story chapter is saved as it closes, and that save loads back past it (its close, then the next chapter)
//   npm run build && npm run smoke:save-carry

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', e => errors.push('page error: ' + (e.stack || e.message)));
page.on('console', m => { if (m.type() === 'error') errors.push('console error: ' + m.text()); });
await page.addInitScript(() => {
  try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1'); } catch(e){}
  Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
});
const check = (ok, what) => { if (!ok){ console.error('FAIL: ' + what); process.exitCode = 1; } else console.log('ok: ' + what); };
// poll on a timer (a slow software renderer can starve animation-frame polling)
async function until(fn, arg, ms = 30000){
  const end = Date.now() + ms;
  for (;;){
    let v = false; try { v = await page.evaluate(fn, arg); } catch(e){}
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out waiting for: ' + fn.toString().slice(0, 140));
    await page.waitForTimeout(250);
  }
}
const boot = async () => { await page.goto(url); await until(() => window.GAME && window.GAME.G); await page.waitForTimeout(1200); };
const playing = () => until(() => GAME.G.mode === 'play' && !GAME.G.paused);
const fightNow = async () => { await page.waitForTimeout(2500); if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {}); };
const kit = () => page.evaluate(() => ({ pull: !!GAME.G.unlocked.pull, su: Object.keys(GAME.G.stanceUnlocked || {}).filter(k => GAME.G.stanceUnlocked[k]).sort(), loadout: GAME.G.loadout.slice(), lv: GAME.G.forceLevel, banners: document.querySelectorAll('.mx-open, #meditation.open').length }));

// A JEDI SAVE that has closed the siege, the archive and the first trial (Pull, Makashi, Soresu)
await boot();
// (Makashi has earned ADEPT in a fight; Soresu nothing yet)
await page.evaluate(() => { localStorage.setItem('sw_camp_ch_jedi', JSON.stringify(['prologue', 'siege', 'archive', 'trial-first'])); localStorage.setItem('sw_formrank_jedi', JSON.stringify({ makashi: 1 })); GAME.PROFILE.reloadProfile(); });
await boot();
await page.$eval('#hero-jedi', el => el.click()); await page.$eval('#mode-campaign', el => el.click()); await page.click('#goText');
await fightNow(); await playing();

// SURVIVAL: the story's kit from the first wave
await page.evaluate(() => GAME.startEndless());
await page.waitForTimeout(600);
let k = await kit();
check(k.pull && k.su.includes('makashi') && k.su.includes('soresu') && !k.su.includes('ataru') && !k.su.includes('djemso'), 'survival starts with the forms and powers the story taught, and no more (' + JSON.stringify(k) + ')');
check(k.loadout.includes('makashi') && k.loadout.includes('soresu'), 'survival slots the earned forms');
check(k.lv > 1, 'survival starts at the story\'s Force Level (' + k.lv + ')');
check(!k.banners, 'survival hands the story kit over with no meditation screens');
const ranks = () => page.evaluate(() => ({ ...(GAME.G.formRank || {}) }));
let fr = await ranks();
check((fr.makashi || 0) === 1 && !fr.soresu && !fr.shiicho, 'survival fights each form at its earned rank, no more (' + JSON.stringify(fr) + ')');

// A LONE MISSION whose own kit is lower (the vault: kit 1)
await page.evaluate(() => { GAME.G.missionForms = null; GAME.startMission('vault'); });
await page.waitForTimeout(800);
k = await kit();
check(k.pull && k.su.includes('makashi') && k.su.includes('soresu'), 'a low-kit mission still hands over the story\'s kit (' + JSON.stringify(k) + ')');
fr = await ranks();
check((fr.makashi || 0) === 1 && !fr.soresu && !fr.shiicho, 'a mission fights each form at its earned rank, no more (' + JSON.stringify(fr) + ')');

// THE HUB
await page.evaluate(() => GAME.hub.startHub());
await page.waitForTimeout(800);
k = await kit();
check(k.pull && k.su.includes('makashi') && k.su.includes('soresu') && !k.su.includes('ataru'), 'the hub carries the story\'s kit (' + JSON.stringify(k) + ')');
fr = await ranks();
check((fr.makashi || 0) === 1 && !fr.soresu && !fr.shiicho, 'the hub shows each form at its earned rank, no more (' + JSON.stringify(fr) + ')');

// A WARBRINGER DOWN in a lone mission saves at once
await page.evaluate(() => { GAME.startMission('vault'); localStorage.removeItem('sw_save_auto'); });
await page.waitForTimeout(800);
await page.evaluate(() => { GAME.spawnChampion(); });
await until(() => GAME.enemies.some(e => e.warbringer && !e.dead), null, 15000);
await page.evaluate(() => { localStorage.removeItem('sw_save_auto'); const e = GAME.enemies.find(e => e.warbringer && !e.dead); GAME.damageEnemy(e, 1e6, null, 0); });
await until(() => !!localStorage.getItem('sw_save_auto'), null, 8000).catch(() => false);
check(await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('sw_save_auto') || 'null'); return !!(d && d.auto && d.where && d.where.startsWith('MISSION')); }), 'a boss down in a mission writes the AUTO slot');

// THE TROOPER'S STORY opens the sandbox like the others'
await page.evaluate(() => {
  const act1 = GAME.chapters().filter(c => c.act === 0 && !c.prologue).map(c => c.id);
  for (const k of Object.keys(localStorage)) if (/^sw_camp_/.test(k)) localStorage.removeItem(k);
  localStorage.setItem('sw_camp_ch_trooper', JSON.stringify(act1));
});
await boot();
check(await page.evaluate(() => !document.getElementById('mode-sandbox').classList.contains('locked')), 'the trooper\'s Act I opens the sandbox');

// A STORY CHAPTER SAVED AT ITS CLOSE loads back past it
await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^sw_(camp_|save_)/.test(k)) localStorage.removeItem(k); });
await boot();
await page.$eval('#hero-jedi', el => el.click()); await page.$eval('#mode-campaign', el => el.click()); await page.click('#goText');
if (await page.isVisible('#trainNo')) await page.click('#trainNo');
await fightNow(); await playing();
await page.waitForTimeout(1500);
const ch0 = await page.evaluate(() => GAME.G.chapter);
for (let i = 0; i < 120; i++){   // past its card and scenes, objective by objective, to its close
  const done = await page.evaluate(() => {
    if (GAME.G.chapterClosed === GAME.G.chapter) return true;
    if (GAME.G.cutscene) GAME.cutscene.skipScene();
    const b = document.querySelector('#chapcard.open [data-go]'); if (b){ b.click(); return false; }
    if (GAME.missionState().o) GAME.skipObjective();
    return false;
  });
  if (done) break;
  await page.waitForTimeout(500);
}
await until(() => { const d = JSON.parse(localStorage.getItem('sw_save_auto') || 'null'); return d && d.run && d.run.closed; }, null, 10000).catch(() => false);
const saved = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('sw_save_auto') || 'null'); return d && d.run && { closed: d.run.closed, chapter: d.run.chapter }; });
check(saved && saved.closed && saved.chapter === ch0, 'the chapter is autosaved at its close (' + JSON.stringify(saved) + ')');
await boot();
check(await page.evaluate(() => document.getElementById('goText').textContent === 'CONTINUE CAMPAIGN' && GAME.G.hero === 'jedi'), 'the menu offers CONTINUE CAMPAIGN');
await page.$eval('#goText', el => el.click());
await until(() => GAME.G.mode === 'play' && (GAME.G.chapter > 0 || GAME.G.chapterClosed === GAME.G.chapter), null, 20000);
const back = await page.evaluate(() => ({ ch: GAME.G.chapter, closed: GAME.G.chapterClosed, phase: GAME.shared.levelPhase }));
check(back.ch === ch0 && back.closed === ch0, 'the save loads back at that chapter\'s close, not in front of it (' + JSON.stringify(back) + ')');
// ...and rolls on from there: its upgrade page, then the next chapter
for (let i = 0; i < 80 && !(await page.evaluate((c) => GAME.G.chapter > c, ch0)); i++){
  await page.evaluate(() => {
    if (GAME.G.cutscene) GAME.cutscene.skipScene();
    const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click();
    if (GAME.G.skillSelect && document.getElementById('skilltree').style.display === 'flex') document.getElementById('continueBtn').click();
    const m = document.querySelector('#meditation.open [data-go]'); if (m) m.click();
  });
  await page.waitForTimeout(500);
}
check(await page.evaluate((c) => GAME.G.chapter === c + 1 && GAME.G.mode === 'play', ch0), 'the loaded close rolls on into the next chapter');


// A SAVE MADE AWAY FROM THE STORY keeps the story's place, and loads back where it was made
const home = async () => { await page.evaluate(() => { document.getElementById('overlay').style.display = 'flex'; GAME.G.paused = true; GAME.setOverlayState('pause'); }); await page.click('#homeBtn'); await page.click('#homeYes'); await page.waitForTimeout(1200); };
await page.evaluate(() => GAME.startChapter(5)); await page.waitForTimeout(2500);
const story = await page.evaluate(() => GAME.G.chapter);
await home();
await page.evaluate(() => localStorage.setItem('sw_mission_pursuit_jedi', '1'));
await page.$eval('#mode-mission', el => el.click()); await page.evaluate(() => document.getElementById('msn-pursuit').click()); await page.$eval('#goText', el => el.click());
await fightNow(); await playing();
// a hand save from the mission's pause screen
await page.evaluate(() => { document.getElementById('overlay').style.display = 'flex'; GAME.G.paused = true; GAME.setOverlayState('pause'); });
await page.click('#saveBtn'); await page.click('[data-act="save"][data-i="0"]'); await page.click('#savesclose');
check(await page.evaluate((c) => { const d = JSON.parse(localStorage.getItem('sw_save_0')); return d && d.away && d.run && d.run.chapter === c && d.modeSel === 'mission'; }, story), 'a save made in a mission keeps the campaign\'s place');
// the boss down there: the autosave keeps it too
await page.evaluate(() => { GAME.G.paused = false; document.getElementById('overlay').style.display = 'none'; GAME.spawnChampion(); });
await until(() => GAME.enemies.some(e => e.warbringer && !e.dead), null, 15000);
await page.evaluate(() => { localStorage.removeItem('sw_save_auto'); const e = GAME.enemies.find(e => e.warbringer && !e.dead); GAME.damageEnemy(e, 1e6, null, 0); });
await until(() => !!localStorage.getItem('sw_save_auto'), null, 8000).catch(() => false);
await home();
check(await page.evaluate((c) => { const d = JSON.parse(localStorage.getItem('sw_save_auto') || 'null'); return d && d.where.startsWith('MISSION') && d.run && d.run.chapter === c; }, story), 'going back to the menu leaves the mission\'s autosave as it was');
// a fresh page: LOAD GAME on the autosave goes back to that mission, the campaign still waiting behind it
await boot();
await page.$eval('#campLoadBtn', el => el.click()); await page.click('[data-act="load"][data-i="auto"]'); await page.waitForTimeout(800);
check(await page.evaluate(() => GAME.G.modeSel === 'mission' && GAME.G.missionId === 'pursuit'), 'loading it goes back to the mission it was made in');
await page.$eval('#mode-campaign', el => el.click()); await page.waitForTimeout(400);
check(await page.evaluate((c) => document.getElementById('goText').textContent === 'CONTINUE CAMPAIGN' && GAME.G.resumeRun && GAME.G.resumeRun.chapter === c, story), 'and CONTINUE CAMPAIGN is still on the story\'s chapter, not the first');
// the hand save the same way
await page.$eval('#campLoadBtn', el => el.click()); await page.click('[data-act="load"][data-i="0"]'); await page.waitForTimeout(800);
await page.$eval('#mode-campaign', el => el.click()); await page.waitForTimeout(400);
check(await page.evaluate((c) => GAME.G.resumeRun && GAME.G.resumeRun.chapter === c, story), 'the hand save from the mission keeps the story\'s chapter too');

for (const e of errors) console.error(e);
if (errors.length) process.exitCode = 1;
await browser.close();
