import { describe, it, expect } from 'vitest';
import { DtoMapper } from './dto';

describe('DtoMapper', () => {
  it('should map task model to DTO correctly', () => {
    const mockTask = {
      id: 't1',
      title: 'Fix issue',
      description: 'Fix the crash',
      status: 'TODO',
      priority: 'HIGH',
      dueDate: null,
      creator: { id: 'u1', name: 'Alice', email: 'alice@test.com' },
      assignee: null,
      labels: [],
      createdAt: new Date('2026-03-01T10:00:00Z')
    };

    const result = DtoMapper.mapTask(mockTask);
    expect(result.id).toBe('t1');
    expect(result.creator.name).toBe('Alice');
    expect(result.labels.length).toBe(0);
  });
});
