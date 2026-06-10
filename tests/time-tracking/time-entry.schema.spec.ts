import { describe, it, expect } from 'vitest';
import {
  LogTimeSchema,
  UpdateTimeEntrySchema,
  ListTimeEntriesSchema,
} from '../../src/time-tracking/time-entry.schema';

const UUID = '11111111-1111-1111-1111-111111111111';
const ISO = '2026-01-01T00:00:00.000Z';

describe('time-entry.schema', () => {
  describe('LogTimeSchema', () => {
    it('accepts a minimal valid body', () => {
      const r = LogTimeSchema.safeParse({ body: { taskId: UUID, minutes: 30 } });
      expect(r.success).toBe(true);
    });

    it('accepts a fully populated body', () => {
      const r = LogTimeSchema.safeParse({
        body: { taskId: UUID, minutes: 60, description: 'work', startedAt: ISO },
      });
      expect(r.success).toBe(true);
    });

    it('rejects a non-uuid taskId', () => {
      const r = LogTimeSchema.safeParse({ body: { taskId: 'not-a-uuid', minutes: 30 } });
      expect(r.success).toBe(false);
    });

    it('rejects fractional minutes', () => {
      const r = LogTimeSchema.safeParse({ body: { taskId: UUID, minutes: 1.5 } });
      expect(r.success).toBe(false);
    });

    it('rejects minutes below 1', () => {
      const r = LogTimeSchema.safeParse({ body: { taskId: UUID, minutes: 0 } });
      expect(r.success).toBe(false);
    });

    it('rejects minutes above 24 hours', () => {
      const r = LogTimeSchema.safeParse({ body: { taskId: UUID, minutes: 24 * 60 + 1 } });
      expect(r.success).toBe(false);
    });

    it('rejects a description longer than 500 chars', () => {
      const r = LogTimeSchema.safeParse({
        body: { taskId: UUID, minutes: 30, description: 'a'.repeat(501) },
      });
      expect(r.success).toBe(false);
    });

    it('rejects a non-ISO startedAt', () => {
      const r = LogTimeSchema.safeParse({ body: { taskId: UUID, minutes: 30, startedAt: 'nope' } });
      expect(r.success).toBe(false);
    });
  });

  describe('UpdateTimeEntrySchema', () => {
    it('accepts an empty body (all optional)', () => {
      const r = UpdateTimeEntrySchema.safeParse({ body: {} });
      expect(r.success).toBe(true);
    });

    it('accepts nullable description and startedAt', () => {
      const r = UpdateTimeEntrySchema.safeParse({ body: { description: null, startedAt: null } });
      expect(r.success).toBe(true);
    });

    it('rejects invalid minutes', () => {
      const r = UpdateTimeEntrySchema.safeParse({ body: { minutes: 0 } });
      expect(r.success).toBe(false);
    });
  });

  describe('ListTimeEntriesSchema', () => {
    it('coerces numeric pagination and accepts a userId', () => {
      const r = ListTimeEntriesSchema.safeParse({
        query: { page: '2', pageSize: '50', userId: UUID },
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.query.page).toBe(2);
    });

    it('accepts an empty query', () => {
      expect(ListTimeEntriesSchema.safeParse({ query: {} }).success).toBe(true);
    });

    it('rejects a non-uuid userId', () => {
      const r = ListTimeEntriesSchema.safeParse({ query: { userId: 'x' } });
      expect(r.success).toBe(false);
    });

    it('rejects pageSize above 100', () => {
      const r = ListTimeEntriesSchema.safeParse({ query: { pageSize: '500' } });
      expect(r.success).toBe(false);
    });
  });
});
