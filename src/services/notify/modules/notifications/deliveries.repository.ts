import type { DatabaseSync } from 'node:sqlite';

export const DELIVERY_STATUSES = ['sending', 'delivered', 'retrying', 'dead', 'skipped'] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface DeliveryRow {
  eventId: string;
  orderId: string;
  recipient: string;
  status: DeliveryStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DeliveryDbRow {
  event_id: string;
  order_id: string;
  recipient: string;
  status: DeliveryStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryClaim {
  claimed: boolean;
  attempts: number;
}

const MAX_ERROR_LENGTH = 500;

function toDelivery(row: DeliveryDbRow): DeliveryRow {
  return {
    eventId: row.event_id,
    orderId: row.order_id,
    recipient: row.recipient,
    status: row.status,
    attempts: Number(row.attempts),
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function truncate(error: string): string {
  return error.length > MAX_ERROR_LENGTH ? `${error.slice(0, MAX_ERROR_LENGTH - 1)}…` : error;
}

export class DeliveriesRepository {
  constructor(protected readonly db: DatabaseSync) {}

  claim(eventId: string, orderId: string, recipient: string): DeliveryClaim {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO notification_deliveries
           (event_id, order_id, recipient, status, attempts, last_error, created_at, updated_at)
         VALUES (?, ?, ?, 'sending', 1, NULL, ?, ?)
         ON CONFLICT(event_id) DO UPDATE SET
           status = 'sending',
           attempts = notification_deliveries.attempts + 1,
           updated_at = excluded.updated_at
         WHERE notification_deliveries.status <> 'delivered'`,
      )
      .run(eventId, orderId, recipient, now, now);

    if (Number(result.changes) > 0) {
      return { claimed: true, attempts: this.attempts(eventId) };
    }

    return { claimed: false, attempts: this.attempts(eventId) };
  }

  find(eventId: string): DeliveryRow | null {
    const row = this.db
      .prepare('SELECT * FROM notification_deliveries WHERE event_id = ?')
      .get(eventId) as DeliveryDbRow | undefined;

    return row ? toDelivery(row) : null;
  }

  attempts(eventId: string): number {
    const row = this.db
      .prepare('SELECT attempts FROM notification_deliveries WHERE event_id = ?')
      .get(eventId) as { attempts: number } | undefined;

    return row ? Number(row.attempts) : 0;
  }

  markDelivered(eventId: string): void {
    this.db
      .prepare(
        `UPDATE notification_deliveries
         SET status = 'delivered', updated_at = ?
         WHERE event_id = ?`,
      )
      .run(new Date().toISOString(), eventId);
  }

  markRetry(eventId: string, error: string): void {
    this.update(eventId, 'retrying', error);
  }

  markDead(eventId: string, error: string): void {
    this.update(eventId, 'dead', error);
  }

  markSkipped(eventId: string, reason: string): void {
    this.update(eventId, 'skipped', reason);
  }

  list(limit: number, offset: number): DeliveryRow[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM notification_deliveries
         ORDER BY updated_at DESC, event_id
         LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as unknown as DeliveryDbRow[];

    return rows.map(toDelivery);
  }

  count(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS total FROM notification_deliveries')
      .get() as { total: number };

    return Number(row.total);
  }

  stats(): Record<DeliveryStatus, number> {
    const rows = this.db
      .prepare('SELECT status, COUNT(*) AS total FROM notification_deliveries GROUP BY status')
      .all() as { status: DeliveryStatus; total: number }[];
    const stats: Record<DeliveryStatus, number> = {
      sending: 0,
      delivered: 0,
      retrying: 0,
      dead: 0,
      skipped: 0,
    };

    for (const row of rows) {
      stats[row.status] = Number(row.total);
    }

    return stats;
  }

  protected update(eventId: string, status: DeliveryStatus, error: string | null): void {
    this.db
      .prepare(
        `UPDATE notification_deliveries
         SET status = ?, last_error = ?, updated_at = ?
         WHERE event_id = ?`,
      )
      .run(status, error === null ? null : truncate(error), new Date().toISOString(), eventId);
  }
}
