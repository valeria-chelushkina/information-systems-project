# Concert Ops

Concert/performance management platform used as the subject system for an
observability lab: PostgreSQL in Docker, Prometheus metrics, Grafana
dashboards, Loki logs, Tempo traces, a separate auth service and RabbitMQ.

## Architecture

```
ticketing  :3001   events, price tiers, holds, orders, tickets, payments, refunds
catalog    :3003   performers, venues, booking requests
auth       :3005   users, sessions, login attempts (SQLite)

db_ticketing / db_catalog / db_notify   -> one Postgres container, :5434
auth.db                                 -> SQLite file on a volume
prometheus :9090                        -> scrapes every service, stores the TSDB
grafana    :3007                        -> dashboards over the Prometheus datasource
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
npm run seed:auth
npm run seed:catalog -- --reset
```

```bash
npm run dev            # ticketing on :3001
npm run dev:catalog    # catalog on :3003
npm run dev:auth       # auth on :3005
```

Then, with catalog running, populate events from real catalog ids:

```bash
npm run seed -- --reset --from-catalog
```

Every `/api` route requires a bearer token; `/health` and `/metrics` are public:

```bash
curl -s http://localhost:3001/api/events        # 401 missing_token
curl -s http://localhost:3005/health            # {"status":"ok"}
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
| `POST` | `/api/orders/:id/refund` | refund a paid order in full |

Event statuses follow a state machine:

```
draft -> scheduled -> on_sale -> sold_out -> completed
                            \-> cancelled

sold_out -> on_sale        refund restored inventory
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

### auth

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/login` | exchange credentials for a session token |
| `POST` | `/auth/logout` | revoke a session token |
| `POST` | `/auth/introspect` | validate a token, used by the other services |
| `GET` | `/auth/me` | current user |
| `POST` | `/auth/users` | create a user (admin required once any user exists) |
| `GET` | `/health` | readiness, pings the SQLite file |
| `GET` | `/metrics` | Prometheus exposition |

Money is integer cents. `priceCents = 4500` means `$45.00`.

## Authentication

Every `/api` route on ticketing and catalog requires a bearer token. `/health`
and `/metrics` stay public so Prometheus can scrape them.

```bash
TOKEN=$(curl -s -X POST http://localhost:3005/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"customer@example.com","password":"customer-password"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')

curl -H "authorization: Bearer $TOKEN" http://localhost:3001/api/events
```

Seeded users:

| Email | Password | Role |
| --- | --- | --- |
| `admin@example.com` | `admin-password` | admin |
| `staff@example.com` | `staff-password` | staff |
| `customer@example.com` | `customer-password` | customer |

Tokens are opaque. Only a SHA-256 hash is stored and the raw value is returned
once. Ticketing and catalog call `POST /auth/introspect` instead of verifying
signatures locally, so revoking a session takes effect immediately.
`AUTH_BASE_URL` selects the address (default `http://127.0.0.1:3005`, compose
uses `http://auth:3000`).

Scripts authenticate too. `npm run seed -- --from-catalog` and `npm run load`
log in with `SEED_AUTH_EMAIL` / `SEED_AUTH_PASSWORD` (default
`admin@example.com` / `admin-password`) before calling the APIs.

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

Ticketing forwards the caller's bearer token to catalog, so the catalog call
is authorised as the same user. Without a token the event request never
reaches the catalog client.

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

Refunds are a compensating transaction over the same rows:

```
POST /api/orders/:id/refund

  lock order (must be paid)
  sold_qty -= n, available_qty += n        per tier, sorted to avoid deadlocks
  tickets.status = refunded
  payments.status = refunded
  insert refund row (full amount)
  orders.status = refunded
  if the event was sold_out and inventory is back, status = on_sale
```

Only paid orders can be refunded, and only once — the second attempt returns
`409 order_not_refundable`.

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

Auth has no migration runner: its SQLite schema is created at startup and by
the seed script from `src/services/auth/db/schema.ts`.

## Seed data and load

Seed catalog first, then ticketing so events reference real performers and
venues:

```bash
npm run seed:auth -- --reset          # 3 accounts: admin, staff, customer
npm run seed:catalog -- --reset       # 16 performers, 10 venues, 11 bookings
npm run seed -- --reset --from-catalog # 200 events using catalog ids
```

