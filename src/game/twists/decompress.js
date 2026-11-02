// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HULL BREACH (What the Chip Says, the HALCYON adrift): the frigate is coming apart around the records core. Now and
// then a seam in a side wall gives: a hiss and a red strobe for a moment, then the air goes out through it for a few
// seconds and drags everything loose toward the hole. Foes it pulls all the way are gone into space; you can fight it
// (run against it, or get off the floor), and the core in the middle of the deck is just out of its reach. Then the
// emergency field seals it. The first opens on the far side from you.
//   spots: [[x, z]…] where the hull can go (the side walls) · first, every: seconds · warn: seconds of warning ·
//   open: seconds it pulls · reach: how far it pulls from (m) · pull: m/s it drags a hero at the hole (foes harder) ·
//   line: { … } the first one's banner line
import { TW, ev, defineEvent, prop, line, ringMesh, heroes, hurtMe, foesIn } from './kit.js';
import { G, player } from '../../state.js';
import { V3, rand } from '../../utils.js';
import { playerPos } from '../../player/helpers.js';
import { collideSolids } from '../../world/collision.js';
import { damageEnemy } from '../../enemies/damage.js';
import { showBanner } from '../../ui/banners.js';
import { floater } from '../../fx/floaters.js';
import { burst } from '../../fx/particles.js';
import { sparks, groundRing } from '../../fx/ink.js';
import { sfx } from '../../audio/sfx.js';
import { gust } from '../../audio/director.js';

// p: { x, z, warn, open, reach, pull }
defineEvent('breach', {
  late: (p) => p.warn + p.open - 0.5,
  start(e){
    const m = prop(ringMesh(0xff3a2a, 0.12, 0.9)); m.position.set(e.p.x, 0.1, e.p.z); m.scale.setScalar(2.4);
    e.meshes.push(m);
    sfx(2400, e.p.warn, 'sawtooth', 0.015, 1800);
  },
  update(e, dt){
    const p = e.p, m = e.meshes[0];
    if (e.age < p.warn){   // the seam going: sparks and a strobe
      m.material.opacity = Math.sin(e.age * 20) > 0 ? 0.95 : 0.2;
      if (Math.random() < dt * 20) sparks(V3(p.x, rand(0.5, 3), p.z), 0xffd06a, 2, 8, { life: 0.3, size: 0.3 });
      return true;
    }
    const u = e.age - p.warn;
    if (u > p.open){   // the field seals it
      groundRing(V3(p.x, 0, p.z), 0x6ad2ff, 4, 0.5, 1); sfx(600, 0.3, 'triangle', 0.04, 900);
      return false;
    }
    if (!e.told){ e.told = true; G.shake = Math.max(G.shake, 0.6); sfx(80, p.open, 'sawtooth', 0.05, 40); gust('wind'); }
    m.material.opacity = 0.6;
    // the air streaming out: dust and debris pulled across the deck into the hole
    for (let i = 0; i < 3; i++){
      const a = rand(0, Math.PI * 2), r = rand(3, p.reach), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (Math.random() < 0.5) sparks(V3(x, rand(0.2, 2.2), z), 0xc8d0d8, 1, 9 + 10 * (1 - r / p.reach), { dir: V3(p.x - x, 0, p.z - z).normalize(), cone: 0.05, life: 0.4, grav: 0, stretch: 8, size: 0.25 });
    }
    // dragged toward it: you (run against it, or get off the floor) and, on the host, the foes
    const pp = playerPos(), dx = p.x - pp.x, dz = p.z - pp.z, d = Math.hypot(dx, dz) || 1;
    if (d < p.reach && player.hp > 0 && !(player.dashT > 0)){
      const k = (1 - d / p.reach) ** 0.7 * (player.grounded ? 1 : 0.45);
      pp.x += dx / d * p.pull * k * dt; pp.z += dz / d * p.pull * k * dt;
      if (d < 2.6) hurtMe(18 * dt, p.x, p.z, { silent: true });
    }
    foesIn(p.x, p.z, p.reach, (f, fp) => {
      if (f.champion) return;
      const fx = p.x - fp.x, fz = p.z - fp.z, fd = Math.hypot(fx, fz) || 1, k = (1 - fd / p.reach) ** 0.6;
      fp.x += fx / fd * p.pull * 1.5 * k * dt; fp.z += fz / fd * p.pull * 1.5 * k * dt;
      collideSolids(fp, 0.4, false);
      if (fd < 2.2){   // out through the hole
        burst(V3(fp.x, 1.2, fp.z), 0xc8d0d8, 12, 8, 3, 0.8);
        floater(V3(fp.x, 2.2, fp.z), 'SPACED', '#bfe8ff');
        damageEnemy(f, f.hp + 1, V3(fx, 0, fz).normalize(), 2, true);
      }
    });
    return true;
  },
});

export default {
  mood: { fill: 0.9, rim: 1.1, fog: 0x1a2028 },
  begin(tw){ TW.s = { next: tw.first ?? 7, n: 0, last: -1 }; },
  update(tw, dt, ctx){
    TW.k = Math.min(1, TW.k + dt * 0.2);
    if (ctx.guest) return;
    const S = TW.s;
    if ((S.next -= dt) > 0) return;
    S.next = (tw.every ?? 15) * rand(0.85, 1.15);
    // the first: the far side from you, where you can watch it pull; then anywhere but the last
    const hs = heroes(), h = hs[0] || { pos: playerPos() };
    let i;
    if (!S.n) i = tw.spots.reduce((b, s, k) => Math.hypot(s[0] - h.pos.x, s[1] - h.pos.z) > Math.hypot(tw.spots[b][0] - h.pos.x, tw.spots[b][1] - h.pos.z) ? k : b, 0);
    else { do i = Math.floor(Math.random() * tw.spots.length); while (i === S.last && tw.spots.length > 1); }
    S.last = i;
    const [x, z] = tw.spots[i];
    ev('breach', { x, z, warn: tw.warn ?? 1.4, open: tw.open ?? 5, reach: tw.reach ?? 17, pull: tw.pull ?? 5.5 });
    if (!S.n++) showBanner('HULL BREACH', line(tw), 4, { kicker: 'WARNING' });
    else floater(V3(x * 0.8, 2.5, z), 'HULL BREACH', '#ff6a5a');
  },
};
