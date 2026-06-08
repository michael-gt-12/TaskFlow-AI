import { describe, it, expect, vi } from 'vitest';
import {
  sleep,
  retry,
  backoffDelay,
  pMap,
  withTimeout,
  TimeoutError,
} from '../../src/shared/async';

describe('async', () => {
  describe('sleep', () => {
    it('resolves after the given delay', async () => {
      const start = Date.now();
      await sleep(15);
      expect(Date.now() - start).toBeGreaterThanOrEqual(10);
    });
  });

  describe('retry', () => {
    it('returns immediately on first success', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      await expect(retry(fn)).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries until success and invokes onRetry per failed attempt', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('1'))
        .mockRejectedValueOnce(new Error('2'))
        .mockResolvedValue('done');
      const onRetry = vi.fn();

      const result = await retry(fn, { retries: 3, minDelayMs: 1, maxDelayMs: 2, onRetry });
      expect(result).toBe('done');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenLastCalledWith(2, expect.any(Error));
    });

    it('throws the last error after exhausting retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));
      await expect(retry(fn, { retries: 2, minDelayMs: 1 })).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });
  });

  describe('backoffDelay', () => {
    it('grows exponentially and caps at maxDelayMs', () => {
      expect(backoffDelay(0, 1000, 60000, 2)).toBe(1000);
      expect(backoffDelay(1, 1000, 60000, 2)).toBe(2000);
      expect(backoffDelay(3, 1000, 60000, 2)).toBe(8000);
      expect(backoffDelay(10, 1000, 60000, 2)).toBe(60000); // capped
    });
  });

  describe('pMap', () => {
    it('maps preserving input order', async () => {
      const result = await pMap([1, 2, 3, 4], async (n) => n * 2, 2);
      expect(result).toEqual([2, 4, 6, 8]);
    });

    it('passes the index to the mapper', async () => {
      const result = await pMap(['a', 'b', 'c'], async (item, i) => `${i}:${item}`);
      expect(result).toEqual(['0:a', '1:b', '2:c']);
    });

    it('never exceeds the configured concurrency', async () => {
      let active = 0;
      let maxActive = 0;
      await pMap(
        [1, 2, 3, 4, 5, 6],
        async (n) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await sleep(5);
          active -= 1;
          return n;
        },
        2
      );
      expect(maxActive).toBeLessThanOrEqual(2);
    });

    it('handles an empty input', async () => {
      expect(await pMap([], async (x) => x)).toEqual([]);
    });
  });

  describe('withTimeout', () => {
    it('resolves when the promise wins the race', async () => {
      await expect(withTimeout(Promise.resolve('fast'), 50)).resolves.toBe('fast');
    });

    it('rejects with TimeoutError when the deadline passes first', async () => {
      const slow = new Promise((resolve) => setTimeout(resolve, 100));
      await expect(withTimeout(slow, 10)).rejects.toBeInstanceOf(TimeoutError);
    });

    it('propagates a rejection from the underlying promise', async () => {
      await expect(withTimeout(Promise.reject(new Error('inner')), 50)).rejects.toThrow('inner');
    });

    it('TimeoutError carries the duration in its message', () => {
      expect(new TimeoutError(250).message).toMatch(/250ms/);
    });
  });
});
