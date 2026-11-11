// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CO-OP INVITE LINKS: the host copies (or, on a phone, shares) one link; a friend who opens it lands in the game already
// joining that room, and is taken straight to wherever the host is (the hub's halls, the ship, or the run). The same link
// works in a browser on a phone or a PC, and in the Windows app (powertrip://, desktop/main.cjs).
//   https://<the game>/?join=ABCDE&inv=TOKEN&exp=MINUTES&from=NAME
// The link EXPIRES (INVITE_MIN): the host remembers each token it handed out and turns away a stale one. The host can also
// LOCK the room: then only players who were already in it (a dropped link coming back, a host handoff) get in.
// No game imports, so net/session.js can read it.

export const INVITE_MIN = 60;   // how long a link lets people in
const WEB_URL = 'https://sw-power-trip.vercel.app';   // where a link points when this copy has no web address (the Windows app, a file)
const TOKEN_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';

/* this browser tab's player id: sent as it connects, so a host (or the heir that takes over from it) knows a player who has
   been in the room before. Per tab, not per browser: two tabs are two players */
let cidMem = '';
export function clientId(){
  if (cidMem) return cidMem;
  try { cidMem = sessionStorage.getItem('sw_coop_cid') || ''; } catch(e){}
  if (!cidMem){
    cidMem = Array.from({ length: 10 }, () => TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)]).join('');
    try { sessionStorage.setItem('sw_coop_cid', cidMem); } catch(e){}
  }
  return cidMem;
}

/* THE ROOM'S RULES, kept by the host and passed to every guest (net/session.js 'rm'), so a guest who takes the room over
   keeps them: the lock, the live invite tokens and who has been in */
export const room = { locked: false, invites: new Map(), known: new Set() };   // invites: token -> expiry (ms since 1970)
export function resetRoom(){ room.locked = false; room.invites.clear(); room.known.clear(); }
export const roomRules = () => ({ t: 'rm', lk: room.locked ? 1 : 0, inv: [...room.invites], cid: [...room.known] });
export function hearRules(m){
  room.locked = !!m.lk;
  room.invites = new Map(Array.isArray(m.inv) ? m.inv.filter(e => Array.isArray(e) && typeof e[0] === 'string').map(([k, v]) => [k, +v || 0]) : []);
  room.known = new Set(Array.isArray(m.cid) ? m.cid.filter(c => typeof c === 'string') : []);
}

/* host: may this player in? null if so, or why not ('locked' | 'expired'). meta is what their browser sent as it connected */
export function admit(meta){
  const cid = meta && typeof meta.cid === 'string' ? meta.cid.slice(0, 24) : '';
  const back = cid && room.known.has(cid);   // been here before: a dropped link, a reload, a handoff
  if (room.locked && !back) return 'locked';
  const inv = meta && typeof meta.inv === 'string' ? meta.inv : '';
  if (inv && !back){
    const exp = room.invites.get(inv);
    if (!exp || exp < Date.now()) return 'expired';
  }
  if (cid) room.known.add(cid);
  return null;
}
export const WHY = {
  locked: 'The host has locked this room.',
  expired: 'That invite link has expired. Ask the host for a new one.',
};

/* host: a fresh link (a new token each time; older ones still work until they run out) */
export function inviteLink(code, from){
  const now = Date.now();
  for (const [k, exp] of room.invites) if (exp < now) room.invites.delete(k);
  const tok = Array.from({ length: 6 }, () => TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)]).join('');
  const exp = now + INVITE_MIN * 60000;
  room.invites.set(tok, exp);
  const q = new URLSearchParams({ join: code, inv: tok, exp: String(Math.round(exp / 60000)) });
  if (from) q.set('from', from);
  return webBase() + '?' + q.toString();
}
// the same invite, for the Windows app: powertrip://join?...
export const appLink = (link) => { const i = link.indexOf('?'); return 'powertrip://join' + (i >= 0 ? link.slice(i) : ''); };
function webBase(){
  try { if (/^https?:$/.test(location.protocol)) return location.origin + location.pathname; } catch(e){}   // (a preview or a dev server: its own address)
  return WEB_URL + '/';
}

/* a guest: read an invite out of a link (or a pasted one: the co-op panel's code box takes either) */
export function parseInvite(text){
  const s = String(text || '').trim(), i = s.indexOf('?');
  let q = null;
  try { q = new URLSearchParams(i >= 0 ? s.slice(i + 1) : s); } catch(e){ return null; }
  if (!q.get('join')) return null;
  const code = q.get('join').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (code.length !== 5) return null;
  const exp = +q.get('exp') || 0;
  return { code, inv: (q.get('inv') || '').replace(/[^a-z0-9]/g, '').slice(0, 12), from: (q.get('from') || '').slice(0, 20),
           stale: exp > 0 && exp * 60000 < Date.now() };
}
// the invite this page was opened with, read once (and taken off the address bar, so a reload doesn't try it again)
export function takePageInvite(){
  let inv = null;
  try {
    inv = parseInvite(location.search);
    if (inv){
      const q = new URLSearchParams(location.search);
      for (const k of ['join', 'inv', 'exp', 'from']) q.delete(k);
      const rest = q.toString();
      history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
    }
  } catch(e){}
  return inv;
}

/* which kind of device this player is on, shown by their name in the room list: a mixed party at a glance */
export function myDevice(){
  try { if (window.powerTripDesktop) return 'APP'; } catch(e){}
  try {
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches)) return 'PHONE';
  } catch(e){}
  return 'PC';
}
const DEVICES = { APP: 1, PHONE: 1, PC: 1 };
const devices = new Map();   // seat -> the device in their hello
export const setDevice = (slot, d) => { if (DEVICES[d]) devices.set(slot, d); else devices.delete(slot); };
export const deviceOf = (slot) => devices.get(slot) || '';
