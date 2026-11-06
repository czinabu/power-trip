// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HUB MAP (ui/hub-ui.js draws it at the Temple Map, the waystones, the citadel's Facility Map and beacons, the
// covert's map consoles): a drawn top-down plan of the hub's wings, laid out from their doors (data/hub.js: a door on a
// wing's north side puts the wing it names above it, and so on), each wing to scale by its arena, each station a pin
// where it stands. The wing you're in carries YOU, an arrow where you stand and the way you face; in co-op a wing
// lists who is in it. Every other wing is a button: click it, tap it, or move the controller's ring onto it and press A,
// and you travel there. Nothing here is per hub, so a new hub (or wing) draws itself.

import { SIDE_OUT } from '../data/hub.js';

const GAP = 14;   // metres of corridor between two wings on the map
const PAD = 4;    // metres of margin round the plan

/* where every wing sits, in metres (x east, z south, as the world has them): a walk out from the start wing, door by door */
const cache = new Map();
export function mapLayout(Hb){
  if (cache.has(Hb)) return cache.get(Hb);
  const half = (id) => Hb.wings[id].level.arena / 2;
  const at = { [Hb.start]: [0, 0] }, links = [], todo = [Hb.start];
  while (todo.length){
    const id = todo.shift(), [cx, cz] = at[id];
    for (const [side, to] of Object.entries(Hb.wings[id].doors || {})){
      if (!Hb.wings[to]) continue;
      if (!links.some(l => l.a === to && l.b === id)) links.push({ a: id, b: to, side });
      if (at[to]) continue;
      const [ox, oz] = SIDE_OUT[side], d = half(id) + GAP + half(to);
      at[to] = [cx + ox * d, cz + oz * d]; todo.push(to);
    }
  }
  // (a wing no door reaches: set off to the east of everything, so it still has a button)
  let east = Math.max(...Object.keys(at).map(id => at[id][0] + half(id)));
  for (const id of Hb.order) if (!at[id]){ at[id] = [east + GAP + half(id), 0]; east += GAP + 2 * half(id); }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const id in at){ const h = half(id), [x, z] = at[id]; x0 = Math.min(x0, x - h); x1 = Math.max(x1, x + h); z0 = Math.min(z0, z - h); z1 = Math.max(z1, z + h); }
  x0 -= PAD; z0 -= PAD; x1 += PAD; z1 += PAD;
  const L = { at, links, x0, z0, w: x1 - x0, h: z1 - z0, half };
  cache.set(Hb, L);
  return L;
}

const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pc = (v) => (+v.toFixed(3)) + '%';
// what a station's pin looks like, by what it does
const PIN = { travel: 'go', council: 'big', ship: 'big', bounties: 'big', quests: 'call', forge: 'make' };

/* the map's markup: `here` the wing you're in, `you` { x, z, yaw, half } where you stand in it, `who(id)` the party
   members in a wing, `idx(id)` the panel's option index for a wing's button */
