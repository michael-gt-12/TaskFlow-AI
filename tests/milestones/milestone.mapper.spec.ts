import { describe, it, expect } from 'vitest';
import { MilestoneMapper } from '../../src/milestones/milestone.mapper';

function baseMilestone(overrides: any = {}) {
  return {
    id: 'm1',
    projectId: 'p1',
    name: 'v1.0',
    description: 'GA release',
    status: 'OPEN',
    dueDate: new Date('2026-02-01T00:00:00.000Z'),
    reachedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('MilestoneMapper', () => {
  describe('toDto', () => {
    it('serialises dates to ISO strings and passes scalars through', () => {
      const dto = MilestoneMapper.toDto(baseMilestone() as any);
      expect(dto).toEqual({
        id: 'm1',
        projectId: 'p1',
        name: 'v1.0',
        description: 'GA release',
        status: 'OPEN',
        dueDate: '2026-02-01T00:00:00.000Z',
        reachedAt: null,
        taskCount: undefined,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      });
    });

    it('maps a null dueDate to null and serialises reachedAt when present', () => {
      const dto = MilestoneMapper.toDto(
        baseMilestone({ dueDate: null, reachedAt: new Date('2026-03-01T00:00:00.000Z') }) as any
      );
      expect(dto.dueDate).toBeNull();
      expect(dto.reachedAt).toBe('2026-03-01T00:00:00.000Z');
    });

    it('surfaces _count.tasks as taskCount when present', () => {
      const dto = MilestoneMapper.toDto(baseMilestone({ _count: { tasks: 9 } }) as any);
      expect(dto.taskCount).toBe(9);
    });
  });

  describe('toDtoList', () => {
    it('maps a list of milestones', () => {
      const list = MilestoneMapper.toDtoList([baseMilestone(), baseMilestone({ id: 'm2' })] as any);
      expect(list).toHaveLength(2);
      expect(list[1].id).toBe('m2');
    });
  });

  describe('toSummaryDto', () => {
    it('computes a rounded completion rate', () => {
      const dto = MilestoneMapper.toSummaryDto(baseMilestone() as any, {
        totalTasks: 4,
        completedTasks: 1,
        openTasks: 3,
        tasksByStatus: { DONE: 1, TODO: 3 },
      });
      expect(dto.stats.completionRate).toBe(0.25);
      expect(dto.stats.openTasks).toBe(3);
    });

    it('returns a 0 completion rate when there are no tasks', () => {
      const dto = MilestoneMapper.toSummaryDto(baseMilestone() as any, {
        totalTasks: 0,
        completedTasks: 0,
        openTasks: 0,
        tasksByStatus: {},
      });
      expect(dto.stats.completionRate).toBe(0);
    });

    it('flags an OPEN milestone with a past dueDate as overdue', () => {
      const dto = MilestoneMapper.toSummaryDto(
        baseMilestone({ status: 'OPEN', dueDate: new Date('2000-01-01T00:00:00.000Z') }) as any,
        { totalTasks: 1, completedTasks: 0, openTasks: 1, tasksByStatus: { TODO: 1 } }
      );
      expect(dto.stats.isOverdue).toBe(true);
    });

    it('is not overdue when the dueDate is in the future', () => {
      const dto = MilestoneMapper.toSummaryDto(
        baseMilestone({ status: 'OPEN', dueDate: new Date('2999-01-01T00:00:00.000Z') }) as any,
        { totalTasks: 0, completedTasks: 0, openTasks: 0, tasksByStatus: {} }
      );
      expect(dto.stats.isOverdue).toBe(false);
    });

    it('is not overdue when there is no dueDate', () => {
      const dto = MilestoneMapper.toSummaryDto(
        baseMilestone({ status: 'OPEN', dueDate: null }) as any,
        { totalTasks: 0, completedTasks: 0, openTasks: 0, tasksByStatus: {} }
      );
      expect(dto.stats.isOverdue).toBe(false);
    });

    it('is not overdue when the milestone is not OPEN even with a past dueDate', () => {
      const dto = MilestoneMapper.toSummaryDto(
        baseMilestone({ status: 'REACHED', dueDate: new Date('2000-01-01T00:00:00.000Z') }) as any,
        { totalTasks: 1, completedTasks: 1, openTasks: 0, tasksByStatus: { DONE: 1 } }
      );
      expect(dto.stats.isOverdue).toBe(false);
    });
  });
});
