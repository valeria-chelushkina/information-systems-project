import { eq } from 'drizzle-orm';
import { db as database, type Database } from '@/shared/db/client.js';
import type { Executor } from '@/shared/db/executor.js';
import { payments } from '@/services/ticketing/db/schema/index.js';
import { timedQuery } from '@/shared/db/timed-query.js';
import type { NewPaymentRow, PaymentRow } from '@/services/ticketing/typedefs/payment.typedefs.js';

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
