// POWER TRIP © 2026 Caleb Zinabu. All rights reserved. See LICENSE.
// UPDATES for the desktop app. New versions are GitHub Releases on czinabu/power-trip, made by the "Desktop release"
// workflow (.github/workflows/desktop-release.yml). On every launch, quietly, a few seconds in:
//   - the INSTALLED app (PowerTrip-…-setup.exe) downloads a newer version in the background and installs it when the
//     game is closed, so the next launch is the new version; a small Windows notification says it's ready
//   - the PORTABLE .exe can't replace itself while it runs, so it only says a newer version is out; clicking the
//     notification opens the release page to download it
// Offline? It just tries again later. No network, no release yet, or a dev run (npm run desktop): nothing happens and the game plays as normal.

const { app, Notification, shell } = require('electron');

const REPO = 'czinabu/power-trip';
const RECHECK_MS = 30 * 60 * 1000;   // how often a running game looks again
let notifiedTag = null, downloaded = false;
const RELEASES = `https://github.com/${REPO}/releases/latest`;

function notify(title, body, onClick){
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, silent: true });
  if (onClick) n.on('click', onClick);
  n.show();
}

// "1.8.12" > "1.8.9"
function newer(a, b){
  const pa = String(a).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++){ if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
  return false;
}

async function checkPortable(){
  const { net } = require('electron');
  const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { accept: 'application/vnd.github+json' } });
  if (!res.ok) return;
  const rel = await res.json();
  if (rel && rel.tag_name && rel.tag_name !== notifiedTag && newer(rel.tag_name, app.getVersion())){
    notifiedTag = rel.tag_name;
    notify('Power Trip ' + rel.tag_name.replace(/^v/, '') + ' is out', 'Click to download the new version.', () => shell.openExternal(rel.html_url || RELEASES));
  }
}

let updaterReady = false;
function checkInstalled(){
  const { autoUpdater } = require('electron-updater');
  if (!updaterReady){   // set up once; later checks reuse it
    updaterReady = true;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;   // installs silently when the game closes
    autoUpdater.logger = null;
    autoUpdater.on('update-downloaded', (info) => {
      downloaded = true;
      notify('Power Trip ' + info.version + ' is ready', 'It installs when you close the game.');
    });
    autoUpdater.on('error', () => {});   // offline, GitHub down: try again later
  }
  return autoUpdater.checkForUpdates();
}

exports.startUpdateCheck = function startUpdateCheck(){
  if (!app.isPackaged || process.env.POWER_TRIP_NO_UPDATES) return;
  const portable = !!process.env.PORTABLE_EXECUTABLE_FILE;
  const check = () => {
    if (downloaded) return;   // already waiting to install on close
    Promise.resolve(portable ? checkPortable() : checkInstalled()).catch(() => {});
  };
  setTimeout(check, 5000);
  setInterval(check, RECHECK_MS).unref();
};
exports.newer = newer;
