import { describe, it, expect, beforeEach } from 'vitest';
import { metrics, timed } from '../../src/shared/metrics';

describe('metrics', () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe('counters', () => {
    it('increments by 1 by default and by an explicit amount', () => {
      metrics.increment('requests');
      metrics.increment('requests', 4);
      expect(metrics.getCounter('requests')).toBe(5);
    });

    it('returns 0 for an unknown counter', () => {
      expect(metrics.getCounter('missing')).toBe(0);
    });

    it('keys counters by sorted labels independently', () => {
      metrics.increment('http', 1, { method: 'GET' });
      metrics.increment('http', 2, { method: 'POST' });
      expect(metrics.getCounter('http', { method: 'GET' })).toBe(1);
      expect(metrics.getCounter('http', { method: 'POST' })).toBe(2);
    });

    it('produces the same key regardless of label insertion order', () => {
      metrics.increment('e', 1, { a: '1', b: '2' });
      metrics.increment('e', 1, { b: '2', a: '1' });
      expect(metrics.getCounter('e', { a: '1', b: '2' })).toBe(2);
    });
  });

  describe('gauges', () => {
    it('stores and overwrites a gauge value', () => {
      metrics.setGauge('queue_depth', 10);
      metrics.setGauge('queue_depth', 3);
      expect(metrics.getGauge('queue_depth')).toBe(3);
    });

    it('returns undefined for an unknown gauge', () => {
      expect(metrics.getGauge('nope')).toBeUndefined();
    });
  });

  describe('histograms / snapshot', () => {
    it('aggregates observations into count, sum, avg, min and max', () => {
      metrics.observe('latency', 10);
      metrics.observe('latency', 30);
      metrics.observe('latency', 20);

      const snap = metrics.snapshot();
      expect(snap.histograms.latency).toEqual({
        count: 3,
        sum: 60,
        avg: 20,
        min: 10,
        max: 30,
      });
    });

    it('snapshot exposes counters and gauges', () => {
      metrics.increment('c', 2);
      metrics.setGauge('g', 7);
      const snap = metrics.snapshot();
      expect(snap.counters.c).toBe(2);
      expect(snap.gauges.g).toBe(7);
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      metrics.increment('x');
      metrics.setGauge('y', 1);
      metrics.observe('z', 5);
      metrics.reset();
      const snap = metrics.snapshot();
      expect(snap.counters).toEqual({});
      expect(snap.gauges).toEqual({});
      expect(snap.histograms).toEqual({});
    });
  });

  describe('timed', () => {
    it('records an observation and returns the wrapped result', async () => {
      const result = await timed('op', async () => 'done');
      expect(result).toBe('done');
      expect(metrics.snapshot().histograms.op.count).toBe(1);
    });

    it('still records an observation when the function throws', async () => {
      await expect(
        timed('failing', async () => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');
      expect(metrics.snapshot().histograms.failing.count).toBe(1);
    });
  });
});
