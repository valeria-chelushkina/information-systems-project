import { defineConfig } from 'drizzle-kit';
import { requiredEnv } from '@/config/env.js';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  strict: true,
  verbose: true,
  dbCredentials: {
    host: requiredEnv('DB_HOST'),
    port: Number(requiredEnv('DB_PORT')),
    user: requiredEnv('TICKETING_DB_USER'),
    password: requiredEnv('TICKETING_DB_PASSWORD'),
    database: requiredEnv('TICKETING_DB_NAME'),
    ssl: false,
  },
});
