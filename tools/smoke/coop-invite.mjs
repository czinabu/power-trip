// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP INVITE SMOKE TEST — easy joining (net/invite.js, ui/coop-ui.js, game/drop-in.js), on the BUILT game:
//   · the host copies an invite link and walks into their hub; a friend who opens the link is joined at once and taken
//     straight to the host's hub (one click there, which the browser's pointer lock asks for)
//   · a link whose time is up, or a made-up token, is turned away; a locked room turns away a new player, but a player
//     already in it whose link drops gets back in
//   · a friend joining a story mission the host is well into is set down with the party, not at the map's opening spot
//   npm run build && npm run smoke:coop-invite

import { chromium } from 'playwright';
import { PeerServer } from 'peer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = pathToFileURL(path.join(root, 'dist/index.html')).href + '?peerhost=127.0.0.1&peerport=9033';
const server = PeerServer({ port: 9033, host: '127.0.0.1', path: '/' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const poll = { timeout: +process.env.POLL_MS || 120000, polling: 250 };   // on a timer: only one page is in the foreground
const step = (what) => console.log('ok   ' + what);

async function open(name, query = ''){
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/clipboard/i.test(m.text())) errors.push(name + ': ' + m.text()); });
  await page.addInitScript(() => {
    try { localStorage.setItem('jpt_quality', 'low'); localStorage.setItem('sw_fullscreen', '0'); localStorage.setItem('sw_asktrain', '1');
          for (const h of ['temple', 'kamino', 'covert']) localStorage.setItem('sw_hubwelcome_' + h, '1');
          localStorage.setItem('sw_camp_jedi', '1'); localStorage.setItem('sw_camp_mando', '1'); } catch(e){}
    Element.prototype.requestPointerLock = function(){ return Promise.reject(new DOMException('smoke test', 'NotSupportedError')); };
  });
  await page.goto(url + query);
  await page.waitForFunction(() => window.GAME && window.GAME.G, null, poll);
  return page;
}
const status = (page) => page.evaluate(() => document.getElementById('coopstatus').textContent);
const connected = (page) => page.waitForFunction(() => /Connected/.test(document.getElementById('coopstatus').textContent), null, poll);
const failedWith = (page, re) => page.waitForFunction((s) => new RegExp(s).test(document.getElementById('coopstatus').textContent) && GAME.coopNet.status === 'failed', re, poll);
const inHub = (page) => page.waitForFunction(() => GAME.G.mode === 'play' && GAME.G.hub && !GAME.G.paused, null, poll);
// the invite's own part of a link (its address is the live site: here it is put on this build's address instead)
const queryOf = (link) => '&' + link.slice(link.indexOf('?') + 1);

