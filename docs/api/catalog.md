# Catalog API

Base URL: `http://localhost:3004` (Compose) or `http://localhost:3003` (local dev).
All `/api` routes require `Authorization: Bearer <token>`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/performers` | create a performer |
| `GET` | `/api/performers` | list performers (`limit`, `offset`) |
| `GET` | `/api/performers/:id` | fetch one performer |
| `POST` | `/api/venues` | create a venue |
| `GET` | `/api/venues` | list venues (`limit`, `offset`) |
| `GET` | `/api/venues/:id` | fetch one venue |
| `POST` | `/api/bookings` | request a venue for a period |
| `GET` | `/api/bookings` | list bookings (`venueId`, `status`, `limit`, `offset`) |
| `GET` | `/api/bookings/:id` | fetch one booking |
| `PATCH` | `/api/bookings/:id` | confirm or reject a booking |

## Performers and venues

```bash
curl -X POST http://localhost:3004/api/performers \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"name":"Neon Harbor","genre":"indie"}'

curl -X POST http://localhost:3004/api/venues \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"name":"Stereo Plaza","city":"Kyiv","timezone":"Europe/Kyiv","capacity":6000}'
```

## Bookings

Create a request:

```bash
curl -X POST http://localhost:3004/api/bookings \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{
    "performerId": "<uuid>",
    "venueId": "<uuid>",
    "startsAt": "2027-04-10T18:00:00Z",
    "endsAt": "2027-04-10T22:00:00Z",
    "note": "spring tour"
  }'
```

`endsAt` must be later than `startsAt`; otherwise `400 invalid_period`.

Decide:

```bash
curl -X PATCH http://localhost:3004/api/bookings/<bookingId> \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"status":"confirmed"}'
```

Allowed decisions are `confirmed` and `rejected`. Only a pending request can be
decided; a second decision returns `409 booking_not_pending`.

### Overlap protection

Confirmed bookings for the same venue cannot overlap. PostgreSQL enforces this
with an exclusion constraint:

```sql
EXCLUDE USING gist (venue_id WITH =, during WITH &&)
WHERE (status = 'confirmed')
```

A conflicting confirmation returns `409 booking_conflict` (Postgres code
`23P01`). The constraint only applies to confirmed rows, so multiple venues can
still receive overlapping requests before a decision.

## Usage from ticketing

Ticketing calls `GET /api/performers/:id` and `GET /api/venues/:id` when
creating or updating an event, forwarding the caller's bearer token. Names are
copied into the event row so catalog renames do not rewrite history.

See [architecture](../architecture.md) for the service-to-service flow.
