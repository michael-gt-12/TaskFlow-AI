/**
 * Async control-flow helpers used by the job runner, webhook delivery pipeline
 * and integration listeners.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Retry an async function with exponential backoff. Resolves with the first
 * successful result or rejects with the last error once retries are exhausted.
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    retries = 3,
    minDelayMs = 100,
    maxDelayMs = 5000,
    factor = 2,
    onRetry,
  } = options;

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      onRetry?.(attempt + 1, error);
      const delay = Math.min(minDelayMs * factor ** attempt, maxDelayMs);
      await sleep(delay);
      attempt += 1;
    }
  }
  throw lastError;
}

/**
 * Compute the delay before the next retry attempt. Exposed separately so the
 * webhook delivery scheduler can persist `nextRetryAt` without actually
 * sleeping.
 */
export function backoffDelay(attempt: number, minDelayMs = 1000, maxDelayMs = 60000, factor = 2): number {
  return Math.min(minDelayMs * factor ** attempt, maxDelayMs);
}

/**
 * Map over items with a bounded concurrency. Preserves input ordering in the
 * output array.
 */
export async function pMap<T, R>(
  items: T[],
  mapper: (item: T, index: number) => Promise<R>,
  concurrency = 5
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Race a promise against a timeout. Rejects with a TimeoutError if the deadline
 * passes first.
 */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
