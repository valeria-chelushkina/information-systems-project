import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(async (_name: string, run: (tx: unknown) => Promise<unknown>) => run({})),
  holds: {
    insertOne: vi.fn(),
    lockById: vi.fn(),
    updateStatus: vi.fn(),
    findExpired: vi.fn(),
  },
  orders: {
    findByIdempotencyKey: vi.fn(),
    insertOne: vi.fn(),
    lockById: vi.fn(),
    updateStatus: vi.fn(),
  },
  tickets: {
    insertMany: vi.fn(),
    findByOrderId: vi.fn(),
    updateStatusByOrderId: vi.fn(),
  },
  payments: {
    insertOne: vi.fn(),
    updateStatusByOrderId: vi.fn(),
  },
  refunds: {
    insertOne: vi.fn(),
  },
  tiers: {
    findById: vi.fn(),
    reserve: vi.fn(),
    sellFromHold: vi.fn(),
    release: vi.fn(),
    restoreSold: vi.fn(),
    remainingInventory: vi.fn(),
  },
  events: {
    findById: vi.fn(),
    updateById: vi.fn(),
  },
  publisher: {
    publish: vi.fn(),
  },
}));

vi.mock('@/shared/db/transaction.js', () => ({
  transaction: mocks.transaction,
}));

vi.mock('@/services/ticketing/modules/purchases/holds.repository.js', () => ({
  HoldsRepository: function () {
    return mocks.holds;
  },
}));

vi.mock('@/services/ticketing/modules/purchases/orders.repository.js', () => ({
  OrdersRepository: function () {
    return mocks.orders;
  },
}));

vi.mock('@/services/ticketing/modules/purchases/tickets.repository.js', () => ({
  TicketsRepository: function () {
    return mocks.tickets;
  },
}));

vi.mock('@/services/ticketing/modules/purchases/payments.repository.js', () => ({
  PaymentsRepository: function () {
    return mocks.payments;
  },
}));

vi.mock('@/services/ticketing/modules/purchases/refunds.repository.js', () => ({
  RefundsRepository: function () {
    return mocks.refunds;
  },
}));

vi.mock('@/services/ticketing/modules/tiers/tiers.repository.js', () => ({
  TiersRepository: function () {
    return mocks.tiers;
  },
}));

vi.mock('@/services/ticketing/modules/events/events.repository.js', () => ({
  EventsRepository: function () {
    return mocks.events;
  },
}));

vi.mock('@/services/ticketing/messaging/purchase.publisher.js', () => ({
  PurchasePublisher: function () {
    return mocks.publisher;
  },
}));

import { PurchasesService } from '@/services/ticketing/modules/purchases/purchases.service.js';

function hold(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'hold-1',
    eventId: 'event-1',
    tierId: 'tier-1',
    customerRef: 'customer-1',
    quantity: 2,
    unitPriceCents: 5000,
    status: 'active',
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    ...overrides,
  };
}

function order(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'order-1',
    customerRef: 'customer-1',
    customerEmail: 'buyer@example.com',
    holdId: 'hold-1',
    status: 'paid',
    totalCents: 10000,
    idempotencyKey: 'idempotency-1',
    createdAt: new Date(),
    ...overrides,
  };
}

function ticket(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'ticket-1',
    orderId: 'order-1',
    eventId: 'event-1',
    tierId: 'tier-1',
    customerRef: 'customer-1',
    unitPriceCents: 5000,
    status: 'issued',
    issuedAt: new Date(),
    ...overrides,
  };
}

