# Development

## Local setup

```bash
docker compose up -d postgres
npm install
npm run db:migrate
npm run db:migrate:catalog
npm run seed:auth
npm run seed:catalog -- --reset
```

Start services with hot reload:

```bash
npm run dev            # ticketing on :3001
npm run dev:catalog    # catalog on :3003
npm run dev:auth       # auth on :3005
```

Then populate events from real catalog ids:

```bash
npm run seed -- --reset --from-catalog
```

Every `/api` route requires a bearer token; `/health` and `/metrics` are public:

```bash
curl -s http://localhost:3001/api/events        # 401 missing_token
curl -s http://localhost:3005/health            # {"status":"ok"}
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run demo` | one-command Docker demo: build, migrate, seed, run mixed |
| `npm run dev` | ticketing with hot reload |
| `npm run dev:catalog` | catalog with hot reload |
| `npm run dev:auth` | auth with hot reload |
| `npm run build` | compile to `dist/` |
| `npm start` | run compiled ticketing |
| `npm start:catalog` | run compiled catalog |
| `npm start:auth` | run compiled auth |
| `npm run typecheck` | type-check without emitting |
| `npm run scenario` | run a load scenario |
| `npm run load` | concurrent purchase check |
| `npm run db:generate` | ticketing migration from schema |
| `npm run db:generate:catalog` | catalog migration from schema |
| `npm run db:migrate` | apply ticketing migrations |
| `npm run db:migrate:catalog` | apply catalog migrations |
| `npm run seed` | populate events and price tiers |
| `npm run seed:catalog` | populate performers, venues and bookings |
| `npm run seed:auth` | populate admin, staff and customer accounts |

## Database workflow

See [database schema](database.md) for Mermaid ER diagrams and constraints.

Each service has its own schema folder and migration output:

```bash
npm run db:generate            # ticketing -> drizzle/ticketing
npm run db:generate:catalog    # catalog   -> drizzle/catalog
npm run db:migrate
npm run db:migrate:catalog
```

Generated SQL is committed. The catalog venue-overlap constraint is a
hand-written migration (`drizzle/catalog/0001_booking_overlap.sql`) because the
schema DSL cannot express `EXCLUDE USING gist`.

Auth has no migration runner: its SQLite schema is created at startup and by
the seed script from `src/services/auth/db/schema.ts`.

## Seeding

Seed catalog before ticketing, so events reference real performers and venues:

```bash
npm run seed:auth -- --reset           # 3 accounts
npm run seed:catalog -- --reset        # performers, venues, bookings
npm run seed -- --reset --from-catalog # 200 events using catalog ids
```

Without `--from-catalog` the event seeder creates synthetic performer and venue
ids, which is only useful while catalog is empty. `seed:catalog` refuses to run
against a non-empty catalog unless `--reset` is passed.

Generate more events:

```bash
npm run seed -- --events=500
```

## Load and scenarios

```bash
npm run load -- --concurrency=20
npm run load -- --tier=<uuid> --concurrency=50 --quantity=1
npm run scenario -- --name=mixed --duration=300 --rate=3
```

See [scenarios](scenarios.md) for all scenario names and the mixed worker
cadence.

## Containerised stack

```bash
docker compose --env-file .env.example up -d --build
```

Ports and volumes are listed in [architecture](architecture.md#deployment).
Configuration comes from `.env`; `.env.example` holds development defaults.
