import type { Request, Response } from 'express';
import { AuthService } from '@/services/auth/modules/auth.service.js';
import {
  createUserSchema,
  loginSchema,
  tokenSchema,
} from '@/services/auth/modules/auth.schemas.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';
import { HttpError } from '@/shared/errors/http-error.js';

function optionalBearer(req: Request): string | undefined {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return undefined;
  }

  const token = header.slice(7).trim();
  return token.length > 0 ? token : undefined;
}

function bearer(req: Request): string {
  const token = optionalBearer(req);

  if (!token) {
    throw new HttpError(401, 'missing_token', 'Authorization header is required');
  }

  return token;
}

export class AuthController {
  protected readonly service = new AuthService();

  login = asyncHandler(async (req: Request, res: Response) => {
    const body = validate(loginSchema, req.body);
    const result = this.service.login(body, req.ip ?? null, req.get('user-agent') ?? null);

    res.status(200).json({ data: result });
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const { token } = validate(tokenSchema, req.body);
    this.service.logout(token);

    res.status(204).send();
  });

  introspect = asyncHandler(async (req: Request, res: Response) => {
    const { token } = validate(tokenSchema, req.body);
    const session = this.service.introspect(token);

    res.status(200).json({ data: session });
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    const user = this.service.me(bearer(req));

    res.status(200).json({ data: user });
  });

  createUser = asyncHandler(async (req: Request, res: Response) => {
    const body = validate(createUserSchema, req.body);
    const user = this.service.createUser(body, optionalBearer(req));

    res.status(201).json({ data: user });
  });
}
