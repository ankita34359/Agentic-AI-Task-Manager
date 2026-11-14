# PROGRESS

Living status file. **Update it at the end of every milestone** (done / decisions / deployed / next), in the same push as the milestone.

_Last updated: end of Milestone 4 (viaSocket events outbox + Integrations page)._

## Working agreements
- Work on branch `claude/vigilant-cray-88il2r`. Small commits. Stop after each milestone and show how to test it.
- After each milestone: **push the branch and redeploy to Embarko** so it can be tested on the live link.
- **Ask before merging to `main`.** No PR unless asked.
- Never commit secrets, webhook URLs, tokens or data files (`.gitignore` covers `.env*`, `server/data/`, uploads, `client/dist`).

## Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Scaffold & landing (Express + Vite, `DATA_DIR`, deployable `npm start`) | ✅ done, deployed |
| — | **Visual redesign** (comic world, mascot Tally, torn-paper transitions, sticky notes) | ✅ done, deployed |
| — | Small fixes after review (0.5 s transition, doodle placement, dark bubble contrast) | ✅ done, deployed |
| 2 | **Auth & roles** (admin/employee sign-up, login, invite code, guards, role shells) | ✅ done, deployed |
| 3 | **Outcomes & board** (create form, 3/day limit, Outcome Coach, kanban Planned↔In Progress) | ✅ done, deployed |
| 4 | **viaSocket events outbox + Integrations page** | ✅ done & pushed (deploy status: see Deployed) |
| 5 | Proof & Proof Validator (animated steps, Verified stamp, Review Queue) | planned |
| 6 | Scores & dashboards (+ demo data) | planned |
| 7 | AI-flow adapter & Weekly Review | planned |
| 8 | Polish & hardening (+ admin **Export backup** button, see Decisions) | planned |
| 9 | Deploy to Embarko (first-class pass: data-loss briefing, backups decision) | planned (a working deploy already exists) |
| 10 | M91 alerts (send, signed callback, dedupe, read-back) | planned — after deploy, needs the public URL |

### What exists today
- **Server** (`server/`): Express 5 app, helmet CSP, gzip, static client + SPA fallback, graceful SIGTERM (flushes the DB), `DATA_DIR`/`PORT`/`JWT_SECRET` config (production refuses to start without a ≥ 32-char `JWT_SECRET`).
  - `db.js` JSON database: atomic temp-file+fsync+rename writes, serialized & coalesced, corrupt file refused (never overwritten), `.bak` copy at startup.
  - Auth API: `POST /api/auth/admin/signup`, `POST /api/auth/employee/signup`, `GET /api/auth/invite/:code`, `POST /api/auth/login`, `GET /api/me`, `GET /api/team` (admin), `POST /api/workspace/invite/regenerate` (admin).
  - **32 `node:test` tests** (auth, roles, tenant isolation, JWT attacks, rate limits, DB durability). Mutation-checked: deliberately breaking the role/tenant checks, the login error uniformity, password hashing and the DB write race each makes a test fail.
- **Client** (`client/`): React 19 + Vite 8 + Framer Motion 14. Landing page, **login + both sign-up pages** (Tally reacts: thinks while submitting, cheers on success, shrugs on errors), `AuthContext` (session, `/api/me` revalidation), route guards, **admin shell** (Overview with invite code + team, plus Team/Review Queue/Integrations placeholders) and **employee shell** (Dashboard + My Board/Weekly Review placeholders), 404.
- **Browser e2e** (`e2e/auth.e2e.cjs`, 39 checks, needs Playwright; not part of `npm test`): sign-up/login/logout flows, guards, role bounces, copy buttons, invite regeneration, persistence across a server restart + SIGTERM, mobile overflow, reduced motion.
- **Design system** (all in `client/src/components`, documented in README): `Mascot` (Tally, 6 moods), `TornTransition`, `StickerCard`, `SquishyButton` (+ comic bursts), `OneLiner` (`lib/lines.js`, playful/calm tone), `SpeechBubble`, `StickyNote`, `EmptyState`, `Marquee`, `Squiggle`, `Confetti`, `Ambient`, `CursorTrail`, `ScoreRing`, `TrendLine`, `CountUp`, `VerifiedStamp`, toasts.
- **Milestone 3 — outcomes & board:**
  - Server: `server/lib/tasks.js` (pure status state machine + daily-limit math), `server/lib/coach.js` (built-in Outcome Coach heuristics), `server/routes/tasks.js`. Endpoints (employee only): `GET /api/tasks`, `POST /api/tasks`, `POST /api/tasks/:id/status`, `POST /api/coach`.
  - **51 server tests** now (19 new in `server/tasks.test.js`), mutation-checked: allowing Done, removing the limit, and ignoring the timezone each make tests fail.
  - Client: `/app/board` (`pages/employee/board/`): outcome form + live Coach (Tally reacts), 3-pip daily meter, kanban of sticky notes (dnd-kit: mouse, delayed touch, keyboard Space/←/→), **"Move to…" native select on every note** (the mobile/keyboard path), proof dialog placeholder, friendly empty/limit states, columns swipe with snap on phones.
  - `e2e/board.e2e.cjs` (35 checks: coach, form errors, 3/day + server 409, drag, persistence, menu, Done refused/proof dialog, keyboard, admin guard, light/reduced-motion/mobile).
