# Concert Ops

Concert/performance management platform used as the subject system for an
observability lab: PostgreSQL in Docker, Prometheus metrics, Grafana
dashboards, Loki logs, Tempo traces, a separate auth service and RabbitMQ.

## Architecture

```
ticketing  :3001   events, price tiers, holds, orders, tickets, payments
catalog    :3003   performers, venues, booking requests

db_ticketing / db_catalog / db_notify   -> one Postgres container, :5434
auth       (planned, SQLite)
notify     (planned, RabbitMQ consumer)
```

Each service owns its database. No shared tables, no cross-service foreign
keys. A single package builds one image; each service is a separate process
started from its own entrypoint, so shared code is compiled once and the
`SERVICE_NAME` environment variable selects the database, port and metric
labels.

## Requirements

- Node.js >= 22
- Docker Desktop

## First run

```bash
docker compose up -d postgres
npm install
npm run db:migrate
npm run db:migrate:catalog
npm run seed
```

```bash
npm run dev            # ticketing on :3001
npm run dev:catalog    # catalog on :3003
```

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/events?limit=5
curl http://localhost:3003/api/venues
```

## API

### ticketing

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | readiness, pings the database |
| `GET` | `/metrics` | Prometheus exposition |
| `POST` | `/api/events` | create an event, resolving names from catalog |
| `GET` | `/api/events` | list events (`status`, `from`, `to`, `limit`, `offset`) |
| `GET` | `/api/events/:id` | fetch one event |
| `PATCH` | `/api/events/:id` | partial update, including status transitions |
| `DELETE` | `/api/events/:id` | delete an event that has no sales |
| `POST` | `/api/events/:eventId/tiers` | create a price tier |
| `GET` | `/api/events/:eventId/tiers` | list price tiers |
| `PATCH` | `/api/tiers/:tierId` | update price or quantity |
| `DELETE` | `/api/tiers/:tierId` | delete a tier with no sold or held seats |
| `POST` | `/api/holds` | reserve seats until `expires_at` |
| `DELETE` | `/api/holds/:id` | release an active hold |
| `POST` | `/api/purchases` | convert a hold into an order and tickets |
| `GET` | `/api/orders/:id` | fetch an order with its tickets |

Event statuses follow a state machine:

```
draft -> scheduled -> on_sale -> sold_out -> completed
                            \-> cancelled
```

### catalog

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/performers` | create a performer |
| `GET` | `/api/performers` | list performers |
| `GET` | `/api/performers/:id` | fetch one performer |
| `POST` | `/api/venues` | create a venue |
| `GET` | `/api/venues` | list venues |
| `GET` | `/api/venues/:id` | fetch one venue |
| `POST` | `/api/bookings` | request a venue for a period |
| `GET` | `/api/bookings` | list bookings (`venueId`, `status`) |
| `GET` | `/api/bookings/:id` | fetch one booking |
| `PATCH` | `/api/bookings/:id` | confirm or reject a booking |

Confirming a booking runs against a database exclusion constraint:

```sql
EXCLUDE USING gist (venue_id WITH =, during WITH &&)
WHERE (status = 'confirmed')
```

Two confirmed bookings for the same venue can never overlap; the second one
returns `409 booking_conflict` with Postgres code `23P01`.

Money is integer cents. `priceCents = 4500` means `$45.00`.

## Service-to-service calls

Creating or updating an event accepts only ids, never names. Ticketing
resolves them over HTTP:

```
POST /api/events  { title, performerId, venueId, startsAt, durationMinutes }

  ticketing --GET /api/performers/:id--> catalog
  ticketing --GET /api/venues/:id-----> catalog
```

The returned names are snapshotted into the event row, so renaming a
performer in catalog does not rewrite existing events.

Failure modes:

| Situation | Response |
| --- | --- |
| catalog has no such performer | `400 unknown_performer` |
| catalog has no such venue | `400 unknown_venue` |
| catalog unreachable or timed out | `503 catalog_unavailable` |
| catalog returned an unexpected status | `502 catalog_error` |

`CATALOG_BASE_URL` selects the address (default `http://127.0.0.1:3003`,
compose uses `http://catalog:3000`), and `CATALOG_TIMEOUT_MS` bounds the call
(default 3000).

## Purchase flow

