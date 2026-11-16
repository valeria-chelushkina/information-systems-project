import { describe, expect, it } from 'vitest';
import { formatTicketEmail } from '@/services/notify/modules/notifications/notifications.email.js';
import type { PurchaseCompletedEvent } from '@/shared/messaging/purchase-event.typedefs.js';

const event: PurchaseCompletedEvent = {
  id: '55555555-5555-4555-8555-555555555555',
  type: 'purchase.completed',
  occurredAt: '2026-11-10T10:00:00.000Z',
  orderId: '11111111-1111-4111-8111-111111111111',
  customerEmail: 'buyer@example.com',
  totalCents: 9000,
  currency: 'USD',
  event: {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'After the Rain',
    performerName: 'Neon Harbor',
    venueName: 'Tokyo Dome',
    startsAt: '2026-11-17T12:35:34.053Z',
  },
  tickets: [
    { id: '44444444-4444-4444-8444-444444444444', code: 'a1b2c3d4e5f60718', tierName: 'Floor GA' },
    { id: '66666666-6666-4666-8666-666666666666', code: '0f1e2d3c4b5a6978', tierName: 'Floor GA' },
  ],
};

describe('ticket email formatting', () => {
  it('includes the event, total and every entry code', () => {
    const email = formatTicketEmail(event, 'http://localhost:3008');

    expect(email.subject).toBe('Your tickets: After the Rain');
    expect(email.text).toContain('Event: After the Rain');
    expect(email.text).toContain('Venue: Tokyo Dome');
    expect(email.text).toContain('Total: USD 90.00');
    expect(email.text).toContain('code a1b2c3d4e5f60718');
    expect(email.text).toContain('code 0f1e2d3c4b5a6978');
    expect(email.text).toContain('2 tickets are');
    expect(email.text).toContain('http://localhost:3008/orders/11111111-1111-4111-8111-111111111111');
    expect(email.html).toContain('a1b2c3d4e5f60718');
  });

  it('escapes user-supplied text in the html body', () => {
    const email = formatTicketEmail(
      { ...event, event: { ...event.event, title: '<script>alert(1)</script>' } },
      'http://localhost:3008',
    );

    expect(email.html).not.toContain('<script>alert(1)</script>');
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
