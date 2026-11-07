// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Wait on the GAME's clock, not the wall's. On a slow software-GL runner (CI, two to four browsers at once) the game can
// run at a tenth of real time, since a frame's step is capped (main.js), so "foes arrive within 30 seconds" measured in
// real seconds is a coin toss. waitGame polls `fn` in `page` until it is truthy, and fails once `clock`'s G.gt has moved
// on `gameSeconds` without it (or, with the game stopped, after `wallMs` of real time).
export async function waitGame(page, fn, arg, { gameSeconds = 30, wallMs = 240000, clock = page, what = 'the condition' } = {}){
  const gt = () => clock.evaluate(() => GAME.G.gt);
  const gt0 = await gt(), wall = Date.now() + wallMs;
  for (;;){
    const v = await page.evaluate(fn, arg);
    if (v) return v;
    const spent = (await gt()) - gt0;
    if (spent > gameSeconds || Date.now() > wall) throw new Error(`waitGame: ${what} not met in ${spent.toFixed(1)} game seconds (${((wallMs - (wall - Date.now())) / 1000).toFixed(0)}s real)`);
    await page.waitForTimeout(250);
  }
}
