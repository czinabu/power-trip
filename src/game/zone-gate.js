// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// AN OPEN ZONE'S GATE AND KIT, from this hero's own story so far (game/zone.js plays the zone; data/zones.js has them).
//
//   · THE GATE: a zone names the campaign chapter that opens it (data/zones.js `opensAfter`). It opens for a hero once
//     THAT hero has closed that chapter (in their own story, or a partner's in co-op), or beaten their campaign. Until
//     then the hub stations show it locked, with the chapter to reach. A co-op guest may go along with a host who has it
//     open, whatever their own save says (the host chose; the guest still carries only their own kit).
//   · THE KIT: what this hero has earned in the story, no more: each form, power, gun and piece of gear the campaign hands
//     out at a chapter's close (data/store.js, data/forms.js FORM_PATH, data/force-level.js) is in hand once this hero has
//     closed that chapter. Nothing by rank and nothing from another hero's save.
//
// A chapter counts as closed by the hero's profile (game/profile.js noteChapterCleared: every close, host or guest) or
// the older record of the chapters a run moved past (game/wardrobe.js chapterEarned, which saves from before the profile
// still have), so an existing save opens what it has already reached.

import { G } from '../state.js';
import { ZONES } from '../data/zones.js';
import { CHAPTERS, chapterOrder, chapterNo } from '../data/campaign.js';
import { FORM_PATH, FORMS } from '../data/forms.js';
import { profileOf } from './profile.js';
import { chapterEarned, campaignBeaten } from './wardrobe.js';

const heroOf = (h) => h || G.hero;
// has this hero closed chapter `id` (a chapter slot's id: every story lays its own chapter over the same slots)?
export function heroCleared(id, hero){
  hero = heroOf(hero);
  if (!id) return false;
  try { const p = profileOf(hero); if (p.won || (p.cleared && p.cleared[id])) return true; } catch(e){}
  return chapterEarned(hero, id) || campaignBeaten(hero);
}
const beaten = (hero) => { try { return !!profileOf(hero).won || campaignBeaten(hero); } catch(e){ return campaignBeaten(hero); } };

/* ---------- the gate ---------- */
export function zoneOpen(key, hero){
  const Z = ZONES[key]; if (!Z) return false;
  return !Z.opensAfter || heroCleared(Z.opensAfter, heroOf(hero));
}
// the hub's locked line for a zone not open yet: 'Finish Act I of your campaign (chapter 4, TRIAL OF THE WALL)' (null when it's open)
export function zoneLock(key, hero){
  hero = heroOf(hero);
  if (zoneOpen(key, hero)) return null;
  const id = ZONES[key].opensAfter, list = chapterOrder(null, hero), at = list.findIndex(c => c.id === id), c = list[at];
  if (!c) return 'Play further into your campaign';
  const last = !list.some((d, i) => i > at && d.act === c.act);   // the act's last chapter: say the act
  const title = typeof c.title === 'object' ? (c.title[hero] || c.title.jedi) : c.title;
  const no = chapterNo(at, list).toLowerCase() + (title ? ', ' + title : '');
  return last ? 'Finish Act ' + ['I', 'II', 'III', 'IV'][c.act] + ' of your campaign (' + no + ')' : 'Clear ' + no + ' of your campaign';
}

/* ---------- the kit (game/flow.js checkUnlocks asks this in a zone, for every auto-unlock and Force Level) ---------- */
// a form a chapter of another story stands in for (FORM_PATH `alt`): counts only when this hero reached it that way,
// i.e. they have none of their own story's chapters of that act (a Jedi guest in a Mando or trooper story)
const ownActChapters = (hero, act) => CHAPTERS.filter(c => c.story === hero && c.act === act && !c.prologue);
function formReached(p, hero){
  if (heroCleared(p.chapter, hero) || (p.hothFirst && heroCleared(p.hothFirst, hero))) return true;
  if (!p.alt || !heroCleared(p.alt, hero)) return false;
  const alt = CHAPTERS.find(c => c.id === p.alt);
  return !alt || !ownActChapters(hero, alt.act).some(c => heroCleared(c.id, hero));
}
export function zoneReached(u, hero){
  hero = heroOf(hero);
  if (beaten(hero)) return true;
  if (u.form){ const p = FORM_PATH.find(q => q.form === u.key); return !!p && formReached(p, hero); }
  if (u.chapter) return heroCleared(u.chapter, hero);
  return !(u.stage > 0);   // (no chapter hands it out: the starting kit, e.g. the Mando's wrist rocket)
}
// Form VII: the one this Jedi kept (game/profile.js noteFork), once the chapter that offers it is behind them
export function zoneFork(){
  if (G.hero !== 'jedi') return null;
  let kept = null;
  try { kept = (profileOf('jedi').forks || {}).f7 || null; } catch(e){}
  const p = kept && FORM_PATH.find(q => q.form === kept);
  return p && FORMS[kept] && FORMS[kept].fork && formReached(p, 'jedi') ? kept : null;
}
// how deep into a run this hero's story is (a wave apiece, a mission its steps): a mission's form mastery and a Mando's
// pick of guns follow it (game/flow.js missionFormRanks, game/armory.js missionKit)
export function zoneDepth(hero){
  hero = heroOf(hero);
  return chapterOrder(null, hero).filter(c => heroCleared(c.id, hero))
    .reduce((n, c) => n + (c.kind === 'waves' ? c.waves[1] - c.waves[0] : c.steps ?? 1), 0);
}
