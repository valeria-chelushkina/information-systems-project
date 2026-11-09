import { randomUUID } from 'node:crypto';
import { fetchAccessToken } from '@/shared/auth/login.js';
import { optionalEnv } from '@/shared/config/env.js';
import { config } from '@/shared/config/index.js';
import { httpCall, sleep } from '@/shared/load/http.js';
import type { ScenarioOptions } from '@/scripts/scenarios/options.js';

export interface Attempt {
  outcome: string;
  ms: number;
}

export interface ScenarioResult {
  attempts: Attempt[];
  notes: string[];
  pass: boolean;
}

export interface ScenarioContext {
  options: ScenarioOptions;
  token: string;
}

export interface TierTarget {
  eventId: string;
  tierId: string;
}

export async function login(): Promise<string> {
  return fetchAccessToken(
    config.authBaseUrl,
    optionalEnv('SEED_AUTH_EMAIL', 'admin@example.com'),
    optionalEnv('SEED_AUTH_PASSWORD', 'admin-password'),
  );
}

export async function runPaced(
  rate: number,
  durationSeconds: number,
  task: () => Promise<Attempt>,
): Promise<Attempt[]> {
  const total = Math.max(1, Math.round(rate * durationSeconds));
  const interval = 1000 / rate;
  const startedAt = Date.now();
  const pending: Promise<Attempt>[] = [];
  const attempts: Attempt[] = [];

  for (let index = 0; index < total; index += 1) {
    pending.push(
      task().then((attempt) => {
        attempts.push(attempt);
        return attempt;
      }),
    );

    const wait = startedAt + (index + 1) * interval - Date.now();
    if (wait > 0) {
      await sleep(wait);
    }
  }

  await Promise.allSettled(pending);
  return attempts;
}

export async function resolveTier(ctx: ScenarioContext): Promise<TierTarget> {
  const events = await httpCall(
    ctx.options.ticketingUrl,
    'GET',
    '/api/events?status=on_sale&limit=100',
    { token: ctx.token },
  );

  const items = (events.body as { data?: { id: string }[] } | null)?.data ?? [];

  for (const event of items) {
    const tiers = await httpCall(
      ctx.options.ticketingUrl,
      'GET',
      `/api/events/${event.id}/tiers`,
      { token: ctx.token },
    );

    const rows = (tiers.body as { data?: { id: string; availableQty: number }[] } | null)?.data ?? [];
    const tier = rows.find((row) => row.availableQty >= ctx.options.quantity);

    if (tier) {
      return { eventId: event.id, tierId: tier.id };
    }
  }

  throw new Error('No on_sale tier with availability. Run: npm run seed -- --reset --from-catalog');
}

export function newCustomer(): string {
  return randomUUID();
}

export function newIdempotencyKey(): string {
  return randomUUID();
}
