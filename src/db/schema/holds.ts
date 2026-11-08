import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { events } from '@/db/schema/events.js';
import { priceTiers } from '@/db/schema/price-tiers.js';

export const holds = pgTable(
  'holds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    tierId: uuid('tier_id')
      .notNull()
      .references(() => priceTiers.id, { onDelete: 'cascade' }),
    customerRef: uuid('customer_ref').notNull(),
    quantity: integer('quantity').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    status: text('status').notNull().default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('holds_quantity_check', sql`${table.quantity} > 0`),
    check('holds_unit_price_cents_check', sql`${table.unitPriceCents} >= 0`),
    check(
      'holds_status_check',
      sql`${table.status} IN ('active', 'converted', 'expired', 'cancelled')`,
    ),
    index('holds_active_expiry_idx')
      .on(table.expiresAt)
      .where(sql`${table.status} = 'active'`),
  ],
);
