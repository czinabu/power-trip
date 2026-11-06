// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// ACT IV SMOKE TEST — the Sith gate (game/gate.js) on the BUILT game: its menu tile is locked until a story is beaten, then
// each hero starts it with the veteran's kit and the recap card; a styled lock goes faster for the hero it's built for;
// the last chapter's guardian, Darth Kharel, raises his three wards in phase II, and breaking them throws him open. Then
// two browsers: a Jedi host starts Act IV and a trooper guest joins it on the gate's own chapters, with the kit too.
//   npm run build && npm run smoke:gate        (SHOTS=dir saves screenshots there)

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9021';
const shots = process.env.SHOTS || '';
if (shots) fs.mkdirSync(shots, { recursive: true });
const server = PeerServer({ port: 9021, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ ...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: 30000, polling: 250 };
const fail = (m) => { throw new Error(m); };

async function open(name, beaten, size = { width: 640, height: 360 }){
  const page = await browser.newPage({ viewport: size });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.addInitScript((beaten) => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
          if (beaten){ localStorage.setItem('sw_camp_jedi', '1'); localStorage.setItem('sw_camp_ends', JSON.stringify({ jedi: { ilsa: 'spared', vexis: 'vael', title: 'THE LONG ROAD HOME' } })); } } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  }, beaten);
  await page.goto(url);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
const shot = async (page, name) => { if (shots) await page.screenshot({ path: path.join(shots, name + '.png') }); };
const begin = (page) => page.evaluate(() => { const b = document.querySelector('#chapcard.open [data-go]'); if (b) b.click(); GAME.cutscene.skipScene(); });
// whatever pops up as a veteran's run starts (a free pair's pick, Form VII's, the forms window, the upgrade page): take the first
const clearUps = (page) => page.evaluate(() => {
  for (const sel of ['#chapcard.open [data-go]', '#abilitycard.open [data-pick="0"]', '#abilitycard.open [data-next]', '#meditate.open [data-fork]', '#meditate.open [data-next]', '#meditate.open [data-go]', '#armorypick.open [data-go]']){
    const b = document.querySelector(sel); if (b) b.click(); }
  if (GAME.G.skillSelect && document.getElementById('skilltree').style.display.includes('flex')) document.getElementById('continueBtn').click();
  GAME.cutscene.skipScene();
});
async function launch(page, hero){
  await page.$eval('#hero-' + hero, el => el.click());
  await page.evaluate(() => document.getElementById('grp-story').click());
  await page.$eval('#mode-gate', el => el.click());
  for (let i = 0; i < 6 && !(await page.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await page.isVisible('#goText')) await page.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await page.isVisible('#forms [data-go]')) await page.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  await page.waitForFunction(() => document.querySelector('#chapcard.open'), null, poll);
}

