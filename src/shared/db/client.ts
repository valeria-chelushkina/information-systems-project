import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { databaseConfigFor } from '@/shared/config/database.js';
import { config } from '@/shared/config/index.js';
import { logger } from '@/shared/observability/logger.js';

const { Pool } = pg;

const databaseConfig = databaseConfigFor(config.serviceName);

export const pool = new Pool({
  host: databaseConfig.host,
  port: databaseConfig.port,
  user: databaseConfig.user,
  password: databaseConfig.password,
  database: databaseConfig.database,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
  logger.error({ err: error }, 'idle postgres client error');
});

export const db = drizzle(pool);

export type Database = typeof db;
