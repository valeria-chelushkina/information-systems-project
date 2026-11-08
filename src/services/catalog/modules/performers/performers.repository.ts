import { asc, count, eq } from 'drizzle-orm';
import { db as database, type Database } from '@/shared/db/client.js';
import { timedQuery } from '@/shared/db/timed-query.js';
import { performers } from '@/services/catalog/db/schema/index.js';
import type {
  NewPerformerRow,
  PerformerRow,
} from '@/services/catalog/typedefs/performer.typedefs.js';

export class PerformersRepository {
  protected readonly db: Database = database;

  insertOne(values: NewPerformerRow): Promise<PerformerRow> {
    return timedQuery('insert_performer', async () => {
      const [row] = await this.db.insert(performers).values(values).returning();

      if (!row) {
        throw new Error('insert_performer returned no row');
      }

      return row;
    });
  }

  findById(id: string): Promise<PerformerRow | null> {
    return timedQuery('find_performer_by_id', async () => {
      const [row] = await this.db.select().from(performers).where(eq(performers.id, id));
      return row ?? null;
    });
  }

  findMany(limit: number, offset: number): Promise<PerformerRow[]> {
    return timedQuery('list_performers', () =>
      this.db
        .select()
        .from(performers)
        .orderBy(asc(performers.name))
        .limit(limit)
        .offset(offset),
    );
  }

  count(): Promise<number> {
    return timedQuery('count_performers', async () => {
      const [row] = await this.db.select({ value: count() }).from(performers);
      return Number(row?.value ?? 0);
    });
  }
}
