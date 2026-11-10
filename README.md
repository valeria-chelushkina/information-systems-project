# Concert Ops

Concert/performance management platform used as the subject system for an
observability lab: PostgreSQL in Docker, Prometheus metrics, Grafana
dashboards, Loki logs, Tempo traces, a separate auth service and RabbitMQ.

Per-service observability documentation (Ukrainian) lives in [`docs/`](docs/README.md).

## Architecture

```
ticketing  :3001   events, price tiers, holds, orders, tickets, payments, refunds
catalog    :3003   performers, venues, booking requests
auth       :3005   users, sessions, login attempts (SQLite)
notify     :3008   alert webhook receiver and RabbitMQ consumer (container port 3000)

db_ticketing / db_catalog / db_notify   -> one Postgres container, :5434
auth.db                                 -> SQLite file on a volume
rabbitmq   :5672                        -> purchase.completed events
rabbitmq UI :15672                      -> management console
rabbitmq metrics :15692                 -> built-in Prometheus endpoint
prometheus :9090                        -> scrapes every service, stores the TSDB
postgres-exporter :9187/:9188           -> engine-level PostgreSQL metrics
alertmanager :9093                      -> routes Prometheus alerts to notify
grafana    :3007                        -> dashboards over the Prometheus datasource
loki       :3100                        -> log storage; alloy ships container stdout
tempo      :3200                        -> trace storage (behind the collector)
otel-collector :4317/:4318              -> OTLP receiver, batches traces into tempo
```

Each service owns its database. No shared tables, no cross-service foreign
keys. A single package builds one image; each service is a separate process
started from its own entrypoint, so shared code is compiled once and the
`SERVICE_NAME` environment variable selects the database, port and metric
labels.

## Requirements

- Node.js >= 22
- Docker Desktop

## One-command demo

From a fresh clone, with Docker running:

```bash
npm run demo
```

This is only a shortcut for the Docker command below, so it also works without
Node or `npm install`:

```bash
docker compose --env-file .env.example --profile demo up --build -d
```

The command:

1. builds the application image and starts the full stack;
2. waits for `auth`, `catalog`, `ticketing`, `grafana`, PostgreSQL and RabbitMQ;
3. applies the ticketing and catalog migrations;
4. reseeds auth, catalog and ticketing;
5. runs the `mixed` scenario for **5 minutes** at **3 purchases/s**;
6. posts start/end annotations to Grafana;
7. exits the `demo` container with code `0`, leaving the stack running.

| Where | URL |
| --- | --- |
| Grafana | `http://localhost:3007` (`admin` / `admin-password`) |
| Prometheus | `http://localhost:9090` |
| Alertmanager | `http://localhost:9093` |
| RabbitMQ | `http://localhost:15672` (`admin` / `admin`) |

Watch the simulation:

```bash
docker compose --env-file .env.example logs -f demo
```

Change duration or purchase rate with shell variables (PowerShell):

```powershell
$env:DEMO_DURATION = "60"
$env:DEMO_RATE = "2"
npm run demo
```

or bash:

```bash
DEMO_DURATION=60 DEMO_RATE=2 npm run demo
```

The demo **reseeds the databases** on every run (it truncates events,
bookings and users), so do not use it on data you want to keep. Stop the stack
without deleting volumes:

```bash
docker compose --env-file .env.example down
```

Use `down -v` if you also want to remove the data volumes.

## First run

For local development without the demo profile:

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

## Scenario runner

Named traffic patterns that produce a readable dashboard and assert the
system behaves correctly.

```bash
AUTH_BASE_URL=http://127.0.0.1:3006 npm run scenario -- \
  --name=browse --rate=5 --duration=60 \
  --ticketing-url=http://127.0.0.1:3002 \
  --catalog-url=http://127.0.0.1:3004 \
  --annotate
```

PowerShell has no inline `VAR=value command` and no `\` continuation, so on
Windows use:

```powershell
$env:AUTH_BASE_URL = "http://127.0.0.1:3006"
npm run scenario -- `
  --name=browse --rate=5 --duration=60 `
  --ticketing-url=http://127.0.0.1:3002 `
  --catalog-url=http://127.0.0.1:3004 `
  --annotate
