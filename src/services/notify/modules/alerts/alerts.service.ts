import { logger } from '@/shared/observability/logger.js';
import { AlertMailer } from '@/services/notify/modules/alerts/alerts.email.js';
import type { Alert } from '@/services/notify/modules/alerts/alerts.typedefs.js';
import { notifyConfig } from '@/services/notify/config.js';

export class AlertsService {
  protected readonly logger = logger;
  protected readonly mailer = new AlertMailer();
  protected cooldownUntil = 0;

  async handle(alerts: Alert[]): Promise<void> {
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

    if (!this.mailer.enabled) {
      return;
    }

    const remaining = this.cooldownUntil - Date.now();

    if (remaining > 0) {
      this.logger.warn(
        { count: alerts.length, retryInSeconds: Math.ceil(remaining / 1000) },
        'alert email skipped',
      );
      return;
    }

    try {
      const result = await this.mailer.send(alerts);
      this.cooldownUntil = 0;
      this.logger.info(
        {
          count: alerts.length,
          messageId: result.messageId,
          accepted: result.accepted,
          rejected: result.rejected,
          response: result.response,
        },
        'alert email sent',
      );
    } catch (error) {
      this.cooldownUntil = Date.now() + notifyConfig.emailRetryMinutes * 60_000;
      this.logger.error(
        {
          err: error,
          count: alerts.length,
          retryInMinutes: notifyConfig.emailRetryMinutes,
        },
        'alert email failed',
      );
    }
  }
}
