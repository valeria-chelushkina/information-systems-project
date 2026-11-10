import { shutdownTracing } from '@/shared/observability/tracing.js';
import { createApp } from '@/services/ticketing/app.js';
import { ticketingConfig } from '@/services/ticketing/config.js';
import { config } from '@/shared/config/index.js';
import { pool } from '@/shared/db/client.js';
import { PurchasesSweeper } from '@/services/ticketing/modules/purchases/purchases.sweeper.js';
import { BusinessStateSweeper } from '@/services/ticketing/observability/business-state.sweeper.js';
import { logger } from '@/shared/observability/logger.js';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'ticketing service listening');
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.error({ port: config.port }, 'port already in use');
  } else {
    logger.error({ err: error }, 'server error');
  }
  process.exit(1);
});

const sweeper = new PurchasesSweeper();
sweeper.start(ticketingConfig.holdSweepIntervalMs);

const businessState = new BusinessStateSweeper();
businessState.start();

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');

  sweeper.stop();
  businessState.stop();

  server.close(() => {
    void shutdownTracing().finally(() => {
      void pool.end().finally(() => process.exit(0));
    });
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
