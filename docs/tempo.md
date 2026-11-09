# Tempo

## Що це і навіщо

Tempo — сховище розподілених трейсів. У проєкті він зберігає spans, які
надходять від застосунків через OpenTelemetry Collector, і віддає їх Grafana
для перегляду waterfall.

Tempo потрібен, щоб побачити шлях одного запиту:

```
POST /api/events
  └── auth: POST /auth/introspect
  └── catalog: GET /performers/:id
  └── catalog: GET /venues/:id
  └── ticketing: pg.query:INSERT db_ticketing
```

Без трейсів ви бачите лише окремі метрики й логи; з ними — причинно-наслідковий
ланцюжок між сервісами.

## Де налаштовано

| Що | Файл |
| --- | --- |
| конфігурація | `infra/tempo/tempo-config.yml` |
| приймання | OTLP gRPC `4317` і HTTP `4318` **усередині** контейнера |
| зберігання | том `tempodata`, `/var/tempo` |
| контейнер | `concert-ops-tempo`, порт `3200` |

Застосунки не звертаються до Tempo напряму: вони надсилають OTLP у
`otel-collector`, а той експортує в `tempo:4317`.

## Як перевірити

1. Готовність:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3200/ready |
  Select-Object -ExpandProperty Content
```

Очікувано: `ready`. Перші 20–30 секунд після старту можливий `503`.

2. Пошук трейсів:

```powershell
$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$r = Invoke-RestMethod "http://localhost:3200/api/search?limit=10&start=$($now-900)&end=$now"
$r.traces | Select-Object rootServiceName, traceID, durationMs
```

3. Один трейс:

```powershell
Invoke-RestMethod "http://localhost:3200/api/traces/<traceID>"
```

У відповіді будуть `batches`, `resource.attributes` з `service.name` і
`scopeSpans` з назвами на кшталт `POST`, `pg.query:SELECT db_ticketing`.

4. У Grafana: **Explore → Tempo → Search**, service name `ticketing`, або
   запит:

```
{resource.service.name="ticketing"}
```

5. Згенерувати свіжий трейс: виконати будь-який запит до сервісу, зачекати
   ~10 секунд (батч експортера) і повторити пошук. Найкраще підходить
   створення події — воно торкається `ticketing`, `auth` і `catalog`.

## Де це в коді

SDK стартує в `src/shared/observability/tracing.ts`:

```ts
const sdk = new NodeSDK({
  resource: resourceFromAttributes({ 'service.name': config.serviceName }),
  traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (request) =>
          request.url === '/metrics' || request.url === '/health',
      },
    }),
  ],
});

sdk.start();
```

Експортер відправляє spans у колектор (`OTEL_EXPORTER_OTLP_ENDPOINT`), а не
напряму в Tempo. Імпорт tracing стоїть першим у кожному `server.ts`, щоб
express і pg були інструментовані до створення застосунку:

```ts
import { shutdownTracing } from '@/shared/observability/tracing.js';
import { createApp } from '@/services/ticketing/app.js';
```

Під час завершення процесу SDK зливає буфер:

```ts
server.close(() => {
  void shutdownTracing().finally(() => {
    process.exit(0);
  });
});
```

Виклики `fetch` між сервісами автоматично отримують заголовок `traceparent`,
тому один трейс об'єднує `ticketing`, `auth` і `catalog`. Конфігурація
сховища — `infra/tempo/tempo-config.yml`:

```yaml
storage:
  trace:
    backend: local
    local:
      path: /var/tempo/blocks
    wal:
      path: /var/tempo/wal
```

## Типові проблеми

| Симптом | Причина | Що робити |
| --- | --- | --- |
| `/ready` довго `503` | ingester ще стартує | зачекати 30 секунд |
| пошук порожній | немає трафіку або вузький час | зробити запит, розширити діапазон |
| трейси лише одного сервісу | не передається `traceparent` | перевірити виклики `fetch` між сервісами |
| багато коротких трейсів `ticketing` | це запити sweeper'а поза HTTP | очікувано, фільтруйте за route/service |
