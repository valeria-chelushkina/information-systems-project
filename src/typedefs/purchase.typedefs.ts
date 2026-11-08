import type { OrderRow } from '@/typedefs/order.typedefs.js';
import type { TicketRow } from '@/typedefs/ticket.typedefs.js';

export interface PurchaseResult {
  order: OrderRow;
  tickets: TicketRow[];
  created: boolean;
}
