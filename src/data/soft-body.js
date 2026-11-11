// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SOFT BODIES (a preview, off by default): the foes named here are built on one continuous body that bends at the
// joints, as the heroes are (enemies/softbody.js), instead of a rigid piece per bone. Settings: FOE BODIES (ui/menus.js);
// ?softbody=1 or 0 in the address forces it for this visit. It takes hold on the next foe built, so every mode shows it.

export const SOFT_BODY = {
  on: false,
  // every trooper built from the shared armoured parts (enemies/mesh.js MODELS): the foes, the clone and Mandalorian
  // squadmates, and the armoured bosses. Droids (magna, b1) and the robed duelists (acolyte) keep their own bodies
  models: ['purge', 'storm', 'heavy', 'jet', 'riot', 'scout', 'officer', 'grenadier', 'lancer',
           'clone', 'mandalorian', 'marshal', 'commander', 'magistrate'],
};
try { const q = new URLSearchParams(location.search).get('softbody'); if (q != null) SOFT_BODY.forced = q !== '0'; } catch(e){}

export const softBodyOn = () => SOFT_BODY.forced ?? SOFT_BODY.on;
export const isSoft = model => softBodyOn() && SOFT_BODY.models.includes(model);
