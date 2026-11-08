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
docker compose up -d db
npm install
npm run db:migrate
npm run dev
```

```bash
curl http://localhost:3001/health
curl http://localhost:3001/events
curl http://localhost:3001/metrics
```

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

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | run with hot reload |
| `npm run build` | compile to `dist/` |
| `npm start` | run the compiled server |
| `npm run typecheck` | type-check without emitting |
| `npm run db:generate` | generate a migration from the schema |
| `npm run db:migrate` | apply pending migrations |

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
    timed-query.ts                named query timing for Prometheus
    transaction.ts                transaction helper
    migrate.ts                    drizzle migrator entry point
    drizzle.config.ts             drizzle-kit config
    schema/
      index.ts                    schema barrel
      events.ts
      price-tiers.ts
  http/
    middleware/
      request-metrics.ts
      error-handler.ts
    routes/
      health.ts
      metrics.ts
  modules/
    events/
      events.router.ts            HTTP shape
      events.service.ts           business rules
      events.repository.ts        queries
      events.types.ts
  observability/
    metrics.ts                    every Prometheus metric
    logger.ts                     structured JSON logging
drizzle/
  NNNN_name.sql                   generated migrations
  meta/                           drizzle-kit snapshots
db/
  init/                           one-time Postgres role and database setup
```

Rules followed across the codebase: router handles HTTP only, service holds
business rules, repository holds queries. Every query is timed under a stable
name so it can be charted individually.
