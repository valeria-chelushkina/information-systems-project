import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { databaseConfigFor } from '@/shared/config/database.js';
import { optionalEnv } from '@/shared/config/env.js';
import type { ServiceName } from '@/shared/typedefs/database.typedefs.js';

const { Pool } = pg;

async function main(): Promise<void> {
  const service = (process.argv[2] ??
    optionalEnv('SERVICE_NAME', 'ticketing')) as ServiceName;

  const pool = new Pool(databaseConfigFor(service));
  const db = drizzle(pool);

  try {
    await migrate(db, { migrationsFolder: path.resolve('drizzle', service) });
    console.log(`[${service}] migrations applied`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('migrations failed');
  console.error(error);
  process.exit(1);
});
