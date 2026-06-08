import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheService } from '../../src/utils/cache';
import { redis } from '../../src/utils/redis';

vi.mock('../../src/utils/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  },
}));

describe('CacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Accessing private static fallbackMap via brackets to reset it
    (CacheService as any).fallbackMap.clear();
  });

  describe('get', () => {
    it('should retrieve parsed value from Redis on hit', async () => {
      const mockData = { name: 'cached-item' };
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(mockData));

      const result = await CacheService.get<{ name: string }>('test-key');
      expect(redis.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual(mockData);
    });

    it('should return null when Redis misses and fallback map has no key', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      const result = await CacheService.get('missing-key');
      expect(result).toBeNull();
    });

    it('should fallback to in-memory map when Redis throws error', async () => {
      vi.mocked(redis.get).mockRejectedValue(new Error('Redis connection failed'));
      
      // Seed fallback map
      const mockData = { name: 'local-cached-item' };
      const expiresAt = Date.now() + 10000;
      (CacheService as any).fallbackMap.set('fallback-key', {
        value: JSON.stringify(mockData),
        expiresAt,
      });

      const result = await CacheService.get<{ name: string }>('fallback-key');
      expect(result).toEqual(mockData);
    });

    it('should delete from fallback map and return null if fallback key has expired', async () => {
      vi.mocked(redis.get).mockRejectedValue(new Error('Redis connection failed'));
      
      const mockData = { name: 'expired-item' };
      const expiresAt = Date.now() - 1000; // expired
      (CacheService as any).fallbackMap.set('expired-key', {
        value: JSON.stringify(mockData),
        expiresAt,
      });

      const result = await CacheService.get('expired-key');
      expect(result).toBeNull();
      expect((CacheService as any).fallbackMap.has('expired-key')).toBe(false);
    });
  });

  describe('set', () => {
    it('should successfully call redis.set with expiration', async () => {
      vi.mocked(redis.set).mockResolvedValue('OK');

      await CacheService.set('set-key', { foo: 'bar' }, 60);
      expect(redis.set).toHaveBeenCalledWith('set-key', JSON.stringify({ foo: 'bar' }), 'EX', 60);
      expect((CacheService as any).fallbackMap.has('set-key')).toBe(false);
    });

    it('should write to fallback map when Redis throws error', async () => {
      vi.mocked(redis.set).mockRejectedValue(new Error('Redis write failed'));

      await CacheService.set('fail-key', { foo: 'bar' }, 60);
      expect((CacheService as any).fallbackMap.has('fail-key')).toBe(true);
      const val = (CacheService as any).fallbackMap.get('fail-key');
      expect(JSON.parse(val.value)).toEqual({ foo: 'bar' });
      expect(val.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should evict the oldest key when fallback map exceeds 1000 keys', async () => {
      vi.mocked(redis.set).mockRejectedValue(new Error('Redis write failed'));

      // Seed map with 1000 keys
      for (let i = 0; i < 1000; i++) {
        (CacheService as any).fallbackMap.set(`key-${i}`, { value: 'val', expiresAt: Date.now() + 60000 });
      }

      expect((CacheService as any).fallbackMap.size).toBe(1000);

      // Add one more key to trigger eviction
      await CacheService.set('key-new', 'new-val', 60);
      expect((CacheService as any).fallbackMap.size).toBe(1000);
      expect((CacheService as any).fallbackMap.has('key-0')).toBe(false); // oldest evicted
      expect((CacheService as any).fallbackMap.has('key-new')).toBe(true);
    });
  });

  describe('del', () => {
    it('should delete from Redis and fallback map', async () => {
      vi.mocked(redis.del).mockResolvedValue(1);
      (CacheService as any).fallbackMap.set('del-key', { value: 'val', expiresAt: Date.now() + 60000 });

      await CacheService.del('del-key');
      expect(redis.del).toHaveBeenCalledWith('del-key');
      expect((CacheService as any).fallbackMap.has('del-key')).toBe(false);
    });

    it('should delete from fallback map even when Redis.del throws', async () => {
      vi.mocked(redis.del).mockRejectedValue(new Error('Redis delete error'));
      (CacheService as any).fallbackMap.set('del-key', { value: 'val', expiresAt: Date.now() + 60000 });

      await CacheService.del('del-key');
      expect((CacheService as any).fallbackMap.has('del-key')).toBe(false);
    });
  });

  describe('delPattern', () => {
    it('should look up keys in Redis and delete them', async () => {
      vi.mocked(redis.keys).mockResolvedValue(['pat-1', 'pat-2']);
      vi.mocked(redis.del).mockResolvedValue(2);

      await CacheService.delPattern('pat-*');
      expect(redis.keys).toHaveBeenCalledWith('pat-*');
      expect(redis.del).toHaveBeenCalledWith('pat-1', 'pat-2');
    });

    it('should do nothing if Redis keys returns empty array', async () => {
      vi.mocked(redis.keys).mockResolvedValue([]);

      await CacheService.delPattern('pat-*');
      expect(redis.keys).toHaveBeenCalledWith('pat-*');
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('should scan and delete matching keys from fallback map when Redis throws', async () => {
      vi.mocked(redis.keys).mockRejectedValue(new Error('Redis keys error'));

      (CacheService as any).fallbackMap.set('auth:user1', { value: '1', expiresAt: Date.now() + 60000 });
      (CacheService as any).fallbackMap.set('auth:user2', { value: '2', expiresAt: Date.now() + 60000 });
      (CacheService as any).fallbackMap.set('other:key', { value: '3', expiresAt: Date.now() + 60000 });

      await CacheService.delPattern('auth:*');
      expect((CacheService as any).fallbackMap.has('auth:user1')).toBe(false);
      expect((CacheService as any).fallbackMap.has('auth:user2')).toBe(false);
      expect((CacheService as any).fallbackMap.has('other:key')).toBe(true);
    });
  });
});
