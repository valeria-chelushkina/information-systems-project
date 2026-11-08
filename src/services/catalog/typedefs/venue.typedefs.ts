import type { venues } from '@/services/catalog/db/schema/index.js';

export type VenueRow = typeof venues.$inferSelect;
export type NewVenueRow = typeof venues.$inferInsert;
