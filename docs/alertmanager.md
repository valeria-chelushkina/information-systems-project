# Alertmanager

## Що це і навіщо

Alertmanager приймає алерти від Prometheus і вирішує, що з ними робити:
групує схожі, приглушує дублікати, повторює надсилання за розписом і передає
їх отримувачу.

У проєкті Prometheus обчислює 15 правил з `infra/prometheus/alerts.yml`.
Коли правило переходить у `firing`, Alertmanager групує його та викликає
webhook `notify`. Після відновлення надсилається `resolved`, бо ввімкнено
`send_resolved: true`.

## Де налаштовано

| Що | Файл |
| --- | --- |
| правила | `infra/prometheus/alerts.yml` |
| маршрутизація | `infra/alertmanager/alertmanager.yml` |
| контейнер | `concert-ops-alertmanager`, порт `9093` |
| отримувач | `http://notify:3000/alerts` |

Ключові параметри маршруту:

```yaml
group_wait: 0s
group_interval: 1s
repeat_interval: 4h
group_by: ['alertname', 'severity']
```

`group_wait: 0s` зроблено для демонстрації: алерт доходить майже одразу.

## Як перевірити

1. Контейнер запущений:

```powershell
docker compose ps alertmanager
```

2. Готовність:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:9093/-/ready |
  Select-Object -ExpandProperty Content
```

Очікувано: `OK`.

3. UI: `http://localhost:9093` — вкладки **Alerts** і **Silences**.

4. Активні алерти через API:

```powershell
Invoke-RestMethod http://localhost:9093/api/v2/alerts |
  Select-Object @{ n = 'alert'; e = { $_.labels.alertname } }, @{ n = 'state'; e = { $_.status.state } }
```

5. Конфігурація валідна:

```powershell
docker exec concert-ops-alertmanager amtool check-config /etc/alertmanager/alertmanager.yml
```

6. Правила Prometheus: `http://localhost:9090/rules` і `http://localhost:9090/alerts`.

7. Наскрізна перевірка: зупинити PostgreSQL і викликати запит, який потребує
   БД:

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3006/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"admin@example.com","password":"admin-password"}'
$token = $login.data.token

docker compose stop postgres
Invoke-WebRequest -UseBasicParsing http://localhost:3002/api/events `
  -Headers @{ Authorization = "Bearer $token" }
```

Протягом одного інтервалу оцінювання з'являться `ServiceError` і
`PostgresDown`. У UI Alertmanager вони будуть `active`, а в логах `notify` —
`alert received`. Після `docker compose start postgres` прийде `resolved`.

Якщо це перший 5xx у новій серії метрик, `increase()` може не зарахувати
перший зразок — виконайте запит ще раз, і алерт спрацює на наступному
інтервалі.

## Де це в коді

Prometheus підключає правила й Alertmanager у
`infra/prometheus/prometheus.yml`:

```yaml
rule_files:
  - /etc/prometheus/alerts.yml

alerting:
  alertmanagers:
    - scheme: http
      static_configs:
        - targets: ['alertmanager:9093']
```

Маршрутизація та отримувач — `infra/alertmanager/alertmanager.yml`:

```yaml
route:
  receiver: notify-webhook
  group_wait: 0s
  group_interval: 1s
  repeat_interval: 4h
  group_by: ['alertname', 'severity']
  routes:
    - match:
        severity: critical
      receiver: notify-webhook
      repeat_interval: 1h

receivers:
  - name: notify-webhook
    webhook_configs:
      - send_resolved: true
        url: http://notify:3000/alerts
```

Правило, яке запускає ланцюг (`infra/prometheus/alerts.yml`):

```yaml
- alert: PostgresDown
  expr: pg_up == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Postgres exporter {{ $labels.instance }} cannot reach the database"
```

Після спрацювання Alertmanager робить `POST http://notify:3000/alerts` із
масивом `alerts`; після відновлення надсилає той самий payload зі
`status: resolved`.

## Типові проблеми

| Симптом | Причина | Що робити |
| --- | --- | --- |
| UI порожній, у Prometheus `firing` | Alertmanager не отримав алерт | перевірити `alerting` у `prometheus.yml` |
| алерт не доходить до `notify` | невірний `url` у receiver | `docker logs concert-ops-alertmanager` |
| `resolved` не приходить | `send_resolved: false` | увімкнути в `alertmanager.yml` |
| алерт довго не з'являється | спрацював `for:` | зачекати або перевірити `/alerts` у Prometheus |
