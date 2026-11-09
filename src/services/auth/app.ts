import express from 'express';
import { healthRouter } from '@/services/auth/http/routes/health.js';
import { authRouter } from '@/services/auth/modules/auth.router.js';
import { errorHandler } from '@/shared/http/middleware/error-handler.js';
import { requestContext } from '@/shared/http/middleware/request-context.js';
import { requestMetrics } from '@/shared/http/middleware/request-metrics.js';
import { metricsRouter } from '@/shared/http/routes/metrics.js';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(requestContext());
  app.use(requestMetrics);
  app.use(healthRouter);
  app.use(metricsRouter);
  app.use(authRouter);
  app.use(errorHandler);
  return app;
}
