import type { DatabaseSync } from 'node:sqlite';

export function createSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('customer', 'staff', 'admin')),
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      issued_at  TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      email        TEXT NOT NULL,
      success      INTEGER NOT NULL,
      ip           TEXT,
      attempted_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions (token_hash);
    CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON login_attempts (email, attempted_at);
  `);
}
