// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE WELCOME: the first time a save file walks into a hub (data/hub.js HUBS), once the wing's name has faded, who lives
// here says hello on a small panel to the side, and a beacon walks the hero past a few of the stations, ending at the one
// that starts a first run. Nothing covers the screen and nothing waits on it. game/hub-welcome.js runs it. Any map or
// waystone has SHOW ME AROUND (the walk again) and WHAT'S WHERE (a card of every place, ui/hub-ui.js). Edit freely.
//
// A hub's welcome:
//   guide   the speaker's name (as the story writes it), over every line
//   hello   what they say on arriving (and on the card) · away: instead, to a hero visiting another's hub (a co-op guest) · guest: added for a
//           co-op guest (the host picks the missions)
//   places  the card's rows: [label, wing, station id, what it's for, (a guest's line instead)]. The station's own name and
//           where its wing is (here, or which door off the start) come from data/hub.js, so moving one moves its row. A
//           label or line can be { home, away }: `away` for a hero visiting another's hub (a co-op guest), whose bench
//           there opens their own kit
//   tour    SHOW ME AROUND's stops, in order: { wing, station, say }. The task line ("Walk up to the TEMPLE MAP") comes
//           from the station; a stop in another wing first points to the door toward it. The last stop is the first run:
//           `last` is what the guide says there (guest: in a party), with the F that opens it

