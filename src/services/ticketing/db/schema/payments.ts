import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { orders } from '@/services/ticketing/db/schema/orders.js';

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull(),
    providerRef: text('provider_ref'),
    status: text('status').notNull().default('captured'),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('payments_order_id_key').on(table.orderId),
    check('payments_amount_cents_check', sql`${table.amountCents} >= 0`),
    check(
      'payments_status_check',
      sql`${table.status} IN ('authorized', 'captured', 'failed', 'refunded')`,
    ),
  ],
);
