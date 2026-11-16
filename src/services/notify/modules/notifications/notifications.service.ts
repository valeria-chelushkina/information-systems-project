import { notifyDb } from '@/services/notify/db/client.js';
import { logger } from '@/shared/observability/logger.js';
import type { PurchaseCompletedEvent } from '@/shared/messaging/purchase-event.typedefs.js';
import { PURCHASE_MAX_ATTEMPTS } from '@/shared/messaging/purchase-topology.js';
import { TicketMailer } from '@/services/notify/modules/notifications/notifications.email.js';
import {
  errorMessage,
  nextStep,
  type DeliveryStep,
} from '@/services/notify/modules/notifications/notifications.delivery.js';
import {
  DeliveriesRepository,
  type DeliveryRow,
  type DeliveryStatus,
} from '@/services/notify/modules/notifications/deliveries.repository.js';
import {
  notificationDeliveriesTotal,
  notificationDeliveryDuration,
} from '@/services/notify/observability/notification-metrics.js';

export type NotificationStatus = 'delivered' | 'skipped' | DeliveryStep;

export interface NotificationOutcome {
  status: NotificationStatus;
  attempts: number;
  messageId?: string;
  error?: string;
}

export interface NotificationPage {
  items: DeliveryRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface DeliverySummary {
  total: number;
  byStatus: Record<DeliveryStatus, number>;
}

export class NotificationsService {
  protected readonly logger = logger;
  protected readonly mailer = new TicketMailer();
  protected readonly deliveries = new DeliveriesRepository(notifyDb);

  async handle(event: PurchaseCompletedEvent): Promise<NotificationOutcome> {
    const claim = this.deliveries.claim(event.id, event.orderId, event.customerEmail);

    if (!claim.claimed) {
      notificationDeliveriesTotal.inc({ status: 'skipped' });
      this.logger.info(
        { event_id: event.id, order_id: event.orderId },
        'ticket email skipped duplicate',
      );
      return { status: 'skipped', attempts: claim.attempts };
    }

    if (!this.mailer.enabled) {
      this.deliveries.markSkipped(event.id, 'ticket email transport is not configured');
      notificationDeliveriesTotal.inc({ status: 'skipped' });
      this.logger.warn(
        { event_id: event.id, order_id: event.orderId },
        'ticket email skipped: transport disabled',
      );
      return { status: 'skipped', attempts: claim.attempts };
    }

    const end = notificationDeliveryDuration.startTimer();

    try {
      const result = await this.mailer.send(event);
      end();
      this.deliveries.markDelivered(event.id);
      notificationDeliveriesTotal.inc({ status: 'delivered' });
      this.logger.info(
        {
          event_id: event.id,
          order_id: event.orderId,
          attempts: claim.attempts,
          message_id: result.messageId,
          accepted: result.accepted.length,
          rejected: result.rejected.length,
        },
        'ticket email sent',
      );

      return { status: 'delivered', attempts: claim.attempts, messageId: result.messageId };
    } catch (error) {
      end();
      const message = errorMessage(error);
      const step = nextStep(claim.attempts, PURCHASE_MAX_ATTEMPTS);

      if (step === 'dead') {
        this.deliveries.markDead(event.id, message);
        notificationDeliveriesTotal.inc({ status: 'dead_lettered' });
        this.logger.error(
          { err: error, event_id: event.id, order_id: event.orderId, attempts: claim.attempts },
          'ticket email dead-lettered',
        );
      } else {
        this.deliveries.markRetry(event.id, message);
        notificationDeliveriesTotal.inc({ status: 'retried' });
        this.logger.warn(
          { err: error, event_id: event.id, order_id: event.orderId, attempts: claim.attempts },
          'ticket email scheduled for retry',
        );
      }

      return { status: step, attempts: claim.attempts, error: message };
    }
  }

  list(limit: number, offset: number): NotificationPage {
    return {
      items: this.deliveries.list(limit, offset),
      total: this.deliveries.count(),
      limit,
      offset,
    };
  }

  summary(): DeliverySummary {
    return {
      total: this.deliveries.count(),
      byStatus: this.deliveries.stats(),
    };
  }
}
