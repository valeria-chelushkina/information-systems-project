import { and, asc, eq, inArray, lt } from 'drizzle-orm';
import { db as database, type Database } from '@/db/client.js';
import type { Executor } from '@/db/executor.js';
import { holds } from '@/db/schema/index.js';
import { timedQuery } from '@/db/timed-query.js';
import type { HoldRow, HoldStatus, NewHoldRow } from '@/typedefs/hold.typedefs.js';

export class HoldsRepository {
  protected readonly db: Database = database;

  insertOne(values: NewHoldRow, exec: Executor = this.db): Promise<HoldRow> {
    return timedQuery('insert_hold', async () => {
      const [row] = await exec.insert(holds).values(values).returning();

      if (!row) {
        throw new Error('insert_hold returned no row');
      }

      return row;
    });
  }

  findById(id: string, exec: Executor = this.db): Promise<HoldRow | null> {
    return timedQuery('find_hold_by_id', async () => {
      const [row] = await exec.select().from(holds).where(eq(holds.id, id));
      return row ?? null;
    });
  }

  lockById(id: string, exec: Executor = this.db): Promise<HoldRow | null> {
    return timedQuery('lock_hold', async () => {
      const [row] = await exec.select().from(holds).where(eq(holds.id, id)).for('update');
      return row ?? null;
    });
  }

  findExpired(limit: number, exec: Executor = this.db): Promise<HoldRow[]> {
    return timedQuery('find_expired_holds', () =>
      exec
        .select()
        .from(holds)
        .where(and(eq(holds.status, 'active'), lt(holds.expiresAt, new Date())))
        .orderBy(asc(holds.expiresAt))
        .limit(limit)
        .for('update', { skipLocked: true }),
    );
  }

  updateStatus(ids: string[], status: HoldStatus, exec: Executor = this.db): Promise<number> {
    if (ids.length === 0) {
      return Promise.resolve(0);
    }

    return timedQuery('update_hold_status', async () => {
      const rows = await exec
        .update(holds)
        .set({ status })
        .where(inArray(holds.id, ids))
        .returning({ id: holds.id });

      return rows.length;
    });
  }
}
