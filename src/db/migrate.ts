import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '@/db/client.js';

async function main(): Promise<void> {
  await migrate(db, { migrationsFolder: path.resolve('drizzle') });
  await pool.end();
  console.log('migrations applied');
}

main().catch(async (error) => {
  console.error('migrations failed');
  console.error(error);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
