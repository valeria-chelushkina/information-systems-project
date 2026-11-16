import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createSchema } from '@/services/notify/db/schema.js';
import { DeliveriesRepository } from '@/services/notify/modules/notifications/deliveries.repository.js';
import {
  attemptsFromHeader,
  nextStep,
} from '@/services/notify/modules/notifications/notifications.delivery.js';

function repository(): DeliveriesRepository {
  const db = new DatabaseSync(':memory:');

  createSchema(db);

  return new DeliveriesRepository(db);
}

describe('delivery decisions', () => {
  it('reads the attempt header defensively', () => {
    expect(attemptsFromHeader(undefined)).toBe(1);
    expect(attemptsFromHeader('3')).toBe(3);
    expect(attemptsFromHeader(0)).toBe(1);
    expect(attemptsFromHeader('abc')).toBe(1);
  });

  it('retries until the last allowed attempt', () => {
    expect(nextStep(1, 4)).toBe('retry');
    expect(nextStep(3, 4)).toBe('retry');
    expect(nextStep(4, 4)).toBe('dead');
    expect(nextStep(5, 4)).toBe('dead');
  });
});

describe('deliveries repository', () => {
  it('claims an event once and counts attempts', () => {
    const deliveries = repository();

    expect(deliveries.claim('event-1', 'order-1', 'buyer@example.com')).toEqual({
      claimed: true,
      attempts: 1,
    });
    expect(deliveries.claim('event-1', 'order-1', 'buyer@example.com')).toEqual({
      claimed: true,
      attempts: 2,
    });
    expect(deliveries.find('event-1')).toMatchObject({
      status: 'sending',
      attempts: 2,
    });
  });

  it('skips a delivered event on redelivery', () => {
    const deliveries = repository();

    deliveries.claim('event-1', 'order-1', 'buyer@example.com');
    deliveries.markDelivered('event-1');

    expect(deliveries.claim('event-1', 'order-1', 'buyer@example.com')).toEqual({
      claimed: false,
      attempts: 1,
    });
  });

  it('keeps the last failure after a successful retry', () => {
    const deliveries = repository();

    deliveries.claim('event-1', 'order-1', 'buyer@example.com');
    deliveries.markRetry('event-1', 'Connection timeout');
    deliveries.claim('event-1', 'order-1', 'buyer@example.com');
    deliveries.markDelivered('event-1');

    expect(deliveries.find('event-1')).toMatchObject({
      status: 'delivered',
      attempts: 2,
      lastError: 'Connection timeout',
    });
  });

  it('tracks retries and dead letters in the summary', () => {
    const deliveries = repository();

    deliveries.claim('event-1', 'order-1', 'buyer@example.com');
    deliveries.markRetry('event-1', 'smtp timeout');
    deliveries.claim('event-2', 'order-2', 'buyer@example.com');
    deliveries.markDead('event-2', 'smtp refused');

    expect(deliveries.stats()).toMatchObject({ retrying: 1, dead: 1, delivered: 0 });
    expect(deliveries.count()).toBe(2);
    expect(deliveries.list(10, 0)).toHaveLength(2);
  });
});
