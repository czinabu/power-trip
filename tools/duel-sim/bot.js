// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DUEL SIM — the in-page half (injected by tools/duel-sim/sim.mjs before the game loads). It takes over the game's clock
// (performance.now and requestAnimationFrame) so a fight runs as fast as the CPU allows, seeds Math.random so a duel can
// be replayed, and plays the Jedi with a scripted bot that fights the way a good player does:
//   · DEFENCE — it reads the foe's wind-up (what's on screen: the coil, not the hidden hold) and either goes for the parry
//     (a fresh RMB click timed off its read, with human timing error) or raises the guard early and blocks. A thrust it
//     always tries to parry (a held guard can't stop one). It bites on some feints.
//   · OFFENCE — it cuts into openings freely (a riposte, a foe recovering, winded or staggered); into a guard it spaces
//     its cuts (so it isn't parried for mashing) and usually picks a line the guard isn't covering. It mashes a lock.
//   · FORMS — a fixed-form bot stays in its form; an adaptive one switches to the counter form when a master switches.
// Saber only: no Force powers, kicks or dashes, so the numbers are the forms' own.
(() => {
  // ---------- the clock ----------
  let vt = 0, pump = null;
  const rafQ = [];
  performance.now = () => vt;
  window.requestAnimationFrame = (cb) => { rafQ.push(cb); return rafQ.length; };
  window.cancelAnimationFrame = () => {};
  const frame = (ms) => { vt += ms; const q = rafQ.splice(0); for (const cb of q){ try { cb(vt); } catch(e){ console.error('frame: ' + (e.stack || e.message)); } } };
  // while the game boots, frames run on real time; a fight steps them by hand
  const startPump = () => { if (!pump) pump = setInterval(() => frame(16.7), 16); };
  const stopPump = () => { clearInterval(pump); pump = null; };
  startPump();
  // ---------- seeded random ----------
  let seed = 1;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  Math.random = rnd;
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  // the game's own counter table (data/foe-forms.js), handed in by sim.mjs so a new form or a regrouping needs no edit here
  const FAMILY = __FORM_FAMILY__, BEATS = __BEATS__;
  const edge = (a, b) => { const fa = FAMILY[a], fb = FAMILY[b]; if (!fa || !fb || fa === fb) return 0; return BEATS[fa] === fb ? 1 : BEATS[fb] === fa ? -1 : 0; };
  const GUARD_ANG = { R: 0, H: 90, L: 180, Lo: 270 };
  const angDist = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
  // the keyed cuts (data/stances.js CUT_ANGLE.keys) as [keys held, angle]
  const CUTS = [[['a'], 0], [['d'], 180], [['w'], 90], [['w', 'a'], 45], [['w', 'd'], 135], [['s', 'a'], 315], [['s', 'd'], 225]];

  const mouse = (type, button) => document.dispatchEvent(new MouseEvent(type, { button, bubbles: true }));
  const clearKeys = (keys) => { for (const k of ['w', 'a', 's', 'd']) keys[k] = false; };

  // the bot's read of the next blow: seconds until it lands as the screen shows it (null: nothing coming)
  function threatOf(e){
    if (!e || e.dead || !e.plan) return null;
    const t = e.t, sw = (t.swing || 0.16) * (e.plan.swingMul || 1), hk = e.plan.hitK || 0.5;
    if (e.state === 'windup'){
      const base = e.wuBase || e.wu, el = e.wu - e.st;
      return Math.max(0, base - el) + sw * hk;   // (a held strike looks due at the end of its coil: the hold fools it)
    }
    if (e.state === 'strike' && !e.struck){ const k = 1 - Math.max(0, e.st) / (e.swDur || sw); return Math.max(0, hk - k) * (e.swDur || sw); }
    return null;
  }

  /* one fight. cfg: { form, loadout, foes: [{ type, form, rank }], depth, seed, tmax, skill, adaptive, spread }
     returns what happened */
  function fight(cfg){
    stopPump();
    const { G, player, enemies, keys, shared, CFG, STANCES } = GAME;
    seed = cfg.seed || 1;
    const S = Object.assign({ see: 0.25, parry: 0.6, sigma: 0.07, react: 0.32, read: 0.8, mash: 0.15, gap: 0.9, bite: 0.3, lockRate: 0.13 }, cfg.skill || {});
    GAME.sandboxClear();
    G.seenTypes = Object.assign(G.seenTypes || {}, { __forms: true });
    for (const k in keys) keys[k] = false;
    mouse('mouseup', 0); mouse('mouseup', 2);
    shared.lockFallback = true;
    G.sandboxGod = false;
    G.loadout = (cfg.loadout || [cfg.form, null, null]).slice();
    G.stanceCd = 0;
    GAME.switchStance(cfg.form, true);
    G.stance = cfg.form;
    // a fresh hero in the middle of the room, facing +z
    const maxHp = CFG.player.maxHp + (player.up.hpMax || 0), maxStam = CFG.player.maxStam + (player.up.maxStam || 0);
    player.hp = maxHp; player.stam = maxStam; player.force = CFG.player.maxForce;
    player.group.position.set(0, 0, 0); player.vel.set(0, 0, 0); G.yaw = 0;
    player.riposteT = 0; player.atkT = 0; player.parryT = 0; player.parryLockT = 0; player.gbT = 0; player.fury = 0;
    // the foes: spawned at depth 0 (base health, no elites), then the run's depth is set for their skill ramp
    G.waveTotal = 0; G.endless = false;
    const foes = [];
    const n = cfg.foes.length;
    cfg.foes.forEach((f, i) => {
      G.sbFoeForm = f.form || null; G.sbFoeRank = f.rank || null;
      const before = enemies.length;
      const ang = n === 1 ? 0 : (i / n) * Math.PI * 2, d = cfg.spread || 5;
      GAME.spawnEnemy(f.type, new player.group.position.constructor(Math.sin(ang) * d, 0, Math.cos(ang) * d));
      const e = enemies[enemies.length - 1];
      if (enemies.length === before || !e) return;
      e.dummy = false;
      if (f.hpMul){ e.maxHp *= f.hpMul; e.hp = e.maxHp; }
      foes.push(e);
    });
    G.sbFoeForm = null; G.sbFoeRank = null;
    G.waveTotal = cfg.depth || 0;
    const R = { frames: 0, dmg: 0, hits: 0, stam: 0, parries: 0, parryTry: 0, blocks: 0, swings: 0, switches: 0, foeSwitch: 0, locks: 0, kills: 0, firstKill: null };
    const st = { rmb: false, plan: null, nextAtk: 0, lockAt: 0, badT: 0, lastStam: player.stam, wasLock: false, lastForm: foes.map(e => e.ff) };
    const stats0 = { p: (G.stats && G.stats.parries) || 0 };
    const dt = 1 / 60, tmax = cfg.tmax || 90;
    const alive = () => foes.filter(e => !e.dead && enemies.includes(e));
    let end = 'timeout';
    while (G.gt >= 0){
      const live = alive();
      if (!live.length){ end = 'win'; break; }
      if (R.dmg >= maxHp){ end = 'loss'; break; }
      if (R.frames * dt > tmax) break;
      if (G.mode !== 'play'){ end = 'mode:' + G.mode; break; }
      G.paused = false; G.cardUp = false; G.skillSelect = false;
      // ---- the bot ----
      const pp = player.group.position;
      let tgt = null, td = 1e9;
      for (const e of live){ const d = Math.hypot(e.group.position.x - pp.x, e.group.position.z - pp.z); if (d < td){ td = d; tgt = e; } }
      // the soonest blow coming (any foe)
      let thr = null, tE = null;
      for (const e of live){
        const d = Math.hypot(e.group.position.x - pp.x, e.group.position.z - pp.z);
        const t = d < 6 ? threatOf(e) : null;
        if (t != null && (thr == null || t < thr)){ thr = t; tE = e; }
      }
      const face = tE || tgt;
      if (face) G.yaw = Math.atan2(face.group.position.x - pp.x, face.group.position.z - pp.z);
      clearKeys(keys);
      const sto = STANCES[G.stance];
      const pwin = CFG.player.parryWindow + (sto.parryBonus || 0) + (player.up.parry || 0);
      if (player.saberLock){
        R.locks += st.wasLock ? 0 : 1; st.wasLock = true;
        if (G.gt >= st.lockAt){ mouse('mousedown', 0); mouse('mouseup', 0); st.lockAt = G.gt + S.lockRate * (0.8 + rnd() * 0.4); }
      } else {
        st.wasLock = false;
        // DEFENCE
        if (thr != null){
          const pl = tE.plan, key = tE.group.uuid + ':' + pl.n + ':' + pl.side + ':' + (tE.wuBase || 0).toFixed(3) + ':' + (pl.w0 ? 1 : 0);
          if (!st.plan || st.plan.key !== key){
            const thrust = pl.side === 'T';
            const go = thrust || rnd() < S.parry;
            st.plan = { key, go, at: pwin * 0.5 + gauss() * S.sigma, bite: !!(pl.feint && rnd() < S.bite), clicked: false };
            if (go) R.parryTry++;
          }
          const P = st.plan;
          if (P.go){
            // a bitten feint: the click goes in at the fake's break point
            const wk = tE.state === 'windup' ? (tE.wu - tE.st) / (tE.wuBase || tE.wu) : 1;
            if (!P.clicked && ((P.bite && tE.plan.feint && wk >= 0.62) || thr <= P.at)){
              if (st.rmb) mouse('mouseup', 2);
              mouse('mousedown', 2); st.rmb = true; P.clicked = true;
            }
          } else if (!st.rmb && thr <= S.react){ mouse('mousedown', 2); st.rmb = true; }
        } else if (st.rmb && !(player.blockHeld && G.gt < (st.holdUntil || 0))){
          mouse('mouseup', 2); st.rmb = false; st.plan = null;
        }
        // OFFENCE — nothing about to land on us
        if (thr == null || thr > 0.7){
          if (st.rmb){ mouse('mouseup', 2); st.rmb = false; }
          const e = tgt;
          if (e){
            const open = player.riposteT > 0 || G.gt < (e.openUntil || 0) || e.winded || e.state === 'stagger' || e.state === 'knockdown' || e.state === 'ragdoll' || e.stunT > 0 || !e.dp;
            const cost = sto.stamina * 1.4 + 14;
            if (td > 3.0) keys['w'] = true;   // close in
            else if (player.stam > cost && (open || G.gt >= st.nextAtk || rnd() < S.mash * dt * 4)){
              // pick the cut: off the guarded line if we read it
              clearKeys(keys);
              const seen = st.seen && st.seen.get(e);
              if (!open && e.dp && seen && rnd() < S.read){
                const ga = GUARD_ANG[seen] ?? 90;
                const ok = CUTS.filter(c => angDist(c[1], ga) > 70);
                const c = ok[(rnd() * ok.length) | 0];
                for (const k of c[0]) keys[k] = true;
              } else if (rnd() < 0.5){ const c = CUTS[(rnd() * CUTS.length) | 0]; for (const k of c[0]) keys[k] = true; }
              const was = player.atkT;
              mouse('mousedown', 0); mouse('mouseup', 0);
              if (player.atkT > was || player.queuedAtk) R.swings++;
              clearKeys(keys);
              st.nextAtk = G.gt + (open ? 0 : S.gap * (0.9 + rnd() * 0.3));
            }
          }
        }
        // FORMS — an adaptive hero answers a master's switch
        if (cfg.adaptive && tgt && tgt.ff){
          const k = edge(G.stance, tgt.ff);
          st.badT = k < 0 ? st.badT + dt : 0;
          if (st.badT > 1.0){
            const to = G.loadout.find(f => f && edge(f, tgt.ff) > 0) || G.loadout.find(f => f && edge(f, tgt.ff) === 0);
            if (to && to !== G.stance){ G.stanceCd = 0; GAME.switchStance(to); R.switches++; }
            st.badT = 0;
          }
        }
      }
      // what the hero SEES of each guard: as it was `see` s ago (a human's reaction lag)
      st.hist = st.hist || []; st.hist.push([G.gt, foes.map(e => e.guard)]);
      while (st.hist.length > 1 && st.hist[1][0] <= G.gt - S.see) st.hist.shift();
      st.seen = new Map(foes.map((e, i) => [e, st.hist[0][1][i]]));
      foes.forEach((e, i) => { if (e.ff !== st.lastForm[i]){ R.foeSwitch++; st.lastForm[i] = e.ff; } });
      // ---- one frame ----
      player.hp = maxHp;
      const s0 = player.stam;
      frame(1000 * dt);
      R.frames++;
      const lost = maxHp - player.hp;
      if (lost > 0.01){ R.dmg += lost; R.hits++; }
      if (player.stam < s0) R.stam += s0 - player.stam;
      if (R.firstKill == null && foes.some(e => e.dead)) R.firstKill = R.frames * dt;
    }
    clearKeys(keys); mouse('mouseup', 0); mouse('mouseup', 2);
    const live = alive();
    const hpLeft = foes.reduce((a, e) => a + (enemies.includes(e) && !e.dead ? Math.max(0, e.hp) / e.maxHp : 0), 0) / Math.max(1, foes.length);
    R.parries = ((G.stats && G.stats.parries) || 0) - stats0.p;
    R.kills = foes.length - live.length;
    startPump();
    return { end, t: +(R.frames * dt).toFixed(2), dmg: +R.dmg.toFixed(1), hits: R.hits, stam: Math.round(R.stam), parries: R.parries, parryTry: R.parryTry,
             swings: R.swings, locks: R.locks, switches: R.switches, foeSwitch: R.foeSwitch, kills: R.kills, of: foes.length, hpLeft: +hpLeft.toFixed(3),
             firstKill: R.firstKill, foeForms: foes.map(e => e.ff), foeRank: foes.map(e => e.rank) };
  }
  window.__duelSim = { fight, frame, startPump, stopPump };
})();
