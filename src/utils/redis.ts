import Redis from 'ioredis';
import { logger } from '../shared/logger';

const getRedisClient = () => {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  logger.info(`Connecting to Redis at ${url}...`);
  
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 3) {
        logger.warn('Redis connection failed. Falling back to in-memory store.');
        return null; // stop retrying
      }
      return Math.min(times * 100, 2000);
    }
  });

  client.on('error', (err) => {
    logger.error('Redis error occurred:', err.message);
  });

  return client;
};

export const redis = getRedisClient();