export const WELCOME = {
  temple: {
    guide: 'MASTER VAEL',
    hello: 'Welcome to the hidden temple, young one. Few in the galaxy know it is here. Rest when you can: when the galaxy calls, this is where we answer.',
    away: 'Welcome to the hidden temple, friend. Few outside the Order have walked these halls. Rest here while you can.',
    guest: 'You walk with a party here. Whoever leads it chooses the mission, and you go together.',
    places: [
      ['MISSIONS', 'council', 'table', 'The campaign, story missions and challenges. Your party goes where you lead.', 'The host picks the mission here, and the party goes in together.'],
      ['SIDE MISSIONS', 'hall', 'calls', 'Calls for help from across the galaxy. More come in as your rank rises.'],
      ['YOUR SHIP', 'landing', 'shuttle', 'Board your shuttle: its galaxy map flies you to any world, mission or raid, and to the old city of Jedha once you have finished Act I.'],
      ['TRAINING', 'training', 'grounds', 'Learn every move and power, spar in the sandbox, or hold the proving ground.'],
      [{ home: 'YOUR SABER', away: 'YOUR GEAR' }, 'forge', 'bench', { home: 'Build your lightsaber, and change how your Jedi looks.', away: 'Your own kit, and how your hero looks.' }],
      ['RECORDS', 'archives', 'terminal', 'The codex, your holocron and every mission you have cleared.'],
      ['GETTING AROUND', 'hall', 'map', 'The temple map, and the waystone in every wing, take you to any wing at once.'],
    ],
    tour: [
      { wing: 'hall', station: 'map', say: 'Every wing of the temple opens off this hall. The map, and the waystone in each wing, will take you to any of them in a moment.' },
      { wing: 'hall', station: 'calls', say: 'Calls for aid reach this stone from across the galaxy. Answer them when you can: more find us as you grow.' },
      { wing: 'council', station: 'table', say: 'The council table. Every journey begins here.',
        last: 'Choose your first path here. New to the blade? The campaign starts with the basics, and the training wing, east of the hall, teaches every move.',
        guestLast: 'Your party\'s leader chooses the mission at this table. When they set off, you go with them.' },
    ],
  },
  kamino: {
    guide: 'SGT. VANT',
    hello: 'Welcome to the citadel, Captain. The rain never stops on Kamino, and neither do we. Quick walk round, then we ship out.',
    away: 'Welcome to the citadel. Don\'t mind the rain, it never stops on Kamino. Quick walk round, then we ship out.',
    guest: 'You\'re with a squad. Whoever leads it picks the op, and we all go together.',
    places: [
      ['MISSIONS', 'warroom', 'table', 'The campaign, story missions and challenges. Your squad goes where you send it.', 'The host picks the op here, and the squad ships out together.'],
      ['SIDE MISSIONS', 'warroom', 'calls', 'Calls for help from across the galaxy. More come in as your rank rises.'],
      ['YOUR SHIP', 'deck', 'gunship', 'Board your dropship: its galaxy map ships you to any op, world or raid, and to the old city of Jedha once you have finished Act I.'],
      ['TRAINING', 'range', 'grounds', 'Drill the basics on the lanes, run any fight in the sim, or hold the killhouse.'],
      [{ home: 'YOUR KIT', away: 'YOUR GEAR' }, 'armory', 'bench', { home: 'Your rifle, your gear, your paint, and your squad\'s specialist.', away: 'Your own kit, and how your hero looks.' }],
      ['RECORDS', 'halls', 'terminal', 'The genome records, your service file and the mission logs.'],
      ['GETTING AROUND', 'deck', 'map', 'The facility map, and the transit beacon on every deck, take you anywhere at once.'],
    ],
    tour: [
      { wing: 'deck', station: 'map', say: 'Every deck runs off this hangar. The map, or any transit beacon, gets you to the others double time.' },
      { wing: 'warroom', station: 'calls', say: 'Calls for aid come in on this board. Somebody out there always needs a squad. More come in as you make rank.' },
      { wing: 'warroom', station: 'table', say: 'The holotable. Every op starts here.',
        last: 'Pick your first op here, Captain. Rusty? The campaign eases you in, and the firing range, east off the hangar, drills every move.',
        guestLast: 'Whoever leads the squad picks the op at this table. When they go, you go with them.' },
    ],
  },
  covert: {
    guide: 'THE ARMORER',
    hello: 'You have found the covert. The forge is lit and the clan is gathered. Learn where things stand, then go and earn your keep.',
    away: 'You have found the covert. Outsiders seldom do. The forge is lit and the clan is gathered: learn where things stand.',
    guest: 'You hunt with a party. Whoever leads it chooses the job, and you go together.',
    places: [
      ['THE HUNT', 'hangar', 'ship', 'Your ship: the campaign, challenges and survival.', 'The host picks the job, and the party flies out together.'],
      ['BOUNTIES', 'hangar', 'board', 'A random job off the board, or any story mission.', 'The host picks the job here, and the party goes in together.'],
      ['SIDE MISSIONS', 'hangar', 'calls', 'Calls for help from across the galaxy. More come in as your rank rises.'],
      [{ home: 'YOUR ARMOUR', away: 'YOUR GEAR' }, 'forge', 'anvil', { home: 'Forge your beskar, and change how your Mandalorian looks.', away: 'Your own kit, and how your hero looks.' }],
      ['YOUR SHIP', 'hangar', 'ship', 'Board the Cinderwake: its galaxy map takes you to any job, world or raid, and to the old city of Jedha once you have finished Act I.'],
      ['TRAINING', 'pit', 'range', 'Learn the moves on the range, fight anything in the pit, or run the gauntlet.'],
      ['GETTING AROUND', 'forge', 'map', 'The covert map, here and in every hall, takes you to any hall at once.'],
    ],
    tour: [
      { wing: 'forge', station: 'map', say: 'Every hall of the covert opens off the forge. This map, and the one in each hall, will take you to any of them.' },
      { wing: 'forge', station: 'anvil', say: 'My anvil. Bring me what you earn out there and I will make it into armour.' },
      { wing: 'hangar', station: 'calls', say: 'Calls for aid. Those who cannot pay still need help. More find us as your name grows.' },
      { wing: 'hangar', station: 'ship', say: 'Your ship. Every hunt starts at its ramp.',
        last: 'Take your first hunt from here. If your hands have forgotten the Way, the campaign starts with the basics, and the target range in the sparring pit teaches every move.',
        guestLast: 'The leader of your party chooses the hunt. When they fly, you fly with them.' },
    ],
  },
};

export const WELCOME_TUNE = {
  delay: 2.4,     // seconds after arriving before the guide speaks (the wing's name banner fades first)
  greet: 9,       // seconds the hello stays up before the first stop's own line takes over
  lineHold: 8,    // seconds a line of the guide's stays up before it folds away (the task line stays)
  beacon: 0xffd27a,
  beamAlpha: 0.42,  // the column of light over a stop (a mission's beacons are fainter)
  doorRing: 3.2,  // the ring over a door the tour points through
  stationRing: 1.6,
  bigRing: 4.2,   // ...round a station you can tap from far off (the hall's map, the council table)
  doneHold: 9,    // seconds the last line stays up once the hero reaches the last stop
};
