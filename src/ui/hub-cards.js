// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE STATION PANELS' CARDS: how the hub's panels (ui/hub-ui.js) and an open zone's waystone panel (ui/zone-ui.js) draw
// their options. An option is { t, d, go, lock } (its label, the line under it, what it does, what opens it).
// styles/heroes/hub.css puts them in the look of the hero being played.

import { svgIcon } from './icons.js';

/* ---------------- how a panel's options look ----------------
   Each option is a card in the hero's own look (styles/heroes/hub.css: the Jedi's holocron page, the Mando's beskar
   plate, the trooper's orders readout): an icon in a frame, its name, the line under it, and a tag on the right (a
   lock with what opens it, a tick, READY). The first live option of a station is its main one, drawn in the accent.
   The icon goes by what the option is (its label), so a new option picks one up without a list to keep. */
const HUB_ICON = [
  [/CAMPAIGN|THE HUNT$|NEW GAME|NG\+|TIER/, 'saga'], [/SITH GATE|ACT IV/, 'gate'], [/RAID/, 'skull'], [/JEDHA|OPEN ZONE|FLY TO/, 'city'],
  [/STORY MISSIONS|MISSION RECORDS|MISSION LOGS/, 'list'], [/CHALLENGE|BOUNTY/, 'dice'], [/SURVIVAL/, 'waves'],
  [/EVERY MODE/, 'grid'], [/SHOW ME AROUND/, 'compass'], [/WHAT'S WHERE/, 'map'], [/JOIN|HOST|READY|GO NOW|NOT YET|PARTY/, 'party'],
  [/TRAINING/, 'target'], [/SANDBOX/, 'sabers'], [/CODEX/, 'book'], [/HOLOCRON|SIGNET|SERVICE RECORD/, 'holo'],
  [/WORKBENCH|FORMS/, 'gem'], [/LOCKER|FORGE/, 'forge'], [/CUSTOMIZE/, 'helm'],
];
const iconFor = (b, act) => act === 'quests' ? 'call' : act === 'travel' ? 'door' : (HUB_ICON.find(([re]) => re.test(b.t)) || [])[1] || 'spark';
// one option's card: o.main (the station's main one), o.cls (more classes), o.ic (an icon instead of the label's)
export function optHTML(b, i, o = {}){
  const done = /\s+✓$/.test(b.t), name = b.t.replace(/\s+✓$/, '');
  const tag = b.lock ? '<em class="hb-tag lk">' + svgIcon('lock') + '</em>' : done ? '<em class="hb-tag ok">' + svgIcon('check') + '</em>' : b.go ? '<em class="hb-tag go"></em>' : '';
  return '<div class="hb-o' + (b.go ? '' : ' off') + (b.lock ? ' locked' : '') + (o.main ? ' main' : '') + (o.cls ? ' ' + o.cls : '') + '" data-i="' + i + '">' +
    '<i class="hb-ic">' + svgIcon(o.ic || iconFor(b, o.act)) + '</i>' +
    '<div class="hb-tx"><b>' + name + '</b><span>' + (b.lock ? '<u>LOCKED</u> ' + b.lock : b.d) + '</span></div>' + tag + '</div>';
}
// a station's whole list: the main option marked, and two to a row once there are many (styles/heroes/hub.css)
export function listHTML(list, act, start = 0){
  const main = act === 'quests' ? -1 : list.findIndex(b => b.go && !b.lock);
  return '<div class="hb-list' + (list.length > 4 ? ' many' : '') + '">' + list.map((b, i) => optHTML(b, start + i, { main: i === main, act })).join('') + '</div>';
}
// the panel's head: the wing, the station's name in the hero's display face, its line, and a rule in the hero's look
export const headHTML = (k, t, d, extra = '') => '<div class="hb-k">' + k + '</div><div class="hb-t">' + t + '</div><div class="hb-rule"><i></i></div>' +
  (d ? '<div class="hb-d">' + d + '</div>' : '') + extra;
