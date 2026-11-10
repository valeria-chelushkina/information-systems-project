import { and, gt, inArray, sql } from 'drizzle-orm';
import { db } from '@/shared/db/client.js';
import { timedQuery } from '@/shared/db/timed-query.js';
import { logger } from '@/shared/observability/logger.js';
import { events } from '@/services/ticketing/db/schema/events.js';
import { priceTiers } from '@/services/ticketing/db/schema/price-tiers.js';
import { EVENT_STATUSES } from '@/services/ticketing/typedefs/event.typedefs.js';
import {
  eventsByStatus,
  eventsUpcomingTotal,
  inventoryAvailableSeats,
  inventoryHeldSeats,
  inventorySoldSeats,
  inventoryTotalSeats,
} from '@/services/ticketing/observability/business-state.metrics.js';

export class BusinessStateSweeper {
  protected timer: NodeJS.Timeout | null = null;

  constructor(protected readonly intervalMs = 15_000) {}

  start(): void {
    void this.refresh();

    this.timer = setInterval(() => {
      void this.refresh();
    }, this.intervalMs);

    this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  protected async refresh(): Promise<void> {
    try {
      const statusRows = await timedQuery('business_events_by_status', () =>
        db
          .select({
            status: events.status,
            count: sql<number>`count(*)::int`,
          })
          .from(events)
          .groupBy(events.status),
      );

      const counts = new Map(statusRows.map((row) => [row.status, Number(row.count)]));

      for (const status of EVENT_STATUSES) {
        eventsByStatus.set({ status }, counts.get(status) ?? 0);
      }

      const [inventory] = await timedQuery('business_inventory_snapshot', () =>
        db
          .select({
            total: sql<number>`coalesce(sum(${priceTiers.totalQty}), 0)::int`,
            sold: sql<number>`coalesce(sum(${priceTiers.soldQty}), 0)::int`,
            available: sql<number>`coalesce(sum(${priceTiers.availableQty}), 0)::int`,
            held: sql<number>`coalesce(sum(${priceTiers.heldQty}), 0)::int`,
          })
          .from(priceTiers),
      );

      inventoryTotalSeats.set(Number(inventory?.total ?? 0));
      inventorySoldSeats.set(Number(inventory?.sold ?? 0));
      inventoryAvailableSeats.set(Number(inventory?.available ?? 0));
      inventoryHeldSeats.set(Number(inventory?.held ?? 0));

      const [upcoming] = await timedQuery('business_upcoming_events', () =>
        db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(events)
          .where(
            and(
              gt(events.startsAt, new Date()),
              inArray(events.status, ['scheduled', 'on_sale', 'sold_out']),
            ),
          ),
      );

      eventsUpcomingTotal.set(Number(upcoming?.count ?? 0));
    } catch (error) {
      logger.error({ err: error }, 'business state snapshot failed');
    }
  }
}
