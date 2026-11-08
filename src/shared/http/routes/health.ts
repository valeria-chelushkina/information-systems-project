import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { timedQuery } from '@/shared/db/timed-query.js';
import { logger } from '@/shared/observability/logger.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  try {
    await timedQuery('health_check', () => db.execute(sql`SELECT 1 AS ok`));
    res.status(200).json({ status: 'ok', db: 'ok' });
  } catch (error) {
    logger.error({ err: error }, 'health check failed');
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});
