# Grafana

## Що це і навіщо

Grafana — веб-інтерфейс для перегляду метрик, логів і трейсів. У проєкті вона
не зберігає дані, а запитує їх у трьох джерелах:

| Джерело | UID | URL у мережі Compose |
| --- | --- | --- |
| Prometheus | `prometheus` | `http://prometheus:9090` |
| Loki | `loki` | `http://loki:3100` |
| Tempo | `tempo` | `http://tempo:3200` |

Grafana використовується для демонстрації та аналізу. У проєкті шість
дашбордів, згрупованих тегом `concert-ops`:

| Дашборд | UID | Що показує |
| --- | --- | --- |
| Concert Ops Overview | `concert-ops-overview` | 14 ключових панелей: доступність, помилки, p95, бізнес, насичення |
| API Monitoring | `concert-ops-api` | p90/p95/p99, повільні маршрути, запити, помилки, таблиці route/status |
| Service Detail | `concert-ops-service` | один сервіс: маршрути, heatmap, запити до БД, пул |
| Postgres | `concert-ops-postgres` | з'єднання, транзакції, cache hit, блокування, повільні запити |
| Messaging | `concert-ops-messaging` | глибина черги, throughput, споживачі, помилки |
| Business | `concert-ops-business` | результати продажів, дохід, воронка, стан подій, бронювання, auth-помилки, unit-економіка |

**Business** відкривається на останній годині, а не на добі: демонстраційний
прогін триває 5 хвилин, і на 24-годинному графіку він виглядав би тонкою
лінією. Скористайтеся вибором часу зверху, щоб переглянути 6/12/24 години;
точки на графіках показують окремі значення навіть для коротких сплесків.

**API Monitoring** і **Service Detail** мають змінні `service` та `method`;
**Postgres** — змінну `datname`. Зверху кожного дашборда є випадаюче меню
**Dashboards**, яке веде до решти.

Через **Explore** зручно шукати логи та трейси за конкретним запитом.

## Де налаштовано

| Що | Файл |
| --- | --- |
| джерела даних | `infra/grafana/provisioning/datasources/` |
| дашборди | `infra/grafana/dashboards/*.json` |
| провіжинінг | `infra/grafana/provisioning/dashboards/dashboards.yml` |
| контейнер | `concert-ops-grafana`, порт `3007` |

Логін і пароль беруться з `.env`:

```
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin-password
```

## Як перевірити

1. Контейнер і здоров'я:

```powershell
docker compose ps grafana
Invoke-RestMethod http://localhost:3007/api/health
```

Очікувано: `database: ok`, `version: 11.2.0`.

2. Відкрити `http://localhost:3007`, увійти адміністратором.

3. Дашборди: **Dashboards → Concert Ops Overview**, або напряму
   `http://localhost:3007/d/concert-ops-overview`.

   Ознаки справності: **App services available** = `100%`, **5xx error
   ratio** = `0%`, p95 і p99 не порожні, **RabbitMQ consumers** = `1`.

   Решта дашбордів:

   ```
   /d/concert-ops-api
   /d/concert-ops-service
   /d/concert-ops-postgres
   /d/concert-ops-messaging
   /d/concert-ops-business
   ```

   **API Monitoring** має найбільше панелей у стилі класичного API-
   моніторингу: p90/p95/p99 за методом, повільні маршрути, стовпчики
   запитів, запити/помилки за хвилину та дві таблиці. Якщо таблиця
   **Route statistics** порожня, у вибраному діапазоні не було трафіку.

4. Джерела даних: **Connections → Data sources**. Усі три мають бути
   `working`. Для Tempo кнопка **Save & test** може повертати 404 — це
   особливість Grafana 11.2, сам datasource працює.

5. Explore:

   - **Prometheus** → `sum by (service) (rate(http_requests_total[5m]))`;
   - **Loki** → `{container="concert-ops-ticketing"}`;
   - **Tempo** → `{resource.service.name="ticketing"}`.

6. Анотації: після запуску сценарію з `--annotate` на графіках з'являються
   оранжеві вертикальні маркери. Шар називається **Load tests** і фільтрує
   тег `load-test`.

## Як змінити діапазон часу

Відкривайте дашборд у звичайному режимі, без `kiosk`:

```
http://localhost:3007/d/concert-ops-business
```

У правому верхньому куті є кнопка з поточним діапазоном, наприклад
**Last 1 hour**:

1. Натиснути на неї.
2. Вибрати **Relative time range** (5m, 15m, 30m, 1h, 3h, 6h, 12h, 24h,
   2d, 7d) або **Absolute time range** і вказати дати.
3. Натиснути **Apply**.

Поруч є вибір частоти оновлення (5s, 10s, 30s, 1m, 5m). Для Business
типові варіанти — **Last 15 minutes** або **Last 30 minutes** одразу після
демо-прогону, **Last 1 hour** для загального огляду.

Додаткові способи:

- **Масштабування мишею**: протягнути прямокутник на графіку, щоб
  збільшити вибраний інтервал; подвійний клік повертає попередній
  діапазон.
- **URL**: `?from=now-3h&to=now` або `?from=now-15m&to=now`.
- **Абсолютний час**: `?from=2026-11-09T22:00:00Z&to=2026-11-09T23:00:00Z`.
- **Kiosk** (`&kiosk`) ховає верхню панель, тому вибору часу там не видно.
  Використовуйте звичайний URL або параметри `from`/`to`.

Дашборд **Business** має власний набір швидких діапазонів, описаний у
`timepicker` в `infra/grafana/dashboards/business.json`.

## Де це в коді

Джерело даних додається файлом, без ручних кліків
(`infra/grafana/provisioning/datasources/prometheus.yml`):

```yaml
datasources:
  - name: Prometheus
    uid: prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

Панель дашборда — це JSON із PromQL-запитом
(`infra/grafana/dashboards/overview.json`):

```json
{
  "title": "p95 latency by route",
  "targets": [
    {
      "refId": "A",
      "expr": "histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket[$__rate_interval])))",
      "legendFormat": "{{route}}"
    }
  ]
}
```

Шар анотацій, який показує маркери сценаріїв навантаження:

```json
{
  "name": "Load tests",
  "target": {
    "tags": ["load-test"],
    "type": "tags"
  },
  "type": "tags"
}
```

Провайдер дашбордів періодично перечитує теку
(`infra/grafana/provisioning/dashboards/dashboards.yml`):

```yaml
providers:
  - name: 'concert-ops'
    type: file
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
```

## Типові проблеми

| Симптом | Причина | Що робити |
| --- | --- | --- |
| `database: not ok` | проблема з томом `grafanadata` | `docker logs concert-ops-grafana` |
| datasource `working` не з'являється | контейнер джерела не запущений | `docker compose ps` |
| дашборд без даних | Prometheus не бачить таргет | перевірити `/targets` у Prometheus |
| порожній список трейсів | обраний занадто вузький час | розширити діапазон у Grafana |
