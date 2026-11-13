import type { Request, Response } from 'express';
import { ok } from '@/services/web/api/respond.js';
import { loginSchema, registerSchema } from '@/services/web/api/schemas.js';
import { UpstreamError } from '@/services/web/clients/http.client.js';
import { webConfig } from '@/services/web/config.js';
import { sessionCookie, clearCookie } from '@/services/web/http/cookies.js';
import { SessionService } from '@/services/web/modules/session/session.service.js';
import type { LoginResult } from '@/services/web/typedefs/api.typedefs.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';
import { HttpError } from '@/shared/errors/http-error.js';

export class SessionController {
  protected readonly service = new SessionService();

  current = asyncHandler(async (_req: Request, res: Response) => {
    ok(res, { user: res.locals.user ?? null });
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const body = validate(loginSchema, req.body);

    try {
      const result = await this.service.login(body.email, body.password);
      this.startSession(res, result);
      ok(res, { user: result.user });
    } catch (error) {
      if (error instanceof UpstreamError && error.status === 401) {
        throw new HttpError(401, 'invalid_credentials', 'Invalid email or password');
      }

      if (error instanceof UpstreamError && error.status === 403) {
        throw new HttpError(403, 'user_inactive', 'This user is disabled');
      }

      if (error instanceof UpstreamError) {
        throw new HttpError(503, 'upstream_unavailable', 'Authorization service is unavailable');
      }

      throw error;
    }
  });

  register = asyncHandler(async (req: Request, res: Response) => {
    const body = validate(registerSchema, req.body);

    try {
      const result = await this.service.register(body.email, body.password);
      this.startSession(res, result);
      ok(res, { user: result.user }, 201);
    } catch (error) {
      if (error instanceof UpstreamError && error.code === 'email_taken') {
        throw new HttpError(409, 'email_taken', 'Email is already registered');
      }

      if (error instanceof UpstreamError && error.status === 400) {
        throw new HttpError(400, 'validation_failed', 'Registration data is invalid');
      }

      if (error instanceof UpstreamError) {
        throw new HttpError(503, 'upstream_unavailable', 'Authorization service is unavailable');
      }

      throw error;
    }
  });

  logout = asyncHandler(async (_req: Request, res: Response) => {
    const token = res.locals.token;

    if (token) {
      await this.service.logout(token);
    }

    res.setHeader('set-cookie', clearCookie(webConfig.cookieName, webConfig.cookieSecure));
    res.status(204).end();
  });

  private startSession(res: Response, result: LoginResult): void {
    const maxAge = Math.max(
      0,
      Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000),
    );

    res.setHeader(
      'set-cookie',
      sessionCookie(webConfig.cookieName, result.token, {
        maxAgeSeconds: maxAge,
        secure: webConfig.cookieSecure,
      }),
    );
  }
}
