import { randomUUID } from 'node:crypto';
import { httpCall, sleep } from '@/shared/load/http.js';
import {
  newCustomer,
  newIdempotencyKey,
  type Attempt,
  type ScenarioContext,
  type ScenarioResult,
} from '@/scripts/scenarios/context.js';

interface Entity {
  id: string;
}

interface ActiveEvent {
  eventId: string;
  tierId: string;
}

interface BookingSlot {
  venueId: string;
  startsAt: Date;
  endsAt: Date;
}

interface ChaosAction {
  label: string;
  expected: number;
  run: () => Promise<{ status: number; ms: number }>;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function futureIso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function authUrl(): string {
  return process.env.AUTH_BASE_URL ?? 'http://127.0.0.1:3005';
}

export async function mixed(ctx: ScenarioContext): Promise<ScenarioResult> {
  const { options, token } = ctx;
  const deadline = Date.now() + options.duration * 1000;
  const attempts: Attempt[] = [];
  const notes: string[] = [];
  const active: ActiveEvent[] = [];
  const orders: string[] = [];

  let eventsCreated = 0;
  let bookingsConfirmed = 0;
  let purchasesOk = 0;
  let refundsOk = 0;
  let statusChanges = 0;
  let lastBooking: BookingSlot | null = null;
  let slot = 0;

  const record = (outcome: string, ms: number): void => {
    attempts.push({ outcome, ms });
  };

  const catalog = await httpCall(options.catalogUrl, 'GET', '/api/performers?limit=20', { token });
  const venues = await httpCall(options.catalogUrl, 'GET', '/api/venues?limit=20', { token });
  const performers = (catalog.body as { data?: Entity[] } | null)?.data ?? [];
  const venueRows = (venues.body as { data?: Entity[] } | null)?.data ?? [];

  if (performers.length === 0 || venueRows.length === 0) {
    throw new Error('Catalog is empty. Run: npm run seed:catalog -- --reset');
  }

  const createEvent = async (): Promise<void> => {
    const started = Date.now();
    const performer = pick(performers);
    const venue = pick(venueRows);

    const created = await httpCall(options.ticketingUrl, 'POST', '/api/events', {
      token,
      body: {
        title: `Mixed ${new Date().toISOString()} ${randomUUID().slice(0, 6)}`,
        performerId: performer.id,
        venueId: venue.id,
        startsAt: futureIso((40 + eventsCreated) * 86_400_000),
        durationMinutes: 120,
      },
    });

    if (created.status !== 201) {
      record(`event_create_${created.status}`, created.ms);
      return;
    }

    const eventId = (created.body as { data: { id: string } }).data.id;

    const scheduled = await httpCall(options.ticketingUrl, 'PATCH', `/api/events/${eventId}`, {
      token,
      body: { status: 'scheduled' },
    });

    if (scheduled.status !== 200) {
      record(`event_schedule_${scheduled.status}`, created.ms + scheduled.ms);
      return;
    }

    const tier = await httpCall(options.ticketingUrl, 'POST', `/api/events/${eventId}/tiers`, {
      token,
      body: { name: 'GA', priceCents: 5000, totalQty: 250 },
    });

    if (tier.status !== 201) {
      record(`tier_create_${tier.status}`, created.ms + scheduled.ms + tier.ms);
      return;
    }

    const tierId = (tier.body as { data: { id: string } }).data.id;

    const onSale = await httpCall(options.ticketingUrl, 'PATCH', `/api/events/${eventId}`, {
      token,
      body: { status: 'on_sale' },
    });

    if (onSale.status !== 200) {
      record(`event_on_sale_${onSale.status}`, created.ms + scheduled.ms + tier.ms + onSale.ms);
      return;
    }

    active.push({ eventId, tierId });
    eventsCreated += 1;
    statusChanges += 2;
    record('event_created', created.ms + scheduled.ms + tier.ms + onSale.ms);
  };

  const cycleEventStatus = async (): Promise<void> => {
    if (active.length === 0) {
      return;
    }

    const target = pick(active);
    const soldOut = await httpCall(options.ticketingUrl, 'PATCH', `/api/events/${target.eventId}`, {
      token,
      body: { status: 'sold_out' },
    });

    if (soldOut.status === 200) {
      statusChanges += 1;
    }

    const tiers = await httpCall(
      options.ticketingUrl,
      'GET',
      `/api/events/${target.eventId}/tiers`,
      { token },
    );
    const current = (tiers.body as { data?: { totalQty: number }[] } | null)?.data?.[0];

    if (current) {
      const restocked = await httpCall(options.ticketingUrl, 'PATCH', `/api/tiers/${target.tierId}`, {
        token,
        body: { totalQty: current.totalQty + 50 },
      });
      record(
        restocked.status === 200 ? 'tier_restocked' : `tier_restock_${restocked.status}`,
        restocked.ms,
      );
    }

    const onSale = await httpCall(options.ticketingUrl, 'PATCH', `/api/events/${target.eventId}`, {
      token,
      body: { status: 'on_sale' },
    });

    if (onSale.status === 200) {
      statusChanges += 1;
    }

    record(onSale.status === 200 ? 'event_back_on_sale' : `event_on_sale_${onSale.status}`, onSale.ms);
  };

  const cancelEvent = async (): Promise<void> => {
    if (active.length <= 2) {
      return;
    }

    const index = Math.floor(Math.random() * active.length);
    const target = active[index] as ActiveEvent;

    const cancelled = await httpCall(options.ticketingUrl, 'PATCH', `/api/events/${target.eventId}`, {
      token,
      body: { status: 'cancelled' },
    });

    if (cancelled.status === 200) {
      statusChanges += 1;
      active.splice(index, 1);
      record('event_cancelled', cancelled.ms);
      return;
    }

    record(`event_cancel_${cancelled.status}`, cancelled.ms);
  };

  const createBooking = async (): Promise<void> => {
    const venue = venueRows[slot % venueRows.length] as Entity;
    const performer = pick(performers);
    const previous = lastBooking;
    const useOverlap = slot % 8 === 7 && previous !== null;
    const startsAt =
      useOverlap && previous
        ? previous.startsAt
        : new Date(Date.now() + 120 * 86_400_000 + slot * 4 * 3_600_000);
    const endsAt =
      useOverlap && previous ? previous.endsAt : new Date(startsAt.getTime() + 2 * 3_600_000);
    const venueId = useOverlap && previous ? previous.venueId : venue.id;

    if (!useOverlap) {
      slot += 1;
      lastBooking = { venueId, startsAt, endsAt };
    }

    const created = await httpCall(options.catalogUrl, 'POST', '/api/bookings', {
      token,
      body: {
        performerId: performer.id,
        venueId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        note: 'mixed scenario',
      },
    });

    if (created.status !== 201) {
      record(`booking_create_${created.status}`, created.ms);
      return;
    }

    const bookingId = (created.body as { data: { id: string } }).data.id;
    const decision = Math.random() < 0.2 ? 'rejected' : 'confirmed';

    const decided = await httpCall(
      options.catalogUrl,
      'PATCH',
      `/api/bookings/${bookingId}`,
      { token, body: { status: decision } },
    );

    const totalMs = created.ms + decided.ms;

    if (decided.status === 200 && decision === 'confirmed') {
      bookingsConfirmed += 1;
      record('booking_confirmed', totalMs);
      return;
    }

    if (decided.status === 200) {
      record('booking_rejected', totalMs);
      return;
    }

    if (decided.status === 409) {
      record('booking_conflict', totalMs);
      return;
    }

    record(`booking_decide_${decided.status}`, totalMs);
  };

  const purchase = async (): Promise<void> => {
    if (active.length === 0) {
      return;
    }

    const target = pick(active);
    const hold = await httpCall(options.ticketingUrl, 'POST', '/api/holds', {
      token,
      body: { tierId: target.tierId, quantity: 1, customerRef: newCustomer() },
    });

    if (hold.status !== 201) {
      record(hold.status === 409 ? 'hold_conflict' : `hold_${hold.status}`, hold.ms);
      return;
    }

    const holdId = (hold.body as { data: { id: string } }).data.id;
    const bought = await httpCall(options.ticketingUrl, 'POST', '/api/purchases', {
      token,
      body: {
        holdId,
        idempotencyKey: newIdempotencyKey(),
        customerEmail: 'mixed@example.com',
      },
    });

    const totalMs = hold.ms + bought.ms;

    if (bought.status === 201) {
      purchasesOk += 1;
      orders.push((bought.body as { data: { order: { id: string } } }).data.order.id);
      record('purchase_ok', totalMs);
      return;
    }

    record(bought.status === 409 ? 'purchase_conflict' : `purchase_${bought.status}`, totalMs);
  };

  const refund = async (): Promise<void> => {
    const orderId = orders.shift();

    if (!orderId) {
      return;
    }

    const refunded = await httpCall(
      options.ticketingUrl,
      'POST',
      `/api/orders/${orderId}/refund`,
      { token, body: { reason: 'mixed scenario' } },
    );

    if (refunded.status === 200) {
      refundsOk += 1;
      record('refund_ok', refunded.ms);
      return;
    }

    record(refunded.status === 409 ? 'refund_conflict' : `refund_${refunded.status}`, refunded.ms);
  };

  const cancelHold = async (): Promise<void> => {
    if (active.length === 0) {
      return;
    }

    const target = pick(active);
    const hold = await httpCall(options.ticketingUrl, 'POST', '/api/holds', {
      token,
      body: { tierId: target.tierId, quantity: 1, customerRef: newCustomer() },
    });

    if (hold.status !== 201) {
      record(hold.status === 409 ? 'cancel_hold_conflict' : `cancel_hold_${hold.status}`, hold.ms);
      return;
    }

    const holdId = (hold.body as { data: { id: string } }).data.id;
    const cancelled = await httpCall(options.ticketingUrl, 'DELETE', `/api/holds/${holdId}`, {
      token,
    });

    record(
      cancelled.status === 204 ? 'hold_cancelled' : `hold_cancel_${cancelled.status}`,
      hold.ms + cancelled.ms,
    );
  };

  const browse = async (): Promise<void> => {
    const response = await httpCall(options.ticketingUrl, 'GET', '/api/events?limit=10', { token });
    record(response.status === 200 ? 'browse_ok' : `browse_${response.status}`, response.ms);
  };

  const chaos = async (): Promise<void> => {
    const actions: ChaosAction[] = [
      {
        label: 'bad_password',
        expected: 401,
        run: () =>
          httpCall(authUrl(), 'POST', '/auth/login', {
            body: { email: 'customer@example.com', password: 'wrong-password' },
          }),
      },
      {
        label: 'missing_token',
        expected: 401,
        run: () => httpCall(options.ticketingUrl, 'GET', '/api/events'),
      },
      {
        label: 'invalid_token',
        expected: 401,
        run: () => httpCall(options.ticketingUrl, 'GET', '/api/events', { token: 'a'.repeat(64) }),
      },
      {
        label: 'unknown_event',
        expected: 404,
        run: () =>
          httpCall(options.ticketingUrl, 'GET', `/api/events/${randomUUID()}`, { token }),
      },
      {
        label: 'invalid_body',
        expected: 400,
        run: () => httpCall(options.ticketingUrl, 'POST', '/api/events', { token, body: {} }),
      },
    ];

    const action = pick(actions);
    const response = await action.run();

    record(
      response.status === action.expected ? 'chaos_expected' : `chaos_${response.status}`,
      response.ms,
    );
  };

  const loop = async (intervalMs: number, action: () => Promise<void>): Promise<void> => {
    while (Date.now() < deadline) {
      await action();
      const wait = Math.min(intervalMs, deadline - Date.now());

      if (wait > 0) {
        await sleep(wait);
      }
    }
  };

  await createEvent();
  await createEvent();

  await Promise.all([
    loop(30_000, createEvent),
    loop(20_000, cycleEventStatus),
    loop(45_000, cancelEvent),
    loop(4_000, createBooking),
    loop(Math.max(100, Math.round(1000 / options.rate)), purchase),
    loop(2_000, refund),
    loop(1_000, browse),
    loop(5_000, cancelHold),
    loop(8_000, chaos),
  ]);

  const networkErrors = attempts.filter((attempt) => attempt.outcome === 'network_error').length;

  notes.push(`events created: ${eventsCreated}`);
  notes.push(`status changes: ${statusChanges}`);
  notes.push(`bookings confirmed: ${bookingsConfirmed}`);
  notes.push(`purchases ok: ${purchasesOk}`);
  notes.push(`refunds ok: ${refundsOk}`);
  notes.push(`active events at end: ${active.length}, unrefunded orders: ${orders.length}`);

  return {
    attempts,
    notes,
    pass:
      networkErrors === 0 &&
      eventsCreated > 0 &&
      bookingsConfirmed > 0 &&
      purchasesOk > 0 &&
      refundsOk > 0,
  };
}
