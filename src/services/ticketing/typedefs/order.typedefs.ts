import type { orders } from '@/services/ticketing/db/schema/index.js';

export const ORDER_STATUSES = ['pending', 'paid', 'failed', 'cancelled', 'refunded'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderRow = typeof orders.$inferSelect;
export type NewOrderRow = typeof orders.$inferInsert;
