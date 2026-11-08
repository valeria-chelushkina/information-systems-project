import { databaseConfigFor } from '@/config/database.js';
import { optionalEnv } from '@/config/env.js';

export const config = {
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  port: Number(optionalEnv('TICKETING_PORT', '3001')),
  logLevel: optionalEnv('LOG_LEVEL', 'info'),
  holdSweepIntervalMs: Number(optionalEnv('HOLD_SWEEP_INTERVAL_MS', '10000')),
  holdTtlMs: Number(optionalEnv('HOLD_TTL_MS', '600000')),
  database: databaseConfigFor('ticketing'),
} as const;
