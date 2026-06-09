import { describe, it, expect } from 'vitest';
import {
  CreateMilestoneSchema,
  UpdateMilestoneSchema,
  ListMilestonesSchema,
  ReachMilestoneSchema,
  AssignTaskSchema,
} from '../../src/milestones/milestone.schema';

const UUID = '11111111-1111-1111-1111-111111111111';
const ISO = '2026-02-01T00:00:00.000Z';

describe('milestone.schema', () => {
  describe('CreateMilestoneSchema', () => {
    it('accepts a minimal valid body', () => {
      const r = CreateMilestoneSchema.safeParse({ body: { projectId: UUID, name: 'v1.0' } });
      expect(r.success).toBe(true);
    });

    it('accepts a fully populated body', () => {
      const r = CreateMilestoneSchema.safeParse({
        body: { projectId: UUID, name: 'v1.0', description: 'GA', dueDate: ISO },
      });
      expect(r.success).toBe(true);
    });

    it('requires a uuid projectId', () => {
      expect(CreateMilestoneSchema.safeParse({ body: { projectId: 'x', name: 'v1.0' } }).success).toBe(
        false
      );
    });

    it('rejects a name shorter than 2 chars', () => {
      expect(CreateMilestoneSchema.safeParse({ body: { projectId: UUID, name: 'v' } }).success).toBe(
        false
      );
    });

    it('rejects a non-ISO dueDate', () => {
      const r = CreateMilestoneSchema.safeParse({
        body: { projectId: UUID, name: 'v1.0', dueDate: '2026-02-01' },
      });
      expect(r.success).toBe(false);
    });
  });

  describe('UpdateMilestoneSchema', () => {
    it('accepts a partial update with nullable fields', () => {
      expect(
        UpdateMilestoneSchema.safeParse({ body: { description: null, dueDate: null } }).success
      ).toBe(true);
    });

    it('accepts an empty body', () => {
      expect(UpdateMilestoneSchema.safeParse({ body: {} }).success).toBe(true);
    });

    it('rejects a too-short name', () => {
      expect(UpdateMilestoneSchema.safeParse({ body: { name: 'x' } }).success).toBe(false);
    });
  });

  describe('ListMilestonesSchema', () => {
    it('coerces numeric pagination and accepts a status', () => {
      const r = ListMilestonesSchema.safeParse({ query: { page: '3', pageSize: '20', status: 'OPEN' } });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.query.page).toBe(3);
    });

    it('rejects a status outside the enum', () => {
      expect(ListMilestonesSchema.safeParse({ query: { status: 'LATE' } }).success).toBe(false);
    });

    it('rejects pageSize above 100', () => {
      expect(ListMilestonesSchema.safeParse({ query: { pageSize: '500' } }).success).toBe(false);
    });
  });

  describe('ReachMilestoneSchema', () => {
    it('accepts an empty body', () => {
      expect(ReachMilestoneSchema.safeParse({ body: {} }).success).toBe(true);
    });

    it('accepts an optional boolean force', () => {
      expect(ReachMilestoneSchema.safeParse({ body: { force: true } }).success).toBe(true);
    });

    it('rejects a non-boolean force', () => {
      expect(ReachMilestoneSchema.safeParse({ body: { force: 'yes' } }).success).toBe(false);
    });
  });

  describe('AssignTaskSchema', () => {
    it('requires a uuid taskId', () => {
      expect(AssignTaskSchema.safeParse({ body: { taskId: UUID } }).success).toBe(true);
      expect(AssignTaskSchema.safeParse({ body: { taskId: 'x' } }).success).toBe(false);
    });
  });
});
