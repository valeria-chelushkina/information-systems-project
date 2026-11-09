# Prometheus

## Що це і навіщо

Prometheus — центральне сховище метрик. Він кожні 10 секунд опитує `/metrics`
кожного сервісу (pull-модель), зберігає часові ряди на томі `promdata`,
обчислює правила алертів і віддає дані Grafana.

У проєкті це єдине джерело числових даних:

- HTTP-метрики: `http_requests_total`, `http_request_duration_seconds`;
- метрики БД із застосунку: `db_pool_waiting_requests`, `db_query_duration_seconds`;
- бізнес-метрики: `tickets_sold_total`, `purchases_total`, `revenue_cents_total`;
- метрики PostgreSQL від `postgres_exporter`;
- стан таргетів: `up`, `pg_up`.

## Де налаштовано

| Що | Файл |
| --- | --- |
| таргети збору | `infra/prometheus/prometheus.yml` |
| правила алертів | `infra/prometheus/alerts.yml` |
| записані метрики | `infra/prometheus/recording-rules.yml` |
| зберігання | том `promdata`, шлях `/prometheus` |
| контейнер | `concert-ops-prometheus`, порт `9090` |

Чотири таргети застосунків (`ticketing`, `catalog`, `auth`, `notify`), два
таргети PostgreSQL (`postgres-ticketing`, `postgres-catalog`), RabbitMQ і сам
Prometheus — разом вісім.

## Як перевірити

1. Контейнер запущений:

```powershell
docker compose ps prometheus
```

2. Готовність:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:9090/-/ready |
  Select-Object -ExpandProperty Content
```

Очікувано: `Prometheus Server is Ready.`

3. Таргети збору: відкрити `http://localhost:9090/targets`. Усі вісім таргетів
   мають бути `UP`. Те саме через API:

```powershell
(Invoke-RestMethod http://localhost:9090/api/v1/targets).data.activeTargets |
  Select-Object @{ n = 'job'; e = { $_.labels.job } }, health
```

4. Правила: `http://localhost:9090/rules` — група `default` з 15 алертами
   та група `concert-ops` з 10 записаними метриками. Алерти мають стан
   `inactive` / `pending` / `firing`.

5. Поточні алерти: `http://localhost:9090/alerts`.

6. Запит у `http://localhost:9090/graph`:

```promql
up
sum by (service) (rate(http_requests_total[5m]))
sum by (status) (rate(purchases_total[5m]))
pg_up
```

7. Перевірка конфігурації без перезапуску:

```powershell
docker exec concert-ops-prometheus promtool check config /etc/prometheus/prometheus.yml
docker exec concert-ops-prometheus promtool check rules /etc/prometheus/alerts.yml
```

## Де це в коді

Метрики створюються через `prom-client` у
`src/shared/observability/metrics.ts`:

```ts
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests handled',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});
```

Маршрут, який віддає реєстр (`src/shared/http/routes/metrics.ts`):

```ts
metricsRouter.get('/metrics', async (_req, res) => {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});
```

Таргет збору описується в `infra/prometheus/prometheus.yml`:

```yaml
- job_name: 'ticketing'
  static_configs:
    - targets: ['ticketing:3000']
      labels:
        instance_group: concert-ops
        instance_env: lab
        instance_type: service
        team: backend
```

Правило алерту береться з `infra/prometheus/alerts.yml`:

```yaml
- alert: ServiceDown
  expr: up{instance_type='service'} == 0
  for: 5m
  labels:
    severity: critical
```

`up` з'являється автоматично для кожного таргету; `http_requests_total` —
з middleware `requestMetrics`, який викликається після завершення запиту.

## Типові проблеми

| Симптом | Причина | Що робити |
| --- | --- | --- |
| таргет `DOWN` | контейнер не запущений або слухає інший порт | `docker compose ps`, `docker logs` |
| `up == 0` лише для експортера | експортер не може підключитися до БД | див. [postgres-exporter.md](postgres-exporter.md) |
| правило не з'являється | синтаксична помилка у `alerts.yml` | `promtool check rules` |
| немає свіжих даних | щойно перезапустили сервіс | зачекати 10–20 секунд |
