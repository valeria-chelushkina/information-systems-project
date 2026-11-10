# RabbitMQ

## What it is for

RabbitMQ is the message broker between services. In this project it connects
`ticketing` and `notify`: after a successful purchase, `ticketing` publishes
`purchase.completed` and `notify` processes it independently.

Why it matters:

- a purchase does not wait for notification delivery;
- if `notify` is down, messages wait in a durable queue;
- services know only the exchange and routing key, not each other's address;
- the queue buffers spikes.

Topology:

```
ticketing ──publish──► exchange concert-ops (direct, durable)
                              routing key: purchase.completed
                              │
                              ▼
                       queue notifications (durable)
                              │
                              ▼
                       notify consumer (prefetch 10, manual ack)
```

## Configuration

| Item | Where |
| --- | --- |
| broker | `docker-compose.yml`, service `rabbitmq` |
| image | `rabbitmq:4.0-management` |
| AMQP | `localhost:5672` |
| management UI | `http://localhost:15672` |
| Prometheus metrics | `http://localhost:15692/metrics` |
| storage | `rabbitmqdata` volume, `/var/lib/rabbitmq` |
| credentials | `RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASSWORD` |

`rabbitmq_prometheus` is enabled by the container command, following the course
example:

```yaml
command: >
  bash -lc "rabbitmq-plugins enable --offline rabbitmq_prometheus && rabbitmq-server"
```

That is why metrics are available on `15692` without a separate exporter.

## How to verify

1. Container is healthy:

```powershell
docker compose ps rabbitmq
```

2. Management UI: `http://localhost:15672`, login `admin` / `admin`.

   **Queues → notifications** should show `1 consumer`, `Ready: 0`,
   `Unacked: 0`. **Exchanges** contains `concert-ops` of type `direct`.

3. Broker metrics:

```powershell
$m = (Invoke-WebRequest -UseBasicParsing http://localhost:15692/metrics).Content
$m -split "`n" | Select-String "^rabbitmq_queue_consumers|^rabbitmq_queue_messages_ready"
```

Expected: `rabbitmq_queue_consumers 1`, `rabbitmq_queue_messages_ready 0`.

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
"event":"purchase.completed","order_id":"...","msg":"purchase notification received"
```

6. Durability: stop the consumer, buy tickets, see `Ready` grow, then start it:

```powershell
docker compose stop notify
# a few purchases
docker compose start notify
```

`Ready` returns to `0` and `ack` grows; messages are not lost because the queue
and messages are durable.

7. Application metrics in Prometheus:

```promql
sum(rate(rabbitmq_messages_published_total[5m]))
sum by (status) (rate(rabbitmq_messages_consumed_total[5m]))
sum(rate(rabbitmq_queue_messages_acked_total[5m]))
rabbitmq_queue_messages_ready
rabbitmq_queue_consumers
```

8. Grafana: **RabbitMQ queue depth**, **throughput**, **consumers** and
   **publish failures** on the Messaging dashboard.

## Where it is used in code

The topology is defined once in
`src/shared/messaging/purchase-topology.ts`:

```ts
export const PURCHASE_EXCHANGE = 'concert-ops';
export const PURCHASE_QUEUE = 'notifications';
export const PURCHASE_ROUTING_KEY = 'purchase.completed';

export async function assertPurchaseTopology(channel: Channel | ConfirmChannel): Promise<void> {
  await channel.assertExchange(PURCHASE_EXCHANGE, 'direct', { durable: true });
  await channel.assertQueue(PURCHASE_QUEUE, { durable: true });
  await channel.bindQueue(PURCHASE_QUEUE, PURCHASE_EXCHANGE, PURCHASE_ROUTING_KEY);
}
```

Publishing lives in
`src/services/ticketing/messaging/purchase.publisher.ts`. It uses a confirm
channel: a publish succeeds only after the broker confirms it.

```ts
await new Promise<void>((resolve, reject) => {
  channel.publish(
    PURCHASE_EXCHANGE,
    PURCHASE_ROUTING_KEY,
    Buffer.from(JSON.stringify(event)),
    { persistent: true, contentType: 'application/json', messageId: event.id },
    (error) => (error ? reject(error) : resolve()),
  );
});
```

The call happens after the purchase transaction commits
(`purchases.service.ts`), so a failed purchase never publishes an event:

```ts
purchasesTotal.inc({ status: 'ok' });
ticketsSoldTotal.inc(result.tickets.length);
revenueCentsTotal.inc(result.order.totalCents);

void this.publisher.publish(result);
```

The consumer is
`src/services/notify/modules/notifications/notifications.consumer.ts`. It sets
`prefetch(10)`, validates the payload with zod and acknowledges only after
successful handling:

```ts
const event = purchaseCompletedSchema.parse(JSON.parse(message.content.toString()));

this.service.handle(event);
channel.ack(message);
messagesConsumedTotal.inc({ event: PURCHASE_EVENT, status: 'ok' });
```

Invalid messages are rejected without requeue (`nack(message, false, false)`)
to avoid an infinite loop.

Application metrics live in `src/shared/observability/messaging-metrics.ts`:

```ts
export const messagesPublishedTotal = new Counter({
  name: 'rabbitmq_messages_published_total',
  help: 'Messages published to RabbitMQ',
  labelNames: ['event'] as const,
  registers: [registry],
});
```

`rabbitmq_queue_*` are broker metrics from `15692`. In RabbitMQ 4.0 they are
aggregated by default (no `queue` label), so panels and alerts use totals. The
system has one queue, so this is unambiguous. Per-queue labels would require
`prometheus.return_per_object_metrics`.
