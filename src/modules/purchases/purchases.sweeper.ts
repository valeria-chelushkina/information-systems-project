import { PurchasesService } from '@/modules/purchases/purchases.service.js';
import { logger } from '@/observability/logger.js';

export class PurchasesSweeper {
  protected readonly service = new PurchasesService();
  protected timer: NodeJS.Timeout | null = null;

  start(intervalMs: number): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.sweep();
    }, intervalMs);

    this.timer.unref();
    logger.info({ intervalMs }, 'hold expiry sweeper started');
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
    logger.info('hold expiry sweeper stopped');
  }

  private async sweep(): Promise<void> {
    try {
      const expired = await this.service.expireHolds(100);

      if (expired > 0) {
        logger.info({ expired }, 'expired holds released');
      }
    } catch (error) {
      logger.error({ err: error }, 'hold expiry sweep failed');
    }
  }
}
