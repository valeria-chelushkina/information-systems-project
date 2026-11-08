import { databaseConfigFor } from '@/shared/config/database.js';
import { optionalEnv } from '@/shared/config/env.js';
import type { ServiceName } from '@/shared/typedefs/database.typedefs.js';

const serviceName = optionalEnv('SERVICE_NAME', 'ticketing') as ServiceName;
const prefix = serviceName.toUpperCase();

export const config = {
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  serviceName,
  port: Number(optionalEnv(`${prefix}_PORT`, '3001')),
  logLevel: optionalEnv('LOG_LEVEL', 'info'),
  holdSweepIntervalMs: Number(optionalEnv('HOLD_SWEEP_INTERVAL_MS', '10000')),
  holdTtlMs: Number(optionalEnv('HOLD_TTL_MS', '600000')),
  database: databaseConfigFor(serviceName),
} as const;
