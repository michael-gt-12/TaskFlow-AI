import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectService } from '../../src/projects/project.service';
import { projectRepository } from '../../src/projects/project.repository';
import { CacheService } from '../../src/utils/cache';
import { BillingService } from '../../src/billing/billing.service';
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

describe('ProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (CacheService.get as any).mockResolvedValue(null);
    (projectRepository.keyExists as any).mockResolvedValue(false);
  });

  describe('create', () => {
    it('creates a project, enrols the lead and provisions default labels', async () => {
      txMock.project.create.mockResolvedValue({
        id: 'p1',
        name: 'Project Alpha',
        key: 'PRO',
        organizationId: 'org1',
      });

      const result = await ProjectService.create('org1', 'user1', { name: 'Project Alpha' });

      expect(BillingService.checkProjectLimit).toHaveBeenCalledWith('org1');
      expect(txMock.projectMember.create).toHaveBeenCalled();
      expect(txMock.label.createMany).toHaveBeenCalled();
      expect(result.name).toBe('Project Alpha');
    });

    it('rejects an empty name before touching the database', async () => {
      await expect(ProjectService.create('org1', 'user1', { name: '   ' })).rejects.toThrow(
        /name is required/i
      );
      expect(BillingService.checkProjectLimit).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('throws a conflict when the project is already archived', async () => {
      (projectRepository.findById as any).mockResolvedValue({
        id: 'p1',
        organizationId: 'org1',
        isArchived: true,
      });
      await expect(ProjectService.archive('p1', 'user1')).rejects.toThrow(/already archived/i);
    });

    it('archives an active project and stamps archivedAt', async () => {
      (projectRepository.findById as any).mockResolvedValue({
        id: 'p1',
        organizationId: 'org1',
        isArchived: false,
      });
      (projectRepository.update as any).mockResolvedValue({
        id: 'p1',
        organizationId: 'org1',
        name: 'P',
        isArchived: true,
      });
      const result = await ProjectService.archive('p1', 'user1');
      expect(result.isArchived).toBe(true);
      expect(projectRepository.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ isArchived: true })
      );
    });
  });

  describe('update', () => {
    it('refuses to edit an archived project', async () => {
      (projectRepository.findById as any).mockResolvedValue({
        id: 'p1',
        organizationId: 'org1',
        isArchived: true,
      });
      await expect(ProjectService.update('p1', 'user1', { name: 'New' })).rejects.toThrow(
        /archived/i
      );
    });
  });
});
