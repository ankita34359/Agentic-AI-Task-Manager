import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JsonDb } from './db.js';
import { tmpDir } from './test-helpers.js';

const fileIn = () => path.join(tmpDir(), 'db.json');

test('a new database file is created, and data survives a restart', async () => {
  const file = fileIn();
  const db = JsonDb.open(file);
  assert.ok(fs.existsSync(file));
  db.data.users.push({ id: 'u1', email: 'a@b.test' });
  await db.commit();

  const again = JsonDb.open(file);
  assert.equal(again.userById('u1').email, 'a@b.test');
  assert.ok(fs.existsSync(`${file}.bak`), 'a backup copy is made at startup');
});

test('writes are atomic: no temp files are left behind and the file is always valid JSON', async () => {
  const file = fileIn();
  const db = JsonDb.open(file);
  const writes = [];
  for (let i = 0; i < 200; i++) {
    db.data.users.push({ id: `u${i}`, email: `e${i}@b.test`, blob: 'x'.repeat(2000) });
    writes.push(db.commit());
    if (i % 25 === 0) JSON.parse(fs.readFileSync(file, 'utf8')); // readable and valid mid-burst
  }
  await Promise.all(writes);
  await db.flush();
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).users.length, 200);
  assert.deepEqual(fs.readdirSync(path.dirname(file)).filter((f) => f.includes('.tmp-')), []);
});

test('a burst of commits is coalesced and the last state always wins', async () => {
  const file = fileIn();
  const db = JsonDb.open(file);
  let writes = 0;
  const orig = db._atomicWrite.bind(db);
  db._atomicWrite = (json) => ((writes += 1), orig(json));
  const ps = [];
  for (let i = 0; i < 50; i++) {
    db.data.counter = i;
    ps.push(db.commit());
  }
  await Promise.all(ps);
  assert.ok(writes < 10, `expected coalescing, got ${writes} writes for 50 commits`);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).counter, 49);
});

test('a commit that races the end of a write is never lost', async () => {
  const file = fileIn();
  const db = JsonDb.open(file);
  for (let round = 0; round < 40; round++) {
    db.data.round = round;
    const first = db.commit();
    await first.then(() => {
      db.data.after = round; // mutate + commit in the microtask right after a write finishes
      return db.commit();
    });
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(onDisk.round, round);
    assert.equal(onDisk.after, round);
  }
});

test('a commit landing in the same tick a write finishes is never lost', async () => {
  // Deterministically hits the narrow window: a microtask that runs AFTER the write loop decided it was
  // done but BEFORE the loop's bookkeeping finished (a naive `.finally(() => (loop = null))` loses this write).
  const file = fileIn();
  const db = JsonDb.open(file);
  const orig = db._atomicWrite.bind(db);
  let injected = false;
  db._atomicWrite = (json) => {
    const p = orig(json);
    if (!injected) {
      injected = true;
      // registered after the write loop's own `await p`, so it runs right behind it
      queueMicrotask(() =>
        p.then(() => {
          db.data.late = 'survived';
          db.commit();
        }),
      );
    }
    return p;
  };
  db.data.first = true;
  await db.commit();
  // NB: no db.flush() here — flush re-commits dirty state and would mask exactly the loss we're testing for.
  await new Promise((r) => setTimeout(r, 50));
  const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(onDisk.first, true);
  assert.equal(onDisk.late, 'survived', 'the racing commit must reach the disk');
});

test('flush() waits for pending writes (this is what the SIGTERM hook calls)', async () => {
  const file = fileIn();
  const db = JsonDb.open(file);
  db.data.users.push({ id: 'late' });
  db.commit(); // deliberately not awaited
  await db.flush();
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).users[0].id, 'late');
});

test('a corrupt database is refused loudly and never overwritten', () => {
  const file = fileIn();
  fs.writeFileSync(file, '{"users": [ {"id": "precious"');
  assert.throws(() => JsonDb.open(file), /corrupt.*NOT modified/s);
  assert.equal(fs.readFileSync(file, 'utf8'), '{"users": [ {"id": "precious"', 'file untouched');

  fs.writeFileSync(file, '[1,2,3]');
  assert.throws(() => JsonDb.open(file), /corrupt/);
});

test('missing top-level keys from older files are filled in', () => {
  const file = fileIn();
  fs.writeFileSync(file, JSON.stringify({ version: 1, users: [{ id: 'x' }] }));
  const db = JsonDb.open(file);
  assert.deepEqual(db.data.workspaces, []);
  assert.equal(db.userById('x').id, 'x');
});
