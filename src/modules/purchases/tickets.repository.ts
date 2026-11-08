import { eq } from 'drizzle-orm';
import { db as database, type Database } from '@/db/client.js';
import type { Executor } from '@/db/executor.js';
import { tickets } from '@/db/schema/index.js';
import { timedQuery } from '@/db/timed-query.js';
import type { NewTicketRow, TicketRow } from '@/typedefs/ticket.typedefs.js';

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
}
