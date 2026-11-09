import { authDb } from '@/services/auth/db/client.js';
import type { NewSession, SessionRow } from '@/services/auth/typedefs/session.typedefs.js';

export class SessionsRepository {
  protected readonly db = authDb;

  insertOne(session: NewSession): SessionRow {
    this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, token_hash, issued_at, expires_at, revoked_at, user_agent)
         VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      )
      .run(
        session.id,
        session.userId,
        session.tokenHash,
        session.issuedAt,
        session.expiresAt,
        session.userAgent,
      );

    return {
      id: session.id,
      user_id: session.userId,
      token_hash: session.tokenHash,
      issued_at: session.issuedAt,
      expires_at: session.expiresAt,
      revoked_at: null,
      user_agent: session.userAgent,
    };
  }

  findActiveByTokenHash(tokenHash: string, now: string): SessionRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM sessions
         WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
      )
      .get(tokenHash, now) as SessionRow | undefined;

    return row ?? null;
  }

  revokeByTokenHash(tokenHash: string, now: string): number {
    const result = this.db
      .prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
      .run(now, tokenHash);

    return Number(result.changes);
  }
}
