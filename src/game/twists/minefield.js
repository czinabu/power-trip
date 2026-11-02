// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE MINEFIELD (the Extraction's first leg): the flank is mined. The slicer droid finds them as it walks: every few
// seconds it pings, and each mine within reach of the ping lights up red and stays lit. Stay on its track and you're
// safe. Run on ahead of it and you're walking on mines nobody has found. Anything that steps on one sets it off a beat
// later (you, or a foe charging the droid), so lure them across the lit ones.
//   mines: [[x, z]…] · see: how near the droid has to be to find one · trip: how near sets one off · r: its blast ·
//   dmg, foeDmg · line: { jedi, mando } the banner's line when the first is found
import * as THREE from 'three';
import { TW, ev, prop, line, heroes, warnRing } from './kit.js';
import { G, enemies } from '../../state.js';
import { V3 } from '../../utils.js';
import { showBanner } from '../../ui/banners.js';
import { floater } from '../../fx/floaters.js';
import { sfx } from '../../audio/sfx.js';

function mineMesh(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0x3a3c36, roughness: 0.7, metalness: 0.5 }));
  body.position.y = 0.08; g.add(body);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }));
  lamp.position.y = 0.2; g.add(lamp);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 24), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.05; g.add(halo);
  g.userData.lamp = lamp; g.userData.halo = halo;
  return g;
}
export default {
  begin(tw){
    TW.s = { pingT: 1.2, said: false, m: tw.mines.map(([x, z]) => { const g = prop(mineMesh()); g.position.set(x, 0, z); g.visible = false; return { x, z, g, seen: false, live: true }; }) };
  },
  update(tw, dt, ctx){
    const S = TW.s, v = ctx.vip && ctx.vip.g.position;
    // the found ones blink; the rest lie hidden
    for (const m of S.m){
      m.g.visible = m.live && m.seen;
      if (!m.g.visible) continue;
      const on = Math.sin(G.gt * 7 + m.x) > 0;
      m.g.userData.lamp.visible = on;
      m.g.userData.halo.material.opacity = on ? 0.7 : 0.25;
    }
    if (ctx.guest || !v) return;
    // the droid's ping: a ring out from it, and whatever it reaches is found
    if ((S.pingT -= dt) <= 0){
      S.pingT = 2.2;
      warnRing(v.x, v.z, 0x5ad2ff, tw.see ?? 9);
      let found = 0;
      for (const m of S.m) if (m.live && !m.seen && Math.hypot(m.x - v.x, m.z - v.z) < (tw.see ?? 9)){ m.seen = true; found++; floater(V3(m.x, 0.9, m.z), 'MINE', '#ff6a5a'); }
      if (found){
        sfx(1250, 0.08, 'square', 0.03, 1250); sfx(1250, 0.08, 'square', 0.03, 1250);
        if (!S.said){ S.said = true; showBanner('MINEFIELD', line(tw), 4.2, { kicker: 'WARNING' }); }
      }
    }
    // anything that steps on one: a click, a beat, and it goes (heroes on foot, foes that aren't flying)
    const trip = tw.trip ?? 1.3;
    for (const m of S.m){
      if (!m.live) continue;
      let hit = heroes().some(h => h.pos.y < 0.6 && Math.hypot(h.pos.x - m.x, h.pos.z - m.z) < trip);
      if (!hit) for (const e of enemies){ if (e.dead || e.converted || e.t.fly || e.group.position.y > 0.6) continue; if (Math.hypot(e.group.position.x - m.x, e.group.position.z - m.z) < trip + 0.2){ hit = true; break; } }
      if (!hit) continue;
      m.live = false; m.seen = true;
      sfx(1800, 0.06, 'square', 0.04, 1800);
      ev('blast', { x: m.x, z: m.z, r: tw.r ?? 3.2, fuse: 0.55, dmg: tw.dmg ?? 24, foe: tw.foeDmg ?? 80, col: 0xff2a1a });
    }
  },
  // 0 hidden, 1 found, 2 gone (one digit each)
  snap(){ return TW.s.m.map(m => m.live ? (m.seen ? 1 : 0) : 2).join(''); },
  sync(tw, w){ TW.s.m.forEach((m, i) => { const c = w[i]; m.seen = c !== '0'; m.live = c !== '2'; }); },
};
