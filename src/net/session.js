// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Online co-op connection: one browser hosts under a short room code and up to three others join with it. A WebRTC data
// channel per player (PeerJS: its free broker only introduces the browsers, then they talk directly) carries small JSON
// messages. The host is the middle of a star: every guest talks to the host, and the host passes on what the others
// need to see of each other (RELAY). Slot 0 is the host; guests take slots 1 to 3. This file knows nothing about the
// game: partner.js and coop-ui.js listen to it through on().

const ID_PREFIX = 'swpt-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I: easy to read out over voice chat
const CODE_LEN = 5;
export const MAX_GUESTS = 3;
// what the host passes on from one guest to the rest, stamped with the sender's slot: poses, their shots and powers
const RELAY = { s: 1, hello: 1, pb: 1, pw: 1, bx: 1, mark: 1, unmark: 1, tu: 1 };   // (mark / unmark: a player's ping marker going up / coming down, net/ping.js; tu: a team-up offer, game/teamup.js)
// ...and a duel's (game/duel-mode.js, net/pvp.js): its challenge and answer, its state, the blows and their verdicts
Object.assign(RELAY, { dch: 1, dans: 1, dst: 1, dpg: 1, drm: 1, dq: 1, dsw: 1, dhit: 1, dres: 1, dfp: 1, dbl: 1, dfl: 1 });
// a guest whose link to the host drops tries the same room again this many times, this far apart (ms), before giving up
const REJOIN = { tries: 10, wait: 2500 };   // (25 s: room for a host handoff, below, when the server is slow to free the code)
const LAST = 'sw_coop_last';   // the last room joined, offered again in the co-op panel (a reload, a crash)

/* the session, shared by everything that reads it: status is idle | hosting | joining | connected | reconnecting | failed */
export const net = {
  status: 'idle', role: null, code: '', error: '', ping: 0, peerPlays: false,
  slot: 0,        // this browser's seat: 0 the host, 1 to 3 the guests
  guests: 0,      // host: how many guests are connected
};

let peer = null, conn = null, sendAt = 0;
/* HOST HANDOFF — the guests know each other's seats (the host passes on each one's hello, and says bye as one goes). When
   the link to the host drops, the guest in the lowest seat is the HEIR: it takes the room over under the same code, and
   the others' rejoin (below) finds it there. A heir whose own link was the one that dropped finds the code still held,
   and simply rejoins the host instead. */
const seats = new Set();   // guest: the other guests' seats in this room
let heir = false;          // guest: this browser is taking the room over (or trying to)
const conns = new Map();   // host: slot -> that guest's connection
const hellos = new Map();  // host: slot -> that guest's last hello, handed to guests who join later
const pings = new Map(), pingTimers = new Map();
// ?netlag=120: hold every message this browser receives for that many ms (a slow link to test against; the round trip
// it adds shows in the ping like a real one would)
const NETLAG = (() => { try { return Math.max(0, Math.min(1000, +new URLSearchParams(location.search).get('netlag') || 0)); } catch(e){ return 0; } })();
const listeners = {};
export function on(event, fn){ (listeners[event] ||= []).push(fn); }
function emit(event, ...args){ for (const fn of listeners[event] || []) fn(...args); }
function setStatus(status, error = ''){ net.status = status; net.error = error; emit('status', net); }

const newCode = () => Array.from({ length: CODE_LEN }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);

/* STUN is enough for most home networks. For strict ones (some schools, offices, phone hotspots) the relay
   credentials come from /api/turn (api/turn.js, which holds the Cloudflare key); where that isn't deployed
   or fails, play simply goes on with STUN only. */
async function iceServers(){
  const stun = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
  try {
    if (location.protocol === 'file:') return stun;   // the built single file opened from disk has no server to ask
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 2500);
    const res = await fetch('/api/turn', { signal: ctl.signal }); clearTimeout(timer);
    if (!res.ok) return stun;
    const { iceServers: relay } = await res.json();
    return Array.isArray(relay) ? relay : stun;
  } catch(e){ return stun; }
}

async function makePeer(id){
  const { Peer } = await import('peerjs');
  // ?peerhost=host&peerport=9000 points at a self-hosted PeerServer instead of the free PeerJS cloud one (also how the tests run)
  const q = new URLSearchParams(location.search), own = q.get('peerhost');
  const where = own ? { host: own, port: +q.get('peerport') || 9000, path: '/', secure: q.get('peersecure') === '1' } : {};
  return new Peer(id, { ...where, config: { iceServers: await iceServers() }, debug: 0 });
}

