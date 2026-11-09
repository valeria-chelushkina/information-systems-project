import { optionalEnv } from '@/shared/config/env.js';

export const ticketingConfig = {
  holdTtlMs: Number(optionalEnv('HOLD_TTL_MS', '600000')),
  holdSweepIntervalMs: Number(optionalEnv('HOLD_SWEEP_INTERVAL_MS', '10000')),
  catalogBaseUrl: optionalEnv('CATALOG_BASE_URL', 'http://127.0.0.1:3003'),
  catalogTimeoutMs: Number(optionalEnv('CATALOG_TIMEOUT_MS', '3000')),
} as const;
