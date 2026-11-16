import { optionalEnv } from '@/shared/config/env.js';

const smtpHost = optionalEnv('SMTP_HOST', '');
const mailFrom = optionalEnv('SMTP_FROM', '');
const mailTo = optionalEnv('ALERT_EMAIL_TO', '');

export const notifyConfig = {
  smtpHost,
  smtpPort: Number(optionalEnv('SMTP_PORT', '587')),
  smtpSecure: optionalEnv('SMTP_SECURE', 'false') === 'true',
  smtpUser: optionalEnv('SMTP_USER', ''),
  smtpPassword: optionalEnv('SMTP_PASSWORD', ''),
  mailFrom,
  mailTo,
  emailEnabled: Boolean(smtpHost && mailFrom && mailTo),
  emailRetryMinutes: Number(optionalEnv('ALERT_EMAIL_RETRY_MINUTES', '15')),
  ticketEmailTransport: optionalEnv('TICKET_EMAIL_TRANSPORT', 'mailpit'),
  mailpitHost: optionalEnv('MAILPIT_HOST', 'mailpit'),
  mailpitPort: Number(optionalEnv('MAILPIT_SMTP_PORT', '1025')),
  ticketEmailFrom: optionalEnv('TICKET_EMAIL_FROM', mailFrom || 'tickets@concert-ops.local'),
  notifyDbPath: optionalEnv('NOTIFY_DB_PATH', './data/notify.db'),
  webUrl: optionalEnv('WEB_PUBLIC_URL', 'http://localhost:3008'),
  grafanaUrl: optionalEnv('GRAFANA_PUBLIC_URL', 'http://localhost:3007'),
} as const;