- **Milestone 4 — events outbox + Integrations (events part):**
  - Server: `lib/netguard.js` (SSRF guard), `lib/events.js` (flat payload + field reference), `outbox.js` (persistent outbox, 3 attempts, backoff, attempt log), `routes/integrations.js` (admin only: `GET /api/integrations`, `PUT|DELETE /api/integrations/events`, `POST /api/integrations/events/test`). Task create / status change enqueue `task.created` / `task.status_changed`.
  - **69 server tests** (18 new in `server/integrations.test.js`, run against a local mock endpoint). Mutation-checked: removing the private-IP block, allowing http, removing the 3-attempt cap, and leaking the URL into the log each make tests fail.
  - Client: `/admin/integrations`: events-URL field (masked once saved, Replace/Remove), "Send test event", activity-log table, field reference, copyable Google Sheet header row and two Slack templates, disabled AI-flow and M91 placeholders.
  - `e2e/integrations.e2e.cjs` (29 checks, includes the real 3-attempt backoff, masking, copy buttons, employee guard, mobile, reduced motion).
- **Nothing else yet**: no proof/validator, no scores.

## Deployed
- **App:** `outcome-ledger` on Embarko → https://outcome-ledger.embarko.app (app id in `embarko.json`).
- **Live version:** `0.4.2-m3-board` (Milestone 3 on top of Milestone 2 + the small fixes), built from commit `1d000fd`. Verified on the real URL: bundle hashes equal the local build (`index-CgE3iBOm.js` / `index-B6wCoKjF.css`); `/api/health` ok; a fresh employee signed up with the invite code, created 3 outcomes through the UI, the 4th was refused (409 `daily_limit`), a drag Planned → In Progress worked, the API refused Done (409 `verified_only`), the employee token got 403 on `/api/team`, no console errors; after a **forced real restart** (uptime reset) the same employee logged in and still had 3 outcomes (data in `/data/db.json`).
  ⚠ Test data left on the live app from my verification: workspace "Live Test Co" with one admin and one employee ("Live Employee") holding 3 outcomes. Auth + outcome data are not backed up (see Decisions).
- **Milestone 4 is pushed (`7d90dd6`) but NOT deployed yet**: my context ran out before I could send the ~83-file upload. The live app is still `0.4.2-m3-board`. **Next session: redeploy first** (files to include that are new in M4: `server/lib/netguard.js`, `server/lib/events.js`, `server/outbox.js`, `server/routes/integrations.js`, `client/src/pages/admin/Integrations.jsx`, `client/src/styles/integrations.css`; changed: `server/{app,config,db,index}.js`, `server/routes/{api,tasks}.js`, `client/src/{App,main}.jsx`, `client/src/lib/api.js`). Then verify live: `/api/health`, bundle hashes, admin → Integrations page, save a URL, Send test event, restart persistence.
- **Deploy gotcha (cost me two failed builds):** `deploy_app` **replaces** the whole source — every upload must contain all ~77 files, including all five stylesheets (`global`, `comic`, `landing`, `app`, `board`). A failed build never replaces the live version. Check the file list against `git ls-files` before sending.
- **Env vars on the app** (names only; values never in the repo or chat): `JWT_SECRET`, `NODE_ENV=production`, `PUBLIC_BASE_URL`. Embarko injects `PORT`, `DATA_DIR` (`/data`), `APP_NAME`, `APP_VERSION`, `STORAGE_TOKEN`.
- **Persistence:** only `DATA_DIR` (`/data`) survives restarts and redeploys; the rest of the disk is wiped on each redeploy. **Embarko does not back up `/data`.** Deleting the app deletes the data. `db.json` (users, workspaces, outcomes) is stored there.
- **Platform limits:** 256 MB RAM; no WebSockets, background workers, multiple processes or managed DB. Node 22.23.4.

