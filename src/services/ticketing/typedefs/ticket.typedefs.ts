import type { tickets } from '@/services/ticketing/db/schema/index.js';

export const TICKET_STATUSES = ['issued', 'checked_in', 'refunded', 'void'] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketRow = typeof tickets.$inferSelect;
export type NewTicketRow = typeof tickets.$inferInsert;
