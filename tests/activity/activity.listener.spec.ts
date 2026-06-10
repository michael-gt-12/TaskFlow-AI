import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/activity/activity.service', () => ({
  ActivityService: { log: vi.fn() },
}));

import { DomainEventPublisher, DomainEvent } from '../../src/shared/events';
import { setupActivityListeners } from '../../src/activity/activity.listener';
import { ActivityService } from '../../src/activity/activity.service';

// Capture the handlers registered via subscribe() so we can invoke them
// directly and deterministically (rather than relying on async dispatch).
const handlers = new Map<string, Array<(e: DomainEvent) => any>>();

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
  vi.spyOn(DomainEventPublisher, 'subscribe').mockImplementation((name: string, fn: any) => {
    const list = handlers.get(name) ?? [];
    list.push(fn);
    handlers.set(name, list);
  });
  setupActivityListeners();
});

function fire(name: string, payload: any) {
  const list = handlers.get(name);
  if (!list?.length) throw new Error(`no handler for ${name}`);
  return Promise.all(list.map((fn) => fn({ name, timestamp: new Date(), payload } as DomainEvent)));
}

describe('activity.listener', () => {
  it('logs TASK_CREATE on task.created', async () => {
    await fire('task.created', { userId: 'u1', orgId: 'org1', projectId: 'p1', taskId: 't1', taskTitle: 'X' });
    expect(ActivityService.log).toHaveBeenCalledWith('u1', 'org1', 'p1', 't1', 'TASK_CREATE', { title: 'X' });
  });

  it('logs TASK_STATUS_CHANGE on task.status_changed', async () => {
    await fire('task.status_changed', {
      userId: 'u1', orgId: 'org1', projectId: 'p1', taskId: 't1', taskTitle: 'X', oldStatus: 'TODO', newStatus: 'DONE',
    });
    expect(ActivityService.log).toHaveBeenCalledWith(
      'u1', 'org1', 'p1', 't1', 'TASK_STATUS_CHANGE',
      expect.objectContaining({ oldStatus: 'TODO', newStatus: 'DONE' })
    );
  });

  it('logs TASK_UPDATE on task.updated', async () => {
    await fire('task.updated', { userId: 'u1', orgId: 'org1', projectId: 'p1', taskId: 't1', taskTitle: 'X' });
    expect(ActivityService.log).toHaveBeenCalledWith('u1', 'org1', 'p1', 't1', 'TASK_UPDATE', { title: 'X' });
  });

  it('logs SPRINT_STARTED on sprint.started', async () => {
    await fire('sprint.started', { userId: 'u1', orgId: 'org1', projectId: 'p1', sprintId: 's1', sprintName: 'S1' });
    expect(ActivityService.log).toHaveBeenCalledWith(
      'u1', 'org1', 'p1', null, 'SPRINT_STARTED', expect.objectContaining({ sprintId: 's1' })
    );
  });

  it('logs SPRINT_COMPLETED on sprint.completed', async () => {
    await fire('sprint.completed', {
      userId: 'u1', orgId: 'org1', projectId: 'p1', sprintId: 's1', sprintName: 'S1', completedTasks: 3, carriedOverTasks: 1,
    });
    expect(ActivityService.log).toHaveBeenCalledWith(
      'u1', 'org1', 'p1', null, 'SPRINT_COMPLETED', expect.objectContaining({ completedTasks: 3, carriedOverTasks: 1 })
    );
  });

  it('logs MILESTONE_REACHED on milestone.reached', async () => {
    await fire('milestone.reached', { userId: 'u1', orgId: 'org1', projectId: 'p1', milestoneId: 'm1', milestoneName: 'M1' });
    expect(ActivityService.log).toHaveBeenCalledWith(
      'u1', 'org1', 'p1', null, 'MILESTONE_REACHED', expect.objectContaining({ milestoneId: 'm1' })
    );
  });

  it('logs MILESTONE_MISSED on milestone.missed', async () => {
    await fire('milestone.missed', { userId: 'u1', orgId: 'org1', projectId: 'p1', milestoneId: 'm1', milestoneName: 'M1' });
    expect(ActivityService.log).toHaveBeenCalledWith(
      'u1', 'org1', 'p1', null, 'MILESTONE_MISSED', expect.objectContaining({ milestoneId: 'm1' })
    );
  });
});
