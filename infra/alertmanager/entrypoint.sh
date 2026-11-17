#!/bin/sh
set -eu

SMTP_PORT="${SMTP_PORT:-587}"
SMTP_REQUIRE_TLS="${SMTP_REQUIRE_TLS:-true}"
ALERTMANAGER_EXTERNAL_URL="${ALERTMANAGER_EXTERNAL_URL:-http://localhost:9093}"

escape() {
  printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'
}

if [ -n "${SMTP_HOST:-}" ] && [ -n "${SMTP_FROM:-}" ] && [ -n "${ALERT_EMAIL_TO:-}" ]; then
  if [ -n "${SMTP_USER:-}" ] || [ -n "${SMTP_PASSWORD:-}" ]; then
    : "${SMTP_USER:?SMTP_USER is required when SMTP_PASSWORD is set}"
    : "${SMTP_PASSWORD:?SMTP_PASSWORD is required when SMTP_USER is set}"
  fi

  sed \
    -e "s|__SMTP_HOST__|$(escape "$SMTP_HOST")|g" \
    -e "s|__SMTP_PORT__|$(escape "$SMTP_PORT")|g" \
    -e "s|__SMTP_FROM__|$(escape "$SMTP_FROM")|g" \
    -e "s|__SMTP_USER__|$(escape "${SMTP_USER:-}")|g" \
    -e "s|__SMTP_PASSWORD__|$(escape "${SMTP_PASSWORD:-}")|g" \
    -e "s|__ALERT_EMAIL_TO__|$(escape "$ALERT_EMAIL_TO")|g" \
    -e "s|__SMTP_REQUIRE_TLS__|$(escape "$SMTP_REQUIRE_TLS")|g" \
    /etc/alertmanager/alertmanager.template.yml > /tmp/alertmanager.yml
else
  echo "SMTP is not configured; alert email is disabled and only the webhook is used" >&2
  cp /etc/alertmanager/alertmanager.webhook.template.yml /tmp/alertmanager.yml
fi

exec /bin/alertmanager \
  --config.file=/tmp/alertmanager.yml \
  --storage.path=/alertmanager \
  --web.external-url="$ALERTMANAGER_EXTERNAL_URL" \
  --web.route-prefix=/
