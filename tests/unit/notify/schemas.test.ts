import { describe, expect, it } from 'vitest';
import { alertSchema, notificationSchema } from '@/services/notify/modules/alerts/alerts.schemas.js';
import { purchaseCompletedSchema } from '@/services/notify/modules/notifications/notifications.schemas.js';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const TICKET_ID = '44444444-4444-4444-8444-444444444444';

describe('purchase.completed schema', () => {
  const event = {
    id: '55555555-5555-4555-8555-555555555555',
    type: 'purchase.completed',
    occurredAt: '2026-11-10T10:00:00.000Z',
    orderId: ORDER_ID,
    customerEmail: 'buyer@example.com',
    totalCents: 4500,
    currency: 'USD',
    event: {
      id: EVENT_ID,
      title: 'After the Rain',
      performerName: 'After the Rain',
      venueName: 'Tokyo Dome',
      startsAt: '2026-11-17T12:35:34.053Z',
    },
    tickets: [
      {
        id: TICKET_ID,
        code: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        tierName: 'Floor GA',
      },
    ],
  };

  it('accepts a valid purchase event', () => {
    expect(purchaseCompletedSchema.parse(event)).toMatchObject({
      type: 'purchase.completed',
      orderId: ORDER_ID,
      totalCents: 4500,
      event: { title: 'After the Rain' },
    });
  });

  it('rejects an unknown event type', () => {
    expect(() => purchaseCompletedSchema.parse({ ...event, type: 'purchase.failed' })).toThrow();
  });

  it('rejects an event without tickets', () => {
    expect(() => purchaseCompletedSchema.parse({ ...event, tickets: [] })).toThrow();
  });

  it('rejects a ticket without an entry code', () => {
    expect(() =>
      purchaseCompletedSchema.parse({
        ...event,
        tickets: [{ ...event.tickets[0], code: '' }],
      }),
    ).toThrow();
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
