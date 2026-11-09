import { Counter } from 'prom-client';
import { registry } from '@/shared/observability/metrics.js';

export const ticketsSoldTotal = new Counter({
  name: 'tickets_sold_total',
  help: 'Tickets issued, one per admission',
  registers: [registry],
});

export const purchasesTotal = new Counter({
  name: 'purchases_total',
  help: 'Purchase attempts by outcome',
  labelNames: ['status'] as const,
  registers: [registry],
});

export const refundsTotal = new Counter({
  name: 'refunds_total',
  help: 'Orders refunded in full',
  registers: [registry],
});

export const holdsExpiredTotal = new Counter({
  name: 'holds_expired_total',
  help: 'Holds released by the expiry sweeper',
  registers: [registry],
});
