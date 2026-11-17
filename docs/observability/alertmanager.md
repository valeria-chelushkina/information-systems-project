# Alertmanager

## What it is for

Alertmanager receives alerts from Prometheus and decides what to do with them:
group similar alerts, suppress duplicates, repeat notifications on a schedule
and deliver them to a receiver.

Prometheus evaluates 21 rules from `infra/prometheus/alerts.yml`. When a rule
becomes `firing`, Alertmanager groups it and sends the notification to the
`gmail-receiver`, which contains both an email integration and the `notify`
webhook. On recovery it also sends `resolved`, because `send_resolved: true`.

Email is sent by Alertmanager itself; `notify` logs the same alert for Loki.
SMTP credentials are injected at container start, so they never live in Git.

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
| `RabbitmqQueueBacklog` | `notifications` queue has more than 100 ready messages for 5m |
| `RabbitmqNoConsumers` | `notifications` queue has no active consumers for 5m |
| `RabbitmqPublishFailures` | any failed publish in the last 5m |
| `RabbitmqDlqNotEmpty` | any message in `notifications.dlq` for 5m |
| `TicketEmailRetries` | more than 3 ticket email retries in 10m |
| `TicketEmailDeadLettered` | any ticket email parked in the dead-letter queue |
| `HostDown` | `up{instance_type="host"} == 0` for 5m |
| `HostHighCpu` | host CPU above 85% for 10m |
| `HostHighMemory` | host memory above 90% for 10m |
| `HostLowDisk` | host disk above 85% for 10m |
| `AuthFailureSpike` | more than 1 failure/s for 5m |

## Configuration

| Item | File |
| --- | --- |
| rules | `infra/prometheus/alerts.yml` |
| routing and receiver | `infra/alertmanager/alertmanager.template.yml` |
| startup renderer | `infra/alertmanager/entrypoint.sh` |
| container | `concert-ops-alertmanager`, port `9093` |
| webhook receiver | `http://notify:3000/alerts` |
| email receiver | `gmail-receiver`, one email per notification |

Route settings:

```yaml
group_by: ['alertname']
group_wait: 10s
group_interval: 10m
repeat_interval: 1h
receiver: 'gmail-receiver'
```

## Email notifications

Alertmanager reads SMTP settings from the environment and renders
`alertmanager.template.yml` into `/tmp/alertmanager.yml` on start. If
`SMTP_HOST`, `SMTP_FROM` or `ALERT_EMAIL_TO` is missing, it falls back to
`alertmanager.webhook.template.yml`: the webhook still delivers alerts to
`notify`, email is disabled, and a warning is written to the container log.

| Variable | Example | Purpose |
| --- | --- | --- |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server |
| `SMTP_PORT` | `587` | STARTTLS port |
| `SMTP_USER` | `you@gmail.com` | SMTP login |
| `SMTP_PASSWORD` | 16-character App Password | SMTP password |
| `SMTP_FROM` | `you@gmail.com` | From address |
| `ALERT_EMAIL_TO` | `you@gmail.com` | Recipient |
| `SMTP_REQUIRE_TLS` | `true` | STARTTLS is required |
| `ALERTMANAGER_EXTERNAL_URL` | `http://localhost:9093` | Base URL used in email links |

`ALERTMANAGER_EXTERNAL_URL` defaults to `http://localhost:<ALERTMANAGER_HOST_PORT>`.
Without it Alertmanager advertises its container hostname (for example
`http://8e4fc7b18237:9093`), so the "View in Alertmanager" link in emails cannot
be opened. Set it to the address your browser uses when the stack runs on
another host.

Gmail requires two-step verification and an App Password:

1. Google Account → **Security** → enable **2-Step Verification**.
2. Security → **App passwords** → create one for `Concert Ops`.
3. Copy the 16-character password without the spaces and put it in
   `SMTP_PASSWORD`. Your normal account password does not work.

Then rebuild Alertmanager:

```powershell
docker compose --env-file .env up -d --build alertmanager
docker logs concert-ops-alertmanager --tail 20
```

The rendered config is validated before startup:

```powershell
docker exec concert-ops-alertmanager amtool check-config /tmp/alertmanager.yml
```

Trigger one notification and follow it end to end:

```powershell
npm run demo:alerts
docker logs concert-ops-alertmanager --tail 30
docker logs concert-ops-notify --tail 10
```

A delivered alert logs `Notify for alerts complete` in Alertmanager and
`alert received` in `notify`. A rejected login logs `Notify for alerts failed`
with the SMTP response, usually `535 Authentication failed`; Gmail also returns
`454 4.7.0 Too many login attempts` after repeated failures, which clears on its
own after a pause.

The receiver keeps both integrations in one place:

```yaml
receivers:
  - name: 'gmail-receiver'
    email_configs:
      - to: '__ALERT_EMAIL_TO__'
        send_resolved: true
    webhook_configs:
      - send_resolved: true
        url: http://notify:3000/alerts
```

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
docker exec concert-ops-alertmanager amtool check-config /tmp/alertmanager.yml
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

## Run the alert demo

With the stack running:

```bash
npm run demo:alerts
```

The script runs two scenarios by default:

| Scenario | Trigger | Alerts |
| --- | --- | --- |
| `database` | stops PostgreSQL, sends requests, restarts it | `ServiceError`, `PostgresDown` |
| `synthetic` | injects alerts with distinct reasons into Alertmanager | `HighLatency`, `PostgresDeadlocks`, `RefundRateHigh`, `RabbitmqQueueBacklog` |

Choose scenarios explicitly:

```bash
npm run demo:alerts -- --scenario=database
npm run demo:alerts -- --scenario=synthetic
npm run demo:alerts -- --scenario=database,synthetic
```

Two optional long-running scenarios:

- `broker` stops RabbitMQ for more than two minutes to fire `RabbitmqDown`;
- `auth` sends failed logins for five minutes to fire `AuthFailureSpike`.

Each distinct `alertname` becomes its own notification, so one run produces one
email per alert. The script:

1. checks auth, ticketing, Prometheus and Alertmanager;
2. runs the selected scenarios and waits for Prometheus `firing`;
3. prints the matching `notify` webhook line and records whether delivery was
   seen;
4. restores PostgreSQL and RabbitMQ in `finally` blocks;
5. resolves synthetic alerts and prints a summary table.

Synthetic alerts exist because several rules need ten minutes or specific data
(cache hit, deadlocks, refund rate) that are not practical to provoke in a short
demo. They are sent straight to Alertmanager with a `demo` instance label and a
"Simulated…" description, so they are clearly distinguishable from real alerts.
Their resolution email follows on the next group interval (10 minutes).

It exits `0` when every selected alert fired, otherwise `1`. The command is safe
for data but should not run at the same time as a load scenario.

Open `http://localhost:9090/alerts` and `http://localhost:9093` while it runs.

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

Routing and receiver are in `infra/alertmanager/alertmanager.template.yml`:

```yaml
route:
  receiver: 'gmail-receiver'
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10m
  repeat_interval: 1h

receivers:
  - name: 'gmail-receiver'
    email_configs:
      - to: '__ALERT_EMAIL_TO__'
        send_resolved: true
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

After firing, Alertmanager emails the recipient and sends
`POST http://notify:3000/alerts` with an `alerts` array; on recovery it sends the
same payload with `status: resolved`.
