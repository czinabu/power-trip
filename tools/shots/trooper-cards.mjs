// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TROOPER CARD CLIPS — records the short looping clips on the ARC trooper's ability cards (data/ability-cards.js) from the
// BUILT game: the trooper in the sandbox hangar, a few standing dummies in front, the power switched on from the sandbox
// kit, then its key pressed while frames are captured. Writes public/abilities/t-<card>.webp (400×225, looping).
//   npm run build && node tools/shots/trooper-cards.mjs            (CARDS=scan,ion picks some; CHROMIUM=… a browser)
// Needs Python 3 with Pillow to pack the frames into an animated WebP.

import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const page_url = pathToFileURL(path.join(root, 'dist/index.html')).href;
const OUT = path.join(root, 'public/abilities');

// card → what to switch on, how many squadmates, what to press, and how much game time to record
const CARDS = {
  scan:      { kit: ['scan'], keys: ['q'], secs: 2.2 },
  frag3:     { keys: ['g', 'wait:0.5', 'g'], secs: 2.4 },
  modAuto:   { kit: ['modAuto'], keys: ['1', 'hold:lmb:1.8'], secs: 2.2 },
  modScope:  { kit: ['modScope'], keys: ['1', 'hold:rmb:0.4', 'click', 'wait:0.5', 'click'], secs: 2.0, release: 'rmb' },
  squad3:    { squad: 3, keys: ['h'], secs: 2.6 },
  bshield:   { kit: ['bshield'], keys: ['v'], secs: 2.2 },
  medic:     { kit: ['medic'], squad: 2, keys: [], secs: 2.4, hurtSquad: true },
  ion:       { kit: ['ion'], keys: ['f'], secs: 2.2 },
  breach:    { kit: ['breach'], keys: ['f'], secs: 2.0 },
  commander: { kit: ['artillery'], keys: ['z'], secs: 2.8 },
  commando:  { kit: ['launcher'], keys: ['3', 'wait:0.3', 'click'], secs: 2.0 },
  strafe:    { kit: ['strafe'], keys: ['x'], secs: 2.8 },
};
const pick = (process.env.CARDS || Object.keys(CARDS).join(',')).split(',');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const id of pick){
  const C = CARDS[id]; if (!C) { console.log('no such card', id); continue; }
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('jpt_quality', 'medium'); localStorage.setItem('sw_asktrain', '1');
    for (const h of ['jedi', 'mando', 'trooper']) localStorage.setItem('sw_camp_' + h, '1');
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('clip', 'NotSupportedError')); };
  });
  await page.goto(page_url);
  await page.waitForFunction(() => window.GAME && GAME.G);
  await page.$eval('#hero-trooper', el => el.click()); await page.$eval('#mode-sandbox', el => el.click());
  for (let i = 0; i < 8; i++){
    for (const s of ['#goText', '#trainNo']) if (await page.isVisible(s)) await page.click(s, { timeout: 1500 }).catch(() => {});
    if (await page.waitForFunction(() => GAME.G.mode === 'play' && !GAME.G.paused, null, { timeout: 3000 }).then(() => true, () => false)) break;
  }
  // the stage: no HUD, dummies standing in a loose pack ahead, the kit for this card, the squad if it needs one
  await page.keyboard.press('b');
  await page.click('[data-n="5"]').catch(() => {});
  await page.click('#sbdummy').catch(() => {});
  await page.click('[data-foe="grunt"]').catch(() => {});
  for (let i = 0; i < (C.squad || 0); i++) await page.click('#sbsquadadd').catch(() => {});
  await page.click('#sbdone').catch(() => {});
  await page.evaluate(kit => { GAME.sandboxKitAll(false); for (const k of kit) GAME.setSandboxKit(k, true);
    document.getElementById('hud').style.opacity = '0'; GAME.G.pitch = 0.16;
    // pull the pack in to 6–7 m, fanned across the view, so the power reads in a small clip
    const p = GAME.player.group.position, fx = Math.sin(GAME.G.yaw), fz = Math.cos(GAME.G.yaw), foes = GAME.enemies.filter(e => !e.dead);
    foes.forEach((e, i) => { const side = (i - (foes.length - 1) / 2) * 1.6, d = 6 + (i % 2) * 1.2; e.group.position.set(p.x + fx*d + fz*side, 0, p.z + fz*d - fx*side); });
  }, C.kit || []);
  await page.waitForTimeout(2500);
  if (C.hurtSquad) await page.evaluate(() => { for (const a of GAME.squad.allies) a.hp = a.maxHp * 0.35; });
  const dir = mkdtempSync(path.join(tmpdir(), 'clip-'));
  const gt = () => page.evaluate(() => GAME.G.gt);
  const t0 = await gt();
  const frames = [];
  const shoot = async () => { const f = path.join(dir, String(frames.length).padStart(3, '0') + '.png'); await page.screenshot({ path: f }); frames.push(f); };
  // press through the card's keys while recording
  for (const k of C.keys){
    if (k.startsWith('wait:')){ const until = (await gt()) + +k.slice(5); while ((await gt()) < until) await shoot(); continue; }
    if (k.startsWith('hold:')){
      const [, btn, s] = k.split(':'); const button = btn === 'lmb' ? 'left' : 'right';
      await page.mouse.down({ button });
      const until = (await gt()) + +s; while ((await gt()) < until) await shoot();
      if (!(C.release === btn)) await page.mouse.up({ button });
      continue;
    }
    if (k === 'click'){ await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); await shoot(); continue; }
    await page.keyboard.press(k); await shoot();
  }
  while ((await gt()) - t0 < C.secs) await shoot();
  if (C.release) await page.mouse.up({ button: C.release === 'lmb' ? 'left' : 'right' });
  // keep at most 24 frames, evenly spaced, and pack them
  const step = Math.max(1, frames.length / 24), keep = [];
  for (let i = 0; i < frames.length; i += step) keep.push(frames[Math.floor(i)]);
  const out = path.join(OUT, 't-' + id + '.webp');
  const py = path.join(dir, 'pack.py');
  writeFileSync(py, `import sys\nfrom PIL import Image\nfr=[Image.open(p).convert('RGB').resize((400,225), Image.LANCZOS) for p in sys.argv[2:]]\nfr[0].save(sys.argv[1], save_all=True, append_images=fr[1:], duration=95, loop=0, quality=72, method=6)\n`);
  execFileSync('python3', [py, out, ...keep]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`${id}: ${keep.length} frames of ${frames.length} → ${path.relative(root, out)}${errs.length ? '  errors: ' + errs.slice(0, 2).join(' | ') : ''}`);
  await page.close();
}
await browser.close();
