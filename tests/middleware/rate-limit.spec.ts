import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { rateLimit } from '../../src/middleware/rate-limit';
import { redis } from '../../src/utils/redis';
import { logger } from '../../src/shared/logger';

vi.mock('../../src/utils/redis', () => ({
  redis: {
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
  },
}));

vi.mock('../../src/shared/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('Rate Limit Middleware', () => {
  let req: any;
  let res: any;
  let next: any;
  let headers: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    headers = {};
    req = {
      path: '/test-route',
      ip: '192.168.1.1',
      user: null,
    };
    res = {
      setHeader: vi.fn().mockImplementation((name, val) => {
        headers[name] = val;
      }),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Redis Flow', () => {
    it('should allow request when under the limit on Redis', async () => {
      vi.mocked(redis.incr).mockResolvedValue(1);
      vi.mocked(redis.expire).mockResolvedValue(1);
      vi.mocked(redis.ttl).mockResolvedValue(60);

      const limitMiddleware = rateLimit({ windowSeconds: 60, max: 5, keyPrefix: 'rl-test' });
      await limitMiddleware(req, res, next);

      expect(redis.incr).toHaveBeenCalledWith('rl-test:192.168.1.1:/test-route');
      expect(redis.expire).toHaveBeenCalledWith('rl-test:192.168.1.1:/test-route', 60);
      expect(headers['x-ratelimit-limit']).toBe('5');
      expect(headers['x-ratelimit-remaining']).toBe('4');
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it('should use req.user.id as identity if authenticated', async () => {
      req.user = { id: 'u123' };
      vi.mocked(redis.incr).mockResolvedValue(1);
      vi.mocked(redis.expire).mockResolvedValue(1);
      vi.mocked(redis.ttl).mockResolvedValue(60);

      const limitMiddleware = rateLimit({ windowSeconds: 60, max: 5, keyPrefix: 'rl-test' });
      await limitMiddleware(req, res, next);

      expect(redis.incr).toHaveBeenCalledWith('rl-test:u123:/test-route');
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should block request and return 429 when limit is exceeded', async () => {
      vi.mocked(redis.incr).mockResolvedValue(6); // max is 5
      vi.mocked(redis.ttl).mockResolvedValue(45);

      const limitMiddleware = rateLimit({ windowSeconds: 60, max: 5, keyPrefix: 'rl-test' });
      await limitMiddleware(req, res, next);

      expect(redis.expire).not.toHaveBeenCalled(); // only called when count === 1
      expect(headers['x-ratelimit-limit']).toBe('5');
      expect(headers['x-ratelimit-remaining']).toBe('0');
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'RATE_LIMITED',
        message: 'Too many requests, please retry later',
      });
      expect(logger.warn).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('In-Memory Fallback Flow', () => {
    it('should fallback to memory when Redis throws', async () => {
      vi.mocked(redis.incr).mockRejectedValue(new Error('Redis is down'));

      const limitMiddleware = rateLimit({ windowSeconds: 60, max: 2, keyPrefix: 'rl-fallback' });

      // Hit 1: Allowed
      await limitMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(headers['x-ratelimit-remaining']).toBe('1');

      // Hit 2: Allowed
      next.mockClear();
      await limitMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(headers['x-ratelimit-remaining']).toBe('0');

      // Hit 3: Rate Limited
      next.mockClear();
      await limitMiddleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should reset window after window duration expires', async () => {
      vi.mocked(redis.incr).mockRejectedValue(new Error('Redis is down'));

      const limitMiddleware = rateLimit({ windowSeconds: 10, max: 1, keyPrefix: 'rl-expire' });

      // Hit 1: Allowed
      await limitMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Hit 2: Blocked immediately
      next.mockClear();
      await limitMiddleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);

      // Advance time by 11 seconds
      vi.advanceTimersByTime(11000);
      res.status.mockClear();

      // Hit 3: Allowed again
      await limitMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
