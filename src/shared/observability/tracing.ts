import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import type { IncomingMessage } from 'node:http';
import { optionalEnv } from '@/shared/config/env.js';
import { config } from '@/shared/config/index.js';
import { logger } from '@/shared/observability/logger.js';

const endpoint = optionalEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://127.0.0.1:4318');

const sdk = new NodeSDK({
  resource: resourceFromAttributes({ 'service.name': config.serviceName }),
  traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (request: IncomingMessage) =>
          request.url === '/metrics' || request.url === '/health',
      },
    }),
  ],
});

sdk.start();

logger.info({ endpoint }, 'tracing started');

export function shutdownTracing(): Promise<void> {
  return sdk.shutdown();
}
