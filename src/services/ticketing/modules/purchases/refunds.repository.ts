import { eq } from 'drizzle-orm';
import { db as database, type Database } from '@/shared/db/client.js';
import type { Executor } from '@/shared/db/executor.js';
import { timedQuery } from '@/shared/db/timed-query.js';
import { refunds } from '@/services/ticketing/db/schema/index.js';
import type { NewRefundRow, RefundRow } from '@/services/ticketing/typedefs/refund.typedefs.js';

export class RefundsRepository {
  protected readonly db: Database = database;

  insertOne(values: NewRefundRow, exec: Executor = this.db): Promise<RefundRow> {
    return timedQuery('insert_refund', async () => {
      const [row] = await exec.insert(refunds).values(values).returning();

      if (!row) {
        throw new Error('insert_refund returned no row');
      }

      return row;
    });
  }

  findByOrderId(orderId: string, exec: Executor = this.db): Promise<RefundRow | null> {
    return timedQuery('find_refund_by_order', async () => {
      const [row] = await exec.select().from(refunds).where(eq(refunds.orderId, orderId));
      return row ?? null;
    });
  }
}
