// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE ZONE MAP'S ART: an open zone's streets drawn once as a flat, inked plan (a canvas, north up), which the corner
// minimap and the full map both cut from (ui/zone-map.js). Nothing here is per zone: it reads the zone's PLAN
// (world/zones/<zone>-plan.js, every piece as plain data) and draws each piece's FOOTPRINT from its solids, the same
// collision the streets are built on (world/zones/zone-kit.js KINDS), so a new zone, or a new kind of piece, maps itself.
//
//   · the ground is the street: open sand where you can walk, every solid on it a block of roof, shaded by how tall it
//     stands (a low step barely shows, a tower reads dark), ringed in ink like the models;
//   · a few kinds paint the ground under them as well (the cistern's water, the landing pad, the garrison's yard), from
//     MAP_GROUND below;
//   · the full map adds the districts' borders (opts.districts).
// Colours come from the zone's world palette (data/worlds.js ZONE_WORLDS · pal) where it has one.

import { KINDS } from '../world/zones/zone-kit.js';
import { ZONE_WORLDS } from '../data/worlds.js';

export const MAP_ART = {
  ppm: 4,          // canvas pixels per metre
  margin: 10,      // m of ground drawn round the zone's square
  skipOver: 2,     // a solid that starts this high (an awning, a dome's drum) is overhead, not a footprint
};

const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
const mix = (a, b, t) => { const A = [a >> 16 & 255, a >> 8 & 255, a & 255], B = [b >> 16 & 255, b >> 8 & 255, b & 255];
  return (A.map((v, i) => Math.round(v + (B[i] - v) * t)).reduce((s, v) => (s << 8) | v, 0)) >>> 0; };

// the ground a kind of piece paints under itself (drawn before any footprint)
const MAP_GROUND = {
  cistern: (c, p, C) => { rect(c, p.x0 + 3, p.z0 + 3, p.x1 - 3, p.z1 - 3, C.water, C.ink, 1.5); },
  garrison: (c, p, C) => { rect(c, p.x0, p.z0, p.x1, p.z1, C.yard, null); },
  pad: (c, p, C) => { circle(c, p.x, p.z, p.r, C.pad, C.ink, 1.5); circle(c, p.x, p.z, p.r * 0.55, null, C.padRing, 2); },
  rails: (c, p, C) => { c.strokeStyle = C.ink; c.lineWidth = 1.5; c.setLineDash([4, 3]); c.beginPath();
    if (p.alongX){ c.moveTo(p.x - p.len / 2, p.z); c.lineTo(p.x + p.len / 2, p.z); } else { c.moveTo(p.x, p.z - p.len / 2); c.lineTo(p.x, p.z + p.len / 2); }
    c.stroke(); c.setLineDash([]); },
  fountain: (c, p, C) => { circle(c, p.x, p.z, p.r * 0.7, C.water, null); },
};

// the canvas works in metres: everything below draws with world x / z (inkPpm: the canvas pixels per metre being drawn at)
let inkPpm = MAP_ART.ppm;
function rect(c, x0, z0, x1, z1, fill, ink, w = 1){ c.beginPath(); c.rect(x0, z0, x1 - x0, z1 - z0); paint(c, fill, ink, w); }
function circle(c, x, z, r, fill, ink, w = 1){ c.beginPath(); c.arc(x, z, r, 0, Math.PI * 2); paint(c, fill, ink, w); }
function paint(c, fill, ink, w){
  if (fill){ c.fillStyle = fill; c.fill(); }
  if (ink){ c.strokeStyle = ink; c.lineWidth = w / inkPpm * 1.2; c.stroke(); }
}

function colours(Z){ const W = ZONE_WORLDS[Z.level.layout] || {}; return mapColours(W.pal || {}, W.outer ?? 0xb08a5e); }
/* the map's inks from a world palette (data/worlds.js pal: stone, roof, rock, water…) and the ground past its edge; the
   area maps (ui/area-map-art.js) colour a mission's or a hub's room with it too */
