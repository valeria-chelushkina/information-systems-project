# notify

## Що це і навіщо

`notify` виконує дві ролі:

1. **Webhook-приймач Alertmanager** — приймає `POST /alerts`, перевіряє
   payload і пише кожен алерт у структурований лог.
2. **Споживач RabbitMQ** — читає чергу `notifications` і обробляє події
   `purchase.completed` від `ticketing`.

Перша роль замикає ланцюг сповіщень:

```
Prometheus → Alertmanager → notify → stdout → Alloy → Loki → Grafana
```

Друга — асинхронний обмін повідомленнями:

```
ticketing → RabbitMQ (notifications) → notify → stdout → Alloy → Loki
```

Сервіс не має власного порту на хості: він доступний лише всередині мережі
Compose за адресою `http://notify:3000`. Клієнти — Alertmanager і RabbitMQ.

## Де налаштовано

| Що | Файл |
| --- | --- |
| express-застосунок | `src/services/notify/app.ts` |
| запуск | `src/services/notify/server.ts` |
| маршрут | `src/services/notify/modules/alerts/alerts.router.ts` |
| контролер | `src/services/notify/modules/alerts/alerts.controller.ts` |
| сервіс | `src/services/notify/modules/alerts/alerts.service.ts` |
| схема payload | `src/services/notify/modules/alerts/alerts.schemas.ts` |
| споживач RabbitMQ | `src/services/notify/modules/notifications/notifications.consumer.ts` |
| обробка події | `src/services/notify/modules/notifications/notifications.service.ts` |
| контейнер | `concert-ops-notify`, порт `3000` всередині мережі |
| черга | `notifications`, exchange `concert-ops`, ключ `purchase.completed` |

Payload відповідає формату Alertmanager webhook v4 і містить масив `alerts`
з полями `status`, `labels`, `annotations`, `startsAt`, `endsAt`.

## Як перевірити

1. Контейнер запущений:

```powershell
docker compose ps notify
```

2. Сервіс відповідає на health:

```powershell
docker compose exec -T notify node -e "fetch('http://127.0.0.1:3000/health').then(r=>r.text()).then(console.log)"
```

Очікувано: `{"status":"ok"}`.

3. Ручний алерт:

```powershell
docker compose exec -T notify node -e "fetch('http://127.0.0.1:3000/alerts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alerts:[{status:'firing',labels:{alertname:'TestAlert',severity:'warning'},annotations:{summary:'manual test'}}]})}).then(r=>r.text()).then(console.log)"
```

Очікувано: `{"status":"ok","received":1}`.

4. Лог:

```powershell
docker logs concert-ops-notify --tail 20
```

Очікувано:

```
{"level":40,"service":"notify","alert":"TestAlert","status":"firing","severity":"warning","msg":"alert received"}
```

5. У Loki:

```logql
{container="concert-ops-notify"} |= "alert"
```

6. Справжній алерт: див. розділ перевірки в
   [alertmanager.md](alertmanager.md). У логах з'являться `alert received`
   для `firing` і `alert resolved` після відновлення.

7. Споживач RabbitMQ запущений:

```powershell
docker logs concert-ops-notify --tail 20 | Select-String "purchase consumer started"
```

Очікувано: `"queue":"notifications","msg":"purchase consumer started"`.

8. Після покупки в логах з'являється подія:

```
"event":"purchase.completed","order_id":"...","msg":"purchase notification received"
```

Детальніше — у [rabbitmq.md](rabbitmq.md).

## Де це в коді

Маршрут (`src/services/notify/modules/alerts/alerts.router.ts`):

```ts
alertsRouter.post('/alerts', alertsController.handle);
```

Контролер перевіряє payload і повертає кількість прийнятих алертів
(`alerts.controller.ts`):

```ts
const { alerts } = validate(notificationSchema, req.body);

this.service.handle(alerts);

res.status(200).json({ status: 'ok', received: alerts.length });
```

Схема описує формат Alertmanager webhook v4 (`alerts.schemas.ts`):

```ts
export const alertSchema = z.object({
  status: z.enum(['firing', 'resolved']),
  labels: z.record(z.string(), z.string()),
  annotations: z.record(z.string(), z.string()).default({}),
});
```

Сервіс перетворює кожен алерт у лог-рядок (`alerts.service.ts`):

```ts
if (alert.status === 'firing') {
  this.logger.warn(payload, 'alert received');
} else {
  this.logger.info(payload, 'alert resolved');
}
```

Підключення до застосунку — у `src/services/notify/app.ts`:

```ts
app.use(requestContext());
app.use(requestMetrics);
app.use(healthRouter);
app.use(metricsRouter);
app.use(alertsRouter);
```

Саме тому кожен виклик Alertmanager також з'являється в метриках
`http_requests_total{service="notify"}`.

Споживач RabbitMQ стартує разом із сервісом
(`src/services/notify/server.ts`):

```ts
const consumer = new NotificationsConsumer();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'notify service listening');
  void consumer.start();
});
```

Обробка повідомлення (`notifications.consumer.ts`) підтверджує його лише
після успішної валідації та обробки:

```ts
const event = purchaseCompletedSchema.parse(JSON.parse(message.content.toString()));

this.service.handle(event);
channel.ack(message);
messagesConsumedTotal.inc({ event: PURCHASE_EVENT, status: 'ok' });
```

## Типові проблеми

| Симптом | Причина | Що робити |
| --- | --- | --- |
| `400 validation_failed` | payload не містить масиву `alerts` | перевірити формат Alertmanager |
| у логах немає записів | Alertmanager не викликає webhook | перевірити receiver `url` |
| health не відповідає | контейнер не запущений | `docker logs concert-ops-notify` |
| лог є, у Loki немає | Alloy не бачить контейнер | див. [alloy.md](alloy.md) |
