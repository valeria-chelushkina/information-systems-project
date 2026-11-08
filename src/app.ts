import express from 'express';
import { errorHandler } from '@/http/middleware/error-handler.js';
import { requestMetrics } from '@/http/middleware/request-metrics.js';
import { healthRouter } from '@/http/routes/health.js';
import { metricsRouter } from '@/http/routes/metrics.js';
import { eventsRouter } from '@/modules/events/events.router.js';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(requestMetrics);
  app.use(healthRouter);
  app.use(metricsRouter);
  app.use(eventsRouter);
  app.use(errorHandler);
  return app;
}
