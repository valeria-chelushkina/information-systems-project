import type { refunds } from '@/services/ticketing/db/schema/index.js';

export const REFUND_STATUSES = ['pending', 'completed', 'failed'] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];
export type RefundRow = typeof refunds.$inferSelect;
export type NewRefundRow = typeof refunds.$inferInsert;
