// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// THE CAMPAIGN: three acts of chapters (data/campaign.js), one run carried from the first to the last. A chapter is a
// stretch of a wave level (game/flow.js) or a story mission played with the run's build (game/mission.js). Each opens on
// a chapter card: where you are in the story, the voice's briefing and the act's chapters so far. Between Act I and
// Act II the card asks which pair of chapters comes first.

import { refreshWorn } from './wardrobe.js';
import { autosave } from './autosave.js';
import { G, shared, heroKey } from '../state.js';
import { MISSIONS } from '../data/missions.js';
import { renderer } from '../engine/renderer.js';
import { audioInit, S } from '../audio/sfx.js';
import { MUSIC } from '../audio/music.js';
import { LEVELS } from '../data/levels.js';
import { ACT_TWO, actTwoAt, CHAPTER_OF_LEVEL, chapterOrder, chapterNo, forHero, storyVoice, actTitle, actOpen, actTwoLine, actTwoLabel, epilogueText, storyHero } from '../data/campaign.js';
import { startLevel, checkUnlocks, chapterRewards, releaseUnlockBanners } from './flow.js';
import { startMission } from './mission.js';
import { openSkillTree } from '../ui/store-ui.js';
import { earnWavePoint } from './upgrades.js';
import { showBanner } from '../ui/banners.js';
import { storyBeat, clearComms, comms } from './story.js';
import { playOpening, resetScenes, playScene } from './cutscene.js';
import { recordChapters } from './sandbox-unlocks.js';
import { choiceAfter, choose, resetStory, storyChoices, answer, storyWords } from './choices.js';
import { alignChoice, askGuests, setOwnChoice } from './alignment.js';
import { ALIGN_WORDS } from '../data/alignment.js';
import { victory } from './summary.js';
import { JEDI_ACT_TWO_WARN, JEDI_EPILOGUE_SCENE } from '../data/campaign-jedi.js';
import { resetSet } from './onset.js';
import { startCalm, guestCalm, endCalm } from './aftermath.js';
import { pad } from '../engine/gamepad.js';
import { gateRecapHtml, veteranKit } from './gate.js';
import { PAD_GLYPHS } from '../data/gamepad.js';

const ROMAN = ['I', 'II', 'III', 'IV'];   // (IV: the Sith gate, game/gate.js)
export const chapters = () => chapterOrder(G.actTwo);
export const chapterAt = (pos) => chapters()[pos];
export const inChapters = () => G.chapter >= 0;
export const chapterTitle = (c) => forHero(c.title, G.hero);
// 'CHAPTER 3 · THE LAST EVACUATION', for the pause screen, the save slots and the menu's CONTINUE line
export function chapterLabel(pos = G.chapter){
  const c = chapterAt(pos);
  return c ? chapterNo(pos) + ' · ' + chapterTitle(c) : '';
}

