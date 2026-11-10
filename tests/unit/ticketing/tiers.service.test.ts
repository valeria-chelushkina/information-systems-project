import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  repository: {
    insertOne: vi.fn(),
    findById: vi.fn(),
    findByEventId: vi.fn(),
    updateById: vi.fn(),
    deleteById: vi.fn(),
  },
  events: {
    getEventById: vi.fn(),
  },
}));

vi.mock('@/services/ticketing/modules/tiers/tiers.repository.js', () => ({
  TiersRepository: function () {
    return mocks.repository;
  },
}));

vi.mock('@/services/ticketing/modules/events/events.service.js', () => ({
  EventsService: function () {
    return mocks.events;
  },
}));

import { TiersService } from '@/services/ticketing/modules/tiers/tiers.service.js';

function tier(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'tier-1',
    eventId: 'event-1',
    name: 'GA',
    priceCents: 4500,
    totalQty: 100,
    availableQty: 80,
    soldQty: 10,
    heldQty: 10,
    ...overrides,
  };
}

describe('TiersService', () => {
  const service = new TiersService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a tier with all seats available', async () => {
    mocks.events.getEventById.mockResolvedValue({ id: 'event-1' });
    mocks.repository.insertOne.mockImplementation((values: Record<string, unknown>) => values);

    const created = await service.createTier('event-1', {
      name: 'GA',
      priceCents: 4500,
      totalQty: 100,
    });

    expect(created).toMatchObject({ totalQty: 100, availableQty: 100, soldQty: 0, heldQty: 0 });
  });

  it('increases available seats when total quantity grows', async () => {
    mocks.repository.findById.mockResolvedValue(tier());
    mocks.repository.updateById.mockResolvedValue(tier({ totalQty: 120, availableQty: 100 }));

    await service.updateTier('tier-1', { totalQty: 120 });

    expect(mocks.repository.updateById).toHaveBeenCalledWith('tier-1', {
      totalQty: 120,
      availableQty: 100,
    });
  });

  it('rejects reducing total quantity below sold and held seats', async () => {
    mocks.repository.findById.mockResolvedValue(tier({ availableQty: 0 }));

    await expect(service.updateTier('tier-1', { totalQty: 10 })).rejects.toMatchObject({
      status: 409,
      code: 'insufficient_inventory',
    });

    expect(mocks.repository.updateById).not.toHaveBeenCalled();
  });

  it('returns the tier unchanged when there is nothing to update', async () => {
    const existing = tier();
    mocks.repository.findById.mockResolvedValue(existing);

    const updated = await service.updateTier('tier-1', { totalQty: 100 });

    expect(updated).toBe(existing);
    expect(mocks.repository.updateById).not.toHaveBeenCalled();
  });

  it('rejects deleting a tier with sold or held seats', async () => {
    mocks.repository.findById.mockResolvedValue(tier({ soldQty: 1 }));

    await expect(service.deleteTier('tier-1')).rejects.toMatchObject({
      status: 409,
      code: 'price_tier_in_use',
    });

    expect(mocks.repository.deleteById).not.toHaveBeenCalled();
  });
});
