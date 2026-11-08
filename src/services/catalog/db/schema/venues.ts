import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const venues = pgTable(
  'venues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    city: text('city').notNull(),
    timezone: text('timezone').notNull().default('UTC'),
    capacity: integer('capacity').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('venues_name_city_key').on(table.name, table.city),
    check('venues_capacity_check', sql`${table.capacity} > 0`),
  ],
);
