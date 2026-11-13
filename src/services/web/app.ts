import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { apiRouter } from '@/services/web/api/api.router.js';
import {
  apiGuards,
  errorHandler,
  notFoundApi,
  securityHeaders,
} from '@/services/web/http/middleware.js';
import { sessionContext } from '@/services/web/modules/session/session.middleware.js';
import { requestContext } from '@/shared/http/middleware/request-context.js';
import { requestMetrics } from '@/shared/http/middleware/request-metrics.js';
import { metricsRouter } from '@/shared/http/routes/metrics.js';

const distDir = resolve(process.cwd(), 'dist/web');
const indexFile = resolve(distDir, 'index.html');

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(securityHeaders());
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'web' });
  });

  app.use(metricsRouter);

  app.use(requestContext());
  app.use(requestMetrics);

  app.use('/api', apiGuards(), sessionContext(), apiRouter);
  app.use('/api', notFoundApi());

  if (existsSync(indexFile)) {
    app.use(express.static(distDir, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(indexFile));
  }

  app.use(notFoundApi());
  app.use(errorHandler);

  return app;
}
