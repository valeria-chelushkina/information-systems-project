import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { performers } from '@/services/catalog/db/schema/performers.js';
import { venues } from '@/services/catalog/db/schema/venues.js';

export const bookingRequests = pgTable(
  'booking_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    performerId: uuid('performer_id')
      .notNull()
      .references(() => performers.id),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('requested'),
    requestedBy: uuid('requested_by'),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'booking_requests_status_check',
      sql`${table.status} IN ('requested', 'confirmed', 'rejected', 'cancelled')`,
    ),
    check('booking_requests_period_check', sql`${table.endsAt} > ${table.startsAt}`),
    index('booking_requests_venue_status_idx').on(table.venueId, table.status),
  ],
);
