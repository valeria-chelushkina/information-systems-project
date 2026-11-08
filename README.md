# Concert Ops

Concert/performance management platform used as the subject system for an
observability lab: PostgreSQL in Docker, Prometheus metrics, Grafana
dashboards, Loki logs, Tempo traces, a separate auth service and RabbitMQ.

## Architecture

```
ticketing  (this repo, :3001)   events, price tiers, inventory, purchases
catalog    (planned)            performers, venues, booking requests
auth       (planned, SQLite)    users, sessions, login attempts
notify     (planned)            RabbitMQ consumer -> notifications

db_ticketing / db_catalog / db_notify   -> one Postgres container, :5434
```

Each service owns its database. No shared tables, no cross-service foreign
keys. Cross-service references are opaque UUIDs plus a denormalised snapshot.

## Requirements

- Node.js >= 22
- Docker Desktop

## First run

```bash
docker compose up -d postgres
npm install
npm run db:migrate
npm run seed
npm run dev
```

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/events?limit=5
curl http://localhost:3001/metrics
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | readiness, pings the database |
| `GET` | `/metrics` | Prometheus exposition |
| `POST` | `/api/events` | create an event |
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

Money is integer cents. `priceCents = 4500` means `$45.00`.

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

The schema lives in TypeScript under `src/db/schema/`. SQL migration files
are generated from it into `drizzle/` and applied with the migrator.

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

Generated SQL is committed. Two things are not expressible in the schema DSL
and will require hand-written migrations later: exclusion constraints for
venue date ranges, and partial indexes.

## Seed data

```bash
npm run seed                 # 200 events
npm run seed -- --events=500
npm run seed -- --reset      # truncate first
```

Concurrency check against a running server:

```bash
npm run load -- --concurrency=20
npm run load -- --tier=<uuid> --concurrency=50 --quantity=1
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | run with hot reload |
| `npm run build` | compile to `dist/` |
| `npm start` | run the compiled server |
| `npm run typecheck` | type-check without emitting |
| `npm run db:generate` | generate a migration from the schema |
| `npm run db:migrate` | apply pending migrations |
| `npm run seed` | populate events and price tiers |
| `npm run load` | concurrent purchase scenario against a running server |

## Containerised run

```bash
docker compose up -d --build
```

The app container reaches `postgres:5432`; the host reaches `127.0.0.1:5434`.
Compose supplies the container-specific `DB_HOST` and `DB_PORT`.

Local development listens on `TICKETING_PORT` (3001). The container publishes
`TICKETING_HOST_PORT` (3002) so both can run at the same time.

## Layout

```
src/
  app.ts                          express wiring
  server.ts                       listen + graceful shutdown
  config/
    env.ts                        env parsing helpers
    database.ts                   per-service database config
    index.ts                      assembled config object
  db/
    client.ts                     pg pool + drizzle instance
    executor.ts                   database or transaction executor type
    timed-query.ts                named query timing for Prometheus
    transaction.ts                transaction helper
    migrate.ts                    drizzle migrator entry point
    drizzle.config.ts             drizzle-kit config
    schema/
      index.ts                    schema barrel
      events.ts
      holds.ts
      orders.ts
      payments.ts
      price-tiers.ts
      tickets.ts
  http/
    middleware/
      request-metrics.ts
      error-handler.ts
    routes/
      api.router.ts               mounts module routers under /api
      health.ts
      metrics.ts
  modules/
    events/
      events.router.ts            route table only
      events.controller.ts        request/response handling
      events.service.ts           business rules and state machine
      events.repository.ts        drizzle queries
      events.schemas.ts           zod request schemas
    tiers/
      tiers.router.ts
      tiers.controller.ts
      tiers.service.ts
      tiers.repository.ts
      tiers.schemas.ts
    purchases/
      purchases.router.ts         holds and purchases endpoints
      purchases.controller.ts
      purchases.service.ts        hold lifecycle, transaction, idempotency
      purchases.schemas.ts
      purchases.sweeper.ts        periodic expiry job
      holds.repository.ts
      orders.repository.ts
      tickets.repository.ts
      payments.repository.ts
  shared/
    errors/
      http-error.ts               status-carrying error type
      database-error.ts           postgres error code mapping
    http/
      async-handler.ts            forwards rejected promises to express
      validate.ts                 zod parsing with 400 responses
  scripts/
    seed.ts                       data generation
    load-purchases.ts             concurrent purchase scenario
  typedefs/
    database.typedefs.ts
    event.typedefs.ts
    hold.typedefs.ts
    order.typedefs.ts
    payment.typedefs.ts
    purchase.typedefs.ts
    ticket.typedefs.ts
    tier.typedefs.ts
  observability/
    metrics.ts                    every Prometheus metric
    logger.ts                     structured JSON logging
drizzle/
  NNNN_name.sql                   generated migrations
  meta/                           drizzle-kit snapshots
db/
  init/                           one-time Postgres role and database setup
```

Layering rules: a router only maps method and path to a controller; a
controller only handles HTTP concerns, validation and status codes; a service
holds business rules and orchestrates; a repository only talks to the
database. Every query is timed under a stable name.
