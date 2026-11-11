// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// SIMS — one place that finds a Chromium for the headless sims (tools/duel-sim, trooper-sim, mando-sim). Order: $CHROMIUM or
// $PW_CHROMIUM, then Playwright's own browser if it is installed, then /opt/pw-browsers/chromium (cloud sessions), so a sim
// runs without a manual setting wherever a Chromium exists at all.
import { chromium } from 'playwright';
import { existsSync } from 'fs';

export function simBrowserPath(){
  const env = process.env.CHROMIUM || process.env.PW_CHROMIUM;
  if (env) return env;
  try { const own = chromium.executablePath(); if (own && existsSync(own)) return undefined; } catch(e){}   // (undefined: Playwright's own)
  for (const p of ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']) if (existsSync(p)) return p;
  return undefined;
}
export function launchSimBrowser(extraArgs = []){
  return chromium.launch({ executablePath: simBrowserPath(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio', ...extraArgs] });
}
