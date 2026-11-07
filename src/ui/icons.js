// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Line icons for upgrade cards, boons and HUD slots. Data tables keep their short glyph ids (ico:'⚡');
// icon(glyph) swaps the glyph for a drawn SVG so every icon shares one stroke weight and style.

import { FAMILIES, FORM_FAMILY } from '../data/foe-forms.js';

const P = {
  cross:   '<path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z"/>',
  spark:   '<path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z"/><path d="M18.5 3.5v3M17 5h3"/>',
  aura:    '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" stroke-dasharray="2.5 2.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
  shield:  '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/><path d="M12 8v8M8.5 11.5h7"/>',
  shield2: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/><path d="M4.8 10.5h14.4"/>',
  bolt:    '<path d="M13.5 2.5L5.5 13.5h6l-1 8 8-11h-6z"/>',
  burst:   '<path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5M5.3 5.3l3.5 3.5M15.2 15.2l3.5 3.5M5.3 18.7l3.5-3.5M15.2 8.8l3.5-3.5"/><circle cx="12" cy="12" r="2"/>',
  blast:   '<path d="M12 3l2 5 5-2-2 5 4 2-5 1.5 1 5-4-3-3 4-1-5-5 1 3-4-4-3 5-.5-1-5 4 3z"/>',
  dash:    '<path d="M4 7l5 5-5 5M11 7l5 5-5 5"/><path d="M18 7v10"/>',
  sabers:  '<path d="M5 19L17.5 6.5M19 5l-1.5 1.5M5 5l12.5 12.5M19 19l-1.5-1.5"/><path d="M4 17.5l2.5 2.5M4 6.5L6.5 4"/>',
  nova:    '<circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="9.5" stroke-dasharray="1.5 3"/>',
  impact:  '<path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8"/>',
  focus:   '<path d="M12 3l9 9-9 9-9-9z"/><path d="M12 8l4 4-4 4-4-4z"/>',
  slam:    '<path d="M12 3v10M7.5 8.5L12 13l4.5-4.5"/><path d="M3 19h18M6 16l-2 3M18 16l2 3"/>',
  blade:   '<path d="M14 3.5l6.5 6.5-9 9-3.5-3.5z"/><path d="M8 16l-3.5 3.5M5.5 14.5l4 4"/>',
  cycle:   '<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19.5 4v4h-4"/>',
  cycleb:  '<path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M4.5 4v4h4"/>',
  arrow:   '<path d="M4 20L18 6M12 6h6v6"/><path d="M4 14v6h6"/>',
  gem:     '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M9.5 4L8 9l4 11 4-11-1.5-5"/>',
  heart:   '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  skull:   '<path d="M5 11a7 7 0 0 1 14 0v3l-2 1v3H7v-3l-2-1z"/><circle cx="9.3" cy="11.5" r="1.4"/><circle cx="14.7" cy="11.5" r="1.4"/><path d="M10.5 18v2M13.5 18v2"/>',
  comet:   '<circle cx="16" cy="8" r="3.5"/><path d="M13.5 10.5L4 20M11 8.5L5.5 14M15.5 12.5L10 18"/>',
  deto:    '<circle cx="12" cy="13" r="6.5"/><circle cx="12" cy="13" r="2"/><path d="M12 6.5V3.5M10 3.5h4"/>',
  thrust:  '<path d="M12 3l5 6h-3v6h-4V9H7z"/><path d="M9.5 18.5l-1 2.5M12 18.5V21M14.5 18.5l1 2.5"/>',
  scope:   '<circle cx="12" cy="12" r="7"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/><circle cx="12" cy="12" r="1"/>',
  hook:    '<path d="M14 3v10a5 5 0 0 1-10 0v-1.5"/><path d="M2.5 13.5L4 11.5l1.5 2"/><path d="M14 3l6 0" stroke-dasharray="1.5 2"/>',
  bolts:   '<path d="M4 9h12M8 15h12"/><path d="M16 7l2 2-2 2M20 13l2 2-2 2" stroke-width="1.4"/>',
  push:    '<path d="M4 12h10M10 7l5 5-5 5"/><path d="M18 5c1.4 2 2.2 4.4 2.2 7s-.8 5-2.2 7"/>',
  pull:    '<path d="M20 12H10M14 7l-5 5 5 5"/><path d="M6 5c-1.4 2-2.2 4.4-2.2 7s.8 5 2.2 7"/>',
  flame:   '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 .8 1.5 1.5 2 2.5 2 0-2.5-.5-4.5.5-7z"/>',
  rocket:  '<path d="M14.5 4.5L20 4l-.5 5.5-7.5 7.5-4.5-4.5z"/><path d="M7.5 12.5L4 13l-1 3 3.5.5M11.5 16.5L11 20l-3 1-.5-3.5"/>',
  // the title screen's quiet row (ui/menus.js BTN_ICON)
  gear:    '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/><circle cx="12" cy="12" r="6.3"/>',
  pad:     '<path d="M7 7.5h10a4.5 4.5 0 0 1 4.3 5.8l-1 3.4a2.4 2.4 0 0 1-4.1.9L14.5 15.5h-5l-1.7 2.1a2.4 2.4 0 0 1-4.1-.9l-1-3.4A4.5 4.5 0 0 1 7 7.5z"/><path d="M8 10.5v3M6.5 12h3"/><circle cx="15.5" cy="11" r=".6"/><circle cx="17" cy="13" r=".6"/>',
  book:    '<path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"/><path d="M12 6v13.5"/>',
  user:    '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6"/>',
  wrench:  '<path d="M14.5 4.2a4.5 4.5 0 0 0-4.9 6.1L4 15.9a1.9 1.9 0 0 0 2.7 2.7l5.6-5.6a4.5 4.5 0 0 0 6.1-4.9l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  map:     '<path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
  lock:    '<rect x="5.5" y="10.5" width="13" height="9.5" rx="1.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  // the hub's station panels (ui/hub-ui.js HUB_ICON)
  saga:    '<path d="M6 3.5h9.5L19 7v13.5H6z"/><path d="M15.5 3.5V7H19"/><path d="M9 11h7M9 14.5h7M9 18h4"/>',
  gate:    '<path d="M4 21V9a8 8 0 0 1 16 0v12"/><path d="M8 21v-9a4 4 0 0 1 8 0v9"/><path d="M2.5 21h19"/>',
  ship:    '<path d="M12 3l3 7 6 3-6 1.5L12 21l-3-6.5L3 13l6-3z"/><circle cx="12" cy="12" r="1.3"/>',
  city:    '<path d="M3 21V11l4-3v13M7 21V6l5-3 5 3v15M17 21V10l4 2.5V21"/><path d="M2 21h20M10 10h4M10 14h4"/>',
  dice:    '<rect x="4" y="4" width="16" height="16" rx="2.5"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="15.5" cy="8.5" r="1"/><circle cx="8.5" cy="15.5" r="1"/>',
  waves:   '<path d="M3 8c3-2 6 2 9 0s6-2 9 0M3 13c3-2 6 2 9 0s6-2 9 0M3 18c3-2 6 2 9 0s6-2 9 0"/>',
  grid:    '<rect x="4" y="4" width="6.5" height="6.5"/><rect x="13.5" y="4" width="6.5" height="6.5"/><rect x="4" y="13.5" width="6.5" height="6.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  list:    '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1"/><circle cx="4.8" cy="12" r="1"/><circle cx="4.8" cy="17.5" r="1"/>',
  party:   '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.3 3-5.3 6-5.3s5.4 2 6 5.3"/><circle cx="16.5" cy="9" r="2.6"/><path d="M16.5 14.2c2.4 0 4.2 1.7 4.6 4.6"/>',
  target:  '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  door:    '<path d="M6 21V4.5L15 3v18"/><path d="M15 5h3.5v16M3.5 21h17"/><circle cx="12.5" cy="12.5" r=".8"/>',
  holo:    '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  call:    '<path d="M12 3v3M5.5 6.5l2 2M18.5 6.5l-2 2"/><path d="M8 21h8M9 21v-5.5a3 3 0 0 1 6 0V21"/><path d="M6.5 12.5a5.5 5.5 0 0 1 11 0"/>',
  forge:   '<path d="M4 14h12l-2 4H6z"/><path d="M16 14c0-2.5 1.5-4 4-4M8.5 14V9.5h3V14"/><path d="M7 21h6"/>',
  helm:    '<path d="M5 13a7 7 0 0 1 14 0v7h-4.5v-3.5h-5V20H5z"/><path d="M8 12.5h8"/>',
  check:   '<path d="M4.5 12.5l4.5 4.5 10.5-10.5"/>',
};
// the glyph ids used across data/ (skills, store, boons, survival powers) → drawn icon
const GLYPH = {
  '✚':'cross', '✦':'spark', '❂':'aura', '⛨':'shield', '⛊':'shield2', '⚡':'bolt', '✺':'burst', '✸':'blast', '➤':'dash',
  '⚔':'sabers', '❉':'nova', '✷':'impact', '◈':'focus', '▼':'slam', '🗡':'blade', '⟳':'cycle', '⟲':'cycleb', '➳':'arrow',
  '❖':'gem', '♥':'heart', '☠':'skull', '☄':'comet', '◉':'deto', '⏶':'thrust', '⌖':'scope', '⌒':'hook', '⁌':'bolts',
};
export function svgIcon(name, cls){
  const p = P[name]; if (!p) return '';
  return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
}
// HUD slot id → icon
export const SLOT_ICON = {
  'ab-dash':'dash', 'ab-push':'push', 'ab-pull':'pull', 'ab-slam':'slam', 'ab-mend':'cross', 'ab-barrier':'shield',
  'ab-throw':'cycle', 'ab-judge':'bolt', 'ab-repulse':'nova', 'ab-flame':'flame', 'ab-rocket':'rocket',
  'ab-grapple':'hook', 'ab-mslam':'slam', 'ab-deto':'deto', 'ab-birds':'burst', 'ab-missile':'comet', 'ab-bacta':'cross',
  'ab-dthrow':'cycle',
  'ab-frag':'deto', 'ab-scan':'nova', 'ab-bshield':'shield', 'ab-ion':'bolt', 'ab-breach':'burst', 'ab-artillery':'comet', 'ab-strafe':'rocket',   // (the ARC trooper's)
};
export function icon(glyph, cls){ return GLYPH[glyph] ? svgIcon(GLYPH[glyph], cls) : glyph; }

