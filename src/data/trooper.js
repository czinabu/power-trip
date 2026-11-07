// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// CLONE ARC TROOPER kit tuning. Edit freely.
// The trooper is a GUNNER like the Mando (state.js isGunner): it shares the reticle, bolts, heat and hit markers, but
// it fights on foot with no jetpack, leads a clone squad, and its guns are its own (TROOPER_WEAPONS below).
// STILL TO BUILD: its cutscene lines (the Mando's for now) and its own DC-15 model (the
// carbine's for now).

/* WEAPONS — the same fields as data/mando.js MANDO_WEAPONS (heat, cool, spreads, falloff), plus:
     fire 'burst'  the DC-15 rifle: one click fires `burst` bolts `burstGap` apart. RMB aims (the steady stance)
     fire 'twin'   the twin DC-17s, semi-auto: each LMB click fires the other pistol (each on its own `fireCd`, no two
                   shots closer than `twinGap`), a heat bar each (one cooks off, the other fires on); RMB aims
     col           the bolt colour (clone blue, where the Mando's run orange) */
export const TROOPER_WEAPONS = {
  rifle:   { name: 'DC-15 RIFLE', short: 'DC-15', fire: 'burst', burst: 3, burstGap: 0.075, fireCd: 0.36, dmg: 15, dual: false, col: 0x4aa8ff,
             heat: 0.075, cool: 0.62, overCool: 0.45, hipSpread: 0.012, braceSpread: 0.003, braceDmg: 1.1, foStart: 20, foEnd: 46, foMin: 0.55,
             twoHand: true, vent: 0.5, trooper: true },
  pistols: { name: 'TWIN DC-17s', short: 'DC-17s', fire: 'twin', fireCd: 0.15, twinGap: 0.07, dmg: 21, dual: true, col: 0x6ab8ff,
             heat: 0.07, cool: 0.8, overCool: 0.52, hipSpread: 0.014, braceSpread: 0.006, braceDmg: 1, foStart: 10, foEnd: 26, foMin: 0.4,
             vent: 0.5, trooper: true },
  // the Commando's anti-armour module (key 3): one heavy rocket a pull, a long reload between, and it cooks the gun
  launcher: { name: 'AT LAUNCHER', short: 'LAUNCHER', fire: 'launcher', fireCd: 2.6, dmg: 100, radius: 3.4, knock: 26, speed: 30, dual: false, col: 0xffa04a,
              heat: 0.45, cool: 0.5, overCool: 0.4, hipSpread: 0, braceSpread: 0, braceDmg: 1, foStart: 999, foEnd: 999, foMin: 1,
              twoHand: true, vent: 0.9, trooper: true },
};
/* THE MODULAR DC-15 — one rifle, its MODULES swapped by pressing 1 again while it's in hand (player/trooper/kit.js
   swapModule). Each is the rifle's own numbers with these laid over; the run hands them over (data/trooper-progression.js
   TROOPER_AUTO: `unlock` is the G.unlocked key). The heat stays with the gun through a swap.
     burst     the stock rifle (above): a three-bolt burst a click
     auto      AUTO BARREL: hold LMB to fire, lighter bolts, more heat and a wider cone: the crowd and suppression module
     marksman  MARKSMAN SCOPE: one heavy bolt a click with a long reach; RMB raises the scope (zoomed, dead steady)
   Each also changes the gun you see (model/weapons.js dc15: its module parts) and the shot you feel:
     size  the bolt's thickness · kick  the recoil · chatter  a light, quick report · heavy  a deep crack and more shake */
