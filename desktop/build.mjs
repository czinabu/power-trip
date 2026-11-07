// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// Packs the web build into the desktop app. Run from the repo root (the npm scripts do):
//   node desktop/build.mjs run   build the game, then open it in the desktop window
//   node desktop/build.mjs prepare  build the game and copy it in, without opening it (the desktop smoke test)
//   node desktop/build.mjs exe   build the game, then package the Windows .exe files into desktop/release/
//                                (on Windows, or in the "Desktop build" GitHub Action; Linux/Mac need Wine for it)
//   node desktop/build.mjs release N   the same, numbered <major>.<minor>.N, published as a GitHub Release that
//                                installed apps update to (the "Desktop release" GitHub Action runs it; needs GH_TOKEN)
// The website build is untouched: this only copies dist/ into desktop/game/ and runs Electron there.
import { execSync } from 'node:child_process';
import { cpSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const sh = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });
const mode = process.argv[2] || 'run';

// the .exe carries the game's version; a release swaps the patch for its own count, so each one is newer than the last
let version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
if (mode === 'release'){
  const n = parseInt(process.argv[3], 10);
  if (!(n > 0)) throw new Error('usage: node desktop/build.mjs release <release number>');
  version = version.split('.').slice(0, 2).join('.') + '.' + n;
}
// the game's own version label (main menu) must match the installed release, so hand it to the web build (vite.config.js)
process.env.POWER_TRIP_VERSION = version;
sh('npm run build');
if (!existsSync(path.join(here, 'node_modules', 'electron'))) sh('npm install --no-audit --no-fund', here);
rmSync(path.join(here, 'game'), { recursive: true, force: true });
cpSync(path.join(root, 'dist'), path.join(here, 'game'), { recursive: true });

if (mode === 'exe' || mode === 'release'){
  const publish = mode === 'release' ? 'always' : 'never';
  sh(`npx electron-builder --win portable nsis --publish ${publish} -c.extraMetadata.version=${version}`, here);
} else if (mode === 'run') sh('npx electron .', here);
