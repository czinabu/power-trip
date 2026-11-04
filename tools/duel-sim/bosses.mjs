// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DUEL SIM — the boss duels (sim.mjs plan `bosses`, clip.mjs): Darth Vexis, survival's warbringer and the Jedi story's
// named duellists, set up the way their missions set them up (data/missions.js duel entries, game/mission.js
// spawnInquisitor: hp × the duellist's, dmg ×, a rematch's duel overrides, a master's repertoire), at the depth of the
// run they're met at. hpm(depth) is a campaign foe's health that deep.
export function bossFoes(hpm){
  const champ = (form, rank, hp, dmg, depth, extra = {}) => ({ depth, foes: [{ type: 'acolyte', form, rank, hpMul: hpm(depth), champ: { hp, dmg, ...extra } }] });
  return {
    vexis:       { depth: 20, tmax: 300, foes: [{ type: 'vexis' }] },
    warbringer:  { depth: 10, tmax: 150, foes: [{ type: 'warbringer' }] },
    inquisitor:  champ('ataru', 'knight', 4, 1.1, 4),                                    // the refuge (act I)
    warden:      champ('djemso', 'knight', 4.5, 1.15, 9),                                // the archive (act II)
    rematch:     champ('ataru', 'knight', 5.5, 1.3, 14, { duel: { block: 0.78, posture: 170, feint: 0.45, chain: 3, counter: 0.6 } }),   // the act III rematch
    grand:       champ('djemso', 'master', 4.5, 1.2, 18, { rep: ['djemso', 'ataru', 'soresu'] }),   // the Grand Inquisitor
    trialknight: champ('djemso', 'master', 4.5, 1.1, 14),                                // the Trial of the Knight
  };
}
