import type { performers } from '@/services/catalog/db/schema/index.js';

export type PerformerRow = typeof performers.$inferSelect;
export type NewPerformerRow = typeof performers.$inferInsert;
