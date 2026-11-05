// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* LIGHTSABER BLADE LOOK — shared by every blade in the game (the hero's saber, the staff's far blade, Jar'Kai's off
   saber, the thrown sabers, a foe's, an ally's, the boss's, a co-op partner's).

   A blade is two meshes: a CORE (a solid near-white rod, BLADE.core × the old radius) and a GLOW sleeve around it in
   the blade's colour. The sleeve used to be a flat-shaded see-through tube, so it read as a pale cylinder with hard
   edges. Now it is drawn with BladeGlowMaterial: still an additive MeshBasicMaterial (so every `.color.setHex(...)` and
   `.opacity` the game already does keeps working), but its alpha falls off from the middle of the beam to nothing at
   its silhouette, in two parts: a bright tight fringe hugging the core (the saturated edge in the films) and a broad soft
   halo (the haze the bloom then spreads). One draw per blade, as before: the falloff is a couple of lines in the shader.
   The sleeve is wider than it was (BLADE.glow × the old radius) because the outer part of it now fades to nothing. */
import * as THREE from 'three';

export const BLADE = {
  core: 1.45,    // × each blade's old core radius: a thicker white beam
  glow: 1.65,    // × each blade's old glow radius: the sleeve the falloff below fades out over
  opacity: 1.8,  // × each blade's old glow opacity (the falloff takes most of it away towards the edge)
  fringe: 0.8,   // how much of the glow is the tight bright edge round the core (the rest is the soft halo)
  tight: 2.0,    // how tightly that edge hugs the core (a power on the beam's facing)
  soft: 1.8,     // how soft the outer halo is
  sat: 2.0,      // how much purer the glow's hue is than the blade colour (1 = as is)
  gain: 1.1,     // how hot the glow burns (kept near 1: brighter, the tone map bleaches the colour out)
  coreLevel: 0.75, // the core's own grey: the glow adds its colour on top, so the beam burns white tinted by its colour
                 // (as in the films) and the bloom off it comes out coloured, not a white haze
  segs: 12,      // round segments on the glow sleeve (it is smooth-shaded now, so a few more than the old 8)
};

export const BLADE_CORE = new THREE.Color(BLADE.coreLevel, BLADE.coreLevel, BLADE.coreLevel).getHex();

// the falloff's live uniforms, shared by every blade's glow (one set: one program, retunable from the console)
export const BLADE_U = {
  uFringe: { value: BLADE.fringe }, uTight: { value: BLADE.tight }, uSoft: { value: BLADE.soft },
  uSat: { value: BLADE.sat }, uGain: { value: BLADE.gain },
};

export class BladeGlowMaterial extends THREE.MeshBasicMaterial {
  constructor(params = {}){
    super({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, ...params });
    this.isBladeGlow = true;
  }
  onBeforeCompile(sh){
    Object.assign(sh.uniforms, BLADE_U);   // shared: retuning BLADE_U at run time retunes every blade at once
    sh.vertexShader = 'varying vec3 vBladeN;\nvarying vec3 vBladeV;\n' + sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n  vBladeN = normalize(normalMatrix * normal);\n  vBladeV = -mvPosition.xyz;');
    sh.fragmentShader = 'uniform float uFringe;\nuniform float uTight;\nuniform float uSoft;\nuniform float uSat;\nuniform float uGain;\nvarying vec3 vBladeN;\nvarying vec3 vBladeV;\n'
      + sh.fragmentShader.replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
  {
    float ndv = abs(dot(normalize(vBladeN), normalize(vBladeV)));
    diffuseColor.a *= uFringe * pow(ndv, uTight) + (1.0 - uFringe) * pow(ndv, uSoft);
    // a deeper, purer hue than the blade colour itself, so the colour still reads against the white core and a bright floor
    vec3 c = diffuseColor.rgb;
    float m = max(max(c.r, c.g), max(c.b, 1e-3));
    diffuseColor.rgb = pow(c / m, vec3(uSat)) * m * uGain;
    // premultiplied (the blend is additive, so the sum is the same): an opacity over 1 then just burns brighter
    diffuseColor.rgb *= diffuseColor.a; diffuseColor.a = 1.0;
  }`);
  }
  customProgramCacheKey(){ return 'bladeGlow'; }
}

// a blade's two geometries, scaled from the radii it was built with (rTop/rBot are the old ones)
export const bladeCoreGeo = (rTop, rBot, len) => new THREE.CylinderGeometry(rTop * BLADE.core, rBot * BLADE.core, len, 10);
export const bladeGlowGeo = (rTop, rBot, len) => new THREE.CylinderGeometry(rTop * BLADE.glow, rBot * BLADE.glow, len, BLADE.segs);
// (opacity may run over 1 here: it is a brightness, see the shader)
export const bladeGlowMat = (color, opacity) => new BladeGlowMaterial({ color, opacity: opacity * BLADE.opacity });
