import { describe, it, expect } from 'vitest';
import {
  CreateSprintSchema,
  UpdateSprintSchema,
  ListSprintsSchema,
  CompleteSprintSchema,
  AssignTaskSchema,
} from '../../src/sprints/sprint.schema';

const UUID = '11111111-1111-1111-1111-111111111111';
const ISO = '2026-01-01T00:00:00.000Z';

describe('sprint.schema', () => {
  describe('CreateSprintSchema', () => {
    it('accepts a minimal valid body', () => {
      const r = CreateSprintSchema.safeParse({ body: { projectId: UUID, name: 'Sprint 1' } });
      expect(r.success).toBe(true);
    });

    it('accepts a fully populated body', () => {
      const r = CreateSprintSchema.safeParse({
        body: { projectId: UUID, name: 'Sprint 1', goal: 'Ship', startDate: ISO, endDate: ISO },
      });
      expect(r.success).toBe(true);
    });

    it('requires a uuid projectId', () => {
      const r = CreateSprintSchema.safeParse({ body: { projectId: 'nope', name: 'Sprint 1' } });
      expect(r.success).toBe(false);
    });

    it('rejects a name shorter than 2 chars', () => {
      const r = CreateSprintSchema.safeParse({ body: { projectId: UUID, name: 'S' } });
      expect(r.success).toBe(false);
    });

    it('rejects a non-ISO startDate', () => {
      const r = CreateSprintSchema.safeParse({
        body: { projectId: UUID, name: 'Sprint 1', startDate: '2026-01-01' },
      });
      expect(r.success).toBe(false);
    });
  });

  describe('UpdateSprintSchema', () => {
    it('accepts a partial update with nullable fields', () => {
      const r = UpdateSprintSchema.safeParse({ body: { goal: null, startDate: null, endDate: null } });
      expect(r.success).toBe(true);
    });

    it('accepts an empty body', () => {
      expect(UpdateSprintSchema.safeParse({ body: {} }).success).toBe(true);
    });

    it('rejects a too-short name', () => {
      expect(UpdateSprintSchema.safeParse({ body: { name: 'x' } }).success).toBe(false);
    });
  });

  describe('ListSprintsSchema', () => {
    it('coerces numeric pagination and accepts a status', () => {
      const r = ListSprintsSchema.safeParse({ query: { page: '2', pageSize: '50', status: 'ACTIVE' } });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.query.page).toBe(2);
    });

    it('rejects a status outside the enum', () => {
      expect(ListSprintsSchema.safeParse({ query: { status: 'WIP' } }).success).toBe(false);
    });

    it('rejects pageSize above 100', () => {
      expect(ListSprintsSchema.safeParse({ query: { pageSize: '500' } }).success).toBe(false);
    });
  });

  describe('CompleteSprintSchema', () => {
    it('accepts an empty body', () => {
      expect(CompleteSprintSchema.safeParse({ body: {} }).success).toBe(true);
    });

    it('accepts an optional uuid roll-over target', () => {
      expect(
        CompleteSprintSchema.safeParse({ body: { moveUnfinishedToSprintId: UUID } }).success
      ).toBe(true);
    });

    it('rejects a non-uuid roll-over target', () => {
      expect(
        CompleteSprintSchema.safeParse({ body: { moveUnfinishedToSprintId: 'x' } }).success
      ).toBe(false);
    });
  });

  describe('AssignTaskSchema', () => {
    it('requires a uuid taskId', () => {
      expect(AssignTaskSchema.safeParse({ body: { taskId: UUID } }).success).toBe(true);
      expect(AssignTaskSchema.safeParse({ body: { taskId: 'x' } }).success).toBe(false);
    });
  });
});
