import { and, count, countDistinct, desc, eq, gte, inArray, lte, sum } from 'drizzle-orm';
import { db as database, type Database } from '@/shared/db/client.js';
import { timedQuery } from '@/shared/db/timed-query.js';
import { events, orders, priceTiers, refunds, tickets } from '@/services/ticketing/db/schema/index.js';

const ACTIVE_TICKET_STATUSES = ['issued', 'checked_in'] as const;

function amount(value: string | null): number {
  return Number(value ?? 0);
}

export class AnalyticsRepository {
  protected readonly db: Database = database;

  async totals(from: Date, to: Date) {
    return timedQuery('report_totals', async () => {
      const [sold] = await this.db
        .select({
          tickets: count(),
          revenue: sum(tickets.unitPriceCents),
        })
        .from(tickets)
        .where(
          and(
            inArray(tickets.status, [...ACTIVE_TICKET_STATUSES]),
            gte(tickets.issuedAt, from),
            lte(tickets.issuedAt, to),
          ),
        );

      const [checkedIn] = await this.db
        .select({ tickets: count() })
        .from(tickets)
        .where(
          and(
            eq(tickets.status, 'checked_in'),
            gte(tickets.checkedInAt, from),
            lte(tickets.checkedInAt, to),
          ),
        );

      const [refunded] = await this.db
        .select({
          refunds: count(),
          cents: sum(refunds.amountCents),
        })
        .from(refunds)
        .where(and(gte(refunds.createdAt, from), lte(refunds.createdAt, to)));

      const [placed] = await this.db
        .select({ orders: count() })
        .from(orders)
        .where(and(gte(orders.createdAt, from), lte(orders.createdAt, to)));

      return {
        revenueCents: amount(sold?.revenue ?? null),
        refundedCents: amount(refunded?.cents ?? null),
        orders: Number(placed?.orders ?? 0),
        ticketsSold: Number(sold?.tickets ?? 0),
        ticketsCheckedIn: Number(checkedIn?.tickets ?? 0),
      };
    });
  }

  eventRows(from: Date, to: Date, limit: number) {
    return timedQuery('report_events', () =>
      this.db
        .select({
          id: events.id,
          title: events.title,
          performerName: events.performerName,
          startsAt: events.startsAt,
          status: events.status,
          ticketsSold: count(tickets.id),
          revenueCents: sum(tickets.unitPriceCents),
        })
        .from(tickets)
        .innerJoin(events, eq(events.id, tickets.eventId))
        .where(
          and(
            inArray(tickets.status, [...ACTIVE_TICKET_STATUSES]),
            gte(tickets.issuedAt, from),
            lte(tickets.issuedAt, to),
          ),
        )
        .groupBy(events.id)
        .orderBy(desc(sum(tickets.unitPriceCents)))
        .limit(limit),
    );
  }

  eventCapacity(eventIds: string[]) {
    if (eventIds.length === 0) {
      return Promise.resolve([]);
    }

    return timedQuery('report_event_capacity', () =>
      this.db
        .select({
          eventId: priceTiers.eventId,
          capacity: sum(priceTiers.totalQty),
          soldQty: sum(priceTiers.soldQty),
        })
        .from(priceTiers)
        .where(inArray(priceTiers.eventId, eventIds))
        .groupBy(priceTiers.eventId),
    );
  }

  performerRows(from: Date, to: Date, limit: number) {
    return timedQuery('report_performers', () =>
      this.db
        .select({
          performerId: events.performerId,
          performerName: events.performerName,
          events: countDistinct(events.id),
          ticketsSold: count(tickets.id),
          revenueCents: sum(tickets.unitPriceCents),
        })
        .from(tickets)
        .innerJoin(events, eq(events.id, tickets.eventId))
        .where(
          and(
            inArray(tickets.status, [...ACTIVE_TICKET_STATUSES]),
            gte(tickets.issuedAt, from),
            lte(tickets.issuedAt, to),
          ),
        )
        .groupBy(events.performerId, events.performerName)
        .orderBy(desc(sum(tickets.unitPriceCents)))
        .limit(limit),
    );
  }
}
