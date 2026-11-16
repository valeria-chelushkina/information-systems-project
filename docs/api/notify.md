# Notify API

`notify` is internal: it has no published host port and is reached as
`http://notify:3000` from Alertmanager and RabbitMQ.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/alerts` | Alertmanager webhook receiver |
| `GET` | `/notifications` | recent ticket email deliveries (`limit`, `offset`) |
| `GET` | `/notifications/summary` | delivery counts by status |
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

The same service consumes the `notifications` queue. Each
`purchase.completed` event is claimed once, rendered and sent as a ticket email.
The broker adds `notifications.retry` for delayed retries and
`notifications.dlq` for parked messages; see
[RabbitMQ](../observability/rabbitmq.md) for topology and checks.

## Delivery API

`GET /notifications?limit=20&offset=0` returns the delivery store in the shared
list envelope:

```json
{
  "data": [
    {
      "eventId": "b2ad7305-b6b2-432f-a2b2-949fd3124811",
      "orderId": "078daa94-3126-45e1-ba97-46ab3d83c9f0",
      "recipient": "buyer@example.com",
      "status": "delivered",
      "attempts": 2,
      "lastError": "Connection timeout",
      "createdAt": "2026-11-16T18:13:18.000Z",
      "updatedAt": "2026-11-16T18:13:53.000Z"
    }
  ],
  "meta": { "total": 1, "limit": 20, "offset": 0 }
}
```

`GET /notifications/summary` returns `{ "data": { "total": 1, "byStatus": {
"delivered": 1, "retrying": 0, "dead": 0, "skipped": 0, "sending": 0 } } }`.

Statuses: `sending`, `delivered`, `retrying`, `dead`, `skipped`. The web BFF
exposes the same data to staff at `/api/admin/notifications`.

## Health

```bash
docker compose exec -T notify node -e "fetch('http://127.0.0.1:3000/health').then(r=>r.text()).then(console.log)"
```

Expected: `{"status":"ok"}`.
