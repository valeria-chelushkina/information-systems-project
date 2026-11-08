import { createApp } from '@/app.js';
import { config } from '@/config/index.js';
import { pool } from '@/db/client.js';
import { PurchasesSweeper } from '@/modules/purchases/purchases.sweeper.js';
import { logger } from '@/observability/logger.js';

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
sweeper.start(config.holdSweepIntervalMs);

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');

  sweeper.stop();

  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
