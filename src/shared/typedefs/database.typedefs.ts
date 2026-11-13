import type { Database } from '@/shared/db/client.js';

export type ServiceName = 'ticketing' | 'catalog' | 'auth' | 'notify' | 'web';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
