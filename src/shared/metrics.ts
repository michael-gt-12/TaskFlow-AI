/**
 * A tiny in-process metrics registry. In production these counters/histograms
 * would be scraped by Prometheus; here they back the /health and /metrics
 * endpoints and give the analytics module a cheap source of operational data.
 */

interface HistogramState {
  count: number;
  sum: number;
  min: number;
  max: number;
  buckets: Map<number, number>;
}

const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

class MetricsRegistry {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, HistogramState>();

  increment(name: string, value = 1, labels?: Record<string, string>): void {
    const key = this.keyFor(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.gauges.set(this.keyFor(name, labels), value);
  }

  observe(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.keyFor(name, labels);
    let state = this.histograms.get(key);
    if (!state) {
      state = {
        count: 0,
        sum: 0,
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
        buckets: new Map(DEFAULT_BUCKETS.map((b) => [b, 0])),
      };
      this.histograms.set(key, state);
    }
    state.count += 1;
    state.sum += value;
    state.min = Math.min(state.min, value);
    state.max = Math.max(state.max, value);
    for (const bucket of DEFAULT_BUCKETS) {
      if (value <= bucket) {
        state.buckets.set(bucket, (state.buckets.get(bucket) ?? 0) + 1);
      }
    }
  }

  getCounter(name: string, labels?: Record<string, string>): number {
    return this.counters.get(this.keyFor(name, labels)) ?? 0;
  }

  getGauge(name: string, labels?: Record<string, string>): number | undefined {
    return this.gauges.get(this.keyFor(name, labels));
  }

  snapshot(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, { count: number; sum: number; avg: number; min: number; max: number }>;
  } {
    const histograms: Record<string, { count: number; sum: number; avg: number; min: number; max: number }> = {};
    for (const [key, state] of this.histograms.entries()) {
      histograms[key] = {
        count: state.count,
        sum: state.sum,
        avg: state.count > 0 ? state.sum / state.count : 0,
        min: state.count > 0 ? state.min : 0,
        max: state.count > 0 ? state.max : 0,
      };
    }
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms,
    };
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  private keyFor(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }
}

export const metrics = new MetricsRegistry();

/**
 * Helper to time an async operation and record it as a histogram observation in
 * milliseconds.
 */
export async function timed<T>(name: string, fn: () => Promise<T>, labels?: Record<string, string>): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    metrics.observe(name, Date.now() - start, labels);
  }
}
