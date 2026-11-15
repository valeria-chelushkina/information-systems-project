import { and, asc, count, desc, eq, exists, gte, lte, sql, type SQL } from 'drizzle-orm';
import { db as database, type Database } from '@/shared/db/client.js';
import type { Executor } from '@/shared/db/executor.js';
import { events, orders, tickets } from '@/services/ticketing/db/schema/index.js';
import { timedQuery } from '@/shared/db/timed-query.js';
import type { NewOrderRow, OrderFilters, OrderRow, PerformerOption } from '@/services/ticketing/typedefs/order.typedefs.js';

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

  findByCustomerRef(
    customerRef: string,
    limit: number,
    offset: number,
    filters: OrderFilters = {},
  ): Promise<OrderRow[]> {
    return timedQuery('list_orders_by_customer', () =>
      this.db
        .select()
        .from(orders)
        .where(this.customerWhere(customerRef, filters))
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset),
    );
  }

  countByCustomerRef(customerRef: string, filters: OrderFilters = {}): Promise<number> {
    return timedQuery('count_orders_by_customer', async () => {
      const [row] = await this.db
        .select({ value: count() })
        .from(orders)
        .where(this.customerWhere(customerRef, filters));

      return Number(row?.value ?? 0);
    });
  }

  findPerformerOptions(customerRef: string): Promise<PerformerOption[]> {
    return timedQuery('list_customer_performers', () =>
      this.db
        .selectDistinct({ id: events.performerId, name: events.performerName })
        .from(orders)
        .innerJoin(tickets, eq(tickets.orderId, orders.id))
        .innerJoin(events, eq(events.id, tickets.eventId))
        .where(eq(orders.customerRef, customerRef))
        .orderBy(asc(events.performerName)),
    );
  }

  private customerWhere(customerRef: string, filters: OrderFilters): SQL {
    const customer = eq(orders.customerRef, customerRef);
    const eventConditions: SQL[] = [eq(tickets.orderId, orders.id)];

    if (filters.performerId) {
      eventConditions.push(eq(events.performerId, filters.performerId));
    }
    if (filters.from) {
      eventConditions.push(gte(events.startsAt, filters.from));
    }
    if (filters.to) {
      eventConditions.push(lte(events.startsAt, filters.to));
    }

    if (eventConditions.length === 1) {
      return customer;
    }

    return and(
      customer,
      exists(
        this.db
          .select({ matched: sql`1` })
          .from(tickets)
          .innerJoin(events, eq(tickets.eventId, events.id))
          .where(and(...eventConditions)),
      ),
    )!;
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
