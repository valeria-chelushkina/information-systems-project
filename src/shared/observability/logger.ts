import pino from 'pino';
import { config } from '@/shared/config/index.js';

export const logger = pino({
  level: config.logLevel,
  base: { service: config.serviceName },
  timestamp: pino.stdTimeFunctions.isoTime,
});
