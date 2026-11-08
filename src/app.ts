import express from 'express';
import { errorHandler } from '@/http/middleware/error-handler.js';
import { requestMetrics } from '@/http/middleware/request-metrics.js';
import { apiRouter } from '@/http/routes/api.router.js';
import { healthRouter } from '@/http/routes/health.js';
import { metricsRouter } from '@/http/routes/metrics.js';

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
