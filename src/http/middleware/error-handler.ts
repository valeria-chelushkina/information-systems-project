import type { NextFunction, Request, Response } from 'express';
import { logger } from '@/observability/logger.js';

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error({ err: error }, 'unhandled request error');
  res.status(500).json({ error: 'internal_error' });
}
