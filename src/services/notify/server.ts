import { shutdownTracing } from '@/shared/observability/tracing.js';
import { createApp } from '@/services/notify/app.js';
import { config } from '@/shared/config/index.js';
import { logger } from '@/shared/observability/logger.js';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'notify service listening');
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.error({ port: config.port }, 'port already in use');
  } else {
    logger.error({ err: error }, 'server error');
  }
  process.exit(1);
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');

  server.close(() => {
    void shutdownTracing().finally(() => {
      process.exit(0);
    });
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
