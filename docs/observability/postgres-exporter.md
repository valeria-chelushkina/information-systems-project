# postgres_exporter

## What it is for

`postgres_exporter` connects to PostgreSQL as a normal client, queries
`pg_stat_*` views and exposes the result in Prometheus format on `/metrics`.

Two instances run:

| Container | Database | Host port |
| --- | --- | --- |
| `postgres-exporter-ticketing` | `db_ticketing` | `9187` |
| `postgres-exporter-catalog` | `db_catalog` | `9188` |

Why it is needed when the application already exposes metrics:

- application metrics show what the Node process saw (pool, query timing);
- the exporter shows what the engine did: real connections, locks, cache hit,
  deadlocks, database size, statement statistics.

They are two views of the same boundary. For example,
`db_pool_waiting_requests` says the client is waiting, while
`pg_locks_count`/`pg_stat_activity` show who holds the lock.

## Configuration

| Item | File |
| --- | --- |
| services and DSN | `docker-compose.yml` |
| role and grants | `db/init/02_monitoring.sql` |
| scrape targets | `infra/prometheus/prometheus.yml` |
| dashboard panels | `infra/grafana/dashboards/postgres.json` |

The exporter connects as the `exporter` role with `pg_monitor`, not as an
application role. That makes `pg_stat_activity`, `pg_locks` and
`pg_stat_statements` visible.

`stat_statements` is enabled explicitly:

```
--collector.stat_statements
--collector.stat_statements.include_query
```

Statement text is exposed through the `pg_stat_statements_query_id` info
metric, which the dashboard joins by `queryid`.

## How to verify

1. Containers are running:

```powershell
docker compose ps postgres-exporter-ticketing postgres-exporter-catalog
```

2. Metrics respond:

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:9187/metrics).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:9188/metrics).StatusCode
```

Expected: `200`.

3. Key values:

```powershell
$m = (Invoke-WebRequest -UseBasicParsing http://localhost:9187/metrics).Content
$m -split "`n" | Select-String "^pg_up|^pg_exporter_last_scrape_error"
```

Expected:

```
pg_exporter_last_scrape_error 0
pg_up 1
```

4. Prometheus sees the targets: `http://localhost:9090/targets`, jobs
   `postgres-ticketing` and `postgres-catalog` are `UP`.

5. Queries:

```promql
pg_up
max by (datname) (pg_stat_database_numbackends{datname=~"db_.*"})
max by (datname) (rate(pg_stat_database_xact_commit{datname=~"db_.*"}[5m]))
sum by (mode) (max by (datname, mode) (pg_locks_count{datname=~"db_.*"}))
max by (datname) (pg_database_size_bytes{datname=~"db_.*"})
postgres:connections:percent
postgres:cache_hit:percent5m
```

6. Grafana: **Postgres** dashboard shows connections, transactions, cache hit,
   locks, size and slow statements. Run a few purchases to populate the table.

## Where it is used in code

The service is declared in `docker-compose.yml`:

```yaml
postgres-exporter-ticketing:
  image: prometheuscommunity/postgres-exporter:v0.20.1
  command:
    - --collector.stat_statements
    - --collector.stat_statements.include_query
  environment:
    DATA_SOURCE_NAME: postgresql://${EXPORTER_DB_USER}:${EXPORTER_DB_PASSWORD}@postgres:5432/${TICKETING_DB_NAME}?sslmode=disable
  ports:
    - "${POSTGRES_EXPORTER_TICKETING_PORT}:9187"
```

The role and extension are created in `db/init/02_monitoring.sql`:

```sql
ALTER ROLE exporter WITH LOGIN PASSWORD 'dev_exporter_pw';
GRANT pg_monitor TO exporter;

\connect db_ticketing
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
GRANT SELECT ON pg_stat_statements TO exporter;
```

Prometheus scrapes each exporter as a separate target
(`infra/prometheus/prometheus.yml`):

```yaml
- job_name: 'postgres-ticketing'
  static_configs:
    - targets: ['postgres-exporter-ticketing:9187']
      labels:
        instance_type: database
```

Dashboard queries use `max by (datname)` because both exporters see
cluster-wide `pg_stat_database` rows; summing across jobs would double values.