```

| Scenario | Traffic | Assertion |
| --- | --- | --- |
| `browse` | `GET /api/events` at `--rate` for `--duration` | every response is 200 |
| `purchase` | hold then purchase at `--rate` | at least one success, no network errors |
| `surge` | creates an event with `--seats` and fires `--buyers` at once | exactly `min(buyers, seats)` succeed and the tier counters stay consistent |
| `chaos` | bad password, missing token, invalid token, unknown event, invalid body | each request gets its expected 4xx |
| `refund` | purchase then refund `--count` times | every refund returns 200 |
| `mixed` | continuous mix: event lifecycle and status changes, bookings, purchases, refunds, hold cancels, browse, chaos | at least one event, booking, purchase and refund complete; no network errors |

For a five-minute busy run (purchases at 3 per second, all other workers on
their own cadence):

```powershell
$env:AUTH_BASE_URL = "http://127.0.0.1:3006"
npm run scenario -- `
  --name=mixed --duration=300 --rate=3 `
  --ticketing-url=http://127.0.0.1:3002 `
  --catalog-url=http://127.0.0.1:3004 `
  --annotate
```

`mixed` runs these workers in parallel for the whole duration:

| Worker | Cadence | What it produces |
| --- | --- | --- |
| event lifecycle | every 30 s | draft → scheduled → on_sale, tier with 250 seats |
| status cycle | every 20 s | sold_out → restock → on_sale |
| event cancel | every 45 s | on_sale → cancelled (keeps at least 2 active) |
| bookings | every 4 s | requested → confirmed/rejected; every 8th overlaps to produce `409` |
| purchases | `--rate` per second | holds, purchases, order IDs for refunds |
| refunds | every 2 s | full refund of a previously purchased order |
| hold cancel | every 5 s | hold created and immediately cancelled |
| browse | every 1 s | `GET /api/events` |
| chaos | every 8 s | wrong password, bad token, unknown event, invalid body |

This leaves events, bookings, orders and tickets in the database. Use
`--rate=5` for roughly 1500 purchases over five minutes, or reset the seeds
after a demo.

`--annotate` posts start/end markers to Grafana (`GRAFANA_URL`, admin
credentials), so a spike on a graph is labelled with the scenario that caused
it. The provisioned dashboard includes a **Load tests** annotation layer that
matches the `load-test` tag, so the markers appear on every panel. The runner
exits non-zero when the assertion fails, so it can be used in a pipeline.

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
| alertmanager | `ALERTMANAGER_HOST_PORT` (9093) | 9093 |
| notify | internal only | 3000 |
| rabbitmq | `RABBITMQ_HOST_PORT` (5672) | 5672 |
| rabbitmq management | `RABBITMQ_MANAGEMENT_PORT` (15672) | 15672 |
| rabbitmq metrics | `RABBITMQ_PROMETHEUS_PORT` (15692) | 15692 |
| postgres-exporter-ticketing | `POSTGRES_EXPORTER_TICKETING_PORT` (9187) | 9187 |
| postgres-exporter-catalog | `POSTGRES_EXPORTER_CATALOG_PORT` (9188) | 9187 |
| grafana | `GRAFANA_HOST_PORT` (3007) | 3000 |
| loki | `LOKI_HOST_PORT` (3100) | 3100 |
| tempo | `TEMPO_HOST_PORT` (3200) | 3200 |
| otel-collector | `OTEL_COLLECTOR_GRPC_PORT` (4317) / `OTEL_COLLECTOR_HTTP_PORT` (4318) | 4317 / 4318 |
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
| `http://localhost:9090/targets` | scrape health - all eight targets should be `UP` |
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

Application metrics cover HTTP, pool and business counters. Two
`postgres_exporter` containers add the engine view, one per service database:

| Exporter | Database | Host port |
| --- | --- | --- |
| `postgres-exporter-ticketing` | `db_ticketing` | `POSTGRES_EXPORTER_TICKETING_PORT` (9187) |
| `postgres-exporter-catalog` | `db_catalog` | `POSTGRES_EXPORTER_CATALOG_PORT` (9188) |

