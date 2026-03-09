import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService } from './notification.service';
import { prisma } from '../database/client';

vi.mock('../database/client', () => ({
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
