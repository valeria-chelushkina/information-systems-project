import { createApp } from '@/services/web/app.js';
import { webConfig } from '@/services/web/config.js';
import { shutdownTracing } from '@/shared/observability/tracing.js';
import { logger } from '@/shared/observability/logger.js';

const app = createApp();

const server = app.listen(webConfig.port, () => {
  logger.info({ port: webConfig.port }, 'web service listening');
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.error({ port: webConfig.port }, 'port already in use');
  } else {
    logger.error({ err: error }, 'server error');
  }
  process.exit(1);
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');

  server.close(() => {
    void shutdownTracing().finally(() => process.exit(0));
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
