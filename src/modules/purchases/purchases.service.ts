import { config } from '@/config/index.js';
import { transaction } from '@/db/transaction.js';
import { EventsRepository } from '@/modules/events/events.repository.js';
import { HoldsRepository } from '@/modules/purchases/holds.repository.js';
import { OrdersRepository } from '@/modules/purchases/orders.repository.js';
import type { CreateHoldInput, PurchaseInput } from '@/modules/purchases/purchases.schemas.js';
import { PaymentsRepository } from '@/modules/purchases/payments.repository.js';
import { TicketsRepository } from '@/modules/purchases/tickets.repository.js';
import { TiersRepository } from '@/modules/tiers/tiers.repository.js';
import { HttpError } from '@/shared/errors/http-error.js';
import type { HoldRow } from '@/typedefs/hold.typedefs.js';
import type { OrderRow } from '@/typedefs/order.typedefs.js';
import type { PurchaseResult } from '@/typedefs/purchase.typedefs.js';

const HOLD_TTL_MS = config.holdTtlMs;

export class PurchasesService {
  protected readonly holds = new HoldsRepository();
  protected readonly orders = new OrdersRepository();
  protected readonly tickets = new TicketsRepository();
  protected readonly payments = new PaymentsRepository();
  protected readonly tiers = new TiersRepository();
  protected readonly events = new EventsRepository();

  async createHold(input: CreateHoldInput): Promise<HoldRow> {
    return transaction('create_hold', async (tx) => {
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
    return transaction('expire_holds', async (tx) => {
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
  }

  async purchase(input: PurchaseInput): Promise<PurchaseResult> {
    const existing = await this.orders.findByIdempotencyKey(input.idempotencyKey);

    if (existing) {
      return this.loadOrder(existing, false);
    }

    try {
      return await transaction('purchase_order', async (tx) => {
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

  private async loadOrder(order: OrderRow, created: boolean): Promise<PurchaseResult> {
    const tickets = await this.tickets.findByOrderId(order.id);
    return { order, tickets, created };
  }
}
