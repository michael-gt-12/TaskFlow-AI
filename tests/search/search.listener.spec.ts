import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/search/search.service', () => ({
  SearchService: { indexEntity: vi.fn() },
}));

vi.mock('../../src/database/client', () => ({
  prisma: { task: { findUnique: vi.fn() } },
}));

import { DomainEventPublisher, DomainEvent } from '../../src/shared/events';
import { setupSearchListeners } from '../../src/search/search.listener';
import { SearchService } from '../../src/search/search.service';
import { prisma } from '../../src/database/client';

const handlers = new Map<string, Array<(e: DomainEvent) => any>>();

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
  vi.spyOn(DomainEventPublisher, 'subscribe').mockImplementation((name: string, fn: any) => {
    const list = handlers.get(name) ?? [];
    list.push(fn);
    handlers.set(name, list);
  });
  setupSearchListeners();
});

const fire = (name: string, payload: any) =>
  Promise.all((handlers.get(name) ?? []).map((fn) => fn({ name, timestamp: new Date(), payload } as DomainEvent)));

describe('search.listener', () => {
  it('indexes a new task on task.created', async () => {
    await fire('task.created', { taskId: 't1', taskTitle: 'Fix bug' });
    expect(SearchService.indexEntity).toHaveBeenCalledWith('TASK', 't1', 'task Fix bug state:todo');
  });

  it('reindexes with assignee and status on task.updated', async () => {
    (prisma.task.findUnique as any).mockResolvedValue({
      id: 't1', description: 'desc', status: 'IN_PROGRESS', assignee: { name: 'Alice' },
    });
    await fire('task.updated', { taskId: 't1', taskTitle: 'Fix bug' });
    expect(SearchService.indexEntity).toHaveBeenCalledWith(
      'TASK', 't1', expect.stringContaining('assignee:Alice')
    );
    expect(SearchService.indexEntity).toHaveBeenCalledWith(
      'TASK', 't1', expect.stringContaining('state:IN_PROGRESS')
    );
  });

  it('marks an unassigned task as such on task.updated', async () => {
    (prisma.task.findUnique as any).mockResolvedValue({
      id: 't1', description: null, status: 'TODO', assignee: null,
    });
    await fire('task.updated', { taskId: 't1', taskTitle: 'Fix bug' });
    expect(SearchService.indexEntity).toHaveBeenCalledWith(
      'TASK', 't1', expect.stringContaining('assignee:unassigned')
    );
  });

  it('does not index when the task is missing on task.updated', async () => {
    (prisma.task.findUnique as any).mockResolvedValue(null);
    await fire('task.updated', { taskId: 't1', taskTitle: 'Fix bug' });
    expect(SearchService.indexEntity).not.toHaveBeenCalled();
  });
});
