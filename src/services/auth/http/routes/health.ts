import { Router } from 'express';
import { authDb } from '@/services/auth/db/client.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  try {
    authDb.prepare('SELECT 1 AS ok').get();
    res.status(200).json({ status: 'ok', db: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});
