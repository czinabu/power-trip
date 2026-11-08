// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// NEWS AT HOME: the first hour's other half. The welcome (data/hub-welcome.js) shows a new hero three stops and no more;
// everything else in the hub is taught the first time it matters. Coming home from a run with something newly yours (your
// ship can reach Jedha, a rank, a part for your bench, the sparring hall, an apprentice waiting…), the hub's guide says so
// on the same small side panel and a beacon walks you to the station for it. One piece of news a homecoming, the most
// useful first; the rest wait for the next. game/hub-news.js decides what is new, game/hub-welcome.js walks you there.
//
// Each piece: id (what it's remembered by, per hero, per save file), act (the station it leads to: the first station in
// the hub with one of these acts, wings in the map's order), step (the panel's small heading), and what each hub's guide
// says (the same voices as the welcome's). What makes it "new" lives in game/hub-news.js NEW, under the same id. Edit freely.

export const NEWS = [
  { id: 'zone', act: ['shuttle', 'ship'], step: 'NEW · AN OPEN ZONE',
    say: {
      temple: 'The old city of Jedha is open to you now. Your ship on the landing platform flies there, and its galaxy map is where your party gathers.',
      kamino: 'Jedha\'s open, Captain. The Kestrel on the hangar deck will take you, and its galaxy map is where the squad gathers.',
      covert: 'The old city of Jedha is open to you. The Cinderwake will take you there, with whoever hunts beside you.',
    } },
  { id: 'apprentice', act: ['apprentice'], step: 'NEW · SOMEONE IS WAITING',
    say: {
      temple: 'Someone is waiting for you in the training wing. Go and see them: they may fight beside you.',
      kamino: 'Somebody at the firing range keeps asking for you, Captain. Go and see them.',
      covert: 'A foundling waits for you in the sparring pit. Go to them.',
    } },
  { id: 'gate', act: ['council'], step: 'NEW · ACT IV',
    say: {
      temple: 'The council has word of the Sith gate. Act IV waits at the council table, for any heroes who will go together.',
      kamino: 'New op on the holotable: the Sith gate. Act IV, for any heroes who\'ll come.',
      covert: 'There is a job on the war table like no other: the Sith gate. Act IV, for any who will hunt it.',
    } },
  { id: 'sandbox', act: ['sparring'], step: 'NEW · SPARRING',
    say: {
      temple: 'The sparring hall is open to you now: call in any foe you have faced and practise against it.',
      kamino: 'The combat sim on the firing range is cleared for you. Load any fight you\'ve been in and run it again.',
      covert: 'The sparring pit is yours now. Call up anything you have fought and learn it.',
    } },
  { id: 'survival', act: ['proving'], step: 'NEW · SURVIVAL',
    say: {
      temple: 'The proving ground is open. See how long you can hold it.',
      kamino: 'The killhouse is open. Endless waves, one score. Let\'s see how long you last.',
      covert: 'The gauntlet is open to you. Endless waves: see how long you stand.',
    } },
  { id: 'rank', act: ['profile'], step: 'NEW · RANK',
    say: {
      temple: 'You have grown, young one. Your holocron in the archives keeps your rank, and what each new one opens for you.',
      kamino: 'Promotion came through, Captain. Your service record in the cloning halls shows what the new rank gets you.',
      covert: 'Your name grows. Your signet in the trophy vault shows what it has earned you.',
    } },
  { id: 'part', act: ['forge'], step: 'NEW · FOR YOUR BENCH',
    say: {
      temple: 'You have earned a new part for your blade. Build it in at the saber forge, beneath the grand hall.',
      kamino: 'New gear came through the quartermaster for you. Fit it at the armour stand in the armory.',
      covert: 'You have brought back something worth forging. Come to my anvil.',
    } },
];

export const NEWS_TUNE = {
  delay: 3.2,   // seconds after arriving home before the guide speaks (the wing's name banner fades first)
};
