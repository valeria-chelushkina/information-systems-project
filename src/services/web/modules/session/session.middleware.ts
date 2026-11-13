import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { webConfig } from '@/services/web/config.js';
import { clearCookie, readCookie } from '@/services/web/http/cookies.js';
import { SessionService } from '@/services/web/modules/session/session.service.js';
import type { SessionUser } from '@/services/web/typedefs/api.typedefs.js';
import { HttpError } from '@/shared/errors/http-error.js';
import { logger } from '@/shared/observability/logger.js';

declare global {
  namespace Express {
    interface Locals {
      user?: SessionUser;
      token?: string;
    }
  }
}

const sessionService = new SessionService();

export function sessionContext(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const token = readCookie(req, webConfig.cookieName);

      if (!token) {
        next();
        return;
      }

      try {
        const user = await sessionService.resolve(token);

        if (!user) {
          res.setHeader('set-cookie', clearCookie(webConfig.cookieName, webConfig.cookieSecure));
          next();
          return;
        }

        res.locals.user = user;
        res.locals.token = token;
        next();
      } catch (error) {
        logger.error({ err: error }, 'session lookup failed');
        next(error);
      }
    })();
  };
}

export function requireUser(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!res.locals.user || !res.locals.token) {
      next(new HttpError(401, 'missing_token', 'Authentication is required'));
      return;
    }

    next();
  };
}

export function requireStaff(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;

    if (!user || !res.locals.token) {
      next(new HttpError(401, 'missing_token', 'Authentication is required'));
      return;
    }

    if (user.role !== 'admin' && user.role !== 'staff') {
      next(new HttpError(403, 'forbidden', 'Staff role required'));
      return;
    }

    next();
  };
}

export function requireAdmin(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;

    if (!user || !res.locals.token) {
      next(new HttpError(401, 'missing_token', 'Authentication is required'));
      return;
    }

    if (user.role !== 'admin') {
      next(new HttpError(403, 'forbidden', 'Admin role required'));
      return;
    }

    next();
  };
}

export function currentUser(res: Response): SessionUser {
  const user = res.locals.user;

  if (!user) {
    throw new HttpError(401, 'missing_token', 'Authentication is required');
  }

  return user;
}

export function currentToken(res: Response): string {
  const token = res.locals.token;

  if (!token) {
    throw new HttpError(401, 'missing_token', 'Authentication is required');
  }

  return token;
}
