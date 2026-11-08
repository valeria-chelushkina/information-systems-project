import { and, eq, gte } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, pool } from '@/shared/db/client.js';
import { events, priceTiers } from '@/services/ticketing/db/schema/index.js';

interface Tally {
  ok: number;
  holdFailed: number;
  purchaseFailed: number;
  error: number;
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

const baseUrl = argValue('base-url') ?? 'http://127.0.0.1:3001';
const concurrency = Number(argValue('concurrency') ?? 20);
const quantity = Number(argValue('quantity') ?? 1);

async function resolveTierId(): Promise<string> {
  const explicit = argValue('tier');

  if (explicit) {
    return explicit;
  }

  const [candidate] = await db
    .select({ id: priceTiers.id })
    .from(priceTiers)
    .innerJoin(events, eq(events.id, priceTiers.eventId))
    .where(and(eq(events.status, 'on_sale'), gte(priceTiers.availableQty, quantity)))
    .limit(1);

  if (!candidate) {
    throw new Error('No on_sale tier with availability. Run: npm run seed -- --reset');
  }

  return candidate.id;
}

async function availableOf(tierId: string): Promise<number> {
  const [row] = await db
    .select({ available: priceTiers.availableQty })
    .from(priceTiers)
    .where(eq(priceTiers.id, tierId));

  return row?.available ?? -1;
}

async function attempt(tierId: string): Promise<keyof Tally> {
  const customerRef = randomUUID();

  try {
    const holdResponse = await fetch(`${baseUrl}/api/holds`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tierId, quantity, customerRef }),
    });

    if (holdResponse.status !== 201) {
      return 'holdFailed';
    }

    const hold = (await holdResponse.json()) as { data: { id: string } };

    const purchaseResponse = await fetch(`${baseUrl}/api/purchases`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        holdId: hold.data.id,
        idempotencyKey: randomUUID(),
        customerEmail: `buyer-${customerRef.slice(0, 8)}@example.com`,
      }),
    });

    return purchaseResponse.status === 201 ? 'ok' : 'purchaseFailed';
  } catch {
    return 'error';
  }
}

async function main(): Promise<void> {
  const tierId = await resolveTierId();
  const before = await availableOf(tierId);

  const results = await Promise.all(
    Array.from({ length: concurrency }, () => attempt(tierId)),
  );

  const tally: Tally = { ok: 0, holdFailed: 0, purchaseFailed: 0, error: 0 };

  for (const result of results) {
    tally[result] += 1;
  }

  const after = await availableOf(tierId);

  console.log(`tier:              ${tierId}`);
  console.log(`concurrency:       ${concurrency}`);
  console.log(`quantity per buy:  ${quantity}`);
  console.log(`available before:  ${before}`);
  console.log(`available after:   ${after}`);
  console.log(`ok:                ${tally.ok}`);
  console.log(`hold failed:       ${tally.holdFailed}`);
  console.log(`purchase failed:   ${tally.purchaseFailed}`);
  console.log(`network errors:    ${tally.error}`);

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
