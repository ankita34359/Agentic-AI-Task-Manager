// Tiny shutdown registry. Later milestones (db write queue, outbox) register flush hooks here
// so SIGTERM during a redeploy never truncates db.json.
const hooks = [];

export function onShutdown(fn) {
  hooks.push(fn);
}

export async function runShutdownHooks() {
  for (const fn of hooks.splice(0).reverse()) {
    try {
      await fn();
    } catch (err) {
      console.error('shutdown hook failed:', err);
    }
  }
}