let ok = false;
try {
  const host = await open('host');
  await host.click('#mode-coop'); await host.fill('#coopname', 'Caleb'); await host.click('#coophost');
  await host.waitForFunction(() => document.querySelector('#coopstatus .code') && document.getElementById('coopinvite').classList.contains('on'), null, poll);
  await host.click('#coopcopy');
  const link = await host.evaluate(() => GAME.invite.last());
  if (!/[?&]join=[A-Z0-9]{5}&inv=[a-z0-9]+&exp=\d+&from=Caleb/.test(link)) throw new Error('not an invite link: ' + link);
  const code = await host.evaluate(() => GAME.coopNet.code);
  step('the host copies an invite link: ' + link.replace(/^.*\?/, '?'));

  // the host walks into their hub
  await host.click('#coopclose');
  await host.$eval('#hero-jedi', el => el.click()); await host.click('#mode-temple'); await host.click('#goText');
  await inHub(host);

  // a friend opens the link: joined at once, the co-op panel names the host, one click takes them into the hub
  const guest = await open('guest', queryOf(link));
  await connected(guest);
  if (!(await guest.evaluate(() => !/join=/.test(location.search)))) throw new Error('the invite should come off the address bar');
  // (a PC browser asks for one click here, for the pointer lock; with a pad or on a phone, or a click still fresh, it goes alone)
  await guest.waitForFunction(() => GAME.G.hub || (getComputedStyle(document.getElementById('coopjointemple')).display !== 'none' && /IN THE TEMPLE/.test(document.getElementById('coopjointemple').textContent)), null, poll);
  await guest.evaluate(() => { const b = document.getElementById('coopjointemple'); if (!GAME.G.hub && GAME.G.mode === 'menu' && b.style.display !== 'none') b.click(); });
  await inHub(guest);
  await guest.waitForFunction(() => GAME.G.hubId === 'temple' && GAME.partnerShown(), null, poll);
  step('a friend who opens the link is joined and walks into the host\'s temple with one click');
  await host.evaluate(() => document.getElementById('coopBtn').click());
  await host.waitForFunction(() => /(PC|PHONE|APP).*(PC|PHONE|APP)/.test(document.getElementById('cooproster').textContent), null, poll);
  await host.evaluate(() => document.getElementById('coopclose').click());
  step('the room list shows each player\'s device: ' + (await host.evaluate(() => document.getElementById('cooproster').textContent)));

  // a link whose time is up is turned away before it tries; a made-up token is turned away by the host
  const late = await open('late', queryOf(link).replace(/exp=\d+/, 'exp=1000'));
  await failedWith(late, 'expired');
  const forged = await open('forged', queryOf(link).replace(/inv=[a-z0-9]+/, 'inv=zzzzzz'));
  await failedWith(forged, 'expired');
  if (await host.evaluate(() => GAME.coopNet.guests) !== 1) throw new Error('an expired invite got into the room');
  step('an expired link and a made-up token are both turned away');

  // the host locks the room: a new player is turned away, the guest already in gets back in after a dropped link
  await host.evaluate(() => { document.getElementById('cooplock').click(); });
  await host.waitForFunction(() => document.getElementById('cooplock').textContent === 'UNLOCK ROOM', null, poll);
  await guest.waitForFunction(() => true, null, poll);
  await late.evaluate(() => { document.getElementById('coopcode').value = ''; });
  await late.fill('#coopcode', code); await late.click('#coopjoin');
  await failedWith(late, 'locked');
  step('a locked room turns a new player away');
  await guest.evaluate(() => GAME.coopDrop());
  await guest.waitForFunction(() => GAME.coopNet.status === 'reconnecting' || GAME.coopNet.status === 'joining', null, poll).catch(() => {});
  await guest.waitForFunction(() => GAME.coopNet.status === 'connected', null, poll);
  step('...but the guest already in it gets back in after their link drops');
  await host.evaluate(() => { document.getElementById('cooplock').click(); });
  await host.waitForFunction(() => document.getElementById('cooplock').textContent === 'LOCK ROOM', null, poll);

  // DROP IN MID-MISSION: in a second room, the host starts a story mission and walks far from its start; a friend joins
  // the run and is set down with the party
  const host2 = await open('host2'), third = await open('third');
  await host2.click('#mode-coop'); await host2.click('#coophost');
  await host2.waitForFunction(() => document.querySelector('#coopstatus .code'), null, poll);
  const code2 = await host2.evaluate(() => GAME.coopNet.code);
  await third.click('#mode-coop'); await third.fill('#coopcode', code2); await third.click('#coopjoin');
  await Promise.all([connected(host2), connected(third)]);
  await host2.click('#coopclose');
  await host2.evaluate(() => localStorage.setItem('sw_mission_pursuit_jedi', '1'));
  await host2.$eval('#hero-jedi', el => el.click()); await host2.$eval('#mode-mission', el => el.click()); await host2.evaluate(() => document.getElementById('msn-pursuit').click());
  for (let i = 0; i < 6 && !(await host2.evaluate(() => GAME.G.mode === 'play' && GAME.G.mission)); i++){
    if (await host2.isVisible('#goText')) await host2.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await host2.isVisible('#forms [data-go]')) await host2.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
    await host2.waitForTimeout(800);
  }
  if (!(await host2.evaluate(() => GAME.G.mission))) throw new Error('the host did not start the mission');
  // the host heads well away from the mission's start
  await host2.evaluate(() => { const p = GAME.player.group.position; const s = GAME.missionState().def.start || [p.x, p.z]; const x = s[0] + 40, z = s[1] - 40; p.set(x, 0, z); GAME.player.vel.set(0, 0, 0); return [x, z]; });
  await third.waitForFunction(() => document.getElementById('coopjoinrun').style.display !== 'none', null, poll);
  await third.$eval('#hero-mando', el => el.click());
  await third.$eval('#coopjoinrun', el => el.click());
  for (let i = 0; i < 6 && !(await third.evaluate(() => GAME.G.mode === 'play')); i++){
    if (await third.isVisible('#goText')) await third.click('#goText', { timeout: 2000 }).catch(() => {});
    if (await third.isVisible('#forms [data-go]')) await third.click('#forms [data-go]', { timeout: 2000 }).catch(() => {});
    await third.waitForTimeout(800);
  }
  await third.waitForFunction(() => GAME.G.coopGuest && GAME.G.mission, null, poll);
  // (one page at a time gets frames: take turns in front, so each sends where it is and draws the other)
  let landed = false;
  for (let i = 0; i < 80 && !landed; i++){
    await (i % 2 ? host2 : third).bringToFront();
    await third.waitForTimeout(600);
    const at = await host2.evaluate(() => { const p = GAME.player.group.position; return [p.x, p.z]; });
    landed = await third.evaluate(([x, z]) => { const p = GAME.player.group.position; return Math.hypot(p.x - x, p.z - z) < 10; }, at);
  }
  if (!landed) throw new Error('the newcomer was not set down with the party');
  step('a player who joins the mission partway is set down with the party, not at its start');
  ok = true;
} catch(e){
  errors.push(e.message);
  for (const p of browser.contexts().flatMap(c => c.pages())) errors.push(JSON.stringify(await p.evaluate(() => ({ mode: GAME.G.mode, hub: GAME.G.hub, guest: GAME.G.coopGuest, net: GAME.coopNet.status, role: GAME.coopNet.role, status: document.getElementById('coopstatus').textContent, pos: [GAME.player.group.position.x | 0, GAME.player.group.position.z | 0], ms: GAME.missionState && GAME.missionState().i })).catch(x => x.message)));
}
await browser.close(); server.close?.();
if (!ok || errors.length){ console.error('FAIL co-op invite\n' + errors.join('\n')); process.exit(1); }
console.log('ok   co-op invite');
process.exit(0);
