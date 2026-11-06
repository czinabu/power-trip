// SETTINGS INFO TIPS — a small "i" beside every setting's name that explains what it does. One shared tip box,
// shown when the mouse is on the "i", when the "i" has keyboard focus, when it's tapped (phones), or when the
// controller's focus ring sits on the row (engine/gamepad.js puts .padfocus on it). The Settings panel is the same
// one everywhere (main menu, pause in every mode), so this covers every mode.
// The words come from each row's title (moved to data-tip so the browser's own tooltip doesn't double it); rows
// without one get theirs from FALLBACK.
const FALLBACK = {
  GRAPHICS: 'Visual quality: HIGH, MEDIUM or LOW. Lower it if the game stutters. P cycles it any time',
  VOLUME: 'Master volume for everything',
  MUSIC: 'How loud the music is, against the master volume',
  EFFECTS: 'How loud sabers, blasters, explosions and voices are, against the master volume',
  SENSITIVITY: 'Mouse look speed',
};

const panel = document.getElementById('settings');
const tip = document.createElement('div');
tip.className = 'set-tip'; tip.setAttribute('role', 'tooltip'); tip.id = 'settip';
document.body.appendChild(tip);
let anchor = null;   // the row the tip is showing for

function rowName(row){
  for (const n of row.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return n.textContent.trim();
  return '';
}
function show(row){
  const text = row.dataset.tip;
  if (!text || !panel.classList.contains('open')) return hide();
  anchor = row;
  tip.textContent = text;
  tip.classList.add('on');
  const r = row.getBoundingClientRect(), w = Math.min(320, innerWidth - 24);
  tip.style.width = w + 'px';
  const left = Math.max(12, Math.min(r.left, innerWidth - w - 12));
  tip.style.left = left + 'px';
  const h = tip.offsetHeight;
  const below = r.bottom + 6 + h <= innerHeight - 8;
  tip.style.top = (below ? r.bottom + 6 : Math.max(8, r.top - 6 - h)) + 'px';
}
function hide(row){
  if (row && row !== anchor) return;
  anchor = null; tip.classList.remove('on');
}

for (const row of panel.querySelectorAll('.set-grp .setpill')){
  const text = row.getAttribute('title') || FALLBACK[rowName(row)];
  if (!text) continue;
  row.dataset.tip = text; row.removeAttribute('title');
  const i = document.createElement('span');
  i.className = 'set-i'; i.textContent = 'i'; i.tabIndex = 0;
  i.setAttribute('role', 'button'); i.setAttribute('aria-label', 'About ' + rowName(row).toLowerCase()); i.setAttribute('aria-describedby', 'settip');
  // right after the name, so the control and its value stay pushed to the right
  const name = [...row.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
  row.insertBefore(i, name ? name.nextSibling : row.firstChild);
  // hover is the mouse's; a finger's tap fires leave events too, which would take the tip straight back
  i.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(row); });
  i.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(row); });
  i.addEventListener('focus', () => show(row));
  i.addEventListener('blur', () => hide(row));
  // a tap (or click) on the "i" explains the row and never changes the setting
  i.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); show(row); });
  i.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); e.stopPropagation(); show(row); } });
}

// the controller's focus ring: explain whichever row it lands on
new MutationObserver((muts) => {
  for (const m of muts){
    const el = m.target;
    if (el === panel){ if (!panel.classList.contains('open')) hide(); continue; }
    if (!el.dataset || !el.dataset.tip) continue;
    const was = /\bpadfocus\b/.test(m.oldValue || ''), is = el.classList.contains('padfocus');
    if (is && !was) show(el); else if (was && !is) hide(el);   // other class changes on the row leave the tip alone
  }
}).observe(panel, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
// a tap anywhere else, scrolling the panel or resizing puts it away
document.addEventListener('pointerdown', (e) => { if (anchor && !e.target.closest('.set-i')) hide(); }, true);
panel.addEventListener('scroll', () => hide(), true);
addEventListener('resize', () => hide());
