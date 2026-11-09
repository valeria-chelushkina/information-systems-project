import type { Channel, ConfirmChannel } from 'amqplib';

export const PURCHASE_EXCHANGE = 'concert-ops';
export const PURCHASE_QUEUE = 'notifications';
export const PURCHASE_ROUTING_KEY = 'purchase.completed';
export const PURCHASE_EVENT = 'purchase.completed';

export async function assertPurchaseTopology(channel: Channel | ConfirmChannel): Promise<void> {
  await channel.assertExchange(PURCHASE_EXCHANGE, 'direct', { durable: true });
  await channel.assertQueue(PURCHASE_QUEUE, { durable: true });
  await channel.bindQueue(PURCHASE_QUEUE, PURCHASE_EXCHANGE, PURCHASE_ROUTING_KEY);
}
