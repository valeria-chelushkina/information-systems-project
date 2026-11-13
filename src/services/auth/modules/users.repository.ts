import { authDb } from '@/services/auth/db/client.js';
import type { NewUser, UserRow } from '@/services/auth/typedefs/user.typedefs.js';

export class UsersRepository {
  protected readonly db = authDb;

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS value FROM users').get() as
      | { value: number }
      | undefined;

    return Number(row?.value ?? 0);
  }

  findByEmail(email: string): UserRow | null {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
      | UserRow
      | undefined;

    return row ?? null;
  }

  findById(id: string): UserRow | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
      | UserRow
      | undefined;

    return row ?? null;
  }

  findAll(): UserRow[] {
    return this.db
      .prepare('SELECT * FROM users ORDER BY created_at ASC')
      .all() as unknown as UserRow[];
  }

  insertOne(user: NewUser): UserRow {
    this.db
      .prepare(
        `INSERT INTO users (id, email, password_hash, role, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(user.id, user.email, user.passwordHash, user.role, user.isActive, user.createdAt);

    return {
      id: user.id,
      email: user.email,
      password_hash: user.passwordHash,
      role: user.role,
      is_active: user.isActive,
      created_at: user.createdAt,
    };
  }
}
