import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectService } from './project.service';
import { prisma } from '../database/client';

vi.mock('../database/client', () => ({
  prisma: {
    project: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}));

describe('ProjectService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should create project successfully', async () => {
    const mockProj = { id: 'p1', name: 'Project Alpha', organizationId: 'org1' };
    vi.mocked(prisma.project.create).mockResolvedValue(mockProj as any);

    const result = await ProjectService.create('org1', { name: 'Project Alpha' });
    expect(result.name).toBe('Project Alpha');
  });
});
