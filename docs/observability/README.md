# Observability

This folder documents every observability service in the project: what it is
for, where it is configured, how to verify it, and which code produces its
data.

All commands run from the project root:

```powershell
cd D:\University\4course\1sem\information-systems
```

## Architecture

```
ticketing / catalog / auth / notify
        ├── /metrics ────────────────► Prometheus
        ├── OTLP HTTP 4318 ──────────► otel-collector ──► Tempo
        └── ticketing ──publish──► RabbitMQ ──consume──► notify

Prometheus ──► Grafana (dashboards, Explore)
Prometheus ──► Alertmanager ──► notify (webhook)

postgres_exporter ──► Prometheus
Alloy ──► Loki ──► Grafana
```

## Services

| Service | Host port | Purpose | Document |
| --- | --- | --- | --- |
| Prometheus | 9090 | metric storage, PromQL, alert and recording rules | [prometheus.md](prometheus.md) |
| Grafana | 3007 | dashboards and Explore over all sources | [grafana.md](grafana.md) |
| Loki | 3100 | log storage | [loki.md](loki.md) |
| Alloy | internal | collects container logs and ships them to Loki | [alloy.md](alloy.md) |
| Tempo | 3200 | trace storage | [tempo.md](tempo.md) |
| otel-collector | 4317 / 4318 | receives OTLP and forwards traces to Tempo | [otel-collector.md](otel-collector.md) |
| postgres_exporter | 9187 / 9188 | PostgreSQL engine metrics | [postgres-exporter.md](postgres-exporter.md) |
| RabbitMQ | 5672 / 15672 / 15692 | message broker, management UI, built-in metrics | [rabbitmq.md](rabbitmq.md) |
| Alertmanager | 9093 | alert routing | [alertmanager.md](alertmanager.md) |
| notify | internal | alert webhook and RabbitMQ consumer | [notify.md](notify.md) |

## Dashboards

Grafana contains eight provisioned dashboards, grouped by the `concert-ops` tag:

| Dashboard | UID | Focus |
| --- | --- | --- |
| Concert Ops Overview | `concert-ops-overview` | availability, errors, latency, business, saturation |
| API Monitoring | `concert-ops-api` | percentiles, routes, failures, route and status tables |
| Service Detail | `concert-ops-service` | one service: routes, latency heatmap, DB queries, pool |
| Postgres | `concert-ops-postgres` | connections, transactions, cache, locks, slow statements |
| Messaging | `concert-ops-messaging` | queue depth, throughput, consumers, failures |
| Business | `concert-ops-business` | sales outcomes, revenue, funnel, event portfolio, unit economics |
| Logs | `concert-ops-logs` | log volume, errors, request lookup, status from logs |
| Traces | `concert-ops-traces` | recent traces and error traces |

## Quick health check

```powershell
docker compose ps

Invoke-WebRequest -UseBasicParsing http://localhost:9090/-/ready | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing http://localhost:3007/api/health | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing http://localhost:3100/ready | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing http://localhost:3200/ready | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing http://localhost:9093/-/ready | Select-Object -ExpandProperty Content

(Invoke-WebRequest -UseBasicParsing http://localhost:9187/metrics).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:9188/metrics).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:15692/metrics).StatusCode
```

Expected:

```
Prometheus Server is Ready.
{"database":"ok","version":"11.2.0",...}
ready
ready
OK
200
200
200
```

Tempo may return `503` during its first 20–30 seconds after start.

## How the pieces connect

- **Metrics**: services expose `/metrics`; Prometheus scrapes every 10 seconds;
  Grafana queries Prometheus; Alertmanager receives firing rules.
- **Logs**: Alloy reads container stdout through the Docker socket and sends it
  to Loki; Grafana shows it in Explore.
- **Traces**: services export OTLP to otel-collector, which batches and forwards
  to Tempo; Grafana renders the waterfall.
- **Alerts**: Prometheus evaluates rules from
  `infra/prometheus/alerts.yml`, Alertmanager groups them and calls the
  `notify` webhook, which logs the alert to stdout and therefore to Loki.
- **Business state**: ticketing exposes gauges recomputed from PostgreSQL every
  15 seconds (`events_total`, inventory, upcoming events) and counters such as
  `hold_rejections_total`.
