import { EventsRepository } from '@/services/ticketing/modules/events/events.repository.js';
import type { ListPublicEventsQuery } from '@/services/ticketing/modules/public/public.schemas.js';
import { TiersRepository } from '@/services/ticketing/modules/tiers/tiers.repository.js';
import type { EventStatus } from '@/services/ticketing/typedefs/event.typedefs.js';
import {
  PUBLIC_EVENT_STATUSES,
  toPublicEvent,
  toPublicTier,
  type PublicEventDetail,
  type PublicEventDto,
  type PublicTierDto,
} from '@/services/ticketing/typedefs/public.typedefs.js';
import { HttpError } from '@/shared/errors/http-error.js';

export interface PublicEventPage {
  items: PublicEventDto[];
  total: number;
  limit: number;
  offset: number;
}

export class PublicEventsService {
  protected readonly events = new EventsRepository();
  protected readonly tiers = new TiersRepository();

  async listEvents(query: ListPublicEventsQuery): Promise<PublicEventPage> {
    const from = new Date();

    const [items, total] = await Promise.all([
      this.events.findUpcoming(PUBLIC_EVENT_STATUSES, from, query.limit, query.offset),
      this.events.countUpcoming(PUBLIC_EVENT_STATUSES, from),
    ]);

    return {
      items: items.map(toPublicEvent),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getEvent(id: string): Promise<PublicEventDto> {
    const event = await this.events.findById(id);

    if (!event || !PUBLIC_EVENT_STATUSES.includes(event.status as EventStatus)) {
      throw HttpError.notFound('event_not_found', `Event ${id} was not found`);
    }

    return toPublicEvent(event);
  }

  async getEventDetail(id: string): Promise<PublicEventDetail> {
    const event = await this.getEvent(id);
    const tiers = await this.tiers.findByEventId(id);

    return { event, tiers: tiers.map(toPublicTier) };
  }

  async listTiers(eventId: string): Promise<PublicTierDto[]> {
    await this.getEvent(eventId);
    const tiers = await this.tiers.findByEventId(eventId);

    return tiers.map(toPublicTier);
  }
}
