import type { payments } from '@/db/schema/index.js';

export const PAYMENT_STATUSES = ['authorized', 'captured', 'failed', 'refunded'] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentRow = typeof payments.$inferSelect;
export type NewPaymentRow = typeof payments.$inferInsert;
