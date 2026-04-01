import { beforeAll, afterAll } from 'vitest';
import { prisma } from '../database/client';
import { redis } from '../utils/redis';

beforeAll(async () => {
  // Setup logic before tests run
});

afterAll(async () => {
  await prisma.$disconnect();
  try {
    await redis.quit();
  } catch (err) {}
});
