import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  repository: {
    findByQrToken: vi.fn(),
    findByQrTokenPrefix: vi.fn(),
    findByIdPrefix: vi.fn(),
    checkIn: vi.fn(),
    findEvent: vi.fn(),
  },
}));

vi.mock('@/services/ticketing/modules/check-in/check-in.repository.js', () => ({
  CheckInRepository: function () {
    return mocks.repository;
  },
}));

import { CheckInService } from '@/services/ticketing/modules/check-in/check-in.service.js';

function ticket(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'ticket-1',
    orderId: 'order-1',
    eventId: 'event-1',
    tierId: 'tier-1',
    customerRef: 'customer-1',
    unitPriceCents: 5000,
    status: 'issued',
    qrToken: 'a'.repeat(32),
    checkedInAt: null,
    issuedAt: new Date('2026-11-01T10:00:00Z'),
    ...overrides,
  };
}

function event(): Record<string, unknown> {
  return {
    id: 'event-1',
    title: 'Night Session',
    startsAt: new Date('2026-12-01T19:00:00Z'),
    venueName: 'Stereo Plaza',
  };
}

describe('CheckInService', () => {
  const service = new CheckInService();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repository.findByQrTokenPrefix.mockResolvedValue([]);
    mocks.repository.findByIdPrefix.mockResolvedValue([]);
  });

  it('admits an issued ticket and returns the event', async () => {
    mocks.repository.findByQrToken.mockResolvedValue(ticket());
    mocks.repository.checkIn.mockResolvedValue(ticket({ status: 'checked_in', checkedInAt: new Date() }));
    mocks.repository.findEvent.mockResolvedValue(event());

    const result = await service.checkIn('a'.repeat(32));

    expect(mocks.repository.checkIn).toHaveBeenCalledWith('ticket-1');
    expect(result.ticket.status).toBe('checked_in');
    expect(result.event.title).toBe('Night Session');
  });

  it('rejects an unknown code', async () => {
    mocks.repository.findByQrToken.mockResolvedValue(null);

    await expect(service.checkIn('b'.repeat(32))).rejects.toMatchObject({
      status: 404,
      code: 'ticket_not_found',
    });
  });

  it('resolves the short code printed on the ticket', async () => {
    mocks.repository.findByQrToken.mockResolvedValue(null);
    mocks.repository.findByIdPrefix.mockResolvedValue([ticket()]);
    mocks.repository.checkIn.mockResolvedValue(
      ticket({ status: 'checked_in', checkedInAt: new Date() }),
    );
    mocks.repository.findEvent.mockResolvedValue(event());

    const result = await service.checkIn('3035BC69');

    expect(mocks.repository.findByIdPrefix).toHaveBeenCalledWith('3035bc69');
    expect(result.ticket.status).toBe('checked_in');
  });

  it('rejects an ambiguous short code', async () => {
    mocks.repository.findByQrToken.mockResolvedValue(null);
    mocks.repository.findByIdPrefix.mockResolvedValue([
      ticket(),
      ticket({ id: 'ticket-2' }),
    ]);

    await expect(service.checkIn('3035bc69')).rejects.toMatchObject({
      status: 409,
      code: 'ticket_code_ambiguous',
    });
  });

  it('rejects a ticket that was already used', async () => {
    const checkedInAt = new Date('2026-12-01T18:55:00Z');

    mocks.repository.findByQrToken.mockResolvedValue(
      ticket({ status: 'checked_in', checkedInAt }),
    );

    await expect(service.checkIn('a'.repeat(32))).rejects.toMatchObject({
      status: 409,
      code: 'ticket_already_checked_in',
      details: { checkedInAt: checkedInAt.toISOString() },
    });
    expect(mocks.repository.checkIn).not.toHaveBeenCalled();
  });

  it('rejects a refunded ticket', async () => {
    mocks.repository.findByQrToken.mockResolvedValue(ticket({ status: 'refunded' }));

    await expect(service.checkIn('a'.repeat(32))).rejects.toMatchObject({
      status: 409,
      code: 'ticket_not_admitted',
    });
  });

  it('reports the current state when two scanners race', async () => {
    mocks.repository.findByQrToken
      .mockResolvedValueOnce(ticket())
      .mockResolvedValueOnce(ticket({ status: 'checked_in', checkedInAt: new Date() }));
    mocks.repository.checkIn.mockResolvedValue(null);

    await expect(service.checkIn('a'.repeat(32))).rejects.toMatchObject({
      status: 409,
      code: 'ticket_already_checked_in',
    });
  });
});
