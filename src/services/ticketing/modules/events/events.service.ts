import { CatalogClient } from '@/services/ticketing/clients/catalog.client.js';
import { EventsRepository } from '@/services/ticketing/modules/events/events.repository.js';
import type {
  CreateEventInput,
  ListEventsQuery,
  UpdateEventInput,
} from '@/services/ticketing/modules/events/events.schemas.js';
import { HttpError } from '@/shared/errors/http-error.js';
import type {
  EventPage,
  EventRow,
  EventStatus,
  NewEventRow,
} from '@/services/ticketing/typedefs/event.typedefs.js';

const SALES_STATUSES: readonly EventStatus[] = ['on_sale', 'sold_out', 'completed'];

const ALLOWED_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['on_sale', 'cancelled'],
  on_sale: ['sold_out', 'cancelled'],
  sold_out: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export class EventsService {
  protected readonly repository = new EventsRepository();
  protected readonly catalog = new CatalogClient();

  async createEvent(input: CreateEventInput): Promise<EventRow> {
    this.assertSchedule(input);

    const [performer, venue] = await Promise.all([
      this.catalog.getPerformer(input.performerId),
      this.catalog.getVenue(input.venueId),
    ]);

    return this.repository.insertOne({
      title: input.title,
      performerId: performer.id,
      performerName: performer.name,
      venueId: venue.id,
      venueName: venue.name,
      startsAt: input.startsAt,
      doorsAt: input.doorsAt ?? null,
      durationMinutes: input.durationMinutes ?? null,
      onSaleAt: input.onSaleAt ?? null,
      status: input.status ?? 'draft',
    });
  }

  async listEvents(query: ListEventsQuery): Promise<EventPage> {
    const filters = {
      status: query.status,
      from: query.from,
      to: query.to,
      limit: query.limit,
      offset: query.offset,
    };

    const [items, total] = await Promise.all([
      this.repository.findMany(filters),
      this.repository.count(filters),
    ]);

    return { items, total, limit: filters.limit, offset: filters.offset };
  }

  async getEventById(id: string): Promise<EventRow> {
    const event = await this.repository.findById(id);

    if (!event) {
      throw HttpError.notFound('event_not_found', `Event ${id} was not found`);
    }

    return event;
  }

  async updateEvent(id: string, input: UpdateEventInput): Promise<EventRow> {
    const existing = await this.getEventById(id);

    if (input.status !== undefined) {
      this.assertTransition(existing.status as EventStatus, input.status);
    }

    this.assertSchedule({
      startsAt: input.startsAt ?? existing.startsAt,
      doorsAt: input.doorsAt === undefined ? existing.doorsAt : input.doorsAt,
      onSaleAt: input.onSaleAt === undefined ? existing.onSaleAt : input.onSaleAt,
    });

    const changes = this.toChanges(input);

    if (input.performerId !== undefined) {
      const performer = await this.catalog.getPerformer(input.performerId);
      changes.performerName = performer.name;
    }

    if (input.venueId !== undefined) {
      const venue = await this.catalog.getVenue(input.venueId);
      changes.venueName = venue.name;
    }

    const updated = await this.repository.updateById(id, changes);

    if (!updated) {
      throw HttpError.notFound('event_not_found', `Event ${id} was not found`);
    }

    return updated;
  }

  async deleteEvent(id: string): Promise<void> {
    const existing = await this.getEventById(id);

    if (SALES_STATUSES.includes(existing.status as EventStatus)) {
      throw HttpError.conflict(
        'event_has_sales',
        'Cannot delete an event that is on sale, sold out or completed',
      );
    }

    await this.repository.deleteById(id);
  }

  private assertSchedule(input: {
    startsAt: Date;
    doorsAt?: Date | null;
    onSaleAt?: Date | null;
  }): void {
    if (input.doorsAt && input.doorsAt >= input.startsAt) {
      throw HttpError.badRequest('invalid_schedule', 'doorsAt must be earlier than startsAt');
    }

    if (input.onSaleAt && input.onSaleAt > input.startsAt) {
      throw HttpError.badRequest('invalid_schedule', 'onSaleAt must not be later than startsAt');
    }
  }

  private assertTransition(from: EventStatus, to: EventStatus): void {
    if (from === to) {
      return;
    }

    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      throw HttpError.conflict(
        'invalid_status_transition',
        `Cannot change event status from ${from} to ${to}`,
      );
    }
  }

  private toChanges(input: UpdateEventInput): Partial<NewEventRow> {
  return Object.fromEntries(
    Object.entries(input).filter(([_, value]) => value !== undefined)
  ) as Partial<NewEventRow>;
}
}
