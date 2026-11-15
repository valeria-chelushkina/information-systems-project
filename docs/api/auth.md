# Auth API

Base URL: `http://localhost:3006` (Compose) or `http://localhost:3005` (local dev).

Auth is a separate service backed by SQLite. It issues opaque session tokens and
answers introspection requests from ticketing and catalog.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/login` | exchange credentials for a token |
| `POST` | `/auth/register` | create a self-service customer account |
| `POST` | `/auth/logout` | revoke a token |
| `POST` | `/auth/introspect` | validate a token (service-to-service) |
| `GET` | `/auth/me` | current user |
| `POST` | `/auth/users` | create a user |
| `GET` | `/auth/users` | list users, admin only (`limit`, `offset`, `roles`) |
| `GET` | `/health` | readiness, pings SQLite |
| `GET` | `/metrics` | Prometheus exposition |

## Login

```bash
curl -X POST http://localhost:3006/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"customer@example.com","password":"customer-password"}'
```

Response:

```json
{
  "data": {
    "token": "<opaque-token>",
    "expiresAt": "2026-11-11T12:00:00.000Z",
    "user": {
      "id": "<uuid>",
      "email": "customer@example.com",
      "role": "customer"
    }
  }
}
```

The raw token is returned once. The database stores only its SHA-256 hash.
Sessions have a TTL (`AUTH_TOKEN_TTL_MS`).

Invalid credentials return `401 invalid_credentials` and increment
`auth_failures_total{reason="credentials"}`.

## Logout

```bash
curl -X POST http://localhost:3006/auth/logout \
  -H 'content-type: application/json' \
  -d '{"token":"<opaque-token>"}'
```

`204 No Content` on success. The token is revoked immediately because the other
services call introspection on every request.

## Introspection

Ticketing and catalog call:

```bash
curl -X POST http://localhost:3006/auth/introspect \
  -H 'content-type: application/json' \
  -d '{"token":"<opaque-token>"}'
```

Response contains the user and session metadata. Unknown, expired or revoked
tokens return `401 invalid_token`.

## Current user

```bash
curl http://localhost:3006/auth/me \
  -H "authorization: Bearer $TOKEN"
```

## Register

Public self-service registration. It always creates an active `customer`; the
caller cannot choose a role.

```bash
curl -X POST http://localhost:3006/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"new@example.com","password":"secret-123"}'
```

`201` returns the created user. Duplicate emails return `409 email_taken`, and
passwords must be 8–200 characters.

## Create user

```bash
curl -X POST http://localhost:3006/auth/users \
  -H 'content-type: application/json' \
  -d '{"email":"new@example.com","password":"secret","role":"staff"}'
```

The first user can be created without authentication. Once any user exists,
the endpoint requires an admin token (`403` otherwise).

`GET /auth/users` requires an admin token and returns a page:
`{ data, meta: { total, limit, offset } }`. `limit` defaults to 20 and is capped
at 100. Optional `roles=admin,staff` filters the page; the web Team screen uses
it to exclude customers.

## Failure metrics

`auth_failures_total{reason}` separates:

| Reason | When |
| --- | --- |
| `credentials` | wrong email or password |
| `user_inactive` | disabled account |
| `invalid_token` | unknown, expired or revoked token |
| `missing_token` | no bearer token supplied |
| `auth_unavailable` | auth service unreachable from ticketing/catalog |

Seeded accounts are listed in the [API overview](README.md#authentication).
