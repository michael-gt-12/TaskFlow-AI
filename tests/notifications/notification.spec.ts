import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService } from '../../src/notifications/notification.service';
import { prisma } from '../../src/database/client';

vi.mock('../../src/database/client', () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

describe('NotificationService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should successfully trigger notification create', async () => {
    const mockNotif = { id: 'n1', userId: 'u1', title: 'Welcome', message: 'Hello' };
    vi.mocked(prisma.notification.create).mockResolvedValue(mockNotif as any);

    const result = await NotificationService.send('u1', 'Welcome', 'Hello');
    expect(result!.title).toBe('Welcome');
  });
});
