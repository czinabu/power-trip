// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE STANDARD (Spearhead's gate): an officer carries their war standard up to the line and plants it. While it flies,
// every foe near it is rallied (they shrug off half of what you hit them with) and the ground round it glows their red.
// Cut the bearer down and the standard falls: the foes round it waver for a moment, open to anything. A new bearer takes
// it up a while later. The first one is planted where you can see it go up, before the gate's fight gets thick.
//   first: seconds into the hold the first bearer comes · every: seconds after one falls before the next · at: [dx, dz]
//   from the zone where it plants · r: the rally's reach · ward: × the damage a rallied foe takes · guards: { type: n }
//   who walk up with it · line: { jedi, mando }
import * as THREE from 'three';
import { TW, prop, line, ringMesh, discMesh, foesIn } from './kit.js';
import { G, enemies } from '../../state.js';
import { V3, rand } from '../../utils.js';
import { spawnEnemy } from '../../enemies/spawn.js';
import { findClearSpawn } from '../../world/collision.js';
import { showBanner } from '../../ui/banners.js';
import { floater } from '../../fx/floaters.js';
import { burst } from '../../fx/particles.js';
import { sfx, S as SFX } from '../../audio/sfx.js';

function flagMesh(){
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.2, 6), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.6, roughness: 0.5 }));
  pole.position.y = 2.1; g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, 6, 1), new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.8, side: THREE.DoubleSide }));
  flag.position.set(0.82, 3.6, 0); g.add(flag);
  const mark = new THREE.Mesh(new THREE.CircleGeometry(0.26, 6), new THREE.MeshBasicMaterial({ color: 0xd8d0c0, side: THREE.DoubleSide }));
  mark.position.set(0.82, 3.6, 0.01); g.add(mark);
  g.userData.flag = flag; g.userData.mark = mark;
  return g;
}
export default {
  mood: { fill: 0.95, fog: 0x6a3a2a },
  begin(){ TW.s = { next: -1, e: null, n: 0, up: 0, x: 0, z: 0, flag: null, aura: null, glow: null, rallied: new Set() }; },
  update(tw, dt, ctx){
    const S = TW.s, r = tw.r ?? 11;
    if (!S.flag){ S.flag = prop(flagMesh()); S.aura = prop(ringMesh(0xff3a2a, 0.04, 0.7)); S.glow = prop(discMesh(0xff3a2a, 0.08)); }
    // the standard where it stands (the bearer's back, or the host's word of it), its field of red round it
    const up = ctx.guest ? S.up : (S.e && !S.e.dead && enemies.includes(S.e) ? 1 : 0);
    if (!ctx.guest && S.e && up){ S.x = S.e.group.position.x; S.z = S.e.group.position.z; }
    S.flag.visible = S.aura.visible = S.glow.visible = !!up;
    if (up){
      S.flag.position.x += (S.x - S.flag.position.x) * Math.min(1, dt * 10); S.flag.position.z += (S.z - S.flag.position.z) * Math.min(1, dt * 10);
      S.flag.position.y = 0; S.flag.rotation.y = Math.sin(G.gt * 0.7) * 0.6;
      S.flag.userData.flag.rotation.y = Math.sin(G.gt * 5) * 0.25;
      S.aura.position.set(S.flag.position.x, 0.1, S.flag.position.z); S.aura.scale.setScalar(r);
      S.glow.position.set(S.flag.position.x, 0.08, S.flag.position.z); S.glow.scale.setScalar(r);
      S.aura.material.opacity = 0.45 + 0.25 * Math.sin(G.gt * 3);
    }
    TW.k = up ? Math.min(1, TW.k + dt) : Math.max(0, TW.k - dt * 0.5);
    if (ctx.guest) return;
    S.up = up;
    if (S.next < 0) S.next = tw.first ?? 7;
    if (up){
      // rally: the foes near it take less from every blow (enemies/damage.js reads e.ward)
      const now = new Set();
      foesIn(S.x, S.z, r, (f) => { now.add(f); f.ward = tw.ward ?? 0.5; if (!S.rallied.has(f) && f !== S.e && Math.random() < 0.3) floater(V3(f.group.position.x, 2.3, f.group.position.z), 'RALLIED', '#ff8a7a'); });
      for (const f of S.rallied) if (!now.has(f)) f.ward = null;
      S.rallied = now;
      return;
    }
    if (S.e){
      // the bearer is down: the standard falls, and the foes round it waver
      const x = S.x, z = S.z;
      for (const f of S.rallied) f.ward = null;
      S.rallied = new Set();
      foesIn(x, z, r * 1.5, (f) => { f.stunT = Math.max(f.stunT || 0, 1.8); f.openUntil = G.gt + 1.8; floater(V3(f.group.position.x, 2.3, f.group.position.z), 'WAVERING', '#ffe27a'); });
      burst(V3(x, 2.5, z), 0x8a1a1a, 18, 5, 4, 1.0); SFX.reward(1);
      showBanner('THEIR STANDARD FALLS', 'They waver. Hit them now.', 2.2);
      S.e = null; S.next = tw.every ?? 24;
      return;
    }
    if ((S.next -= dt) > 0) return;
    // a bearer walks it up to the line, with an escort, and plants it
    const zone = ctx.o.at, [dx, dz] = tw.at || [0, -15];
    const c = findClearSpawn(zone[0] + dx + rand(-5, 5), zone[1] + dz + rand(-2, 2), 1.2);
    spawnEnemy('officer', V3(c.x, 0, c.z));
    const e = enemies[enemies.length - 1];
    e.hp = e.maxHp = Math.round(e.maxHp * 1.8);
    e.goal = { pos: V3(c.x, 0, c.z), aggro: 5 };   // it holds its ground unless you come for it
    S.e = e; S.x = c.x; S.z = c.z;
    for (const t in (tw.guards || { phalanx: 1, grunt: 1 })) for (let i = 0; i < (tw.guards || { phalanx: 1, grunt: 1 })[t]; i++){
      const g = findClearSpawn(c.x + rand(-3, 3), c.z + rand(1, 3) * Math.sign(-dz || 1), 1.0);
      spawnEnemy(t, V3(g.x, 0, g.z));
    }
    sfx(196, 0.5, 'square', 0.04, 220); sfx(262, 0.6, 'square', 0.03, 262);
    if (!S.n++) showBanner('THEIR STANDARD', line(tw), 3.8, { kicker: 'RALLY' });
    else showBanner('', 'THE STANDARD GOES UP AGAIN', 1.8);
  },
  target(){ const S = TW.s; return S.up ? V3(S.x, 0, S.z) : null; },
  done(){ for (const f of TW.s.rallied || []) f.ward = null; },
  end(){ for (const f of TW.s.rallied || []) f.ward = null; },
  snap(){ const S = TW.s; return [S.up, Math.round(S.x * 10) / 10, Math.round(S.z * 10) / 10]; },
  sync(tw, w){ const S = TW.s; S.up = w[0]; S.x = w[1]; S.z = w[2]; },
};
