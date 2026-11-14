import fs from 'node:fs';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';

/**
 * Tiny JSON-file database.
 *  - the whole dataset lives in memory (`db.data`); handlers mutate it synchronously, then `await db.commit()`
 *  - writes are atomic (temp file → fsync → rename) so a crash or SIGTERM can never leave a half-written db.json
 *  - writes are serialized and coalesced: many commits in a burst become one or two disk writes
 *  - a corrupt db.json is never overwritten: startup fails loudly and points at the .bak copy
 */
const EMPTY = () => ({ version: 1, workspaces: [], users: [], tasks: [] });

export class JsonDb {
  constructor(file) {
    this.file = file;
    this.data = EMPTY();
    this.dirty = false;
    this._loop = null;
    this.lastError = null;
  }

  static open(file) {
    const db = new JsonDb(file);
    db.load();
    return db;
  }

  load() {
    let raw = null;
    try {
      raw = fs.readFileSync(this.file, 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    if (raw === null) {
      this.data = EMPTY();
      fs.writeFileSync(this.file, JSON.stringify(this.data), { mode: 0o600 });
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('top level is not an object');
      this.data = { ...EMPTY(), ...parsed };
    } catch (err) {
      throw new Error(`Database file ${this.file} is corrupt (${err.message}). It was NOT modified. Restore ${this.file}.bak or fix it by hand.`);
    }
    // One safety copy per start (cheap while the dataset is small).
    try {
      fs.copyFileSync(this.file, `${this.file}.bak`);
    } catch {
      /* best effort */
    }
  }

  /** Persist the current state. Resolves once everything committed so far is on disk. */
  commit() {
    this.dirty = true;
    if (!this._loop) this._loop = this._run();
    return this._loop;
  }

  async _run() {
    try {
      while (this.dirty) {
        this.dirty = false;
        await this._atomicWrite(JSON.stringify(this.data));
      }
      this.lastError = null;
    } catch (err) {
      this.lastError = err;
      this.dirty = true; // try again on the next commit/flush
      throw err;
    } finally {
      // Runs synchronously at the end of the async function, so a commit() racing the tail
      // of the loop always starts a fresh one instead of being dropped.
      this._loop = null;
    }
  }

  async _atomicWrite(json) {
    const tmp = `${this.file}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    const fh = await fsp.open(tmp, 'w', 0o600);
    try {
      await fh.writeFile(json);
      await fh.sync();
    } finally {
      await fh.close();
    }
    try {
      await fsp.rename(tmp, this.file);
    } catch (err) {
      await fsp.rm(tmp, { force: true });
      throw err;
    }
  }

  /** Wait for any in-flight/pending write (used on shutdown and in tests). */
  async flush() {
    if (this.dirty || this._loop) await this.commit();
  }

  // ───────── small query helpers (arrays are fine at this scale; swap for indexes if it ever grows) ─────────
  userById(id) {
    return this.data.users.find((u) => u.id === id) || null;
  }
  userByEmail(email) {
    return this.data.users.find((u) => u.email === email) || null;
  }
  workspaceById(id) {
    return this.data.workspaces.find((w) => w.id === id) || null;
  }
  workspaceByInvite(normalizedCode) {
    return this.data.workspaces.find((w) => w.inviteCode === normalizedCode) || null;
  }
  taskById(id) {
    return this.data.tasks.find((t) => t.id === id) || null;
  }
  tasksOfUser(userId) {
    return this.data.tasks.filter((t) => t.ownerId === userId);
  }
  usersInWorkspace(workspaceId) {
    return this.data.users.filter((u) => u.workspaceId === workspaceId);
  }
}
