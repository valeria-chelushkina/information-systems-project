import { pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const performers = pgTable(
  'performers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    genre: text('genre'),
    contactEmail: text('contact_email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('performers_name_key').on(table.name)],
);