// keep: the room code to take over (a host handoff, above) instead of drawing a new one
export async function host(attempt = 0, keep = ''){
  leave(true);
  if (!keep) heir = false;
  net.role = 'host'; net.slot = 0; net.code = keep || newCode(); setStatus(keep ? 'reconnecting' : 'hosting');
  try { peer = await makePeer(ID_PREFIX + net.code); } catch(e){ return keep ? claimLater(keep) : fail('Could not start the connection.'); }
  const mine = peer;
  peer.on('open', () => {
    if (keep){ heir = false; tries = 0; setStatus('hosting'); }   // the room is this browser's now: the others rejoin it
    else emit('status', net);
  });
  peer.on('connection', (c) => {
    let slot = 1; while (conns.has(slot)) slot++;
    if (slot > MAX_GUESTS){   // the room is full: tell them, then turn them away
      c.on('open', () => { try { c.send({ t: 'full' }); } catch(e){} setTimeout(() => c.close(), 300); });
      return;
    }
    conns.set(slot, c);   // taken now, even before the channel opens
    attach(c, slot);
  });
  peer.on('error', (err) => {
    if (mine !== peer) return;
    if (err.type === 'unavailable-id' && keep) return void claimLater(keep);   // the old host (or the server's memory of it) still holds the code
    if (err.type === 'unavailable-id' && attempt < 4) return void host(attempt + 1);   // the code was taken: draw another
    if (SERVER_ERR[err.type] && net.status === 'connected') return void keepServer(mine);   // the game goes on without it (below)
    fail(describe(err));
  });
  peer.on('disconnected', () => { if (mine === peer && net.status === 'connected') keepServer(mine); });
}

// retry: a guest getting back into the room it dropped out of (rejoin below), which keeps saying 'reconnecting'
export async function join(code, retry = false){
  code = cleanCode(code);
  if (code.length !== CODE_LEN) return fail('Enter the 5-letter room code.');
  if (!retry) tries = 0;
  leave(true);
  net.role = 'guest'; net.code = code; net.slot = 0; setStatus(retry ? 'reconnecting' : 'joining');
  try { localStorage.setItem(LAST, code); } catch(e){}
  try { peer = await makePeer(); } catch(e){ return retry ? rejoin() : fail('Could not start the connection.'); }
  const mine = peer;
  peer.on('error', (err) => {
    if (mine !== peer) return;
    if (SERVER_ERR[err.type] && net.status === 'connected') return void keepServer(mine);   // the game goes on without it (below)
    // no room under that code (yet): the heir takes it, the others keep trying, as a handoff takes a moment (above)
    if (retry) return err.type === 'peer-unavailable' && heir ? void host(0, code) : rejoin(true);
    fail(err.type === 'peer-unavailable' ? 'No room with that code.' : describe(err));
  });
  let dialled = false;
  peer.on('open', () => {
    if (dialled) return;   // the server link came back (keepServer below): the game's own link to the host is still up
    dialled = true;
    const c = peer.connect(ID_PREFIX + code, { serialization: 'json' });
    attach(c, 0);
    setTimeout(() => {
      if (mine !== peer) return;
      if (net.status === 'joining') fail('Timed out. Check the code, or try again.');
      else if (net.status === 'reconnecting') rejoin();
    }, 15000);
  });
}
// for the co-op smoke test: a guest's link to the host drops as if the network went (not a leave)
export function dropLink(){ if (net.role === 'guest' && conn) conn.close(); }
export const lastRoom = () => { try { return localStorage.getItem(LAST) || ''; } catch(e){ return ''; } };

/* REJOIN — the link to the host dropped without anyone leaving (a Wi-Fi blip, a laptop lid): try the same room again a
   few times. The game carries on meanwhile (net/foes.js), and puts you back in the host's fight once you're through. */
let tries = 0, rejoinTimer = 0;
function rejoin(noRoom){
  const code = net.code;
  clearTimeout(rejoinTimer);
  if (!code || ++tries > REJOIN.tries){ heir = false; return fail(noRoom ? 'The host left the game.' : 'Lost the connection to the host.'); }
  setStatus('reconnecting');
  rejoinTimer = setTimeout(() => { if (net.status === 'reconnecting' && net.code === code) join(code, true); }, REJOIN.wait);
}

// the heir found the code still held: try the room as a guest (the host may be there after all), then claim it again
function claimLater(code){
  leave(true);
  net.role = 'guest'; net.code = code;
  rejoin();
}

/* THE MATCHMAKING SERVER only brings players together: once you are connected, the game runs over the links between
   the players. Losing the server then (a hiccup, a long stall on a slow machine) must not throw anyone out of the room,
   so it is only reconnected, quietly, for whoever joins next. */
const SERVER_ERR = { network: 1, 'server-error': 1, 'socket-error': 1, disconnected: 1 };
function keepServer(mine){
  setTimeout(() => { if (mine === peer && !mine.destroyed && mine.disconnected) try { mine.reconnect(); } catch(e){} }, 2000);
}

function describe(err){
  return err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error'
    ? 'Could not reach the matchmaking service.' : 'Connection problem (' + (err.type || 'unknown') + ').';
}
function fail(message){ leave(true); setStatus('failed', message); }