`seed:catalog` refuses to run against a non-empty catalog; pass `--reset` to
reseed. Without `--from-catalog` the event seeder generates synthetic
performer and venue ids, which is only useful while catalog is empty.

```bash
npm run seed -- --events=500
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
| `npm run dev:auth` | auth with hot reload |
| `npm run build` | compile to `dist/` |
| `npm start` | run the compiled ticketing server |
| `npm start:catalog` | run the compiled catalog server |
| `npm start:auth` | run the compiled auth server |
| `npm run typecheck` | type-check without emitting |
| `npm run db:generate` | ticketing migration from schema |
| `npm run db:generate:catalog` | catalog migration from schema |
| `npm run db:migrate` | apply ticketing migrations |
| `npm run db:migrate:catalog` | apply catalog migrations |
| `npm run seed` | populate events and price tiers |
| `npm run seed:catalog` | populate performers, venues and bookings |
| `npm run seed:auth` | populate admin, staff and customer accounts |
| `npm run load` | concurrent purchase scenario |

## Containerised run

```bash
docker compose up -d --build
```

| Service | Host port | Container port |
| --- | --- | --- |
| ticketing | `TICKETING_HOST_PORT` (3002) | 3000 |
| catalog | `CATALOG_HOST_PORT` (3004) | 3000 |
| auth | `AUTH_HOST_PORT` (3006) | 3000 |
| prometheus | `PROMETHEUS_HOST_PORT` (9090) | 9090 |
| grafana | `GRAFANA_HOST_PORT` (3007) | 3000 |
| postgres | 5434 | 5432 |

All application containers run the same image with different entrypoints.
Inside the Compose network they reach each other by service name:
`http://catalog:3000`, `http://auth:3000`, `http://prometheus:9090`. The auth
SQLite file lives on the `authdata` volume at `/app/data/auth.db`.

## Monitoring

```bash
docker compose up -d prometheus grafana
```

| Where | What |
| --- | --- |
| `http://localhost:9090/targets` | scrape health — all four targets should be `UP` |
| `http://localhost:9090/graph` | raw PromQL |
| `http://localhost:3007` | Grafana; credentials from `.env` |

Prometheus scrapes every 10 seconds using Compose service names and the
**container** port 3000:

```yaml
scrape_configs:
  - job_name: 'ticketing'
    static_configs:
      - targets: ['ticketing:3000']
```

The TSDB lives on the `promdata` volume at `/prometheus`, so history survives
a restart. Grafana's datasource is provisioned from
`infra/grafana/provisioning/datasources/prometheus.yml` with the URL
`http://prometheus:9090`, so no manual setup is needed.

The **Concert Ops Overview** dashboard is provisioned as well
(`infra/grafana/dashboards/overview.json`): seven stat panels (services up,
tickets sold, refunds, expired holds, revenue, refunded amount, holds created)
and eleven time series (request rate, p95 latency, HTTP statuses, DB query p95,
DB errors, purchases by outcome, auth failures, memory, holds vs purchases,
DB pool waiting requests, bookings by status). It refreshes every 10 seconds.

Useful queries:

```promql
up
sum by (service) (rate(http_requests_total[1m]))
histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m])))
sum by (query_name) (rate(db_query_duration_seconds_count[1m]))
auth_failures_total

sum(tickets_sold_total)
sum by (status) (rate(purchases_total[5m]))
sum(refunds_total)
sum(holds_expired_total)
sum(holds_created_total)
sum(revenue_cents_total) / 100
sum(refunded_cents_total) / 100
db_pool_waiting_requests
sum by (status) (rate(bookings_total[5m]))
```

Services started with `npm run dev` listen on the host, not on the Compose
network. To scrape those, add targets such as `host.docker.internal:3001`.

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
        require-auth.ts             bearer token -> auth introspection
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
    auth/
      app.ts
      server.ts
      db/
        client.ts                 node:sqlite connection, WAL, busy timeout
        schema.ts                 tables created at startup
      modules/
        auth.router.ts
        auth.controller.ts
        auth.service.ts
        auth.schemas.ts
        users.repository.ts
        sessions.repository.ts
        login-attempts.repository.ts
      security/
        password.ts               scrypt hashing
        token.ts                  token generation and sha-256 hashing
      typedefs/
      scripts/
        seed.ts
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
