// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE GUNSHIP (the Marshal's Garrison, his duel): he isn't here to win. His gunship circles the yard and makes strafing
// runs while you fight him: a line of rings across the ground (through you), then the gunship comes in low along it and
// the bolts walk down the line. It doesn't care who's under it: lead the Marshal into a run and it hits him too. The
// first run comes down beside you, not through you.
//   first: seconds after he's in before the first run · every: seconds between (rage: rageEvery) · shots: bolts in a run
//   gap: metres between them · r, dmg, foeDmg: each bolt's · line: { … }
import * as THREE from 'three';
import { TW, ev, defineEvent, prop, line, pickHero } from './kit.js';
import { V3, rand } from '../../utils.js';
import { showBanner } from '../../ui/banners.js';
import { burst } from '../../fx/particles.js';
import { sfx } from '../../audio/sfx.js';

const SPEED = 34, LEAD = 1.7;   // the gunship's speed along its run, and when its first bolt lands
function shipMesh(){
  const g = new THREE.Group(), hull = new THREE.MeshStandardMaterial({ color: 0x5a5e66, roughness: 0.5, metalness: 0.6 }), dark = new THREE.MeshStandardMaterial({ color: 0x24282e, roughness: 0.6, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 7.5), hull); g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.6, 6), hull); nose.rotation.x = Math.PI / 2; nose.position.z = 5; g.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 2.4), dark); wing.position.set(0, 0.3, -0.5); g.add(wing);
  for (const s of [-1, 1]){
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.6, 8), dark); pod.rotation.x = Math.PI / 2; pod.position.set(s * 4.6, 0.3, -0.6); g.add(pod);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10), new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false })); glow.position.set(s * 4.6, 0.3, -1.95); glow.rotation.y = Math.PI; g.add(glow);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// p: { x, z, dx, dz } the run's start and heading: the gunship flies it, low, and is gone
defineEvent('flyby', {
  late: () => 4,
  start(e){ const m = prop(shipMesh()); e.meshes.push(m); m.visible = false; sfx(60, 3, 'sawtooth', 0.05, 110); },
  update(e, dt){
    const p = e.p, s = (e.age - LEAD) * SPEED, m = e.meshes[0];
    if (s > 110) return false;
    m.visible = s > -70;
    m.position.set(p.x + p.dx * s, 12 - Math.max(0, -s) * 0.06, p.z + p.dz * s);
    m.rotation.set(0, Math.atan2(p.dx, p.dz), Math.sin(e.age * 2) * 0.08);
    if (m.visible && Math.random() < dt * 30) burst(V3(m.position.x - p.dx * 4, m.position.y, m.position.z - p.dz * 4), 0xffa040, 1, 2, 0, 0.6);
    return true;
  },
});
export default {
  mood: { fill: 0.92, fog: 0x3a3a46 },
  begin(){ TW.s = { next: -1, n: 0 }; },
  update(tw, dt, ctx){
    const S = TW.s, foe = ctx.foe && ctx.foe();
    TW.k = foe ? Math.min(1, TW.k + dt * 0.3) : TW.k;
    if (ctx.guest || !foe) return;
    if (S.next < 0) S.next = tw.first ?? 6;
    if ((S.next -= dt) > 0) return;
    const raged = foe.hp <= foe.maxHp * ((TW.o && TW.o.rage) || 0.5);
    S.next = (raged ? (tw.rageEvery ?? 8) : (tw.every ?? 11)) * rand(0.9, 1.1);
    // the run: a line across the yard through a hero (the first one alongside, not through)
    const h = pickHero(), a = rand(0, Math.PI * 2), dx = Math.cos(a), dz = Math.sin(a);
    const side = S.n ? rand(-1.2, 1.2) : 6, n = tw.shots ?? 7, gap = tw.gap ?? 4.6;
    const x0 = h.pos.x - dx * gap * (n / 2) + -dz * side, z0 = h.pos.z - dz * gap * (n / 2) + dx * side;
    for (let i = 0; i < n; i++){
      ev('blast', { x: x0 + dx * gap * i + rand(-0.6, 0.6), z: z0 + dz * gap * i + rand(-0.6, 0.6), r: tw.r ?? 2.5, fuse: LEAD + i * gap / SPEED,
                    dmg: tw.dmg ?? 16, foe: tw.foeDmg ?? 45, col: 0xffa040 });
    }
    ev('flyby', { x: x0, z: z0, dx, dz });
    if (!S.n++) showBanner('GUNSHIP', line(tw), 3.6, { kicker: 'STRAFING RUN' });
  },
};
