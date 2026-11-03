// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SABER FINISHERS and PERFECT STRINGS, as data. player/jedi/finisher.js runs them.

/* SABER FINISHERS — break a foe's guard (GUARD BROKEN, POSTURE BROKEN, or a duellist reeling off a parry) and the next
   attack on it, in reach and in front of you, is that form's finisher instead of a plain cut. It is the hero's own
   move, never a paired animation: the foe is just held in its stagger until the last blow lands, so it stays the same
   in co-op and in a crowd.
   reach / cone   how far (m, past its body) and how square in front (the dot of the view to it) the foe has to be
   hurt           what a blow that lands on you while you finish does (× damage: you are not invincible; a light blow
                  doesn't knock it loose, a heavy one does: player/damage.js)
   hold           seconds the foe stays reeling past the finisher's last beat
   kill           everything finishable that isn't tough dies to the last blow
   tough          a rank IV duellist (master), a named champion, the Warbringer and every boss: they take `survive` of
                  their health over the whole finisher (Makashi more: its `duel` edge) and are floored, never killed
                  outright, unless that was the last of it
   escape         the chance a duellist of that rank slips out of the window before the blade arrives (a broken guard
                  is a chance, not a certain kill); the attack is then a plain cut
   slowmo / cam   the beat's dip in game speed on the killing blow, and the camera's push in (Settings: FINISHERS) */
export const FINISHER = {
  reach: 3.2, cone: 0.7, hurt: 0.5, hold: 0.35,
  survive: 0.25, minor: 0.05,
  escape: { knight: 0.08, master: 0.2, champion: 0.2 },
  slowmo: { k: 0.35, t: 0.22 }, cam: 5,
  // the foes a finisher can be landed on: the blade foes with a posture bar, the brute, the staff and saber duellists
  types: { grunt: 1, phalanx: 1, duelist: 1, acolyte: 1, brute: 1, lancer: 1 },
};

/* EACH FORM'S FINISHER — a short run of beats, each one a saber cut from the form's own keyframes (data/poses.js
   SWINGS: left right forward back diagL diagR riseL riseR thrust), played straight after each other.
   pat     the cut · dur: seconds · spin: whole turns of the body through it · hop: how high it leaves the ground (m)
   travel  metres it carries the body toward the foe; 'past' carries it right past and out behind (Ataru, Shien)
   share   the part of the finisher's damage this beat lands on the foe (the last beat is the kill)
   edge    what the beat does besides (finisher.js EDGES): sweep (cuts everything round you) · shock (a shockwave that
           staggers foes close by) · duel (tough foes take half as much again) · guard (a soak straight after: you are
           guarding again) · stam / force / fury (a refund) · parry (a wider parry window for a while) · both (the staff's
           far blade cuts behind) · clang (beskar)
   fx      what the beat looks like besides the cut: bind (blades meet and wrench) · palm (a Force palm) · kneel (the
           blow drives the foe's knees down) */