They connect as the dedicated `exporter` role with `pg_monitor`, not as the
application roles, so `pg_stat_activity`, `pg_locks` and `pg_stat_statements`
are fully visible. `db/init/02_monitoring.sql` creates that role and the
extension; the postgres service preloads `pg_stat_statements`. The collector
runs with `--collector.stat_statements` and
`--collector.stat_statements.include_query`, which exposes statement text as
the `pg_stat_statements_query_id` info metric.

Both exporters see cluster-wide `pg_stat_database` rows, so dashboard queries
deduplicate with `max by (datname)` rather than summing across jobs.

RabbitMQ exposes its own metrics through the built-in `rabbitmq_prometheus`
plugin on `15692`, so no separate exporter container is needed. The broker
also publishes application counters (`rabbitmq_messages_published_total`,
`rabbitmq_messages_consumed_total`). RabbitMQ 4.0 aggregates queue metrics by
default, so the panels use `rabbitmq_queue_messages_ready`,
`rabbitmq_queue_consumers` and `rabbitmq_queue_messages_acked_total` without a
`queue` label.

On an existing `pgdata` volume the init scripts do not run again. After the
compose change that adds the preload setting, apply the monitoring script
once:

```bash
docker compose up -d postgres
docker compose exec -T postgres psql -U postgres -d postgres \
  -f /docker-entrypoint-initdb.d/02_monitoring.sql
```

The TSDB lives on the `promdata` volume at `/prometheus`, so history survives
a restart. Grafana's datasource is provisioned from
`infra/grafana/provisioning/datasources/prometheus.yml` with the URL
`http://prometheus:9090`, so no manual setup is needed.

Six dashboards are provisioned from `infra/grafana/dashboards/` and grouped by
the `concert-ops` tag, so the dashboard dropdown links them together:

| Dashboard | UID | Focus |
| --- | --- | --- |
| Concert Ops Overview | `concert-ops-overview` | 14 golden-signal and business panels |
| API Monitoring | `concert-ops-api` | percentiles, routes, failed requests, 2xx vs errors, route and status tables |
| Service Detail | `concert-ops-service` | one service: route stats, latency heatmap, DB query table, pool |
| Postgres | `concert-ops-postgres` | connections, transactions, cache, locks, slow statements |
| Messaging | `concert-ops-messaging` | queue depth, throughput, consumers, failures |
| Business | `concert-ops-business` | sales outcomes, revenue, funnel, event portfolio, bookings, auth failures, unit economics |

`API Monitoring` and `Service Detail` use the `service` and `method`
template variables. The API dashboard reproduces the classic panel set:
p90/p95/p99 by method, slowest routes, request columns, requests per minute,
failed requests and 2xx-vs-error bars, plus joined route/status tables.

`infra/prometheus/recording-rules.yml` precomputes the values shared by
dashboards and alerts: per-service request rate, error percentage, p95/p99,
global p95 and error percentage, Postgres connection/cache percentages, and
the RabbitMQ backlog. The percentile rules use a 15-minute window so values
survive short idle periods between scenario runs.

Application metrics now also include `http_requests_in_flight`, exposed by the
request middleware and used in Service Detail.

Business state gauges are recomputed from PostgreSQL every 15 seconds by
`BusinessStateSweeper`: `events_total{status}`, `inventory_total_seats`,
`inventory_sold_seats`, `inventory_available_seats`, `inventory_held_seats`
and `events_upcoming_total`. `hold_rejections_total{reason}` counts attempts
rejected at the hold stage (sold out or not on sale), so the Business dashboard
can show a real success rate instead of only completed purchases.

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

pg_up
max by (datname) (pg_stat_database_numbackends{datname=~"db_.*"})
max by (datname) (rate(pg_stat_database_xact_commit{datname=~"db_.*"}[5m]))
100 * sum(rate(pg_stat_database_blks_hit[5m])) /
  (sum(rate(pg_stat_database_blks_hit[5m])) + sum(rate(pg_stat_database_blks_read[5m])))
