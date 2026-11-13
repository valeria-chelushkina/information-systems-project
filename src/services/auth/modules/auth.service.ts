import { randomUUID } from 'node:crypto';
import { LoginAttemptsRepository } from '@/services/auth/modules/login-attempts.repository.js';
import type {
  CreateUserInput,
  LoginInput,
  RegisterInput,
} from '@/services/auth/modules/auth.schemas.js';
import { SessionsRepository } from '@/services/auth/modules/sessions.repository.js';
import { UsersRepository } from '@/services/auth/modules/users.repository.js';
import { hashPassword, verifyPassword } from '@/services/auth/security/password.js';
import { createToken, hashToken } from '@/services/auth/security/token.js';
import type {
  AdminUserDto,
  UserDto,
  UserRow,
} from '@/services/auth/typedefs/user.typedefs.js';
import { optionalEnv } from '@/shared/config/env.js';
import { HttpError } from '@/shared/errors/http-error.js';
import { authFailuresTotal } from '@/shared/observability/metrics.js';

const TOKEN_TTL_MS = Number(optionalEnv('AUTH_TOKEN_TTL_MS', '86400000'));
const DUMMY_HASH = hashPassword('dummy-password-for-timing');

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: UserDto;
}

export interface IntrospectionResult {
  userId: string;
  email: string;
  role: string;
}

export interface AdminUserPage {
  items: AdminUserDto[];
  total: number;
  limit: number;
  offset: number;
}

function toDto(user: UserRow): UserDto {
  return { id: user.id, email: user.email, role: user.role };
}

function toAdminDto(user: UserRow): AdminUserDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.is_active === 1,
    createdAt: user.created_at,
  };
}

export class AuthService {
  protected readonly users = new UsersRepository();
  protected readonly sessions = new SessionsRepository();
  protected readonly attempts = new LoginAttemptsRepository();

  login(input: LoginInput, ip: string | null, userAgent: string | null): LoginResult {
    const email = input.email.toLowerCase();
    const user = this.users.findByEmail(email);
    const valid = verifyPassword(input.password, user?.password_hash ?? DUMMY_HASH) && user !== null;

    this.attempts.record({ email, success: valid, ip });

    if (!valid || !user) {
      authFailuresTotal.inc({ reason: 'credentials' });
      throw new HttpError(401, 'invalid_credentials', 'Invalid email or password');
    }

    if (user.is_active === 0) {
      authFailuresTotal.inc({ reason: 'user_inactive' });
      throw new HttpError(403, 'user_inactive', 'This user is disabled');
    }

    const token = createToken();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + TOKEN_TTL_MS);

    this.sessions.insertOne({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashToken(token),
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      userAgent,
    });

    return { token, expiresAt: expiresAt.toISOString(), user: toDto(user) };
  }

  logout(token: string): void {
    this.sessions.revokeByTokenHash(hashToken(token), new Date().toISOString());
  }

  introspect(token: string): IntrospectionResult {
    const session = this.sessions.findActiveByTokenHash(
      hashToken(token),
      new Date().toISOString(),
    );

    if (!session) {
      authFailuresTotal.inc({ reason: 'invalid_token' });
      throw new HttpError(401, 'invalid_token', 'Session token is invalid or expired');
    }

    const user = this.users.findById(session.user_id);

    if (!user || user.is_active === 0) {
      authFailuresTotal.inc({ reason: 'invalid_token' });
      throw new HttpError(401, 'invalid_token', 'Session token is invalid or expired');
    }

    return { userId: user.id, email: user.email, role: user.role };
  }

  me(token: string): UserDto {
    const { userId } = this.introspect(token);
    const user = this.users.findById(userId);

    if (!user) {
      throw new HttpError(401, 'invalid_token', 'Session token is invalid or expired');
    }

    return toDto(user);
  }

  createUser(input: CreateUserInput, actorToken?: string): UserDto {
    if (this.users.count() > 0) {
      this.assertAdmin(actorToken);
    }

    const email = input.email.toLowerCase();

    if (this.users.findByEmail(email)) {
      throw HttpError.conflict('email_taken', 'Email is already registered');
    }

    const user = this.users.insertOne({
      id: randomUUID(),
      email,
      passwordHash: hashPassword(input.password),
      role: input.role,
      isActive: 1,
      createdAt: new Date().toISOString(),
    });

    return toDto(user);
  }

  listUsers(actorToken?: string, limit = 20, offset = 0): AdminUserPage {
    this.assertAdmin(actorToken);

    const all = this.users.findAll();

    return {
      items: all.slice(offset, offset + limit).map(toAdminDto),
      total: all.length,
      limit,
      offset,
    };
  }

  register(input: RegisterInput): UserDto {
    const email = input.email.toLowerCase();

    if (this.users.findByEmail(email)) {
      throw HttpError.conflict('email_taken', 'Email is already registered');
    }

    const user = this.users.insertOne({
      id: randomUUID(),
      email,
      passwordHash: hashPassword(input.password),
      role: 'customer',
      isActive: 1,
      createdAt: new Date().toISOString(),
    });

    return toDto(user);
  }

  private assertAdmin(actorToken?: string): void {
    if (!actorToken) {
      throw new HttpError(401, 'missing_token', 'An admin token is required');
    }

    const actor = this.introspect(actorToken);

    if (actor.role !== 'admin') {
      throw new HttpError(403, 'forbidden', 'Admin role required');
    }
  }

  countRecentFailures(email: string, minutes = 15): number {
    const since = new Date(Date.now() - minutes * 60_000).toISOString();
    return this.attempts.countFailuresSince(email.toLowerCase(), since);
  }
}
