# notify

## What it is for

`notify` has three roles:

1. **Alertmanager webhook receiver** — accepts `POST /alerts`, validates the
   payload and writes every alert to a structured log.
2. **RabbitMQ consumer** — reads the `notifications` queue and processes
   `purchase.completed` events from `ticketing`.
3. **Ticket email worker** — claims each event once, renders the ticket email
   with the entry codes and sends it through Mailpit or SMTP. Failures are
   retried with a delay and parked in `notifications.dlq`.

The alert path:

```
Prometheus → Alertmanager → notify → stdout → Alloy → Loki → Grafana
                         └→ SMTP → email
```

The messaging path:

```
ticketing → RabbitMQ (notifications) → notify → ticket email → Mailpit / SMTP
                                            └→ delivery state (SQLite)
                                            └→ stdout → Alloy → Loki
```

The service has no host port: it is reachable only inside the Compose network
at `http://notify:3000`. Its clients are Alertmanager, RabbitMQ and the web BFF
(read-only delivery API).

## Configuration

| Item | File |
| --- | --- |
| express app | `src/services/notify/app.ts` |
| startup | `src/services/notify/server.ts` |
| alert route | `src/services/notify/modules/alerts/alerts.router.ts` |
| alert controller | `src/services/notify/modules/alerts/alerts.controller.ts` |
| alert service | `src/services/notify/modules/alerts/alerts.service.ts` |
| alert schema | `src/services/notify/modules/alerts/alerts.schemas.ts` |
| alert email | `src/services/notify/modules/alerts/alerts.email.ts` |
| email config | `src/services/notify/config.ts` |
| RabbitMQ consumer | `src/services/notify/modules/notifications/notifications.consumer.ts` |
| notification handler | `src/services/notify/modules/notifications/notifications.service.ts` |
| ticket email | `src/services/notify/modules/notifications/notifications.email.ts` |
| delivery store | `src/services/notify/modules/notifications/deliveries.repository.ts` |
| delivery API | `src/services/notify/modules/notifications/notifications.router.ts` |
| local inbox | Mailpit, `http://localhost:8025` |
| database | SQLite, `notifydata` volume, `/app/data/notify.db` |
| container | `concert-ops-notify`, port `3000` internally |
| queue | `notifications`, exchange `concert-ops`, key `purchase.completed` |
| retry queue | `notifications.retry`, TTL `PURCHASE_RETRY_DELAY_MS` |
| parking queue | `notifications.dlq` |

The Alertmanager payload follows webhook v4: an `alerts` array with `status`,
`labels`, `annotations`, `startsAt` and `endsAt`.

## Alert email

Email is sent by Alertmanager, not by `notify`; see
[Alertmanager](alertmanager.md#email-notifications). Its receiver contains both
the email integration and the webhook, so `notify` only logs the alert for Loki.

`notify` still contains an optional SMTP sender (`SMTP_*`, `ALERT_EMAIL_TO`,
`ALERT_EMAIL_RETRY_MINUTES`) for standalone use, but Compose does not pass those
variables to it. Enabling both paths would send two emails per alert.

## Ticket email pipeline

Every `purchase.completed` event carries the customer address, the order total
and the event snapshot (`title`, `performerName`, `venueName`, `startsAt`), plus
one entry code per ticket.

1. **Claim** — `notification_deliveries` stores one row per event id. The claim
   is an atomic `INSERT … ON CONFLICT DO UPDATE … WHERE status <> 'delivered'`:
   a delivered event is skipped, a redelivery increments `attempts`.
2. **Render** — `notifications.email.ts` builds a plain-text and an HTML email
   with the order link, total, event details and the entry codes.
3. **Send** — `TICKET_EMAIL_TRANSPORT=mailpit` (default) sends to Mailpit at
   `mailpit:1025`; `smtp` uses the existing `SMTP_*` credentials.
4. **Retry** — a transient failure publishes the message to
   `notifications.retry`. That queue holds it for `PURCHASE_RETRY_DELAY_MS`
   (30 s by default) and then dead-letters it back to the main exchange, so the
   consumer sees the same event again with `x-attempts` incremented.
5. **Park** — after `PURCHASE_MAX_ATTEMPTS` (4 by default) the row becomes
   `dead` and the message is published to `notifications.dlq`.
6. **Observe** — `notification_deliveries_total{status}` counts `delivered`,
   `retried`, `dead_lettered`, `skipped` and `invalid`; the admin panel reads
   the same state through `GET /notifications`. The last error is kept after a
   successful retry, so a two-attempt row shows `Recovered after: <error>`.

Changing `PURCHASE_RETRY_DELAY_MS` changes the retry queue argument, so the
queue must be deleted once (`rabbitmqctl delete_queue notifications.retry`) or
redeclared through the management UI before the next start.

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
"event_id":"...","order_id":"...","attempts":1,"message_id":"<...>","msg":"ticket email sent"
```

9. Mailpit inbox: `http://localhost:8025` shows the message with the subject
   `Your tickets: <event>`, the total and one entry code per ticket.

10. Delivery API:

```powershell
docker compose exec -T notify node -e "fetch('http://127.0.0.1:3000/notifications?limit=5').then(r=>r.json()).then(j=>console.log(JSON.stringify(j,null,2)))"
```

11. Admin panel: **Notifications** in the sidebar shows the same rows with
    status, attempts and the last error. See
    [notify API](../api/notify.md#delivery-api).

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
app.use(notificationsRouter);
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

Message handling (`notifications.consumer.ts`) acknowledges only after the
outcome is committed to the broker or the delivery store:

```ts
const event = purchaseCompletedSchema.parse(JSON.parse(message.content.toString()));
const outcome = await this.service.handle(event);

if (outcome.status === 'retry') {
  await this.requeueWithDelay(channel, message, outcome.attempts + 1, outcome.error);
} else if (outcome.status === 'dead') {
  await this.moveToDeadLetter(channel, message, outcome.error);
}

channel.ack(message);
messagesConsumedTotal.inc({ event: PURCHASE_EVENT, status: outcome.status });
```

`service.handle` claims the event, sends the email and writes the delivery row;
the consumer only decides whether the message is acked, delayed or parked.
