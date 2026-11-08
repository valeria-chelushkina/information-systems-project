import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db, pool } from '@/db/client.js';
import { events, priceTiers } from '@/db/schema/index.js';
import { timedQuery } from '@/db/timed-query.js';
import { EventsRepository } from '@/modules/events/events.repository.js';
import { TiersRepository } from '@/modules/tiers/tiers.repository.js';
import { logger } from '@/observability/logger.js';
import type { EventStatus } from '@/typedefs/event.typedefs.js';

const PERFORMERS = [
  'Mafumafu',
  'Soraru',
  'After the Rain',
  'Ado',
  'Amatsuki',
  'Uratanuki',
  'Sou',
  'Sakata',
  'Syudou',
  'Miyashita Yuu',
  'Eve',
  'Soramafuurasaka'
];

const VENUES = [
  'Tokyo Dome',
  'Kyiv Sports Palace',
  'Stereo Plaza',
  'Atlas Arena',
  'Olimpiyskiy Stadium',
  'Caribbean Club',
  'Sentrum Scene',
  'Arena Lviv',
  'B99 Hall',
  'Palladium',
  'Progresja',
];

const TIER_TEMPLATES = [
  { name: 'Floor GA', priceCents: 4500, minQty: 150, maxQty: 400 },
  { name: 'Lower Bowl', priceCents: 6500, minQty: 100, maxQty: 300 },
  { name: 'VIP', priceCents: 15000, minQty: 20, maxQty: 80 },
] as const;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(items: readonly T[]): T {
  const value = items[Math.floor(Math.random() * items.length)];
  if (value === undefined) {
    throw new Error('randomItem received an empty array');
  }
  return value;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function pickStatus(): EventStatus {
  const roll = Math.random();
  if (roll < 0.1) return 'draft';
  if (roll < 0.3) return 'scheduled';
  if (roll < 0.9) return 'on_sale';
  return 'sold_out';
}

async function seedEvents(eventCount: number, reset: boolean): Promise<void> {
  if (reset) {
    await timedQuery('seed_truncate', () =>
      db.execute(sql`TRUNCATE TABLE ${priceTiers}, ${events} CASCADE`),
    );
    logger.info('truncated events and price tiers');
  }

  const eventsRepository = new EventsRepository();
  const tiersRepository = new TiersRepository();

  const now = new Date();

  const eventRows = Array.from({ length: eventCount }, () => {
    const performer = randomItem(PERFORMERS);
    const venue = randomItem(VENUES);
    const startsAt = addMinutes(now, randomInt(60 * 24, 60 * 24 * 90));
    const status = pickStatus();

    const onSaleAt =
      status === 'on_sale' || status === 'sold_out'
        ? addMinutes(now, -randomInt(60 * 24, 60 * 24 * 30))
        : status === 'scheduled'
          ? addMinutes(now, randomInt(60 * 24, 60 * 24 * 30))
          : null;

    return {
      performerId: randomUUID(),
      performerName: performer,
      venueId: randomUUID(),
      venueName: venue,
      title: `${performer} at ${venue}`,
      startsAt,
      doorsAt: addMinutes(startsAt, -60),
      durationMinutes: randomInt(90, 180),
      status,
      onSaleAt,
    };
  });

  const inserted = await eventsRepository.insertMany(eventRows);

  const tierRows = inserted.flatMap((event) => {
    const templates =
      event.status === 'sold_out'
        ? TIER_TEMPLATES
        : TIER_TEMPLATES.slice(0, randomInt(2, TIER_TEMPLATES.length));

    return templates.map((template) => {
      const totalQty = randomInt(template.minQty, template.maxQty);
      const soldQty = event.status === 'sold_out' ? totalQty : 0;

      return {
        eventId: event.id,
        name: template.name,
        priceCents: template.priceCents,
        totalQty,
        availableQty: totalQty - soldQty,
        soldQty,
        heldQty: 0,
      };
    });
  });

  if (tierRows.length > 0) {
    await tiersRepository.insertMany(tierRows);
  }

  logger.info({ events: inserted.length, tiers: tierRows.length }, 'seed complete');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const eventsArg = args.find((arg) => arg.startsWith('--events='));
  const eventCount = eventsArg ? Number(eventsArg.split('=')[1]) : 200;

  if (!Number.isInteger(eventCount) || eventCount <= 0) {
    throw new Error('--events must be a positive integer');
  }

  await seedEvents(eventCount, reset);
  await pool.end();
}

main().catch(async (error) => {
  logger.error({ err: error }, 'seed failed');
  await pool.end().catch(() => undefined);
  process.exit(1);
});
