// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// A HUB GUIDE'S PORTRAIT (ui/hub-ui.js puts it on the welcome card beside their line): the guide's own figure from the
// cast (game/cast.js castPreview: Master Vael, the Armorer, Sgt. Vant), head and shoulders, drawn once on a small
// renderer of its own, kept as an image, and the renderer let go. Any guide the cast knows gets one; one it doesn't,
// or a browser that can't draw it, gets none and the card simply goes without.

import * as THREE from 'three';
import { castPreview } from '../game/cast.js';

const SIZE = 160;   // px, square (drawn at twice the size the card shows it)
const cache = new Map();
export function guidePortrait(name){
  if (cache.has(name)) return cache.get(name);
  let url = null;
  try { url = draw(name); } catch(e){ url = null; }
  cache.set(name, url);
  return url;
}

function draw(name){
  const g = castPreview(name); if (!g) return null;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
  const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  try {
    R.setSize(SIZE, SIZE, false);
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
    const S = new THREE.Scene();
    S.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2018, 1.0));
    const key = new THREE.DirectionalLight(0xfff2e0, 2.2); key.position.set(2.5, 4, 5); S.add(key);
    const rim = new THREE.DirectionalLight(0x9fc8ff, 1.4); rim.position.set(-4, 3, -4); S.add(rim);
    S.add(g); g.updateMatrixWorld(true);
    // the head: the top of the figure, measured from its meshes as it stands
    const box = new THREE.Box3();
    g.traverse(o => { if (o.isMesh && o.visible && o.geometry){ if (o.isSkinnedMesh){ o.skeleton.update(); o.computeBoundingBox(); } else if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const b = (o.isSkinnedMesh ? o.boundingBox : o.geometry.boundingBox).clone().applyMatrix4(o.matrixWorld); if (b.max.y < 4) box.union(b); } });
    const top = box.isEmpty() ? 1.8 : box.max.y, at = top - 0.24;
    const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 30);
    cam.position.set(0.3, at + 0.04, 1.35); cam.lookAt(0, at - 0.03, 0);
    g.rotation.y = 0.18;   // (a touch turned toward the light)
    R.render(S, cam);
    return canvas.toDataURL('image/png');
  } finally {
    R.dispose(); try { R.forceContextLoss(); } catch(e){}
  }
}
