import type { Channel, ConfirmChannel } from 'amqplib';
import { optionalEnv } from '@/shared/config/env.js';

export const PURCHASE_EXCHANGE = 'concert-ops';
export const PURCHASE_QUEUE = 'notifications';
export const PURCHASE_ROUTING_KEY = 'purchase.completed';
export const PURCHASE_EVENT = 'purchase.completed';
export const PURCHASE_DLX = 'concert-ops.dlx';
export const PURCHASE_DLQ = 'notifications.dlq';
export const PURCHASE_DLQ_ROUTING_KEY = 'notifications.failed';
export const PURCHASE_RETRY_QUEUE = 'notifications.retry';
export const PURCHASE_RETRY_ROUTING_KEY = 'notifications.retry';
export const PURCHASE_ATTEMPTS_HEADER = 'x-attempts';
export const PURCHASE_MAX_ATTEMPTS = Number(optionalEnv('PURCHASE_MAX_ATTEMPTS', '4'));
export const PURCHASE_RETRY_DELAY_MS = Number(optionalEnv('PURCHASE_RETRY_DELAY_MS', '30000'));

export async function assertPurchaseTopology(channel: Channel | ConfirmChannel): Promise<void> {
  await channel.assertExchange(PURCHASE_EXCHANGE, 'direct', { durable: true });
  await channel.assertExchange(PURCHASE_DLX, 'direct', { durable: true });
  await channel.assertQueue(PURCHASE_QUEUE, {
    durable: true,
    deadLetterExchange: PURCHASE_DLX,
    deadLetterRoutingKey: PURCHASE_DLQ_ROUTING_KEY,
  });
  await channel.assertQueue(PURCHASE_RETRY_QUEUE, {
    durable: true,
    messageTtl: PURCHASE_RETRY_DELAY_MS,
    deadLetterExchange: PURCHASE_EXCHANGE,
    deadLetterRoutingKey: PURCHASE_ROUTING_KEY,
  });
  await channel.assertQueue(PURCHASE_DLQ, { durable: true });
  await channel.bindQueue(PURCHASE_QUEUE, PURCHASE_EXCHANGE, PURCHASE_ROUTING_KEY);
  await channel.bindQueue(PURCHASE_RETRY_QUEUE, PURCHASE_DLX, PURCHASE_RETRY_ROUTING_KEY);
  await channel.bindQueue(PURCHASE_DLQ, PURCHASE_DLX, PURCHASE_DLQ_ROUTING_KEY);
}
