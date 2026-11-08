import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { events } from '@/services/ticketing/db/schema/events.js';
import { orders } from '@/services/ticketing/db/schema/orders.js';
import { priceTiers } from '@/services/ticketing/db/schema/price-tiers.js';

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    tierId: uuid('tier_id')
      .notNull()
      .references(() => priceTiers.id),
    customerRef: uuid('customer_ref').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    status: text('status').notNull().default('issued'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tickets_event_status_idx').on(table.eventId, table.status),
    check('tickets_unit_price_cents_check', sql`${table.unitPriceCents} >= 0`),
    check(
      'tickets_status_check',
      sql`${table.status} IN ('issued', 'checked_in', 'refunded', 'void')`,
    ),
  ],
);
