import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  repository: {
    findById: vi.fn(),
    insertOne: vi.fn(),
    updateById: vi.fn(),
    deleteById: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  catalog: {
    getPerformer: vi.fn(),
    getVenue: vi.fn(),
  },
}));

vi.mock('@/services/ticketing/modules/events/events.repository.js', () => ({
  EventsRepository: function () {
    return mocks.repository;
  },
}));

vi.mock('@/services/ticketing/clients/catalog.client.js', () => ({
  CatalogClient: function () {
    return mocks.catalog;
  },
}));

import { EventsService } from '@/services/ticketing/modules/events/events.service.js';

function event(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'event-1',
    performerId: 'performer-1',
    performerName: 'Neon Harbor',
    venueId: 'venue-1',
    venueName: 'Stereo Plaza',
    title: 'Night Session',
    startsAt: new Date('2027-04-10T18:00:00Z'),
    doorsAt: null,
    durationMinutes: 120,
    status: 'draft',
    onSaleAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('EventsService', () => {
  const service = new EventsService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an event and snapshots catalog names', async () => {
    mocks.catalog.getPerformer.mockResolvedValue({ id: 'performer-1', name: 'Neon Harbor' });
    mocks.catalog.getVenue.mockResolvedValue({ id: 'venue-1', name: 'Stereo Plaza' });
    mocks.repository.insertOne.mockResolvedValue(event());

    const startsAt = new Date('2027-04-10T18:00:00Z');
    await service.createEvent(
      {
        title: 'Night Session',
        performerId: 'performer-1',
        venueId: 'venue-1',
        startsAt,
        durationMinutes: 120,
      },
      'token',
      'request-1',
    );

    expect(mocks.repository.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Night Session',
        performerId: 'performer-1',
        performerName: 'Neon Harbor',
        venueId: 'venue-1',
        venueName: 'Stereo Plaza',
        status: 'draft',
      }),
    );
  });

  it('rejects doors that are not before the start', async () => {
    const startsAt = new Date('2027-04-10T18:00:00Z');

    await expect(
      service.createEvent(
        {
          title: 'Late doors',
          performerId: 'performer-1',
          venueId: 'venue-1',
          startsAt,
          doorsAt: startsAt,
        },
        'token',
      ),
    ).rejects.toMatchObject({ status: 400, code: 'invalid_schedule' });

    expect(mocks.catalog.getPerformer).not.toHaveBeenCalled();
  });

  it('allows a valid status transition', async () => {
    mocks.repository.findById.mockResolvedValue(event({ status: 'draft' }));
    mocks.repository.updateById.mockResolvedValue(event({ status: 'scheduled' }));

    const updated = await service.updateEvent('event-1', { status: 'scheduled' }, 'token');

    expect(updated).toMatchObject({ status: 'scheduled' });
    expect(mocks.repository.updateById).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({ status: 'scheduled' }),
    );
  });

  it('rejects an invalid status transition', async () => {
    mocks.repository.findById.mockResolvedValue(event({ status: 'draft' }));

    await expect(
      service.updateEvent('event-1', { status: 'completed' }, 'token'),
    ).rejects.toMatchObject({ status: 409, code: 'invalid_status_transition' });

    expect(mocks.repository.updateById).not.toHaveBeenCalled();
  });

  it('does not delete an event that has sales', async () => {
    mocks.repository.findById.mockResolvedValue(event({ status: 'on_sale' }));

    await expect(service.deleteEvent('event-1')).rejects.toMatchObject({
      status: 409,
      code: 'event_has_sales',
    });

    expect(mocks.repository.deleteById).not.toHaveBeenCalled();
  });
});
