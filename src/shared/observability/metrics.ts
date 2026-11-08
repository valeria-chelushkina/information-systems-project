import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';
import { config } from '@/shared/config/index.js';

export const registry = new Registry();
registry.setDefaultLabels({ service: config.serviceName });

collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests handled',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['query_name', 'status'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

export const dbQueryErrorsTotal = new Counter({
  name: 'db_query_errors_total',
  help: 'Total number of failed database queries',
  labelNames: ['query_name'] as const,
  registers: [registry],
});