export function mapHTML(Hb, here, you, who, idx){
  const L = mapLayout(Hb), X = (x) => pc((x - L.x0) / L.w * 100), Z = (z) => pc((z - L.z0) / L.h * 100);
  const W_ = (m) => pc(m / L.w * 100), H_ = (m) => pc(m / L.h * 100);
  let out = '';
  // the corridors, under the wings: from door to door
  for (const { a, b, side } of L.links){
    const [ax, az] = L.at[a], [bx, bz] = L.at[b], [ox, oz] = SIDE_OUT[side];
    const sx = ax + ox * L.half(a), sz = az + oz * L.half(a), ex = bx - ox * L.half(b), ez = bz - oz * L.half(b);
    const cw = 9;   // a corridor as wide as a great door
    const l = Math.min(sx, ex) - (ox ? 0 : cw / 2), t = Math.min(sz, ez) - (oz ? 0 : cw / 2);
    const w = ox ? Math.abs(ex - sx) : cw, h = oz ? Math.abs(ez - sz) : cw;
    out += '<i class="hm-hall' + (oz ? ' v' : '') + '" style="left:' + X(l) + ';top:' + Z(t) + ';width:' + W_(w) + ';height:' + H_(h) + '"></i>';
  }
  for (const id of Hb.order){
    const Wg = Hb.wings[id], [cx, cz] = L.at[id], h = L.half(id), isHere = id === here, names = who(id);
    // its name along the top, or the bottom when more stations crowd the top edge (the YOU ARE HERE tag takes the other)
    const edge = (sgn) => Wg.stations.filter(s => s.z / h * sgn > 0.45 && Math.abs(s.x / h) < 0.7).length;
    const low = edge(-1) > edge(1);
    let inner = '<b class="hm-n' + (low ? ' low' : '') + '">' + esc(Wg.short || Wg.name) + '</b>';
    // the doors: a gap in the wall on each side that has one
    for (const side in Wg.doors || {}) inner += '<i class="hm-door ' + side + '"></i>';
    // each pin's name goes beside it, right if there's room, else left, under or over: not off the wing, not over
    // another pin or a name already placed (sizes in metres: the label's font is 1.25% of the plan's width)
    const em = L.w * 0.0125, taken = Wg.stations.map(s => ({ x0: s.x - 1.6, x1: s.x + 1.6, z0: s.z - 1.6, z1: s.z + 1.6 }));
    const clear = (r) => r.x0 > -h + 1 && r.x1 < h - 1 && r.z0 > -h + 1 && r.z1 < h - 1 && !taken.some(t => r.x0 < t.x1 && r.x1 > t.x0 && r.z0 < t.z1 && r.z1 > t.z0);
    for (const s of Wg.stations){
      const kind = PIN[s.act] || 'dot';
      // (the maps and waystones go unnamed: there's one in every wing, and the key under the plan says what the ◇ is)
      let label = '';
      if (kind !== 'go'){
        const lw = s.name.length * em * 0.58 + em, lh = em * 1.1, g = 2.2;
        const tries = [['', { x0: s.x + g, x1: s.x + g + lw, z0: s.z - lh / 2, z1: s.z + lh / 2 }], ['l', { x0: s.x - g - lw, x1: s.x - g, z0: s.z - lh / 2, z1: s.z + lh / 2 }],
          ['d', { x0: s.x - lw / 2, x1: s.x + lw / 2, z0: s.z + g, z1: s.z + g + lh }], ['u', { x0: s.x - lw / 2, x1: s.x + lw / 2, z0: s.z - g - lh, z1: s.z - g }]];
        const [cls, r] = tries.find(([, r]) => clear(r)) || tries[s.x / h > 0.35 ? 1 : 0];
        taken.push(r);
        label = '<em' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(s.name) + '</em>';
      }
      inner += '<i class="hm-pin ' + kind + '" style="left:' + pc(50 + s.x / h * 50) + ';top:' + pc(50 + s.z / h * 50) + '">' + label + '</i>';
    }
    if (isHere && you){
      const k = 50 / (you.half || h), rot = Math.round((Math.PI - you.yaw) * 180 / Math.PI);
      const ux = Math.max(4, Math.min(96, 50 + you.x * k)), uz = Math.max(4, Math.min(96, 50 + you.z * k));
      inner += '<i class="hm-you" style="left:' + pc(ux) + ';top:' + pc(uz) + '"><i style="transform:rotate(' + rot + 'deg)"></i></i>';
    }
    if (isHere) inner += '<span class="hm-tag' + (low ? ' high' : '') + '">YOU ARE HERE</span>';
    if (names.length) inner += '<span class="hm-who">' + names.map(esc).join(' · ') + '</span>';
    out += '<div class="hm-wing' + (isHere ? ' here' : '') + '" data-w="' + id + '"' + (isHere ? '' : ' data-i="' + idx(id) + '"') +
      ' style="left:' + X(cx - h) + ';top:' + Z(cz - h) + ';width:' + W_(2 * h) + ';height:' + H_(2 * h) + '">' + inner + '</div>';
  }
  // the compass, top right; the key, bottom left
  const travel = [...new Set(Hb.order.flatMap(id => Hb.wings[id].stations.filter(s => s.act === 'travel').map(s => s.name)))];
  out += '<span class="hm-north">N</span><span class="hm-key"><i class="hm-pin go"></i>' + travel.map(esc).join(' · ') + '</span>';
  return '<div class="hm-map" style="aspect-ratio:' + (+L.w.toFixed(2)) + '/' + (+L.h.toFixed(2)) + ';--hm-r:' + (+(L.w / L.h).toFixed(4)) + '">' + out + '</div>';
}
