// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// EXIT GAME: closes the desktop app (desktop/, Electron), from the title screen and the pause screen, after a confirm
// that swaps in for the button row like NEW GAME's. A browser tab can't close itself, so on the website the button
// never shows: it appears only when the desktop app's preload (desktop/preload.cjs) hands the page window.powerTripDesktop.
// Mouse, keys (Esc cancels) and the pad (A picks, B cancels, engine/gamepad.js) all work it.
import { audioInit } from '../audio/sfx.js';

const desktop = window.powerTripDesktop;
const overlay = document.getElementById('overlay');

if (desktop && typeof desktop.quit === 'function'){
  document.documentElement.classList.add('desktop-app');
  const q = document.getElementById('exitq');
  document.getElementById('exitBtn').addEventListener('click', (e) => {
    e.stopPropagation(); audioInit();
    q.textContent = overlay.classList.contains('st-pause') ? 'Exit Power Trip? Your progress in this run will be lost.' : 'Exit Power Trip?';
    overlay.classList.add('exitconfirming');
  });
  document.getElementById('exitNo').addEventListener('click', (e) => { e.stopPropagation(); overlay.classList.remove('exitconfirming'); });
  document.getElementById('exitYes').addEventListener('click', (e) => { e.stopPropagation(); desktop.quit(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('exitconfirming')) overlay.classList.remove('exitconfirming'); });
}
