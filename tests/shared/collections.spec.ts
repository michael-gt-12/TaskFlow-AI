import { describe, it, expect } from 'vitest';
import {
  groupBy,
  countBy,
  keyBy,
  chunk,
  uniq,
  uniqBy,
  sum,
  average,
  median,
  percentile,
  clamp,
  range,
  partitionBy,
  pick,
  omit,
  compact,
  sortBy,
} from '../../src/shared/collections';

describe('collections', () => {
  describe('groupBy', () => {
    it('groups items by the computed key', () => {
      const items = [
        { type: 'a', n: 1 },
        { type: 'b', n: 2 },
        { type: 'a', n: 3 },
      ];
      expect(groupBy(items, (i) => i.type)).toEqual({
        a: [
          { type: 'a', n: 1 },
          { type: 'a', n: 3 },
        ],
        b: [{ type: 'b', n: 2 }],
      });
    });

    it('returns an empty object for an empty input', () => {
      expect(groupBy([], (x) => x)).toEqual({});
    });
  });

  describe('countBy', () => {
    it('counts occurrences per key', () => {
      expect(countBy(['a', 'b', 'a', 'a', 'b'], (x) => x)).toEqual({ a: 3, b: 2 });
    });
  });

  describe('keyBy', () => {
    it('indexes items by key, keeping the last on collision', () => {
      const items = [
        { id: 1, v: 'first' },
        { id: 1, v: 'second' },
        { id: 2, v: 'other' },
      ];
      expect(keyBy(items, (i) => i.id)).toEqual({
        1: { id: 1, v: 'second' },
        2: { id: 2, v: 'other' },
      });
    });
  });

  describe('chunk', () => {
    it('splits an array into evenly sized chunks', () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('returns a single chunk when size exceeds length', () => {
      expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
    });

    it('returns empty array for empty input', () => {
      expect(chunk([], 3)).toEqual([]);
    });

    it('throws when size is not positive', () => {
      expect(() => chunk([1], 0)).toThrow(/positive/);
      expect(() => chunk([1], -2)).toThrow(/positive/);
    });
  });

  describe('uniq', () => {
    it('removes duplicate primitives preserving order', () => {
      expect(uniq([1, 1, 2, 3, 2, 1])).toEqual([1, 2, 3]);
    });
  });

  describe('uniqBy', () => {
    it('keeps the first item per derived key', () => {
      const items = [
        { id: 1, label: 'a' },
        { id: 1, label: 'b' },
        { id: 2, label: 'c' },
      ];
      expect(uniqBy(items, (i) => i.id)).toEqual([
        { id: 1, label: 'a' },
        { id: 2, label: 'c' },
      ]);
    });
  });

  describe('numeric aggregates', () => {
    it('sum adds values and returns 0 for empty', () => {
      expect(sum([1, 2, 3])).toBe(6);
      expect(sum([])).toBe(0);
    });

    it('average computes the mean and returns 0 for empty', () => {
      expect(average([2, 4, 6])).toBe(4);
      expect(average([])).toBe(0);
    });

    it('median handles odd and even length and empty', () => {
      expect(median([3, 1, 2])).toBe(2);
      expect(median([1, 2, 3, 4])).toBe(2.5);
      expect(median([])).toBe(0);
    });

    it('median does not mutate the input array', () => {
      const input = [3, 1, 2];
      median(input);
      expect(input).toEqual([3, 1, 2]);
    });

    it('percentile returns boundary-clamped values', () => {
      const values = [10, 20, 30, 40, 50];
      expect(percentile(values, 100)).toBe(50);
      expect(percentile(values, 0)).toBe(10);
      expect(percentile(values, 50)).toBe(30);
      expect(percentile([], 50)).toBe(0);
    });
  });

  describe('clamp', () => {
    it('constrains a value to the inclusive range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('range', () => {
    it('produces a half-open numeric range', () => {
      expect(range(0, 5)).toEqual([0, 1, 2, 3, 4]);
    });

    it('respects a custom step', () => {
      expect(range(0, 10, 3)).toEqual([0, 3, 6, 9]);
    });

    it('returns empty when start >= end', () => {
      expect(range(5, 5)).toEqual([]);
      expect(range(6, 5)).toEqual([]);
    });
  });

  describe('partitionBy', () => {
    it('splits into matched and rest', () => {
      expect(partitionBy([1, 2, 3, 4], (n) => n % 2 === 0)).toEqual([
        [2, 4],
        [1, 3],
      ]);
    });
  });

  describe('pick', () => {
    it('selects only the requested keys', () => {
      expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });

    it('ignores keys absent from the object', () => {
      expect(pick({ a: 1 } as any, ['a', 'missing'])).toEqual({ a: 1 });
    });
  });

  describe('omit', () => {
    it('removes the requested keys without mutating the source', () => {
      const source = { a: 1, b: 2, c: 3 };
      expect(omit(source, ['b'])).toEqual({ a: 1, c: 3 });
      expect(source).toEqual({ a: 1, b: 2, c: 3 });
    });
  });

  describe('compact', () => {
    it('drops null and undefined but keeps falsy values like 0 and ""', () => {
      expect(compact([0, null, 1, undefined, '', 2])).toEqual([0, 1, '', 2]);
    });
  });

  describe('sortBy', () => {
    it('sorts by a numeric key ascending without mutating input', () => {
      const input = [{ n: 3 }, { n: 1 }, { n: 2 }];
      expect(sortBy(input, (i) => i.n)).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
      expect(input).toEqual([{ n: 3 }, { n: 1 }, { n: 2 }]);
    });

    it('sorts by a string key', () => {
      expect(sortBy(['banana', 'apple', 'cherry'], (s) => s)).toEqual([
        'apple',
        'banana',
        'cherry',
      ]);
    });
  });
});
