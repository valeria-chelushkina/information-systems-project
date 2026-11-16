import { randomUUID } from 'node:crypto';
import { ticketingConfig } from '@/services/ticketing/config.js';
import { transaction } from '@/shared/db/transaction.js';
import type { PurchaseCompletedEvent } from '@/shared/messaging/purchase-event.typedefs.js';
import { logger } from '@/shared/observability/logger.js';
import { EventsRepository } from '@/services/ticketing/modules/events/events.repository.js';
import { HoldsRepository } from '@/services/ticketing/modules/purchases/holds.repository.js';
import { OrdersRepository } from '@/services/ticketing/modules/purchases/orders.repository.js';
import type { CreateHoldInput, PurchaseInput, RefundOrderInput } from '@/services/ticketing/modules/purchases/purchases.schemas.js';
import { PaymentsRepository } from '@/services/ticketing/modules/purchases/payments.repository.js';
import { RefundsRepository } from '@/services/ticketing/modules/purchases/refunds.repository.js';
import { TicketsRepository } from '@/services/ticketing/modules/purchases/tickets.repository.js';
import { TiersRepository } from '@/services/ticketing/modules/tiers/tiers.repository.js';
import { PurchasePublisher } from '@/services/ticketing/messaging/purchase.publisher.js';
import { HttpError } from '@/shared/errors/http-error.js';
import type { HoldRow } from '@/services/ticketing/typedefs/hold.typedefs.js';
import type { OrderFilters, OrderRow, PerformerOption } from '@/services/ticketing/typedefs/order.typedefs.js';
import type { PurchaseResult, RefundResult } from '@/services/ticketing/typedefs/purchase.typedefs.js';
import {
  toCustomerEvent,
  type CustomerOrderPage,
} from '@/services/ticketing/typedefs/customer-order.typedefs.js';

const HOLD_TTL_MS = ticketingConfig.holdTtlMs;

export class PurchasesService {
  protected readonly holds = new HoldsRepository();
  protected readonly orders = new OrdersRepository();
  protected readonly tickets = new TicketsRepository();
  protected readonly payments = new PaymentsRepository();
  protected readonly refunds = new RefundsRepository();
  protected readonly tiers = new TiersRepository();
  protected readonly events = new EventsRepository();
  protected readonly publisher = new PurchasePublisher();

  async createHold(input: CreateHoldInput): Promise<HoldRow> {
    const hold = await transaction('create_hold', async (tx) => {
      const tier = await this.tiers.findById(input.tierId, tx);

      if (!tier) {
        throw HttpError.notFound('price_tier_not_found', `Price tier ${input.tierId} was not found`);
      }

      const event = await this.events.findById(tier.eventId, tx);

      if (!event) {
        throw HttpError.notFound('event_not_found', `Event ${tier.eventId} was not found`);
      }

      if (event.status !== 'on_sale') {
        throw HttpError.conflict('event_not_on_sale', `Event ${event.id} is not on sale`);
      }

      const reserved = await this.tiers.reserve(tier.id, input.quantity, tx);

      if (!reserved) {
        throw HttpError.conflict(
          'insufficient_inventory',
          'Not enough seats are available for this price tier',
        );
      }

      return this.holds.insertOne(
        {
          eventId: tier.eventId,
          tierId: tier.id,
          customerRef: input.customerRef,
          quantity: input.quantity,
          unitPriceCents: tier.priceCents,
          expiresAt: new Date(Date.now() + HOLD_TTL_MS),
        },
        tx,
      );
    });

    return hold;
  }

  async cancelHold(holdId: string): Promise<void> {
    await transaction('cancel_hold', async (tx) => {
      const hold = await this.holds.lockById(holdId, tx);

      if (!hold) {
        throw HttpError.notFound('hold_not_found', `Hold ${holdId} was not found`);
      }

      if (hold.status !== 'active') {
        throw HttpError.conflict('hold_not_active', `Hold ${holdId} is ${hold.status}`);
      }

      await this.holds.updateStatus([hold.id], 'cancelled', tx);
      await this.tiers.release(hold.tierId, hold.quantity, tx);
    });
  }

