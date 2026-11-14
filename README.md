# Outcome Ledger

A daily task manager that measures the **value** of work, not the number of tasks.
Stack: React + Vite, Framer Motion, dnd-kit, Node/Express, JSON-file storage, JWT auth.

> **Status:** milestones 1–2 (scaffold, auth & roles) and the **Visual redesign** are done. Milestone 3 (outcomes & board) is next. See `PROGRESS.md` for decisions and what is deployed.

## Quick start

Requires Node 22+.

```bash
npm install
npm run dev      # API on :3000 + Vite dev server on http://localhost:5173
```

Production-style run (one port, serves the built client):

```bash
npm run build
npm start        # builds automatically if client/dist is missing
```

```bash
npm test         # server tests (node:test): auth, roles, tenant isolation, database durability
```

Browser end-to-end test (optional, needs Playwright and a built client):

```bash
npm run build
NODE_PATH=$(npm root -g) node e2e/auth.e2e.cjs   # or: npm i -D playwright
```

## Configuration

All configuration is via environment variables (see `.env.example`; copy to `.env` locally — it is gitignored).

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port (binds `0.0.0.0`) |
| `NODE_ENV` | `development` | `production` enforces `JWT_SECRET` |
| `DATA_DIR` | `./server/data` | Where `db.json`, `uploads/` and the dev JWT secret live. Relative paths resolve against the project root. **Point at a persistent volume in production.** |
| `JWT_SECRET` | *(dev: auto-generated)* | Required in production, ≥ 32 chars |
| `PUBLIC_BASE_URL` | – | Public URL of the deployment (used for the M91 callback later) |

Webhook URLs, API keys and tokens are entered in the admin UI and stored only inside `DATA_DIR` — never in the repo.

## Deploying (Embarko)

Live app: <https://outcome-ledger.embarko.app> (app name `outcome-ledger`, id in `embarko.json`).

- **Build / start:** Embarko runs `npm install`, `npm run build`, then `npm start`. It injects `PORT` and `DATA_DIR` (`/data`).
- **Env vars to set on the app** (never commit them): `JWT_SECRET` (≥ 32 chars), `NODE_ENV=production`, `PUBLIC_BASE_URL`.
  Env vars saved *before the first deploy finishes* are only picked up by the next deploy — run `apply_env_vars` (or redeploy) after setting them.
- **Persistence:** only `DATA_DIR` survives restarts and redeploys. Everything else on disk is wiped on each redeploy, and Embarko does **not** back up `DATA_DIR`.
- **Limits:** 256 MB RAM, no WebSockets / background workers / multiple processes.

## Roadmap

1. ✅ Scaffold & landing
1b. ✅ Visual redesign (comic world, mascot Tally, torn-paper transitions)
2. ✅ Auth & roles
3. Outcomes & board (+ deployable `npm start`)
4. viaSocket events outbox + Integrations page
5. Proof & Proof Validator
6. Scores & dashboards
7. AI-flow adapter & Weekly Review
8. Polish & hardening
9. Deploy
10. M91 alerts

## Design system (comic world)

Reusable pieces in `client/src/components` — use these on every new page:
`Mascot` (Tally, 6 moods), `TornTransition` (route rip), `StickerCard`, `SquishyButton` (squash & stretch + `burst="POW!"`), `OneLiner` / `lib/lines.js` (microcopy, `playful` vs `calm` tone), `SpeechBubble`, `StickyNote` (kanban card), `EmptyState`, `Marquee`, `Squiggle`, `Confetti`, `Ambient` (clouds/stars/doodles + parallax), `CursorTrail`.
Pages declare their loudness with `usePageVibe('lively' | 'calm', 'playful' | 'calm')`; data-heavy pages (dashboard, board, tables) must use `'calm'`.
Rules: animate `transform`/`opacity` only, cap particle counts, pause everything in hidden tabs (`html[data-hidden]`).

## Accessibility & motion

Dark/light themes (follows the OS, toggle persists). Honors `prefers-reduced-motion`: the marquee, drifting background, cursor trail, confetti, bursts' pop and the torn-paper transition are switched off (instant route swap + quick fade), and Tally holds static poses.
