import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { events } from '@/db/schema/events.js';

export const priceTiers = pgTable(
  'price_tiers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    priceCents: integer('price_cents').notNull(),
    totalQty: integer('total_qty').notNull(),
    availableQty: integer('available_qty').notNull(),
    soldQty: integer('sold_qty').notNull().default(0),
    heldQty: integer('held_qty').notNull().default(0),
  },
  (table) => [
    unique('price_tiers_event_name_key').on(table.eventId, table.name),
    check('price_tiers_price_cents_check', sql`${table.priceCents} >= 0`),
    check('price_tiers_total_qty_check', sql`${table.totalQty} >= 0`),
    check('price_tiers_available_qty_check', sql`${table.availableQty} >= 0`),
    check('price_tiers_sold_qty_check', sql`${table.soldQty} >= 0`),
    check('price_tiers_held_qty_check', sql`${table.heldQty} >= 0`),
    check(
      'price_tiers_qty_consistent',
      sql`${table.availableQty} + ${table.soldQty} + ${table.heldQty} = ${table.totalQty}`,
    ),
  ],
);
