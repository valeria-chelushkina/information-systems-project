# RabbitMQ

## Що це і навіщо

RabbitMQ — брокер повідомлень між сервісами. У проєкті він розв'язує
`ticketing` і `notify`: після успішної покупки `ticketing` публікує подію
`purchase.completed`, а `notify` незалежно її обробляє.

Навіщо це потрібно:

- покупка не чекає на надсилання сповіщення;
- якщо `notify` тимчасово недоступний, повідомлення накопичуються в черзі й
  обробляються після відновлення;
- сервіси не знають адрес один одного — тільки exchange і routing key;
- черга дає природний буфер для сплесків навантаження.

Топологія:

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

## Де налаштовано

| Що | Де |
| --- | --- |
| брокер | `docker-compose.yml`, сервіс `rabbitmq` |
| образ | `rabbitmq:4.0-management` |
| AMQP | `localhost:5672` |
| Management UI | `http://localhost:15672` |
| Prometheus-метрики | `http://localhost:15692/metrics` |
| зберігання | том `rabbitmqdata`, `/var/lib/rabbitmq` |
| облікові дані | `RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASSWORD` з `.env` |

`rabbitmq_prometheus` вмикається командою контейнера, як у прикладі курсу:

```yaml
command: >
  bash -lc "rabbitmq-plugins enable --offline rabbitmq_prometheus && rabbitmq-server"
```

Саме тому метрики доступні на `15692` без окремого експортера
(`kbudde/rabbitmq-exporter` не потрібен).

## Як перевірити

1. Контейнер здоровий:

```powershell
docker compose ps rabbitmq
```

2. Management UI: `http://localhost:15672`, логін `admin` / `admin`.

   **Queues → notifications** повинна мати `1 consumer`, `Ready: 0`,
   `Unacked: 0`. Вкладка **Exchanges** містить `concert-ops` типу `direct`.

3. Метрики брокера:

```powershell
$m = (Invoke-WebRequest -UseBasicParsing http://localhost:15692/metrics).Content
$m -split "`n" | Select-String "^rabbitmq_queue_consumers|^rabbitmq_queue_messages_ready"
```

Очікувано: `rabbitmq_queue_consumers 1`, `rabbitmq_queue_messages_ready 0`.

4. Prometheus бачить ціль `rabbitmq` у `http://localhost:9090/targets` зі
   станом `UP` і міткою `instance_type="broker"`.

5. Наскрізна перевірка: виконати кілька покупок і подивитися лог
   споживача:

```powershell
npm run scenario -- --name=purchase --rate=2 --duration=3 `
  --ticketing-url=http://127.0.0.1:3002 `
  --catalog-url=http://127.0.0.1:3004

docker logs concert-ops-notify --tail 20
```

У логах буде:

```
"event":"purchase.completed","order_id":"...","msg":"purchase notification received"
```

6. Перевірка стійкості черги: зупинити споживача, зробити покупки, побачити
   зростання `Ready`, потім запустити споживача знову:

```powershell
docker compose stop notify
# кілька покупок
docker compose start notify
```

Після старту `Ready` повертається до `0`, а кількість `ack` зростає —
повідомлення не втрачаються, бо черга та повідомлення durable.

7. Метрики застосунків у Prometheus:

```promql
sum(rate(rabbitmq_messages_published_total[5m]))
sum by (status) (rate(rabbitmq_messages_consumed_total[5m]))
sum(rate(rabbitmq_queue_messages_acked_total[5m]))
rabbitmq_queue_messages_ready
rabbitmq_queue_consumers
```

8. Grafana: панелі **RabbitMQ queue depth**, **RabbitMQ throughput**,
   **RabbitMQ consumers**, **RabbitMQ publish failures**.

## Де це в коді

Топологія описана один раз у `src/shared/messaging/purchase-topology.ts`:

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

Публікація — `src/services/ticketing/messaging/purchase.publisher.ts`.
Використовується confirm channel: публікація вважається успішною лише після
підтвердження брокера.

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

Виклик стоїть після коміту транзакції покупки
(`purchases.service.ts`), тому подія не публікується для невдалої покупки:

```ts
purchasesTotal.inc({ status: 'ok' });
ticketsSoldTotal.inc(result.tickets.length);
revenueCentsTotal.inc(result.order.totalCents);

void this.publisher.publish(result);
```

Споживач — `src/services/notify/modules/notifications/notifications.consumer.ts`.
Він робить `prefetch(10)`, перевіряє payload через zod і підтверджує
повідомлення лише після успішної обробки:

```ts
const event = purchaseCompletedSchema.parse(JSON.parse(message.content.toString()));

this.service.handle(event);
channel.ack(message);
messagesConsumedTotal.inc({ event: PURCHASE_EVENT, status: 'ok' });
```

Якщо повідомлення некоректне, воно відхиляється без повторної постановки
(`nack(message, false, false)`), щоб не створити нескінченний цикл.

Метрики застосунку — `src/shared/observability/messaging-metrics.ts`:

```ts
export const messagesPublishedTotal = new Counter({
  name: 'rabbitmq_messages_published_total',
  help: 'Messages published to RabbitMQ',
  labelNames: ['event'] as const,
  registers: [registry],
});
```

`rabbitmq_queue_*` — це метрики самого брокера з `15692`. У RabbitMQ 4.0
вони агреговані за замовчуванням (без мітки `queue`), тому панелі й алерти
використовують загальні значення; у системі лише одна черга, тому це
однозначно. Для метрик по кожній черзі окремо потрібно увімкнути
`prometheus.return_per_object_metrics` у конфігурації RabbitMQ.

## Типові проблеми

| Симптом | Причина | Що робити |
| --- | --- | --- |
| у логах `rabbitmq consumer unavailable; retrying in 5s` | брокер ще стартує | зачекати, `docker compose ps rabbitmq` |
| черги `notifications` немає | не запускався ні публікатор, ні споживач | виконати покупку, перевірити логи `notify` |
| `Ready` зростає, `consumers = 0` | `notify` зупинений | `docker compose start notify` |
| `PRECONDITION_FAILED` | черга або exchange вже створені з іншими параметрами | видалити чергу/exchange у dev-середовищі |
| `15692` не відповідає | плагін не увімкнено | `docker logs concert-ops-rabbitmq`, шукати `rabbitmq_prometheus` |
| 401 у UI | невірні `RABBITMQ_DEFAULT_*` | перевірити `.env`, перестворити контейнер |