describe('PurchasesService', () => {
  const service = new PurchasesService();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (_name: string, run: (tx: unknown) => Promise<unknown>) =>
      run({}),
    );
  });

  it('rejects a hold when the event is not on sale', async () => {
    mocks.tiers.findById.mockResolvedValue({ id: 'tier-1', eventId: 'event-1', priceCents: 5000 });
    mocks.events.findById.mockResolvedValue({ id: 'event-1', status: 'scheduled' });

    await expect(
      service.createHold({ tierId: 'tier-1', quantity: 1, customerRef: 'customer-1' }),
    ).rejects.toMatchObject({ status: 409, code: 'event_not_on_sale' });

    expect(mocks.holds.insertOne).not.toHaveBeenCalled();
  });

  it('rejects a hold when inventory is insufficient', async () => {
    mocks.tiers.findById.mockResolvedValue({ id: 'tier-1', eventId: 'event-1', priceCents: 5000 });
    mocks.events.findById.mockResolvedValue({ id: 'event-1', status: 'on_sale' });
    mocks.tiers.reserve.mockResolvedValue(null);

    await expect(
      service.createHold({ tierId: 'tier-1', quantity: 1, customerRef: 'customer-1' }),
    ).rejects.toMatchObject({ status: 409, code: 'insufficient_inventory' });
  });

  it('creates a hold when seats are available', async () => {
    mocks.tiers.findById.mockResolvedValue({ id: 'tier-1', eventId: 'event-1', priceCents: 5000 });
    mocks.events.findById.mockResolvedValue({ id: 'event-1', status: 'on_sale' });
    mocks.tiers.reserve.mockResolvedValue({ id: 'tier-1' });
    mocks.holds.insertOne.mockResolvedValue(hold());

    const created = await service.createHold({
      tierId: 'tier-1',
      quantity: 2,
      customerRef: 'customer-1',
    });

    expect(created).toMatchObject({ id: 'hold-1', status: 'active' });
    expect(mocks.holds.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ tierId: 'tier-1', quantity: 2, unitPriceCents: 5000 }),
      expect.anything(),
    );
  });

  it('returns the original order for a replayed idempotency key', async () => {
    mocks.orders.findByIdempotencyKey.mockResolvedValue(order());
    mocks.tickets.findByOrderId.mockResolvedValue([ticket()]);

    const result = await service.purchase({
      holdId: 'hold-1',
      idempotencyKey: 'idempotency-1',
      customerEmail: 'buyer@example.com',
    });

    expect(result.created).toBe(false);
    expect(result.order).toMatchObject({ id: 'order-1' });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('converts a hold into an order, tickets and payment', async () => {
    const issued = [ticket(), ticket({ id: 'ticket-2' })];
    const createdOrder = order();

    mocks.orders.findByIdempotencyKey.mockResolvedValue(null);
    mocks.holds.lockById.mockResolvedValue(hold());
    mocks.tiers.sellFromHold.mockResolvedValue({ id: 'tier-1' });
    mocks.orders.insertOne.mockResolvedValue(createdOrder);
    mocks.tickets.insertMany.mockResolvedValue(issued);
    mocks.payments.insertOne.mockResolvedValue({ id: 'payment-1' });
    mocks.holds.updateStatus.mockResolvedValue(1);
    mocks.tiers.remainingInventory.mockResolvedValue(10);

    const result = await service.purchase({
      holdId: 'hold-1',
      idempotencyKey: 'idempotency-1',
      customerEmail: 'buyer@example.com',
    });

    expect(result.created).toBe(true);
    expect(result.order).toMatchObject({ id: 'order-1', totalCents: 10000 });
    expect(result.tickets).toHaveLength(2);
    expect(mocks.tiers.sellFromHold).toHaveBeenCalledWith('tier-1', 2, expect.anything());
    expect(mocks.payments.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 10000, status: 'captured' }),
      expect.anything(),
    );
    expect(mocks.publisher.publish).toHaveBeenCalledWith(result);
  });

  it('rejects a refund for an order that is not paid', async () => {
    mocks.orders.lockById.mockResolvedValue(order({ status: 'refunded' }));

    await expect(service.refundOrder('order-1', {})).rejects.toMatchObject({
      status: 409,
      code: 'order_not_refundable',
    });

    expect(mocks.refunds.insertOne).not.toHaveBeenCalled();
  });

  it('refunds a paid order and restores inventory', async () => {
    const refundedOrder = order({ status: 'refunded' });
    const issued = [ticket(), ticket({ id: 'ticket-2' })];

    mocks.orders.lockById.mockResolvedValue(order());
    mocks.tickets.findByOrderId.mockResolvedValue(issued);
    mocks.tiers.restoreSold.mockResolvedValue({ id: 'tier-1' });
    mocks.tickets.updateStatusByOrderId.mockResolvedValue(2);
    mocks.payments.updateStatusByOrderId.mockResolvedValue(1);
    mocks.refunds.insertOne.mockResolvedValue({
      id: 'refund-1',
      orderId: 'order-1',
      amountCents: 10000,
      status: 'completed',
    });
    mocks.orders.updateStatus.mockResolvedValue(refundedOrder);
    mocks.events.findById.mockResolvedValue({ id: 'event-1', status: 'on_sale' });

    const result = await service.refundOrder('order-1', { reason: 'test' });

    expect(result.order).toMatchObject({ status: 'refunded' });
    expect(result.refund).toMatchObject({ amountCents: 10000 });
    expect(mocks.tiers.restoreSold).toHaveBeenCalledWith('tier-1', 2, expect.anything());
    expect(mocks.tickets.updateStatusByOrderId).toHaveBeenCalledWith(
      'order-1',
      'refunded',
      expect.anything(),
    );
  });
});
