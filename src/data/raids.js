// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
/* ============================================================
   RAIDS: big fights for a full party, replayed from a RAID TABLE (the Tython temple's council chamber; the citadel's
   holotable and the covert's war table carry the same page: ui/hub-ui.js). The first is Act IV's own last fight: Darth
   Kharel, the gate's guardian (data/boss-kharel.js, boss/kharel.js), with each hero's job in it.
   ============================================================
   A RAID is a mission (game/mission.js runs it): its boss's fight lifted out of the story mission it comes from
   (`mission`, the objective that holds `finale: <boss>`), fought on the same floor, with the party's own scaling and the
   day's MODIFIERS laid over the boss's numbers.

   ROTATING MODIFIERS. Every day (UTC) the table deals `rotate` modifiers from MODS. A raid's id carries the day it was
   dealt ('raid:kharel:20398'), so a co-op guest (and a retry) builds the exact fight the host is playing from its id
   alone, whatever day their own clock says.

   SOLO WITH ALLIES. Alone (or two), the squad comes too: `allies` by the number of heroes in the fight when the boss
   steps down. They hold the line ward, take on his adds and get a fallen hero up. His bar already scales with the
   party (data/coop.js SCALE.bossHp), and `boss.raid.hp` adds a little more for each hero on top.

   RARE PARTS. Each hero has parts only a raid hands out (the workbench, the locker and the forge: `earn: { raids: n }`,
   n raids won by that hero). They are looks only, like every bench part. Each win also pays RANK_XP.raid.

   It opens once any hero has beaten Act IV (game/gate.js gateBeaten): the boss is its ending.
   ============================================================ */
import { MISSIONS } from './missions.js';
import { KHAREL } from './boss-kharel.js';

export const RAID_PREFIX = 'raid:';
// the raids are open once any hero has beaten Act IV on this save (game/gate.js gateBeaten reads the same keys; read here
// so the sandbox can ask without pulling in the campaign)
export const raidsOpen = () => ['jedi', 'mando', 'trooper'].some(h => { try { return localStorage.getItem('sw_camp_gate_' + h) === '1'; } catch(e){ return false; } });
export const isRaidId = (id) => typeof id === 'string' && id.startsWith(RAID_PREFIX);

/* ---------- the modifiers: each tunes a copy of the boss's numbers (and the raid's own) ---------- */
// tune(def, R): def is a deep copy of the boss's definition (data/boss-kharel.js), R the raid's own knobs ({ adds, trickle })
export const MODS = {
  storm:  { name: 'STORM FRONT', col: '#ffb040', line: 'The storm rolls from the first phase, and comes back sooner.',
            tune(d){ d.moves.storm.from = 1; d.moves.storm.cd = Math.round(d.moves.storm.cd * 0.75); } },
  twin:   { name: 'RESTLESS WARDS', col: '#b46bff', line: 'He wards again sooner, and each ward bursts four seconds earlier.',
            tune(d){ d.moves.ward.cd = Math.round(d.moves.ward.cd * 0.7); d.moves.ward.time -= 4; } },
  choir:  { name: 'THE CHOIR SINGS', col: '#ff6a8a', line: 'More of the Hollow Choir come with every ward, and they keep coming.',
            tune(d, R){ d.moves.ward.adds = d.moves.ward.adds.map(a => a && Object.fromEntries(Object.entries(a).map(([k, n]) => [k, n + 1]))); R.trickle = 0.7; } },
  beskar: { name: 'BESKAR VESSEL', col: '#9cc8e8', line: 'The vessel shrugs off more of every blow, but every hero\'s job cracks it faster.',
            tune(d){ d.armour = Math.round(d.armour * 0.9 * 100) / 100; for (const k in d.sunder.gain) d.sunder.gain[k] *= 1.3; } },
  hymn:   { name: 'THE LONG HYMN', col: '#ff3a4a', line: 'His dark volley lasts half again as long. A good deflector turns it into his ruin.',
            tune(d){ d.moves.volley.dur *= 1.5; d.moves.volley.cd = Math.round(d.moves.volley.cd * 0.85); } },
  nova:   { name: 'BURNING WARD', col: '#ff8a3a', line: 'The nova burns half again as hot, and he hits a little harder.',
            tune(d){ d.moves.ward.nova.dmg = Math.round(d.moves.ward.nova.dmg * 1.5); d.dmg = Math.round(d.dmg * 1.1 * 100) / 100; } },
};
export const MOD_IDS = Object.keys(MODS);