  async expireHolds(limit = 100): Promise<number> {
    const expiredCount = await transaction('expire_holds', async (tx) => {
      const expired = await this.holds.findExpired(limit, tx);

      if (expired.length === 0) {
        return 0;
      }

      await this.holds.updateStatus(
        expired.map((hold) => hold.id),
        'expired',
        tx,
      );

      const perTier = new Map<string, number>();

      for (const hold of expired) {
        perTier.set(hold.tierId, (perTier.get(hold.tierId) ?? 0) + hold.quantity);
      }

      for (const [tierId, quantity] of perTier) {
        await this.tiers.release(tierId, quantity, tx);
      }

      return expired.length;
    });

    return expiredCount;
  }

  async purchase(input: PurchaseInput): Promise<PurchaseResult> {
    const existing = await this.orders.findByIdempotencyKey(input.idempotencyKey);

    if (existing) {
      return this.loadOrder(existing, false);
    }

    try {
      const result = await transaction('purchase_order', async (tx) => {
        const hold = await this.holds.lockById(input.holdId, tx);

        if (!hold) {
          throw HttpError.notFound('hold_not_found', `Hold ${input.holdId} was not found`);
        }

        if (hold.status !== 'active') {
          throw HttpError.conflict('hold_not_active', `Hold ${hold.id} is ${hold.status}`);
        }

        if (hold.expiresAt.getTime() <= Date.now()) {
          throw HttpError.conflict('hold_expired', `Hold ${hold.id} has expired`);
        }

        const sold = await this.tiers.sellFromHold(hold.tierId, hold.quantity, tx);

        if (!sold) {
          throw HttpError.conflict(
            'hold_inventory_mismatch',
            'Reserved inventory no longer matches the hold',
          );
        }

        const totalCents = hold.unitPriceCents * hold.quantity;

        const order = await this.orders.insertOne(
          {
            customerRef: hold.customerRef,
            customerEmail: input.customerEmail,
            holdId: hold.id,
            status: 'paid',
            totalCents,
            idempotencyKey: input.idempotencyKey,
          },
          tx,
        );

        const ticketRows = Array.from({ length: hold.quantity }, () => ({
          orderId: order.id,
          eventId: hold.eventId,
          tierId: hold.tierId,
          customerRef: hold.customerRef,
          unitPriceCents: hold.unitPriceCents,
          status: 'issued',
        }));

        const issued = await this.tickets.insertMany(ticketRows, tx);

        await this.payments.insertOne(
          {
            orderId: order.id,
            amountCents: totalCents,
            providerRef: `sim_${order.id}`,
            status: 'captured',
          },
          tx,
        );

        await this.holds.updateStatus([hold.id], 'converted', tx);

        const remaining = await this.tiers.remainingInventory(hold.eventId, tx);

        if (remaining === 0) {
          const event = await this.events.findById(hold.eventId, tx);

          if (event?.status === 'on_sale') {
            await this.events.updateById(hold.eventId, { status: 'sold_out' }, tx);
          }
        }

        return { order, tickets: issued, created: true };
      });

      void this.publishPurchaseEvent(result);

      return result;
    } catch (error) {
      const concurrent = await this.orders.findByIdempotencyKey(input.idempotencyKey);

      if (concurrent) {
        return this.loadOrder(concurrent, false);
      }

      throw error;
    }
  }

  async getOrder(orderId: string): Promise<PurchaseResult> {
    const order = await this.orders.findById(orderId);

    if (!order) {
      throw HttpError.notFound('order_not_found', `Order ${orderId} was not found`);
    }

    return this.loadOrder(order, false);
  }

