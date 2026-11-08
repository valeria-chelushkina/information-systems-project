import express from 'express';
import { apiRouter } from '@/services/catalog/http/routes/api.router.js';
import { errorHandler } from '@/shared/http/middleware/error-handler.js';
import { requestMetrics } from '@/shared/http/middleware/request-metrics.js';
import { healthRouter } from '@/shared/http/routes/health.js';
import { metricsRouter } from '@/shared/http/routes/metrics.js';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(requestMetrics);
  app.use(healthRouter);
  app.use(metricsRouter);
  app.use('/api', apiRouter);
  app.use(errorHandler);
  return app;
}
