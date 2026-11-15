import { asc, count, eq, ilike } from 'drizzle-orm';
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

  updateById(
    id: string,
    changes: Partial<NewPerformerRow>,
  ): Promise<PerformerRow | null> {
    return timedQuery('update_performer', async () => {
      const [row] = await this.db
        .update(performers)
        .set(changes)
        .where(eq(performers.id, id))
        .returning();

      return row ?? null;
    });
  }

  findMany(limit: number, offset: number, search?: string): Promise<PerformerRow[]> {
    const where = search ? ilike(performers.name, `%${search}%`) : undefined;

    return timedQuery('list_performers', () =>
      this.db
        .select()
        .from(performers)
        .where(where)
        .orderBy(asc(performers.name))
        .limit(limit)
        .offset(offset),
    );
  }

  count(search?: string): Promise<number> {
    const where = search ? ilike(performers.name, `%${search}%`) : undefined;

    return timedQuery('count_performers', async () => {
      const [row] = await this.db.select({ value: count() }).from(performers).where(where);
      return Number(row?.value ?? 0);
    });
  }
}
