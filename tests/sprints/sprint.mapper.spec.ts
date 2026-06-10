import { describe, it, expect } from 'vitest';
import { SprintMapper } from '../../src/sprints/sprint.mapper';

function baseSprint(overrides: any = {}) {
  return {
    id: 's1',
    projectId: 'p1',
    name: 'Sprint 1',
    goal: 'Ship it',
    status: 'PLANNED',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-01-14T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('SprintMapper', () => {
  describe('toDto', () => {
    it('serialises dates to ISO strings and passes scalars through', () => {
      const dto = SprintMapper.toDto(baseSprint() as any);
      expect(dto).toEqual({
        id: 's1',
        projectId: 'p1',
        name: 'Sprint 1',
        goal: 'Ship it',
        status: 'PLANNED',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-14T00:00:00.000Z',
        taskCount: undefined,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      });
    });

    it('maps null start/end dates to null', () => {
      const dto = SprintMapper.toDto(baseSprint({ startDate: null, endDate: null }) as any);
      expect(dto.startDate).toBeNull();
      expect(dto.endDate).toBeNull();
    });

    it('surfaces _count.tasks as taskCount when present', () => {
      const dto = SprintMapper.toDto(baseSprint({ _count: { tasks: 7 } }) as any);
      expect(dto.taskCount).toBe(7);
    });
  });

  describe('toDtoList', () => {
    it('maps a list of sprints', () => {
      const list = SprintMapper.toDtoList([baseSprint(), baseSprint({ id: 's2' })] as any);
      expect(list).toHaveLength(2);
      expect(list[1].id).toBe('s2');
    });
  });

  describe('toSummaryDto', () => {
    it('computes a rounded completion rate', () => {
      const dto = SprintMapper.toSummaryDto(baseSprint() as any, {
        totalTasks: 4,
        completedTasks: 1,
        tasksByStatus: { DONE: 1, TODO: 3 },
        storyPoints: { total: 8, completed: 2 },
      });
      expect(dto.stats.completionRate).toBe(0.25);
      expect(dto.stats.totalTasks).toBe(4);
      expect(dto.id).toBe('s1');
    });

    it('returns a 0 completion rate when there are no tasks', () => {
      const dto = SprintMapper.toSummaryDto(baseSprint() as any, {
        totalTasks: 0,
        completedTasks: 0,
        tasksByStatus: {},
        storyPoints: { total: 0, completed: 0 },
      });
      expect(dto.stats.completionRate).toBe(0);
    });
  });
});
