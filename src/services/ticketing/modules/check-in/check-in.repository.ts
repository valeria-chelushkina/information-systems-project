import { EventsRepository } from '@/services/ticketing/modules/events/events.repository.js';
import { TicketsRepository } from '@/services/ticketing/modules/purchases/tickets.repository.js';
import type { EventRow } from '@/services/ticketing/typedefs/event.typedefs.js';
import type { TicketRow } from '@/services/ticketing/typedefs/ticket.typedefs.js';

export class CheckInRepository {
  protected readonly tickets = new TicketsRepository();
  protected readonly events = new EventsRepository();

  findByQrToken(qrToken: string): Promise<TicketRow | null> {
    return this.tickets.findByQrToken(qrToken);
  }

  findByQrTokenPrefix(prefix: string): Promise<TicketRow[]> {
    return this.tickets.findByQrTokenPrefix(prefix);
  }

  findByIdPrefix(prefix: string): Promise<TicketRow[]> {
    return this.tickets.findByIdPrefix(prefix);
  }

  checkIn(id: string): Promise<TicketRow | null> {
    return this.tickets.checkIn(id);
  }

  findEvent(id: string): Promise<EventRow | null> {
    return this.events.findById(id);
  }
}