sum by (mode) (max by (datname, mode) (pg_locks_count{datname=~"db_.*"}))
max by (datname) (pg_database_size_bytes{datname=~"db_.*"})

rabbitmq_queue_messages_ready
rabbitmq_queue_consumers
sum(rate(rabbitmq_messages_published_total[5m]))
sum by (status) (rate(rabbitmq_messages_consumed_total[5m]))
sum(rate(rabbitmq_queue_messages_acked_total[5m]))
```

Services started with `npm run dev` listen on the host, not on the Compose
network. To scrape those, add targets such as `host.docker.internal:3001`.

## Messaging

`ticketing` publishes `purchase.completed` after a purchase transaction
commits. `notify` consumes the durable `notifications` queue, validates the
payload and logs the notification. RabbitMQ runs with the management UI and
the built-in Prometheus plugin.

| Where | What |
| --- | --- |
| `http://localhost:15672` | management UI (`RABBITMQ_DEFAULT_*` from `.env`) |
| `http://localhost:15692/metrics` | broker metrics |
| Queue `notifications` | one consumer when `notify` is running |

```bash
docker compose up -d rabbitmq
npm run scenario -- --name=purchase --rate=2 --duration=3 \
  --ticketing-url=http://127.0.0.1:3002 \
  --catalog-url=http://127.0.0.1:3004
docker logs concert-ops-notify --tail 20 | grep "purchase notification received"
```

Stopping `notify` and buying tickets leaves messages in `Ready`; starting it
again drains the queue, because the queue and messages are durable. Full
details are in [`docs/rabbitmq.md`](docs/rabbitmq.md).

## Alerts

Rules live in `infra/prometheus/alerts.yml` and are loaded through
`rule_files`; Prometheus sends firing alerts to `alertmanager:9093`, which
routes them to the `notify` webhook receiver. `notify` logs every firing and
resolved alert, so the notification path is visible in Loki:

```logql
{container="concert-ops-notify"} |= "alert"
```

Rules follow the course example: `groups` → `rules`, `expr` + `for`,
`severity` labels and `summary` annotations. Targets carry
`instance_group`, `instance_env`, `instance_type` and `team` labels, so
`up{instance_type='service'}` and `up{instance_type='database'}` behave like
the example's `service` and `node` selectors.

| Rule | Expression | Severity |
| --- | --- | --- |
| `ServiceDown` | `up{instance_type='service'} == 0` for 5m | critical |
| `DatabaseExporterDown` | `up{instance_type='database'} == 0` for 5m | critical |
| `PostgresDown` | `pg_up == 0` for 1m | critical |
| `ServiceError` | any 5xx in the last minute | critical |
| `HighLatency` | p95 above 1s for 5m | warning |
| `DbPoolSaturated` | `db_pool_waiting_requests > 0` for 3m | warning |
| `PostgresHighConnections` | above 80% of `max_connections` for 5m | warning |
| `PostgresLowCacheHit` | cache hit below 90% for 10m | warning |
| `PostgresDeadlocks` | any deadlock in the last 5m | critical |
| `RabbitmqDown` | `up{instance_type='broker'} == 0` for 2m | critical |
| `RabbitmqQueueBacklog` | more than 100 ready messages for 5m | warning |
| `RabbitmqNoConsumers` | no active consumers for 5m | warning |
| `RabbitmqPublishFailures` | any failed publish in the last 5m | warning |
| `NoEventsOnSale` | `events_total{status='on_sale'} == 0` for 10m | warning |
| `RefundRateHigh` | more than 20% refunds in the last hour for 30m | warning |
| `PurchaseFailures` | any failed purchase in the last 5m | warning |
| `AuthFailureSpike` | more than 1 failure/s for 5m | warning |

To see the full path, stop a dependency and generate traffic:

```bash
docker compose stop postgres
curl -H "Authorization: Bearer <token>" http://localhost:3002/api/events
```

The 5xx fires `ServiceError`, `pg_up == 0` fires `PostgresDown`, and both
reach `notify` within one evaluation interval. Alertmanager's UI is at
`http://localhost:9093`; `send_resolved: true` also delivers the recovery
notification. The lesson example puts Alertmanager behind nginx at
`/alertmanager`; here it is exposed directly, so no `path_prefix` is needed.

