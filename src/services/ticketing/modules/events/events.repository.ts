import { and, asc, count, eq, gte, ilike, inArray, lte, or, type SQL } from 'drizzle-orm';
import { db as database, type Database } from '@/shared/db/client.js';
import type { Executor } from '@/shared/db/executor.js';
import { events } from '@/services/ticketing/db/schema/index.js';
import { timedQuery } from '@/shared/db/timed-query.js';
import type {
  EventFilters,
  EventRow,
  EventStatus,
  NewEventRow,
} from '@/services/ticketing/typedefs/event.typedefs.js';

export class EventsRepository {
  protected readonly db: Database = database;

  insertOne(values: NewEventRow): Promise<EventRow> {
    return timedQuery('insert_event', async () => {
      const [row] = await this.db.insert(events).values(values).returning();

      if (!row) {
        throw new Error('insert_event returned no row');
      }

      return row;
    });
  }

  insertMany(values: NewEventRow[]): Promise<EventRow[]> {
    return timedQuery('insert_events_bulk', () =>
      this.db.insert(events).values(values).returning(),
    );
  }

  findById(id: string, exec: Executor = this.db): Promise<EventRow | null> {
    return timedQuery('find_event_by_id', async () => {
      const [row] = await exec.select().from(events).where(eq(events.id, id));
      return row ?? null;
    });
  }

  findByIds(ids: string[]): Promise<EventRow[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return timedQuery('find_events_by_ids', () =>
      this.db.select().from(events).where(inArray(events.id, ids)),
    );
  }

  findMany(filters: EventFilters): Promise<EventRow[]> {
    return timedQuery('list_events', () =>
      this.db
        .select()
        .from(events)
        .where(this.buildFilter(filters))
        .orderBy(asc(events.startsAt))
        .limit(filters.limit)
        .offset(filters.offset),
    );
  }

  count(filters: EventFilters): Promise<number> {
    return timedQuery('count_events', async () => {
      const [row] = await this.db
        .select({ value: count() })
        .from(events)
        .where(this.buildFilter(filters));

      return Number(row?.value ?? 0);
    });
  }

  findUpcoming(
    statuses: readonly EventStatus[],
    from: Date,
    limit: number,
    offset: number,
  ): Promise<EventRow[]> {
    return timedQuery('list_public_events', () =>
      this.db
        .select()
        .from(events)
        .where(this.buildUpcomingFilter(statuses, from))
        .orderBy(asc(events.startsAt))
        .limit(limit)
        .offset(offset),
    );
  }

  countUpcoming(statuses: readonly EventStatus[], from: Date): Promise<number> {
    return timedQuery('count_public_events', async () => {
      const [row] = await this.db
        .select({ value: count() })
        .from(events)
        .where(this.buildUpcomingFilter(statuses, from));

      return Number(row?.value ?? 0);
    });
  }

  updateById(
    id: string,
    values: Partial<NewEventRow>,
    exec: Executor = this.db,
  ): Promise<EventRow | null> {
    return timedQuery('update_event', async () => {
      const [row] = await exec
        .update(events)
        .set(values)
        .where(eq(events.id, id))
        .returning();

      return row ?? null;
    });
  }

  deleteById(id: string): Promise<boolean> {
    return timedQuery('delete_event', async () => {
      const rows = await this.db
        .delete(events)
        .where(eq(events.id, id))
        .returning({ id: events.id });

      return rows.length > 0;
    });
  }

  private buildFilter(filters: EventFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.status) {
      conditions.push(eq(events.status, filters.status));
    }
    if (filters.performerId) {
      conditions.push(eq(events.performerId, filters.performerId));
    }
    if (filters.search) {
      const escaped = filters.search.replace(/[\\%_]/g, '\\$&');
      const term = `%${escaped}%`;

      conditions.push(
        or(
          ilike(events.title, term),
          ilike(events.performerName, term),
          ilike(events.venueName, term),
        ) as SQL,
      );
    }
    if (filters.from) {
      conditions.push(gte(events.startsAt, filters.from));
    }
    if (filters.to) {
      conditions.push(lte(events.startsAt, filters.to));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private buildUpcomingFilter(statuses: readonly EventStatus[], from: Date): SQL {
    return and(inArray(events.status, [...statuses]), gte(events.startsAt, from)) as SQL;
  }
}
