import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { JsonDb } from './db.js';
import { apiRoutes, DEFAULT_LIMITS } from './routes/api.js';
import { Outbox } from './outbox.js';

/**
 * Build the Express app. A function of `config` (+ optional db / rate limits) so tests can create isolated instances.
 */
export function createApp(config, { db = JsonDb.open(config.dbFile), limits = DEFAULT_LIMITS, outbox = new Outbox({ db, allowPrivate: config.allowPrivateWebhooks }) } = {}) {
  const app = express();
  app.locals.outbox = outbox;
  outbox.start(); // picks up any retries that were pending when the process last stopped
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind one reverse proxy / platform load balancer

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // framer-motion / React inline style attributes
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: null, // keep plain-http local production tests working
        },
      },
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));

  // ---- API ---------------------------------------------------------------
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store'); // never cache API responses (tokens, personal data)
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, uptime: Math.round(process.uptime()), env: config.isProd ? 'production' : 'development' });
  });

  app.use('/api', apiRoutes({ db, config, outbox, limits }));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  // ---- Static client + SPA fallback -----------------------------------------
  const indexHtml = path.join(config.clientDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(
      express.static(config.clientDist, {
        index: false,
        setHeaders(res, file) {
          // Vite emits content-hashed files under /assets → safe to cache forever.
          if (file.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  } else {
    app.use((_req, res) => {
      res
        .status(404)
        .type('text/plain')
        .send('Client build not found. Run `npm run build` (or `npm run dev` for development).');
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'payload_too_large' });
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
