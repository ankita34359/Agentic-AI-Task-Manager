// `npm start`: build the client only if it hasn't been built yet, then run the server.
// Hosts should run `npm run build` at build time; this is a safety net for local use.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!fs.existsSync(path.join(root, 'client', 'dist', 'index.html'))) {
  console.log('client/dist not found — building the client (npm run build)…');
  const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', 'client'], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await import('../server/index.js');