/* ---------- starting and moving through the run ---------- */
// BEGIN CAMPAIGN: a fresh build on chapter 1
export function startCampaign(){
  G.gateKitDue = false;   // (Act IV's veteran page: game/gate.js)
  G.actTwo = null; G.storyHero = null;   // (the story is this hero's own: data/campaign.js storyHero; the ARC trooper's opens on its prologue)
  resetStory();   // (and nothing in it has been chosen yet: game/choices.js)
  G.levelIdx = 0; G.waveTotal = -1;   // (as a fresh build starts: a prologue's checkpoint is taken before its build resets)
  startChapter(0, { fresh: true });
}
// opts: fresh (a brand-new run: reset the build) · retry (after a death, or a loaded save: back to the chapter's
// checkpoint, no card unless opts.card) · guest (co-op: follow the host's chapter, the host runs it)
export function startChapter(pos, opts = {}){
  const c = chapterAt(pos);
  if (!c) return;
  G.chapter = pos; G.chapterClosed = null;   // (set again when it closes: game/flow.js chapterClosed)
  refreshWorn();   // the looks the last chapter unlocked go on as this one starts (the trooper's ARC kit: game/look-unlocks.js)
  endCalm(true);   // (a calm still running from the last chapter, or a retry from inside one: game/aftermath.js)
  resetSet(pos, !!opts.retry);   // the story's voice that stayed on set (game/onset.js): back behind the hero on a retry of this chapter
  if (!opts.guest) recordChapters(pos);   // the sandbox follows the story (a co-op guest's is followChapter's)
  const title = chapterTitle(c), no = chapterNo(pos), name = no + ' — ' + title, sub = 'ACT ' + ROMAN[c.act] + ' · ' + c.world;
  if (opts.retry && G.checkpoint && G.checkpoint.ch === pos) G.waveTotal = G.checkpoint.waveTotal;
  if (c.kind === 'waves'){
    startLevel(c.level, { level: { ...LEVELS[c.level], ...c.arena, name, sub }, waves: c.waves, resume: !opts.fresh, retry: opts.retry, chapter: true, foeLook: c.foeLook, guests: c.guests, coopGuest: !!opts.guest });   // (a story can dress the level's foes in its own uniform)
  } else {
    if (!opts.retry){ G.checkpoint = { idx: G.levelIdx, ch: pos, waveTotal: G.waveTotal, boss: false }; autosave('chapter'); }
    startMission(c.mission, 0, !!opts.guest, { retry: !!opts.retry, chapter: { name, sub, arena: c.arena, fresh: !!opts.fresh, guests: c.guests, evacuees: c.evacuees, harder: !!(c.harder && G.actTwo && c.harder === G.actTwo), kicker: no + ' · ' + title, clear: (c.lines && forHero(c.lines.clear, G.hero)) || null, done: chapterCleared } });
  }
  if (opts.guest){ G.coopGuest = true; G.coopWasGuest = true; G.coopJoin = false; shared.levelPhase = G.mission ? 'mission' : 'between'; shared.phaseT = 0; }
  if (!opts.retry || opts.card) showCard(pos);
}
// after a death: the chapter again from its checkpoint (a wave chapter from its first wave, or the boss)
export function retryChapter(){ startChapter(G.chapter, { retry: true }); }
// a loaded save: back on its chapter, with the card to say where the story was. A save from before the chapters
// (it knew only the level) picks up on the chapter that opens that level.
export function resumeChapter(run){
  G.actTwo = run.actTwo || null; G.storyHero = run.tale || null;   // (tale: a run of a shared story, Act IV's 'gate')
  const pos = run.chapter != null && run.chapter >= 0 ? run.chapter : CHAPTER_OF_LEVEL[run.idx] || 0;
  if (G.checkpoint && !(G.checkpoint.ch >= 0)) G.checkpoint.ch = pos;
  startChapter(pos, { retry: true, card: true });
}
// a run saved as its chapter closed (it left for training from the unlock screen): the chapter stays won. Back at its
// close: the upgrade page it hadn't reached yet, then the road on to the next chapter (game/flow.js 'chapterdone')
export function resumeAtClose(run){
  G.actTwo = run.actTwo || null; G.storyHero = run.tale || null;
  G.chapter = run.chapter; G.chapterClosed = run.chapter;
  shared.levelPhase = 'chapterdone'; shared.phaseT = 0.4;
  showBanner('', 'BACK TO THE STORY', 1.6);
}
// co-op: a guest joins the host's campaign on its chapter, with the kit that far into a run earns
export function joinCampaign(pos, actTwo, wave, waveTotal){
  const gate = storyHero() === 'gate';   // Act IV: every story's kit at once, without the fanfare (game/gate.js)
  G.kitQuiet = gate;
  try {
    startLevel(0);   // a full fresh setup (kit, build, stats)
    G.waveTotal = waveTotal; G.actTwo = actTwo || null;   // (the host's run: its order of chapters; G.storyHero is set with it, net/foes.js)
    startChapter(pos, { guest: true });
    if (!G.mission) G.wave = wave;
    if (gate) veteranKit(true);
  } finally { G.kitQuiet = false; }
  checkUnlocks();
}
// co-op guest: the host moved on to another chapter
export function followChapter(pos, actTwo){
  G.actTwo = actTwo || null;
  recordChapters(pos, true);   // the chapter played alongside the host
  startChapter(pos, { guest: true });
  showBanner('', 'THE HOST MOVES ON', 1.6);
}