### How a redeploy works (so it is repeatable)
1. Commit + push the branch.
2. `deploy_app` (Embarko connector) with the **full source** as `files` (no `node_modules`, `client/dist`, `.env*`, tests, lockfile) and a new `app_version`. Embarko runs `npm install` → `npm run build` → `npm start`.
3. Stored env vars are attached automatically on a fresh deploy. If the app crash-loops on `JWT_SECRET`, run `apply_env_vars`.
4. Poll deployment status **and** hit the real URL (status can say "live" while the app returns 502).
5. Verify: `/api/health`, browser check, and compare the built `index-*.js/css` hashes in the Embarko build log to the local build (proves the upload was faithful).
6. Known cost: each redeploy re-sends all source (~35k tokens and growing). A deploy token + tarball upload would be lighter, but it needs a new credential and your OK.

## Decisions made

### Product & scoring (assumptions you accepted)
1. Employee sees their own Value Score ring; admin sees team scores plus on-time rate, focus ratio, estimate accuracy.
2. On-time factor: 1.0 if verified by the deadline, **0.5 if late**.
3. Rework = each return from In Review → In Progress (validator "ask" or admin "needs rework"), ×0.9 each.
4. Verified impact = admin's impact if set, else the employee's. Ring caps visually at 100; the number may exceed it.
5. One admin per workspace. JavaScript, not TypeScript.
6. The viaSocket **AI flow** URL is separate from the **events flow** URL; the AI flow must return the documented JSON schema (documented at milestone 7).
7. M91 callbacks are treated as a **signal only**: always read the alert back (`GET /s/<token>/alerts/<id>`) before changing a card, because M91 doesn't document its signature header, timestamp field, digest encoding or replay window, and says the callback secret "is not shown anywhere yet".

### Architecture
- One repo, one root `package.json`. `npm run dev` = API (`:3000`) + Vite (`:5173`, proxies `/api`). `npm start` = single port, builds the client only if `client/dist` is missing.
- Every writable path derives from `DATA_DIR` (default `./server/data`, gitignored). Production requires `JWT_SECRET`; dev auto-generates one into `DATA_DIR/.jwt-secret`.
- Storage will be a JSON file with atomic writes (tmp + rename), a serialized write queue and a SIGTERM flush hook (`server/lifecycle.js`).
- Build tooling (`vite`, `@vitejs/plugin-react`) and the font packages live in `dependencies` so hosts that skip dev deps still build.
- API default port is 3000 in dev too (plan said 3001) so one `PORT` works everywhere.
- `server/config.js` tolerates runtimes without `process.loadEnvFile`.
- Deploys upload no lockfile (79 KB, too big to transcribe through the connector) → dependency versions are resolved fresh from `package.json` on each build.

### Design
- Comic/cartoon world: Bangers (display) + Fredoka (body) fonts installed from npm (nothing extra to upload); light and dark themes; reduced-motion support; mobile layouts.
- Mascot **Tally**: an original mint ink-blob with a check-mark antenna (moods: idle, wave, think, cheer, shrug, sleep). Poses are CSS-driven; eyes follow the cursor via one shared throttled pointer listener.
- Motion rules: animate `transform`/`opacity` only; capped particles (22 confetti, 14 trail sparkles, 15 ambient nodes, 3 bursts); all CSS animation pauses in hidden tabs (`html[data-hidden]`); reduced motion kills every CSS animation.
  - Known exceptions: the score ring / trend line draw-in uses SVG stroke offset (tiny, sample card only).
