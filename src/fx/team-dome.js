// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE TEAM-UP DOME (game/teamup.js SHIELD DOME): a Force barrier thrown up over a group. Every enemy bolt that reaches it
// dies on it (enemies/bolts.js asks teamDomeStops for each one), on every screen, so whoever the bolt was flying at is
// covered. Only the renderer and the ink sparks, so the bolts can ask without a cycle.

import * as THREE from 'three';
import { scene } from '../engine/renderer.js';
import { sparks } from './ink.js';

const domes = [];

export function addTeamDome(x, z, R, life, color = 0x7fd0ff){
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  rim.rotation.x = -Math.PI / 2; rim.position.y = 0.05;
  m.add(rim);
  m.position.set(x, 0, z); m.scale.setScalar(0.01);
  scene.add(m);
  domes.push({ mesh: m, x, z, R, t: 0, life, flash: 0 });
}

// is this point inside a dome? (a hit makes the shell flare)
export function teamDomeStops(p){
  for (const d of domes) if (d.t < d.life && Math.hypot(p.x - d.x, p.z - d.z) < d.R && p.y < d.R + 0.3){ d.flash = 0.12; sparks(p, 0x9fe0ff, 4, 5, { life: 0.2 }); return true; }
  return false;
}

export function updateTeamDomes(dt, now){
  for (let i = domes.length - 1; i >= 0; i--){
    const d = domes[i]; d.t += dt;
    const grow = Math.min(1, d.t / 0.3), fade = Math.max(0, Math.min(1, (d.life - d.t) / 0.6));
    d.mesh.scale.setScalar(d.R * (1 - Math.pow(1 - grow, 3)));
    d.flash = Math.max(0, d.flash - dt);
    d.mesh.material.opacity = (0.16 + (d.flash > 0 ? 0.22 : 0) + Math.sin(now * 5) * 0.025) * fade;
    d.mesh.children[0].material.opacity = 0.6 * fade;
    if (d.t >= d.life){ scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); domes.splice(i, 1); }
  }
}

export function clearTeamDomes(){ for (const d of domes) scene.remove(d.mesh); domes.length = 0; }
export const teamDomeCount = () => domes.length;
