// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// HOW EACH CHAPTER'S OPENING IS STAGED (game/cutscene.js playOpening), per story, by chapter id. Edit freely.
//
// A chapter's opening plays its scene (the chapter's `talk`) on the field, with the people talking standing there
// (data/cast.js), then its `opening` lines, then the GOAL: the camera looks out over the field and the one line that
// says what you are there to do comes up. Per chapter:
//   goal   that line (short: what to do, not why; the scene has just said why)
//   holo   speakers who are somewhere else: they stand in as a flickering blue hologram (a call, a transmission)
//   off    speakers heard only over comms: no figure at all (the hero listens; the line carries a comms mark)
//   on     the story's voice in person (by default the voice is in the hero's ear unless the talk has them there)
//   stay   false: nobody stays on the field after this opening (by default whoever data/cast.js marks `stays` and was
//          there in person hangs back behind the hero for walk-up lines: game/onset.js)
//   where  replaces the talk's own place line under the scene (null: none). The talk's `where` was written for the card;
//          a scene staged on the chapter's own ground drops a "where" that would contradict it
//   oneshot  true: the scene never cuts (God of War style): the lens drifts off the play camera to whoever speaks and
//          settles back onto it, with no letterbox (game/cutscene.js oneLens). Set on the openings that are a talk face
//          to face, on the ground the fight is on, with nobody walking on from across the field. Left off: the trials
//          (the one you talk to is the one you fight next), a rival's entrance or a chase (they want their cuts), a talk
//          held aboard a ship or over comms (a wide look at a new place reads better), and hologram calls
// Anyone in the lines not listed stands there in person, if data/cast.js has a figure for them.

export const STAGE = {
  jedi: {
    'last-lesson': { goal: 'Training blades, first to yield. Beat Ilsa.', on: ['MASTER VAEL'] },
    siege: { goal: 'Hold the temple steps. Keep the Empire off the doors.', where: 'THE TEMPLE STEPS, BEFORE DAWN', oneshot: true },
    archive: { goal: 'Get the archivists out, then reach the Ledger\'s vault.', off: ['MASTER VAEL'] },
    refuge: { goal: 'Hold the ramp until the last transport is loaded.', off: ['MASTER VAEL'] },
    'trial-first': { goal: 'Trial: break the Wall\'s guard and beat Tarn Odo.', off: ['MASTER VAEL'] },
    lothal: { goal: 'Walk RX-4 to the gate and open the pens.', off: ['MASTER VAEL'] },
    'trial-acrobat': { goal: 'Trial: ground Sera Quill and beat her.', off: ['MASTER VAEL'] },
    hoth: { goal: 'Hold the trenches until the transports clear the shield.', off: ['MASTER VAEL'], oneshot: true },
    'trial-knight': { goal: 'Trial: parry General Kast and beat her.', off: ['MASTER VAEL'] },
    jakku: { goal: 'Pull the nav cores from the wrecks before the salvage crews burn them.', off: ['MASTER VAEL'] },
    mustafar: { goal: 'Break the academy and get its children out.', on: ['MASTER VAEL'], oneshot: true },
    chase: { goal: 'Run Ilsa down before she reaches her ship.', off: ['GENERAL KAST'] },
    return: { goal: 'Break the three seals and open the Sith gate.', where: 'JEDHA, THE TEMPLE STEPS AT NIGHT', oneshot: true },
    spearhead: { goal: 'Take the forward posts and break the line before the Citadel door.', on: ['GENERAL KAST'], oneshot: true },
    chains: { goal: 'Break the chains and get the children out.', off: ['MASTER VAEL'], oneshot: true },
    exegol: { goal: 'Fight through his guard to the throne. End Darth Vexis.', on: ['GENERAL KAST'], oneshot: true },
  },
  mando: {
    siege: { goal: 'It is an ambush. Fight your way to the landing pad.', holo: ['ROOK'], where: 'SALT HOLLOW, ORVANE' },
    archive: { goal: 'Clear the upper yard so the clan can reach the hangar.', where: 'THE CANYON, AT DUSK' },
    refuge: { goal: 'Hold the ramp, kill the jammers, then deal with the droid.', oneshot: true },
    'trial-first': { goal: 'Answer Kael Varr\'s challenge. Put him on the ground.' },
    lothal: { goal: 'Open the three locks, free the prisoners, and take the warden.', holo: ['THE ARMORER'], where: 'THE GALLOWS, IN THE STORM' },
    'trial-acrobat': { goal: 'Keep Skye on the ground, and beat her.' },
    hoth: { goal: 'Hold the gate, light the signal cairns, and get the foundlings out.', holo: ['THE ARMORER'], where: 'THE HOLDFAST ON THANE' },
    'trial-knight': { goal: 'Beskar to beskar. Beat Brakka.' },
    jakku: { goal: 'Pull the nav cores from the old wrecks.', holo: ['OSSIK VANE', 'SKYE'] },
    mustafar: { goal: 'Break the meltworks. If Rook is here, bring him out.', holo: ['THE ARMORER'], where: 'THE MELTWORKS, CALDUS' },
    chase: { goal: 'Run VX-7 down before it lifts off.', holo: ['THE IRON MAGISTRATE', 'SKYE'] },
    spearhead: { goal: 'Take the iron road and break the citadel gate.', where: 'THE IRON ROAD, DUREN' },
    exegol: { goal: 'Through the Iron Guard, then through the Magistrate.', holo: ['THE IRON MAGISTRATE', 'ROOK'] },
  },
  trooper: {
    order: { goal: 'Get General Kast to the ship. Hold off the company.' },
    siege: { goal: 'Hold the yard. Keep the purge troopers off the freighter.', oneshot: true },
    archive: { goal: 'Breach all three rooms and bring Brisk home.', oneshot: true },
    refuge: { goal: 'Get the Halcyon\'s power back up and pull the chip files.', where: 'THE HALCYON, ADRIFT' },
    'trial-first': { goal: 'Take every post as one squad.', oneshot: true },
    lothal: { goal: 'Reach the archive and get the batch file before the sea does.', where: 'TIPOCA CITY\'S LOWER LEVELS' },
    'trial-acrobat': { goal: 'Run the Marshal\'s old course and beat his time.', off: ['THE CAPTAIN'] },
    hoth: { goal: 'Hold the forward trench beside Kast\'s clones.', oneshot: true },
    'trial-knight': { goal: 'Trial: beat General Kast.' },
    jakku: { goal: 'Find out what the foundry makes, and shut it down.', off: ['THE CAPTAIN'] },
    mustafar: { goal: 'Take the gate, hold it, and reach his command post.', off: ['THE CAPTAIN'] },
    spearhead: { oneshot: true },
  },
};
