# OpenTelemetry Collector

## Що це і навіщо

`otel-collector` — проміжна ланка між застосунками та Tempo. Сервіси
надсилають йому трейси протоколом OTLP, колектор батчить їх і експортує в
Tempo через gRPC.

Навіщо потрібен посередник:

- батчинг і менше мережевих викликів;
- буферизація та повторна відправка, якщо Tempo тимчасово недоступний;
- одне місце, де можна додати семплінг або другий експортер;
- саме така топологія використовується в прикладі курсу.

```
ticketing ─┐
catalog   ─┼── OTLP HTTP :4318 ──► otel-collector ── gRPC :4317 ──► tempo
auth      ─┘
notify    ─┘
```

## Де налаштовано

| Що | Файл |
| --- | --- |
| конфігурація | `infra/tempo/otel-collector-config.yaml` |
| контейнер | `concert-ops-otel-collector` |
| порти на хості | `4317` (gRPC), `4318` (HTTP) |

Конфігурація складається з трьох частин:

```text
receivers   otlp (gRPC 4317, HTTP 4318)
processors  batch
exporters   otlp → tempo:4317, insecure
```

## Як перевірити

1. Контейнер запущений:

```powershell
docker compose ps otel-collector
```

2. Логи колектора:

```powershell
docker logs concert-ops-otel-collector --tail 30
```

Ознаки роботи:

```
Everything is ready. Begin running and processing data.
Exporting finished.  {"kind":"exporter","data_type":"traces","name":"otlp"}
```

3. Застосунки вказують саме на колектор:

```powershell
docker logs concert-ops-ticketing 2>&1 | Select-String "tracing started"
```

Очікувано:

```
"endpoint":"http://otel-collector:4318","msg":"tracing started"
```

4. Наскрізна перевірка: зробити запит, зачекати ~10 секунд і знайти трейс у
   Tempo (див. [tempo.md](tempo.md)). Якщо колектор не передає, у Tempo
   нічого не з'явиться.

5. Помилки експорту:

```powershell
docker logs concert-ops-otel-collector 2>&1 | Select-String "error|failed"
```

## Де це в коді

Повний конвеєр — `infra/tempo/otel-collector-config.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:

exporters:
  otlp:
    endpoint: tempo:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp]
```

Застосунки отримують адресу через змінну середовища в `docker-compose.yml`:

```yaml
environment:
  OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4318
```

А в коді експортер додає шлях `/v1/traces`
(`src/shared/observability/tracing.ts`):

```ts
traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
```

Тобто фактичний запит іде на
`http://otel-collector:4318/v1/traces`, а вже колектор відправляє його в
`tempo:4317` по gRPC.

## Типові проблеми

| Симптом | Причина | Що робити |
| --- | --- | --- |
| немає `Exporting finished` | ніхто не надсилає трейси | перевірити `tracing started` у застосунках |
| `Exporting finished` є, у Tempo порожньо | Tempo не готовий або недоступний | `http://localhost:3200/ready`, логи Tempo |
| застосунок не стартує з OTLP | неправильний `OTEL_EXPORTER_OTLP_ENDPOINT` | має бути `http://otel-collector:4318` |
| колектор падає на старті | синтаксис YAML | `docker logs concert-ops-otel-collector` |
