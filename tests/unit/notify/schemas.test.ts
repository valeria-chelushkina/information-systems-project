import { describe, expect, it } from 'vitest';
import { alertSchema, notificationSchema } from '@/services/notify/modules/alerts/alerts.schemas.js';
import { purchaseCompletedSchema } from '@/services/notify/modules/notifications/notifications.schemas.js';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const TIER_ID = '33333333-3333-4333-8333-333333333333';
const TICKET_ID = '44444444-4444-4444-8444-444444444444';

describe('purchase.completed schema', () => {
  const event = {
    id: '55555555-5555-4555-8555-555555555555',
    type: 'purchase.completed',
    occurredAt: '2026-11-10T10:00:00.000Z',
    orderId: ORDER_ID,
    showId: EVENT_ID,
    tierId: TIER_ID,
    quantity: 1,
    amountCents: 4500,
    currency: 'USD',
    customerEmail: 'buyer@example.com',
    ticketIds: [TICKET_ID],
  };

  it('accepts a valid purchase event', () => {
    expect(purchaseCompletedSchema.parse(event)).toMatchObject({
      type: 'purchase.completed',
      orderId: ORDER_ID,
      quantity: 1,
    });
  });

  it('rejects an unknown event type', () => {
    expect(() => purchaseCompletedSchema.parse({ ...event, type: 'purchase.failed' })).toThrow();
  });

  it('rejects an event without tickets', () => {
    expect(() => purchaseCompletedSchema.parse({ ...event, ticketIds: [] })).toThrow();
  });

  it('rejects a non-uuid order id', () => {
    expect(() => purchaseCompletedSchema.parse({ ...event, orderId: 'order-1' })).toThrow();
  });
});

describe('Alertmanager webhook schema', () => {
  it('accepts a firing alert', () => {
    const alert = alertSchema.parse({
      status: 'firing',
      labels: { alertname: 'ServiceError', severity: 'critical' },
      annotations: { summary: '5xx responses' },
    });

    expect(alert.status).toBe('firing');
  });

  it('accepts a resolved alert without annotations', () => {
    const alert = alertSchema.parse({
      status: 'resolved',
      labels: { alertname: 'ServiceError' },
    });

    expect(alert.annotations).toEqual({});
  });

  it('rejects an unknown alert status', () => {
    expect(() =>
      alertSchema.parse({ status: 'pending', labels: { alertname: 'X' } }),
    ).toThrow();
  });

  it('accepts a webhook notification with several alerts', () => {
    const notification = notificationSchema.parse({
      alerts: [
        { status: 'firing', labels: { alertname: 'A' } },
        { status: 'resolved', labels: { alertname: 'B' } },
      ],
    });

    expect(notification.alerts).toHaveLength(2);
  });
});
