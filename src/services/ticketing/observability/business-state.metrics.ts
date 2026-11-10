import { Gauge } from 'prom-client';
import { registry } from '@/shared/observability/metrics.js';
import { EVENT_STATUSES } from '@/services/ticketing/typedefs/event.typedefs.js';

export const eventsByStatus = new Gauge({
  name: 'events_total',
  help: 'Events by current status',
  labelNames: ['status'] as const,
  registers: [registry],
});

for (const status of EVENT_STATUSES) {
  eventsByStatus.set({ status }, 0);
}

export const inventoryTotalSeats = new Gauge({
  name: 'inventory_total_seats',
  help: 'Seats across all price tiers',
  registers: [registry],
});

export const inventorySoldSeats = new Gauge({
  name: 'inventory_sold_seats',
  help: 'Sold seats across all price tiers',
  registers: [registry],
});

export const inventoryAvailableSeats = new Gauge({
  name: 'inventory_available_seats',
  help: 'Available seats across all price tiers',
  registers: [registry],
});

export const inventoryHeldSeats = new Gauge({
  name: 'inventory_held_seats',
  help: 'Held seats across all price tiers',
  registers: [registry],
});

export const eventsUpcomingTotal = new Gauge({
  name: 'events_upcoming_total',
  help: 'Future scheduled, on-sale and sold-out events',
  registers: [registry],
});
