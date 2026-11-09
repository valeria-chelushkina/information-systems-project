import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { orders } from '@/services/ticketing/db/schema/orders.js';

export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull(),
    reason: text('reason'),
    status: text('status').notNull().default('completed'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('refunds_order_id_key').on(table.orderId),
    index('refunds_order_idx').on(table.orderId),
    check('refunds_amount_cents_check', sql`${table.amountCents} >= 0`),
    check(
      'refunds_status_check',
      sql`${table.status} IN ('pending', 'completed', 'failed')`,
    ),
  ],
);
