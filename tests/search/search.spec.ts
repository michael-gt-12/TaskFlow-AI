import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchService } from '../../src/search/search.service';
import { prisma } from '../../src/database/client';

vi.mock('../../src/database/client', () => ({
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
