# Loki

## What it is for

Loki stores logs. It does not collect them: Alloy reads container stdout and
pushes it to Loki. Loki stores chunks on the `lokidata` volume and serves them
through LogQL.

In this project Loki is used to:

- see logs from all services in one place;
- find one request by `x-request-id` across `ticketing`, `auth` and `catalog`;
- confirm that alerts reach `notify`.

Each log line has a `container` label (container name) and `job="docker"`.
Fields such as `service`, `request_id` and `level` live inside the JSON body.

## Configuration

| Item | File |
| --- | --- |
| Loki config | `infra/loki/loki-config.yml` |
| log collection | `infra/loki/alloy.config.alloy` |
| storage | `lokidata` volume, `/loki` |
| container | `concert-ops-loki`, port `3100` |

## How to verify

1. Readiness:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3100/ready |
  Select-Object -ExpandProperty Content
```

Expected: `ready`.

2. Logs in Grafana: **Explore → Loki → Code**:

```logql
{container="concert-ops-ticketing"}
{container="concert-ops-ticketing"} |= "request completed"
{container="concert-ops-ticketing"} |= "error"
{container="concert-ops-notify"} |= "alert"
```

3. Correlate one request: copy `request_id` from a log line and search:

```logql
{container=~"concert-ops-(ticketing|catalog|auth)"} |= "<request_id>"
```

4. Through the HTTP API (timestamps are in nanoseconds):

```powershell
$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$query = '{container="concert-ops-ticketing"} |= "request completed"'
$url = "http://localhost:3100/loki/api/v1/query_range?query=$([uri]::EscapeDataString($query))&start=$($now-900)000000000&end=$($now)000000000&limit=5"
(Invoke-RestMethod $url).data.result.Count
```

5. Loki's own logs:

```powershell
docker compose logs loki --tail 50
```

## Where it is used in code

The `requestContext` middleware creates the log line
(`src/shared/http/middleware/request-context.ts`):

```ts
logger.info(
  {
    request_id: requestId,
    method: req.method,
    path: req.path,
    status: res.statusCode,
    duration_ms: Math.round(durationMs),
  },
  'request completed',
);
```

The `service` field is added by the logger from `config.serviceName`.

Alloy ships stdout to Loki (`infra/loki/alloy.config.alloy`):

```hcl
loki.source.docker "containers" {
  host          = "unix:///var/run/docker.sock"
  targets       = discovery.docker.containers.targets
  relabel_rules = discovery.relabel.containers.rules
  labels        = { job = "docker" }
  forward_to    = [loki.write.local.receiver]
}

loki.write "local" {
  endpoint {
    url = "http://loki:3100/loki/api/v1/push"
  }
}
```

The `container` label is built from the Docker container name, which is why
queries use `{container="concert-ops-ticketing"}`.
