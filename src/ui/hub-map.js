// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE HUB MAP (ui/hub-ui.js draws it at the Temple Map, the waystones, the citadel's Facility Map and beacons, the
// covert's map consoles): a drawn top-down plan of the hub's wings, laid out from their doors (data/hub.js: a door on a
// wing's north side puts the wing it names above it, and so on), each wing to scale by its arena, each station a pin
// where it stands. The wing you're in carries YOU, an arrow where you stand and the way you face; in co-op a wing
// lists who is in it. Every other wing is a button: click it, tap it, or move the controller's ring onto it and press A,
// and you travel there. Nothing here is per hub, so a new hub (or wing) draws itself.

import { SIDE_OUT } from '../data/hub.js';

const GAP = 22;   // metres of corridor between two wings on the map (room for a wing's title over or under it)
const PAD = 12;   // metres of margin round the plan (the outer wings' titles)

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
  // (a wing no door reaches, like a hub's ship whose ramp leads out into one wing: beside the wing it leads to, on the first
  // side with room, else set off to the east of everything, so it still has a button)
  const clear = (x, z, h) => Object.keys(at).every(o => Math.abs(at[o][0] - x) >= half(o) + h + GAP * 0.5 || Math.abs(at[o][1] - z) >= half(o) + h + GAP * 0.5);
  for (const id of Hb.order){
    if (at[id]) continue;
    const to = Object.values(Hb.wings[id].doors || {}).find(t => at[t]);
    if (!to) continue;
    for (const [ox, oz] of [[0, -1], [1, 0], [-1, 0], [0, 1]]){
      const d = half(to) + GAP + half(id), x = at[to][0] + ox * d, z = at[to][1] + oz * d;
      if (clear(x, z, half(id))){ at[id] = [x, z]; break; }
    }
  }
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
const n = (v) => +v.toFixed(2);

/* what each station looks like from above, drawn in metres round its spot (an SVG in the wing's own metres), by what
   it does; and how far its name sits below it */
