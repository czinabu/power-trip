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
    inquisitor:  champ('ataru', 'knight', 4, 1.1, 4, { duel: { block: 0.72, posture: 160, feint: 0.3, chain: 2, counter: 0.5 },
                       rage: 0.55, rageDuel: { feint: 0.45, delay: 0.45, chain: 3, thrust: 0.2 } }),   // the refuge (act I)
    warden:      champ('djemso', 'knight', 4.5, 1.15, 9, { duel: { block: 0.78, posture: 170, feint: 0.4, chain: 2, counter: 0.6 },
                       rage: 0.5, rageDuel: { feint: 0.42, delay: 0.35, chain: 3, thrust: 0.2 } }),   // the gate (SPEARHEAD)
    rematch:     champ('ataru', 'knight', 5.3, 1.25, 14, { duel: { block: 0.78, posture: 170, feint: 0.42, chain: 3, counter: 0.6 },
                       rage: 0.5, rageDuel: { feint: 0.52, delay: 0.35, chain: 3, thrust: 0.3 } }),   // the act III rematch
    grand:       champ('djemso', 'master', 4.3, 1.12, 18, { rep: ['djemso', 'ataru', 'soresu'], duel: { posture: 170, feint: 0.35, chain: 3, counter: 0.5 },
                       rage: 0.5, rageDuel: { feint: 0.4, delay: 0.3, chain: 3 } }),   // the Grand Inquisitor
    trialknight: champ('djemso', 'master', 4, 1, 14, { duel: { block: 0.72, posture: 160, feint: 0.3, chain: 2, counter: 0.55 },
                       rage: 0.45, rageDuel: { chain: 3, counter: 0.6 } }),   // the Trial of the Knight
  };
}