  async refundOrder(orderId: string, input: RefundOrderInput): Promise<RefundResult> {
    const result = await transaction('refund_order', async (tx) => {
      const order = await this.orders.lockById(orderId, tx);

      if (!order) {
        throw HttpError.notFound('order_not_found', `Order ${orderId} was not found`);
      }

      if (order.status !== 'paid') {
        throw HttpError.conflict(
          'order_not_refundable',
          `Order ${orderId} is ${order.status} and cannot be refunded`,
        );
      }

      const issued = await this.tickets.findByOrderId(orderId, tx);

      if (issued.length === 0) {
        throw HttpError.conflict('order_has_no_tickets', `Order ${orderId} has no tickets`);
      }

      const perTier = new Map<string, number>();

      for (const ticket of issued) {
        perTier.set(ticket.tierId, (perTier.get(ticket.tierId) ?? 0) + 1);
      }

      for (const [tierId, quantity] of [...perTier.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      )) {
        const restored = await this.tiers.restoreSold(tierId, quantity, tx);

        if (!restored) {
          throw HttpError.conflict(
            'refund_inventory_mismatch',
            `Tier ${tierId} does not have ${quantity} sold seats to restore`,
          );
        }
      }

      await this.tickets.updateStatusByOrderId(orderId, 'refunded', tx);
      await this.payments.updateStatusByOrderId(orderId, 'refunded', tx);

      const refund = await this.refunds.insertOne(
        {
          orderId,
          amountCents: order.totalCents,
          reason: input.reason ?? null,
          status: 'completed',
        },
        tx,
      );

      const updated = await this.orders.updateStatus(orderId, 'refunded', tx);

      if (!updated) {
        throw HttpError.notFound('order_not_found', `Order ${orderId} was not found`);
      }

      const eventId = issued[0]?.eventId;

      if (eventId) {
        const event = await this.events.findById(eventId, tx);

        if (event?.status === 'sold_out') {
          const remaining = await this.tiers.remainingInventory(eventId, tx);

          if (remaining > 0) {
            await this.events.updateById(eventId, { status: 'on_sale' }, tx);
          }
        }
      }

      const refundedTickets = await this.tickets.findByOrderId(orderId, tx);

      return { order: updated, refund, tickets: refundedTickets };
    });

    return result;
  }

  async listOrderPerformers(customerRef: string): Promise<PerformerOption[]> {
    return this.orders.findPerformerOptions(customerRef);
  }

  async listOrders(
    customerRef: string,
    limit: number,
    offset: number,
    filters: OrderFilters = {},
  ): Promise<CustomerOrderPage> {
    const [orders, total] = await Promise.all([
      this.orders.findByCustomerRef(customerRef, limit, offset, filters),
      this.orders.countByCustomerRef(customerRef, filters),
    ]);

    if (orders.length === 0) {
      return { items: [], total, limit, offset };
    }

    const tickets = await this.tickets.findByOrderIds(orders.map((order) => order.id));
    const eventIds = [...new Set(tickets.map((ticket) => ticket.eventId))];
    const tierIds = [...new Set(tickets.map((ticket) => ticket.tierId))];
    const [events, tiers] = await Promise.all([
      this.events.findByIds(eventIds),
      this.tiers.findByIds(tierIds),
    ]);
    const eventsById = new Map(events.map((event) => [event.id, event]));
    const tierNames = Object.fromEntries(tiers.map((tier) => [tier.id, tier.name]));

    const items = orders.map((order) => {
      const orderTickets = tickets.filter((ticket) => ticket.orderId === order.id);
      const event = orderTickets[0] ? eventsById.get(orderTickets[0].eventId) : undefined;

      return {
        order,
        tickets: orderTickets,
        event: event ? toCustomerEvent(event) : null,
        tierNames,
      };
    });

    return { items, total, limit, offset };
  }

  private async loadOrder(order: OrderRow, created: boolean): Promise<PurchaseResult> {
    const tickets = await this.tickets.findByOrderId(order.id);
    return { order, tickets, created };
  }

  private async publishPurchaseEvent(result: PurchaseResult): Promise<void> {
    const ticket = result.tickets[0];

    if (!ticket) {
      return;
    }

    try {
      const [events, tiers] = await Promise.all([
        this.events.findByIds([ticket.eventId]),
        this.tiers.findByIds([...new Set(result.tickets.map((row) => row.tierId))]),
      ]);
      const event = events[0];

      if (!event) {
        logger.warn(
          { order_id: result.order.id, event_id: ticket.eventId },
          'purchase event skipped: event not found',
        );
        return;
      }

      const tierNames = new Map(tiers.map((tier) => [tier.id, tier.name]));
      const payload: PurchaseCompletedEvent = {
        id: randomUUID(),
        type: 'purchase.completed',
        occurredAt: new Date().toISOString(),
        orderId: result.order.id,
        customerEmail: result.order.customerEmail,
        totalCents: result.order.totalCents,
        currency: 'USD',
        event: {
          id: event.id,
          title: event.title,
          performerName: event.performerName,
          venueName: event.venueName,
          startsAt: event.startsAt.toISOString(),
        },
        tickets: result.tickets.map((row) => ({
          id: row.id,
          code: row.qrToken,
          tierName: tierNames.get(row.tierId) ?? 'Standard',
        })),
      };

      await this.publisher.publish(payload);
    } catch (error) {
      logger.error(
        { err: error, order_id: result.order.id },
        'failed to build purchase event',
      );
    }
  }
}
