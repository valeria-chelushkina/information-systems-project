import { logger } from '@/shared/observability/logger.js';
import type { PurchaseCompletedEvent } from '@/shared/messaging/purchase-event.typedefs.js';

export class NotificationsService {
  protected readonly logger = logger;

  handle(event: PurchaseCompletedEvent): void {
    this.logger.info(
      {
        message_id: event.id,
        event: event.type,
        order_id: event.orderId,
        show_id: event.showId,
        customer_email: event.customerEmail,
        amount_cents: event.amountCents,
        currency: event.currency,
        ticket_count: event.ticketIds.length,
      },
      'purchase notification received',
    );
  }
}
