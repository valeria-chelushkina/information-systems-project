import { eq } from 'drizzle-orm';
import { db as database, type Database } from '@/shared/db/client.js';
import type { Executor } from '@/shared/db/executor.js';
import { orders } from '@/services/ticketing/db/schema/index.js';
import { timedQuery } from '@/shared/db/timed-query.js';
import type { NewOrderRow, OrderRow } from '@/services/ticketing/typedefs/order.typedefs.js';

export class OrdersRepository {
  protected readonly db: Database = database;

  insertOne(values: NewOrderRow, exec: Executor = this.db): Promise<OrderRow> {
    return timedQuery('insert_order', async () => {
      const [row] = await exec.insert(orders).values(values).returning();

      if (!row) {
        throw new Error('insert_order returned no row');
      }

      return row;
    });
  }

  findById(id: string, exec: Executor = this.db): Promise<OrderRow | null> {
    return timedQuery('find_order_by_id', async () => {
      const [row] = await exec.select().from(orders).where(eq(orders.id, id));
      return row ?? null;
    });
  }

  findByIdempotencyKey(key: string, exec: Executor = this.db): Promise<OrderRow | null> {
    return timedQuery('find_order_by_idempotency_key', async () => {
      const [row] = await exec
        .select()
        .from(orders)
        .where(eq(orders.idempotencyKey, key));

      return row ?? null;
    });
  }

  lockById(id: string, exec: Executor = this.db): Promise<OrderRow | null> {
    return timedQuery('lock_order', async () => {
      const [row] = await exec.select().from(orders).where(eq(orders.id, id)).for('update');
      return row ?? null;
    });
  }

  updateStatus(id: string, status: string, exec: Executor = this.db): Promise<OrderRow | null> {
    return timedQuery('update_order_status', async () => {
      const [row] = await exec
        .update(orders)
        .set({ status })
        .where(eq(orders.id, id))
        .returning();

      return row ?? null;
    });
  }
}
