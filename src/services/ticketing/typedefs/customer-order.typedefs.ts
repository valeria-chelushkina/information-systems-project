import type { EventRow } from '@/services/ticketing/typedefs/event.typedefs.js';
import type { OrderRow } from '@/services/ticketing/typedefs/order.typedefs.js';
import type { TicketRow } from '@/services/ticketing/typedefs/ticket.typedefs.js';

export interface CustomerOrderEvent {
  id: string;
  title: string;
  performerName: string;
  venueName: string;
  startsAt: string;
  status: string;
}

export interface CustomerOrder {
  order: OrderRow;
  tickets: TicketRow[];
  event: CustomerOrderEvent | null;
}

export interface CustomerOrderPage {
  items: CustomerOrder[];
  total: number;
  limit: number;
  offset: number;
}

export function toCustomerEvent(row: EventRow): CustomerOrderEvent {
  return {
    id: row.id,
    title: row.title,
    performerName: row.performerName,
    venueName: row.venueName,
    startsAt: row.startsAt.toISOString(),
    status: row.status,
  };
}
