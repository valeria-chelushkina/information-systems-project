import type { DatabaseSync } from 'node:sqlite';

export function createSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_deliveries (
      event_id   TEXT PRIMARY KEY,
      order_id   TEXT NOT NULL,
      recipient  TEXT NOT NULL,
      status     TEXT NOT NULL CHECK (status IN ('sending', 'delivered', 'retrying', 'dead', 'skipped')),
      attempts   INTEGER NOT NULL DEFAULT 1,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS notification_deliveries_status_idx
      ON notification_deliveries (status, updated_at);
  `);
}
