import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { UpstreamError } from '@/services/web/clients/http.client.js';
import { HttpError } from '@/shared/errors/http-error.js';
import { logger } from '@/shared/observability/logger.js';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "style-src 'self'",
  "script-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
].join('; ');

export function securityHeaders(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  };
}

export function apiGuards(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }

    const origin = req.get('origin');

    if (origin) {
      let sameOrigin = false;

      try {
        sameOrigin = new URL(origin).host === req.get('host');
      } catch {
        sameOrigin = false;
      }

      if (!sameOrigin) {
        res.status(403).json({
          error: { code: 'forbidden_origin', message: 'Request origin is not allowed' },
        });
        return;
      }
    }

    const hasBody =
      Number(req.get('content-length') ?? '0') > 0 || req.get('transfer-encoding') !== undefined;

    if (hasBody && !req.is('application/json')) {
      res.status(415).json({
        error: { code: 'unsupported_media_type', message: 'Content type must be application/json' },
      });
      return;
    }

    next();
  };
}

export function notFoundApi(): RequestHandler {
  return (req: Request, res: Response) => {
    res.status(404).json({
      error: { code: 'not_found', message: `No route for ${req.method} ${req.originalUrl}` },
    });
  };
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof UpstreamError) {
    const status = error.status >= 500 ? 503 : error.status;

    if (status >= 500) {
      logger.error({ err: error, path: req.path }, 'upstream request failed');
    }

    res.status(status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  logger.error({ err: error, path: req.path }, 'unhandled request error');
  res.status(500).json({
    error: { code: 'internal_error', message: 'Internal server error' },
  });
}