// a mission chapter's last objective fell (a wave chapter's last wave is game/flow.js's): the clear's XP and second
// wind, the upgrade screen, then the next chapter. A co-op guest waits for the host to move the run on.
function chapterCleared(){
  const c = chapterAt(G.chapter);
  G.waveTotal += c?.steps ?? 1;   // a mission counts as a step deeper into the run (foes, store tiers and the Mando's gear follow it); `steps` when it stands for a level's waves
  // a mission standing in for a level's waves (Mustafar): the run is as far into that level as its waves would have taken it
  if (c && c.level != null && c.waves){ G.levelIdx = c.level; G.wave = c.waves[1]; }
  G.chapterClosed = G.chapter;   // what it hands out is shown at its close, and its closing page offers its powers (game/flow.js chapterClosed)
  chapterRewards();
  earnWavePoint();   // a mission chapter's skill point (game/upgrades.js), spent on the page that opens next
  storyBeat('clear', { quiet: !!G.mission });   // a mission's clear lines are already on its Chapter complete card (game/mission.js)
  // a story whose last chapter is a mission (the trooper's broadcast): clearing it ends the campaign, as the last boss does
  if (c && !chapterAt(G.chapter + 1)){ victory(); return; }
  if (G.coopGuest){ checkUnlocks(1600, true); guestCalm(openSkillTree); return; }   // (after the host's calm, if it has one: game/aftermath.js; a guest's new powers show at the close too)
  // after a duel or a hold: a calm walk back to the rally point first (game/aftermath.js), then the voice's last word, the
  // upgrade screen and the road on (game/flow.js)
  if (!startCalm()){ shared.levelPhase = 'chapterdone'; shared.phaseT = 2.6; }
  checkUnlocks(1600, true);   // the powers and forms this chapter hands over: their screens now, at its end (not as the next chapter opens)
}
// the 'travel' beat ran out (game/flow.js): the next chapter, or Act II's pick when it's due
export function nextChapter(){
  const pos = G.chapter + 1;
  if (!chapterAt(pos)) return;
  // a story's choice that follows the chapter just cleared comes first (game/choices.js); the host makes it in co-op
  const done = chapterAt(G.chapter), choice = !G.coopGuest && done && choiceAfter(done.story, done.id);
  if (choice) return void showChoice(choice, nextChapter);
  if (pos === actTwoAt() && !G.actTwo) return void showPick(pos, recordChapters(pos));
  startChapter(pos);
}

