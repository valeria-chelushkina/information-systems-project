import { sql } from 'drizzle-orm';
import { check, integer, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    performerId: uuid('performer_id').notNull(),
    performerName: text('performer_name').notNull(),
    venueId: uuid('venue_id').notNull(),
    venueName: text('venue_name').notNull(),
    title: text('title').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    doorsAt: timestamp('doors_at', { withTimezone: true }),
    durationMinutes: integer('duration_minutes'),
    status: text('status').notNull().default('draft'),
    onSaleAt: timestamp('on_sale_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('events_status_on_sale_at_idx').on(table.status, table.onSaleAt),
    check(
      'events_status_check',
      sql`${table.status} IN ('draft', 'scheduled', 'on_sale', 'sold_out', 'completed', 'cancelled')`,
    ),
    check('events_doors_before_start_check', sql`${table.doorsAt} IS NULL OR ${table.doorsAt} < ${table.startsAt}`),
    check('events_duration_check', sql`${table.durationMinutes} IS NULL OR ${table.durationMinutes} > 0`),
  ],
);
