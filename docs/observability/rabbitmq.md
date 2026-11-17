# RabbitMQ

## What it is for

RabbitMQ is the message broker between services. In this project it connects
`ticketing` and `notify`: after a successful purchase, `ticketing` publishes
`purchase.completed` and `notify` processes it independently.

Why it matters:

- a purchase does not wait for notification delivery;
- if `notify` is down, messages wait in a durable queue;
- services know only the exchange and routing key, not each other's address;
- the queue buffers spikes;
- invalid messages are kept in a dead-letter queue instead of disappearing;
- delivery failures are retried with a delay and parked in the dead-letter
  queue after the last attempt.

`notify` does real work: it claims each event once, renders the ticket email
with the entry codes and sends it through Mailpit or SMTP. The broker provides
at-least-once delivery, delayed retries and the parking queue; the consumer
provides idempotency and delivery state.

## Topology

```
ticketing --publish--> exchange concert-ops (direct)
                         routing key purchase.completed
                              |
                              v
                    queue notifications (durable, 1 consumer)
                         |                         |
                consume  |                         | retry (transient failure)
                         v                         v
                      notify            queue notifications.retry
                         |                 TTL 30s
                         |                    |
                         |                    +--> concert-ops (redelivered)
                         |
                         +-- last attempt --> exchange concert-ops.dlx
                                                   routing key notifications.failed
                                                   |
                                                   v
                                            queue notifications.dlq
```
Every service has its own RabbitMQ user and the project uses a dedicated
virtual host, `concert_ops`. The broker itself lives in the `rabbitmq`
container; the exchange, queues and bindings are declared by the application.

## Configuration

| Item | Where |
| --- | --- |
| broker | `docker-compose.yml`, service `rabbitmq` |
| image | `rabbitmq:4.0-management` |
| AMQP | `localhost:5672` |
| management UI | `http://localhost:15672` |
| Prometheus metrics | `http://localhost:15692/metrics` |
| virtual host | `concert_ops` |
| publisher user | `svc_ticketing` |
| consumer user | `svc_notify` |
| users and permissions | `infra/rabbitmq/definitions.json`, loaded at startup by `rabbitmq.conf` |
| plugin config | `infra/rabbitmq/rabbitmq.conf` |
| storage | `rabbitmqdata` volume, `/var/lib/rabbitmq` |
| queues | `notifications`, `notifications.retry`, `notifications.dlq` |
| retry delay | `PURCHASE_RETRY_DELAY_MS` (default `30000`) |
| attempts | `PURCHASE_MAX_ATTEMPTS` (default `4`) |
| ticket email transport | `TICKET_EMAIL_TRANSPORT` (`mailpit` by default, `smtp` for real mail) |
| ticket inbox | Mailpit at `http://localhost:8025` |
| delivery state | SQLite on the `notifydata` volume, `notification_deliveries` table |
| admin credentials | `RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASSWORD` |
| service passwords | `TICKETING_RABBITMQ_PASSWORD`, `NOTIFY_RABBITMQ_PASSWORD` |

`rabbitmq_prometheus` is enabled by the container command, following the course
example:

```yaml
command: >
  bash -lc "rabbitmq-plugins enable --offline rabbitmq_prometheus && rabbitmq-server"
```

`rabbitmq.conf` enables per-object metrics so the dashboard can distinguish
`notifications` from `notifications.dlq`:

```
prometheus.return_per_object_metrics = true
```

The `concert_ops` vhost, both service users and their permissions are declared
in `infra/rabbitmq/definitions.json`. RabbitMQ loads that file at startup via
`load_definitions` in `rabbitmq.conf`, so no separate init container is needed.
The file contains password hashes for the development credentials; if you
change `TICKETING_RABBITMQ_PASSWORD` or `NOTIFY_RABBITMQ_PASSWORD`, regenerate
the hashes with `rabbitmqctl hash_password` and update the definitions file.

## How to verify

1. Container is healthy:

