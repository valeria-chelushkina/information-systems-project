import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '@/config/index.js';
import { logger } from '@/observability/logger.js';
import * as schema from '@/db/schema/index.js';

const { Pool } = pg;

export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
  logger.error({ err: error }, 'idle postgres client error');
});

export const db = drizzle(pool, { schema });

export { schema };
