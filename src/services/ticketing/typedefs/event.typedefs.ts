import type { events } from '@/services/ticketing/db/schema/index.js';

export const EVENT_STATUSES = [
  'draft',
  'scheduled',
  'on_sale',
  'sold_out',
  'completed',
  'cancelled',
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;

export interface EventFilters {
  status?: EventStatus;
  search?: string;
  performerId?: string;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
}

export interface UpcomingEventFilters {
  statuses: readonly EventStatus[];
  from: Date;
  to?: Date;
  search?: string;
  performerId?: string;
}

export interface EventPage {
  items: EventRow[];
  total: number;
  limit: number;
  offset: number;
}
