import { httpCall } from '@/shared/load/http.js';
import {
  newCustomer,
  newIdempotencyKey,
  type ScenarioContext,
  type ScenarioResult,
} from '@/scripts/scenarios/context.js';

interface TierState {
  availableQty: number;
  soldQty: number;
  heldQty: number;
}

export async function surge(ctx: ScenarioContext): Promise<ScenarioResult> {
  const { options, token } = ctx;
  const startedAt = Date.now();

  const performers = await httpCall(options.catalogUrl, 'GET', '/api/performers?limit=1', { token });
  const venues = await httpCall(options.catalogUrl, 'GET', '/api/venues?limit=1', { token });

  const performer = (performers.body as { data?: { id: string }[] } | null)?.data?.[0];
  const venue = (venues.body as { data?: { id: string }[] } | null)?.data?.[0];

  if (!performer || !venue) {
    throw new Error('Catalog is empty. Run: npm run seed:catalog -- --reset');
  }

  const created = await httpCall(options.ticketingUrl, 'POST', '/api/events', {
    token,
    body: {
      title: `Surge ${new Date().toISOString()}`,
      performerId: performer.id,
      venueId: venue.id,
      startsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      durationMinutes: 90,
    },
  });
  const eventId = (created.body as { data: { id: string } }).data.id;

  await httpCall(options.ticketingUrl, 'PATCH', `/api/events/${eventId}`, {
    token,
    body: { status: 'scheduled' },
  });
  await httpCall(options.ticketingUrl, 'PATCH', `/api/events/${eventId}`, {
    token,
    body: { status: 'on_sale' },
  });

  const tier = await httpCall(options.ticketingUrl, 'POST', `/api/events/${eventId}/tiers`, {
    token,
    body: { name: 'GA', priceCents: 5000, totalQty: options.seats },
  });
  const tierId = (tier.body as { data: { id: string } }).data.id;

  const attempts = await Promise.all(
    Array.from({ length: options.buyers }, async () => {
      const hold = await httpCall(options.ticketingUrl, 'POST', '/api/holds', {
        token,
        body: { tierId, quantity: 1, customerRef: newCustomer() },
      });

      if (hold.status !== 201) {
        return { outcome: hold.status === 0 ? 'network_error' : `hold_${hold.status}`, ms: hold.ms };
      }

      const holdId = (hold.body as { data: { id: string } }).data.id;
      const buy = await httpCall(options.ticketingUrl, 'POST', '/api/purchases', {
        token,
        body: {
          holdId,
          idempotencyKey: newIdempotencyKey(),
          customerEmail: 'surge@example.com',
        },
      });

      return {
        outcome: buy.status === 201 ? 'ok' : buy.status === 0 ? 'network_error' : `purchase_${buy.status}`,
        ms: hold.ms + buy.ms,
      };
    }),
  );

  const tiers = await httpCall(options.ticketingUrl, 'GET', `/api/events/${eventId}/tiers`, { token });
  const state = (tiers.body as { data: TierState[] }).data[0];

  const ok = attempts.filter((attempt) => attempt.outcome === 'ok').length;
  const rejected = attempts.filter((attempt) => attempt.outcome.startsWith('hold_')).length;
  const expectedOk = Math.min(options.buyers, options.seats);
  const expectedRejected = options.buyers - expectedOk;

  const pass =
    ok === expectedOk &&
    rejected === expectedRejected &&
    state !== undefined &&
    state.soldQty === expectedOk &&
    state.availableQty === options.seats - expectedOk &&
    state.heldQty === 0;

  return {
    attempts,
    notes: [
      `event: ${eventId}`,
      `seats: ${options.seats}, buyers: ${options.buyers}`,
      `expected ${expectedOk} ok / ${expectedRejected} rejected, got ${ok} / ${rejected}`,
      `tier after: available=${state?.availableQty} sold=${state?.soldQty} held=${state?.heldQty}`,
      `wall clock: ${Date.now() - startedAt} ms`,
    ],
    pass,
  };
}
