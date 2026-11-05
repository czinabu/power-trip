// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// TROOPER SIM — the in-page half (injected by tools/trooper-sim/sim.mjs before the game loads). Like the duel sim it takes
// over the game's clock so a fight runs as fast as the CPU allows and seeds Math.random, then plays the ARC trooper with
// a scripted bot in the sandbox, through the real input path (keys and mouse events) and the real combat code:
//   stand   plants his feet where he starts and shoots: aim held, the trigger pulled as fast as the gun allows, a vent
//           when it cooks off. What "stand there and shoot the head" plays like.
//   cover   fights from cover: picks the face between him and the foes, walks (or rolls) to it, takes it (C), leans out
//           for a volley, ducks back when the fire gets heavy or the gun runs hot, and moves on when he's flanked or a
//           detonator lands by him. A rough, fair player, not a perfect one: his aim wobbles and he's slow to react.
(() => {
  // ---------- the clock ----------
  let vt = 0, pump = null;
  const rafQ = [];
  performance.now = () => vt;
  window.requestAnimationFrame = (cb) => { rafQ.push(cb); return rafQ.length; };
  window.cancelAnimationFrame = () => {};
  const frame = (ms) => { vt += ms; const q = rafQ.splice(0); for (const cb of q){ try { cb(vt); } catch(e){ console.error('frame: ' + (e.stack || e.message)); } } };
  const startPump = () => { if (!pump) pump = setInterval(() => frame(16.7), 16); };
  const stopPump = () => { clearInterval(pump); pump = null; };
  startPump();
  // ---------- seeded random ----------
  let seed = 1;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  Math.random = rnd;

  const mouse = (type, button) => document.dispatchEvent(new MouseEvent(type, { button, bubbles: true }));
  const key = (type, k) => document.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
  const press = (k) => { key('keydown', k); key('keyup', k); };

  // ---------- aiming: turn the view until the lens looks at the point ----------
  const _d = { x: 0, y: 0, z: 0 };
  function aimAt(G, cam, p, wob){
    const dx = p.x - cam.position.x, dy = p.y - cam.position.y, dz = p.z - cam.position.z;
    const yawW = Math.atan2(dx, dz) + wob.x, pitchW = Math.atan2(dy, Math.hypot(dx, dz)) + wob.y;
    const dir = cam.getWorldDirection(new cam.position.constructor());
    const yawC = Math.atan2(dir.x, dir.z), pitchC = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    const ey = Math.atan2(Math.sin(yawW - yawC), Math.cos(yawW - yawC)), ep = pitchW - pitchC;
    G.yaw += ey * 0.7;
    G.pitch -= ep * 0.7 * AIM.sign;
    G.pitch = Math.max(-1.2, Math.min(1.2, G.pitch));
  }
  const AIM = { sign: 1 };

  // ---------- walking toward a point (camera-relative keys) ----------
  function walkTo(GAME, x, z){
    const { G, player, keys } = GAME, p = player.group.position;
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    for (const k of ['w', 'a', 's', 'd']) keys[k] = false;
    if (d < 0.25) return d;
    const fx = Math.sin(G.yaw), fz = Math.cos(G.yaw);   // the view's forward
    const f = (dx * fx + dz * fz) / d, r = (dx * -fz + dz * fx) / d;   // (right = forward turned clockwise)
    if (f > 0.38) keys.w = true; if (f < -0.38) keys.s = true;
    if (r > 0.38) keys.d = true; if (r < -0.38) keys.a = true;
    return d;
  }

  const headOf = (e) => { const g = e.group.position, s = e.group.scale.y || 1; return { x: g.x, y: g.y + (e.t.heavy ? 2.4 : 1.62) * s, z: g.z }; };
  const chestOf = (e) => { const g = e.group.position, s = e.group.scale.y || 1; return { x: g.x, y: g.y + 1.2 * s, z: g.z }; };
  const alive = (GAME) => GAME.enemies.filter(e => !e.dead && !e.converted && e.state !== 'spawn');

  // the cover face between him and the foes, nearest first
  function pickCover(GAME, foes, avoid, nade){
    const { player, solids } = GAME, C = GAME.cover, p = player.group.position;
    if (!foes.length) return null;
    let cx = 0, cz = 0; for (const e of foes){ cx += e.group.position.x; cz += e.group.position.z; } cx /= foes.length; cz /= foes.length;
    let best = null, bs = 1e9;
    for (const c of solids){
      if (c.climbable || c.mound || c.y0 || c.h < 0.95) continue;
      if (window.__course && !c.sim) continue;   // (the course only: the hangar's own props are hard to path round)
      if (avoid && avoid === c) continue;
      const ax = cx - c.x, az = cz - c.z, al = Math.hypot(ax, az) || 1;
      const ext = c.box ? Math.abs(ax / al) * c.hx + Math.abs(az / al) * c.hz : c.r;
      const x = c.x - ax / al * (ext + 0.7), z = c.z - az / al * (ext + 0.7);   // its far side from the foes
      const d = Math.hypot(x - p.x, z - p.z);
      if (d > 16) continue;
      if (nade && Math.hypot(x - nade.to.x, z - nade.to.z) < (nade.R || 3.4) + 1.5) continue;
      if (GAME.tactics.grenades.some(g => !g.friendly && Math.hypot(x - g.to.x, z - g.to.z) < (g.R || 3.4) + 1)) continue;
      const toFoes = Math.hypot(cx - x, cz - z);
      if (toFoes < 7) continue;
      const sc = d + (c.h > 1.9 ? 1.5 : 0);
      if (sc < bs){ bs = sc; best = { c, x, z }; }
    }
    return best;
  }

  async function run(cfg){
    const GAME = window.GAME, { G, player, keys } = GAME, cam = GAME.camera;
    seed = cfg.seed || 1;
    stopPump();
    const dt = 16.7, R = { win: false, t: 0, hpLost: 0, downs: 0, shots: 0, hits: 0, peekT: 0, coverT: 0, openT: 0, flankedT: 0, maxSupp: 0, kills: 0 };
    const steps = (secs) => { for (let i = 0; i < secs * 1000 / dt; i++) frame(dt); };
    // the field: the hero at the start, the foes in front
    GAME.sandboxClear && GAME.sandboxClear();
    for (const k in keys) keys[k] = false;
    if (GAME.squad.clearSquad) GAME.squad.clearSquad();
    GAME.cover.resetCover();
    player.up = { ...player.up, hpMax: 0, dmg: 1, dr: 0, move: 1, fireRate: 1 }; player.hp = 100; player.downed = false;
    for (const k of ['openArmor', 'coverArmor', 'coverDmg', 'suppRes', 'squadExtra', 'squadDmg', 'squadDr', 'brothers', 'reviveMul', 'heatCool', 'heatMul', 'fragExtra']) delete player.up[k];
    for (const k of ['artillery', 'launcher', 'strafe', 'medic', 'bshield']) delete G.unlocked[k];
    if (player.weapon !== 'rifle') GAME.cover && document.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    if (cfg.setup) (new Function('GAME', cfg.setup))(GAME);
    // the cover course: the same few walls and pillars every fight (no drawing: they only need to be solid)
    if (!window.__course && cfg.course){ window.__course = true; for (const c of cfg.course) GAME.solids.push({ ...c, box: true, sim: true }); GAME.nav.buildNav && GAME.nav.buildNav(); }
    // his real bar, and a deep one under it so a lost fight ends here instead of ending the sandbox (a fall is
    // counted when what he has lost reaches his real bar)
    const maxHp0 = 100 + (player.up.hpMax || 0), PAD = 10000;
    player.up.hpMax = (player.up.hpMax || 0) + PAD; player.hp = maxHp0 + PAD;
    const realHp = () => player.hp - PAD;
    player.group.position.set(cfg.at[0], 0, cfg.at[1]); player.vel.set(0, 0, 0); player.moveVel.set(0, 0, 0);
    G.yaw = cfg.yaw || 0; G.pitch = 0.05;
    steps(0.3);
    if (cfg.squad) GAME.squad.spawnSquad(cfg.squad);
    for (const f of cfg.foes){
      if (f.boss){ GAME.spawnBoss(); }
      else for (let i = 0; i < (f.n || 1); i++){
        const a = (i - ((f.n || 1) - 1) / 2) * 3.2;
        const e = GAME.spawnEnemy(f.type, { x: f.at[0] + Math.cos(cfg.yaw || 0) * a, y: 0, z: f.at[1] - Math.sin(cfg.yaw || 0) * a, clone(){ return { ...this }; } }, {}) || GAME.enemies[GAME.enemies.length - 1];
        if (e && f.hpMul){ e.hp = e.maxHp = Math.round(e.hp * f.hpMul); }
        // a mission's named gunman (game/mission.js spawnInquisitor): its bar, its damage, and its rules against the trooper
        if (e && f.champ){ e.champion = true; e.hp = e.maxHp = Math.round(e.hp * f.champ.hp); e.t = { ...e.t, dmg: e.t.dmg * f.champ.dmg }; if (!f.champ.old) e.dmgRule = GAME.coverFight.champRule; }
      }
    }
    steps(0.5);
    const bossFoe = () => GAME.enemies.find(e => (e.fin || e.champion) && !e.dead);
    let hpPrev = player.hp, aimT = 0, peekPlan = 0, duckPlan = 0, target = null, goal = null, goalT = 0, lastFlank = -9, wob = { x: 0, y: 0 }, wobT = 0;
    let rmb = false, lastClick = 0, nade = null, recN = 0;
    const setRmb = (on) => { if (on && !rmb){ mouse('mousedown', 2); rmb = true; } else if (!on && rmb){ mouse('mouseup', 2); rmb = false; } };
    const t0 = G.gt, k0 = (G.stats && G.stats.kills) || 0;
    while (G.gt - t0 < cfg.tmax){
      steps(0.05);
      if (cfg.rec){   // (recording: his real bar on the HUD, not the deep one under it, and every `rec` steps a pause for a screenshot)
        const hv = document.getElementById('hpval'), hb = document.getElementById('hpbar'), h = Math.max(0, realHp());
        if (hv) hv.textContent = Math.ceil(h) + ' / ' + maxHp0; if (hb) hb.style.width = (h / maxHp0 * 100) + '%';
        if ((++recN) % cfg.rec === 0) await new Promise(r => { window.__recGo = r; });   // (the recorder takes its shot, then lets it run on)
      }
      const t = G.gt - t0;
      if (player.hp < hpPrev){ const l = hpPrev - player.hp, cv = player.cover; R.hpLost += l; const k = !cv ? 'dOpen' : cv.peek > 0.5 ? 'dPeek' : 'dHid'; R[k] = (R[k] || 0) + l; const by = bossFoe()?.fin?.sig?.id || (bossFoe() ? 'gun' : 'foes'); R.dBy = R.dBy || {}; R.dBy[by + ':' + k.slice(1)] = Math.round((R.dBy[by + ':' + k.slice(1)] || 0) + l); }
      hpPrev = player.hp;
      if (cfg.trace && Math.round(t * 20) % 10 === 0) R.trace = (R.trace || []).concat([[+t.toFixed(1), +player.group.position.x.toFixed(1), +player.group.position.z.toFixed(1), Math.round(player.hp), !!player.cover, goal ? [+goal.x.toFixed(1), +goal.z.toFixed(1)] : null, +(player.supp || 0).toFixed(2)]]);
      if (player.downed || realHp() <= 0){ R.downs++; break; }
      if (G.mode !== 'play'){ break; }
      R.maxSupp = Math.max(R.maxSupp, player.supp || 0);
      const foes = alive(GAME);
      if (!foes.length && !GAME.G.spawnQueue.length && !bossFoe() && !GAME.enemies.some(e => !e.dead && !e.converted)){ R.win = true; break; }
      // the target: the boss, else the nearest one he can see
      const p = player.group.position;
      target = bossFoe() || foes.slice().sort((a, b) => a.group.position.distanceTo(p) - b.group.position.distanceTo(p))[0] || null;
      if ((wobT -= 0.05) <= 0){ wobT = 0.4 + rnd() * 0.5; const s = cfg.aimErr ?? 0.02; wob = { x: (rnd() - 0.5) * s, y: (rnd() - 0.5) * s * 0.6 }; }
      if (target) aimAt(G, cam, cfg.head && rnd() < 0.85 ? headOf(target) : chestOf(target), wob);
      // the gun: vent when it cooks off
      if (player.overheat && !(player.ventT > 0)) press('r');
      const v = player.cover;
      if (cfg.bot === 'stand'){
        R.openT += 0.05;
        setRmb(true);
        if (target && !player.overheat && t - lastClick > 0.11){ lastClick = t; mouse('mousedown', 0); mouse('mouseup', 0); R.shots++; }
        continue;
      }
      // ---- the cover bot ----
      const threats = foes.filter(e => e.group.position.distanceTo(p) < 34);
      // flanked: a foe with a line on him from the side his cover doesn't cover, or a detonator at his feet
      let flanked = false;
      if (v){
        R.coverT += 0.05;
        const me = { pos: p, cover: GAME.cover.coverInfo() };
        for (const e of threats){
          const dx = e.group.position.x - p.x, dz = e.group.position.z - p.z, l = Math.hypot(dx, dz) || 1;
          const front = -(dx * v.nx + dz * v.nz) / l;
          if (front < 0.25 && l < 24 && e.t.ranged && GAME.coverFight.heroExposedFrom(e.group.position.x, e.group.position.z, me)){ flanked = true; break; }
        }
        const gr = (GAME.tactics.grenades || []).find(g => !g.friendly && Math.hypot(g.to.x - p.x, g.to.z - p.z) < (g.R || 3.4) + 0.8);
        if (gr){ flanked = true; nade = gr; }
      } else R.openT += 0.05;
      if (flanked){ R.flankedT += 0.05; }
      const laneOn = bossFoe()?.fin?.sig?.id === 'suppress';   // (stay down while the red lane is on him: the roll would go through it)
      if (v && flanked && !(laneOn && !nade) && t - lastFlank > 1.0 + rnd() * 0.5){   // (a human's beat to see it)
        lastFlank = t;
        setRmb(false);
        goal = pickCover(GAME, threats, nade || threats.length < 2 ? null : v.c, nade);   // (one gunman: round the same cover to its far side)
        // roll out the way the next cover is (or straight away from a detonator)
        const gx = nade ? p.x - nade.to.x : (goal ? goal.x - p.x : -v.nx), gz = nade ? p.z - nade.to.z : (goal ? goal.z - p.z : -v.nz);
        walkTo(GAME, p.x + gx, p.z + gz);
        press('shift');
        goalT = t; nade = null;
        continue;
      }
      if (!v){
        setRmb(false);
        if (!goal || t - goalT > 6) { goal = pickCover(GAME, threats, null); goalT = t; }
        if (goal){
          const d = walkTo(GAME, goal.x, goal.z);
          if ((d < 0.6 || (d < 1.6 && t - goalT > 3)) && player.grounded){ for (const k of ['w', 'a', 's', 'd']) keys[k] = false; press('c'); if (player.cover){ goal = null; duckPlan = t + 0.4; } }
        } else {
          // nowhere to hide: fight in the open
          for (const k of ['w', 'a', 's', 'd']) keys[k] = false;
          if (target && t - lastClick > 0.12){ lastClick = t; mouse('mousedown', 0); mouse('mouseup', 0); R.shots++; }
        }
        // shoot on the move, the way a player does
        if (goal && target && t - lastClick > 0.25){ lastClick = t; mouse('mousedown', 0); mouse('mouseup', 0); R.shots++; }
        continue;
      }
      for (const k of ['w', 'a', 's', 'd']) keys[k] = false;
      // in cover: shuffle to an edge of tall cover so the lean has somewhere to go
      if (!v.low && v.box && !v.edge){ keys[v.side > 0 ? 'd' : 'a'] = true; }
      // lean out for a volley, duck back when hot, hurting or pinned
      const hot = player.heat > 0.78 || player.overheat, pinned = (player.supp || 0) > 0.75, hurt = realHp() < maxHp0 * 0.3;
      if (v.peek > 0.5) R.peekT += 0.05;
      // the Marshal's suppressing fire walks a red lane at you: stay down until it's done
      if (laneOn) duckPlan = Math.max(duckPlan, t + 0.3);
      if (t < duckPlan){ setRmb(false); continue; }
      if (rmb && (t > peekPlan || hot || pinned)){ setRmb(false); duckPlan = t + 0.7 + rnd() * 0.8 + (hurt ? 1.2 : 0) + (pinned ? 0.8 : 0); continue; }
      if (!rmb){ setRmb(true); peekPlan = t + 1.0 + rnd() * 0.9; }
      if (target && v.peek > 0.9 && t - lastClick > 0.12){ lastClick = t; mouse('mousedown', 0); mouse('mouseup', 0); R.shots++; }
    }
    setRmb(false);
    for (const k of ['w', 'a', 's', 'd']) keys[k] = false;
    R.t = +(G.gt - t0).toFixed(1);
    R.hpLost = Math.round(R.hpLost);
    R.hpLeft = Math.max(0, Math.round(realHp()));
    player.up.hpMax -= PAD; player.hp = Math.min(player.hp, 100 + player.up.hpMax);
    R.kills = ((G.stats && G.stats.kills) || 0) - k0;
    for (const k of ['peekT', 'coverT', 'openT', 'flankedT', 'maxSupp', 'dOpen', 'dPeek', 'dHid']) R[k] = +(R[k] || 0).toFixed(2);
    const b = bossFoe(); if (b) R.bossHp = +(b.hp / b.maxHp).toFixed(2);
    startPump();
    return R;
  }
  window.TSIM = { run, AIM, stopPump, startPump, frame: (n) => { stopPump(); for (let i = 0; i < n; i++) frame(16.7); startPump(); }, step: (n) => { for (let i = 0; i < n; i++) frame(16.7); } };
})();
