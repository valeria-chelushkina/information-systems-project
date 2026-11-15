import type { EventRecord } from '@/typedefs/catalog.typedefs';

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export type TicketStatus = 'issued' | 'checked_in' | 'refunded' | 'void';

export interface OrderRecord {
  id: string;
  customerRef: string;
  customerEmail: string;
  holdId: string;
  status: OrderStatus;
  totalCents: number;
  idempotencyKey: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  orderId: string;
  eventId: string;
  tierId: string;
  customerRef: string;
  unitPriceCents: number;
  status: TicketStatus;
  qrToken: string;
  checkedInAt: string | null;
  issuedAt: string;
}

export interface OrderDetail {
  order: OrderRecord;
  tickets: Ticket[];
  event: EventRecord | null;
  tierNames: Record<string, string>;
  canRefund: boolean;
}

export interface CustomerOrderEvent {
  id: string;
  title: string;
  performerName: string;
  venueName: string;
  startsAt: string;
  status: string;
}

export interface CustomerOrder {
  order: OrderRecord;
  tickets: Ticket[];
  event: CustomerOrderEvent | null;
  tierNames: Record<string, string>;
}

export interface PurchaseResult {
  orderId: string;
}

export interface CheckInResult {
  ticket: Ticket;
  event: EventRecord;
}
