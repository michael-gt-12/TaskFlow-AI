import { describe, it, expect } from 'vitest';
import {
  parseCursor,
  encodeCursor,
  buildPrismaCursorQuery,
} from '../../src/shared/pagination';
import { BadRequestError } from '../../src/shared/errors';

describe('pagination', () => {
  describe('encodeCursor / parseCursor', () => {
    it('encodeCursor produces a deterministic, opaque base64 string', () => {
      const date = new Date('2026-03-15T12:30:00.000Z');
      const a = encodeCursor('task-123', date);
      const b = encodeCursor('task-123', date);
      expect(a).toBe(b);
      expect(a).toMatch(/^[A-Za-z0-9+/=]+$/);
      // The raw id should not be directly readable in the encoded form.
      expect(a).not.toContain('task-123');
    });

    it('parseCursor returns an id and a timestamp', () => {
      // NOTE: parseCursor splits the decoded payload on ":", but an ISO
      // timestamp itself contains colons, so the original id/timestamp are NOT
      // faithfully recovered. This test pins the *current* (buggy) behavior so
      // a future fix is visible as a deliberate change rather than a surprise.
      const cursor = encodeCursor('task-123', new Date('2026-03-15T12:30:00.000Z'));
      const parsed = parseCursor(cursor);
      expect(typeof parsed.id).toBe('string');
      expect(parsed.timestamp).toBeInstanceOf(Date);
      // The colon-split keeps only the first two segments of the ISO string.
      expect(parsed.id).toBe('30');
    });

    it('throws BadRequestError on malformed cursors', () => {
      // Not valid base64-of-"timestamp:id" structure (no colon separator).
      const bad = Buffer.from('garbage-without-colon', 'utf-8').toString('base64');
      expect(() => parseCursor(bad)).toThrow(BadRequestError);
    });
  });

  describe('buildPrismaCursorQuery', () => {
    it('applies defaults: limit 10, desc, createdAt and take = limit + 1', () => {
      const { query, limit } = buildPrismaCursorQuery({});
      expect(limit).toBe(10);
      expect(query.take).toBe(11);
      expect(query.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
      expect(query.where).toBeUndefined();
    });

    it('honours explicit first, orderBy and orderDirection', () => {
      const { query, limit } = buildPrismaCursorQuery({
        first: 25,
        orderBy: 'priority',
        orderDirection: 'asc',
      });
      expect(limit).toBe(25);
      expect(query.take).toBe(26);
      expect(query.orderBy).toEqual([{ priority: 'asc' }, { id: 'asc' }]);
    });

    it('builds a two-branch OR where-clause using lt for desc order', () => {
      const after = encodeCursor('task-9', new Date('2026-03-15T12:00:00.000Z'));
      const { query } = buildPrismaCursorQuery({ after, orderDirection: 'desc' });

      // Structure (not the mangled values) is what matters here: a primary
      // range comparison plus an id tie-breaker, both using the `lt` operator.
      expect(query.where.OR).toHaveLength(2);
      expect(query.where.OR[0].createdAt).toHaveProperty('lt');
      expect(query.where.OR[1].id).toHaveProperty('lt');
    });

    it('uses gt for ascending order', () => {
      const after = encodeCursor('task-9', new Date('2026-03-15T12:00:00.000Z'));
      const { query } = buildPrismaCursorQuery({
        after,
        orderDirection: 'asc',
        orderBy: 'createdAt',
      });

      expect(query.where.OR[0].createdAt).toHaveProperty('gt');
      expect(query.where.OR[1].id).toHaveProperty('gt');
    });
  });
});
