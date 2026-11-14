import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { JsonDb } from './db.js';
import { onShutdown, runShutdownHooks } from './lifecycle.js';

const config = loadConfig();
const db = JsonDb.open(config.dbFile);
onShutdown(() => db.flush()); // a redeploy (SIGTERM) must never truncate db.json
const app = createApp(config, { db });
onShutdown(() => app.locals.outbox.stop());

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Outcome Ledger listening on http://0.0.0.0:${config.port} (${config.isProd ? 'production' : 'development'})`);
  console.log(`Data directory: ${config.dataDir} (${db.data.users.length} users, ${db.data.workspaces.length} workspaces)`);
});

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`${signal} received — shutting down`);
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  server.close();
  server.closeIdleConnections?.();
  await runShutdownHooks();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