```powershell
docker compose ps rabbitmq
```

2. Management UI: `http://localhost:15672`, login `admin` / `admin`.

   Switch the virtual host to **concert_ops**. Queues should contain
   `notifications` (`1 consumer`, `Ready: 0`, `Unacked: 0`),
   `notifications.retry` (empty, TTL 30s) and `notifications.dlq` (empty).
   Exchanges should contain `concert-ops` and `concert-ops.dlx`, both of type
   `direct`. **Admin → Users** shows `svc_ticketing` and `svc_notify`;
   **Admin → Permissions** shows both under `concert_ops`.

3. Broker metrics with queue labels:

```powershell
$m = (Invoke-WebRequest -UseBasicParsing http://localhost:15692/metrics).Content
$m -split "`n" | Select-String "^rabbitmq_queue_consumers|^rabbitmq_queue_messages_ready"
```

Expected: `rabbitmq_queue_consumers{queue="notifications"} 1` and
`rabbitmq_queue_messages_ready{queue="notifications"} 0`.

4. Prometheus target `rabbitmq` is `UP` at `http://localhost:9090/targets` with
   `instance_type="broker"`.

5. End-to-end: make a few purchases and read the consumer log:

```powershell
npm run scenario -- --name=purchase --rate=2 --duration=3 `
  --ticketing-url=http://127.0.0.1:3002 `
  --catalog-url=http://127.0.0.1:3004

docker logs concert-ops-notify --tail 20
```

Expected:

```
"event_id":"...","order_id":"...","attempts":1,"message_id":"<...>","msg":"ticket email sent"
```

6. Read the email in Mailpit at `http://localhost:8025`. The message contains
   the event, venue, total and one entry code per ticket.

7. Delivery state (notify has no host port):

```powershell
docker compose exec -T notify node -e "fetch('http://127.0.0.1:3000/notifications?limit=5').then(r=>r.json()).then(j=>console.log(JSON.stringify(j,null,2)))"
```

Expected: one row per event with `status` `delivered`, `attempts` and the
recipient.

8. Retry path: stop Mailpit and make a purchase:

```powershell
docker compose stop mailpit
docker logs concert-ops-notify --tail 20
```

Expected: `ticket email scheduled for retry`; the message waits in
`notifications.retry` for `PURCHASE_RETRY_DELAY_MS` and then returns to the main
queue. After `PURCHASE_MAX_ATTEMPTS` the row becomes `dead` and the message is
parked in `notifications.dlq`.

9. Durability: stop the consumer, buy tickets, see `Ready` grow, then start it:

```powershell
docker compose stop notify
# a few purchases
docker compose start notify
```

`Ready` returns to `0` and `ack` grows; messages are not lost because the queue
and messages are durable.

10. Dead-letter queue for invalid payloads: publish `not-a-json` through the
    management UI (**Exchanges → concert-ops → Publish message**, routing key
    `purchase.completed`). The consumer rejects it, and `notifications.dlq`
    receives one message. The **Dead-letter queue** stat on the Messaging
    dashboard turns orange, and `RabbitmqDlqNotEmpty` fires after 5 minutes.
    Purge the DLQ from the UI when done.

11. Application metrics in Prometheus:

```promql
sum(rate(rabbitmq_messages_published_total[5m]))
sum by (status) (rate(rabbitmq_messages_consumed_total[5m]))
sum by (status) (rate(notification_deliveries_total[$__rate_interval]))
sum(increase(notification_deliveries_total{status="dead_lettered"}[1h]))
rabbitmq_queue_messages_ready{queue="notifications"}
rabbitmq_queue_messages_ready{queue="notifications.retry"}
rabbitmq_queue_messages_ready{queue="notifications.dlq"}
rabbitmq_queue_consumers{queue="notifications"}
```

12. Grafana: **Queue depth**, **Throughput**, **Consumers**, **Publish
    failures**, **Dead-letter queue**, **Ticket email deliveries**,
    **Dead-lettered (range)** and **Retry queue ready** on the Messaging
    dashboard. The admin panel adds a **Notifications** page with the same
    delivery state.

