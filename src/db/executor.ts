import type { PgDatabase } from 'drizzle-orm/pg-core';

export type Executor = PgDatabase<any, any>;
