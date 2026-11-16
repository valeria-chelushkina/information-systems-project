import { call, callPage, type Page } from '@/services/web/clients/http.client.js';
import { webConfig } from '@/services/web/config.js';
import type {
  NotificationDeliveryDto,
  NotificationSummaryDto,
} from '@/services/web/typedefs/api.typedefs.js';

export class NotifyClient {
  listDeliveries(limit: number, offset: number): Promise<Page<NotificationDeliveryDto>> {
    return callPage<NotificationDeliveryDto>(webConfig.notifyBaseUrl, '/notifications', {
      query: { limit, offset },
    });
  }

  summary(): Promise<NotificationSummaryDto> {
    return call<NotificationSummaryDto>(webConfig.notifyBaseUrl, '/notifications/summary');
  }
}
