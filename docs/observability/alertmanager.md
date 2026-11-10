# Alertmanager

## What it is for

Alertmanager receives alerts from Prometheus and decides what to do with them:
group similar alerts, suppress duplicates, repeat notifications on a schedule
and deliver them to a receiver.

Prometheus evaluates 17 rules from `infra/prometheus/alerts.yml`. When a rule
becomes `firing`, Alertmanager groups it and calls the `notify` webhook. On
recovery it sends `resolved`, because `send_resolved: true`.

| Rule | Condition |
| --- | --- |
| `ServiceDown` | `up{instance_type="service"} == 0` for 5m |
| `DatabaseExporterDown` | `up{instance_type="database"} == 0` for 5m |
| `PostgresDown` | `pg_up == 0` for 1m |
| `ServiceError` | any 5xx in the last minute |
| `HighLatency` | p95 above 1s for 5m |
| `DbPoolSaturated` | `db_pool_waiting_requests > 0` for 3m |
| `PostgresHighConnections` | above 80% of `max_connections` for 5m |
| `PostgresLowCacheHit` | cache hit below 90% for 10m |
| `PostgresDeadlocks` | any deadlock in the last 5m |
| `RabbitmqDown` | `up{instance_type="broker"} == 0` for 2m |
| `RabbitmqQueueBacklog` | more than 100 ready messages for 5m |
| `RabbitmqNoConsumers` | no active consumers for 5m |
| `RabbitmqPublishFailures` | any failed publish in the last 5m |
| `NoEventsOnSale` | `events_total{status="on_sale"} == 0` for 10m |
| `RefundRateHigh` | more than 20% refunds over the last hour, for 30m |
| `PurchaseFailures` | any failed purchase in the last 5m |
| `AuthFailureSpike` | more than 1 failure/s for 5m |

## Configuration

| Item | File |
| --- | --- |
| rules | `infra/prometheus/alerts.yml` |
| routing | `infra/alertmanager/alertmanager.yml` |
| container | `concert-ops-alertmanager`, port `9093` |
| receiver | `http://notify:3000/alerts` |

Route settings:

```yaml
group_wait: 0s
group_interval: 1s
repeat_interval: 4h
group_by: ['alertname', 'severity']
```

`group_wait: 0s` is deliberate for demos: the alert reaches `notify` quickly.

## How to verify

1. Container is running:

```powershell
docker compose ps alertmanager
```

2. Readiness:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:9093/-/ready |
  Select-Object -ExpandProperty Content
```

Expected: `OK`.

3. UI: `http://localhost:9093` — **Alerts** and **Silences**.

4. Active alerts through the API:

```powershell
Invoke-RestMethod http://localhost:9093/api/v2/alerts |
  Select-Object @{ n = 'alert'; e = { $_.labels.alertname } }, @{ n = 'state'; e = { $_.status.state } }
```

5. Config is valid:

```powershell
docker exec concert-ops-alertmanager amtool check-config /etc/alertmanager/alertmanager.yml
```

6. Rules in Prometheus: `http://localhost:9090/rules` and
   `http://localhost:9090/alerts`.

7. End-to-end: stop PostgreSQL and make a request that needs it:

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3006/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"admin@example.com","password":"admin-password"}'
$token = $login.data.token

docker compose stop postgres
Invoke-WebRequest -UseBasicParsing http://localhost:3002/api/events `
  -Headers @{ Authorization = "Bearer $token" }
```

`ServiceError` and `PostgresDown` appear within one evaluation interval. They
become `active` in Alertmanager and `alert received` appears in `notify` logs.
After `docker compose start postgres` the `resolved` notification arrives.

If this is the first 5xx in a new metric series, `increase()` may ignore the
first sample; make the request again and the alert fires on the next interval.

## Where it is used in code

Prometheus connects rules and Alertmanager in
`infra/prometheus/prometheus.yml`:

```yaml
rule_files:
  - /etc/prometheus/alerts.yml
  - /etc/prometheus/recording-rules.yml

alerting:
  alertmanagers:
    - scheme: http
      static_configs:
        - targets: ['alertmanager:9093']
```

Routing and receiver are in `infra/alertmanager/alertmanager.yml`:

```yaml
route:
  receiver: notify-webhook
  group_wait: 0s
  group_interval: 1s
  repeat_interval: 4h
  group_by: ['alertname', 'severity']
  routes:
    - match:
        severity: critical
      receiver: notify-webhook
      repeat_interval: 1h

receivers:
  - name: notify-webhook
    webhook_configs:
      - send_resolved: true
        url: http://notify:3000/alerts
```

A rule that starts the chain (`infra/prometheus/alerts.yml`):

```yaml
- alert: PostgresDown
  expr: pg_up == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Postgres exporter {{ $labels.instance }} cannot reach the database"
```

After firing, Alertmanager sends `POST http://notify:3000/alerts` with an
`alerts` array; on recovery it sends the same payload with `status: resolved`.
