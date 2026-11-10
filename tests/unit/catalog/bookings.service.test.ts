import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  repository: {
    insertOne: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    decide: vi.fn(),
  },
  performers: {
    getPerformerById: vi.fn(),
  },
  venues: {
    getVenueById: vi.fn(),
  },
}));

vi.mock('@/services/catalog/modules/bookings/bookings.repository.js', () => ({
  BookingsRepository: function () {
    return mocks.repository;
  },
}));

vi.mock('@/services/catalog/modules/performers/performers.service.js', () => ({
  PerformersService: function () {
    return mocks.performers;
  },
}));

vi.mock('@/services/catalog/modules/venues/venues.service.js', () => ({
  VenuesService: function () {
    return mocks.venues;
  },
}));

import { BookingsService } from '@/services/catalog/modules/bookings/bookings.service.js';
import { mapDatabaseError } from '@/shared/errors/database-error.js';

function booking(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'booking-1',
    performerId: 'performer-1',
    venueId: 'venue-1',
    startsAt: new Date('2027-04-10T18:00:00Z'),
    endsAt: new Date('2027-04-10T22:00:00Z'),
    status: 'requested',
    requestedBy: null,
    decidedBy: null,
    decidedAt: null,
    note: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('BookingsService', () => {
  const service = new BookingsService();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.performers.getPerformerById.mockResolvedValue({ id: 'performer-1' });
    mocks.venues.getVenueById.mockResolvedValue({ id: 'venue-1' });
  });

  it('rejects a booking whose end is not after its start', async () => {
    const startsAt = new Date('2027-04-10T18:00:00Z');

    await expect(
      service.createBooking({
        performerId: 'performer-1',
        venueId: 'venue-1',
        startsAt,
        endsAt: startsAt,
      }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid_period' });

    expect(mocks.repository.insertOne).not.toHaveBeenCalled();
  });

  it('creates a requested booking', async () => {
    mocks.repository.insertOne.mockResolvedValue(booking());

    const created = await service.createBooking({
      performerId: 'performer-1',
      venueId: 'venue-1',
      startsAt: new Date('2027-04-10T18:00:00Z'),
      endsAt: new Date('2027-04-10T22:00:00Z'),
    });

    expect(created).toMatchObject({ status: 'requested' });
    expect(mocks.repository.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'requested', performerId: 'performer-1' }),
    );
  });

  it('propagates the overlap error and maps it to booking_conflict', async () => {
    mocks.repository.decide.mockRejectedValue({ code: '23P01' });

    await expect(
      service.decideBooking('booking-1', { status: 'confirmed' }),
    ).rejects.toMatchObject({ code: '23P01' });

    expect(mapDatabaseError({ code: '23P01' })).toMatchObject({
      status: 409,
      code: 'booking_conflict',
    });
  });

  it('rejects deciding a booking that is no longer pending', async () => {
    mocks.repository.decide.mockResolvedValue(null);
    mocks.repository.findById.mockResolvedValue(booking({ status: 'confirmed' }));

    await expect(
      service.decideBooking('booking-1', { status: 'confirmed' }),
    ).rejects.toMatchObject({ status: 409, code: 'booking_not_pending' });
  });

  it('confirms a requested booking', async () => {
    mocks.repository.decide.mockResolvedValue(booking({ status: 'confirmed' }));

    const decided = await service.decideBooking('booking-1', {
      status: 'confirmed',
      decidedBy: 'staff-1',
    });

    expect(decided).toMatchObject({ status: 'confirmed' });
    expect(mocks.repository.decide).toHaveBeenCalledWith(
      'booking-1',
      'confirmed',
      'staff-1',
    );
  });
});
