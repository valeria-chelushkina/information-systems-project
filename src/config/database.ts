import { optionalEnv, requiredEnv } from '@/config/env.js';
import type { ServiceName, DatabaseConfig } from '@/typedefs/database.typedefs.js';

export function databaseConfigFor(service: ServiceName): DatabaseConfig {
  const prefix = service.toUpperCase();
  return {
    host: optionalEnv('DB_HOST', '127.0.0.1'),
    port: Number(optionalEnv('DB_PORT', '5434')),
    user: requiredEnv(`${prefix}_DB_USER`),
    password: requiredEnv(`${prefix}_DB_PASSWORD`),
    database: requiredEnv(`${prefix}_DB_NAME`),
  };
}
