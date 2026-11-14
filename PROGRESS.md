# PROGRESS

Living status file. **Update it at the end of every milestone** (done / decisions / deployed / next), in the same push as the milestone.

_Last updated: after the "small fixes" round that followed the Visual redesign._

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
| — | Small fixes after review (0.5 s transition, doodle placement, dark bubble contrast) | ✅ done & pushed, **⚠ not deployed yet** |
| 2 | Auth & roles (admin/employee sign-up, login, invite code, guards) | ⏭ next |
| 3 | Outcomes & board (create form, 3/day limit, Outcome Coach, kanban Planned↔In Progress) | planned |
| 4 | viaSocket events outbox + Integrations page | planned |
| 5 | Proof & Proof Validator (animated steps, Verified stamp, Review Queue) | planned |
| 6 | Scores & dashboards (+ demo data) | planned |
| 7 | AI-flow adapter & Weekly Review | planned |
| 8 | Polish & hardening | planned |
| 9 | Deploy to Embarko (first-class pass: data-loss briefing, backups decision) | planned (a working deploy already exists) |
| 10 | M91 alerts (send, signed callback, dedupe, read-back) | planned — after deploy, needs the public URL |

### What exists today
- **Server** (`server/`): Express 5 app, `GET /api/health`, JSON 404 for unknown `/api/*`, helmet CSP, gzip, static client + SPA fallback, graceful SIGTERM, `DATA_DIR`/`PORT`/`JWT_SECRET` config (production refuses to start without a ≥ 32-char `JWT_SECRET`). 6 `node:test` tests.
- **Client** (`client/`): React 19 + Vite 8 + Framer Motion 14. Landing page, placeholder pages for `/login`, `/admin/signup`, `/employee/signup`, 404.
- **Design system** (all in `client/src/components`, documented in README): `Mascot` (Tally, 6 moods), `TornTransition`, `StickerCard`, `SquishyButton` (+ comic bursts), `OneLiner` (`lib/lines.js`, playful/calm tone), `SpeechBubble`, `StickyNote`, `EmptyState`, `Marquee`, `Squiggle`, `Confetti`, `Ambient`, `CursorTrail`, `ScoreRing`, `TrendLine`, `CountUp`, `VerifiedStamp`, toasts.
- **Nothing else yet**: no auth, no database layer, no tasks, no integrations.

## Deployed
- **App:** `outcome-ledger` on Embarko → https://outcome-ledger.embarko.app (app id in `embarko.json`).
- **Live version:** `0.2.0-redesign`, built from commit `19f3d2f`. Verified live: health OK, no console errors, byte-identical build hashes to local.
- **Not live yet:** the "small fixes" (`a2773f6`, `a7a33ab`) and docs commits after `19f3d2f`.
  Blocked because the Embarko connector needed re-authorization in this session. → Re-authorize the connector, then redeploy.
- **Env vars on the app** (names only; values never in the repo or chat): `JWT_SECRET`, `NODE_ENV=production`, `PUBLIC_BASE_URL`. Embarko injects `PORT`, `DATA_DIR` (`/data`), `APP_NAME`, `APP_VERSION`, `STORAGE_TOKEN`.
- **Persistence:** only `DATA_DIR` (`/data`) survives restarts and redeploys; the rest of the disk is wiped on each redeploy. **Embarko does not back up `/data`.** Deleting the app deletes the data. Nothing is stored there yet.
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

## Open questions / risks
- **Proof screenshots storage (milestone 5):** Embarko's docs say uploads don't belong in `DATA_DIR` and recommend its file storage, but that serves files **publicly**. Plan: keep them in `DATA_DIR`, served only to authenticated same-workspace users, with a size cap. Needs your OK.
- **No backups:** Embarko doesn't back up `/data`. Option: an admin "Export backup" button (offered, not built).
- **SSE for the live activity feed (milestone 6):** Embarko doesn't support WebSockets; plain SSE is untested there → fall back to polling if it misbehaves.
- **Outbox retries run in-process timers (milestone 4):** "background workers" are unsupported on Embarko; pending retries are persisted so a restart doesn't lose them.
- **M91 prerequisites:** a public `PUBLIC_BASE_URL` (now available), M91 send link, and ideally M91's signature details.
- **viaSocket:** I couldn't find viaSocket-specific Google Sheets / Slack step docs; the README will document the flat event fields generically and you wire those two steps.
- Embarko adds its own badge to the page and overrides the CSP header.
- Real viaSocket/Slack/Sheets/M91 delivery can't be tested until you paste your URLs/keys into the Integrations page (never committed).

## Next
1. **Redeploy** the small fixes once the Embarko connector is re-authorized.
2. **Milestone 2 — Auth & roles:** JSON DB layer (atomic writes, SIGTERM flush), admin sign-up (creates workspace + invite code), employee sign-up (validates invite code live), login with role redirect, JWT (7 d), bcrypt, zod validation, rate-limited auth routes, `requireRole()`, tenant isolation, role shells, replace the placeholder auth pages with real forms in the comic style. Tests: auth, tenant isolation.
3. Then push + redeploy, update this file, and stop for review.
