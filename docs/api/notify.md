# Notify API

`notify` is internal: it has no published host port and is reached as
`http://notify:3000` from Alertmanager and RabbitMQ.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/alerts` | Alertmanager webhook receiver |
| `GET` | `/health` | liveness |
| `GET` | `/metrics` | Prometheus exposition |

## Alertmanager webhook

```bash
curl -X POST http://notify:3000/alerts \
  -H 'content-type: application/json' \
  -d '{
    "alerts": [
      {
        "status": "firing",
        "labels": {"alertname": "ServiceError", "severity": "critical"},
        "annotations": {"summary": "Service ticketing has thrown 5xx errors"}
      }
    ]
  }'
```

Response:

```json
{"status":"ok","received":1}
```

The payload follows Alertmanager webhook v4: an `alerts` array with `status`,
`labels`, `annotations`, `startsAt` and `endsAt`. The service validates it,
logs each alert and returns `200`. Invalid payloads return `400
validation_failed`.

Each alert becomes a structured log line:

```json
{"level":40,"service":"notify","alert":"ServiceError","status":"firing","severity":"critical","msg":"alert received"}
```

Alloy ships that line to Loki, so the notification path is visible in Grafana.

## RabbitMQ consumer

The same service consumes the `notifications` queue and logs
`purchase notification received` for every `purchase.completed` event. See
[RabbitMQ](../observability/rabbitmq.md) for topology and checks.

## Health

```bash
docker compose exec -T notify node -e "fetch('http://127.0.0.1:3000/health').then(r=>r.text()).then(console.log)"
```

Expected: `{"status":"ok"}`.