- **Vibe system:** pages declare `usePageVibe('lively' | 'calm', 'playful' | 'calm')`. Data-heavy pages (dashboard, board, tables) must use `calm`; admin pages use the calm tone.
- Torn-paper route transition ≈ 0.54 s (measured); reduced motion = instant swap + fade.
- Doodles never sit behind text: left-gutter only at ≥ 1280 px, artwork side otherwise, hidden below 961 px.
- Dark-theme speech bubbles are cream with ink text (16.9:1).
- Retired in the redesign: particles, aurora, magnetic buttons.
- Security: strict CSP from Express (Embarko's edge overrides it with a looser one); no inline scripts (theme bootstrap is `/theme-init.js`).

### Decisions from your review (after milestone 2 planning)
- **Proof screenshots stay in `/data`** (`DATA_DIR/uploads`): private, login required, served only to authenticated same-workspace users, with a size cap (3 MB, PNG/JPEG/WebP checked by magic bytes). **Never** Embarko's public file storage. (Built in milestone 5.)
- **Admin "Export backup" button** — built in the **polish milestone (8)**, not before. The export **omits password hashes and integration secrets** (webhook URLs, M91 link/secret, API keys).

### Milestone 2 decisions
- Email is the login and is **unique across all workspaces** (case-insensitive). One admin per workspace; the admin is created with the workspace.
- JWT: HS256 only, 7-day expiry, claims `{sub, role, ws}`, sent as `Authorization: Bearer`, stored in `localStorage`. The server re-checks the user/role/workspace in the database on every request, so a deleted user or a forged claim is rejected even with a valid signature. No server-side token revocation (logout is client-side; tokens die at expiry or when the user is deleted).
- bcrypt (pure-JS `bcryptjs`, cost 10; no native build needed on Embarko). Passwords 8–72 bytes (bcrypt truncates silently beyond 72, so we refuse instead).
- Login returns the same `invalid_credentials` for unknown email and wrong password, and does a dummy bcrypt compare to keep timing similar.
- Rate limits (per IP): failed logins 20/15 min (successes don't count), sign-ups 20/hour, invite lookups 60/15 min → HTTP 429 `rate_limited`.
- Invite codes: 8 symbols from a look-alike-free 32-char alphabet (~1.1 trillion), shown as `ABCD-EFGH`, lookups forgive case/spaces/hyphens. Only the workspace admin ever receives the code. Regenerating kills the old one. `GET /api/auth/invite/:code` reveals only the workspace *name*.
- API responses are `Cache-Control: no-store`.
- Route guards are UX only; the server enforces everything. Guards read the **real** URL via `useRealPathname()` (React Router's `useLocation()` reports the *old* page while the torn sheet is mid-transition) — this fixed a 150-redirect storm and a logout that landed on `/login`.
- Tab changes inside the admin/employee areas swap instantly (no rip); the torn-paper transition is for bigger jumps.
- Signed-in areas use the calm vibe (admin also the calm tone); public/auth pages stay lively.

### Milestone 4 decisions
- **Where it's stored:** the events URL lives in `workspace.integrations.eventsFlowUrl` inside `DATA_DIR/db.json` (gitignored, in `/data` on Embarko). The pending outbox (`db.outbox`) and the attempt log (`db.activity`, newest 1000) live there too. **The URL is a secret:** the API only ever returns `https://<host>/••••••••`; the outbox and log never contain it (test-enforced: a token planted in the URL must not appear in any response, log row or outbox entry).
- **Payload** (flat, strings/numbers only): `event, taskId, title, owner, status, impact, deadline, at, text`. Events: `task.created`, `task.status_changed`, `test.ping` (`task.verdict` joins in M5). `text` is a ready Slack line.
- **Delivery:** up to **3 attempts**, waits of 3 s then 15 s between them, 8 s timeout, redirects are **not** followed (a 3xx is a failure), 2xx = delivered. Each attempt is logged as attempt n/3 + HTTP status (or `network` / `timeout` / `redirect` / `blocked`). Pending retries survive a restart/redeploy (they're in db.json; the process resumes them on start). If the URL is removed, queued events are dropped and logged `no_url`. No URL configured → nothing is queued at all.
- **Ordering caveat:** events are sent one at a time in queue order, but a retry can land after a later event; each payload carries `at` so the sheet can be sorted.
- **SSRF guard:** https only, no credentials in the URL, no `localhost`/`.local`/`.internal`/single-label hosts, no IP literal in private/loopback/link-local/CGNAT/multicast/reserved ranges (v4 and v6, incl. IPv4-mapped and decimal/hex forms), and hostnames are **resolved and every address checked when saving *and again at connect time*** (defeats DNS rebinding). `ALLOW_PRIVATE_WEBHOOKS=1` (dev/test only, ignored in production) allows a local http mock.
- "Send test event" is one immediate attempt (logged as 1/1), rate-limited to 20/min per IP.
- Events sent for outcomes created by an employee go to **their own workspace's** URL only.
- Not covered by M4 (as planned): Slack/Sheets delivery itself is configured in viaSocket; I can only verify against a mock until you paste a real URL.

### Milestone 3 decisions
- **Status ids:** `planned`, `in_progress`, `in_review`, `done`. The server state machine (`checkEmployeeMove`) allows only Planned ⇄ In Progress for employees. In Review is reachable **only** by submitting proof (M5), Done **only** by validator-verify or admin approve (M5), In Review → In Progress only by validator "ask"/admin "needs rework" (M5, `reworkCount++`). Employees can never write Done. Cards in In Review/Done are frozen (not draggable, menu disabled). Dropping a note on the same column is a harmless no-op.
- **Daily limit:** 3 new outcomes per employee per *local* day, using the `tzOffset` stored at sign-up (minutes east of UTC). Deleted outcomes don't exist yet, so nothing can be "un-counted". Count + insert have no `await` between them, so racing requests can't take a 4th slot (tested with 8 parallel requests). Refusal is `409 {error:'daily_limit', limit}`.
- Outcome fields: title 3–120, details ≤ 2000, deadline `YYYY-MM-DD` (not before the employee's today), impact 1–5, criteria 1–8 (3–200 chars each), "how I will prove it" 3–500. Admin impact override comes in M5/M6.
- **Outcome Coach** is heuristics only (vague phrases like "work on", weak verbs, missing number/measure, no criteria, no proof plan) plus up to 4 suggested criteria you click to add. It never blocks saving. It's `POST /api/coach` (employee only, nothing stored) so M7 can swap in the viaSocket AI flow behind the same shape.
- Status move is `POST /api/tasks/:id/status` (the client `api` helper has no PATCH). Another employee's task id → 404 (never leaks existence); admins get 403 on the employee board endpoints.
- **Drop on Done opens the proof dialog** (placeholder until the real proof form in milestone 5; the user's message said "milestone 4", the plan has proof in 5 — the dialog says so and the note stays in In Progress). Dropping a *Planned* note on Done/In Review is refused with a toast ("start it first").
- Mobile/keyboard: native `<select>` "Move to…" on every note (≥ 44 px), delayed touch drag (220 ms) so scrolling still works, keyboard sensor with Space / ← / → between columns. Phones: columns swipe horizontally with scroll-snap.
- Board uses the calm vibe (no cursor trail, ambient faded), per the design rules.

## Open questions / risks
- **No backups yet:** Embarko doesn't back up `/data`; the Export backup button is scheduled for milestone 8 (see Decisions). Until then a deleted app or lost volume means lost data.
- **Browser e2e isn't in CI/`npm test`** (needs Playwright); run `e2e/auth.e2e.cjs` by hand after changing auth/guards/transitions.
- **SSE for the live activity feed (milestone 6):** Embarko doesn't support WebSockets; plain SSE is untested there → fall back to polling if it misbehaves.
- **Outbox retries run in an in-process timer:** "background workers" are unsupported on Embarko; pending retries are persisted so a restart doesn't lose them. If the container sleeps/idles, retries resume on the next wake-up.
- **M91 prerequisites:** a public `PUBLIC_BASE_URL` (now available), M91 send link, and ideally M91's signature details.
- **viaSocket:** I couldn't find viaSocket-specific Google Sheets / Slack step docs; the README will document the flat event fields generically and you wire those two steps.
- Embarko adds its own badge to the page and overrides the CSP header.
- Real viaSocket/Slack/Sheets/M91 delivery can't be tested until you paste your URLs/keys into the Integrations page (never committed).

## Next
1. Milestone 5 (proof & validator; the Done-drop dialog becomes the real proof form).
