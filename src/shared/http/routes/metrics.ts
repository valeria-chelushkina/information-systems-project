import { Router } from 'express';
import { registry } from '@/shared/observability/metrics.js';

export const metricsRouter = Router();

metricsRouter.get('/metrics', async (_req, res) => {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});
