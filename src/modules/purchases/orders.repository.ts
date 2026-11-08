import { eq } from 'drizzle-orm';
import { db as database, type Database } from '@/db/client.js';
import type { Executor } from '@/db/executor.js';
import { orders } from '@/db/schema/index.js';
import { timedQuery } from '@/db/timed-query.js';
import type { NewOrderRow, OrderRow } from '@/typedefs/order.typedefs.js';

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
}
