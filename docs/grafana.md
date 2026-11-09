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
| Business | `concert-ops-business` | дохід, воронка покупок, бронювання, auth-помилки, повернення |

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
