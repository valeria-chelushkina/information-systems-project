import { asc, count, eq } from 'drizzle-orm';
import { db as database, type Database } from '@/shared/db/client.js';
import { timedQuery } from '@/shared/db/timed-query.js';
import { venues } from '@/services/catalog/db/schema/index.js';
import type { NewVenueRow, VenueRow } from '@/services/catalog/typedefs/venue.typedefs.js';

export class VenuesRepository {
  protected readonly db: Database = database;

  insertOne(values: NewVenueRow): Promise<VenueRow> {
    return timedQuery('insert_venue', async () => {
      const [row] = await this.db.insert(venues).values(values).returning();

      if (!row) {
        throw new Error('insert_venue returned no row');
      }

      return row;
    });
  }

  findById(id: string): Promise<VenueRow | null> {
    return timedQuery('find_venue_by_id', async () => {
      const [row] = await this.db.select().from(venues).where(eq(venues.id, id));
      return row ?? null;
    });
  }

  findMany(limit: number, offset: number): Promise<VenueRow[]> {
    return timedQuery('list_venues', () =>
      this.db.select().from(venues).orderBy(asc(venues.name)).limit(limit).offset(offset),
    );
  }

  count(): Promise<number> {
    return timedQuery('count_venues', async () => {
      const [row] = await this.db.select({ value: count() }).from(venues);
      return Number(row?.value ?? 0);
    });
  }
}
