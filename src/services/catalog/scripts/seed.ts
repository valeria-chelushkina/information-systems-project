import { count, sql } from 'drizzle-orm';
import { db, pool } from '@/shared/db/client.js';
import { timedQuery } from '@/shared/db/timed-query.js';
import { logger } from '@/shared/observability/logger.js';
import {
  bookingRequests,
  performers,
  venues,
} from '@/services/catalog/db/schema/index.js';
import type { NewBookingRow } from '@/services/catalog/typedefs/booking.typedefs.js';

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
  { name: 'Kyiv Sports Palace', city: 'Kyiv', timezone: 'Europe/Kyiv', capacity: 10000 },
  { name: 'Stereo Plaza', city: 'Kyiv', timezone: 'Europe/Kyiv', capacity: 6000 },
  { name: 'Atlas Arena', city: 'Kyiv', timezone: 'Europe/Kyiv', capacity: 8000 },
  { name: 'Arena Lviv', city: 'Lviv', timezone: 'Europe/Kyiv', capacity: 12000 },
  { name: 'B99 Hall', city: 'Lviv', timezone: 'Europe/Kyiv', capacity: 3000 },
  { name: 'Palladium', city: 'Warsaw', timezone: 'Europe/Warsaw', capacity: 4000 },
  { name: 'Progresja', city: 'Warsaw', timezone: 'Europe/Warsaw', capacity: 2500 },
  { name: 'Sentrum Scene', city: 'Oslo', timezone: 'Europe/Oslo', capacity: 1750 },
  { name: 'Caribbean Club', city: 'Kyiv', timezone: 'Europe/Kyiv', capacity: 1200 },
  { name: 'Olimpiyskiy Stadium', city: 'Kyiv', timezone: 'Europe/Kyiv', capacity: 70000 },
  { name: 'Tokyo Dome', city:'Tokyo', timezone: 'Asia/Tokyo', capacity: 55000 },
];

const CONFIRMED_BOOKINGS = 10;
const DAY_MS = 86_400_000;

function atHour(date: Date, hour: number): Date {
  const value = new Date(date);
  value.setUTCHours(hour, 0, 0, 0);
  return value;
}

async function seed(reset: boolean): Promise<void> {
  if (reset) {
    await timedQuery('seed_catalog_truncate', () =>
      db.execute(sql`TRUNCATE TABLE ${bookingRequests}, ${performers}, ${venues} CASCADE`),
    );
    logger.info('truncated catalog tables');
  } else {
    const [row] = await db.select({ value: count() }).from(performers);

    if (Number(row?.value ?? 0) > 0) {
      throw new Error('Catalog already has performers. Run: npm run seed:catalog -- --reset');
    }
  }

  const performerRows = await timedQuery('seed_catalog_performers', () =>
    db
      .insert(performers)
      .values(
        PERFORMERS.map((name, index) => ({
          name,
          genre: ['Rock', 'Indie', 'Electronic', 'J-Pop'][index % 4],
          contactEmail: `booking+${index + 1}@performers.example.com`,
        })),
      )
      .returning({ id: performers.id, name: performers.name }),
  );

  const venueRows = await timedQuery('seed_catalog_venues', () =>
    db.insert(venues).values(VENUES).returning({ id: venues.id, name: venues.name }),
  );

  const base = atHour(new Date(Date.now() + 30 * DAY_MS), 18);

  const bookingRows: NewBookingRow[] = [];

  for (let index = 0; index < CONFIRMED_BOOKINGS; index += 1) {
    const performer = performerRows[index % performerRows.length];
    const venue = venueRows[index % venueRows.length];

    if (!performer || !venue) {
      throw new Error('seed_catalog: missing performer or venue for booking');
    }

    const startsAt = new Date(base.getTime() + Math.floor(index / venueRows.length) * 3 * DAY_MS);

    bookingRows.push({
      performerId: performer.id,
      venueId: venue.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 5 * 3_600_000),
      status: 'confirmed',
      decidedAt: new Date(),
      note: 'Seeded confirmed booking',
    });
  }

  const firstPerformer = performerRows[0];
  const firstVenue = venueRows[0];

  if (firstPerformer && firstVenue) {
    bookingRows.push({
      performerId: firstPerformer.id,
      venueId: firstVenue.id,
      startsAt: atHour(base, 20),
      endsAt: atHour(base, 23),
      status: 'requested',
      note: 'Seeded request that overlaps a confirmed booking',
    });
  }

  const insertedBookings = await timedQuery('seed_catalog_bookings', () =>
    db.insert(bookingRequests).values(bookingRows).returning({ id: bookingRequests.id }),
  );

  logger.info(
    {
      performers: performerRows.length,
      venues: venueRows.length,
      bookings: insertedBookings.length,
    },
    'catalog seed complete',
  );
}

async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  await seed(reset);
  await pool.end();
}

main().catch(async (error) => {
  logger.error({ err: error }, 'catalog seed failed');
  await pool.end().catch(() => undefined);
  process.exit(1);
});
