import { call, callEmpty, callPage, type Page } from '@/services/web/clients/http.client.js';
import { webConfig } from '@/services/web/config.js';
import type {
  AdminUserDto,
  LoginResult,
  SessionUser,
  UserRole,
} from '@/services/web/typedefs/api.typedefs.js';

interface LoginResponse {
  token: string;
  expiresAt: string;
  user: { id: string; email: string; role: UserRole };
}

export interface CreateUserPayload {
  email: string;
  password: string;
  role: UserRole;
}

function toSessionUser(user: { id: string; email: string; role: UserRole }): SessionUser {
  return { userId: user.id, email: user.email, role: user.role };
}

export class AuthClient {
  login(email: string, password: string): Promise<LoginResult> {
    return call<LoginResponse>(webConfig.authBaseUrl, '/auth/login', {
      method: 'POST',
      body: { email, password },
    }).then((result) => ({
      token: result.token,
      expiresAt: result.expiresAt,
      user: toSessionUser(result.user),
    }));
  }

  logout(token: string): Promise<void> {
    return callEmpty(webConfig.authBaseUrl, '/auth/logout', {
      method: 'POST',
      token,
    });
  }

  me(token: string): Promise<SessionUser> {
    return call<{ id: string; email: string; role: UserRole }>(
      webConfig.authBaseUrl,
      '/auth/me',
      { token },
    ).then(toSessionUser);
  }

  register(email: string, password: string): Promise<AdminUserDto> {
    return call<AdminUserDto>(webConfig.authBaseUrl, '/auth/register', {
      method: 'POST',
      body: { email, password },
    });
  }

  listUsers(token: string, limit = 20, offset = 0): Promise<Page<AdminUserDto>> {
    return callPage<AdminUserDto>(webConfig.authBaseUrl, '/auth/users', {
      token,
      query: { limit, offset },
    });
  }

  createUser(token: string, input: CreateUserPayload): Promise<AdminUserDto> {
    return call<AdminUserDto>(webConfig.authBaseUrl, '/auth/users', {
      method: 'POST',
      token,
      body: input,
    });
  }
}
