# Grafana

## What it is for

Grafana is the web UI for metrics, logs and traces. It stores no telemetry
itself; it queries three provisioned datasources:

| Source | UID | URL inside Compose |
| --- | --- | --- |
| Prometheus | `prometheus` | `http://prometheus:9090` |
| Loki | `loki` | `http://loki:3100` |
| Tempo | `tempo` | `http://tempo:3200` |

It is the main demo surface: eight dashboards cover the golden signals, API
latency, one service in detail, PostgreSQL, messaging, the business view, logs
and traces.

## Configuration

| Item | File |
| --- | --- |
| datasources | `infra/grafana/provisioning/datasources/` |
| dashboards | `infra/grafana/dashboards/*.json` |
| provisioning | `infra/grafana/provisioning/dashboards/dashboards.yml` |
| container | `concert-ops-grafana`, port `3007` |

Credentials come from `.env`:

```
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin-password
```

## Dashboards

| Dashboard | UID | Focus |
| --- | --- | --- |
| Concert Ops Overview | `concert-ops-overview` | 14 panels: availability, errors, p95, business, saturation |
| API Monitoring | `concert-ops-api` | p90/p95/p99, slow routes, request columns, failure bars, tables |
| Service Detail | `concert-ops-service` | one service: routes, latency heatmap, DB query table, pool |
| Postgres | `concert-ops-postgres` | connections, transactions, cache, locks, slow statements |
| Messaging | `concert-ops-messaging` | queue depth, throughput, consumers, failures |
| Business | `concert-ops-business` | sales outcomes, revenue, funnel, event portfolio, unit economics |
| Logs | `concert-ops-logs` | log volume, errors, request lookup, status from logs |
| Traces | `concert-ops-traces` | recent traces and error traces |

**API Monitoring** and **Service Detail** use `service` and `method` variables;
**Postgres** uses `datname`; **Traces** uses `service`. Every dashboard has a
**Dashboards** dropdown in the top bar.

The **Business** dashboard opens on the last hour, not the last day: a demo run
lasts five minutes, so on a 24-hour graph it would be a thin line. Use the time
picker for 6/12/24 hours; data points remain visible even for short bursts.

Business panels use metrics recomputed from PostgreSQL every 15 seconds:
`events_total{status}`, `inventory_total_seats`, `inventory_sold_seats`,
`inventory_available_seats`, `inventory_held_seats`, `events_upcoming_total`.
Rejected hold attempts are counted by `hold_rejections_total{reason}`.

## How to verify

1. Container and health:

```powershell
docker compose ps grafana
Invoke-RestMethod http://localhost:3007/api/health
```

Expected: `database: ok`, `version: 11.2.0`.

2. Open `http://localhost:3007` and log in as admin.

3. Dashboards: **Dashboards → Concert Ops Overview**, or directly:

```
/d/concert-ops-overview
/d/concert-ops-api
/d/concert-ops-service
/d/concert-ops-postgres
/d/concert-ops-messaging
/d/concert-ops-business
```

Health signs: **App services available** = `100%`, **5xx error ratio** = `0%`,
p95 and p99 populated, **RabbitMQ consumers** = `1`.

4. Datasources: **Connections → Data sources**; all three should be `working`.
   For Tempo, **Save & test** may return 404 in Grafana 11.2 even though the
   datasource works.

5. Explore:

   - Prometheus: `sum by (service) (rate(http_requests_total[5m]))`;
   - Loki: `{container="concert-ops-ticketing"}`;
   - Tempo: `{resource.service.name="ticketing"}`.

6. Annotations: after a scenario with `--annotate`, orange vertical markers
   appear. The layer is **Load tests** and filters the `load-test` tag.

## Changing the time range

Open the dashboard without `kiosk`:

```
http://localhost:3007/d/concert-ops-business
```

Click the range button in the top-right (for example **Last 1 hour**), choose a
relative range (5m, 15m, 30m, 1h, 3h, 6h, 12h, 24h, 2d, 7d) or an absolute
range, then **Apply**.

Other options:

- drag a rectangle on a graph to zoom; double-click to go back;
- URL: `?from=now-15m&to=now`;
- absolute URL: `?from=2026-11-09T22:00:00Z&to=2026-11-09T23:00:00Z`;
- `kiosk` hides the top bar, so the picker is not visible there.

## Where it is used in code

Datasources are provisioned without manual clicks
(`infra/grafana/provisioning/datasources/prometheus.yml`):

```yaml
datasources:
  - name: Prometheus
    uid: prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

A dashboard panel is JSON with a PromQL query
(`infra/grafana/dashboards/overview.json`):

```json
{
  "title": "p95 latency by service",
  "targets": [
    {
      "refId": "A",
      "expr": "1000 * service:http_request_duration_p95:15m",
      "legendFormat": "{{service}}"
    }
  ]
}
```

The annotation layer that shows load-test markers:

```json
{
  "name": "Load tests",
  "target": {
    "tags": ["load-test"],
    "type": "tags"
  },
  "type": "tags"
}
```

The file provider reloads dashboards every 30 seconds
(`infra/grafana/provisioning/dashboards/dashboards.yml`):

```yaml
providers:
  - name: 'concert-ops'
    type: file
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
```
