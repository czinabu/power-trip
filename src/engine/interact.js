// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE INTERACT BINDING, in one place: the key that opens a temple station, takes a holocron, harvests a crystal or sits
// at a meditation spot, and the label every prompt shows for it (keyboard or pad). Anything the hero can walk up to and
// use registers with onInteract; the key handler (allies/wheel.js, the squad key it shares today) asks tryInteract
// first and only gives a squad order when nothing nearby wanted the press. Moving interact to another key is this file
// and the key handler, nothing else: every prompt reads interactKey().

import { pad, padKeys } from './gamepad.js';

export const INTERACT = { key: 'h', label: 'H', pad: 'H' };   // the key (KeyboardEvent.key, lower case), its chip, its pad mapping
export const interactKey = () => pad.active ? padKeys(INTERACT.pad) : INTERACT.label;
// a prompt's key chip and its words, as the station / secret prompts draw them
export const interactChip = (what) => '<kbd>' + interactKey() + '</kbd><span>' + what + '</span>';

// (a hoisted function, not a const: a module that registers while this one is still loading in an import cycle finds it)
function handlers(){ return handlers.list || (handlers.list = []); }
// fn(): true when it used the press (the first one that does wins)
export function onInteract(fn){ const h = handlers(); if (!h.includes(fn)) h.push(fn); }
export function tryInteract(){ for (const fn of handlers()) if (fn()) return true; return false; }
