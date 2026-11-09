import { optionalEnv } from '@/shared/config/env.js';
import type { ServiceName } from '@/shared/typedefs/database.typedefs.js';

const DEFAULT_PORTS: Record<ServiceName, string> = {
  ticketing: '3001',
  catalog: '3003',
  auth: '3005',
  notify: '3008',
};

const serviceName = optionalEnv('SERVICE_NAME', 'ticketing') as ServiceName;
const prefix = serviceName.toUpperCase();

export const config = {
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  serviceName,
  port: Number(optionalEnv(`${prefix}_PORT`, DEFAULT_PORTS[serviceName])),
  logLevel: optionalEnv('LOG_LEVEL', 'info'),
  authBaseUrl: optionalEnv('AUTH_BASE_URL', 'http://127.0.0.1:3005'),
  authTimeoutMs: Number(optionalEnv('AUTH_TIMEOUT_MS', '3000')),
} as const;
