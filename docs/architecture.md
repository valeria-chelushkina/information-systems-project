# Architecture

Concert Ops is a small service-oriented system: one Node.js image runs four
services, each service owns its data, and the observability stack is separate
from the business services.

## System diagram

```
                         ┌─────────────┐
                         │   Grafana   │
                         └──────┬──────┘
                                │ Prometheus / Loki / Tempo
        ┌───────────────────────┼────────────────────────┐
        ▼                       ▼                        ▼
 ┌─────────────┐        ┌─────────────┐          ┌─────────────┐
 │ Prometheus  │        │    Loki     │          │    Tempo    │
 └──────┬──────┘        └──────▲──────┘          └──────▲──────┘
        │ scrapes              │ Alloy                  │ gRPC
        │                      │                        │
        │               container stdout          otel-collector
        │                                               ▲
        │                                               │ OTLP
 ┌──────┴───────────────────────────────────────────────┴──────┐
 │ ticketing        catalog          auth          notify       │
 │    │                │               │              ▲         │
 │    └──── HTTP ──────┘               │              │         │
 │    │                                │              │         │
 │    └── publish ──► RabbitMQ ──consume──────────────┘         │
 └──────┬───────────────────────────────────────────────────────┘
        │
 ┌──────▼──────┐        ┌──────────────┐
 │ PostgreSQL  │◄───────│ postgres_    │
 │ 3 databases │        │ exporter ×2  │
 └─────────────┘        └──────────────┘
```

## Services

| Service | Responsibility | Data |
| --- | --- | --- |
| `ticketing` | events, price tiers, holds, orders, tickets, payments, refunds | `db_ticketing` (PostgreSQL) |
| `catalog` | performers, venues, booking requests | `db_catalog` (PostgreSQL) |
| `auth` | users, sessions, login attempts | `auth.db` (SQLite) |
| `notify` | Alertmanager webhook receiver + RabbitMQ consumer | no database |

Infrastructure: PostgreSQL, RabbitMQ, Prometheus, Grafana, Loki + Alloy,
Tempo + OpenTelemetry Collector, Alertmanager, two postgres exporters.

## Data ownership

Each service owns its schema. There are no shared tables and no cross-service
foreign keys. References between bounded contexts are ids plus snapshotted
display names.

Example: an event stores `performer_id`, `venue_id`, `performer_name` and
`venue_name`. Renaming a performer in catalog does not rewrite existing
events.

## Main flows

### Authentication

```
client ──login──► auth ──opaque token──► client
client ──Bearer token──► ticketing/catalog
                              │
                              └──POST /auth/introspect──► auth
```

Tokens are opaque. Only a SHA-256 hash is stored; the raw token is returned
once. Introspection makes revocation immediate. `/health` and `/metrics` stay
public; every `/api` route requires a token.

### Event creation

`ticketing` receives performer and venue ids, calls catalog over HTTP and
snapshots the names into the event row. The caller's bearer token is
forwarded, so catalog authorizes the same user.

### Purchase and refund

```
POST /api/holds       reserve seats, expires in 10 minutes
POST /api/purchases   convert hold -> order + tickets + payment
DELETE /api/holds/:id release an active hold
sweeper               releases expired holds every 10 seconds
```

Reservation and sale are single conditional `UPDATE` statements. Zero rows
means the seats are gone (`409 insufficient_inventory`). `orders.idempotency_key`
is unique, so replaying a purchase returns the original order.

Refunds are compensating transactions: inventory is restored, tickets and
payments are marked refunded, a refund row is inserted, and a sold-out event
returns to `on_sale` when inventory is available. Only paid orders can be
refunded, once.

### Booking overlap

Confirmed bookings for the same venue cannot overlap. PostgreSQL enforces it
with an exclusion constraint:

```sql
EXCLUDE USING gist (venue_id WITH =, during WITH &&)
WHERE (status = 'confirmed')
```

The second overlapping confirmation returns `409 booking_conflict`.

### Messaging

`ticketing` publishes `purchase.completed` after the purchase transaction
commits. `notify` consumes the durable `notifications` queue, validates the
payload and logs the notification. Queue and messages are durable, so stopping
the consumer does not lose events.

### Observability

- **Metrics**: every service exposes `/metrics`; Prometheus scrapes it every
  10 seconds. Two postgres exporters add engine-level metrics; RabbitMQ uses
  its built-in `rabbitmq_prometheus` plugin.
- **Logs**: Alloy reads container stdout through the Docker socket and ships
  it to Loki. Every request has an `x-request-id`, so one request can be
  followed across services.
- **Traces**: services export OTLP to `otel-collector`, which forwards to
  Tempo. Auto-instrumentation covers HTTP, express, pg and fetch, so service
  calls share one trace.
- **Alerts**: Prometheus evaluates alert and recording rules and sends firing
  alerts to Alertmanager, which routes them to `notify`.

## Deployment

Compose runs one application image with different entrypoints. Inside the
network services reach each other by service name (`http://catalog:3000`,
`http://auth:3000`). Host ports come from `.env`.

| Service | Host port | Container port |
| --- | --- | --- |
| ticketing | 3002 | 3000 |
| catalog | 3004 | 3000 |
| auth | 3006 | 3000 |
| notify | internal only | 3000 |
| prometheus | 9090 | 9090 |
| alertmanager | 9093 | 9093 |
| grafana | 3007 | 3000 |
| loki | 3100 | 3100 |
| tempo | 3200 | 3200 |
| otel-collector | 4317 / 4318 | 4317 / 4318 |
| rabbitmq | 5672 / 15672 / 15692 | 5672 / 15672 / 15692 |
| postgres | 5434 | 5432 |
| postgres exporters | 9187 / 9188 | 9187 |

Persistent data lives in named volumes: `pgdata`, `authdata`, `promdata`,
`grafanadata`, `lokidata`, `alloydata`, `tempodata`, `alertmanagerdata`,
`rabbitmqdata`.

Docker container logs use the `json-file` driver with rotation:
`max-size=10m`, `max-file=3`. The shared setting is the `x-logging` anchor in
`docker-compose.yml`.

## Design decisions

| Decision | Reason |
| --- | --- |
| one package, one image, multiple entrypoints | shared code compiled once, small operational surface |
| separate database per service | clear ownership, no cross-service joins |
| integer cents for money | no floating-point rounding |
| idempotency key on orders | safe purchase retries |
| conditional inventory updates | no read-then-write races |
| auth introspection | immediate revocation, no shared JWT secret |
| durable RabbitMQ queue | notifications survive consumer downtime |
| collector between apps and Tempo | batching, retry, one place for trace fan-out |
| provisioned Grafana dashboards and datasources | reproducible setup, no manual UI work |

## Top-level layout

```
src/
  services/        ticketing, catalog, auth, notify
  shared/          config, db, http, observability, messaging
  scripts/         demo, load scenarios
drizzle/           generated SQL migrations per service
db/init/           PostgreSQL roles, databases, extensions
infra/             prometheus, alertmanager, grafana, loki, tempo
docs/              architecture, API, scenarios, observability guides
```

Layering inside a module: router → controller → service → repository.
Routers only map HTTP paths; controllers handle HTTP and validation; services
hold business rules; repositories talk to the database.

## See also

- [Database schema](database.md)
- [API reference](api/README.md)
- [Scenarios](scenarios.md)
- [Development](development.md)
- [Observability guides](observability/README.md)
