import { randomUUID } from 'node:crypto';
import { UpstreamError } from '@/services/web/clients/http.client.js';
import { TicketingClient } from '@/services/web/clients/ticketing.client.js';
import { canSeeOrder, isStaff } from '@/services/web/modules/session/session.helpers.js';
import type {
  EventDto,
  OrderDetail,
  PublicEventCard,
  PublicEventDto,
  PublicTierDto,
  SessionUser,
} from '@/services/web/typedefs/api.typedefs.js';
import { HttpError } from '@/shared/errors/http-error.js';

export interface PublicEventsResult {
  items: PublicEventCard[];
  total: number;
  limit: number;
  offset: number;
}

export interface EventDetailResult {
  event: PublicEventDto;
  tiers: PublicTierDto[];
}

export interface OrderPageResult {
  order: OrderDetail['order'];
  tickets: OrderDetail['tickets'];
  event: EventDto | null;
  tierNames: Record<string, string>;
  canRefund: boolean;
}

export class PagesService {
  protected readonly ticketing = new TicketingClient();

  async listPublic(limit: number, offset: number): Promise<PublicEventsResult> {
    const page = await this.ticketing.listPublicEvents(limit, offset);
    const items = await this.withPrices(page.items);

    return { items, total: page.total, limit: page.limit, offset: page.offset };
  }

  eventDetail(id: string): Promise<EventDetailResult> {
    return this.ticketing.getPublicEvent(id);
  }

  async purchase(
    user: SessionUser,
    token: string,
    eventId: string,
    tierId: string,
    quantity: number,
  ): Promise<string> {
    const hold = await this.ticketing.createHold(token, {
      tierId,
      quantity,
      customerRef: user.userId,
    });

    try {
      const result = await this.ticketing.purchase(token, {
        holdId: hold.id,
        idempotencyKey: randomUUID(),
        customerEmail: user.email,
      });

      return result.order.id;
    } catch (error) {
      await this.ticketing.cancelHold(token, hold.id).catch(() => undefined);
      throw error;
    }
  }

  async order(user: SessionUser, token: string, id: string): Promise<OrderPageResult> {
    const detail = await this.ticketing.getOrder(token, id);

    if (!canSeeOrder(user, detail.order.customerRef)) {
      throw new HttpError(403, 'forbidden', 'Order belongs to another customer');
    }

    const enriched = await this.enrich(token, detail);

    return {
      order: detail.order,
      tickets: detail.tickets,
      event: enriched.event,
      tierNames: enriched.tierNames,
      canRefund:
        detail.order.status === 'paid' &&
        (isStaff(user) || detail.order.customerRef === user.userId),
    };
  }

  async refund(user: SessionUser, token: string, id: string): Promise<string> {
    const detail = await this.ticketing.getOrder(token, id);

    if (!canSeeOrder(user, detail.order.customerRef)) {
      throw new HttpError(403, 'forbidden', 'Order belongs to another customer');
    }

    await this.ticketing.refundOrder(token, id, 'customer_request');

    return detail.order.id;
  }

  private async enrich(
    token: string,
    detail: OrderDetail,
  ): Promise<{ event: EventDto | null; tierNames: Record<string, string> }> {
    const eventId = detail.tickets[0]?.eventId;

    if (!eventId) {
      return { event: null, tierNames: {} };
    }

    const [event, tiers] = await Promise.all([
      this.ticketing.getEvent(token, eventId).catch(() => null),
      this.ticketing.listTiers(token, eventId).catch(() => []),
    ]);

    return {
      event,
      tierNames: Object.fromEntries(tiers.map((tier) => [tier.id, tier.name])),
    };
  }

  private async withPrices(events: PublicEventDto[]): Promise<PublicEventCard[]> {
    return Promise.all(
      events.map(async (event) => {
        try {
          const detail = await this.ticketing.getPublicEvent(event.id);
          const minPriceCents = detail.tiers.reduce<number | null>(
            (min, tier) => (min === null || tier.priceCents < min ? tier.priceCents : min),
            null,
          );

          return { ...event, minPriceCents };
        } catch (error) {
          if (error instanceof UpstreamError) {
            return { ...event, minPriceCents: null };
          }

          throw error;
        }
      }),
    );
  }
}
