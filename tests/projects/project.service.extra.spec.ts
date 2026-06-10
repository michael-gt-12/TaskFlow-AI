import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectRole } from '@prisma/client';
import { ProjectService } from '../../src/projects/project.service';
import { projectRepository } from '../../src/projects/project.repository';
import { CacheService } from '../../src/utils/cache';
import { prisma } from '../../src/database/client';

vi.mock('../../src/projects/project.repository', () => ({
  projectRepository: {
    findById: vi.fn(),
    findByIdWithRelations: vi.fn(),
    keyExists: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    listMembers: vi.fn(),
  },
  ProjectRepository: class {},
}));

vi.mock('../../src/utils/cache', () => ({
  CacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    delPattern: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/billing/billing.service', () => ({
  BillingService: { checkProjectLimit: vi.fn().mockResolvedValue(undefined) },
}));

const txMock = {
  project: { create: vi.fn(), update: vi.fn() },
  projectMember: { create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  label: { createMany: vi.fn() },
};

vi.mock('../../src/database/client', () => ({
  prisma: {
    $transaction: vi.fn((fn: any) => fn(txMock)),
    orgMember: { findUnique: vi.fn() },
  },
}));

const baseProject = { id: 'p1', organizationId: 'org1', name: 'P', isArchived: false, leadId: 'u1' };

describe('ProjectService (extra)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (CacheService.get as any).mockResolvedValue(null);
  });

  describe('getById', () => {
    it('returns the cached project without hitting the repo', async () => {
      (CacheService.get as any).mockResolvedValue(baseProject);
      const result = await ProjectService.getById('p1');
      expect(result.id).toBe('p1');
      expect(projectRepository.findById).not.toHaveBeenCalled();
    });

    it('loads and caches on a miss', async () => {
      (projectRepository.findById as any).mockResolvedValue(baseProject);
      const result = await ProjectService.getById('p1');
      expect(result.id).toBe('p1');
      expect(CacheService.set).toHaveBeenCalled();
    });

    it('throws NotFound when missing', async () => {
      (projectRepository.findById as any).mockResolvedValue(null);
      await expect(ProjectService.getById('p1')).rejects.toThrow(/not found/i);
    });
  });

  describe('getDetail', () => {
    it('returns the detailed project', async () => {
      (projectRepository.findByIdWithRelations as any).mockResolvedValue({ ...baseProject, tasks: [] });
      const result = await ProjectService.getDetail('p1');
      expect(result).toHaveProperty('tasks');
    });

    it('throws NotFound when missing', async () => {
      (projectRepository.findByIdWithRelations as any).mockResolvedValue(null);
      await expect(ProjectService.getDetail('p1')).rejects.toThrow(/not found/i);
    });
  });

  describe('list', () => {
    it('maps repo results into a paginated envelope', async () => {
      (projectRepository.list as any).mockResolvedValue({ items: [baseProject], total: 1 });
      const result = await ProjectService.list('org1', { page: 1, pageSize: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.totalCount ?? result.meta.total).toBeDefined();
      expect(projectRepository.list).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org1', skip: 0, take: 20 })
      );
    });
  });

  describe('restore', () => {
    it('throws when the project is not archived', async () => {
      (projectRepository.findById as any).mockResolvedValue({ ...baseProject, isArchived: false });
      await expect(ProjectService.restore('p1', 'u1')).rejects.toThrow(/not archived/i);
    });

    it('restores an archived project', async () => {
      (projectRepository.findById as any).mockResolvedValue({ ...baseProject, isArchived: true });
      (projectRepository.update as any).mockResolvedValue({ ...baseProject, isArchived: false });
      const result = await ProjectService.restore('p1', 'u1');
      expect(result.isArchived).toBe(false);
      expect(projectRepository.update).toHaveBeenCalledWith('p1', expect.objectContaining({ isArchived: false }));
    });
  });

  describe('softDelete', () => {
    it('stamps deletedAt and invalidates caches', async () => {
      (projectRepository.findById as any).mockResolvedValue(baseProject);
      (projectRepository.update as any).mockResolvedValue(baseProject);
      await ProjectService.softDelete('p1', 'u1');
      expect(projectRepository.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ isArchived: true, deletedAt: expect.any(Date) })
      );
      expect(CacheService.del).toHaveBeenCalled();
    });
  });

  describe('transferLead', () => {
    it('rejects a new lead who is not an org member', async () => {
      (projectRepository.findById as any).mockResolvedValue(baseProject);
      (prisma.orgMember.findUnique as any).mockResolvedValue(null);
      await expect(ProjectService.transferLead('p1', 'u1', 'u2')).rejects.toThrow(/member of the organization/i);
    });

    it('demotes the old lead and promotes the new one', async () => {
      (projectRepository.findById as any).mockResolvedValue({ ...baseProject, leadId: 'u1' });
      (prisma.orgMember.findUnique as any).mockResolvedValue({ userId: 'u2' });
      txMock.projectMember.update.mockResolvedValue({});
      txMock.projectMember.upsert.mockResolvedValue({});
      txMock.project.update.mockResolvedValue({ ...baseProject, leadId: 'u2' });
      const result = await ProjectService.transferLead('p1', 'u1', 'u2');
      expect(txMock.projectMember.update).toHaveBeenCalled();
      expect(txMock.projectMember.upsert).toHaveBeenCalled();
      expect(result.leadId).toBe('u2');
    });
  });

  describe('members', () => {
    it('addMember loads the project then delegates to the repo', async () => {
      (projectRepository.findById as any).mockResolvedValue(baseProject);
      await ProjectService.addMember('p1', 'u3', ProjectRole.CONTRIBUTOR);
      expect(projectRepository.addMember).toHaveBeenCalledWith('p1', 'u3', ProjectRole.CONTRIBUTOR);
    });

    it('removeMember refuses to remove the lead', async () => {
      (projectRepository.findById as any).mockResolvedValue({ ...baseProject, leadId: 'u1' });
      await expect(ProjectService.removeMember('p1', 'u1')).rejects.toThrow(/Reassign the project lead/i);
    });

    it('removeMember removes a non-lead member', async () => {
      (projectRepository.findById as any).mockResolvedValue({ ...baseProject, leadId: 'u1' });
      await ProjectService.removeMember('p1', 'u2');
      expect(projectRepository.removeMember).toHaveBeenCalledWith('p1', 'u2');
    });

    it('listMembers delegates to the repo', async () => {
      (projectRepository.findById as any).mockResolvedValue(baseProject);
      (projectRepository.listMembers as any).mockResolvedValue([{ userId: 'u1' }]);
      const members = await ProjectService.listMembers('p1');
      expect(members).toHaveLength(1);
    });
  });

  describe('create key allocation', () => {
    it('appends a numeric suffix when the derived key already exists', async () => {
      (projectRepository.keyExists as any)
        .mockResolvedValueOnce(true) // base taken
        .mockResolvedValueOnce(false); // suffixed free
      txMock.project.create.mockResolvedValue({ id: 'p9', name: 'Alpha', key: 'ALPHA2', organizationId: 'org1' });
      const result = await ProjectService.create('org1', 'u1', { name: 'Alpha' });
      expect(result.key).toBe('ALPHA2');
      expect(projectRepository.keyExists).toHaveBeenCalledTimes(2);
    });
  });
});