/* ---------- the chapter card ---------- */
const card = document.getElementById('chapcard');
let onGo = null;
export const cardUp = () => card.classList.contains('open');
function openCard(html, go){
  card.innerHTML = html;
  card.classList.add('open');
  G.skillSelect = true;   // freezes the sim and keeps the pause screen away while the cursor is free (see ui/menus.js)
  G.cardUp = true;
  document.body.classList.add('chapcard-up');   // the fight's HUD stays hidden behind the card until it closes (styles/hud.css)
  onGo = go;
  document.getElementById('banner').style.opacity = '0';
  document.exitPointerLock();
  for (const b of card.querySelectorAll('[data-go]')) b.addEventListener('click', (e) => { e.stopPropagation(); audioInit(); if (onGo) onGo(b.dataset.go); });
}
// shut the card (also the main menu's way out: quiet skips the pointer lock and the held banners)
export function closeCard(quiet){
  if (!cardUp()) return;
  card.classList.remove('open');
  G.cardUp = false; onGo = null;
  document.body.classList.remove('chapcard-up');
  if (G.skillSelect && !document.getElementById('skilltree').style.display.includes('flex')) G.skillSelect = false;
  if (quiet) return;
  if (!shared.lockFallback){ try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch(e){} }
  releaseUnlockBanners();
}
const esc = (t) => String(t).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
// where this chapter sits in its act: a pip per chapter (cleared, this one, ahead), how far in ('2 OF 5 IN THIS ACT') and
// what's next
function roster(act, pos){
  const list = chapters(), mine = list.map((c, i) => [c, i]).filter(([c]) => c.act === act), next = mine.find(([, i]) => i > pos);
  const pips = mine.map(([, i]) => '<i class="' + (i < pos ? 'done' : i === pos ? 'now' : '') + '"></i>').join('');
  const at = mine.findIndex(([, i]) => i === pos) + 1;
  return '<div class="cc-chapters"><span class="pips">' + pips + '</span><span class="at">' + at + ' OF ' + mine.length + ' IN THIS ACT</span>' +
    '<span class="nx">' + (next ? 'NEXT · ' + esc(chapterTitle(next[0])) : 'LAST CHAPTER OF THE ACT') + '</span></div>';
}
// the card's key line: Space (or Enter) or a click on the keyboard; the pad's A (or MENU: engine/gamepad.js)
function beginHint(what){
  return '<div class="cc-hint"><span class="kbonly">Press Space or click ' + what + '</span><span class="padonly">Press ' +
    '<kbd class="pg" data-b="A">' + PAD_GLYPHS[pad.family].A + '</kbd> ' + what + '</span></div>';
}
function head(c, pos){
  return '<div class="cc-act">ACT ' + ROMAN[c.act] + ' · ' + esc(actTitle(c.act)) + '</div>' +
    '<div class="cc-num">' + chapterNo(pos) + (c.trial ? ' · TRIAL' : '') + '</div>' +
    '<h1 class="cc-title">' + esc(chapterTitle(c)) + '</h1><div class="cc-world">' + esc(c.world) + '</div>';
}
function voice(lines, who){
  return '<div class="cc-voice"><div class="cc-who">' + esc(who || storyVoice(undefined, chapterAt(G.chapter))) + '</div>' + lines.map(l => '<p>' + esc(l) + '</p>').join('') + '</div>';
}
// WHAT TO DO, first and plain: a mission chapter's objectives by their short titles (data/missions.js), or a wave chapter's
// count of waves. The story comes after it, and most of it waits behind a "more" line (lore below)
function goals(c){
  const def = c.kind === 'mission' && MISSIONS[c.mission], said = (v) => typeof v === 'string' ? v : heroKey(v);   // (a mission's words are plain, or one per hero)
  const list = def ? def.objectives.map(o => said(o.title) || said(o.task)).filter(Boolean)
    : c.waves ? ['HOLD OUT FOR ' + (c.waves[1] - c.waves[0]) + ' WAVES'] : [];
  if (!list.length) return '';
  return '<div class="cc-goals"><div class="cc-k">' + (list.length > 1 ? 'OBJECTIVES' : 'OBJECTIVE') + '</div><ol' + (list.length > 3 ? ' class="many"' : '') + '>' + list.map(t => '<li>' + esc(String(t).toUpperCase()) + '</li>').join('') + '</ol></div>';
}
// THE STORY, kept light: one line of it in view (keep: which), the rest of the voice's words and the scene between chapters
// (a `talk`: where, then who says what) folded under "MORE STORY" for whoever wants it. Act II's pick and a story's choice
// use it; a chapter's briefing shows its one line only (showCard)
function lore(lines, who, opts = {}){
  const keep = opts.keep === 'last' ? lines.length - 1 : opts.keep || 0, t = opts.talk, said = t && t.lines && t.lines.length;
  const rest = lines.filter((l, i) => i !== keep);
  return '<div class="cc-scene"><div class="cc-who">' + esc(who) + '</div><p class="nar">' + esc(lines[keep] || '') + '</p>' +
    (rest.length || said ? '<details class="cc-more"><summary>MORE STORY</summary>' + rest.map(l => '<p class="nar">' + esc(l) + '</p>').join('') +
      (said ? '<div class="cc-talk">' + (t.where && t.where !== opts.world ? '<div class="cc-where">' + esc(t.where) + '</div>' : '') +
        t.lines.map(([w, say]) => '<p' + (w === 'YOU' ? ' class="you"' : '') + '><b>' + esc(w) + '</b><span>' + esc(say) + '</span></p>').join('') + '</div>' : '') +
      '</details>' : '') + '</div>';
}
// THE BRIEFING: where you are, what to do and one line of the story. The rest of the story isn't on the card (it would give
// away the opening scene's words): the chapter's talk is heard as it starts
export function showCard(pos){
  const c = chapterAt(pos), list = chapters();
  const opensAct = !c.prologue && (pos === 0 || list[pos - 1].act !== c.act || list[pos - 1].prologue);   // (a prologue is before the act: its opening line waits for chapter 1)
  const lines = [...(opensAct && pos !== actTwoAt() ? [actOpen(c.act)] : []), ...forHero(c.brief, G.hero)];   // (Act II's opening line was on its pick)
  const line = lines[lines.length > 1 && opensAct && pos !== actTwoAt() ? 1 : 0];
  openCard('<div class="cc-inner cc-brief hero-' + G.hero + '">' + head(c, pos) + (c.recap ? gateRecapHtml() : '') + goals(c) + (line ? lore([line], storyVoice(undefined, c)) : '') + roster(c.act, pos) +
    '<div class="cc-btns"><div class="btn primary go" data-go="1">' + (G.coopGuest ? 'READY' : 'BEGIN') + '</div></div>' +
    beginHint(G.coopGuest ? 'when ready' : 'to begin') + '</div>', () => {
      closeCard(); S.reward(1);
      // Act IV's veteran: the upgrade page first, its free pairs and its skill points (game/gate.js veteranKit)
      if (G.gateKitDue){ G.gateKitDue = false; setTimeout(() => { if (G.mode === 'play' && G.chapter === pos) openSkillTree(); }, 300); }
      playOpening(c.id, { k: c.prologue ? 'PROLOGUE' : chapterNo(pos) + ' · ACT ' + ROMAN[c.act], h: chapterTitle(c), p: c.world }, c.opening);   // the chapter's opening scene (game/cutscene.js)
      storyBeat('chapter');
      // the scene's talk, when the opening scene didn't stage it (G.talkStaged: game/cutscene.js): it plays on the comms strip as
      // the chapter gets going (the host's goes to a co-op guest too)
      if (!G.coopGuest && G.talkStaged !== c.id && c.talk && c.talk.lines) comms(c.talk.lines.map(([who, say]) => ({ who, say })));
    });
  resetScenes();   // a new visit to the chapter: its scenes play again
  MUSIC.unlockSting();
}
// sandboxOpened: clearing Act I just opened the sandbox, so the card says so
function showPick(pos, sandboxOpened){
  const c = chapterAt(pos);
  openCard('<div class="cc-inner hero-' + G.hero + '">' +
    '<div class="cc-act">ACT ' + ROMAN[c.act] + '</div><h1 class="cc-title">' + esc(actTitle(c.act)) + '</h1>' +
    lore([actOpen(c.act), ...(storyHero() === 'jedi' ? [JEDI_ACT_TWO_WARN] : []), 'Which first is yours to choose.'], storyVoice(undefined, chapterAt(G.chapter)), { keep: 'last' }) +
    (sandboxOpened ? '<div class="cc-unlock">★ SANDBOX UNLOCKED · try the foes and powers you have met so far, from the main menu</div>' : '') +
    '<div class="cc-pick">' + Object.keys(ACT_TWO).map(k => '<div class="cc-opt brk" data-go="' + k + '"><b>' + esc(actTwoLabel(k)) + '</b><span>' + esc(actTwoLine(k)) + '</span></div>').join('') + '</div>' +
    '</div>', (k) => { if (!ACT_TWO[k]) return; G.actTwo = k; S.reward(1); startChapter(pos); });
  MUSIC.unlockSting();
}
// A STORY'S CHOICE (game/choices.js): the question, who asks it and the two answers. A click picks (no Enter: it has to
// be meant). then: what follows once it's made (the next chapter, or the epilogue). Each pick moves this player's own
// light and dark (game/alignment.js); in co-op the host's decides the story, and every guest is asked too (`own`: their
// pick moves only their own meter)
function showChoice(ch, then, own = false){
  const c = chapterAt(G.chapter);
  if (!own) askGuests(ch.id);
  askChoice({ kicker: 'ACT ' + ROMAN[c ? c.act : 2] + ' · A CHOICE', title: ch.title, lines: storyWords(ch.lines), who: ch.who || storyVoice(undefined, chapterAt(G.chapter)),
    options: ch.options, hint: own ? 'The host\'s pick decides the story. Yours moves your own ' + alignWords() : 'This choice stays with you for the rest of the story, and moves your ' + alignWords() },
    (k) => {
      if (!own) choose(ch.id, k);
      alignChoice(ch.id, k);
      if (!own) autosave('choice');
      if (then) then();
    }, own);
}
const alignWords = () => { const W = ALIGN_WORDS[G.hero] || ALIGN_WORDS.jedi; return W.light.toLowerCase() + ' and ' + W.dark.toLowerCase(); };
// a guest is asked the host's choice (game/alignment.js): its own card, its own meter
setOwnChoice((id) => { const ch = storyChoices(storyHero()).find(x => x.id === id); if (ch && ch.after !== 'end' && !cardUp()) showChoice(ch, null, true); });   // (the last one each screen asks itself: campaignWon)
// ANY CHOICE CARD: the campaign's, and a side mission's (game/mission.js). onPick(key) once one is clicked; `resume`
// takes the pointer back after (in a fight), else the card closes quietly
export function askChoice(q, onPick, resume = false){
  openCard('<div class="cc-inner cc-choice hero-' + G.hero + '">' +
    '<div class="cc-act">' + esc(q.kicker) + '</div><h1 class="cc-title">' + esc(q.title) + '</h1>' +
    lore(q.lines, q.who) +
    '<div class="cc-pick">' + q.options.map(o => '<div class="cc-opt brk' + (o.side ? ' al-' + o.side : '') + '" data-go="' + o.key + '"><b>' + esc(o.label) + '</b><span>' + esc(o.line) + '</span></div>').join('') + '</div>' +
    '<div class="cc-hint">' + esc(q.hint || '') + '</div>' +
    '</div>', (k) => {
      if (!q.options.some(o => o.key === k)) return;
      S.reward(1); closeCard(!resume); onPick(k);
    });
  MUSIC.unlockSting();
}
// the epilogue's line under its number: what this run chose (LEDGER SAVED · ILSA SPARED…)
function choicesRecap(){
  const list = storyChoices(storyHero()).filter(ch => ch.options.length);
  return list.map(ch => { const o = ch.options.find(o => o.key === answer(ch.id)); return o ? o.label : ''; }).filter(Boolean).join(' · ');
}
// THE END: the last chapter's boss is down. The epilogue's card, then the victory screen (game/summary.js victory)
export function campaignWon(then){
  storyBeat('epilogue');
  clearComms();
  G.slowmo = 1; G.slowmoT = 0;
  const card = () => { if (G.mode === 'play') showEpilogue(then); else then(); };
  const own = storyHero() === 'jedi' ? { lines: () => storyWords(JEDI_EPILOGUE_SCENE) } : null;
  // a last look at the hero (game/cutscene.js), then the card. Each screen plays its own in co-op (both get here). A story's
  // last choice (the Jedi's: what becomes of Vexis) comes first; a co-op guest takes the host's
  const scene = () => { if (G.mode !== 'play' || !playScene('epilogue', { onDone: card, share: false, lines: own && own.lines() })) card(); };
  // (a co-op guest is asked it too, on its own card: its pick moves its own meter, the host's decides the story)
  const last = G.coopGuest ? storyChoices(storyHero()).find(ch => ch.after === 'end') : choiceAfter(storyHero(), 'end');
  setTimeout(() => { if (last && G.mode === 'play') showChoice(last, scene, !!G.coopGuest); else scene(); }, 1200);
}
function showEpilogue(then){
  const gate = storyHero() === 'gate';   // Act IV: one act, no pick (its words are this screen's own: game/gate.js)
  openCard('<div class="cc-inner hero-' + G.hero + '">' +
    '<div class="cc-act">' + (gate ? 'ACT IV · EPILOGUE' : 'EPILOGUE') + '</div><div class="cc-num">' + chapters().filter(c => !c.prologue).length + ' CHAPTERS' + (gate ? '' : ' · ' + esc(actTwoLabel(G.actTwo || 'lothal'))) +
    (choicesRecap() ? ' · ' + esc(choicesRecap()) : '') + '</div>' +
    '<h1 class="cc-title">' + esc(epilogueText('title')) + '</h1><div class="cc-world">' + esc(epilogueText('world')) + '</div>' +
    voice(epilogueText('lines')) +
    '<div class="cc-acts">' + (gate ? ['ACT IV'] : ['ACT I', 'ACT II', 'ACT III']).map((a, k) => '<div class="cc-done"><b>' + a + '</b> ' + esc(actTitle(gate ? 3 : k)) + '</div>').join('') + '</div>' +
    '<div class="cc-btns"><div class="btn primary go" data-go="1">CONTINUE</div></div>' +
    '<div class="cc-hint">Enter or click to continue</div></div>', () => { closeCard(true); then(); });
  MUSIC.unlockSting();
}

// Enter (or Space) takes the card's one button; the pick needs a click
window.addEventListener('keydown', (e) => {
  if (!cardUp() || e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
  if (!card.querySelector('.go')) return;
  e.preventDefault(); e.stopPropagation();
  if (onGo) onGo('1');
}, true);
