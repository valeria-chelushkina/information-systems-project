# Ticketing API

Base URL: `http://localhost:3002` (Compose) or `http://localhost:3001` (local dev).
All `/api` routes require `Authorization: Bearer <token>`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/events` | list events (`status`, `from`, `to`, `limit`, `offset`) |
| `POST` | `/api/events` | create an event |
| `GET` | `/api/events/:id` | fetch one event |
| `PATCH` | `/api/events/:id` | partial update, including status |
| `DELETE` | `/api/events/:id` | delete an event without sales |
| `POST` | `/api/events/:eventId/tiers` | create a price tier |
| `GET` | `/api/events/:eventId/tiers` | list price tiers |
| `PATCH` | `/api/tiers/:tierId` | update price, name or quantity |
| `DELETE` | `/api/tiers/:tierId` | delete a tier without sold or held seats |
| `POST` | `/api/holds` | reserve seats until `expires_at` |
| `DELETE` | `/api/holds/:id` | release an active hold |
| `POST` | `/api/purchases` | convert a hold into an order and tickets |
| `GET` | `/api/orders/:id` | fetch an order with tickets |
| `POST` | `/api/orders/:id/refund` | refund a paid order in full |

## Events

Create:

```bash
curl -X POST http://localhost:3002/api/events \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{
    "title": "Night Session",
    "performerId": "<uuid>",
    "venueId": "<uuid>",
    "startsAt": "2027-03-01T19:00:00Z",
    "doorsAt": "2027-03-01T18:00:00Z",
    "durationMinutes": 120
  }'
```

`performerId` and `venueId` are resolved through catalog. Their names are
snapshotted into the event. A missing reference returns `400
unknown_performer` or `400 unknown_venue`; an unreachable catalog returns
`503 catalog_unavailable`.

Event statuses:

```
draft -> scheduled -> on_sale -> sold_out -> completed
                            \-> cancelled

sold_out -> on_sale        after restocking
```

Only allowed transitions are accepted. Anything else returns `409
invalid_status_transition`.

List filters: `status`, `from`, `to`, `limit` (default 20, max 100), `offset`.

## Price tiers

```bash
curl -X POST http://localhost:3002/api/events/<eventId>/tiers \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"name":"GA","priceCents":4500,"totalQty":200}'
```

`PATCH /api/tiers/:tierId` accepts `name`, `priceCents`, `totalQty`. Increasing
`totalQty` adds available seats; reducing it below sold plus held seats returns
`409 insufficient_inventory`.

## Holds and purchases

Reserve:

```bash
curl -X POST http://localhost:3002/api/holds \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"tierId":"<uuid>","quantity":2,"customerRef":"<uuid>"}'
```

Hold lifetime is `HOLD_TTL_MS` (default 10 minutes). A sweeper releases expired
holds every `HOLD_SWEEP_INTERVAL_MS` (default 10 seconds).

Purchase:

```bash
curl -X POST http://localhost:3002/api/purchases \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{
    "holdId": "<uuid>",
    "idempotencyKey": "<uuid>",
    "customerEmail": "buyer@example.com"
  }'
```

The response contains the order, issued tickets and `created`. Replaying the
same `idempotencyKey` returns the original order with `created: false`.

## Refund

```bash
curl -X POST http://localhost:3002/api/orders/<orderId>/refund \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"reason":"customer request"}'
```

Refunds are full and can happen once. Inventory is restored, tickets and
payments become `refunded`, a refund row is inserted, and a sold-out event
returns to `on_sale` when seats are available. A second attempt returns `409
order_not_refundable`.

## Concurrency guarantees

Seat reservation and sale are single conditional updates:

```sql
UPDATE price_tiers
SET available_qty = available_qty - $1,
    held_qty      = held_qty      + $1
WHERE id = $2 AND available_qty >= $1
RETURNING *;
```

Zero rows becomes `409 insufficient_inventory`. Inventory cannot go negative
under concurrent buyers. Refund updates tiers in sorted order to avoid
deadlocks.

## Common errors

| Status / code | Meaning |
| --- | --- |
| `409 insufficient_inventory` | not enough seats in the tier |
| `409 hold_not_active` | hold expired, cancelled or already converted |
| `409 hold_expired` | hold TTL passed |
| `409 event_not_on_sale` | sales are not open |
| `409 order_not_refundable` | order is not paid or already refunded |
| `404 event_not_found` / `hold_not_found` / `order_not_found` | unknown id |
