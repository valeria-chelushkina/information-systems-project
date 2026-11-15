import { and, eq, inArray, like, sql } from 'drizzle-orm';
import { db as database, type Database } from '@/shared/db/client.js';
import type { Executor } from '@/shared/db/executor.js';
import { tickets } from '@/services/ticketing/db/schema/index.js';
import { timedQuery } from '@/shared/db/timed-query.js';
import type { NewTicketRow, TicketRow } from '@/services/ticketing/typedefs/ticket.typedefs.js';

export class TicketsRepository {
  protected readonly db: Database = database;

  insertMany(values: NewTicketRow[], exec: Executor = this.db): Promise<TicketRow[]> {
    return timedQuery('insert_tickets_bulk', () => exec.insert(tickets).values(values).returning());
  }

  findByOrderId(orderId: string, exec: Executor = this.db): Promise<TicketRow[]> {
    return timedQuery('list_tickets_by_order', () =>
      exec.select().from(tickets).where(eq(tickets.orderId, orderId)),
    );
  }

  findByOrderIds(orderIds: string[]): Promise<TicketRow[]> {
    if (orderIds.length === 0) {
      return Promise.resolve([]);
    }

    return timedQuery('list_tickets_by_orders', () =>
      this.db.select().from(tickets).where(inArray(tickets.orderId, orderIds)),
    );
  }

  updateStatusByOrderId(
    orderId: string,
    status: string,
    exec: Executor = this.db,
  ): Promise<TicketRow[]> {
    return timedQuery('update_ticket_status', () =>
      exec
        .update(tickets)
        .set({ status })
        .where(eq(tickets.orderId, orderId))
        .returning(),
    );
  }

  findByQrToken(qrToken: string): Promise<TicketRow | null> {
    return timedQuery('find_ticket_by_qr', async () => {
      const [row] = await this.db.select().from(tickets).where(eq(tickets.qrToken, qrToken));
      return row ?? null;
    });
  }

  findByQrTokenPrefix(prefix: string): Promise<TicketRow[]> {
    return timedQuery('find_ticket_by_qr_prefix', () =>
      this.db
        .select()
        .from(tickets)
        .where(like(tickets.qrToken, `${prefix}%`))
        .limit(2),
    );
  }

  findByIdPrefix(prefix: string): Promise<TicketRow[]> {
    return timedQuery('find_ticket_by_id_prefix', () =>
      this.db
        .select()
        .from(tickets)
        .where(sql`${tickets.id}::text LIKE ${`${prefix}%`}`)
        .limit(2),
    );
  }

  checkIn(id: string): Promise<TicketRow | null> {
    return timedQuery('check_in_ticket', async () => {
      const [row] = await this.db
        .update(tickets)
        .set({ status: 'checked_in', checkedInAt: new Date() })
        .where(and(eq(tickets.id, id), eq(tickets.status, 'issued')))
        .returning();

      return row ?? null;
    });
  }
}
