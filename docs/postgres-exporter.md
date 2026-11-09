# postgres_exporter

## Що це і навіщо

`postgres_exporter` — окремий процес, який підключається до PostgreSQL як
звичайний клієнт, виконує запити до `pg_stat_*` і віддає результат у форматі
Prometheus на `/metrics`.

У проєкті запущено два екземпляри:

| Контейнер | База | Порт на хості |
| --- | --- | --- |
| `concert-ops-postgres-exporter-ticketing` | `db_ticketing` | `9187` |
| `concert-ops-postgres-exporter-catalog` | `db_catalog` | `9188` |

Навіщо він, якщо застосунок уже віддає метрики:

- метрики застосунку показують, що бачив Node-процес (пул, час запиту);
- експортер показує, що відбувається в самому рушії: реальні з'єднання,
  блокування, cache hit, deadlocks, розмір БД, статистика запитів.

Це різні точки зору на ту саму межу. Наприклад, `db_pool_waiting_requests`
каже, що клієнт чекає, а `pg_locks_count` — хто саме тримає блокування.

## Де налаштовано

| Що | Файл |
| --- | --- |
| сервіси та DSN | `docker-compose.yml` |
| роль і права | `db/init/02_monitoring.sql` |
| таргети збору | `infra/prometheus/prometheus.yml` |
| панелі | `infra/grafana/dashboards/overview.json` |

Експортер підключається роллю `exporter`, якій надано `pg_monitor`. Це дає
доступ до `pg_stat_activity`, `pg_locks` і `pg_stat_statements`, чого
звичайна роль застосунку не має.

Колектор `stat_statements` увімкнений явно:

```
--collector.stat_statements
--collector.stat_statements.include_query
```

Текст запиту експортується окремою метрикою `pg_stat_statements_query_id`,
яку дашборд з'єднує за `queryid`.

## Як перевірити

1. Контейнери запущені:

```powershell
docker compose ps postgres-exporter-ticketing postgres-exporter-catalog
```

2. Метрики віддаються:

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:9187/metrics).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:9188/metrics).StatusCode
```

Очікувано: `200`.

3. Ключові значення:

```powershell
$m = (Invoke-WebRequest -UseBasicParsing http://localhost:9187/metrics).Content
$m -split "`n" | Select-String "^pg_up|^pg_exporter_last_scrape_error"
```

Очікувано:

```
pg_exporter_last_scrape_error 0
pg_up 1
```

4. Prometheus бачить таргети: `http://localhost:9090/targets`, jobs
   `postgres-ticketing` і `postgres-catalog` — `UP`.

5. Запити в Prometheus:

```promql
pg_up
max by (datname) (pg_stat_database_numbackends{datname=~"db_.*"})
max by (datname) (rate(pg_stat_database_xact_commit{datname=~"db_.*"}[5m]))
sum by (mode) (max by (datname, mode) (pg_locks_count{datname=~"db_.*"}))
max by (datname) (pg_database_size_bytes{datname=~"db_.*"})
```

6. Панелі в Grafana: **Postgres connections**, **transactions per second**,
   **cache hit ratio**, **lock waits**, **database size**, **slowest
   statements**. Щоб у таблиці з'явилися запити, виконайте кілька покупок.

## Де це в коді

Сервіс описаний у `docker-compose.yml`:

```yaml
postgres-exporter-ticketing:
  image: prometheuscommunity/postgres-exporter:v0.20.1
  command:
    - --collector.stat_statements
    - --collector.stat_statements.include_query
  environment:
    DATA_SOURCE_NAME: postgresql://${EXPORTER_DB_USER}:${EXPORTER_DB_PASSWORD}@postgres:5432/${TICKETING_DB_NAME}?sslmode=disable
  ports:
    - "${POSTGRES_EXPORTER_TICKETING_PORT}:9187"
```

Роль і розширення створюються в `db/init/02_monitoring.sql`:

```sql
ALTER ROLE exporter WITH LOGIN PASSWORD 'dev_exporter_pw';
GRANT pg_monitor TO exporter;

\connect db_ticketing
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
GRANT SELECT ON pg_stat_statements TO exporter;
```

Prometheus опитує експортери як окремі таргети
(`infra/prometheus/prometheus.yml`):

```yaml
- job_name: 'postgres-ticketing'
  static_configs:
    - targets: ['postgres-exporter-ticketing:9187']
      labels:
        instance_type: database
```

Панель дашборда споживає ці метрики
(`infra/grafana/dashboards/overview.json`):

```json
{
  "title": "Postgres connections",
  "targets": [
    {
      "refId": "A",
      "expr": "max by (datname) (pg_stat_database_numbackends{datname=~\"db_.*\"})",
      "legendFormat": "{{datname}}"
    }
  ]
}
```

`max by (datname)` тут обов'язковий: обидва експортери бачать увесь кластер,
тому `sum` подвоїв би значення.

## Типові проблеми

| Симптом | Причина | Що робити |
| --- | --- | --- |
| `pg_up 0` | неправильний пароль або роль | перевірити `EXPORTER_DB_*` у `.env`, `docker logs` |
| `stat_statements` немає | не створена extension | `db/init/02_monitoring.sql`, перезапуск postgres |
| значення задвоєні | обидва експортери бачать увесь кластер | у запитах використовувати `max by (datname)` |
| після зміни пароля не працює | контейнер не перестворений | `docker compose up -d postgres-exporter-*` |
