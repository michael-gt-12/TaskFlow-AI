import { describe, it, expect } from 'vitest';
import { DependencyMapper } from '../../src/dependencies/dependency.mapper';

describe('DependencyMapper', () => {
  describe('toDto', () => {
    it('serialises createdAt and passes scalars through', () => {
      const dto = DependencyMapper.toDto({
        id: 'd1',
        sourceTaskId: 't1',
        targetTaskId: 't2',
        type: 'BLOCKS',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      } as any);
      expect(dto).toEqual({
        id: 'd1',
        sourceTaskId: 't1',
        targetTaskId: 't2',
        type: 'BLOCKS',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });
  });

  describe('toGraphDto', () => {
    it('maps outgoing and incoming edges', () => {
      const dto = DependencyMapper.toGraphDto({
        taskId: 't1',
        outgoing: [
          { id: 'd1', type: 'BLOCKS' as any, task: { id: 't2', title: 'B', status: 'TODO' } },
        ],
        incoming: [
          { id: 'd2', type: 'RELATES_TO' as any, task: { id: 't3', title: 'C', status: 'DONE' } },
        ],
      });
      expect(dto.taskId).toBe('t1');
      expect(dto.outgoing).toEqual([
        { id: 'd1', type: 'BLOCKS', task: { id: 't2', title: 'B', status: 'TODO' } },
      ]);
      expect(dto.incoming).toEqual([
        { id: 'd2', type: 'RELATES_TO', task: { id: 't3', title: 'C', status: 'DONE' } },
      ]);
    });

    it('handles empty edge lists', () => {
      const dto = DependencyMapper.toGraphDto({ taskId: 't1', outgoing: [], incoming: [] });
      expect(dto).toEqual({ taskId: 't1', outgoing: [], incoming: [] });
    });
  });
});
