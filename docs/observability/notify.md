# notify

## What it is for

`notify` has two roles:

1. **Alertmanager webhook receiver** — accepts `POST /alerts`, validates the
   payload and writes every alert to a structured log.
2. **RabbitMQ consumer** — reads the `notifications` queue and processes
   `purchase.completed` events from `ticketing`.

The alert path:

```
Prometheus → Alertmanager → notify → stdout → Alloy → Loki → Grafana
```

The messaging path:

```
ticketing → RabbitMQ (notifications) → notify → stdout → Alloy → Loki
```

The service has no host port: it is reachable only inside the Compose network
at `http://notify:3000`. Its clients are Alertmanager and RabbitMQ.

## Configuration

| Item | File |
| --- | --- |
| express app | `src/services/notify/app.ts` |
| startup | `src/services/notify/server.ts` |
| alert route | `src/services/notify/modules/alerts/alerts.router.ts` |
| alert controller | `src/services/notify/modules/alerts/alerts.controller.ts` |
| alert service | `src/services/notify/modules/alerts/alerts.service.ts` |
| alert schema | `src/services/notify/modules/alerts/alerts.schemas.ts` |
| RabbitMQ consumer | `src/services/notify/modules/notifications/notifications.consumer.ts` |
| notification handler | `src/services/notify/modules/notifications/notifications.service.ts` |
| container | `concert-ops-notify`, port `3000` internally |
| queue | `notifications`, exchange `concert-ops`, key `purchase.completed` |

The Alertmanager payload follows webhook v4: an `alerts` array with `status`,
`labels`, `annotations`, `startsAt` and `endsAt`.

## How to verify

1. Container is running:

```powershell
docker compose ps notify
```

2. Health:

```powershell
docker compose exec -T notify node -e "fetch('http://127.0.0.1:3000/health').then(r=>r.text()).then(console.log)"
```

Expected: `{"status":"ok"}`.

3. Manual alert:

```powershell
docker compose exec -T notify node -e "fetch('http://127.0.0.1:3000/alerts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alerts:[{status:'firing',labels:{alertname:'TestAlert',severity:'warning'},annotations:{summary:'manual test'}}]})}).then(r=>r.text()).then(console.log)"
```

Expected: `{"status":"ok","received":1}`.

4. Log:

```powershell
docker logs concert-ops-notify --tail 20
```

Expected:

```
{"level":40,"service":"notify","alert":"TestAlert","status":"firing","severity":"warning","msg":"alert received"}
```

5. In Loki:

```logql
{container="concert-ops-notify"} |= "alert"
```

6. A real alert: see [alertmanager.md](alertmanager.md). The log contains
   `alert received` for firing and `alert resolved` after recovery.

7. RabbitMQ consumer started:

```powershell
docker logs concert-ops-notify --tail 20 | Select-String "purchase consumer started"
```

Expected: `"queue":"notifications","msg":"purchase consumer started"`.

8. After a purchase:

```
"event":"purchase.completed","order_id":"...","msg":"purchase notification received"
```

More details in [rabbitmq.md](rabbitmq.md).

## Where it is used in code

Route (`src/services/notify/modules/alerts/alerts.router.ts`):

```ts
alertsRouter.post('/alerts', alertsController.handle);
```

Controller validates the payload and returns the number of accepted alerts
(`alerts.controller.ts`):

```ts
const { alerts } = validate(notificationSchema, req.body);

this.service.handle(alerts);

res.status(200).json({ status: 'ok', received: alerts.length });
```

Schema for the Alertmanager webhook v4 (`alerts.schemas.ts`):

```ts
export const alertSchema = z.object({
  status: z.enum(['firing', 'resolved']),
  labels: z.record(z.string(), z.string()),
  annotations: z.record(z.string(), z.string()).default({}),
});
```

The service turns each alert into a log line (`alerts.service.ts`):

```ts
if (alert.status === 'firing') {
  this.logger.warn(payload, 'alert received');
} else {
  this.logger.info(payload, 'alert resolved');
}
```

Wiring (`src/services/notify/app.ts`):

```ts
app.use(requestContext());
app.use(requestMetrics);
app.use(healthRouter);
app.use(metricsRouter);
app.use(alertsRouter);
```

That is why every Alertmanager call also appears in
`http_requests_total{service="notify"}`.

The RabbitMQ consumer starts with the service
(`src/services/notify/server.ts`):

```ts
const consumer = new NotificationsConsumer();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'notify service listening');
  void consumer.start();
});
```

Message handling (`notifications.consumer.ts`) acknowledges only after
validation and processing:

```ts
const event = purchaseCompletedSchema.parse(JSON.parse(message.content.toString()));

this.service.handle(event);
channel.ack(message);
messagesConsumedTotal.inc({ event: PURCHASE_EVENT, status: 'ok' });
```
