export type ServiceName = 'ticketing' | 'catalog' | 'notify';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}
