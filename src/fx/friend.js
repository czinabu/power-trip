// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// FRIEND MARKS: what tells a friendly (a squadmate, an escort) from a foe at a glance when both wear white armour on
// snow. Same ink language as the rest: one team colour (ally blue, never a foe's red-orange), a near-black outline,
// no soft gradients. A ground ring under the feet that reads from any camera, and a bigger diamond over the head.
import * as THREE from 'three';

export const ALLY_COLOR = 0x3fb8ff, ALLY_DOWN = 0xff5a4a;
const INK = 0x07060a;
// shared by every friend: one geometry and material each
/* (art pass: thinner than it was, and it fades out close to the lens. A squad stacked up right in front of the camera
   used to put three or four fat cyan rings across the bottom third of the screen; the ring is for picking a friend out
   at a distance, and up close their diamond and the hero's own eyes already do that) */
const ringGeo = new THREE.RingGeometry(0.86, 1.0, 40), inkGeo = new THREE.RingGeometry(0.8, 1.06, 40);
export const RING_FADE = { near: 3.5, far: 8 };   // m from the lens: gone nearer than near, whole past far
function fadeNear(m){
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'varying float vRingD;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vRingD = -mvPosition.z;');
    sh.fragmentShader = 'varying float vRingD;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
      `diffuseColor.a *= smoothstep(${RING_FADE.near.toFixed(2)}, ${RING_FADE.far.toFixed(2)}, vRingD);\n  #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'friend-ring-fade';
  return m;
}
const ringMat = fadeNear(new THREE.MeshBasicMaterial({ color: ALLY_COLOR, toneMapped: false, transparent: true, opacity: 0.9,
  side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
const downMat = ringMat.clone(); downMat.color.setHex(ALLY_DOWN); downMat.opacity = 0.95;   // (a downed friend's ring stays whole up close: it says who to pick up)
const inkMat = fadeNear(new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
const tagGeo = new THREE.OctahedronGeometry(0.15, 0), tagInkGeo = new THREE.OctahedronGeometry(0.15, 0);
const tagInkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, depthTest: false, transparent: true });

// the ring under a friend: a child of its group, so it goes where they go. Lies flat whatever the group's tilt
export function addFriendRing(g){
  const ring = new THREE.Mesh(ringGeo, ringMat), ink = new THREE.Mesh(inkGeo, inkMat);
  ring.rotation.x = ink.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06; ink.position.y = 0.055;
  ring.renderOrder = 3; ink.renderOrder = 2;
  g.add(ink, ring); g.userData.friendRing = ring;
  return ring;
}
// each frame: red while down, and stay flat when the body is laid out
export function updateFriendRing(g, down){
  const r = g.userData.friendRing; if (!r) return;
  r.material = down ? downMat : ringMat;
  r.rotation.x = -Math.PI / 2 - g.rotation.x;
}
// the head diamond: bigger than before, ink-rimmed, one colour for both heroes (shown through walls)
export function makeFriendTag(size = 1){
  const tag = new THREE.Mesh(tagGeo, new THREE.MeshBasicMaterial({ color: ALLY_COLOR, toneMapped: false, depthTest: false, transparent: true }));
  const rim = new THREE.Mesh(tagInkGeo, tagInkMat);
  rim.scale.setScalar(1.25); rim.renderOrder = 997; tag.add(rim);
  tag.scale.setScalar(size); tag.renderOrder = 998;
  return tag;
}
