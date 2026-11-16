import { setTimeout as delay } from 'node:timers/promises';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { getConnection } from '@/shared/messaging/connection.js';
import {
  assertPurchaseTopology,
  PURCHASE_ATTEMPTS_HEADER,
  PURCHASE_DLQ_ROUTING_KEY,
  PURCHASE_DLX,
  PURCHASE_EVENT,
  PURCHASE_QUEUE,
  PURCHASE_RETRY_QUEUE,
} from '@/shared/messaging/purchase-topology.js';
import { messagesConsumedTotal } from '@/shared/observability/messaging-metrics.js';
import { logger } from '@/shared/observability/logger.js';
import { NotificationsService } from '@/services/notify/modules/notifications/notifications.service.js';
import { purchaseCompletedSchema } from '@/services/notify/modules/notifications/notifications.schemas.js';
import { attemptsFromHeader } from '@/services/notify/modules/notifications/notifications.delivery.js';
import { notificationDeliveriesTotal } from '@/services/notify/observability/notification-metrics.js';

const RECONNECT_DELAY_MS = 5000;

export class NotificationsConsumer {
  protected readonly service = new NotificationsService();
  protected channel: ConfirmChannel | null = null;
  protected consumerTag: string | null = null;
  protected stopped = false;
  protected reconnectTimer: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.connect();
        return;
      } catch (error) {
        logger.warn({ err: error }, 'rabbitmq consumer unavailable; retrying in 5s');
        await delay(RECONNECT_DELAY_MS);
      }
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

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

  protected async connect(): Promise<void> {
    const connection = await getConnection();
    const channel = await connection.createConfirmChannel();

    this.channel = channel;

    channel.on('close', () => {
      this.channel = null;
      this.scheduleReconnect();
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

  protected scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.start();
    }, RECONNECT_DELAY_MS);
    this.reconnectTimer.unref();
  }

  protected async handle(message: ConsumeMessage): Promise<void> {
    const channel = this.channel;

    if (!channel) {
      return;
    }

    let event;

    try {
      event = purchaseCompletedSchema.parse(JSON.parse(message.content.toString()));
    } catch (error) {
      logger.error(
        { err: error, message_id: message.properties.messageId },
        'invalid purchase event moved to dead-letter queue',
      );
      notificationDeliveriesTotal.inc({ status: 'invalid' });
      messagesConsumedTotal.inc({ event: PURCHASE_EVENT, status: 'invalid' });
      channel.nack(message, false, false);
      return;
    }

    try {
      const outcome = await this.service.handle(event);

      if (outcome.status === 'delivered' || outcome.status === 'skipped') {
        channel.ack(message);
        messagesConsumedTotal.inc({ event: PURCHASE_EVENT, status: 'ok' });
        return;
      }

      if (outcome.status === 'retry') {
        await this.requeueWithDelay(channel, message, outcome.attempts + 1, outcome.error);
        channel.ack(message);
        messagesConsumedTotal.inc({ event: PURCHASE_EVENT, status: 'retried' });
        logger.warn(
          { event_id: event.id, order_id: event.orderId, attempts: outcome.attempts },
          'purchase event scheduled for retry',
        );
        return;
      }

      await this.moveToDeadLetter(channel, message, outcome.error);
      channel.ack(message);
      messagesConsumedTotal.inc({ event: PURCHASE_EVENT, status: 'dead' });
      logger.error(
        { event_id: event.id, order_id: event.orderId, attempts: outcome.attempts },
        'purchase event moved to dead-letter queue',
      );
    } catch (error) {
      logger.error({ err: error }, 'failed to process purchase event');
      messagesConsumedTotal.inc({ event: PURCHASE_EVENT, status: 'failed' });
      channel.nack(message, false, true);
    }
  }

  protected async requeueWithDelay(
    channel: ConfirmChannel,
    message: ConsumeMessage,
    attempts: number,
    error?: string,
  ): Promise<void> {
    channel.sendToQueue(PURCHASE_RETRY_QUEUE, message.content, {
      persistent: true,
      contentType: 'application/json',
      messageId: message.properties.messageId,
      headers: this.retryHeaders(message, attempts, error),
    });
    await channel.waitForConfirms();
  }

  protected async moveToDeadLetter(
    channel: ConfirmChannel,
    message: ConsumeMessage,
    error?: string,
  ): Promise<void> {
    channel.publish(PURCHASE_DLX, PURCHASE_DLQ_ROUTING_KEY, message.content, {
      persistent: true,
      contentType: 'application/json',
      messageId: message.properties.messageId,
      headers: this.retryHeaders(
        message,
        attemptsFromHeader(message.properties.headers?.[PURCHASE_ATTEMPTS_HEADER]),
        error,
      ),
    });
    await channel.waitForConfirms();
  }

  protected retryHeaders(
    message: ConsumeMessage,
    attempts: number,
    error?: string,
  ): Record<string, string | number> {
    const headers: Record<string, string | number> = {};

    for (const [key, value] of Object.entries(message.properties.headers ?? {})) {
      if (typeof value === 'string' || typeof value === 'number') {
        headers[key] = value;
      }
    }

    headers[PURCHASE_ATTEMPTS_HEADER] = attempts;

    if (error) {
      headers['x-last-error'] = error.slice(0, 200);
    }

    return headers;
  }
}
