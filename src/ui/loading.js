// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// The loading screen into a mode: the boot loader (index.html #boot, styles/boot.css) comes back over the screen whenever
// a run is built (campaign, a mission, survival, training, the sandbox, a co-op join, a retry or a restart). Building a
// level (the arena, its foes, every shader the fight will need) holds the page for a moment; without this the menu just
// froze on its last frame. The screen is painted FIRST, the build waits for that paint, and the screen lifts once the
// new level has drawn a few frames, so it never flashes the half-built world.

const el = () => document.getElementById('boot');
let loading = false, lift = 0;

// the blade's progress (0..1) and the line under it, as the boot loader shows them
function stage(b, p, label){
  b.querySelector('.bt-blade').style.setProperty('--p', p.toFixed(3));
  if (label) b.querySelector('.bt-status').textContent = label;
}
const frame = () => new Promise(r => requestAnimationFrame(() => r()));

export const loadingNow = () => loading;

/* run `build` (the synchronous start of a mode) behind the loading screen. `stillWanted`, when given, is asked once the
   screen is up: false (the player backed out to the menu in the meantime) skips the build and lifts the screen. */
export async function loadInto(build, stillWanted){
  const b = el();
  if (!b){ build(); return; }   // (a page without the loader: build as before)
  if (loading) return;          // already on the way in (a second lock event, a double click)
  loading = true; clearTimeout(lift);
  // up at once, fully opaque, the blade a third out: no fade or slide in (the build holds the page, and would freeze a
  // transition half-way), the menu just gives way to it
  const blade = b.querySelector('.bt-blade');
  blade.style.transition = 'none';
  stage(b, 0.32, 'Building the world');
  b.hidden = false; b.classList.remove('out'); b.classList.add('again');
  void blade.offsetWidth;   // (the jump lands before the transition comes back)
  blade.style.transition = '';
  // two frames: the first rAF runs before that frame's paint, the second after it, so the screen is on the glass
  // before the build holds the page
  await frame(); await frame();
  if (stillWanted && !stillWanted()){ finish(b); return; }
  try { build(); }
  catch (err){ finish(b); throw err; }
  stage(b, 0.86, 'Almost there');
  // three frames of the new level (its first picture, any program still linking), then the screen goes
  for (let i = 0; i < 3; i++) await frame();
  finish(b);
}
function finish(b){
  stage(b, 1, 'Ready');
  loading = false;
  lift = setTimeout(() => {
    b.classList.add('out');
    lift = setTimeout(() => { if (!loading) b.hidden = true; }, 600);
  }, 160);
}
