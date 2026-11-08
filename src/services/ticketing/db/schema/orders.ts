import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { holds } from '@/services/ticketing/db/schema/holds.js';

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerRef: uuid('customer_ref').notNull(),
    customerEmail: text('customer_email').notNull(),
    holdId: uuid('hold_id')
      .notNull()
      .references(() => holds.id),
    status: text('status').notNull().default('paid'),
    totalCents: integer('total_cents').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('orders_idempotency_key_key').on(table.idempotencyKey),
    check('orders_total_cents_check', sql`${table.totalCents} >= 0`),
    check(
      'orders_status_check',
      sql`${table.status} IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')`,
    ),
  ],
);
