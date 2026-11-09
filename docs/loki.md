# Loki

## Що це і навіщо

Loki — сховище логів. Сам він логи не збирає: це робить Alloy, який читає
stdout контейнерів і надсилає їх у Loki. Loki зберігає їх на томі `lokidata`
у вигляді чанків і віддає за запитом LogQL.

У проєкті Loki потрібен, щоб:

- бачити логи всіх сервісів в одному місці;
- знаходити запит за `x-request-id` у `ticketing`, `auth` і `catalog`;
- перевіряти, що алерт дійшов до `notify`.

Кожен лог має мітку `container` (назва контейнера) і `job="docker"`.
Самі поля (`service`, `request_id`, `level`) лежать усередині JSON-рядка.

## Де налаштовано

| Що | Файл |
| --- | --- |
| конфігурація Loki | `infra/loki/loki-config.yml` |
| збір логів | `infra/loki/alloy.config.alloy` |
| зберігання | том `lokidata`, шлях `/loki` |
| контейнер | `concert-ops-loki`, порт `3100` |

## Як перевірити

1. Готовність:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3100/ready |
  Select-Object -ExpandProperty Content
```

Очікувано: `ready`.

2. Логи в Grafana: **Explore → Loki → Code**, запити:

```logql
{container="concert-ops-ticketing"}
{container="concert-ops-ticketing"} |= "request completed"
{container="concert-ops-ticketing"} |= "error"
{container="concert-ops-notify"} |= "alert"
```

3. Пошук за конкретним запитом: у логах є поле `request_id`; скопіюйте його
   та виконайте:

```logql
{container=~"concert-ops-(ticketing|catalog|auth)"} |= "<request_id>"
```

4. Через HTTP API (зверніть увагу: час у наносекундах):

```powershell
$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$query = '{container="concert-ops-ticketing"} |= "request completed"'
$url = "http://localhost:3100/loki/api/v1/query_range?query=$([uri]::EscapeDataString($query))&start=$($now-900)000000000&end=$($now)000000000&limit=5"
(Invoke-RestMethod $url).data.result.Count
```

5. Логи самого Loki:

```powershell
docker compose logs loki --tail 50
```

## Де це в коді

Логи створює middleware `requestContext`
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

Саме поля `request_id`, `path` і `status` потім шукаються в LogQL. Логер
додає `service` з `config.serviceName`, тому рядок містить і назву сервісу.

Alloy надсилає stdout у Loki (`infra/loki/alloy.config.alloy`):

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

Мітка `container` формується з назви контейнера в
`discovery.relabel.containers`, тому в запитах використовується
`{container="concert-ops-ticketing"}`.

## Типові проблеми

| Симптом | Причина | Що робити |
| --- | --- | --- |
| у Grafana порожньо | Alloy не працює або немає трафіку | перевірити [alloy.md](alloy.md) |
| логи є, але старі | немає нових запитів | зробити запит до сервісу |
| `ready` не відповідає | контейнер стартує | зачекати, `docker logs concert-ops-loki` |
| не знаходиться `request_id` | запит не проходив через сервіс | перевірити діапазон часу |