/* ---------- the raids ---------- */
// roles: each hero's job in it (the raid page's three cards, and the banner as it begins)
export const RAIDS = {
  kharel: {
    id: 'kharel', boss: KHAREL, finale: 'kharel', mission: 'gate-heart',
    title: 'THE UNBURIED', name: 'DARTH KHAREL', place: 'THE HEART OF THE GATE',
    blurb: 'The gate\'s guardian, back from the dark, in his vessel of beskar. Three phases, three jobs, one party.',
    phases: KHAREL.phases,
    roles: {
      jedi:    { job: 'DEFLECT', line: 'Turn his dark volley back into him. Every bolt that lands cracks the vessel.' },
      mando:   { job: 'FLANK FROM THE AIR', line: 'His ward turns what comes from in front. Fly over it and hit him from behind or above.' },
      trooper: { job: 'SUPPRESS AND REVIVE', line: 'Keep fire on him to pin him down, and get the fallen up twice as fast.' },
    },
    allies: [3, 1, 0, 0],   // squadmates by heroes in the fight (1, 2, 3, 4)
    rotate: 2,              // modifiers dealt a day
  },
};
export const RAID_LIST = Object.values(RAIDS);

/* ---------- the day's rotation ---------- */
const DAY = 86400000;
export const today = (now = Date.now()) => Math.floor(now / DAY);
export const nextRotationIn = (now = Date.now()) => DAY - (now % DAY);   // ms until the table deals again
function dice(seed){   // mulberry32 (data/arcade.js deals its contracts the same way)
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// the modifiers a raid has on a day: `rotate` of them, never the same pair two days running if it can help it
export function raidMods(raidId, day){
  const R = RAIDS[raidId]; if (!R) return [];
  const pick = (d) => { const r = dice(d * 7919 + raidId.length * 104729), pool = [...MOD_IDS], out = [];
    while (out.length < R.rotate && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out.sort((a, b) => MOD_IDS.indexOf(a) - MOD_IDS.indexOf(b)); };
  const mine = pick(day), before = pick(day - 1);
  return mine.join() === before.join() ? pick(day + 4099) : mine;
}
export const raidIdFor = (raidId, day = today()) => RAID_PREFIX + raidId + ':' + day;
export function parseRaidId(id){
  if (!isRaidId(id)) return null;
  const [, raid, day] = id.split(':'), d = parseInt(day, 10);
  return RAIDS[raid] && d > 0 ? { raid, day: d } : null;
}

/* ---------- a raid as a mission (game/mission.js) ---------- */
const clone = (v) => JSON.parse(JSON.stringify(v));
const cache = new Map();
export function raidMission(id){
  if (cache.has(id)) return cache.get(id);
  const p = parseRaidId(id); if (!p) return null;
  const R = RAIDS[p.raid], src = MISSIONS[R.mission]; if (!src) return null;
  const at = src.objectives.findIndex(o => o.finale === R.finale); if (at < 0) return null;
  const mods = raidMods(p.raid, p.day);
  const duel = clone(src.objectives[at]);
  const knobs = { trickle: 1 };
  tuneBoss(R.boss, mods, knobs);   // (for the trickle: the boss's own copy is tuned at spawn, boss/finale.js)
  if (duel.trickle) duel.trickle.every = Math.max(6, Math.round(duel.trickle.every * knobs.trickle));
  const all = (v) => ({ jedi: v, mando: v, trooper: v });
  const def = {
    ...src,
    id, raid: { id: p.raid, day: p.day, mods },
    trial: false, campaignOnly: false, story: undefined, opening: undefined, order: undefined,
    title: R.title, place: R.place,
    blurb: 'a raid: ' + R.name.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()) + ', three phases, every hero a job',
    level: { ...src.level, name: 'RAID — ' + R.place, sub: all('The heart of the gate. He is waiting on the dais.') },
    start: duel.start ? [duel.start[0], duel.start[1] + 10, duel.start[2]] : src.start,
    squad: 0,   // (the raid's allies come as he steps down, by the size of the party: game/mission.js)
    objectives: [{ ...duel, start: undefined,
      say: all('Kharel again, and he remembers you. Jedi, turn his volley. Mandalorian, get over his ward. Trooper, keep him pinned and keep us standing.') }],
    done: all('The vessel breaks again. The gate keeps him, for now. The table will have him back tomorrow, angrier.'),
  };
  cache.set(id, def);
  return def;
}

// the boss's numbers for this raid: a deep copy with the day's modifiers laid on, and the party's ward time and bar.
// knobs (optional) collects the raid's own (the adds' trickle)
export function tuneBoss(def, mods, knobs = {}, heroes = 1){
  const d = clone(def), n = Math.max(1, Math.min(4, heroes)) - 1;
  if (d.raid){
    if (d.raid.ward && d.moves.ward) d.moves.ward.time = d.raid.ward.time[n] ?? d.moves.ward.time;
    d.raidHp = d.raid.hp ? d.raid.hp[n] ?? 1 : 1;
  }
  for (const m of mods || []) if (MODS[m]) MODS[m].tune(d, knobs);
  return d;
}
