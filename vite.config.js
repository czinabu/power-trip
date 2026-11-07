import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Build label shown on the main menu so co-op players can check they run the same build:
// package.json version plus the short commit hash (Vercel's env var, else git, else omitted).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
let hash = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7);
if (!hash) { try { hash = execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { hash = ''; } }
const BUILD_LABEL = 'v' + pkg.version + (hash ? ' · ' + hash : '');

// `npm run build` writes ONE self-contained dist/index.html (all JS + CSS inlined),
// so the built game still opens with a double-click, no server needed.
export default defineConfig({
  define: { __BUILD_LABEL__: JSON.stringify(BUILD_LABEL) },
  plugins: [viteSingleFile()],
  build: { target: 'es2022' },
});