export const RIFLE_MODS = {
  burst:    { label: 'BURST' },
  auto:     { label: 'AUTO BARREL', unlock: 'modAuto', fire: 'auto', fireCd: 0.1, dmg: 11, heat: 0.036, cool: 0.55, overCool: 0.42,
              hipSpread: 0.022, braceSpread: 0.009, foStart: 16, foEnd: 38, size: 1.15, kick: 0.14, chatter: true },
  marksman: { label: 'MARKSMAN SCOPE', unlock: 'modScope', fire: 'semi', fireCd: 0.8, dmg: 58, heat: 0.2, cool: 0.55, overCool: 0.42,
              hipSpread: 0.012, braceSpread: 0, braceDmg: 1.25, foStart: 40, foEnd: 80, foMin: 0.8, scope: true, vent: 0.6,
              size: 2.4, kick: 0.6, heavy: true, col: 0xa8ecff },
};
export const RIFLE_MOD_ORDER = ['burst', 'auto', 'marksman'];
{ const R = TROOPER_WEAPONS.rifle;   // each module as a whole weapon (mando/weapons.js mandoWeapon returns it while it's fitted)
  R.mods = {};
  for (const k of RIFLE_MOD_ORDER) if (k !== 'burst') R.mods[k] = { ...R, ...RIFLE_MODS[k], mods: null, mod: k, name: 'DC-15 · ' + RIFLE_MODS[k].label, short: 'DC-15 · ' + RIFLE_MODS[k].label.split(' ')[0] }; }
export const TROOPER_WEAPON_ORDER = ['rifle', 'pistols', 'launcher'];
// THE ARMORY PAGE's words for each of his guns (ui/armory-ui.js: the trooper's side). Each DC-15 module is its own entry,
// since each has its own signature move and mastery (data/gun-moves.js). `unlock` as RIFLE_MODS.
export const TROOPER_ARMORY = {
  burst:    { name: 'DC-15 · BURST', slot: 'RIFLE · 1', tag: 'THE STANDARD', col: 0x4aa8ff,
              best: 'Troopers at any range, heads above cover', lore: 'The stock DC-15: three bolts a pull, and every clone learns it first.' },
  auto:     { name: 'DC-15 · AUTO BARREL', slot: 'RIFLE · 1 AGAIN', tag: 'SUPPRESSION', col: 0x6ab8ff, unlock: 'modAuto',
              best: 'Crowds, and pinning a line so the squad can move', lore: 'A barrel built to keep firing. Lighter bolts, and a lot of them.' },
  marksman: { name: 'DC-15 · MARKSMAN', slot: 'RIFLE · 1 AGAIN', tag: 'PRECISION', col: 0xa8ecff, unlock: 'modScope',
              best: 'Officers, snipers, anything far off', lore: 'A scope and a heavy cell. One shot, placed.' },
  pistols:  { name: 'TWIN DC-17s', slot: 'SIDEARMS · 2', tag: 'ON THE MOVE', col: 0x6ab8ff,
              best: 'Close work, and fire on the way to the next cover', lore: 'A pistol in each hand, firing in turn. They shoot straight out of a sprint or a slide.' },
};
// the trooper's guns borrow the Mando's held-weapon models and poses for now: the rifle is the carbine's model on the
// long-gun mount, the pistols the dual blasters (player/animation.js, holster.js, model/weapons.js)
export const GUN_LOOK = { rifle: 'carbine', pistols: 'dual', launcher: 'repeater' };
export const gunLook = (w) => GUN_LOOK[w] || w;