## Logs

```bash
docker compose up -d loki alloy
```

Every HTTP request gets an `x-request-id`: generated if absent, echoed in the
response header, included in the completion log line, and forwarded on the
calls to auth and catalog. That makes one request findable across services.

In Grafana: **Explore → Loki**.

```logql
{container="concert-ops-ticketing"}
{container="concert-ops-ticketing"} |= "request_id"
{job="docker"} |= "<request-id>"          # all services for one request
{container="concert-ops-auth"} | json | reason = "credentials"
```

Labels are `container`, `job` and `service_name`; everything else
(`request_id`, `level`, `status`, `duration_ms`) lives in the JSON body and is
filtered with `|=` or `| json`. Never label by request id — that creates one
stream per request.

Alloy ships container logs straight from the Docker socket
(`infra/loki/alloy.config.alloy`), so no application change is needed beyond
the request-id middleware. Loki stores its data on the `lokidata` volume.

## Traces

```bash
docker compose up -d tempo
```

Each service starts the OpenTelemetry NodeSDK **before** express and pg are
imported, exporting OTLP HTTP to the collector at `http://otel-collector:4318`.
The collector batches and forwards to Tempo over gRPC (`tempo:4317`), which is
the topology used in the course example: applications never talk to Tempo
directly. Auto-instrumentation covers inbound HTTP, express, pg and fetch, so
one request produces:

```
ticketing  POST /api/events            203 ms
  ticketing  GET  /performers/:id       38 ms   → catalog
  ticketing  GET  /venues/:id           44 ms   → catalog
  ticketing  pg.query:INSERT db_ticketing
  auth       POST /auth/introspect       3 ms
  catalog    GET  /performers/:id       23 ms
  catalog    pg.query:SELECT db_catalog
```

W3C `traceparent` is propagated automatically by the fetch and http
instrumentation, which is why auth and catalog spans land in the same trace.

Grafana: **Explore → Tempo**, or query the API directly:

```powershell
Invoke-RestMethod "http://localhost:3200/api/search?limit=10"
Invoke-RestMethod "http://localhost:3200/api/traces/<traceID>"
```

`/metrics` and `/health` are excluded from tracing so Prometheus scrapes do
not flood Tempo with 5 ms traces. `OTEL_EXPORTER_OTLP_ENDPOINT` selects the
collector (default `http://127.0.0.1:4318`, compose uses
`http://otel-collector:4318`).

`infra/tempo/otel-collector-config.yaml` holds the receiver/processor/exporter
pipeline. Tempo's own storage is a named volume (`tempodata`) rather than a
bind mount, so no `tempo-init` chown step is needed.

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
      tracing.ts                  OpenTelemetry SDK, started before express and pg
      metrics.ts                  every Prometheus metric
      messaging-metrics.ts        publish/consume counters
      logger.ts                   structured JSON logging
    messaging/
      connection.ts               shared amqplib connection
      purchase-topology.ts        exchange, queue, routing key, assertions
      purchase-event.typedefs.ts  purchase.completed payload
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
      messaging/
        purchase.publisher.ts     confirms and publishes purchase.completed
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
    notify/
      app.ts                      express wiring
      server.ts                   listen + graceful shutdown
      http/routes/health.ts
      modules/alerts/             webhook router, controller, service, schemas
      modules/notifications/      RabbitMQ consumer, schema, handler
drizzle/
  ticketing/                      generated migrations
  catalog/
db/
  init/                           roles, databases, pg_stat_statements, exporter grants
infra/
  prometheus/                     scrape config, alert and recording rules
  alertmanager/                   routes and webhook receiver config
  grafana/                        datasource and dashboard provisioning
  loki/                           loki config and alloy log pipeline
  tempo/                          tempo config and otel collector pipeline
docs/                             per-service observability documentation (Ukrainian)
```

Layering rules: a router only maps method and path to a controller; a
controller only handles HTTP concerns, validation and status codes; a service
holds business rules and orchestrates; a repository only talks to the
database. Every query is timed under a stable name.
