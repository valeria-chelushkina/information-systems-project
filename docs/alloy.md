# Alloy

## Що це і навіщо

Grafana Alloy — це агент збору логів. У проєкті він замінює Promtail: через
Docker socket знаходить усі контейнери, читає їхній stdout і надсилає рядки в
Loki.

Alloy потрібен, щоб Loki не доводилося читати файли Docker самостійно. Він
також додає мітку `container` з назви контейнера, за якою потім фільтрують
логи в Grafana.

## Де налаштовано

| Що | Файл |
| --- | --- |
| конфігурація | `infra/loki/alloy.config.alloy` |
| контейнер | `concert-ops-alloy` |
| UI | `0.0.0.0:12345` всередині мережі Compose, на хост не опублікований |
| зберігання позицій | том `alloydata`, `/var/lib/alloy/data` |

Схема роботи:

```
Docker socket → discovery.docker → loki.source.docker → loki.write → http://loki:3100
```

## Як перевірити

1. Контейнер запущений:

```powershell
docker compose ps alloy
```

2. У логах є передавання:

```powershell
docker logs concert-ops-alloy --tail 30
```

Ознаки роботи:

```
finished transferring logs ... written=<байти> container=<id>
```

3. Переконатися, що логи дійшли до Loki: у Grafana → **Explore → Loki**:

```logql
{container="concert-ops-alloy"}
{container="concert-ops-ticketing"}
```

4. Перевірити, що агент бачить новий контейнер: після `docker compose up -d
   notify` у Loki мають з'явитися рядки з `container="concert-ops-notify"`.

## Де це в коді

Уся конфігурація — один файл `infra/loki/alloy.config.alloy`:

```hcl
discovery.docker "containers" {
  host = "unix:///var/run/docker.sock"
}

discovery.relabel "containers" {
  targets = []

  rule {
    source_labels = ["__meta_docker_container_name"]
    regex         = "/(.*)"
    target_label  = "container"
  }
}

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

Команда запуску в `docker-compose.yml` передає цей файл і шлях для позицій
читання:

```yaml
command:
  - run
  - /etc/alloy/config.alloy
  - --storage.path=/var/lib/alloy/data
```

Саме тому новий контейнер, наприклад `notify`, автоматично з'являється в
Loki без зміни конфігурації Alloy.

## Типові проблеми

| Симптом | Причина | Що робити |
| --- | --- | --- |
| `error inspecting Docker container` | контейнер зупинили або перестворили, Alloy прибирає запис | це нормально, зникає саме собою |
| немає нових логів | Loki недоступний | `docker compose ps loki`, `docker logs concert-ops-alloy` |
| немає мітки `container` | проблема з relabel | перевірити `discovery.relabel` у конфігу |
| UI не відкривається з хоста | порт не опублікований | це очікувано; дивитися логи або Loki |
