import { setTimeout as delay } from 'node:timers/promises';
import type { Channel, ConsumeMessage } from 'amqplib';
import { getConnection } from '@/shared/messaging/connection.js';
import {
  assertPurchaseTopology,
  PURCHASE_EVENT,
  PURCHASE_QUEUE,
} from '@/shared/messaging/purchase-topology.js';
import { messagesConsumedTotal } from '@/shared/observability/messaging-metrics.js';
import { logger } from '@/shared/observability/logger.js';
import { NotificationsService } from '@/services/notify/modules/notifications/notifications.service.js';
import { purchaseCompletedSchema } from '@/services/notify/modules/notifications/notifications.schemas.js';

export class NotificationsConsumer {
  protected readonly service = new NotificationsService();
  protected channel: Channel | null = null;
  protected consumerTag: string | null = null;
  protected stopped = false;

  async start(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.connect();
        return;
      } catch (error) {
        logger.warn({ err: error }, 'rabbitmq consumer unavailable; retrying in 5s');
        await delay(5000);
      }
    }
  }

  protected async connect(): Promise<void> {
    const connection = await getConnection();
    const channel = await connection.createChannel();

    this.channel = channel;

    channel.on('close', () => {
      this.channel = null;
    });
    channel.on('error', (error) => {
      logger.error({ err: error }, 'rabbitmq consumer channel error');
    });

    await assertPurchaseTopology(channel);
    await channel.prefetch(10);

    const reply = await channel.consume(
      PURCHASE_QUEUE,
      (message) => {
        if (message) {
          void this.handle(message);
        }
      },
      { noAck: false },
    );

    this.consumerTag = reply.consumerTag;

    logger.info({ queue: PURCHASE_QUEUE }, 'purchase consumer started');
  }

  protected async handle(message: ConsumeMessage): Promise<void> {
    const channel = this.channel;

    if (!channel) {
      return;
    }

    try {
      const payload = JSON.parse(message.content.toString());
      const event = purchaseCompletedSchema.parse(payload);

      this.service.handle(event);
      channel.ack(message);
      messagesConsumedTotal.inc({ event: PURCHASE_EVENT, status: 'ok' });
    } catch (error) {
      try {
        channel.nack(message, false, false);
      } catch {
        logger.error({ err: error }, 'failed to reject purchase event');
      }

      messagesConsumedTotal.inc({ event: PURCHASE_EVENT, status: 'failed' });
      logger.error({ err: error }, 'failed to process purchase event');
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;

    if (this.channel && this.consumerTag) {
      try {
        await this.channel.cancel(this.consumerTag);
      } catch {
        this.consumerTag = null;
      }
    }

    if (this.channel) {
      try {
        await this.channel.close();
      } catch {
        this.channel = null;
      }
    }

    this.channel = null;
    this.consumerTag = null;
  }
}
