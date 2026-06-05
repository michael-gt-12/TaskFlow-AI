import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { redis } from '../utils/redis';
import { logger } from '../shared/logger';

/**
 * A sliding-window rate limiter backed by Redis with an in-memory fallback for
 * local development where Redis may be unavailable. Limits are keyed by the
 * authenticated user when present, otherwise by client IP.
 */

interface RateLimitOptions {
  windowSeconds: number;
  max: number;
  keyPrefix?: string;
}

interface WindowState {
  count: number;
  resetAt: number;
}

const memoryWindows = new Map<string, WindowState>();

function memoryHit(key: string, options: RateLimitOptions): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = memoryWindows.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowSeconds * 1000;
    memoryWindows.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.max - 1, resetAt };
  }
  existing.count += 1;
  return {
    allowed: existing.count <= options.max,
    remaining: Math.max(0, options.max - existing.count),
    resetAt: existing.resetAt,
  };
}

async function redisHit(key: string, options: RateLimitOptions): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, options.windowSeconds);
  }
  const ttl = await redis.ttl(key);
  const resetAt = Date.now() + Math.max(ttl, 0) * 1000;
  return {
    allowed: count <= options.max,
    remaining: Math.max(0, options.max - count),
    resetAt,
  };
}

export function rateLimit(options: RateLimitOptions) {
  const prefix = options.keyPrefix ?? 'rl';
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const identity = req.user?.id ?? req.ip ?? 'anonymous';
    const key = `${prefix}:${identity}:${req.path}`;

    let result;
    try {
      result = await redisHit(key, options);
    } catch (err) {
      result = memoryHit(key, options);
    }

    res.setHeader('x-ratelimit-limit', String(options.max));
    res.setHeader('x-ratelimit-remaining', String(result.remaining));
    res.setHeader('x-ratelimit-reset', String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      logger.warn(`Rate limit exceeded for ${identity} on ${req.path}`);
      res.status(429).json({
        status: 'error',
        code: 'RATE_LIMITED',
        message: 'Too many requests, please retry later',
      });
      return;
    }
    next();
  };
}

/**
 * Convenience presets used by the route definitions.
 */
export const standardRateLimit = rateLimit({ windowSeconds: 60, max: 120 });
export const authRateLimit = rateLimit({ windowSeconds: 60, max: 10, keyPrefix: 'rl:auth' });
export const aiRateLimit = rateLimit({ windowSeconds: 60, max: 20, keyPrefix: 'rl:ai' });
