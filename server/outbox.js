import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { guardedLookup } from './lib/netguard.js';

export const MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF = [3_000, 15_000]; // wait after attempt 1, after attempt 2
const LOG_CAP = 1000;
const TIMEOUT_MS = 8_000;

/** One JSON POST. Never follows redirects, discards the body. Returns { ok, status, error } — never throws, never includes the URL. */
export function postJson(url, body, { allowPrivate = false, timeoutMs = TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(url);
    } catch {
      return resolve({ ok: false, status: null, error: 'bad_url' });
    }
    const payload = Buffer.from(JSON.stringify(body));
    const lib = u.protocol === 'http:' ? http : https;
    let done = false;
    const finish = (r) => {
      if (!done) {
        done = true;
        resolve(r);
      }
    };
    const req = lib.request(
      u,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': payload.length, 'user-agent': 'OutcomeLedger/1' },
        timeout: timeoutMs,
        ...(allowPrivate ? {} : { lookup: guardedLookup() }),
      },
      (res) => {
        res.resume();
        const s = res.statusCode;
        finish({ ok: s >= 200 && s < 300, status: s, error: s >= 200 && s < 300 ? null : s >= 300 && s < 400 ? 'redirect' : 'http' });
      },
    );
    req.on('timeout', () => {
      finish({ ok: false, status: null, error: 'timeout' });
      req.destroy();
    });
    req.on('error', (err) => finish({ ok: false, status: null, error: err.code === 'EBLOCKED' ? 'blocked' : 'network' }));
    req.end(payload);
  });
}

/**
 * Persistent events outbox. Entries live in db.data.outbox (so a restart or redeploy keeps pending retries);
 * the destination URL is read from the workspace at send time and is NEVER copied into the outbox or the log.
 * Each attempt is appended to db.data.activity as: when, event, task, attempt n/3, HTTP status (or an error word).
 */
export class Outbox {
  constructor({ db, post = postJson, allowPrivate = false, backoffMs = DEFAULT_BACKOFF, now = () => Date.now() }) {
    Object.assign(this, { db, post, allowPrivate, backoffMs, now });
    this.timer = null;
    this.running = false;
    this.stopped = true;
  }

  urlFor(workspaceId) {
    return this.db.workspaceById(workspaceId)?.integrations?.eventsFlowUrl || null;
  }

  start() {
    this.stopped = false;
    this.schedule();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  /** Queue an event for a workspace. Returns false (and queues nothing) when no events URL is configured. */
  enqueue(workspaceId, payload) {
    if (!this.urlFor(workspaceId)) return false;
    this.db.data.outbox.push({ id: crypto.randomUUID(), workspaceId, payload, attempts: 0, nextAt: this.now() });
    this.db.commit().catch((e) => console.error('outbox commit failed:', e.message));
    this.schedule();
    return true;
  }

  /** One immediate attempt (the "Send test event" button). Logged like any other. */
  async sendNow(workspaceId, payload) {
    const url = this.urlFor(workspaceId);
    if (!url) return { ok: false, status: null, error: 'no_url' };
    const r = await this.post(url, payload, { allowPrivate: this.allowPrivate });
    this.log(workspaceId, payload, { attempt: 1, of: 1, ...r, willRetry: false });
    await this.db.commit();
    return r;
  }

  log(workspaceId, payload, { attempt, of, ok, status, error, willRetry }) {
    const a = this.db.data.activity;
    a.push({ id: crypto.randomUUID(), at: new Date(this.now()).toISOString(), workspaceId, event: payload.event, taskId: payload.taskId, title: payload.title, attempt, of, ok, status: status ?? null, error: error ?? null, willRetry: !!willRetry });
    if (a.length > LOG_CAP) a.splice(0, a.length - LOG_CAP);
  }

  schedule() {
    clearTimeout(this.timer);
    if (this.stopped || !this.db.data.outbox.length) return;
    const next = Math.min(...this.db.data.outbox.map((e) => e.nextAt));
    this.timer = setTimeout(() => this.tick(), Math.max(0, next - this.now()));
    this.timer.unref?.();
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      for (;;) {
        const entry = this.db.data.outbox.find((e) => e.nextAt <= this.now());
        if (!entry) break;
        await this.attempt(entry);
      }
    } finally {
      this.running = false;
      this.schedule();
    }
  }

  async attempt(entry) {
    const { outbox } = this.db.data;
    const drop = () => outbox.splice(outbox.indexOf(entry), 1);
    const url = this.urlFor(entry.workspaceId);
    if (!url) {
      drop();
      this.log(entry.workspaceId, entry.payload, { attempt: entry.attempts + 1, of: MAX_ATTEMPTS, ok: false, error: 'no_url', willRetry: false });
      return this.db.commit();
    }
    entry.attempts += 1;
    const r = await this.post(url, entry.payload, { allowPrivate: this.allowPrivate });
    const willRetry = !r.ok && r.error !== 'blocked' && entry.attempts < MAX_ATTEMPTS;
    this.log(entry.workspaceId, entry.payload, { attempt: entry.attempts, of: MAX_ATTEMPTS, ...r, willRetry });
    if (r.ok || !willRetry) drop();
    else entry.nextAt = this.now() + (this.backoffMs[entry.attempts - 1] ?? this.backoffMs.at(-1));
    await this.db.commit();
  }

  /** Test helper: resolves when nothing is queued and nothing is in flight. */
  async idle(timeoutMs = 5000) {
    const end = Date.now() + timeoutMs;
    while ((this.db.data.outbox.length || this.running) && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
  }
}
