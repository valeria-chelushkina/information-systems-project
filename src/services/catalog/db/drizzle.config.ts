import { defineConfig } from 'drizzle-kit';
import { requiredEnv } from '@/shared/config/env.js';

export default defineConfig({
  schema: './src/services/catalog/db/schema/index.ts',
  out: './drizzle/catalog',
  dialect: 'postgresql',
  strict: true,
  verbose: true,
  dbCredentials: {
    host: requiredEnv('DB_HOST'),
    port: Number(requiredEnv('DB_PORT')),
    user: requiredEnv('CATALOG_DB_USER'),
    password: requiredEnv('CATALOG_DB_PASSWORD'),
    database: requiredEnv('CATALOG_DB_NAME'),
    ssl: false,
  },
});
