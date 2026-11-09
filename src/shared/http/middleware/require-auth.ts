import type {
  NextFunction,
  Request,
  RequestHandler,
  Response as ExpressResponse,
} from 'express';
import { config } from '@/shared/config/index.js';
import { HttpError } from '@/shared/errors/http-error.js';
import { authFailuresTotal } from '@/shared/observability/metrics.js';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      authToken?: string;
    }
  }
}

interface IntrospectionEnvelope {
  data: AuthenticatedUser;
}

function bearerToken(req: Request): string {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    authFailuresTotal.inc({ reason: 'missing_token' });
    throw new HttpError(401, 'missing_token', 'Authorization header is required');
  }

  const token = header.slice(7).trim();

  if (!token) {
    authFailuresTotal.inc({ reason: 'missing_token' });
    throw new HttpError(401, 'missing_token', 'Bearer token is empty');
  }

  return token;
}

async function introspect(token: string): Promise<AuthenticatedUser> {
  let response: Response;

  try {
    response = await fetch(`${config.authBaseUrl}/auth/introspect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(config.authTimeoutMs),
    });
  } catch {
    authFailuresTotal.inc({ reason: 'auth_unavailable' });
    throw new HttpError(503, 'auth_unavailable', 'Authorization service is unavailable');
  }

  if (response.status === 401) {
    authFailuresTotal.inc({ reason: 'invalid_token' });
    throw new HttpError(401, 'invalid_token', 'Session token is invalid or expired');
  }

  if (!response.ok) {
    authFailuresTotal.inc({ reason: 'auth_error' });
    throw new HttpError(
      502,
      'auth_error',
      `Authorization service responded with ${response.status}`,
    );
  }

  const body = (await response.json()) as IntrospectionEnvelope;
  return body.data;
}

export function requireAuth(): RequestHandler {
  return (req: Request, _res: ExpressResponse, next: NextFunction) => {
    void (async () => {
      try {
        const token = bearerToken(req);
        req.authToken = token;
        req.user = await introspect(token);
        next();
      } catch (error) {
        next(error);
      }
    })();
  };
}