// one connection: slot is the guest's seat on the host's side, 0 on a guest's (its only connection is the host)
function attach(c, slot){
  if (net.role === 'guest') conn = c;
  c.on('open', () => {
    // (the host's pings carry the guest's seat: a welcome lost on a busy link, sent the instant it opened, heals itself)
    pingTimers.set(slot, setInterval(() => { if (c.open) c.send(net.role === 'host' ? { t: 'ping', at: performance.now(), s: slot } : { t: 'ping', at: performance.now() }); }, 2000));
    if (net.role === 'host'){
      net.guests = conns.size;
      c.send({ t: 'welcome', slot });
      for (const [k, h] of hellos) if (k !== slot) c.send({ ...h, from: k });   // the guests already here
    }
    setStatus('connected');
    emit('open', slot);
  });
  c.on('data', (m) => { if (NETLAG > 0) setTimeout(() => recv(m), NETLAG); else recv(m); });
  const recv = (m) => {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'ping'){ if (net.role === 'guest' && m.s > 0 && net.slot !== m.s){ net.slot = m.s; emit('welcome', m.s); } return void c.send({ t: 'pong', at: m.at }); }
    if (m.t === 'pong'){ pings.set(slot, Math.round(performance.now() - m.at)); net.ping = Math.max(0, ...pings.values()); emit('ping', net.ping); return; }
    if (m.t === 'welcome'){ net.slot = m.slot; tries = 0; heir = false; seats.clear(); emit('welcome', m.slot); return; }
    if (net.role === 'guest'){ if (m.t === 'hello' && m.from) seats.add(m.from); if (m.t === 'bye') seats.delete(m.slot); }
    if (m.t === 'full') return void leave(false, 'That room is full (4 players).');
    if (net.role === 'host'){
      m.from = slot;   // never trust a guest to say who they are
      if (m.t === 'hello') hellos.set(slot, m);
      if (RELAY[m.t]) for (const [k, o] of conns) if (k !== slot && o.open) o.send(m);
    }
    emit(m.t, m);
  };
  c.on('close', () => {
    clearInterval(pingTimers.get(slot)); pingTimers.delete(slot); pings.delete(slot);
    if (net.role === 'host'){
      if (conns.get(slot) !== c) return;
      conns.delete(slot); hellos.delete(slot);
      net.guests = conns.size;
      for (const o of conns.values()) if (o.open) o.send({ t: 'bye', slot });
      emit('closed', slot);
      if (peer) setStatus(conns.size ? 'connected' : 'hosting');
    } else if (conn === c){
      conn = null; emit('closed', 0);
      // dropped (this player didn't leave, or leave() would have let go of it first): the lowest seat takes the room over
      // (HOST HANDOFF, above), everyone else tries the room again and finds them there
      if (peer){ try { peer.destroy(); } catch(e){} peer = null; }
      tries = 0;
      const others = [...seats].filter(k => k !== net.slot);
      if (net.slot > 0 && others.length && others.every(k => k > net.slot)){   // (alone with the host, there is no room to keep)
        heir = true;
        emit('takeover');   // the fight goes on here: this browser runs it now (net/foes.js)
        host(0, net.code);
      } else rejoin();
    }
  });
  c.on('error', () => {});
}

// host: any guest is connected · guest: the host is
export const connected = () => net.role === 'host' ? [...conns.values()].some(c => c.open) : !!conn && conn.open;
// host: to every guest · guest: to the host
export function send(msg){
  if (net.role === 'host'){ for (const c of conns.values()) if (c.open) c.send(msg); }
  else if (conn && conn.open) conn.send(msg);
}
// host: to one guest only (a blow meant for them)
export function sendTo(slot, msg){ const c = conns.get(slot); if (c && c.open) c.send(msg); }
// host: the seats of the guests connected now
export const guestSlots = () => [...conns].filter(([, c]) => c.open).map(([k]) => k);

/* state at ~15 per second: callers pass a function so the message is only built when it is due */
export function sendEvery(ms, build){
  const now = performance.now();
  if (now - sendAt < ms || !connected()) return;
  sendAt = now; send(build());
}

export function leave(quiet, message = ''){
  if (!quiet) clearTimeout(rejoinTimer);
  for (const t of pingTimers.values()) clearInterval(t);
  pingTimers.clear(); pings.clear(); hellos.clear();
  for (const c of conns.values()) try { c.close(); } catch(e){}
  conns.clear();
  if (conn){ try { conn.close(); } catch(e){} conn = null; }
  if (peer){ try { peer.destroy(); } catch(e){} peer = null; }
  net.role = null; net.ping = 0; net.peerPlays = false; net.slot = 0; net.guests = 0;
  if (!quiet){ heir = false; seats.clear(); }
  if (!quiet){ net.code = ''; setStatus(message ? 'failed' : 'idle', message); emit('closed', -1); }
}