// (the colours are the hub's theme, styles/hub.css .hm-t-<hub>: gold, glow and stone mean different things in each hub)
const GOLD = 'var(--hm-c1)', BLUE = 'var(--hm-c2)', STONE = 'var(--hm-c3)', FIRE = 'var(--hm-c4)';
function glyph(s){
  const { x, z } = s, r = s.r || 3.2;
  switch (s.act){
    case 'travel': {
      if (r < 6) return [`<path d="M${n(x)} ${n(z - 2.6)}L${n(x + 2.6)} ${n(z)}L${n(x)} ${n(z + 2.6)}L${n(x - 2.6)} ${n(z)}Z" fill="none" style="stroke:${BLUE}" stroke-width=".9"/><circle cx="${n(x)}" cy="${n(z)}" r=".9" style="fill:${BLUE}"/>`, 3.4];
      const R = r * 1.45;   // the hub's great map: a ring round a glowing table, four lamps at its corners
      let o = `<circle cx="${n(x)}" cy="${n(z)}" r="${n(R)}" fill="none" style="stroke:${BLUE}" stroke-width="1"/><circle cx="${n(x)}" cy="${n(z)}" r="${n(R * 0.3)}" style="fill:${BLUE}"/>`;
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) o += `<rect x="${n(x + a * R * 0.78 - 1.1)}" y="${n(z + b * R * 0.78 - 1.1)}" width="2.2" height="2.2" style="fill:${STONE}"/>`;
      return [o, R + 1.6];
    }
    case 'council': {   // the round table, its seats about it
      const R = r * 1.45;
      let o = `<circle cx="${n(x)}" cy="${n(z)}" r="${n(R)}" fill="none" style="stroke:${GOLD}" stroke-width=".7"/><circle cx="${n(x)}" cy="${n(z)}" r="${n(R * 0.38)}" style="fill:${BLUE}"/>`;
      for (let i = 0; i < 8; i++){ if (i === 2) continue; const a = -Math.PI / 2 + (i - 1) * Math.PI * 2 / 8 + Math.PI / 4; o += `<circle cx="${n(x + Math.cos(a) * R * 1.1)}" cy="${n(z + Math.sin(a) * R * 1.1)}" r="1" style="fill:${GOLD}"/>`; }
      return [o, R * 1.1 + 1.8];
    }
    case 'codex': return [`<circle cx="${n(x)}" cy="${n(z)}" r="3" style="fill:${BLUE}"/>`, 3.6];
    case 'profile': case 'records': return [`<rect x="${n(x - 1.8)}" y="${n(z - 1.8)}" width="3.6" height="3.6" rx=".6" style="fill:${BLUE}" opacity=".85"/>`, 2.6];
    case 'training': case 'proving': return [`<circle cx="${n(x)}" cy="${n(z)}" r="7" fill="none" style="stroke:${STONE}" stroke-width=".6"/>`, 7.8];
    case 'sparring': return [`<rect x="${n(x - 3.2)}" y="${n(z - 6)}" width="6.4" height="12" style="fill:${STONE}" opacity=".28"/>`, 6.7];
    case 'forge': return [`<rect x="${n(x - 4.6)}" y="${n(z - 3)}" width="9.2" height="6" style="fill:${GOLD}"/>`, 3.6];
    case 'quests': return [`<circle cx="${n(x)}" cy="${n(z)}" r="1.5" style="fill:var(--hm-c5)"/>`, 2.2];
    case 'ship': case 'shuttle': return [`<path d="M${n(x)} ${n(z - 7)}L${n(x + 5)} ${n(z + 5)}L${n(x)} ${n(z + 3)}L${n(x - 5)} ${n(z + 5)}Z" style="fill:${STONE}" opacity=".75"/>`, 5.6];
    case 'raid': return [`<circle cx="${n(x)}" cy="${n(z)}" r="2" fill="none" stroke="#b46bff" stroke-width=".9"/><circle cx="${n(x)}" cy="${n(z)}" r=".7" fill="#b46bff"/>`, 2.8];   // the raid table's gate-ring
    case 'galaxy': return [`<circle cx="${n(x)}" cy="${n(z)}" r="${n(Math.min(4, r * 0.7))}" fill="none" style="stroke:${BLUE}" stroke-width=".7"/><circle cx="${n(x)}" cy="${n(z)}" r="1.1" style="fill:${GOLD}"/>`, Math.min(4, r * 0.7) + 1.4];   // a ship's galaxy table
    case 'deeds': return [`<path d="M${n(x)} ${n(z - 2.4)}L${n(x + 2)} ${n(z + 1.6)}L${n(x - 2)} ${n(z + 1.6)}Z" style="fill:${GOLD}"/>`, 2.6];   // the hall's ledger: a trophy's point
    case 'bounties': return [`<rect x="${n(x - 3.5)}" y="${n(z - 1.2)}" width="7" height="2.4" style="fill:${GOLD}"/>`, 2];
  }
  return [`<circle cx="${n(x)}" cy="${n(z)}" r="1.6" style="fill:${BLUE}"/>`, 2.2];
}

