#!/bin/sh
set -eu

api="http://rabbitmq:15672/api"
auth="${RABBITMQ_DEFAULT_USER}:${RABBITMQ_DEFAULT_PASSWORD}"

until curl -fsS -u "$auth" "$api/overview" >/dev/null 2>&1; do
  sleep 1
done

curl -fsS -u "$auth" -X PUT "$api/vhosts/concert_ops" \
  -H 'content-type: application/json' -d '{}' >/dev/null

curl -fsS -u "$auth" -X PUT "$api/users/svc_ticketing" \
  -H 'content-type: application/json' \
  -d "{\"password\":\"${TICKETING_RABBITMQ_PASSWORD}\",\"tags\":\"\"}" >/dev/null

curl -fsS -u "$auth" -X PUT "$api/users/svc_notify" \
  -H 'content-type: application/json' \
  -d "{\"password\":\"${NOTIFY_RABBITMQ_PASSWORD}\",\"tags\":\"\"}" >/dev/null

curl -fsS -u "$auth" -X PUT "$api/permissions/concert_ops/svc_ticketing" \
  -H 'content-type: application/json' \
  -d '{"configure":".*","write":".*","read":".*"}' >/dev/null

curl -fsS -u "$auth" -X PUT "$api/permissions/concert_ops/svc_notify" \
  -H 'content-type: application/json' \
  -d '{"configure":".*","write":".*","read":".*"}' >/dev/null
