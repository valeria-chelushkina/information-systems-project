import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Gauge } from 'prom-client';
import { databaseConfigFor } from '@/shared/config/database.js';
import { config } from '@/shared/config/index.js';
import { registry } from '@/shared/observability/metrics.js';
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

new Gauge({
  name: 'db_pool_total_connections',
  help: 'Total connections held by the pool',
  registers: [registry],
  collect() {
    this.set(pool.totalCount);
  },
});

new Gauge({
  name: 'db_pool_idle_connections',
  help: 'Idle connections in the pool',
  registers: [registry],
  collect() {
    this.set(pool.idleCount);
  },
});

new Gauge({
  name: 'db_pool_waiting_requests',
  help: 'Requests waiting for a connection from the pool',
  registers: [registry],
  collect() {
    this.set(pool.waitingCount);
  },
});

export type Database = typeof db;