/* a wing's own look (its `map` list in data/hub.js and friends): what the room is built of, under its stations */
const ART = {
  // a ring of pillars, as round the grand hall
  pillars: (h) => { let o = ''; for (const x of [-0.6, 0.6]) for (const z of [-0.6, -0.2, 0.2, 0.6]) o += `<circle cx="${n(x * h)}" cy="${n(z * h)}" r="${n(h * 0.045)}" style="fill:${STONE}" opacity=".22"/>`; return o; },
  // rows of shelves, as in the archives
  shelves: (h) => { let o = ''; for (const z of [-0.72, -0.48, 0.48, 0.72]) for (const x of [-0.42, 0.42]) o += `<rect x="${n(x * h - h * 0.3)}" y="${n(z * h - h * 0.035)}" width="${n(h * 0.6)}" height="${n(h * 0.07)}" style="fill:${BLUE}" opacity=".45"/>`; return o; },
  // crystals in the corners, as in the saber forge's cave
  crystals: (h) => { let o = ''; for (const [x, z, k] of [[-0.82, -0.82, 0.8], [0.82, -0.82, 0.8], [-0.8, 0.8, 1.2], [0.8, 0.8, 1.2]]){ const s = h * 0.07 * k; o += `<path d="M${n(x * h)} ${n(z * h - s)}L${n(x * h + s * 0.6)} ${n(z * h + s * 0.6)}L${n(x * h - s * 0.6)} ${n(z * h + s * 0.6)}Z" style="fill:${BLUE}" opacity=".85"/>`; } return o; },
  // landing pads, as on the hangar deck
  pads: (h) => { let o = ''; for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) o += `<circle cx="${n(x * h)}" cy="${n(z * h)}" r="${n(h * 0.17)}" fill="none" style="stroke:${STONE}" stroke-width=".5" stroke-dasharray="1.6 1.2" opacity=".5"/>`; return o; },
  // rows of tanks, as in the cloning halls
  tanks: (h) => { let o = ''; for (const z of [-0.72, -0.5, 0.5, 0.72]) for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) o += `<circle cx="${n(x * h)}" cy="${n(z * h)}" r="${n(h * 0.06)}" fill="none" style="stroke:${BLUE}" stroke-width=".6" opacity=".55"/>`; return o; },
  // a fire pit in the floor, as round the covert's great forge
  fire: (h) => `<circle cx="0" cy="0" r="${n(h * 0.2)}" style="fill:${FIRE}" opacity=".25"/><circle cx="0" cy="0" r="${n(h * 0.1)}" style="fill:${FIRE}" opacity=".6"/>`,
  // trophy plinths round the walls, as in the temple's trophy hall
  plinths: (h) => { let o = ''; for (const [x, z] of [[-0.38, -0.44], [0, -0.53], [0.38, -0.44], [-0.38, 0.44], [0.38, 0.44]]) o += `<rect x="${n(x * h - h * 0.05)}" y="${n(z * h - h * 0.05)}" width="${n(h * 0.1)}" height="${n(h * 0.1)}" style="fill:${GOLD}" opacity=".55"/>`; return o; },
  // racks along the walls, as in an armory
  racks: (h) => { let o = ''; for (const x of [-0.86, 0.86]) for (const z of [-0.5, 0, 0.5]) o += `<rect x="${n(x * h - h * 0.04)}" y="${n(z * h - h * 0.13)}" width="${n(h * 0.08)}" height="${n(h * 0.26)}" style="fill:${STONE}" opacity=".4"/>`; return o; },
  // a hero's ship (data/hero-ships.js): the hull's outline round the cabin, the nose forward (north), the ramp aft
  hull: (h) => `<path d="M${n(-h * 0.42)} ${n(h * 0.92)}L${n(-h * 0.92)} ${n(h * 0.5)}L${n(-h * 0.92)} ${n(-h * 0.4)}L${n(-h * 0.34)} ${n(-h * 0.96)}L${n(h * 0.34)} ${n(-h * 0.96)}L${n(h * 0.92)} ${n(-h * 0.4)}L${n(h * 0.92)} ${n(h * 0.5)}L${n(h * 0.42)} ${n(h * 0.92)}Z" fill="none" style="stroke:${STONE}" stroke-width=".8" opacity=".6"/>`,
};

/* the map's markup: `here` the wing you're in, `you` { x, z, yaw, half } where you stand in it, `who(id)` the party
   members in a wing, `idx(id)` the panel's option index for a wing's button */
