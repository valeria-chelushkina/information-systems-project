import { logger } from '@/shared/observability/logger.js';
import type { Alert } from '@/services/notify/modules/alerts/alerts.typedefs.js';

export class AlertsService {
  protected readonly logger = logger;

  handle(alerts: Alert[]): void {
    for (const alert of alerts) {
      const payload = {
        alert: alert.labels.alertname ?? 'unknown',
        status: alert.status,
        severity: alert.labels.severity ?? 'unknown',
        instance: alert.labels.instance,
        summary: alert.annotations.summary,
        startsAt: alert.startsAt,
      };

      if (alert.status === 'firing') {
        this.logger.warn(payload, 'alert received');
      } else {
        this.logger.info(payload, 'alert resolved');
      }
    }
  }
}
