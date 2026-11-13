import { ticketingConfig } from '@/services/ticketing/config.js';
import {
  holdRejectionsTotal,
  holdsCreatedTotal,
  holdsExpiredTotal,
  purchasesTotal,
  refundedCentsTotal,
  refundsTotal,
  revenueCentsTotal,
  ticketsSoldTotal,
} from '@/services/ticketing/observability/business-metrics.constants.js';
import { transaction } from '@/shared/db/transaction.js';
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
import type { OrderRow } from '@/services/ticketing/typedefs/order.typedefs.js';
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
        holdRejectionsTotal.inc({ reason: 'event_not_on_sale' });
        throw HttpError.conflict('event_not_on_sale', `Event ${event.id} is not on sale`);
      }

      const reserved = await this.tiers.reserve(tier.id, input.quantity, tx);

      if (!reserved) {
        holdRejectionsTotal.inc({ reason: 'insufficient_inventory' });
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

    holdsCreatedTotal.inc();

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

    if (expiredCount > 0) {
      holdsExpiredTotal.inc(expiredCount);
    }

    return expiredCount;
  }

  async purchase(input: PurchaseInput): Promise<PurchaseResult> {
    const existing = await this.orders.findByIdempotencyKey(input.idempotencyKey);

    if (existing) {
      purchasesTotal.inc({ status: 'replay' });
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

      purchasesTotal.inc({ status: 'ok' });
      ticketsSoldTotal.inc(result.tickets.length);
      revenueCentsTotal.inc(result.order.totalCents);

      void this.publisher.publish(result);

      return result;
    } catch (error) {
      const concurrent = await this.orders.findByIdempotencyKey(input.idempotencyKey);

      if (concurrent) {
        purchasesTotal.inc({ status: 'replay' });
        return this.loadOrder(concurrent, false);
      }

      purchasesTotal.inc({ status: 'failed' });
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

    refundsTotal.inc();
    refundedCentsTotal.inc(result.refund.amountCents);

    return result;
  }

  async listOrders(
    customerRef: string,
    limit: number,
    offset: number,
  ): Promise<CustomerOrderPage> {
    const [orders, total] = await Promise.all([
      this.orders.findByCustomerRef(customerRef, limit, offset),
      this.orders.countByCustomerRef(customerRef),
    ]);

    if (orders.length === 0) {
      return { items: [], total, limit, offset };
    }

    const tickets = await this.tickets.findByOrderIds(orders.map((order) => order.id));
    const eventIds = [...new Set(tickets.map((ticket) => ticket.eventId))];
    const events = await this.events.findByIds(eventIds);
    const eventsById = new Map(events.map((event) => [event.id, event]));

    const items = orders.map((order) => {
      const orderTickets = tickets.filter((ticket) => ticket.orderId === order.id);
      const event = orderTickets[0] ? eventsById.get(orderTickets[0].eventId) : undefined;

      return {
        order,
        tickets: orderTickets,
        event: event ? toCustomerEvent(event) : null,
      };
    });

    return { items, total, limit, offset };
  }

  private async loadOrder(order: OrderRow, created: boolean): Promise<PurchaseResult> {
    const tickets = await this.tickets.findByOrderId(order.id);
    return { order, tickets, created };
  }
}
