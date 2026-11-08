import { databaseConfigFor } from '@/config/database.js';
import { optionalEnv } from '@/config/env.js';

export const config = {
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  port: Number(optionalEnv('TICKETING_PORT', '3001')),
  logLevel: optionalEnv('LOG_LEVEL', 'info'),
  database: databaseConfigFor('ticketing'),
} as const;
