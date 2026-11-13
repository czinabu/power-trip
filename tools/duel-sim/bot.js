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
//   · DODGE — a red DODGE tell (fx/tells.js, seen through game/sim-watch.js) is rolled through: a ring on or round him
//     (a choke, a repulse) a beat before it closes, a charge from across the floor (Vexis's Last Stand) as it arrives.
//     Skill keys `dodge` (how often it goes for it), `dodgeLead` (how early before the blow), `dodgeReact` (the beat to see it).
//   · UPGRADES — cfg.kit is a run's skill cards (data/skills.js ids), laid on before the fight (sim.mjs --upgrades).
// No Force powers or kicks, so the numbers are the forms' (and the cards') own.
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
    if (e && e.isBoss){
      // Darth Vexis: his blow lands the frame his wind-up runs out; a blink comes in on a short wind-up after it
      if (e.state === 'windup') return Math.max(0, e.st);
      if (e.state === 'gapclose') return Math.max(0, e.st) + GAME.BOSS_CFG.combo.windup * 0.85;
      return null;
    }
    if (e && !e.dead && !e.plan && (e.state === 'windup' || e.state === 'strike') && !e.t.ranged){
      // a plain melee foe: what shows is the coil, not the hold. The warbringer's overhead is parried off the tell it
      // flares as the hold lets go (e.heldTell); until then it's coming, but not yet
      const sw = e.t.swing || 0.16;
      // (the bot doesn't see the hidden hold: it counts the beat it has learned from the tell, the cue plus half the swing)
      if (e.state === 'windup' && e.dp && e.dp.brace){
        if (!e.heldTell){ e._tellAt = null; return 1.0; }
        if (e._tellAt == null) e._tellAt = GAME.G.gt;
        return Math.max(0, e._tellAt + ((e.swing && e.swing.cue) || 0.2) + sw * 0.5 - GAME.G.gt);
      }
      if (e.state === 'windup') return Math.max(0, (e.wuBase || e.wu) - (e.wu - e.st)) + sw * 0.5;
      if (!e.struck){ const k = 1 - Math.max(0, e.st) / (e.swDur || sw); return Math.max(0, 0.5 - k) * (e.swDur || sw); }
      return null;
    }
    if (!e || e.dead || !e.plan) return null;
    const t = e.t, sw = (t.swing || 0.16) * (e.plan.swingMul || 1), hk = e.plan.hitK || 0.5;
    if (e.state === 'windup'){
      const base = e.wuBase || e.wu, el = e.wu - e.st;
      return Math.max(0, base - el) + sw * hk;   // (a held strike looks due at the end of its coil: the hold fools it)
    }
    if (e.state === 'strike' && !e.struck){ const k = 1 - Math.max(0, e.st) / (e.swDur || sw); return Math.max(0, hk - k) * (e.swDur || sw); }
    return null;
  }

  /* one fight. cfg: { form, loadout, foes: [{ type, form, rank, hpMul, champ }], depth, seed, tmax, skill, adaptive, spread }
     a foe's type can be 'vexis' (the boss, boss/boss.js) or 'warbringer' (survival's champion); champ: { hp, dmg, rep }
     scales a duellist up the way a story duel does (game/mission.js spawnInquisitor). Returns what happened.
     begin(cfg) + step(n) run the same fight a few frames at a time (tools/duel-sim/clip.mjs films it). */
  let F = null;
  function begin(cfg){
    stopPump();
    const { G, player, enemies, keys, shared, CFG, STANCES } = GAME;
    seed = cfg.seed || 1;
    const S = Object.assign({ see: 0.25, parry: 0.6, sigma: 0.07, react: 0.32, read: 0.8, mash: 0.15, gap: 0.9, bite: 0.3, lockRate: 0.13,
                              catch: 0.85, jump: 0.75, heavy: 0, turtle: false, dodge: 0.85, dodgeLead: 0.15, dodgeReact: 0.25 }, cfg.skill || {});
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
    // a kyber crystal's attunement (sim.mjs plan 'crystals'): every fight starts from the same upgrades, then lays cfg.fx on
    if (!GAME.__up0) GAME.__up0 = JSON.parse(JSON.stringify(player.up));
    Object.assign(player.up, JSON.parse(JSON.stringify(GAME.__up0)));
    for (const [k, op, v] of cfg.fx || []) player.up[k] = op === '*' ? (player.up[k] ?? 1) * v : (player.up[k] ?? 0) + v;
    // a run's skill cards (sim.mjs --upgrades): each card's own apply(), as the upgrade screen does it
    for (const id of cfg.kit || []){ const k = GAME.SKILLS.find(c => c.id === id); if (k) k.apply(); }
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
      const at = new player.group.position.constructor(Math.sin(ang) * d, 0, Math.cos(ang) * d);
      if (f.type === 'vexis'){
        const fin = GAME.spawnBoss();
        // the rebuilt Vexis (boss/finale.js) is a duellist in `enemies` (GAME.finale): fought like any foe below
        if (GAME.finale && GAME.enemies.includes(GAME.finale)){ const e = GAME.finale; e.group.position.copy(at); e.dummy = false; foes.push(e); return; }
        const b = GAME.boss || fin; if (!b) return;
        b.isBoss = true; b.group.position.copy(at); b.st = Math.min(b.st, 0.6);   // (a short walk-up, not the cinematic one)
        foes.push(b); return;
      }
      if (f.type === 'warbringer') GAME.spawnChampion();
      else GAME.spawnEnemy(f.type, at);
      const e = enemies[enemies.length - 1];
      if (enemies.length === before || !e) return;
      e.group.position.copy(at);
      e.group.rotation.y = Math.atan2(-at.x, -at.z);   // squared up to the hero from the start (a cut in its back is a perfect strike: data/duel.js PERFECT)
      e.dummy = false;
      if (f.hpMul){ e.maxHp *= f.hpMul; e.hp = e.maxHp; }
      if (f.champ){
        e.champion = true;
        e.hp = e.maxHp = Math.round(e.maxHp * f.champ.hp);
        e.t = { ...e.t, dmg: e.t.dmg * f.champ.dmg };
        if (f.champ.rep) e.ffRep = f.champ.rep.slice();
        if (f.champ.duel && e.dp) Object.assign(e.dp, f.champ.duel);
        if (f.champ.rage && e.dp) e.simRage = { at: f.champ.rage, duel: f.champ.rageDuel || {} };   // its mission's rage (game/mission.js: the duel sharpens at this share of health)
      }
      foes.push(e);
    });
    G.sbFoeForm = null; G.sbFoeRank = null;
    G.waveTotal = cfg.depth || 0;
    const R = { frames: 0, dmg: 0, hits: 0, stam: 0, parries: 0, parryTry: 0, blocks: 0, swings: 0, heavies: 0, switches: 0, foeSwitch: 0, locks: 0, kills: 0, firstKill: null,
                dodgeTells: 0, dodges: 0, src: {}, dealt: { open: 0, closed: 0 }, states: {}, breaks: 0, deflects: 0, clashes: 0, phaseAt: {}, reflects: 0, novaJumps: 0, idle: 0, maxIdle: 0, lastDealt: 0 };
    const st = { rmb: false, plan: null, nextAtk: 0, lockAt: 0, badT: 0, lastStam: player.stam, wasLock: false, lastForm: foes.map(e => e.ff), lmbUp: 0, light: null, ringJ: new Set(), tells: [], rollAt: -9 };
    // every red DODGE tell as it flashes (game/sim-watch.js): the bot rolls through it in step()
    // (and a final boss's PARRY-OR-DODGE tells: his signature palm and blink cuts aren't swings the defence below reads;
    // a plain duellist's thrust tell is, so those are left to it)
    const finUp = () => foes.some(e => e.fin && isLive(e));
    if (GAME.simWatch) GAME.simWatch.tell = (kind, pos, r, dur) => { if (kind === 'dodge' || (kind === 'parry' && finUp())) st.tells.push({ kind, t: G.gt, x: pos.x, z: pos.z, r: r || 2, dur: dur ?? 0.45, plan: null }); };
    const stats0 = { p: (G.stats && G.stats.parries) || 0 };
    F = { cfg, S, foes, R, st, stats0, maxHp, maxStam, dt: 1 / 60, tmax: cfg.tmax || 90, end: null };
  }
  const isLive = (e) => e.isBoss ? (GAME.boss === e && e.hp > 0 && e.state !== 'dying') : (!e.dead && GAME.enemies.includes(e));
  const isOpen = (e) => e.isBoss ? (e.state === 'vulnerable' || e.state === 'stunned')
    : (GAME.G.gt < (e.openUntil || 0) || e.winded || e.state === 'stagger' || e.state === 'knockdown' || e.state === 'ragdoll' || e.stunT > 0);
  // run up to n frames of the fight; the result once it's over, else null
  function step(nFrames){
    const { G, player, enemies, keys, CFG, STANCES } = GAME;
    const { cfg, S, foes, R, st, maxHp, dt, tmax } = F;
    const alive = () => foes.filter(isLive);
    for (let fN = 0; fN < nFrames; fN++){
      const live = alive();
      for (const e of live) if (e.simRage && e.hp <= e.maxHp * e.simRage.at){ e.dp = { ...e.dp, ...e.simRage.duel }; e.simRage = null; }
      let end = null;
      if (!live.length) end = 'win';
      else if (R.dmg >= maxHp) end = 'loss';
      else if (R.frames * dt > tmax) end = 'timeout';
      else if (G.mode !== 'play') end = 'mode:' + G.mode;
      if (end) return finish(end);
      G.paused = false; G.cardUp = false; G.skillSelect = false;
      // ---- the bot ----
      const pp = player.group.position;
      // the target: the boss / champion first (cfg.foes[0]), else the nearest
      let tgt = null, td = 1e9;
      for (const e of live){ const d = Math.hypot(e.group.position.x - pp.x, e.group.position.z - pp.z); if (d < td){ td = d; tgt = e; } }
      const boss = live.find(e => e.isBoss) || null;
      // the soonest blow coming (any foe)
      let thr = null, tE = null;
      for (const e of live){
        const d = Math.hypot(e.group.position.x - pp.x, e.group.position.z - pp.z);
        const t = d < (e.isBoss ? 7 : 6) ? threatOf(e) : null;
        if (t != null && (thr == null || t < thr)){ thr = t; tE = e; }
      }
      const face = tE || (boss && boss.state === 'lightning' ? boss : null) || tgt;
      if (face) G.yaw = Math.atan2(face.group.position.x - pp.x, face.group.position.z - pp.z);
      clearKeys(keys);
      if (st.lmbUp && G.gt >= st.lmbUp){ mouse('mouseup', 0); st.lmbUp = 0; }
      const sto = STANCES[G.stance];
      const pwin = CFG.player.parryWindow + (sto.parryBonus || 0) + (player.up.parry || 0);
      // the boss's nova: jump each ring as its edge reaches you
      for (const r of GAME.rings){
        if (st.ringJ.has(r)) continue;
        const d = Math.hypot(pp.x - r.center.x, pp.z - r.center.z), gap = d - r.r;
        if (gap > 0 && gap < 3.2 && player.grounded){ st.ringJ.add(r); if (rnd() < S.jump){ document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); document.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true })); R.novaJumps++; } }
      }
      // DODGE: a red tell is rolled through (the roll's i-frames: data/mobility.js roll.iframes)
      let rolled = false;
      for (const T of st.tells){
        if (T.done) continue;
        if (!T.plan){
          if (T.kind !== 'parry') R.dodgeTells++;
          const d0 = Math.hypot(pp.x - T.x, pp.z - T.z);
          // a ring on or round him (a choke under his feet, a repulse off the foe he's on): roll as it closes
          const ring = d0 < T.r * 2 + 3;
          // else a charge from across the floor: the foe nearest the flash, rolled past as it arrives
          let src = null, sd = 1e9;
          if (!ring) for (const e of live){ const d = Math.hypot(e.group.position.x - T.x, e.group.position.z - T.z); if (d < sd){ sd = d; src = e; } }
          if (T.kind === 'parry'){
            // parry it (a fresh click timed off when it lands) or roll through it; a palm or a blink cut lands about this
            // long after its flash (boss/vexis.js: guardBreak.windup 0.6, blink tell + 0.12)
            const land = T.t + 0.55, parry = rnd() < S.parry;
            T.plan = { go: parry || rnd() < S.dodge, parry, ring: true, at: Math.max(T.t + S.dodgeReact, land - (parry ? pwin * 0.5 : S.dodgeLead) + gauss() * S.sigma), until: land + 0.2, side: rnd() < 0.5 ? 'a' : 'd' };
            if (ring) R.parryTry += parry ? 1 : 0;
            if (!ring) T.plan.go = false;
          } else
          T.plan = { go: rnd() < S.dodge, ring, src, at: Math.max(T.t + S.dodgeReact, T.t + T.dur - S.dodgeLead + gauss() * S.sigma), until: T.t + T.dur + (ring ? 0.3 : 2.5),
                     side: rnd() < 0.5 ? 'a' : 'd', last: null };
        }
        const P = T.plan;
        if (G.gt > P.until){ T.done = true; continue; }
        if (!P.go || rolled) continue;
        let now = false;
        if (P.ring) now = G.gt >= P.at;
        else if (P.src && G.gt >= T.t + S.dodgeReact){
          const q = P.src.group.position, d = Math.hypot(q.x - pp.x, q.z - pp.z);
          const closing = P.last != null ? (P.last - d) / dt : 0;   // (m/s toward him)
          P.last = d;
          now = d < 5.5 && closing > 8;
        }
        if (now && P.parry){
          if (st.rmb) mouse('mouseup', 2);
          mouse('mousedown', 2); st.rmb = true; st.holdUntil = G.gt + 0.35;
          rolled = true; T.done = true; continue;
        }
        if (now && G.gt - st.rollAt > 0.35){
          // a side roll off the line he's coming down (or off the ring's edge)
          keys[P.side] = true;
          if (st.rmb){ mouse('mouseup', 2); st.rmb = false; }
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
          document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));
          keys[P.side] = false;
          if (player.dashT > 0 && player.dashStartT === G.gt){ if (T.kind !== 'parry') R.dodges++; st.rollAt = G.gt; }
          rolled = true; T.done = true;
        }
      }
      st.tells = st.tells.filter(T => !T.done);
      if (player.saberLock){
        R.locks += st.wasLock ? 0 : 1; st.wasLock = true;
        if (G.gt >= st.lockAt){ mouse('mousedown', 0); mouse('mouseup', 0); st.lockAt = G.gt + S.lockRate * (0.8 + rnd() * 0.4); }
      } else if (boss && boss.state === 'lightning'){
        // his lightning: catch it on the guard (held, facing him) to turn it back, or eat it
        st.wasLock = false;
        if (st.light !== boss.lightningCd){ st.light = boss.lightningCd; st.lightGo = rnd() < S.catch; }
        if (st.lightGo && !st.rmb){ mouse('mousedown', 2); st.rmb = true; }
        if (!st.lightGo && st.rmb){ mouse('mouseup', 2); st.rmb = false; }
      } else {
        st.wasLock = false;
        // DEFENCE
        if (thr != null){
          const pl = tE.plan || { n: tE.swingsLeft || 0, side: (tE.cut || '-') }, key = (tE.isBoss ? 'B' : tE.group.uuid) + ':' + pl.n + ':' + pl.side + ':' + (tE.wuBase || tE.wu || 0).toFixed(3) + ':' + (pl.w0 ? 1 : 0) + ':' + (tE.isBoss ? Math.round(G.gt * 4) * 0 + tE.swingsLeft + tE.state : '');
          if (!st.plan || st.plan.key !== key){
            const thrust = pl.side === 'T' || !!(tE.dp && tE.dp.brace);   // (a held block can't stop either: parry it)
            const go = thrust || rnd() < S.parry;
            st.plan = { key, go, at: pwin * 0.5 + gauss() * S.sigma, bite: !!(pl.feint && rnd() < S.bite), clicked: false };
            if (go) R.parryTry++;
          }
          const P = st.plan;
          if (P.go){
            // a bitten feint: the click goes in at the fake's break point
            const wk = tE.state === 'windup' && tE.wuBase ? (tE.wu - tE.st) / (tE.wuBase || tE.wu) : 1;
            if (!P.clicked && ((P.bite && pl.feint && wk >= 0.62) || thr <= P.at)){
              if (st.rmb) mouse('mouseup', 2);
              mouse('mousedown', 2); st.rmb = true; P.clicked = true;
            }
          } else if (!st.rmb && thr <= S.react){ mouse('mousedown', 2); st.rmb = true; }
        } else if (st.rmb && !S.turtle && !(player.blockHeld && G.gt < (st.holdUntil || 0))){
          mouse('mouseup', 2); st.rmb = false; st.plan = null;
        }
        // OFFENCE — nothing about to land on us
        if (thr == null || thr > 0.7){
          const e = tgt;
          const open = e && (player.riposteT > 0 || isOpen(e) || (!e.isBoss && !e.dp));
          if (S.turtle && !open){ if (!st.rmb){ mouse('mousedown', 2); st.rmb = true; } if (td > 3.0) keys['w'] = true; }
          else if (e){
            if (st.rmb){ mouse('mouseup', 2); st.rmb = false; }
            const cost = sto.stamina * 1.4 + 14;
            if (td > 3.0) keys['w'] = true;   // close in
            else if (!st.lmbUp && player.stam > cost && (open || G.gt >= st.nextAtk || rnd() < S.mash * dt * 4)){
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
              const heavy = rnd() < S.heavy;
              mouse('mousedown', 0);
              if (heavy){ st.lmbUp = G.gt + 0.26; R.heavies++; } else mouse('mouseup', 0);
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
      const main = foes[0];
      const bState = boss ? boss.state : null, bSwings = boss ? boss.swingsLeft : 0, ringsUp = GAME.rings.length;
      const open0 = main && isLive(main) ? isOpen(main) : false, mhp0 = main ? main.hp : 0, phase0 = boss ? boss.phase : 0;
      if (bState) R.states[bState] = (R.states[bState] || 0) + dt;
      // a final boss (boss/finale.js): which of his moves is on, so the damage taken is split by move
      const fe = live.find(e => e.fin), fMove = fe ? (fe.fin.sig ? fe.fin.sig.id : 'blade') : null;
      if (fMove) R.states[fMove] = (R.states[fMove] || 0) + dt;
      player.hp = maxHp;
      const s0 = player.stam;
      frame(1000 * dt);
      R.frames++;
      const lost = maxHp - player.hp;
      if (lost > 0.01){
        R.dmg += lost; R.hits++;
        const src = fMove ? fMove : bState === 'lightning' ? 'lightning' : ringsUp ? 'nova' : (bState === 'windup' || bState === 'gapclose') ? 'melee' : boss ? 'adds' : 'melee';
        R.src[src] = (R.src[src] || 0) + lost;
      }
      if (player.stam < s0) R.stam += s0 - player.stam;
      if (main){
        const dealt = Math.max(0, mhp0 - (isLive(main) ? main.hp : 0));
        if (dealt > 0){ R.dealt[open0 ? 'open' : 'closed'] += dealt; R.idle = 0; } else { R.idle += dt; R.maxIdle = Math.max(R.maxIdle, R.idle); }
      }
      if (boss && isLive(boss)){
        if (bState === 'windup' && boss.state === 'vulnerable' && boss.st > GAME.BOSS_CFG.combo.whiffTime + 0.05) R.breaks++;
        if (bState === 'windup' && boss.state === 'windup' && boss.swingsLeft < bSwings && boss.st > GAME.BOSS_CFG.combo.windup * 0.75 && boss.st < GAME.BOSS_CFG.combo.windup * 0.9) R.deflects++;
        if (bState === 'lightning' && boss.state === 'stunned') R.reflects++;
        if (boss.phase !== phase0) R.phaseAt[boss.phase] = +(R.frames * dt).toFixed(1);
      }
      if (R.firstKill == null && foes.some(e => !isLive(e))) R.firstKill = R.frames * dt;
    }
    return null;
  }
  function finish(end){
    const { G, enemies, keys } = GAME;
    const { foes, R, stats0, dt } = F;
    clearKeys(keys); mouse('mouseup', 0); mouse('mouseup', 2);
    if (GAME.simWatch) GAME.simWatch.tell = null;
    const live = foes.filter(isLive);
    const hpLeft = foes.reduce((a, e) => a + (isLive(e) ? Math.max(0, e.hp) / e.maxHp : 0), 0) / Math.max(1, foes.length);
    R.parries = ((G.stats && G.stats.parries) || 0) - stats0.p;
    R.kills = foes.length - live.length;
    const rd = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(1)]));
    startPump();
    return { end, t: +(R.frames * dt).toFixed(2), dmg: +R.dmg.toFixed(1), hits: R.hits, stam: Math.round(R.stam), parries: R.parries, parryTry: R.parryTry,
             swings: R.swings, heavies: R.heavies, locks: R.locks, switches: R.switches, foeSwitch: R.foeSwitch, kills: R.kills, of: foes.length, hpLeft: +hpLeft.toFixed(3),
             firstKill: R.firstKill, foeForms: foes.map(e => e.ff), foeRank: foes.map(e => e.rank),
             dodgeTells: R.dodgeTells, dodges: R.dodges, src: rd(R.src), dealt: rd(R.dealt), states: rd(R.states), breaks: R.breaks, deflects: R.deflects, reflects: R.reflects, novaJumps: R.novaJumps,
             phaseAt: R.phaseAt, maxIdle: +R.maxIdle.toFixed(1) };
  }
  function fight(cfg){
    begin(cfg);
    let r = null;
    while (!(r = step(600))){}
    return r;
  }
  window.__duelSim = { fight, begin, step, frame, startPump, stopPump };
})();
