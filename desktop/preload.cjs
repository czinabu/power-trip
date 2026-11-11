// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The one thing the desktop app hands the game page: window.powerTripDesktop. The game checks for it (src/ui/exit-game.js)
// to show EXIT GAME, which a browser tab can't offer, to write a save to disk at once, and to hand it co-op invites. Nothing else from Node reaches the page.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('powerTripDesktop', {
  quit: () => ipcRenderer.send('power-trip:quit'),
  flush: () => ipcRenderer.send('power-trip:flush'),   // write saves to disk now (after a save: game/saves.js)
  // a co-op invite (powertrip://…) opened while the game is running: its ?join=… part (src/ui/coop-ui.js joins it)
  onInvite: (cb) => ipcRenderer.on('power-trip:invite', (e, q) => cb(String(q || ''))),
});
