# Outcome Ledger

A daily task manager that measures the **value** of work, not the number of tasks.
Stack: React + Vite, Framer Motion, dnd-kit, Node/Express, JSON-file storage, JWT auth.

> **Status:** milestone 1 of 10 (scaffold & landing). See the roadmap below.

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
npm test         # server unit tests (node:test)
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

## Roadmap

1. ✅ Scaffold & landing
2. Auth & roles
3. Outcomes & board (+ deployable `npm start`)
4. viaSocket events outbox + Integrations page
5. Proof & Proof Validator
6. Scores & dashboards
7. AI-flow adapter & Weekly Review
8. Polish & hardening
9. Deploy
10. M91 alerts

## Accessibility & motion

Dark/light themes (follows the OS, toggle persists). Honors `prefers-reduced-motion`: aurora, particles, magnetic buttons and transform animations are disabled or reduced to fades.
