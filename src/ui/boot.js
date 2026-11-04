// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The loading screen's hand-off (index.html #boot, styles/boot.css): the loader shows from the first paint, this moves
// its saber along as the game comes up, and lifts it once the title screen's 3D stage has drawn a few frames, so the
// menu never shows flat on a black page before its backdrop and hero are in.

const boot = window.__boot;   // (set by the inline script in index.html; absent in a page without the loader)
// imported first by main.js: by the time this runs, every module has arrived and the game is being built
if (boot) boot.stage(0.66, 'Building the world');

let frames = 0, fonts = !(document.fonts && document.fonts.ready);
if (!fonts) document.fonts.ready.then(() => { fonts = true; }, () => { fonts = true; });
/* called by the main loop after every drawn frame: three frames in (the stage built, its programs compiled, its first
   picture on screen) and with the display font in, the loader goes */
export function bootFrame(){
  if (!boot || frames < 0) return;
  if (++frames === 1) boot.stage(0.9, 'Almost there');
  if (frames >= 3 && fonts){ frames = -1; boot.done(); }
}