export const TROOPER = {
  /* COMMAND POINTS (player/trooper/command.js): earned in the fight, spent on the orders that matter and the
     battlefield calls (T). ON ME, MOVE, HOLD, COVER and GET THEM UP stay free */
  command: {
    max: 100, start: 30,
    gain: { kill: 5, elite: 12, squadKill: 3 },
    cost: { attack: 10, grenade: 15, suppress: 15 },
    // SUPPRESS: for `time` the squad fires `fire` × as often on the foes within `radius` of the point; a foe its bolts
    // hit is PINNED for `pin` s: it moves at `slow` × and coils its shots `windup` × as long
    suppress: { time: 8, radius: 8, fire: 0.5, pin: 2.5, slow: 0.35, windup: 1.6, prefer: 8 },
    // FLANK: ATTACK TARGET sends the first two standing squadmates round the mark, `wide` m to its sides and `back` m
    // beyond it (seen from the hero); off the hero's line, their bolts on it hit `dmg` × as hard
    flank: { wide: 6.5, back: 1.5, dmg: 1.5 },
    // BATTLEFIELD CALLS (T): REINFORCE when someone is down (everyone up now), otherwise a SUPPLY DROP that lands beside
    // you after `delay`: grenades topped up, the guns cooled, `heal` of your health back
    supply: { cost: 30, delay: 1.2, heal: 0.15, cd: 5 },
    reinforce: { cost: 40, cd: 5 },
  },
  // ACTIVE VENT (R) while overheated: press inside the window (seconds into the overheat) for a perfect vent that
  // clears the gun at once; press outside it and the gun jams for `jam` more seconds. Not overheated, R is a plain vent.
  vent: { window: [0.35, 0.7], jam: 0.7 },
  // FRAG GRENADE (G): cooked onto the crosshair. Charges refill one at a time.
  frag: { charges: 2, recharge: 11, reach: 24, minRange: 3, fuse: 1.1, dmg: 70, radius: 5.5, knock: 20, flight: [0.35, 0.9] },
  // RIFLE BASH (E): a short shove with the stock that staggers whoever is right in front
  bash: { range: 2.6, arc: 0.9, dmg: 14, knock: 9, stun: 0.9, cd: 0.7 },
  squadMin: 2,   // the trooper always brings at least this many clones, in every mode that allows a squad
  /* COVER (C, pad L3: player/trooper/cover.js). No jetpack, no blade, thin plate: he lives behind things. C beside a
     crate, wall or pillar puts his back to it; A/D slides along it; held aim (RMB) or the trigger LEANS him out to
     shoot (over LOW cover he rises, round TALL cover he steps out at the edge); let go and he ducks back. C again, a
     jump (over low cover: a vault) or walking away leaves it. C at a run or a sprint with cover ahead slides him into it.
       reach   C finds a face this close (body centre to face, m)
       minH    a solid at least this tall over the feet is cover · below `tallH` it's LOW (crouch behind, rise to shoot)
       hug     body centre to the face while in it · `move` the shuffle along it (× run speed) · `edge` how far in from
               a box's end he can shuffle; past it he's at the EDGE of tall cover, where he can lean round it
       lean    round tall cover the lean steps him this far past the edge · `peek` the trigger alone pops him out for
               this long after the last shot · `rise` s to come up / duck down
       hidden  damage × from in front of the cover while ducked · `peekDr` while leaning out to shoot · from the side or
               behind (a flank) the cover does nothing
       leave   s of walking straight away from the face before he steps out of it · `offEnd` s of pushing on past a
               bare end of it (nothing carries the face on) before he walks off it
       slideMin  over this speed (m/s), C with cover `slideAhead` m ahead is a SLIDE INTO COVER, leaving at no less than
               `slideSpeed` and easing out onto the face · `slideReach` cover this near the end of a plain slide takes him in
       snap    s the step onto the face takes, from wherever C was pressed · `minR` a column thinner than this is a pole,
               not cover */
  cover: { reach: 1.75, slideReach: 2.4, slideMin: 4, slideAhead: 7, slideSpeed: 10, minH: 0.95, tallH: 1.85, hug: 0.66, move: 0.55, edge: 0.35,
           lean: 0.75, peek: 0.5, rise: 0.14, hidden: 0.3, peekDr: 0.45, front: 0.25, leave: 0.22, offEnd: 0.5, snap: 0.16, minR: 0.35 },
  /* ARMOUR: clone plate, not beskar. Out in the open (not in cover) every hit lands `open` × as hard;
     in cover the face does the soaking (cover.hidden / peekDr above). The signature fork moves both: data/trooper-progression.js */
  armor: { open: 1.22 },
  /* SUPPRESSION, both ways.
     ON HIM: a hostile bolt that tears past within `near` m adds `perBolt` (a hit adds `perHit`), up to 1; it drains at
     `decay` a second (`coverDecay` ducked in cover). Past `from` it shakes his aim (spread × up to 1 + `spread`), greys
     the edges of the screen and slows his feet (`slow` at full). Ducking into cover is the cure.
     BY HIM: his own bolts that pass within `near` m of a foe (or hit it) add `perBolt` / `perHit` to its fear; at 1 the
     foe is PINNED for `pin` s (the squad's SUPPRESS order: it crawls and takes its time over its shots), and a pinned
     line trooper ducks to cover if it has one. A foe's fear drains at `decay` a second. */
  suppress: {
    onHero: { near: 2.4, perBolt: 0.09, perHit: 0.14, decay: 0.32, coverDecay: 0.9, from: 0.35, spread: 2.2, slow: 0.82 },
    onFoe:  { near: 1.8, perBolt: 0.11, perHit: 0.16, decay: 0.45, pin: 2.2, duck: 1.2 },
  },
  // JUMP: no pack under him. A short, heavy hop (× CFG.player.jumpVel) that falls harder than it rose (× gravity): enough to
  // vault, climb and clear a step, never a bound. No wall-runs, no wall-kicks. In the air the keys only nudge him.
  jump: { vel: 0.7, fall: 1.7, airControl: 0.3, diveWindow: 0.7 },   // `diveWindow`: SPACE again within this many s of the hop is the combat dive
  // SPRINT (hold SHIFT, pad B: player/trooper/sprint.js): forward at `mul` × his run. No dive, no jetpack: he runs for it
  sprint: { mul: 1.4 },
  // ---- the powers the run hands over or lets him choose (data/trooper-progression.js), cast in player/trooper/abilities.js.
  // Each spends ability energy (the bar under vitality) and has a cooldown; mastery ranks (data/mastery.js) retune them.
  // RECON SCAN (Q): a pulse that marks every foe within `range` for `time` s: marked foes take `mark`× damage from
  // everyone, the squad included, and show a tag over their heads
  scan: { cost: 24, cd: 12, range: 32, time: 7, mark: 1.2 },
  // BUBBLE SHIELD (V): a dome thrown down where he stands. Enemy bolts that reach it stop dead; it lasts `time` s
  shield: { cost: 40, cd: 18, radius: 4.2, time: 7 },
  // FIELD MEDIC: the squad's medic joins, revives take `revive`× as long, and every squadmate (and the hero) slowly
  // knits `regen` vitality a second while out of a fight's hit for 3 s
  medic: { revive: 0.55, regen: 2.5 },
  // ION GRENADE (F): lobbed like a frag; foes in the blast are stunned for `stun` s (droids and jet troopers twice as
  // long), shields drop, and little damage is done
  ion: { cost: 30, cd: 10, reach: 24, minRange: 3, fuse: 0.9, radius: 6, stun: 2.2, dmg: 14 },
  // BREACH CHARGE (F): slapped on the ground ahead, it blows after `fuse` s in a forward cone: big damage and a launch
  breach: { cost: 34, cd: 11, fuse: 1.2, range: 9, arc: 0.85, dmg: 95, knock: 30, lift: 9 },
  // ARTILLERY BARRAGE (Z, Commander): `shells` shells land round the crosshair `delay` s after the call, `gap` s apart
  artillery: { cost: 60, cd: 20, delay: 1.3, shells: 6, gap: 0.22, spread: 4.5, radius: 4.5, dmg: 75, knock: 22, reach: 40 },
  // ANTI-ARMOUR LAUNCHER (3, Commando): a slow, heavy rocket off the rifle's launcher module
  launcher: { dmg: 1.1 },
  /* THE SIGNATURE FORK (data/trooper-progression.js), balanced against each other in tools/trooper-sim (plan forks):
     ARC COMMANDER  the squad's damage: squad bolts × squadDmg, his own shots out of cover × coverDmg, and a little
                    grit (damage taken × taken)
     COMMANDO       the front line: +hp vitality, the open-ground penalty × open (1 / armor.open: gone), what cover lets
                    through × cover, a braced aim
                    (RMB, feet planted) takes × brace from in front, foes turn on the squad × taunt as often, suppression
                    builds × suppRes as fast, and a little more punch (his damage × dmg) */
  fork: {
    commander: { squadDmg: 1.3, coverDmg: 1.15, taken: 0.9 },
    commando:  { dmg: 1.1, hp: 40, open: 1 / 1.22, cover: 0.85, brace: 0.72, taunt: 0.35, suppRes: 0.55 },
  },
  // GUNSHIP STRAFING RUN (X, the final power): a gunship flies a line from the hero toward the crosshair and lays
  // `blasts` blasts along it, `gap` s apart
  strafe: { cost: 80, cd: 26, length: 34, blasts: 9, gap: 0.12, delay: 1.0, radius: 3.8, dmg: 70, knock: 18 },
};
