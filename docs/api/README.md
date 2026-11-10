# API reference

Base URLs:

| Environment | ticketing | catalog | auth |
| --- | --- | --- | --- |
| local `npm run dev` | `http://localhost:3001` | `http://localhost:3003` | `http://localhost:3005` |
| Docker Compose | `http://localhost:3002` | `http://localhost:3004` | `http://localhost:3006` |

Inside Compose, services use `http://ticketing:3000`,
`http://catalog:3000` and `http://auth:3000`.

## Authentication

Every `/api` route on ticketing and catalog requires a bearer token.
`/health` and `/metrics` are public.

```bash
TOKEN=$(curl -s -X POST http://localhost:3005/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"customer@example.com","password":"customer-password"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')

curl -H "authorization: Bearer $TOKEN" http://localhost:3001/api/events
```

PowerShell:

```powershell
$login = Invoke-RestMethod -Method Post `
  -Uri http://localhost:3006/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"customer@example.com","password":"customer-password"}'

Invoke-RestMethod http://localhost:3002/api/events `
  -Headers @{ Authorization = "Bearer $($login.data.token)" }
```

Seeded users:

| Email | Password | Role |
| --- | --- | --- |
| `admin@example.com` | `admin-password` | admin |
| `staff@example.com` | `staff-password` | staff |
| `customer@example.com` | `customer-password` | customer |

Tokens are opaque. The auth service stores only a SHA-256 hash and returns the
raw value once. Ticketing and catalog call `POST /auth/introspect` instead of
verifying tokens locally, so logout and revocation take effect immediately.

## Common conventions

| Topic | Convention |
| --- | --- |
| Money | integer cents; `4500` = `$45.00` |
| Pagination | `limit` (1–100, default 20) and `offset` |
| Request id | `x-request-id` is echoed; generated when missing |
| Content type | `application/json` for request and response bodies |
| Idempotency | `idempotencyKey` on purchases; replay returns the original order |

Errors use a consistent envelope:

```json
{
  "error": {
    "code": "insufficient_inventory",
    "message": "Not enough seats are available for this price tier"
  }
}
```

| Status | Meaning |
| --- | --- |
| `400` | validation failed or invalid reference |
| `401` | missing, invalid or revoked token |
| `404` | entity not found |
| `409` | business conflict (inventory, state transition, overlap) |
| `502` / `503` | downstream service error or unavailable |

## Endpoint index

| Service | Document | Endpoints |
| --- | --- | --- |
| ticketing | [ticketing.md](ticketing.md) | events, tiers, holds, purchases, orders, refunds |
| catalog | [catalog.md](catalog.md) | performers, venues, bookings |
| auth | [auth.md](auth.md) | login, logout, introspect, me, users |
| notify | [notify.md](notify.md) | Alertmanager webhook, health |

Each service also exposes `GET /health` and `GET /metrics`.
