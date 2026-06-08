import { describe, it, expect } from 'vitest';
import { buildOffsetMeta } from '../../src/shared/types';

describe('types', () => {
  describe('buildOffsetMeta', () => {
    it('computes total pages and navigation flags for a middle page', () => {
      expect(buildOffsetMeta(2, 10, 25)).toEqual({
        page: 2,
        pageSize: 10,
        totalCount: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });

    it('marks the first page as having no previous page', () => {
      const meta = buildOffsetMeta(1, 10, 25);
      expect(meta.hasPreviousPage).toBe(false);
      expect(meta.hasNextPage).toBe(true);
    });

    it('marks the last page as having no next page', () => {
      const meta = buildOffsetMeta(3, 10, 25);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(true);
    });

    it('handles an empty result set', () => {
      expect(buildOffsetMeta(1, 10, 0)).toEqual({
        page: 1,
        pageSize: 10,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('returns 0 total pages when pageSize is 0', () => {
      expect(buildOffsetMeta(1, 0, 10).totalPages).toBe(0);
    });
  });
});
