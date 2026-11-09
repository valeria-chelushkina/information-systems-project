import { connect, type ChannelModel } from 'amqplib';
import { config } from '@/shared/config/index.js';
import { logger } from '@/shared/observability/logger.js';

let connectionPromise: Promise<ChannelModel> | null = null;

export function getConnection(): Promise<ChannelModel> {
  if (connectionPromise) {
    return connectionPromise;
  }

  const pending = connect(config.rabbitmqUrl)
    .then((connection) => {
      connection.on('error', (error) => {
        logger.error({ err: error }, 'rabbitmq connection error');
      });
      connection.on('close', () => {
        connectionPromise = null;
      });
      return connection;
    })
    .catch((error: unknown) => {
      connectionPromise = null;
      throw error;
    });

  connectionPromise = pending;

  return pending;
}

export async function closeConnection(): Promise<void> {
  const pending = connectionPromise;
  connectionPromise = null;

  if (!pending) {
    return;
  }

  try {
    const connection = await pending;
    await connection.close();
  } catch {
    return;
  }
}
