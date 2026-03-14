import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchService } from './search.service';
import { prisma } from '../database/client';

vi.mock('../database/client', () => ({
  prisma: {
    searchIndex: {
      upsert: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

describe('SearchService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should search indexing documents', async () => {
    vi.mocked(prisma.searchIndex.findMany).mockResolvedValue([
      { id: 's1', entityType: 'TASK', entityId: 't1', document: 'test task' }
    ] as any);

    const result = await SearchService.search('test');
    expect(result.length).toBe(1);
    expect(result[0].document).toContain('test');
  });
});
