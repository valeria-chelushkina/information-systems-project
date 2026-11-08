import type { NextFunction, Request, Response } from 'express';
import { logger } from '@/observability/logger.js';
import { mapDatabaseError } from '@/shared/errors/database-error.js';
import { HttpError } from '@/shared/errors/http-error.js';

function isJsonParseError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as { type: unknown }).type === 'entity.parse.failed'
  );
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isJsonParseError(error)) {
    res.status(400).json({
      error: { code: 'invalid_json', message: 'Request body is not valid JSON' },
    });
    return;
  }

  const httpError = error instanceof HttpError ? error : mapDatabaseError(error);

  if (!httpError) {
    logger.error({ err: error }, 'unhandled request error');
    res.status(500).json({
      error: { code: 'internal_error', message: 'Internal server error' },
    });
    return;
  }

  if (httpError.status >= 500) {
    logger.error({ err: error, code: httpError.code }, 'request failed');
  } else {
    logger.warn({ err: error, status: httpError.status, code: httpError.code }, 'request rejected');
  }

  res.status(httpError.status).json({
    error: {
      code: httpError.code,
      message: httpError.message,
      ...(httpError.details === undefined ? {} : { details: httpError.details }),
    },
  });
}
