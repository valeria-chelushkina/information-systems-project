# Документація зі спостережуваності

У цій теці описано кожен сервіс спостережуваності проєкту: для чого він
потрібен, де використовується і як перевірити, що він працює.

Усі команди виконуються з кореня проєкту:

```powershell
cd D:\University\4course\1sem\information-systems
```

## Архітектура

```
ticketing / catalog / auth / notify
        ├── /metrics ────────────────► Prometheus
        ├── OTLP HTTP 4318 ──────────► otel-collector ──► Tempo
        └── ticketing ──publish──► RabbitMQ ──consume──► notify

Prometheus ──► Grafana (дашборди, Explore)
Prometheus ──► Alertmanager ──► notify (webhook)

postgres_exporter ──► Prometheus
Alloy ──► Loki ──► Grafana
```

## Сервіси

| Сервіс | Порт на хості | Призначення | Документ |
| --- | --- | --- | --- |
| Prometheus | 9090 | зберігання метрик, PromQL, правила алертів | [prometheus.md](prometheus.md) |
| Grafana | 3007 | дашборди та Explore поверх усіх джерел | [grafana.md](grafana.md) |
| Loki | 3100 | зберігання логів | [loki.md](loki.md) |
| Alloy | внутрішній | збирає логи контейнерів і надсилає в Loki | [alloy.md](alloy.md) |
| Tempo | 3200 | зберігання трейсів | [tempo.md](tempo.md) |
| otel-collector | 4317 / 4318 | приймає OTLP і передає трейси в Tempo | [otel-collector.md](otel-collector.md) |
| postgres_exporter | 9187 / 9188 | метрики рушія PostgreSQL | [postgres-exporter.md](postgres-exporter.md) |
| RabbitMQ | 5672 / 15672 / 15692 | брокер повідомлень і його метрики | [rabbitmq.md](rabbitmq.md) |
| Alertmanager | 9093 | маршрутизація алертів | [alertmanager.md](alertmanager.md) |
| notify | внутрішній | webhook-приймач алертів | [notify.md](notify.md) |

## Дашборди

| Дашборд | UID | Призначення |
| --- | --- | --- |
| Concert Ops Overview | `concert-ops-overview` | головний екран: доступність, помилки, p95, бізнес, насичення |
| API Monitoring | `concert-ops-api` | процентилі, маршрути, запити та помилки, таблиці |
| Service Detail | `concert-ops-service` | один сервіс із heatmap і статистикою запитів |
| Postgres | `concert-ops-postgres` | з'єднання, транзакції, кеш, блокування, повільні запити |
| Messaging | `concert-ops-messaging` | черга RabbitMQ, throughput, споживачі |
| Business | `concert-ops-business` | дохід, воронка, бронювання, auth-помилки |

## Швидка перевірка всього стеку

```powershell
docker compose ps

Invoke-WebRequest -UseBasicParsing http://localhost:9090/-/ready | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing http://localhost:3007/api/health | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing http://localhost:3100/ready | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing http://localhost:3200/ready | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing http://localhost:9093/-/ready | Select-Object -ExpandProperty Content

(Invoke-WebRequest -UseBasicParsing http://localhost:9187/metrics).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:9188/metrics).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:15692/metrics).StatusCode
```

Очікувано:

```
Prometheus Server is Ready.
{"database":"ok","version":"11.2.0",...}
ready
ready
OK
200
200
200
```

`Tempo` може віддавати `503` перші 20–30 секунд після старту — це нормально.

## Як усе пов'язано

- **Метрики**: сервіси віддають `/metrics`, Prometheus їх опитує кожні 10
  секунд, Grafana будує графіки, Alertmanager отримує спрацювання правил.
- **Логи**: Alloy читає stdout контейнерів через Docker socket і надсилає в
  Loki; Grafana показує їх у Explore.
- **Трейси**: сервіси експортують OTLP у otel-collector, колектор батчить і
  передає в Tempo; Grafana показує waterfall.
- **Алерти**: Prometheus обчислює правила з `infra/prometheus/alerts.yml`,
  Alertmanager групує їх і викликає webhook `notify`, який пише подію в лог,
  а отже — у Loki.

## Де це видно в коді

| Сервіс | Ключові файли |
| --- | --- |
| Prometheus | `src/shared/observability/metrics.ts`, `src/shared/http/routes/metrics.ts`, `infra/prometheus/prometheus.yml`, `infra/prometheus/alerts.yml` |
| Grafana | `infra/grafana/provisioning/datasources/`, `infra/grafana/dashboards/overview.json` |
| Loki | `src/shared/http/middleware/request-context.ts`, `infra/loki/loki-config.yml` |
| Alloy | `infra/loki/alloy.config.alloy` |
| Tempo | `src/shared/observability/tracing.ts`, `infra/tempo/tempo-config.yml` |
| otel-collector | `infra/tempo/otel-collector-config.yaml` |
| postgres_exporter | `docker-compose.yml`, `db/init/02_monitoring.sql`, `infra/grafana/dashboards/overview.json` |
| RabbitMQ | `src/shared/messaging/`, `src/services/ticketing/messaging/`, `src/services/notify/modules/notifications/` |
| Alertmanager | `infra/prometheus/alerts.yml`, `infra/alertmanager/alertmanager.yml` |
| notify | `src/services/notify/app.ts`, `src/services/notify/modules/alerts/` |

Кожен сервіс має власний файл у цій теці з детальним фрагментом коду та
поясненням, звідки беруться його дані.