```
POST /api/holds          available_qty -= n, held_qty += n, hold expires in 10 min
POST /api/purchases      held_qty -= n, sold_qty += n, order + tickets + payment written
DELETE /api/holds/:id    available_qty += n, held_qty -= n
sweeper (every 10s)      expired holds released the same way
```

The seat reservation and the sale are single statements:

```sql
UPDATE price_tiers
SET available_qty = available_qty - $1,
    held_qty      = held_qty      + $1
WHERE id = $2 AND available_qty >= $1
RETURNING *;
```

Zero rows means the seats are gone, which becomes `409 insufficient_inventory`.
`orders.idempotency_key` is unique, so replaying a purchase returns the
original order instead of charging twice.

`HOLD_TTL_MS` (default 600000) and `HOLD_SWEEP_INTERVAL_MS` (default 10000)
control the hold lifetime and the sweeper cadence.

## Database workflow

Each service has its own schema folder and migration output:

```bash
npm run db:generate            # ticketing -> drizzle/ticketing
npm run db:generate:catalog    # catalog   -> drizzle/catalog
npm run db:migrate
npm run db:migrate:catalog
```

Generated SQL is committed. The catalog's venue-overlap constraint is a
hand-written migration (`drizzle/catalog/0001_booking_overlap.sql`) because
the schema DSL cannot express `EXCLUDE USING gist`.

## Seed data and load

```bash
npm run seed                 # 200 events
npm run seed -- --events=500
npm run seed -- --reset
```

Concurrency check against a running ticketing server:

```bash
npm run load -- --concurrency=20
npm run load -- --tier=<uuid> --concurrency=50 --quantity=1
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | ticketing with hot reload |
| `npm run dev:catalog` | catalog with hot reload |
| `npm run build` | compile to `dist/` |
| `npm start` | run the compiled ticketing server |
| `npm start:catalog` | run the compiled catalog server |
| `npm run typecheck` | type-check without emitting |
| `npm run db:generate` | ticketing migration from schema |
| `npm run db:generate:catalog` | catalog migration from schema |
| `npm run db:migrate` | apply ticketing migrations |
| `npm run db:migrate:catalog` | apply catalog migrations |
| `npm run seed` | populate events and price tiers |
| `npm run load` | concurrent purchase scenario |

## Containerised run

```bash
docker compose up -d --build
```

| Service | Host port | Container port |
| --- | --- | --- |
| ticketing | `TICKETING_HOST_PORT` (3002) | 3000 |
| catalog | `CATALOG_HOST_PORT` (3004) | 3000 |
| postgres | 5434 | 5432 |

Both containers run the same image with different entrypoints. Inside the
Compose network they reach each other by service name, e.g.
`http://catalog:3000`.

## Layout

```
src/
  shared/
    config/
      env.ts                      env parsing helpers
      database.ts                 per-service database config
      index.ts                    SERVICE_NAME-driven config object
    db/
      client.ts                   pg pool + drizzle instance
      executor.ts                 database or transaction executor type
      timed-query.ts              named query timing for Prometheus
      transaction.ts              transaction helper
      migrate.ts                  migration runner, one folder per service
    errors/
      http-error.ts               status-carrying error type
      database-error.ts           postgres error code mapping
    http/
      async-handler.ts
      validate.ts
      middleware/
        error-handler.ts
        request-metrics.ts
      routes/
        health.ts
        metrics.ts
    observability/
      metrics.ts                  every Prometheus metric
      logger.ts                   structured JSON logging
    typedefs/
      database.typedefs.ts
  services/
    ticketing/
      app.ts                      express wiring
      server.ts                   listen + graceful shutdown
      http/routes/api.router.ts
      db/
        drizzle.config.ts
        schema/                   events, price-tiers, holds, orders, tickets, payments
      modules/
        events/                   router, controller, service, repository, schemas
        tiers/
        purchases/                holds, orders, tickets, payments, sweeper
      typedefs/
      scripts/
        seed.ts
        load-purchases.ts
    catalog/
      app.ts
      server.ts
      http/routes/api.router.ts
      db/
        drizzle.config.ts
        schema/                   performers, venues, booking requests
      modules/
        performers/
        venues/
        bookings/
      typedefs/
drizzle/
  ticketing/                      generated migrations
  catalog/
db/
  init/                           one-time Postgres role and database setup
```

Layering rules: a router only maps method and path to a controller; a
controller only handles HTTP concerns, validation and status codes; a service
holds business rules and orchestrates; a repository only talks to the
database. Every query is timed under a stable name.
