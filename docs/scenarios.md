# Scenarios

The scenario runner drives the system through named traffic patterns, prints a
summary and exits non-zero when its assertion fails.

```bash
AUTH_BASE_URL=http://127.0.0.1:3006 npm run scenario -- \
  --name=browse --rate=5 --duration=60 \
  --ticketing-url=http://127.0.0.1:3002 \
  --catalog-url=http://127.0.0.1:3004 \
  --annotate
```

On PowerShell use `$env:AUTH_BASE_URL = "http://127.0.0.1:3006"` and backticks
for line continuation.

## Scenarios

| Name | Traffic | Assertion |
| --- | --- | --- |
| `browse` | `GET /api/events` at `--rate` for `--duration` | every response is 200 |
| `purchase` | hold then purchase at `--rate` | at least one success, no network errors |
| `surge` | creates an event with `--seats` and fires `--buyers` at once | exactly `min(buyers, seats)` succeed and tier counters stay consistent |
| `chaos` | bad password, missing token, invalid token, unknown event, invalid body | each request gets its expected 4xx |
| `refund` | purchase then refund `--count` times | every refund returns 200 |
| `mixed` | continuous mix of event lifecycle, bookings, purchases, refunds, holds, browse and chaos | at least one event, booking, purchase and refund complete; no network errors |

## Mixed scenario

```powershell
$env:AUTH_BASE_URL = "http://127.0.0.1:3006"
npm run scenario -- `
  --name=mixed --duration=300 --rate=3 `
  --ticketing-url=http://127.0.0.1:3002 `
  --catalog-url=http://127.0.0.1:3004 `
  --annotate
```

`--rate` is purchases per second. The other workers have their own cadence:

| Worker | Cadence | Produces |
| --- | --- | --- |
| event lifecycle | 30 s | draft → scheduled → on_sale, tier with 250 seats |
| status cycle | 20 s | sold_out → restock → on_sale |
| event cancel | 45 s | on_sale → cancelled, keeps at least 2 active events |
| bookings | 4 s | requested → confirmed/rejected; every 8th overlaps to produce `409` |
| purchases | `--rate` per second | holds, purchases, order ids for refunds |
| refunds | 2 s | full refund of an earlier order |
| hold cancel | 5 s | hold created and immediately cancelled |
| browse | 1 s | `GET /api/events` |
| chaos | 8 s | wrong password, bad token, unknown event, invalid body |

A five-minute run at `--rate=3` makes roughly 900 purchases plus the rest of the
traffic. At `--rate=5` it is about 1500. The run leaves events, bookings, orders
and tickets in the database.

## Grafana annotations

`--annotate` posts start and end markers to Grafana using `GRAFANA_URL` and the
admin credentials. The provisioned dashboards include a **Load tests**
annotation layer that matches the `load-test` tag, so the markers appear on
every panel.

## One-command demo

`npm run demo` runs the `mixed` scenario for five minutes after seeding. See
the main [README](../README.md#one-command-demo).
