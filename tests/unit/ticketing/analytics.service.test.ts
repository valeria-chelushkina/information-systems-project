import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  repository: {
    totals: vi.fn(),
    eventRows: vi.fn(),
    eventCapacity: vi.fn(),
    performerRows: vi.fn(),
  },
}));

vi.mock('@/services/ticketing/modules/analytics/analytics.repository.js', () => ({
  AnalyticsRepository: function () {
    return mocks.repository;
  },
}));

import { AnalyticsService } from '@/services/ticketing/modules/analytics/analytics.service.js';

describe('AnalyticsService', () => {
  const service = new AnalyticsService();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repository.eventCapacity.mockResolvedValue([]);
    mocks.repository.performerRows.mockResolvedValue([]);
  });

  it('combines revenue, occupancy and refunds for the range', async () => {
    mocks.repository.totals.mockResolvedValue({
      revenueCents: 15000,
      refundedCents: 2500,
      orders: 3,
      ticketsSold: 3,
      ticketsCheckedIn: 1,
    });
    mocks.repository.eventRows.mockResolvedValue([
      {
        id: 'event-1',
        title: 'Night Session',
        performerName: 'Neon Harbor',
        startsAt: new Date('2026-12-01T19:00:00Z'),
        status: 'on_sale',
        ticketsSold: '3',
        revenueCents: '15000',
      },
    ]);
    mocks.repository.eventCapacity.mockResolvedValue([
      { eventId: 'event-1', capacity: '10', soldQty: '4' },
    ]);
    mocks.repository.performerRows.mockResolvedValue([
      {
        performerId: 'performer-1',
        performerName: 'Neon Harbor',
        events: '1',
        ticketsSold: '3',
        revenueCents: '15000',
      },
    ]);

    const report = await service.report(
      new Date('2026-11-01T00:00:00Z'),
      new Date('2026-11-30T23:59:59Z'),
    );

    expect(report.totals.revenueCents).toBe(15000);
    expect(report.byEvent[0]).toMatchObject({
      ticketsSold: 3,
      revenueCents: 15000,
      capacity: 10,
      soldQty: 4,
      occupancyPct: 40,
    });
    expect(report.byPerformer[0]?.events).toBe(1);
  });

  it('defaults to the last 30 days', async () => {
    mocks.repository.totals.mockResolvedValue({
      revenueCents: 0,
      refundedCents: 0,
      orders: 0,
      ticketsSold: 0,
      ticketsCheckedIn: 0,
    });
    mocks.repository.eventRows.mockResolvedValue([]);

    const report = await service.report();
    const span = new Date(report.range.to).getTime() - new Date(report.range.from).getTime();

    expect(Math.round(span / (24 * 60 * 60 * 1000))).toBe(30);
  });
});
