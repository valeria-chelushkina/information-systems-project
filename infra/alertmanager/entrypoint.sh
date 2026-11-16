#!/bin/sh
set -eu

: "${SMTP_HOST:?SMTP_HOST is required for alert emails}"
: "${SMTP_FROM:?SMTP_FROM is required for alert emails}"
: "${ALERT_EMAIL_TO:?ALERT_EMAIL_TO is required for alert emails}"

if [ -n "${SMTP_USER:-}" ] || [ -n "${SMTP_PASSWORD:-}" ]; then
  : "${SMTP_USER:?SMTP_USER is required when SMTP_PASSWORD is set}"
  : "${SMTP_PASSWORD:?SMTP_PASSWORD is required when SMTP_USER is set}"
fi

SMTP_PORT="${SMTP_PORT:-587}"
SMTP_REQUIRE_TLS="${SMTP_REQUIRE_TLS:-true}"
ALERTMANAGER_EXTERNAL_URL="${ALERTMANAGER_EXTERNAL_URL:-http://localhost:9093}"

escape() {
  printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'
}

sed \
  -e "s|__SMTP_HOST__|$(escape "$SMTP_HOST")|g" \
  -e "s|__SMTP_PORT__|$(escape "$SMTP_PORT")|g" \
  -e "s|__SMTP_FROM__|$(escape "$SMTP_FROM")|g" \
  -e "s|__SMTP_USER__|$(escape "$SMTP_USER")|g" \
  -e "s|__SMTP_PASSWORD__|$(escape "$SMTP_PASSWORD")|g" \
  -e "s|__ALERT_EMAIL_TO__|$(escape "$ALERT_EMAIL_TO")|g" \
  -e "s|__SMTP_REQUIRE_TLS__|$(escape "$SMTP_REQUIRE_TLS")|g" \
  /etc/alertmanager/alertmanager.template.yml > /tmp/alertmanager.yml

exec /bin/alertmanager \
  --config.file=/tmp/alertmanager.yml \
  --storage.path=/alertmanager \
  --web.external-url="$ALERTMANAGER_EXTERNAL_URL" \
  --web.route-prefix=/
