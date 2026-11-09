import { randomUUID } from 'node:crypto';
import type { ConfirmChannel } from 'amqplib';
import {
  assertPurchaseTopology,
  PURCHASE_EVENT,
  PURCHASE_EXCHANGE,
  PURCHASE_ROUTING_KEY,
} from '@/shared/messaging/purchase-topology.js';
import { getConnection } from '@/shared/messaging/connection.js';
import type { PurchaseCompletedEvent } from '@/shared/messaging/purchase-event.typedefs.js';
import {
  messagesPublishedTotal,
  publishFailuresTotal,
} from '@/shared/observability/messaging-metrics.js';
import { logger } from '@/shared/observability/logger.js';
import type { PurchaseResult } from '@/services/ticketing/typedefs/purchase.typedefs.js';

export class PurchasePublisher {
  protected channelPromise: Promise<ConfirmChannel> | null = null;

  async publish(result: PurchaseResult): Promise<void> {
    const ticket = result.tickets[0];

    if (!ticket) {
      return;
    }

    const event: PurchaseCompletedEvent = {
      id: randomUUID(),
      type: PURCHASE_EVENT,
      occurredAt: new Date().toISOString(),
      orderId: result.order.id,
      showId: ticket.eventId,
      tierId: ticket.tierId,
      quantity: result.tickets.length,
      amountCents: result.order.totalCents,
      currency: 'USD',
      customerEmail: result.order.customerEmail,
      ticketIds: result.tickets.map((row) => row.id),
    };

    try {
      const channel = await this.getChannel();

      await new Promise<void>((resolve, reject) => {
        channel.publish(
          PURCHASE_EXCHANGE,
          PURCHASE_ROUTING_KEY,
          Buffer.from(JSON.stringify(event)),
          {
            persistent: true,
            contentType: 'application/json',
            messageId: event.id,
          },
          (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          },
        );
      });

      messagesPublishedTotal.inc({ event: event.type });
    } catch (error) {
      publishFailuresTotal.inc({ event: event.type });
      logger.error({ err: error, order_id: event.orderId }, 'failed to publish purchase event');
    }
  }

  protected getChannel(): Promise<ConfirmChannel> {
    if (!this.channelPromise) {
      this.channelPromise = this.connect();
    }

    return this.channelPromise;
  }

  protected async connect(): Promise<ConfirmChannel> {
    try {
      const connection = await getConnection();
      const channel = await connection.createConfirmChannel();

      channel.on('close', () => {
        this.channelPromise = null;
      });
      channel.on('error', (error) => {
        logger.error({ err: error }, 'rabbitmq publisher channel error');
      });

      await assertPurchaseTopology(channel);

      return channel;
    } catch (error) {
      this.channelPromise = null;
      throw error;
    }
  }
}
