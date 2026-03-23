import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/logger';

const prismaClientSingleton = () => {
  logger.info('Initializing Prisma Client singleton...');
  return new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'info', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
      { level: 'error', emit: 'stdout' },
    ],
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

// Bind custom logger to query events
(prisma as any).$on('query', (e: any) => {
  if (e.duration > 100) {
    logger.warn(`Slow Query: ${e.query} - Duration: ${e.duration}ms`);
  }
});

logger.info('Database client wrapper optimizations applied successfully.');
