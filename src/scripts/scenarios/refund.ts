import { httpCall } from '@/shared/load/http.js';
import {
  newCustomer,
  newIdempotencyKey,
  resolveTier,
  type Attempt,
  type ScenarioContext,
  type ScenarioResult,
} from '@/scripts/scenarios/context.js';

export async function refund(ctx: ScenarioContext): Promise<ScenarioResult> {
  const { options, token } = ctx;
  const tier = await resolveTier(ctx);
  const attempts: Attempt[] = [];

  for (let index = 0; index < options.count; index += 1) {
    const hold = await httpCall(options.ticketingUrl, 'POST', '/api/holds', {
      token,
      body: { tierId: tier.tierId, quantity: 1, customerRef: newCustomer() },
    });

    if (hold.status !== 201) {
      attempts.push({ outcome: `hold_${hold.status}`, ms: hold.ms });
      continue;
    }

    const holdId = (hold.body as { data: { id: string } }).data.id;
    const buy = await httpCall(options.ticketingUrl, 'POST', '/api/purchases', {
      token,
      body: {
        holdId,
        idempotencyKey: newIdempotencyKey(),
        customerEmail: 'refund@example.com',
      },
    });

    if (buy.status !== 201) {
      attempts.push({ outcome: `purchase_${buy.status}`, ms: hold.ms + buy.ms });
      continue;
    }

    const orderId = (buy.body as { data: { order: { id: string } } }).data.order.id;
    const refunded = await httpCall(
      options.ticketingUrl,
      'POST',
      `/api/orders/${orderId}/refund`,
      { token, body: { reason: 'scenario runner' } },
    );

    attempts.push({
      outcome: refunded.status === 200 ? 'ok' : `refund_${refunded.status}`,
      ms: hold.ms + buy.ms + refunded.ms,
    });
  }

  return {
    attempts,
    notes: [`orders refunded: ${attempts.filter((a) => a.outcome === 'ok').length}`],
    pass: attempts.every((attempt) => attempt.outcome === 'ok'),
  };
}
