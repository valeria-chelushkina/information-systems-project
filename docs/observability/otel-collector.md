# OpenTelemetry Collector

## What it is for

`otel-collector` sits between applications and Tempo. Services send traces over
OTLP; the collector batches them and exports to Tempo over gRPC.

Why the extra hop:

- batching and fewer network calls;
- buffering and retry when Tempo is temporarily unavailable;
- one place to add sampling or a second exporter;
- this is the topology used in the course example.

```
ticketing ─┐
catalog   ─┼── OTLP HTTP :4318 ──► otel-collector ── gRPC :4317 ──► tempo
auth      ─┤
notify    ─┘
```

## Configuration

| Item | File |
| --- | --- |
| config | `infra/tempo/otel-collector-config.yaml` |
| container | `concert-ops-otel-collector` |
| host ports | `4317` (gRPC), `4318` (HTTP) |

The pipeline has three parts:

```text
receivers   otlp (gRPC 4317, HTTP 4318)
processors  batch
exporters   otlp → tempo:4317, insecure
```

## How to verify

1. Container is running:

```powershell
docker compose ps otel-collector
```

2. Collector logs:

```powershell
docker logs concert-ops-otel-collector --tail 30
```

Healthy signs:

```
Everything is ready. Begin running and processing data.
Exporting finished.  {"kind":"exporter","data_type":"traces","name":"otlp"}
```

3. Applications point to the collector:

```powershell
docker logs concert-ops-ticketing 2>&1 | Select-String "tracing started"
```

Expected:

```
"endpoint":"http://otel-collector:4318","msg":"tracing started"
```

4. End-to-end: make a request, wait about 10 seconds and find the trace in
   Tempo (see [tempo.md](tempo.md)).

5. Export errors:

```powershell
docker logs concert-ops-otel-collector 2>&1 | Select-String "error|failed"
```

## Where it is used in code

The full pipeline is `infra/tempo/otel-collector-config.yaml`:

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

Applications receive the address from Compose:

```yaml
environment:
  OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4318
```

In code the exporter appends `/v1/traces`
(`src/shared/observability/tracing.ts`):

```ts
traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
```

The actual request goes to `http://otel-collector:4318/v1/traces`; the
collector then forwards it to `tempo:4317` over gRPC.
