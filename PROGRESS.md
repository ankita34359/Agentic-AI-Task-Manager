# PROGRESS

Living status file. **Update it at the end of every milestone** (done / decisions / deployed / next), in the same push as the milestone.

_Last updated: Milestone 4b (Connect Google Sheets + Slack through viaSocket) built, tested and deployed; waiting for the embed secret on the host._

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
| 4 | **viaSocket events outbox + Integrations page** | ✅ done, deployed and verified live |
| 4b | **Connect: Google Sheets + Slack through viaSocket** (Connect buttons, pickers, toggles, events → row + message) | ✅ built, tested and deployed. **Not working live until `VIASOCKET_EMBED_SECRET` is set on the host** (see Deployed) |
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
- **Milestone 4b — Connect (Sheets + Slack through viaSocket's apps API):**
  - Server: `lib/viasocket.js` (plain-HTTP client of viaSocket's apps-API module: embed token, connections, enable app, option lists, run action), `connect.js` (per-workspace state, pickers, toggle, dispatcher, secret scrubbing), routes under `/api/integrations/viasocket/*` (admin only). The three env vars are `VIASOCKET_ORG_ID`, `VIASOCKET_PROJECT_ID`, `VIASOCKET_EMBED_SECRET`.
  - **91 server tests** (22 new in `server/connect.test.js`, against a fake viaSocket). Mutation-checked: dropping the log scrubbing, leaking the auth id in the view, trusting the browser's auth id, awaiting the integration in the request, and ignoring the toggle each make a test fail.
  - Client: two comic Connect cards (`ConnectCards.jsx`): Connect button (viaSocket popup), spreadsheet + worksheet / channel dropdowns (searchable, "Show more"), on/off switch, status chip, "Send a test row/message" and Disconnect (both ask first), missing-column-titles warning with a copy button; the Activity log has a new **Via** column and shows the reason for a failure.
  - `e2e/connect.e2e.cjs` (41 checks, in-process fake viaSocket, popup script stubbed). The older `integrations.e2e.cjs` still passes (29).
- **Nothing else yet**: no proof/validator, no scores.

## Deployed
- **Live version now: `0.6.0-m4b-connect`** (M4 + M4b), deployed 2026-11-16 with the sandbox HTTP script, 85 stripped files, 248,214 bytes. **Verified on the real URL:** `index.html` references `index-BM3-CNwR.js` / `index-CZhuU63p.css` (= the local build, also equal to the unstripped source's build; both assets download); `/api/health` ok; `/api/integrations/viasocket/token` without a login → 401; in a real browser a fresh admin opened Admin → Integrations: the Events flow, Activity log and "What we send" sections render, the Connect section shows **"Needs setup"** and names only `VIASOCKET_EMBED_SECRET` (so `VIASOCKET_ORG_ID` and `VIASOCKET_PROJECT_ID` were picked up), no console errors.
  - ⚠ **One thing left for the owner:** `VIASOCKET_EMBED_SECRET` is not set on the Embarko app. I cannot set it: the secure credential form only lets the sandbox proxy attach a value to requests, it never gives me the value, and the app needs it as an environment variable. Add it yourself: open https://embarko.ai/app → the app `outcome-ledger` → App setup → add `VIASOCKET_EMBED_SECRET` (the signing secret from viaSocket's embed Install Code), then **restart/apply**. Existing variables (`APP_BUILD`, `JWT_SECRET`, `NODE_ENV`, `PUBLIC_BASE_URL`, `STORAGE_TOKEN`) were not touched; only the two ID variables were added (merge API, per key).
  - **UNTESTED against the real viaSocket** (needs the secret and your Google/Slack accounts): the real Connect popup and its `postMessage` shape; real option lists; the real `Add_New_Row_to_Sheet` v66 and `Send_Message` v107 calls (field shapes were taken from viaSocket's pages and a fake); whether the sheet's column options are labelled with the row-1 titles (the code matches on label or value, case-insensitively); the on-screen CSP for the popup (script/frame allowed for `flow.viasocket.com`; Embarko's edge may override CSP anyway). No real row or message has been sent anywhere.
- **App:** `outcome-ledger` on Embarko → https://outcome-ledger.embarko.app (app id in `embarko.json`).
- **Live version:** `0.5.1-m4-integrations` (Milestone 4: events outbox + Integrations page, on top of M3). Deployed 2026-11-16 with the HTTP script below (82 stripped files, 209,171 bytes). **Verified on the real URL:** `index.html` references `index-CAwReEj4.js` / `index--wI6-1KP.css` (the hashes of the local build; both assets download, 561,463 / 40,719 bytes); `/api/health` → `{"ok":true,"env":"production"}`; `/api/integrations` without a token → 401; in a real browser a fresh admin signed up, opened Admin → Integrations and the page rendered (Events flow “Not set”, Activity log, What we send, Google Sheet header row) with no console errors. **Not yet verified live:** saving a real events URL and “Send test event” (needs your viaSocket URL), and restart persistence of the outbox.
  ⚠ More test data on the live app from this verification: workspace "M4 Check Co" with one admin (`m4check+<timestamp>@example.com`). Earlier M3 test data ("Live Test Co") is still there too. Neither is backed up.
  Note: the first M4 deploy (`0.5.0-m4-integrations`) built fine (same hashes) but failed with *"container did not become healthy before Nomad's deadline (task state: pending)"* — a platform scheduling problem, no app output, and the live URL returned 503/502 for a few minutes. Redeploying the same files (`0.5.1-m4-integrations`) went live in about 70 s. If it happens again: just redeploy once, then read `/apps/outcome-ledger/logs`.
  ⚠ Test data left on the live app from my verification: workspace "Live Test Co" with one admin and one employee ("Live Employee") holding 3 outcomes. Auth + outcome data are not backed up (see Decisions).
- **Deploy method (use this; the Embarko connector keeps losing sign-in, so it is NOT used any more):** a Node script run in the sandbox against `https://ship.embarko.ai`. **The deploy token is never in the repo, chat or any file:** it is saved once through the secure credential form (`request_credential`, host `ship.embarko.ai`, bearer) and the sandbox proxy injects it into HTTPS requests to that host, so the script sends no `Authorization` header at all. Steps: (1) stage the files: `git ls-files` minus `e2e/`, `*.test.js`, `test-helpers.js`, `package-lock.json`, `README.md`, `PROGRESS.md`, `.env*`, `.gitignore`, `embarko.json` = **82 files**, with full-line comments and indentation stripped from `.js/.jsx/.css` (not `theme-init.js`, not JSON/HTML/SVG; no minifying, it broke the app); confirm a local `npm run build` of the stage gives the same bundle hashes as the real source. (2) `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node deploy.mjs <stage> <file-list> <version>`, where the script does `POST /uploads {appName:"outcome-ledger", files}` (first ≈60 KB), `POST /uploads/{id}/files {files}` for the rest in ≈60 KB batches, then `POST /apps {appName:"outcome-ledger", uploadId, version, agentName}` with no files (202 = building; the reply says `"action":"updated"` and the same app id as `embarko.json`, which proves the live app was updated and no new app was created). A script has no reply-size limit, so one `POST /apps` with all `files` should also work (limit 25 MB), but the upload flow is the proven path. (3) Poll `GET /apps/outcome-ledger/status` every 10 s until `live`/`failed`/`crashed` (a lone 401 or 503 during the swap is transient); `GET /apps/outcome-ledger/logs` shows the build log. (4) Verify the real URL: hashes in `index.html`, `/api/health`, and a browser check. The script and stripper lived in the session scratchpad (not committed); recreate them from this description. The upload expires 60 min after its last call and only its opener can deploy it.
- **Deploy gotcha (cost me two failed builds):** `deploy_app` **replaces** the whole source — every upload must contain all ~77 files, including all five stylesheets (`global`, `comic`, `landing`, `app`, `board`). A failed build never replaces the live version. Check the file list against `git ls-files` before sending.
- **Env vars on the app** (names only; values never in the repo or chat): `JWT_SECRET`, `NODE_ENV=production`, `PUBLIC_BASE_URL`. Embarko injects `PORT`, `DATA_DIR` (`/data`), `APP_NAME`, `APP_VERSION`, `STORAGE_TOKEN`.
- **Persistence:** only `DATA_DIR` (`/data`) survives restarts and redeploys; the rest of the disk is wiped on each redeploy. **Embarko does not back up `/data`.** Deleting the app deletes the data. `db.json` (users, workspaces, outcomes) is stored there.
- **Platform limits:** 256 MB RAM; no WebSockets, background workers, multiple processes or managed DB. Node 22.23.4.

### How a redeploy works (so it is repeatable)
1. Commit + push the branch.
2. Stage the 82 stripped files and run the deploy script with a new `version` (see **Deploy method** above). Embarko runs `npm install` → `npm run build` → `npm start`. No token ever appears in a command, file or the repo: the proxy injects the saved credential.
3. Stored env vars are attached automatically on a fresh deploy (`JWT_SECRET` etc.).
4. Poll `/apps/outcome-ledger/status` **and** hit the real URL (status can say "live" while the app returns 502; during the swap an old instance can answer for a minute).
5. Verify: `/api/health`, hashes in the served `index.html`, and a browser check of the new pages.

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

### Milestone 4b decisions
- **Which viaSocket pattern:** the Curevia repo (`ankita34359/Curevia`) mounts viaSocket's embedded *flow editor* per slot and posts to the flow's run URL. Your brief (Connect buttons, `auth_id`, `script_id`, pickers, actions) matches viaSocket's newer **apps API** (`app-integrations.md`, `apps-api.md`), so I used that and reused Curevia's idea of a **server-signed embed token** behind a login-protected endpoint. The existing events URL + outbox is untouched and still works (an upgrade, not a replacement).
- **Identity:** one viaSocket user per workspace (`unique_identifier = ol-ws-<workspaceId>`), so connections belong to the workspace, not to whichever admin clicked.
- **Where secrets live:** `auth_id` and `script_id` are stored only in `DATA_DIR/db.json` under `workspace.integrations.connect.{sheets,slack}`. They are never in a response, the page, the activity log or an error (test-enforced with planted values; errors and log details go through `scrub()`). The only value the browser holds is the per-workspace embed token (viaSocket's rule), served from `GET /api/integrations/viasocket/token` (admin only). The browser only *names* an auth id after the popup; the server accepts it only if viaSocket lists it for that workspace.
- **Pickers** (from viaSocket's `listOptions` on the pinned actions): spreadsheet `spreadsheet_Id`, worksheet `grid_Id` (after the spreadsheet), Slack channel `destination.channel_id`. Chosen once after connecting and stored; the toggle is disabled until the target is complete.
- **Sheet columns:** row 1 of the worksheet must contain the nine titles `event, taskId, title, owner, status, impact, deadline, at, text` (the page has the copy button). On saving a worksheet the server reads its column list from viaSocket and maps our nine fields to the option values; if any is missing the missing names are shown and the toggle stays off. Rows are sent with `column_key: true`.
- **Events:** after a task is saved (create, status change) `connect.dispatch()` runs, never awaited, never throws. One attempt per app (no retry); the result goes to the Activity log (`via` = `sheets` / `slack`, failures with a scrubbed reason). Apps that are off or not set up send nothing and log nothing. Slack posts the same ready-made `text` line as the events URL.
- **CSP:** `script-src` and `frame-src`/`connect-src` now also allow `https://flow.viasocket.com` (the Connect popup script).
- **Send test** buttons write one real row/message, so they ask first ("This writes one real row…"). I have not pressed them.
- Not done on purpose: no progress events were sent to viaSocket's journey endpoint (the skill suggests them; nobody asked for telemetry).

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
0. **You:** add `VIASOCKET_EMBED_SECRET` on the Embarko app, then try Connect on the live Integrations page (say when, and I will watch; real rows/messages go to your Sheet/Slack).
1. Milestone 5 (proof & validator; the Done-drop dialog becomes the real proof form).
