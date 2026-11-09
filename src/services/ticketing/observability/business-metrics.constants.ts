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

export const holdsCreatedTotal = new Counter({
  name: 'holds_created_total',
  help: 'Holds created',
  registers: [registry],
});

export const revenueCentsTotal = new Counter({
  name: 'revenue_cents_total',
  help: 'Revenue from paid orders, in cents',
  registers: [registry],
});

export const refundedCentsTotal = new Counter({
  name: 'refunded_cents_total',
  help: 'Refunded amount, in cents',
  registers: [registry],
});
