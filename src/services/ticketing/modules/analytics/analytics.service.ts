import { AnalyticsRepository } from '@/services/ticketing/modules/analytics/analytics.repository.js';
import type {
  EventReportRow,
  PerformerReportRow,
  ReportsResult,
} from '@/services/ticketing/typedefs/analytics.typedefs.js';

const DEFAULT_RANGE_DAYS = 30;
const TOP_LIMIT = 10;

export class AnalyticsService {
  protected readonly repository = new AnalyticsRepository();

  async report(from?: Date, to?: Date): Promise<ReportsResult> {
    const end = to ?? new Date();
    const start =
      from ?? new Date(end.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

    const [totals, eventRows, performerRows] = await Promise.all([
      this.repository.totals(start, end),
      this.repository.eventRows(start, end, TOP_LIMIT),
      this.repository.performerRows(start, end, TOP_LIMIT),
    ]);

    const capacity = await this.repository.eventCapacity(eventRows.map((row) => row.id));
    const capacityByEvent = new Map(capacity.map((row) => [row.eventId, row]));

    const byEvent: EventReportRow[] = eventRows.map((row) => {
      const tiers = capacityByEvent.get(row.id);
      const capacityQty = Number(tiers?.capacity ?? 0);
      const soldQty = Number(tiers?.soldQty ?? 0);

      return {
        id: row.id,
        title: row.title,
        performerName: row.performerName,
        startsAt: row.startsAt.toISOString(),
        status: row.status,
        ticketsSold: Number(row.ticketsSold),
        revenueCents: Number(row.revenueCents ?? 0),
        capacity: capacityQty,
        soldQty,
        occupancyPct: capacityQty === 0 ? 0 : Math.round((soldQty / capacityQty) * 100),
      };
    });

    const byPerformer: PerformerReportRow[] = performerRows.map((row) => ({
      performerId: row.performerId,
      performerName: row.performerName,
      events: Number(row.events),
      ticketsSold: Number(row.ticketsSold),
      revenueCents: Number(row.revenueCents ?? 0),
    }));

    return {
      range: { from: start.toISOString(), to: end.toISOString() },
      totals,
      byEvent,
      byPerformer,
    };
  }
}
