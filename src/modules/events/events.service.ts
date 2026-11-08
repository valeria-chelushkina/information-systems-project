import { listUpcoming } from '@/modules/events/events.repository.js';
import type { EventSummary } from '@/modules/events/events.types.js';

export function listUpcomingEvents(): Promise<EventSummary[]> {
  return listUpcoming();
}
