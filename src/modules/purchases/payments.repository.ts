import { eq } from 'drizzle-orm';
import { db as database, type Database } from '@/db/client.js';
import type { Executor } from '@/db/executor.js';
import { payments } from '@/db/schema/index.js';
import { timedQuery } from '@/db/timed-query.js';
import type { NewPaymentRow, PaymentRow } from '@/typedefs/payment.typedefs.js';

export class PaymentsRepository {
  protected readonly db: Database = database;

  insertOne(values: NewPaymentRow, exec: Executor = this.db): Promise<PaymentRow> {
    return timedQuery('insert_payment', async () => {
      const [row] = await exec.insert(payments).values(values).returning();

      if (!row) {
        throw new Error('insert_payment returned no row');
      }

      return row;
    });
  }

  findByOrderId(orderId: string, exec: Executor = this.db): Promise<PaymentRow | null> {
    return timedQuery('find_payment_by_order', async () => {
      const [row] = await exec.select().from(payments).where(eq(payments.orderId, orderId));
      return row ?? null;
    });
  }
}
