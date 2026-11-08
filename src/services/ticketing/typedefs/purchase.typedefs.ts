import type { OrderRow } from '@/services/ticketing/typedefs/order.typedefs.js';
import type { TicketRow } from '@/services/ticketing/typedefs/ticket.typedefs.js';

export interface PurchaseResult {
  order: OrderRow;
  tickets: TicketRow[];
  created: boolean;
}
