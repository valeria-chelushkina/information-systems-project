import { httpCall } from '@/shared/load/http.js';
import {
  newCustomer,
  newIdempotencyKey,
  resolveTier,
  runPaced,
  type ScenarioContext,
  type ScenarioResult,
} from '@/scripts/scenarios/context.js';

export async function purchase(ctx: ScenarioContext): Promise<ScenarioResult> {
  const tier = await resolveTier(ctx);

  const attempts = await runPaced(ctx.options.rate, ctx.options.duration, async () => {
    const hold = await httpCall(ctx.options.ticketingUrl, 'POST', '/api/holds', {
      token: ctx.token,
      body: {
        tierId: tier.tierId,
        quantity: ctx.options.quantity,
        customerRef: newCustomer(),
      },
    });

    if (hold.status !== 201) {
      return { outcome: hold.status === 0 ? 'network_error' : `hold_${hold.status}`, ms: hold.ms };
    }

    const holdId = (hold.body as { data: { id: string } }).data.id;

    const buy = await httpCall(ctx.options.ticketingUrl, 'POST', '/api/purchases', {
      token: ctx.token,
      body: {
        holdId,
        idempotencyKey: newIdempotencyKey(),
        customerEmail: 'load@example.com',
      },
    });

    return {
      outcome: buy.status === 201 ? 'ok' : buy.status === 0 ? 'network_error' : `purchase_${buy.status}`,
      ms: hold.ms + buy.ms,
    };
  });

  const ok = attempts.filter((attempt) => attempt.outcome === 'ok').length;

  return {
    attempts,
    notes: [`tier: ${tier.tierId}`, `successful purchases: ${ok}`],
    pass: ok > 0 && attempts.every((attempt) => !attempt.outcome.startsWith('network')),
  };
}
