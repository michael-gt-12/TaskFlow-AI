import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupActivityListeners } from '../../src/activity/activity.listener';
import { DomainEventPublisher } from '../../src/shared/events';
import { ActivityService } from '../../src/activity/activity.service';

vi.mock('../../src/activity/activity.service', () => ({
  ActivityService: {
    log: vi.fn()
  }
}));

describe('ActivityListener', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should trigger log on task.created event', async () => {
    setupActivityListeners();
    const mockPayload = { userId: 'u1', orgId: 'org1', projectId: 'p1', taskId: 't1', taskTitle: 'Test' };
    
    DomainEventPublisher.publish('task.created', mockPayload);
    // Let async loop finish
    await new Promise(r => setTimeout(r, 10));

    expect(ActivityService.log).toHaveBeenCalledWith(
      'u1', 'org1', 'p1', 't1', 'TASK_CREATE', expect.any(Object)
    );
  });
});