/* a form's counter group (data/foe-forms.js), the same shapes the duellists' badges wear (enemies/foeform.js familyIcon):
   chevrons SPEED, a burst POWER, a shield GUARD, a ring for a form outside the triangle. Shape and colour both, so the
   group reads without telling colours apart. On the HUD's loadout chips (player/jedi/stance.js) and the Forms page. */
const FAM_PATH = {
  speed: '<path d="M2 3l4 5-4 5M8 3l4 5-4 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  power: '<path d="M8 1.5l1.3 4 3.9-1.6-1.9 3.6 3.6 1.9-4 .9.9 4-3.8-2-3.8 2 .9-4-4-.9 3.6-1.9-1.9-3.6 3.9 1.6z" fill="currentColor"/>',
  guard: '<path d="M8 1.5l5 2-.3 5c-.3 3-2.5 5-4.7 6-2.2-1-4.4-3-4.7-6L3 3.5z" fill="currentColor"/>',
  none:  '<circle cx="8" cy="8" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/>',
};
export const famIcon = (id, size = 11, cls = 'sfam') => { const f = FORM_FAMILY[id], F = FAMILIES[f];
  return '<svg class="' + cls + '" viewBox="0 0 16 16" width="' + size + '" height="' + size + '" aria-hidden="true" style="color:' + (F ? F.color : '#cfd6e0') + '">' + FAM_PATH[F ? f : 'none'] + '</svg>'; };
