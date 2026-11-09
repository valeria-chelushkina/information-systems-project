import { Counter } from 'prom-client';
import { registry } from '@/shared/observability/metrics.js';

export const messagesPublishedTotal = new Counter({
  name: 'rabbitmq_messages_published_total',
  help: 'Messages published to RabbitMQ',
  labelNames: ['event'] as const,
  registers: [registry],
});

export const messagesConsumedTotal = new Counter({
  name: 'rabbitmq_messages_consumed_total',
  help: 'Messages consumed from RabbitMQ by outcome',
  labelNames: ['event', 'status'] as const,
  registers: [registry],
});

export const publishFailuresTotal = new Counter({
  name: 'rabbitmq_publish_failures_total',
  help: 'Failed RabbitMQ publish attempts',
  labelNames: ['event'] as const,
  registers: [registry],
});
