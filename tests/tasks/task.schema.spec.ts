import { describe, it, expect } from 'vitest';
import { CreateTaskSchema, UpdateTaskSchema } from '../../src/tasks/task.schema';

const ISO = '2026-01-01T00:00:00.000Z';

describe('task.schema', () => {
  describe('CreateTaskSchema', () => {
    it('accepts a minimal valid body', () => {
      const r = CreateTaskSchema.safeParse({ body: { title: 'Do it', projectId: 'p1' } });
      expect(r.success).toBe(true);
    });

    it('accepts a fully populated body', () => {
      const r = CreateTaskSchema.safeParse({
        body: {
          title: 'Do it',
          description: 'desc',
          projectId: 'p1',
          status: 'TODO',
          priority: 'HIGH',
          dueDate: ISO,
          assigneeId: 'u1',
          labelIds: ['l1', 'l2'],
        },
      });
      expect(r.success).toBe(true);
    });

    it('rejects an empty title', () => {
      const r = CreateTaskSchema.safeParse({ body: { title: '', projectId: 'p1' } });
      expect(r.success).toBe(false);
    });

    it('requires projectId', () => {
      const r = CreateTaskSchema.safeParse({ body: { title: 'Do it' } });
      expect(r.success).toBe(false);
    });

    it('rejects an unknown status enum value', () => {
      const r = CreateTaskSchema.safeParse({ body: { title: 'Do it', projectId: 'p1', status: 'NOPE' } });
      expect(r.success).toBe(false);
    });

    it('rejects an unknown priority enum value', () => {
      const r = CreateTaskSchema.safeParse({
        body: { title: 'Do it', projectId: 'p1', priority: 'WHATEVER' },
      });
      expect(r.success).toBe(false);
    });

    it('rejects a non-datetime dueDate', () => {
      const r = CreateTaskSchema.safeParse({ body: { title: 'Do it', projectId: 'p1', dueDate: 'tomorrow' } });
      expect(r.success).toBe(false);
    });

    it('rejects labelIds that is not an array of strings', () => {
      const r = CreateTaskSchema.safeParse({ body: { title: 'Do it', projectId: 'p1', labelIds: [1, 2] } });
      expect(r.success).toBe(false);
    });
  });

  describe('UpdateTaskSchema', () => {
    it('accepts an empty body (all optional)', () => {
      expect(UpdateTaskSchema.safeParse({ body: {} }).success).toBe(true);
    });

    it('accepts a nullable dueDate and assigneeId', () => {
      const r = UpdateTaskSchema.safeParse({ body: { dueDate: null, assigneeId: null } });
      expect(r.success).toBe(true);
    });

    it('rejects an empty title when present', () => {
      const r = UpdateTaskSchema.safeParse({ body: { title: '' } });
      expect(r.success).toBe(false);
    });

    it('rejects an unknown status', () => {
      const r = UpdateTaskSchema.safeParse({ body: { status: 'NOPE' } });
      expect(r.success).toBe(false);
    });
  });
});
