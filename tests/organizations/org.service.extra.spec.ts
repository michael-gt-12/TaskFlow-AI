import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrgRole } from '@prisma/client';
import { OrgService } from '../../src/organizations/org.service';
import { prisma } from '../../src/database/client';
import { CacheService } from '../../src/utils/cache';
import { BillingService } from '../../src/billing/billing.service';

vi.mock('../../src/database/client', () => {
  const prismaMock: any = {
    organization: { findUnique: vi.fn(), create: vi.fn() },
    orgMember: { findUnique: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
  };
  prismaMock.$transaction = (fn: any) => fn(prismaMock);
  return { prisma: prismaMock };
});

vi.mock('../../src/utils/cache', () => ({
  CacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/billing/billing.service', () => ({
  BillingService: { checkMemberLimit: vi.fn().mockResolvedValue(undefined) },
}));

describe('OrgService (extra)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (CacheService.get as any).mockResolvedValue(null);
  });

  describe('create', () => {
    it('rejects a slug that is already taken', async () => {
      (prisma.organization.findUnique as any).mockResolvedValue({ id: 'existing' });
      await expect(OrgService.create('u1', { name: 'Acme', slug: 'acme' })).rejects.toThrow(
        /slug is already taken/i
      );
      expect(prisma.organization.create).not.toHaveBeenCalled();
    });

    it('creates the org and enrols the creator as OWNER', async () => {
      (prisma.organization.findUnique as any).mockResolvedValue(null);
      (prisma.organization.create as any).mockResolvedValue({ id: 'org1', name: 'Acme', slug: 'acme' });
      (prisma.orgMember.create as any).mockResolvedValue({ id: 'm1' });

      const result = await OrgService.create('u1', { name: 'Acme', slug: 'acme' });

      expect(result.id).toBe('org1');
      expect(prisma.orgMember.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', role: OrgRole.OWNER }) })
      );
    });
  });

  describe('getById', () => {
    it('returns the cached org without hitting the database', async () => {
      (CacheService.get as any).mockResolvedValue({ id: 'org1', name: 'Cached' });
      const result = await OrgService.getById('org1');
      expect(result.name).toBe('Cached');
      expect(prisma.organization.findUnique).not.toHaveBeenCalled();
    });

    it('loads from the database and caches on a miss', async () => {
      (prisma.organization.findUnique as any).mockResolvedValue({ id: 'org1', name: 'Acme', members: [] });
      const result = await OrgService.getById('org1');
      expect(result.name).toBe('Acme');
      expect(CacheService.set).toHaveBeenCalledWith('org:org1', expect.any(Object), 300);
    });

    it('throws NotFoundError when the org does not exist', async () => {
      (prisma.organization.findUnique as any).mockResolvedValue(null);
      await expect(OrgService.getById('missing')).rejects.toThrow(/not found/i);
    });
  });

  describe('inviteMember', () => {
    it('checks the member limit before inviting', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      await expect(
        OrgService.inviteMember('org1', 'u1', 'x@b.com', OrgRole.MEMBER)
      ).rejects.toThrow(/invited user/i);
      expect(BillingService.checkMemberLimit).toHaveBeenCalledWith('org1');
    });

    it('rejects inviting a user that is already a member', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ id: 'u2' });
      (prisma.orgMember.findUnique as any).mockResolvedValue({ id: 'm1' });
      await expect(
        OrgService.inviteMember('org1', 'u1', 'x@b.com', OrgRole.MEMBER)
      ).rejects.toThrow(/already a member/i);
    });

    it('creates the membership and invalidates the org cache', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ id: 'u2' });
      (prisma.orgMember.findUnique as any).mockResolvedValue(null);
      (prisma.orgMember.create as any).mockResolvedValue({ id: 'm2', userId: 'u2', role: OrgRole.MEMBER });

      const result = await OrgService.inviteMember('org1', 'u1', 'x@b.com', OrgRole.MEMBER);

      expect(result.userId).toBe('u2');
      expect(CacheService.del).toHaveBeenCalledWith('org:org1');
    });
  });
});
