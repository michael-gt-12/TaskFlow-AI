import { redis } from './redis';
import { logger } from '../shared/logger';

export class CacheService {
  private static fallbackMap = new Map<string, { value: string; expiresAt: number }>();

  static async get<T>(key: string): Promise<T | null> {
    try {
      const val = await redis.get(key);
      if (val) return JSON.parse(val) as T;
    } catch (err) {
      // Fallback in-memory LRU check
      const fallback = this.fallbackMap.get(key);
      if (fallback) {
        if (fallback.expiresAt > Date.now()) {
          return JSON.parse(fallback.value) as T;
        } else {
          this.fallbackMap.delete(key);
        }
      }
    }
    return null;
  }

  static async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const valString = JSON.stringify(value);
    try {
      await redis.set(key, valString, 'EX', ttlSeconds);
    } catch (err) {
      // Fallback in-memory storage
      this.fallbackMap.set(key, {
        value: valString,
        expiresAt: Date.now() + ttlSeconds * 1000
      });
      // Simple LRU cleaning size-cap
      if (this.fallbackMap.size > 1000) {
        const firstKey = this.fallbackMap.keys().next().value;
        if (firstKey) this.fallbackMap.delete(firstKey);
      }
    }
  }

  static async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (err) {}
    this.fallbackMap.delete(key);
  }

  static async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      // Fallback scan and delete
      for (const k of this.fallbackMap.keys()) {
        if (k.includes(pattern.replace('*', ''))) {
          this.fallbackMap.delete(k);
        }
      }
    }
  }
}
