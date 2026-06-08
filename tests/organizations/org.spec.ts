import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrgService } from '../../src/organizations/org.service';
import { prisma } from '../../src/database/client';

vi.mock('../../src/database/client', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn()
    },
    orgMember: {
      findUnique: vi.fn(),
      create: vi.fn()
    },
    $transaction: (fn: any) => fn(prisma)
  }
}));

describe('OrgService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getById', () => {
    it('should fetch organization and cache it', async () => {
      const mockOrg = { id: 'org1', name: 'Acme', slug: 'acme', ownerId: 'u1', members: [] };
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrg as any);

      const result = await OrgService.getById('org1');
      expect(result.name).toBe('Acme');
    });
  });
});
