import { Counter } from 'prom-client';
import { registry } from '@/shared/observability/metrics.js';

export const bookingsTotal = new Counter({
  name: 'bookings_total',
  help: 'Venue booking requests by status',
  labelNames: ['status'] as const,
  registers: [registry],
});
