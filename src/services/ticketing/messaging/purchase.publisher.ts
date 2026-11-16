import type { ConfirmChannel } from 'amqplib';
import {
  assertPurchaseTopology,
  PURCHASE_ATTEMPTS_HEADER,
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

export class PurchasePublisher {
  protected channelPromise: Promise<ConfirmChannel> | null = null;

  async publish(event: PurchaseCompletedEvent): Promise<void> {
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
            headers: { [PURCHASE_ATTEMPTS_HEADER]: 1 },
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
