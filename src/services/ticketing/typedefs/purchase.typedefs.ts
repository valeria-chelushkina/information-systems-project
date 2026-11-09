import type { OrderRow } from '@/services/ticketing/typedefs/order.typedefs.js';
import type { RefundRow } from '@/services/ticketing/typedefs/refund.typedefs.js';
import type { TicketRow } from '@/services/ticketing/typedefs/ticket.typedefs.js';

export interface PurchaseResult {
  order: OrderRow;
  tickets: TicketRow[];
  created: boolean;
}

export interface RefundResult {
  order: OrderRow;
  refund: RefundRow;
  tickets: TicketRow[];
}
