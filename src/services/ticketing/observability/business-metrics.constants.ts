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

export const holdRejectionsTotal = new Counter({
  name: 'hold_rejections_total',
  help: 'Hold attempts rejected before purchase',
  labelNames: ['reason'] as const,
  registers: [registry],
});

holdRejectionsTotal.inc({ reason: 'insufficient_inventory' }, 0);
holdRejectionsTotal.inc({ reason: 'event_not_on_sale' }, 0);

purchasesTotal.inc({ status: 'ok' }, 0);
purchasesTotal.inc({ status: 'failed' }, 0);
purchasesTotal.inc({ status: 'replay' }, 0);

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
