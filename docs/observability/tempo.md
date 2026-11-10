# Tempo

## What it is for

Tempo stores distributed traces. It receives spans from applications through the
OpenTelemetry Collector and serves them to Grafana for the waterfall view.

Tempo is what turns one request into a visible chain:

```
POST /api/events
  └── auth: POST /auth/introspect
  └── catalog: GET /performers/:id
  └── catalog: GET /venues/:id
  └── ticketing: pg.query:INSERT db_ticketing
```

Without traces you see separate metrics and logs; with them you see causality.

## Configuration

| Item | File |
| --- | --- |
| config | `infra/tempo/tempo-config.yml` |
| receiving | OTLP gRPC `4317` and HTTP `4318` **inside** the container |
| storage | `tempodata` volume, `/var/tempo` |
| container | `concert-ops-tempo`, port `3200` |

Applications do not talk to Tempo directly: they send OTLP to
`otel-collector`, which exports to `tempo:4317`.

## How to verify

1. Readiness:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3200/ready |
  Select-Object -ExpandProperty Content
```

Expected: `ready`. A `503` during the first 20–30 seconds is normal.

2. Search traces:

```powershell
$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$r = Invoke-RestMethod "http://localhost:3200/api/search?limit=10&start=$($now-900)&end=$now"
$r.traces | Select-Object rootServiceName, traceID, durationMs
```

3. One trace:

```powershell
Invoke-RestMethod "http://localhost:3200/api/traces/<traceID>"
```

The response contains `batches`, `resource.attributes` with `service.name` and
`scopeSpans` with names such as `POST`, `pg.query:SELECT db_ticketing`.

4. Grafana: the **Traces** dashboard (`concert-ops-traces`) lists recent and
   error traces. For the waterfall, use **Explore → Tempo → Search**, service
   `ticketing`, or:

```
{resource.service.name="ticketing"}
```

5. Generate a fresh trace: make a request, wait about 10 seconds for the
   exporter batch and search again. Creating an event is ideal because it
   touches `ticketing`, `auth` and `catalog`.

## Where it is used in code

The SDK starts in `src/shared/observability/tracing.ts`:

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

The exporter sends spans to the collector (`OTEL_EXPORTER_OTLP_ENDPOINT`), not
to Tempo. The tracing import is first in every `server.ts` so express and pg are
instrumented before the app is created:

```ts
import { shutdownTracing } from '@/shared/observability/tracing.js';
import { createApp } from '@/services/ticketing/app.js';
```

On shutdown the SDK flushes its buffer:

```ts
server.close(() => {
  void shutdownTracing().finally(() => {
    process.exit(0);
  });
});
```

`fetch` calls between services automatically carry `traceparent`, so one trace
joins `ticketing`, `auth` and `catalog`. Storage settings live in
`infra/tempo/tempo-config.yml`:

```yaml
storage:
  trace:
    backend: local
    local:
      path: /var/tempo/blocks
    wal:
      path: /var/tempo/wal
```
