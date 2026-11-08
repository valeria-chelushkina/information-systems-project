import { asc, gte } from 'drizzle-orm';
import { db } from '@/db/client.js';
import { events } from '@/db/schema/index.js';
import { timedQuery } from '@/db/timed-query.js';
import type { EventSummary } from '@/modules/events/events.types.js';

export function listUpcoming(now: Date = new Date()): Promise<EventSummary[]> {
  return timedQuery('list_upcoming_events', () =>
    db
      .select({
        id: events.id,
        title: events.title,
        performerName: events.performerName,
        venueName: events.venueName,
        startsAt: events.startsAt,
        status: events.status,
      })
      .from(events)
      .where(gte(events.startsAt, now))
      .orderBy(asc(events.startsAt)),
  );
}
