import { describe, expect, it } from 'vitest';
import { AuthService } from '@/services/auth/modules/auth.service.js';
import { UsersRepository } from '@/services/auth/modules/users.repository.js';
import type { NewUser, UserRow } from '@/services/auth/typedefs/user.typedefs.js';
import { HttpError } from '@/shared/errors/http-error.js';

class TestAuthService extends AuthService {
  readonly inserted: NewUser[] = [];

  constructor(existing: UserRow | null) {
    super();

    const inserted = this.inserted;

    Object.assign(this, {
      users: {
        findByEmail: () => existing,
        insertOne: (user: NewUser) => {
          inserted.push(user);
          return {
            id: user.id,
            email: user.email,
            password_hash: user.passwordHash,
            role: user.role,
            is_active: user.isActive,
            created_at: user.createdAt,
          };
        },
      } as unknown as UsersRepository,
    });
  }
}

describe('self-registration', () => {
  it('creates an active customer and normalises the email', () => {
    const service = new TestAuthService(null);
    const user = service.register({ email: 'New.User@Example.COM', password: 'password-123' });

    expect(user.role).toBe('customer');
    expect(user.email).toBe('new.user@example.com');
    expect(service.inserted).toHaveLength(1);
    expect(service.inserted[0]?.role).toBe('customer');
    expect(service.inserted[0]?.isActive).toBe(1);
  });

  it('rejects an email that already has an account', () => {
    const existing: UserRow = {
      id: 'existing-id',
      email: 'taken@example.com',
      password_hash: 'hash',
      role: 'admin',
      is_active: 1,
      created_at: new Date().toISOString(),
    };
    const service = new TestAuthService(existing);

    try {
      service.register({ email: 'taken@example.com', password: 'password-123' });
      throw new Error('register should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).code).toBe('email_taken');
      expect(service.inserted).toHaveLength(0);
    }
  });
});
