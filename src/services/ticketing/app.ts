import express from 'express';
import { errorHandler } from '@/shared/http/middleware/error-handler.js';
import { requestMetrics } from '@/shared/http/middleware/request-metrics.js';
import { requireAuth } from '@/shared/http/middleware/require-auth.js';
import { healthRouter } from '@/shared/http/routes/health.js';
import { metricsRouter } from '@/shared/http/routes/metrics.js';
import { apiRouter } from '@/services/ticketing/http/routes/api.router.js';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(requestMetrics);
  app.use(healthRouter);
  app.use(metricsRouter);
  app.use('/api', requireAuth(), apiRouter);
  app.use(errorHandler);
  return app;
}