export function mapColours(pal, ground){
  const stone = pal.stone ?? 0xc29c6e, roof = pal.roof ?? 0x9c5e3a;
  return {
    ink: '#24170d', outside: hex(mix(ground, 0x000000, 0.42)),
    ground: hex(mix(stone, 0xfff4dc, 0.38)),           // the streets: the palest thing on the map
    low: hex(mix(stone, 0xfff4dc, 0.12)),              // a step, a stall, a crate
    mid: hex(mix(stone, roof, 0.3)), high: hex(mix(stone, roof, 0.7)), top: hex(mix(roof, 0x000000, 0.3)),
    rock: hex(pal.rock ?? 0xa07850), water: hex(mix(pal.water ?? 0x3a7a8a, 0x8ad8ff, 0.25)),
    yard: hex(mix(pal.impD ?? 0x5a606a, 0xfff4dc, 0.55)), pad: hex(mix(pal.metal ?? 0x6a6e74, 0xfff4dc, 0.35)), padRing: hex(pal.gold ?? 0xd8b46a),
    border: 'rgba(36,23,13,.5)',
  };
}
const shade = (C, h) => h <= 1.25 ? C.low : h <= 4 ? C.mid : h <= 9 ? C.high : C.top;

/* every footprint in `foot` (solids: world/collision.js shapes), lowest first, so a tower stands over the step at its
   foot. The canvas works in world metres */
export function inkFootprints(c, foot, C, ppm = MAP_ART.ppm){
  inkPpm = ppm;
  foot.sort((a, b) => (a.h || 0) - (b.h || 0));
  for (const s of foot){
    const h = s.h || 0;
    if (s.mound){ c.beginPath(); c.ellipse(s.x, s.z, s.a, s.b, Math.atan2(s.sin || 0, s.cos ?? 1), 0, Math.PI * 2); paint(c, C.rock, C.ink, 1.2); continue; }
    const fill = shade(C, h), w = h <= 1.25 ? 0.8 : 1.6;
    if (s.box) rect(c, s.x - s.hx, s.z - s.hz, s.x + s.hx, s.z + s.hz, fill, C.ink, w);
    else if (s.r) circle(c, s.x, s.z, s.r, fill, C.ink, w);
  }
}
// (a solid that counts as a footprint: not up overhead, not a cloth awning)
export const isFootprint = (s) => !((s.y0 || 0) >= MAP_ART.skipOver) && !s.soft;

const cache = new Map();
/* the art for zone Z from its plan ({ pieces }): { canvas, ppm, x0, z0, size } (x0 / z0: the world spot at the canvas's
   top-left corner, in metres). opts.districts: draw their borders (the full map) */
export function zoneMapArt(Z, plan, opts = {}){
  const key = Z.level.layout + (opts.districts ? ':d' : '');
  if (cache.has(key)) return cache.get(key);
  const { ppm, margin } = MAP_ART, half = Z.size / 2 + margin, size = half * 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.round(size * ppm);
  const c = cv.getContext('2d'), C = colours(Z);
  c.setTransform(ppm, 0, 0, ppm, half * ppm, half * ppm);   // world metres in, the zone's middle at the canvas's middle
  inkPpm = ppm;
  c.fillStyle = C.outside; c.fillRect(-half, -half, size, size);
  c.fillStyle = C.ground; c.fillRect(-Z.size / 2, -Z.size / 2, Z.size, Z.size);
  const pieces = (plan && plan.pieces) || [];
  for (const p of pieces) if (MAP_GROUND[p.t]) MAP_GROUND[p.t](c, p, C);
  // every footprint, lowest first, so a tower stands over the step at its foot
  const foot = [];
  for (const p of pieces){
    const K = KINDS[p.t]; if (!K || p.t === 'waystone') continue;   // (the waystones are marks, drawn live)
    const out = []; K.solids(p, out);
    for (const s of out) if (isFootprint(s)) foot.push(s);
  }
  inkFootprints(c, foot, C);
  if (opts.districts){
    c.strokeStyle = C.border; c.lineWidth = 1.6 / ppm; c.setLineDash([6 / ppm, 5 / ppm]);
    for (const d of Z.districts){ c.beginPath(); c.rect(d.x0, d.z0, d.x1 - d.x0, d.z1 - d.z0); c.stroke(); }
    c.setLineDash([]);
  }
  const art = { canvas: cv, ppm, x0: -half, z0: -half, size };
  cache.set(key, art);
  return art;
}
