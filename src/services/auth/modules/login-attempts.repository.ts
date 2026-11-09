import { authDb } from '@/services/auth/db/client.js';

export interface LoginAttemptInput {
  email: string;
  success: boolean;
  ip: string | null;
}

export class LoginAttemptsRepository {
  protected readonly db = authDb;

  record(attempt: LoginAttemptInput): void {
    this.db
      .prepare('INSERT INTO login_attempts (email, success, ip, attempted_at) VALUES (?, ?, ?, ?)')
      .run(attempt.email, attempt.success ? 1 : 0, attempt.ip, new Date().toISOString());
  }

  countFailuresSince(email: string, since: string): number {
    const row = this.db
      .prepare(
        'SELECT COUNT(*) AS value FROM login_attempts WHERE email = ? AND success = 0 AND attempted_at >= ?',
      )
      .get(email, since) as { value: number } | undefined;

    return Number(row?.value ?? 0);
  }
}
