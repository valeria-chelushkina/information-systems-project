import { CheckInRepository } from '@/services/ticketing/modules/check-in/check-in.repository.js';
import { ticketsCheckedInTotal } from '@/services/ticketing/observability/business-metrics.constants.js';
import type { CheckInResult } from '@/services/ticketing/typedefs/check-in.typedefs.js';
import type { TicketRow } from '@/services/ticketing/typedefs/ticket.typedefs.js';
import { HttpError } from '@/shared/errors/http-error.js';

export class CheckInService {
  protected readonly repository = new CheckInRepository();

  async checkIn(qrToken: string): Promise<CheckInResult> {
    const ticket = await this.resolve(qrToken);

    if (!ticket) {
      ticketsCheckedInTotal.inc({ result: 'rejected' });
      throw HttpError.notFound('ticket_not_found', 'No ticket matches this code');
    }

    if (ticket.status !== 'issued') {
      this.reject(ticket);
    }

    const updated = await this.repository.checkIn(ticket.id);

    if (!updated) {
      const current = await this.resolve(qrToken);

      if (current) {
        this.reject(current);
      }

      ticketsCheckedInTotal.inc({ result: 'rejected' });
      throw HttpError.conflict('ticket_not_admitted', 'Ticket could not be admitted');
    }

    const event = await this.repository.findEvent(updated.eventId);

    if (!event) {
      throw HttpError.notFound('event_not_found', `Event ${updated.eventId} was not found`);
    }

    ticketsCheckedInTotal.inc({ result: 'ok' });

    return { ticket: updated, event };
  }

  private async resolve(input: string): Promise<TicketRow | null> {
    const code = input.trim().toLowerCase();
    const exact = await this.repository.findByQrToken(code);

    if (exact) {
      return exact;
    }

    if (code.length < 6) {
      return null;
    }

    const byQr = await this.repository.findByQrTokenPrefix(code);

    if (byQr.length > 0) {
      return this.single(byQr);
    }

    const byId = await this.repository.findByIdPrefix(code);

    return byId.length > 0 ? this.single(byId) : null;
  }

  private single(matches: TicketRow[]): TicketRow {
    const [first] = matches;

    if (!first || matches.length > 1) {
      throw HttpError.conflict(
        'ticket_code_ambiguous',
        'More than one ticket matches this code',
      );
    }

    return first;
  }

  private reject(ticket: TicketRow): never {
    ticketsCheckedInTotal.inc({ result: 'rejected' });

    if (ticket.status === 'checked_in') {
      throw HttpError.conflict('ticket_already_checked_in', 'Ticket was already checked in', {
        checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
      });
    }

    throw HttpError.conflict('ticket_not_admitted', `Ticket status is ${ticket.status}`);
  }
}
