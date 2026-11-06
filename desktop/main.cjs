// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DESKTOP APP (Electron): the same built game as the website, in its own window. Nothing in the game changes for it.
// The built dist/ is copied into game/ (desktop/build.mjs) and served from app://game/, a private origin, so:
//   - saves (localStorage) live in this app's own profile and survive updates
//   - fetch('/api/turn') for co-op's relay credentials is answered here by asking the live website (WEB_URL below),
//     from Node, so there is no cross-origin problem; if that fails the game falls back to STUN, as it does on file://
//   - online co-op (PeerJS + WebRTC) runs exactly as in Chrome, and desktop players and browser players can share a room

const { app, BrowserWindow, protocol, net, shell, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const GAME_DIR = path.join(__dirname, 'game');
const WEB_URL = (process.env.POWER_TRIP_WEB_URL || 'https://sw-power-trip.vercel.app').replace(/\/+$/, '');

// a standard + secure scheme: a real origin for storage, a secure context for WebRTC, fetch() allowed
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// the game's audio and music start before the first click, as they do once a browser tab has been played in
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function serveGame(){
  protocol.handle('app', async (req) => {
    const url = new URL(req.url);
    if (url.pathname === '/api/turn'){
      try { return await net.fetch(WEB_URL + '/api/turn', { cache: 'no-store' }); }
      catch(e){ return new Response('{"error":"offline"}', { status: 503, headers: { 'content-type': 'application/json' } }); }
    }
    const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.normalize(path.join(GAME_DIR, rel));
    if (!file.startsWith(GAME_DIR + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow(){
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540,
    title: 'Power Trip', backgroundColor: '#000000', show: false,
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  win.removeMenu();   // no menu shortcuts: Ctrl+W, Ctrl+R and friends reach the game as they do in fullscreen Chrome
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  // links (credits, a co-op invite page) open in the player's browser, never inside the game window
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  // F12 opens the developer tools, for bug reports
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
  });
  win.loadURL('app://game/index.html');
  return win;
}

// one copy at a time: a second launch brings the open window forward
if (!app.requestSingleInstanceLock() && !process.env.POWER_TRIP_MULTI) app.quit();
else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win){ if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(() => {
    // the game asks for fullscreen, the gamepad, pointer lock and keyboard lock: allow what it asks for, nothing else
    session.defaultSession.setPermissionRequestHandler((wc, perm, cb) =>
      cb(['fullscreen', 'pointerLock', 'keyboardLock', 'clipboard-sanitized-write'].includes(perm)));
    serveGame();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
