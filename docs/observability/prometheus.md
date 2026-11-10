# Prometheus

## What it is for

Prometheus is the central metric store. Every 10 seconds it scrapes `/metrics`
from each service, stores the time series on the `promdata` volume, evaluates
alert and recording rules, and serves Grafana.

In this project it is the only source of numeric data:

- HTTP metrics: `http_requests_total`, `http_request_duration_seconds`,
  `http_requests_in_flight`;
- application database metrics: pool gauges, query duration;
- business metrics: tickets, purchases, refunds, holds, revenue, bookings,
  `hold_rejections_total`;
- PostgreSQL engine metrics from postgres_exporter;
- RabbitMQ and exporter health;
- target health: `up`, `pg_up`.

Grafana does not store metrics; it queries Prometheus.

## Configuration

| Item | File |
| --- | --- |
| scrape targets | `infra/prometheus/prometheus.yml` |
| alert rules | `infra/prometheus/alerts.yml` |
| recording rules | `infra/prometheus/recording-rules.yml` |
| storage | `promdata` volume, `/prometheus` |
| container | `concert-ops-prometheus`, port `9090` |

There are eight targets: four application services (`ticketing`, `catalog`,
`auth`, `notify`), two PostgreSQL exporters, RabbitMQ, and Prometheus itself.

Recording rules precompute per-service request rate, error percentage, p95/p99,
global p95 and error percentage, PostgreSQL connection/cache percentages and the
RabbitMQ backlog. The percentile rules use a 15-minute window so values survive
short idle periods between demo runs.

## How to verify

1. Container is running:

```powershell
docker compose ps prometheus
```

2. Readiness:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:9090/-/ready |
  Select-Object -ExpandProperty Content
```

Expected: `Prometheus Server is Ready.`

3. Targets: open `http://localhost:9090/targets`; all eight must be `UP`.
   Or:

```powershell
(Invoke-RestMethod http://localhost:9090/api/v1/targets).data.activeTargets |
  Select-Object @{ n = 'job'; e = { $_.labels.job } }, health
```

4. Rules: `http://localhost:9090/rules` contains the `default` group with 17
   alerts and the `concert-ops` group with 10 recording rules.

5. Current alerts: `http://localhost:9090/alerts`.

6. Try a query in `http://localhost:9090/graph`:

```promql
up
service:http_requests:rate5m
1000 * service:http_request_duration_p95:15m
sum by (status) (rate(purchases_total[5m]))
pg_up
rabbitmq_queue_messages_ready
events_total{status="on_sale"}
```

7. Check configuration without restarting:

```powershell
docker exec concert-ops-prometheus promtool check config /etc/prometheus/prometheus.yml
docker exec concert-ops-prometheus promtool check rules /etc/prometheus/alerts.yml
docker exec concert-ops-prometheus promtool check rules /etc/prometheus/recording-rules.yml
```

## Where it is used in code

Metrics are created with `prom-client` in
`src/shared/observability/metrics.ts`:

```ts
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests handled',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});
```

The `/metrics` route exposes the registry
(`src/shared/http/routes/metrics.ts`):

```ts
metricsRouter.get('/metrics', async (_req, res) => {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});
```

Targets are declared in `infra/prometheus/prometheus.yml`:

```yaml
- job_name: 'ticketing'
  static_configs:
    - targets: ['ticketing:3000']
      labels:
        instance_group: concert-ops
        instance_env: lab
        instance_type: service
        team: backend
```

Alert rules live in `infra/prometheus/alerts.yml`:

```yaml
- alert: ServiceDown
  expr: up{instance_type='service'} == 0
  for: 5m
  labels:
    severity: critical
```

`up` is generated automatically for every target; `http_requests_total` comes
from the `requestMetrics` middleware.
