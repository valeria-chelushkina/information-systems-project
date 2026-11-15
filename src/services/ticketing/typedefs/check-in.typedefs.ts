import type { EventRow } from '@/services/ticketing/typedefs/event.typedefs.js';
import type { TicketRow } from '@/services/ticketing/typedefs/ticket.typedefs.js';

export interface CheckInResult {
  ticket: TicketRow;
  event: EventRow;
}
