import { optionalEnv } from '@/shared/config/env.js';

export const webConfig = {
  port: Number(optionalEnv('WEB_PORT', '3009')),
  authBaseUrl: optionalEnv('AUTH_BASE_URL', 'http://127.0.0.1:3005'),
  ticketingBaseUrl: optionalEnv('TICKETING_BASE_URL', 'http://127.0.0.1:3001'),
  catalogBaseUrl: optionalEnv('CATALOG_BASE_URL', 'http://127.0.0.1:3003'),
  timeoutMs: Number(optionalEnv('WEB_UPSTREAM_TIMEOUT_MS', '5000')),
  cookieName: optionalEnv('WEB_COOKIE_NAME', 'concert_session'),
  cookieSecure: optionalEnv('WEB_COOKIE_SECURE', 'false') === 'true',
  timeZone: optionalEnv('WEB_TIME_ZONE', 'Europe/Kyiv'),
} as const;
