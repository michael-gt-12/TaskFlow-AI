import { describe, it, expect } from 'vitest';
import {
  parseIntParam,
  parseOffsetPagination,
  parseSort,
  parseList,
  parseBoolean,
  parseDate,
  toPrismaOrderBy,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../src/shared/query';
import { BadRequestError } from '../../src/shared/errors';

describe('query', () => {
  describe('parseIntParam', () => {
    it('returns the fallback for empty-ish values', () => {
      expect(parseIntParam(undefined, 7)).toBe(7);
      expect(parseIntParam(null, 7)).toBe(7);
      expect(parseIntParam('', 7)).toBe(7);
    });

    it('parses and truncates numeric strings', () => {
      expect(parseIntParam('42', 0)).toBe(42);
      expect(parseIntParam('42.9', 0)).toBe(42);
    });

    it('clamps to the provided min and max', () => {
      expect(parseIntParam('1000', 0, { max: 100 })).toBe(100);
      expect(parseIntParam('-5', 0, { min: 1 })).toBe(1);
    });

    it('throws BadRequestError for non-numeric input', () => {
      expect(() => parseIntParam('abc', 0)).toThrow(BadRequestError);
    });
  });

  describe('parseOffsetPagination', () => {
    it('applies defaults', () => {
      expect(parseOffsetPagination({})).toEqual({
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        skip: 0,
        take: DEFAULT_PAGE_SIZE,
      });
    });

    it('computes skip from page and pageSize', () => {
      expect(parseOffsetPagination({ page: '3', pageSize: '10' })).toEqual({
        page: 3,
        pageSize: 10,
        skip: 20,
        take: 10,
      });
    });

    it('honours the limit alias and clamps pageSize to MAX_PAGE_SIZE', () => {
      const result = parseOffsetPagination({ limit: '500' });
      expect(result.pageSize).toBe(MAX_PAGE_SIZE);
    });

    it('clamps page to a minimum of 1', () => {
      expect(parseOffsetPagination({ page: '0' }).page).toBe(1);
    });
  });

  describe('parseSort', () => {
    const allowed = ['createdAt', 'priority'];
    const fallback = { field: 'createdAt', direction: 'desc' as const };

    it('returns the fallback for non-string or empty input', () => {
      expect(parseSort(undefined, allowed, fallback)).toBe(fallback);
      expect(parseSort('', allowed, fallback)).toBe(fallback);
    });

    it('parses ascending fields', () => {
      expect(parseSort('priority', allowed, fallback)).toEqual({
        field: 'priority',
        direction: 'asc',
      });
    });

    it('parses a leading - as descending', () => {
      expect(parseSort('-createdAt', allowed, fallback)).toEqual({
        field: 'createdAt',
        direction: 'desc',
      });
    });

    it('rejects fields outside the allow-list', () => {
      expect(() => parseSort('password', allowed, fallback)).toThrow(BadRequestError);
    });
  });

  describe('parseList', () => {
    it('returns empty array for empty-ish input', () => {
      expect(parseList(undefined)).toEqual([]);
      expect(parseList('')).toEqual([]);
    });

    it('splits, trims and drops blanks', () => {
      expect(parseList('a, b ,,c')).toEqual(['a', 'b', 'c']);
    });

    it('maps an array to strings', () => {
      expect(parseList([1, 2, 3])).toEqual(['1', '2', '3']);
    });
  });

  describe('parseBoolean', () => {
    it('returns undefined for empty-ish input', () => {
      expect(parseBoolean(undefined)).toBeUndefined();
      expect(parseBoolean('')).toBeUndefined();
    });

    it('passes through actual booleans', () => {
      expect(parseBoolean(true)).toBe(true);
      expect(parseBoolean(false)).toBe(false);
    });

    it('treats truthy tokens as true and others as false', () => {
      for (const v of ['1', 'true', 'YES', 'on']) expect(parseBoolean(v)).toBe(true);
      expect(parseBoolean('no')).toBe(false);
      expect(parseBoolean('0')).toBe(false);
    });
  });

  describe('parseDate', () => {
    it('returns undefined for empty-ish input', () => {
      expect(parseDate(undefined)).toBeUndefined();
      expect(parseDate('')).toBeUndefined();
    });

    it('parses an ISO date string', () => {
      const d = parseDate('2026-03-15T00:00:00Z');
      expect(d).toBeInstanceOf(Date);
      expect(d!.toISOString()).toBe('2026-03-15T00:00:00.000Z');
    });

    it('throws BadRequestError for an invalid date', () => {
      expect(() => parseDate('not-a-date')).toThrow(BadRequestError);
    });
  });

  describe('toPrismaOrderBy', () => {
    it('builds an orderBy with an id tie-breaker', () => {
      expect(toPrismaOrderBy({ field: 'priority', direction: 'asc' })).toEqual([
        { priority: 'asc' },
        { id: 'asc' },
      ]);
    });
  });
});
