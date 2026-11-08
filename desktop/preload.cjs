// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The one thing the desktop app hands the game page: window.powerTripDesktop. The game checks for it (src/ui/exit-game.js)
// to show EXIT GAME, which a browser tab can't offer, and to write a save to disk at once. Nothing else from Node reaches the page.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('powerTripDesktop', {
  quit: () => ipcRenderer.send('power-trip:quit'),
  flush: () => ipcRenderer.send('power-trip:flush'),   // write saves to disk now (after a save: game/saves.js)
});