let ok = false;
try {
  // 1 · locked until a story is beaten
  { const p = await open('fresh', false);
    const locked = await p.evaluate(() => document.getElementById('mode-gate').classList.contains('locked') && !GAME.gate.open());
    if (!locked) fail('Act IV is open on a fresh profile');
    await p.close(); }

  // 2 · each hero: the veteran's kit, the recap card, the right chapters
  for (const hero of (process.env.HEROES || 'jedi,mando,trooper').split(',')){
    const p = await open(hero, true);
    await p.evaluate(() => document.getElementById('grp-story').click());
    if (hero === 'jedi') await shot(p, 'menu-story');
    await launch(p, hero);
    const st = await p.evaluate(() => ({ story: GAME.G.storyHero, ch: GAME.G.chapter, ids: GAME.chapters().map(c => c.id), recap: !!document.querySelector('#chapcard .gx-recap'),
      won: document.querySelectorAll('#chapcard .gx-relic.won').length, unlocked: Object.keys(GAME.G.unlocked || {}).length, forms: Object.keys(GAME.G.stanceUnlocked || {}).length,
      sp: GAME.G.skillPoints, wt: GAME.G.waveTotal, kit: GAME.G.mandoKit, act: document.querySelector('#chapcard .cc-act').textContent }));
    console.log(hero, JSON.stringify(st));
    if (st.story !== 'gate' || st.ch !== 0) fail(hero + ': not on Act IV chapter 1');
    if (st.ids.join() !== 'gate-wake,gate-jedi,gate-mando,gate-trooper,gate-heart') fail(hero + ': chapters ' + st.ids);
    if (!st.recap || st.won !== 1) fail(hero + ': no recap, or the Jedi ending missing');
    if (!/^ACT IV/.test(st.act)) fail(hero + ': card reads ' + st.act);
    if (st.unlocked < 2 || st.sp < 10 || st.wt < 15) fail(hero + ': no veteran kit');
    if (hero === 'jedi' && st.forms < 4) fail('jedi: forms not handed over');
    if (hero === 'mando' && !(st.kit && st.kit.primary)) fail('mando: no primary gun');
    if (hero === 'jedi') await shot(p, 'card-recap');
    await begin(p);
    await p.waitForTimeout(1200);
    const page = await p.evaluate(() => GAME.G.skillSelect);
    if (!page) fail(hero + ': no upgrade page for the veteran');
    if (hero === 'jedi') await shot(p, 'veteran-page');
    for (let i = 0; i < 6; i++){ await clearUps(p); await p.waitForTimeout(500); }
    // the seals: a styled lock's pace (game/locks.js) through the live objective
    const pace = await p.evaluate(() => { const o = GAME.objectiveInfo && GAME.objectiveInfo(); return o; });
    if (hero === 'jedi'){
      // walk onto the Force seal and see it go at a Jedi's pace
      await p.evaluate(() => { GAME.player.group.position.set(-15, 0, 4); });
      await p.waitForTimeout(4000);
      await shot(p, 'seal-jedi');
    }
    // the last chapter: Kharel. Skip to his duel, then his phase II wards: break all three (each hero works each one)
    await p.evaluate(() => GAME.startChapter(4)); await begin(p);
    await p.waitForTimeout(1500);
    for (let i = 0; i < 150 && !(await p.evaluate(() => !!GAME.gate.finale())); i++){
      await clearUps(p);
      await p.evaluate(() => { const M = GAME.missionState(); if (M.o && M.o.kind !== 'duel') GAME.skipObjective(); });
      await p.waitForTimeout(700);
    }
    const name = await p.evaluate(() => GAME.gate.finale() && GAME.gate.finale().fin.def.id);
    if (name !== 'kharel') fail(hero + ': the guardian is ' + name + ' ' + await p.evaluate(() => JSON.stringify({ open: [...document.querySelectorAll('.open')].map(x => x.id), ch: GAME.G.chapter, i: GAME.missionState().i, kind: GAME.missionState().o && GAME.missionState().o.kind, ss: GAME.G.skillSelect, card: GAME.G.cardUp, gt: GAME.G.gt, mode: GAME.G.mode, paused: GAME.G.paused })));
    await p.waitForTimeout(1500);
    await p.evaluate(() => GAME.finaleMove('ward', 2));
    await p.waitForTimeout(1500);
    const label = await p.evaluate(() => document.getElementById('bossphase').textContent);
    if (!/THE WARDS · 3 LEFT/.test(label)) fail(hero + ': no wards (' + label + ')');
    if (hero === 'jedi') await shot(p, 'kharel-wards');
    // stand on each ward in turn (the high lock from its deck), kept alive
    const spots = await p.evaluate(() => GAME.shared.gateWards.map(w => [w.at[0], w.y || 0, w.at[1]]));
    const t0 = Date.now();
    await p.evaluate(() => { window._keep = setInterval(() => { if (GAME.G.mode === 'play' && GAME.player.hp < 60) GAME.player.hp = 100; }, 100); });
    for (let i = 0; i < spots.length; i++){
      const [x, y, z] = spots[i];
      for (let k = 0; k < 120; k++){
        const st = await p.evaluate(([x, y, z]) => { const P = GAME.player.group.position; P.set(x, y + 0.05, z); return document.getElementById('bossphase').textContent; }, [x, y, z]);
        if (!/THE WARDS/.test(st) || st.includes((spots.length - 1 - i) + ' LEFT')) break;
        await p.waitForTimeout(300);
      }
    }
    const res = await p.evaluate(() => { const e = GAME.gate.finale(); return { open: (e.openUntil || 0) > GAME.G.gt, ward: e.ward, label: document.getElementById('bossphase').textContent }; });
    console.log(hero, 'wards', JSON.stringify(res), ((Date.now() - t0) / 1000).toFixed(1) + 's');
    if (!res.open) fail(hero + ': the wards broke but he is not open (' + res.label + ')');
    // the autosave keeps the Act IV run apart from the story's: back on the menu, its tile continues it on its chapter
    if (hero === 'mando'){
      await p.evaluate(() => { clearInterval(window._keep); document.getElementById('homeBtn').click(); });
      await p.click('#homeYes').catch(() => {});
      await p.waitForFunction(() => GAME.G.mode === 'menu', null, poll);
      await p.evaluate(() => document.getElementById('grp-story').click());
      const md = await p.evaluate(() => ({ gate: document.querySelector('#mode-gate .md').textContent, camp: document.querySelector('#mode-campaign .md').textContent }));
      console.log('menu', JSON.stringify(md));
      if (!/^Continue · ACT IV · CH 5/.test(md.gate) || /ACT IV/.test(md.camp)) fail('the Act IV save is not on its own tile');
      await launch(p, 'mando');
      const back = await p.evaluate(() => ({ story: GAME.G.storyHero, ch: GAME.G.chapter, sp: GAME.G.skillPoints, primary: GAME.G.mandoKit && GAME.G.mandoKit.primary }));
      console.log('resumed', JSON.stringify(back));
      if (back.story !== 'gate' || back.ch !== 4 || !back.primary) fail('the Act IV save did not resume on its chapter with its kit');
    }
    // the end (the Jedi's run): the gate's own choice, then this screen's epilogue
    if (hero === 'jedi'){
      await p.evaluate(() => { clearInterval(window._keep); GAME.campaignWon(() => { window._won = true; }); });
      await p.waitForFunction(() => document.querySelector('#chapcard.open .cc-choice'), null, poll);
      await shot(p, 'gate-choice');
      await p.evaluate(() => document.querySelector('#chapcard.open [data-go="sealed"]').click());
      for (let i = 0; i < 40 && !(await p.evaluate(() => !!document.querySelector('#chapcard.open .gx-epi'))); i++){ await p.evaluate(() => GAME.cutscene.skipScene()); await p.waitForTimeout(500); }
      const ep = await p.evaluate(() => ({ act: document.querySelector('#chapcard.open .gx-kick').textContent, title: document.querySelector('#chapcard.open .gx-title').textContent, lines: [...document.querySelectorAll('#chapcard.open .gx-l, #chapcard.open .gx-raid')].map(x => x.textContent) }));
      console.log('epilogue', JSON.stringify(ep));
      if (ep.title !== 'THE GATE IS SHUT' || !ep.lines.some(l => /Vexis heard the news/.test(l)) || !ep.lines.some(l => /alone/.test(l))) fail('epilogue does not read the choice, the earlier ending, or the party');
      await shot(p, 'epilogue');
    }
    await p.close();
  }
  // 3 · co-op: a Jedi host starts Act IV, a trooper guest joins it with the veteran's kit
  { const host = await open('host', true), guest = await open('guest', true);
    const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
    await host.click('#mode-coop'); await host.click('#coophost');
    await host.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
    const code = await host.evaluate(() => document.querySelector('#coopstatus .code').textContent);
    await guest.click('#mode-coop'); await guest.fill('#coopcode', code); await guest.click('#coopjoin');
    await Promise.all([connected(host), connected(guest)]);
    await host.click('#coopclose');
    await launch(host, 'jedi');
    await guest.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
    await guest.click('#coopclose'); await guest.$eval('#hero-trooper', el => el.click());
    await guest.click('#mode-coop'); await guest.click('#coopjoinrun');
    for (let i = 0; i < 8 && !(await guest.evaluate(() => GAME.G.mode === 'play')); i++){
      if (await guest.isVisible('#goText')) await guest.click('#goText', { timeout: 2000 }).catch(() => {});
      await guest.waitForTimeout(800);
    }
    await guest.waitForFunction(() => document.querySelector('#chapcard.open'), null, poll);
    const g = await guest.evaluate(() => ({ guest: GAME.G.coopGuest, story: GAME.G.storyHero, ch: GAME.G.chapter, recap: !!document.querySelector('#chapcard .gx-recap'), sp: GAME.G.skillPoints, wt: GAME.G.waveTotal, title: document.querySelector('#chapcard .cc-title').textContent }));
    console.log('guest', JSON.stringify(g));
    if (!g.guest || g.story !== 'gate' || g.ch !== 0 || !g.recap || g.sp < 10 || g.wt < 15) fail('the guest did not join Act IV with the kit');
    await shot(guest, 'coop-guest-card');
    // the host moves on to the trooper's own chapter: the guest follows, and its card says the chapter is theirs
    await begin(host); await begin(guest);
    for (let i = 0; i < 4; i++){ await clearUps(host); await clearUps(guest); await host.waitForTimeout(400); }
    await host.evaluate(() => GAME.startChapter(3)); await begin(host);
    await guest.waitForFunction(() => GAME.G.chapter === 3 && document.querySelector('#chapcard.open'), null, poll);
    const brief = await guest.evaluate(() => document.querySelector('#chapcard.open .cc-scene .nar').textContent);
    console.log('guest brief', brief);
    if (!/yours, brother/.test(brief)) fail('the trooper guest is not told the chapter is theirs');
    await host.close(); await guest.close(); }
  ok = true;
} catch(e){ console.error('FAIL', e.message); }
finally {
  const real = errors.filter(e => !/WebGL|GPU|favicon|ERR_FILE_NOT_FOUND|peer/i.test(e));
  if (real.length){ console.error('ERRORS:\n' + real.slice(0, 20).join('\n')); ok = false; }
  await browser.close(); server.close && server.close();
  console.log(ok ? 'GATE SMOKE OK' : 'GATE SMOKE FAILED');
  process.exit(ok ? 0 : 1);
}
