import type { holds } from '@/services/ticketing/db/schema/index.js';

export const HOLD_STATUSES = ['active', 'converted', 'expired', 'cancelled'] as const;

export type HoldStatus = (typeof HOLD_STATUSES)[number];
export type HoldRow = typeof holds.$inferSelect;
export type NewHoldRow = typeof holds.$inferInsert;
