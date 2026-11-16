import { Counter, Histogram } from 'prom-client';
import { registry } from '@/shared/observability/metrics.js';

export const notificationDeliveriesTotal = new Counter({
  name: 'notification_deliveries_total',
  help: 'Purchase notification delivery attempts by outcome',
  labelNames: ['status'] as const,
  registers: [registry],
});

export const notificationDeliveryDuration = new Histogram({
  name: 'notification_delivery_duration_seconds',
  help: 'Time spent rendering and sending a ticket email',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});
