// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// DUEL MODE's hooks into the fight code (no imports, so player/ and enemies/ can read them without a cycle). Each is null
// until game/duel-mode.js and net/pvp.js fill it in, and none of them does anything outside a duel (G.duel).
//   bodies()            the other fighter's body for the blade sweep (player/jedi/bladehit.js): [{ duelBody, pos, r, h }]
//   swingStart(sw)      a cut has just started (player/jedi/combat.js tryAttack): sent the instant it starts
//   swingHit(body, b)   the blade reached the other fighter (combat.js applySwingDamage): sent for them to judge
//   power(kind, aim, A) a push or a pull was cast (player/jedi/force.js): does it catch the other fighter
//   taken(dmg, opts, chip) a blow landed on this hero (player/damage.js hurtPlayer), whoever struck it
//   shot(b, color, scale) a gunner's bolt left the barrel (player/mando/weapons.js spawnBlasterBolt): true if it was sent
//   boltDone(b, res)    a foe's bolt (b.pvp) was spent or turned on this screen (enemies/bolts.js): hit, blocked, deflected...
//   flame(aim, range, cosLim, dmg, dt) the flamer's stream this frame (player/mando/weapons.js updateFlame)
export const duelHooks = { bodies: null, swingStart: null, swingHit: null, power: null, taken: null, shot: null, boltDone: null, flame: null };