export const FINISHERS = {
  shiicho: { name: "SARLACC'S JAW", line: 'A rising cut through the foe, then the full Sarlacc turn: everything around you is cut', beats: [
    { pat: 'riseR', dur: 0.3, travel: 0.6, share: 0.35 },
    { pat: 'right', dur: 0.56, spin: 1, share: 0.65, edge: 'sweep' },
  ] },
  makashi: { name: 'CONTRE-TEMPS', line: 'A beat of its blade aside, then one straight lunge: the fastest, and half as hard again on tough duellists', beats: [
    { pat: 'diagL', dur: 0.2, share: 0.1, fx: 'bind' },
    { pat: 'thrust', dur: 0.42, travel: 1.3, share: 0.9, edge: 'duel' },
  ] },
  soresu: { name: "THE WALL'S ANSWER", line: 'Bind its blade, wrench it wide, one short cut, and your guard is up again', beats: [
    { pat: 'riseL', dur: 0.26, share: 0.1, fx: 'bind' },
    { pat: 'right', dur: 0.34, share: 0.9, edge: 'guard' },
  ] },
  ataru: { name: 'HAWK-BAT VAULT', line: 'Spring over its shoulder and cut on the way down: you land behind it, away from the crowd in front', beats: [
    { pat: 'forward', dur: 0.66, spin: 1, hop: 1.25, travel: 'past', share: 1 },
  ] },
  djemso: { name: "SKYWALKER'S HAMMER", line: 'Two crushing blows drive it to its knees, the third ends it: the shockwave staggers foes close by', beats: [
    { pat: 'diagL', dur: 0.3, share: 0.15, fx: 'kneel' },
    { pat: 'diagR', dur: 0.3, share: 0.15, fx: 'kneel' },
    { pat: 'forward', dur: 0.5, hop: 0.15, travel: 0.5, share: 0.7, edge: 'shock', fx: 'kneel' },
  ] },
  shien: { name: 'TOGRUTA PASS', line: 'A reverse-grip spin past the foe, the blade drawn across it as you go: you end behind it, breath back', beats: [
    { pat: 'right', dur: 0.6, spin: 1, travel: 'past', share: 1, edge: 'stam' },
  ] },
  niman: { name: 'PALM AND BLADE', line: 'A Force palm throws it back off its feet and the cut follows it: Force back', beats: [
    { pat: 'thrust', dur: 0.3, share: 0.15, fx: 'palm' },
    { pat: 'diagR', dur: 0.42, travel: 0.9, share: 0.85, edge: 'force' },
  ] },
  juyo: { name: 'UNCHAINED', line: 'Three savage cuts in a blur: fury to the top', beats: [
    { pat: 'diagR', dur: 0.22, share: 0.2 },
    { pat: 'diagL', dur: 0.22, share: 0.2 },
    { pat: 'forward', dur: 0.44, spin: 1, hop: 0.35, share: 0.6, edge: 'fury' },
  ] },
  vaapad: { name: 'SHATTERPOINT', line: 'A still beat, then one sudden severing cut: a wider parry window for a few seconds after', beats: [
    { pat: 'forward', dur: 0.72, travel: 0.4, share: 1, edge: 'parry' },
  ] },
  staff: { name: "MAUL'S WHEEL", line: 'The staff wheeled right round, both blades cutting, then brought down on it', beats: [
    { pat: 'right', dur: 0.44, spin: 1, share: 0.3, edge: 'both' },
    { pat: 'forward', dur: 0.44, hop: 0.2, travel: 0.4, share: 0.7 },
  ] },
  darksaber: { name: "MAND'ALOR'S VERDICT", line: 'A cut, then the darksaber two-handed overhead, beskar ringing', beats: [
    { pat: 'diagL', dur: 0.34, share: 0.2 },
    { pat: 'forward', dur: 0.56, hop: 0.1, travel: 0.4, share: 0.8, edge: 'clang', fx: 'kneel' },
  ] },
};

/* EDGES — the numbers behind each beat's `edge` */
export const EDGES = {
  sweep: { r: 3.4, dmg: 0.8 },          // every other foe within r m takes dmg × a finisher cut, all the way round
  both:  { r: 3.0, dmg: 0.6 },          // the staff's far blade: the same, behind you
  shock: { r: 3.2, push: 2.2 },         // foes within r m reel (staggered), shoved back
  duel:  { mul: 1.5 },                  // a tough foe takes the finisher × this
  guard: { soak: 0.7 },                 // seconds of the heavy-cancel soak after (player.cancelDR)
  stam:  { n: 28 }, force: { n: 25 }, fury: { n: 1 },   // refunds (fury: a share of the full meter)
  parry: { t: 4, bonus: 0.06 },         // seconds, and seconds added to the parry window
};

/* PERFECT STRINGS — a string struck fully in rhythm (both links into the third cut were clean, single presses in the
   back half of the swing, never a mash) plays its third-hit finisher's PERFECT version: the same move, bigger, harder.
   dmg / knock / posture   × on the finisher cut (posture: extra strain on a guard that turns it)
   focus  extra Force Focus on top of a finisher's
   per form: spin (turns added), hop (m added), lunge (× the step in), dur (× the cut's time, to fit the extra turn) */
export const PERFECT = {
  dmg: 1.25, knock: 1.2, posture: 1.25, focus: 0.5,
  forms: {
    shiicho:  { spin: 1, dur: 1.15 },
    makashi:  { lunge: 1.5 },
    soresu:   { lunge: 1.2 },
    ataru:    { hop: 0.4 },
    djemso:   { hop: 0.25, lunge: 1.2 },
    shien:    { spin: 1, dur: 1.15 },
    niman:    { hop: 0.2 },
    juyo:     { spin: 1, dur: 1.1 },
    vaapad:   { lunge: 1.3 },
    staff:    { spin: 1, dur: 1.15 },
    darksaber:{ hop: 0.2, lunge: 1.2 },
  },
};
