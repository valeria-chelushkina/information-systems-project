import { db } from '@/db/client.js';

export type ServiceName = 'ticketing' | 'catalog' | 'notify';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
