import type { events } from '@/db/schema/index.js';

export type EventSummary = Pick<
  typeof events.$inferSelect,
  'id' | 'title' | 'performerName' | 'venueName' | 'startsAt' | 'status'
>;
