# Web BFF API

The web service exposes a JSON API under `/api`. The React client calls it on
the same origin, so no CORS configuration is required.

Envelopes:

```json
{ "data": {} }
```

```json
{ "error": { "code": "validation_failed", "message": "Request validation failed" } }
```

All mutating requests require `content-type: application/json` when a body is
present and must come from the same origin. Authentication uses the
`concert_session` httpOnly cookie.

## Session

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/api/session` | - | `{ user }` or `{ user: null }` |
| POST | `/api/session` | `{ email, password }` | `{ user }`, sets cookie |
| POST | `/api/register` | `{ email, password }` | `{ user }`, sets cookie, creates a customer |
| DELETE | `/api/session` | - | `204`, clears cookie |

## Public catalogue

| Method | Path | Query | Result |
| --- | --- | --- | --- |
| GET | `/api/public/events` | `search`, `performerId`, `from`, `to`, `limit`, `offset` | `{ items, total, limit, offset }` |
| GET | `/api/public/events/:id` | - | `{ event, tiers }` |
| GET | `/api/public/performers` | `limit`, `offset` | performer directory with genre and bio |
| GET | `/api/public/performers/:id` | - | public performer profile with genre and bio |

`items` contain eligible events plus `minPriceCents`. `from` and `to` are
`YYYY-MM-DD` dates interpreted as Kyiv days; the list never includes past
events.

## Account

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| POST | `/api/events/:id/purchase` | `{ tierId, quantity }` | `{ orderId }` |
| GET | `/api/orders` | `limit`, `offset`, `from`, `to`, `performerId` | current customer's orders, tickets, events and ticket tier names; `from`/`to` are Kyiv days, `performerId` filters by event performer |
| GET | `/api/orders/performers` | - | performers from the customer's own orders, for the account filter |
| GET | `/api/orders/:id` | - | `{ order, tickets, event, tierNames, canRefund }` |
| POST | `/api/orders/:id/refund` | — | `{ orderId }` |

Customers can read and refund only their own orders; staff and admin can read
and refund any order.

## Admin

All admin routes require the `staff` or `admin` role.

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/api/admin/dashboard` | — | counts, recent events, service health |
| GET | `/api/admin/events` | `status`, `search`, `performerId`, `from`, `to`, `limit`, `offset` | `{ items, total, limit, offset }` |
| POST | `/api/admin/events` | event payload | created event |
| GET | `/api/admin/events/:id` | — | `{ event, tiers, transitions }` |
| PATCH | `/api/admin/events/:id` | `{ status }` | updated event |
| DELETE | `/api/admin/events/:id` | — | `204` |
| POST | `/api/admin/events/:id/tiers` | `{ name, priceCents, totalQty }` | created tier |
| PATCH | `/api/admin/tiers/:id` | `{ name, priceCents, totalQty }` | updated tier |
| DELETE | `/api/admin/tiers/:id` | — | `204` |
| GET | `/api/admin/performers` | `search`, `limit`, `offset` | `{ items, total, limit, offset }` |
| POST | `/api/admin/performers` | `{ name, genre?, bio?, contactEmail? }` | created performer |
| PATCH | `/api/admin/performers/:id` | `{ name?, genre?, bio?, contactEmail? }` | updated performer |
| GET | `/api/admin/venues` | `search`, `limit`, `offset` | `{ items, total, limit, offset }` |
| POST | `/api/admin/venues` | `{ name, city, timezone?, capacity }` | created venue |
| PATCH | `/api/admin/venues/:id` | `{ name?, city?, timezone?, capacity? }` | updated venue |
| GET | `/api/admin/bookings` | `status`, `limit`, `offset` | bookings, name maps and pagination |
| POST | `/api/admin/bookings/:id/decision` | `{ status }` | decided booking |
| GET | `/api/admin/orders/:id` | — | order details |
| POST | `/api/admin/orders/:id/refund` | — | `{ orderId }` |
| POST | `/api/admin/tickets/check-in` | `{ qrToken }` | admitted ticket and event, `staff` or `admin` only |
| GET | `/api/admin/reports` | `from`, `to` (Kyiv days) | revenue, occupancy, performers and refunds |
| GET | `/api/admin/notifications` | `limit`, `offset` | ticket email deliveries: `{ items, total, limit, offset }` |
| GET | `/api/admin/notifications/summary` | - | delivery counts by status |
| GET | `/api/admin/users` | `limit`, `offset` | team members only: `{ items, total, limit, offset }` (admin only) |
| POST | `/api/admin/users` | `{ email, password, role }` where role is `staff` or `admin` | created team member (admin only) |

Event payload for `POST /api/admin/events`:

```json
{
  "title": "Nova Wave: Neon Tour",
  "performerId": "uuid",
  "venueId": "uuid",
  "startsAt": "2026-11-20T19:00",
  "doorsAt": "2026-11-20T18:00",
  "durationMinutes": 120,
  "status": "draft"
}
```

`startsAt` and `doorsAt` are local Kyiv times; the BFF converts them to UTC.
`from` and `to` on the events list are `YYYY-MM-DD` dates interpreted as full
Kyiv days. `search` matches title, performer and venue; all admin lists accept
`limit` (1–100, default 20) and `offset`.

## Error codes

| Status | Codes |
| --- | --- |
| 400 | `validation_failed` |
| 401 | `missing_token`, `invalid_token`, `invalid_credentials` |
| 403 | `forbidden`, `forbidden_origin`, `user_inactive` |
| 404 | `event_not_found`, `order_not_found`, `not_found` |
| 409 | `insufficient_inventory`, `booking_conflict`, `email_taken`, `invalid_status_transition` |
| 415 | `unsupported_media_type` |
| 503 | `upstream_unavailable` |
