import { call, callEmpty, callPage, type Page } from '@/services/web/clients/http.client.js';
import { webConfig } from '@/services/web/config.js';
import type {
  CustomerOrder,
  EventDto,
  EventStatus,
  OrderDetail,
  PublicEventDto,
  PublicTierDto,
  TierDto,
} from '@/services/web/typedefs/api.typedefs.js';

export interface CreateEventPayload {
  title: string;
  performerId: string;
  venueId: string;
  startsAt: string;
  doorsAt?: string;
  durationMinutes?: number;
  status?: 'draft' | 'scheduled';
}

export interface UpdateEventPayload {
  status?: EventStatus;
}

export interface CreateTierPayload {
  name: string;
  priceCents: number;
  totalQty: number;
}

export interface UpdateTierPayload {
  name?: string;
  priceCents?: number;
  totalQty?: number;
}

export interface EventQuery {
  status?: EventStatus;
  search?: string;
  performerId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface PublicEventQuery {
  limit: number;
  offset: number;
  search?: string;
  performerId?: string;
  from?: string;
  to?: string;
}

export class TicketingClient {
  listEvents(token: string, query: EventQuery = {}): Promise<Page<EventDto>> {
    return callPage<EventDto>(webConfig.ticketingBaseUrl, '/api/events', {
      token,
      query: {
        status: query.status,
        search: query.search,
        performerId: query.performerId,
        from: query.from,
        to: query.to,
        limit: query.limit,
        offset: query.offset,
      },
    });
  }

  getEvent(token: string, id: string): Promise<EventDto> {
    return call<EventDto>(webConfig.ticketingBaseUrl, `/api/events/${id}`, { token });
  }

  createEvent(token: string, payload: CreateEventPayload): Promise<EventDto> {
    return call<EventDto>(webConfig.ticketingBaseUrl, '/api/events', {
      method: 'POST',
      token,
      body: payload,
    });
  }

  updateEvent(token: string, id: string, payload: UpdateEventPayload): Promise<EventDto> {
    return call<EventDto>(webConfig.ticketingBaseUrl, `/api/events/${id}`, {
      method: 'PATCH',
      token,
      body: payload,
    });
  }

  deleteEvent(token: string, id: string): Promise<void> {
    return callEmpty(webConfig.ticketingBaseUrl, `/api/events/${id}`, {
      method: 'DELETE',
      token,
    });
  }

  listTiers(token: string, eventId: string): Promise<TierDto[]> {
    return call<TierDto[]>(webConfig.ticketingBaseUrl, `/api/events/${eventId}/tiers`, {
      token,
    });
  }

  createTier(token: string, eventId: string, payload: CreateTierPayload): Promise<TierDto> {
    return call<TierDto>(webConfig.ticketingBaseUrl, `/api/events/${eventId}/tiers`, {
      method: 'POST',
      token,
      body: payload,
    });
  }

  updateTier(token: string, tierId: string, payload: UpdateTierPayload): Promise<TierDto> {
    return call<TierDto>(webConfig.ticketingBaseUrl, `/api/tiers/${tierId}`, {
      method: 'PATCH',
      token,
      body: payload,
    });
  }

  deleteTier(token: string, tierId: string): Promise<void> {
    return callEmpty(webConfig.ticketingBaseUrl, `/api/tiers/${tierId}`, {
      method: 'DELETE',
      token,
    });
  }

  createHold(
    token: string,
    payload: { tierId: string; quantity: number; customerRef: string },
  ): Promise<{ id: string }> {
    return call<{ id: string }>(webConfig.ticketingBaseUrl, '/api/holds', {
      method: 'POST',
      token,
      body: payload,
    });
  }

  cancelHold(token: string, holdId: string): Promise<void> {
    return callEmpty(webConfig.ticketingBaseUrl, `/api/holds/${holdId}`, {
      method: 'DELETE',
      token,
    });
  }

  purchase(
    token: string,
    payload: { holdId: string; idempotencyKey: string; customerEmail: string },
  ): Promise<OrderDetail> {
    return call<OrderDetail>(webConfig.ticketingBaseUrl, '/api/purchases', {
      method: 'POST',
      token,
      body: payload,
    });
  }

  getOrder(token: string, id: string): Promise<OrderDetail> {
    return call<OrderDetail>(webConfig.ticketingBaseUrl, `/api/orders/${id}`, { token });
  }

  listOrders(token: string, limit: number, offset: number): Promise<Page<CustomerOrder>> {
    return callPage<CustomerOrder>(webConfig.ticketingBaseUrl, '/api/orders', {
      token,
      query: { limit, offset },
    });
  }

  refundOrder(token: string, id: string, reason?: string): Promise<{ order: OrderDetail['order'] }> {
    return call<{ order: OrderDetail['order'] }>(
      webConfig.ticketingBaseUrl,
      `/api/orders/${id}/refund`,
      {
        method: 'POST',
        token,
        body: reason === undefined ? {} : { reason },
      },
    );
  }

  listPublicEvents(query: PublicEventQuery): Promise<Page<PublicEventDto>> {
    return callPage<PublicEventDto>(webConfig.ticketingBaseUrl, '/public/events', {
      query: {
        limit: query.limit,
        offset: query.offset,
        search: query.search,
        performerId: query.performerId,
        from: query.from,
        to: query.to,
      },
    });
  }

  getPublicEvent(id: string): Promise<{ event: PublicEventDto; tiers: PublicTierDto[] }> {
    return call<{ event: PublicEventDto; tiers: PublicTierDto[] }>(
      webConfig.ticketingBaseUrl,
      `/public/events/${id}`,
    );
  }
}