export function mapHTML(Hb, hubId, here, you, who, idx){
  const L = mapLayout(Hb), X = (x) => pc((x - L.x0) / L.w * 100), Z = (z) => pc((z - L.z0) / L.h * 100);
  const W_ = (m) => pc(m / L.w * 100), H_ = (m) => pc(m / L.h * 100);
  let out = '';
  // the corridors, under the wings: from door to door, as wide as the great doors' arches
  for (const { a, b, side } of L.links){
    const [ax, az] = L.at[a], [bx, bz] = L.at[b], [ox, oz] = SIDE_OUT[side];
    const sx = ax + ox * L.half(a), sz = az + oz * L.half(a), ex = bx - ox * L.half(b), ez = bz - oz * L.half(b);
    const cw = 18;
    const l = Math.min(sx, ex) - (ox ? 0 : cw / 2), t = Math.min(sz, ez) - (oz ? 0 : cw / 2);
    const w = ox ? Math.abs(ex - sx) : cw, h = oz ? Math.abs(ez - sz) : cw;
    out += '<i class="hm-hall' + (oz ? ' v' : '') + '" style="left:' + X(l) + ';top:' + Z(t) + ';width:' + W_(w) + ';height:' + H_(h) + '"></i>';
  }
  const startZ = L.at[Hb.start][1];
  for (const id of Hb.order){
    const Wg = Hb.wings[id], [cx, cz] = L.at[id], h = L.half(id), isHere = id === here, names = who(id);
    // its title over it (under it, for a wing south of the start: the plan's bottom edge)
    const below = cz > startZ + 1;
    let inner = '<b class="hm-n' + (below ? ' low' : '') + '">' + esc(Wg.name.replace(/^THE /, '')) + '</b>';
    let svg = (Wg.map || []).map(k => ART[k] ? ART[k](h) : '').join('');
    // each station drawn where it stands, its name under it (shown on the wing you're in, and the one you point at)
    let labels = '';
    for (const s of Wg.stations){
      const [g, drop] = glyph(s);
      svg += g;
      if (s.act === 'travel' && (s.r || 0) < 6) continue;   // (a waystone or beacon: one in every wing, its ◇ says enough)
      const tx = Math.max(-0.8, Math.min(0.8, s.x / h)), tz = (s.z + drop) / h;
      labels += '<em class="hm-l' + (tz > 0.84 ? ' up' : '') + '" style="left:' + pc(50 + tx * 50) + ';top:' + pc(50 + (tz > 0.84 ? (s.z - drop) / h : tz) * 50) + '">' + esc(s.name) + '</em>';
    }
    inner += '<svg viewBox="' + [-h, -h, 2 * h, 2 * h].map(n).join(' ') + '" preserveAspectRatio="none" aria-hidden="true">' + svg + '</svg>' + labels;
    if (isHere && you){
      const k = 50 / (you.half || h), rot = Math.round((Math.PI - you.yaw) * 180 / Math.PI);
      const ux = Math.max(4, Math.min(96, 50 + you.x * k)), uz = Math.max(4, Math.min(96, 50 + you.z * k));
      inner += '<i class="hm-you" style="left:' + pc(ux) + ';top:' + pc(uz) + '"><i style="transform:rotate(' + rot + 'deg)"></i></i>';
      inner += '<span class="hm-tag' + (below ? '' : ' low') + '">YOU ARE HERE</span>';
    }
    if (names.length) inner += '<span class="hm-who' + (below ? '' : ' low') + '">' + names.map(esc).join(' · ') + '</span>';
    out += '<div class="hm-wing' + (isHere ? ' here' : '') + '" data-w="' + id + '"' + (isHere ? '' : ' data-i="' + idx(id) + '"') +
      ' style="left:' + X(cx - h) + ';top:' + Z(cz - h) + ';width:' + W_(2 * h) + ';height:' + H_(2 * h) + '">' + inner + '</div>';
  }
  out += '<span class="hm-north">N</span>';
  return '<div class="hm-map hm-t-' + esc(hubId) + '" style="aspect-ratio:' + n(L.w) + '/' + n(L.h) + ';--hm-r:' + n(L.w / L.h * 100) / 100 + '">' + out + '</div>';
}