## Failure behaviour

| Situation | Behaviour |
| --- | --- |
| `notify` is down | messages accumulate in `notifications`, purchase is unaffected |
| RabbitMQ is down during purchase | publish fails, `rabbitmq_publish_failures_total` grows, the event is not queued |
| consumer crashes before `ack` | message is redelivered (at-least-once) |
| Mailpit or SMTP is down | the row becomes `retrying`, the message waits in `notifications.retry` and is redelivered after the TTL |
| last attempt fails | the row becomes `dead`, the message is parked in `notifications.dlq` |
| invalid JSON or schema | `nack(requeue=false)`, message goes to `notifications.dlq` |
| consumer channel closes | `NotificationsConsumer` reconnects after 5 seconds |
| duplicate delivery | the delivery store skips an event whose row is already `delivered` |

The publish path is intentionally fire-and-forget: `purchases.service.ts`
returns the paid order first and then calls `void this.publishPurchaseEvent(result)`,
so a broker problem never fails a purchase. A transactional outbox is the next
step if delivery must survive a broker outage.

## Where it is used in code

The topology is defined once in
`src/shared/messaging/purchase-topology.ts`:

```ts
export const PURCHASE_EXCHANGE = 'concert-ops';
export const PURCHASE_QUEUE = 'notifications';
export const PURCHASE_ROUTING_KEY = 'purchase.completed';
export const PURCHASE_DLX = 'concert-ops.dlx';
export const PURCHASE_DLQ = 'notifications.dlq';
export const PURCHASE_DLQ_ROUTING_KEY = 'notifications.failed';
export const PURCHASE_RETRY_QUEUE = 'notifications.retry';
export const PURCHASE_RETRY_ROUTING_KEY = 'notifications.retry';
export const PURCHASE_MAX_ATTEMPTS = 4;
export const PURCHASE_RETRY_DELAY_MS = 30000;

await channel.assertExchange(PURCHASE_EXCHANGE, 'direct', { durable: true });
await channel.assertExchange(PURCHASE_DLX, 'direct', { durable: true });
await channel.assertQueue(PURCHASE_QUEUE, {
  durable: true,
  deadLetterExchange: PURCHASE_DLX,
  deadLetterRoutingKey: PURCHASE_DLQ_ROUTING_KEY,
});
await channel.assertQueue(PURCHASE_RETRY_QUEUE, {
  durable: true,
  messageTtl: PURCHASE_RETRY_DELAY_MS,
  deadLetterExchange: PURCHASE_EXCHANGE,
  deadLetterRoutingKey: PURCHASE_ROUTING_KEY,
});
await channel.assertQueue(PURCHASE_DLQ, { durable: true });
await channel.bindQueue(PURCHASE_QUEUE, PURCHASE_EXCHANGE, PURCHASE_ROUTING_KEY);
await channel.bindQueue(PURCHASE_RETRY_QUEUE, PURCHASE_DLX, PURCHASE_RETRY_ROUTING_KEY);
await channel.bindQueue(PURCHASE_DLQ, PURCHASE_DLX, PURCHASE_DLQ_ROUTING_KEY);
```

The publisher lives in
`src/services/ticketing/messaging/purchase.publisher.ts`. It enriches the event
with the event snapshot and the ticket entry codes, then publishes on a confirm
channel with persistent delivery and a `messageId`.

The consumer lives in
`src/services/notify/modules/notifications/notifications.consumer.ts`: it uses a
confirm channel, `prefetch(10)`, validates the payload with zod and asks the
service for an outcome. `delivered` and `skipped` are acked, `retry` is
republished to `notifications.retry`, `dead` goes through `concert-ops.dlx` to
`notifications.dlq`. Invalid payloads are rejected with `nack(requeue=false)`.
Its `start()` loop and channel `close` handler reconnect after 5 seconds.
