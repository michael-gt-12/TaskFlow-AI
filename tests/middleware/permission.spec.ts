import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkOrgRole,
  checkOrgPermission,
  checkCapability,
  requireSystemAdmin,
} from '../../src/middleware/permission';
import { prisma } from '../../src/database/client';
import { CacheService } from '../../src/utils/cache';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../src/shared/errors';
import { OrgRole, ProjectRole, SystemRole } from '@prisma/client';

vi.mock('../../src/database/client', () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    task: { findUnique: vi.fn() },
    taskDependency: { findUnique: vi.fn() },
    timeEntry: { findUnique: vi.fn() },
    checklist: { findUnique: vi.fn() },
    checklistItem: { findUnique: vi.fn() },
    sprint: { findUnique: vi.fn() },
    milestone: { findUnique: vi.fn() },
    orgMember: { findUnique: vi.fn() },
    projectMember: { findUnique: vi.fn() },
  },
}));

vi.mock('../../src/utils/cache', () => ({
  CacheService: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

describe('Permission Middlewares', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: {},
      body: {},
      query: {},
      user: {
        id: 'user-123',
        email: 'user@test.com',
        role: SystemRole.USER,
      },
    };
    res = {};
    next = vi.fn();
  });

  describe('resolveOrgId (via checkOrgRole/checkOrgPermission)', () => {
    it('should resolve orgId directly from params', async () => {
      req.params.orgId = 'org-direct';
      vi.mocked(CacheService.get).mockResolvedValue(OrgRole.MEMBER);

      const middleware = checkOrgPermission(OrgRole.MEMBER);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.orgMember.orgId).toBe('org-direct');
    });

    it('should resolve orgId from projectId', async () => {
      req.params.projectId = 'proj-123';
      vi.mocked(prisma.project.findUnique).mockResolvedValue({
        id: 'proj-123',
        organizationId: 'org-resolved-proj',
      } as any);
      vi.mocked(CacheService.get).mockResolvedValue(OrgRole.MEMBER);

      const middleware = checkOrgPermission(OrgRole.MEMBER);
      await middleware(req, res, next);

      expect(prisma.project.findUnique).toHaveBeenCalledWith({ where: { id: 'proj-123' } });
      expect(next).toHaveBeenCalledWith();
      expect(req.orgMember.orgId).toBe('org-resolved-proj');
    });

    it('should throw NotFoundError if project is not found', async () => {
      req.params.projectId = 'proj-missing';
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

      const middleware = checkOrgPermission(OrgRole.MEMBER);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toMatch(/project not found/i);
    });

    it('should resolve orgId from taskId', async () => {
      req.body.taskId = 'task-123';
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        id: 'task-123',
        project: { organizationId: 'org-resolved-task' },
      } as any);
      vi.mocked(CacheService.get).mockResolvedValue(OrgRole.MEMBER);

      const middleware = checkOrgPermission(OrgRole.MEMBER);
      await middleware(req, res, next);

      expect(prisma.task.findUnique).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        include: { project: true },
      });
      expect(next).toHaveBeenCalledWith();
      expect(req.orgMember.orgId).toBe('org-resolved-task');
    });

    it('should resolve orgId from checklistId', async () => {
      req.params.checklistId = 'check-123';
      vi.mocked(prisma.checklist.findUnique).mockResolvedValue({
        id: 'check-123',
        task: { project: { organizationId: 'org-resolved-checklist' } },
      } as any);
      vi.mocked(CacheService.get).mockResolvedValue(OrgRole.MEMBER);

      const middleware = checkOrgPermission(OrgRole.MEMBER);
      await middleware(req, res, next);

      expect(prisma.checklist.findUnique).toHaveBeenCalledWith({
        where: { id: 'check-123' },
        include: { task: { include: { project: { select: { organizationId: true } } } } },
      });
      expect(next).toHaveBeenCalledWith();
      expect(req.orgMember.orgId).toBe('org-resolved-checklist');
    });
  });

  describe('establishMembership', () => {
    it('should throw UnauthorizedError if user is not authenticated', async () => {
      req.user = null;
      const middleware = checkOrgPermission(OrgRole.MEMBER);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });

    it('should grant SystemAdmin OWNER permissions without checking org membership', async () => {
      req.params.orgId = 'org-any';
      req.user.role = SystemRole.SYSTEM_ADMIN;

      const middleware = checkOrgPermission(OrgRole.OWNER);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.orgMember).toEqual({ orgId: 'org-any', role: OrgRole.OWNER });
      expect(CacheService.get).not.toHaveBeenCalled();
    });

    it('should load role from cache if present', async () => {
      req.params.orgId = 'org-cached';
      vi.mocked(CacheService.get).mockResolvedValue(OrgRole.ADMIN);

      const middleware = checkOrgPermission(OrgRole.MEMBER);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.orgMember.role).toBe(OrgRole.ADMIN);
      expect(prisma.orgMember.findUnique).not.toHaveBeenCalled();
    });

    it('should look up role in DB and cache it on cache miss', async () => {
      req.params.orgId = 'org-db';
      vi.mocked(CacheService.get).mockResolvedValue(null);
      vi.mocked(prisma.orgMember.findUnique).mockResolvedValue({
        role: OrgRole.MEMBER,
      } as any);

      const middleware = checkOrgPermission(OrgRole.MEMBER);
      await middleware(req, res, next);

      expect(prisma.orgMember.findUnique).toHaveBeenCalled();
      expect(CacheService.set).toHaveBeenCalledWith(expect.any(String), OrgRole.MEMBER, expect.any(Number));
      expect(next).toHaveBeenCalledWith();
      expect(req.orgMember.role).toBe(OrgRole.MEMBER);
    });

    it('should throw ForbiddenError if not a member of the organization', async () => {
      req.params.orgId = 'org-not-member';
      vi.mocked(CacheService.get).mockResolvedValue(null);
      vi.mocked(prisma.orgMember.findUnique).mockResolvedValue(null);

      const middleware = checkOrgPermission(OrgRole.MEMBER);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.message).toMatch(/not a member/i);
    });
  });

  describe('checkOrgRole', () => {
    it('should allow if user role priority is at least the minimum allowed role priority', async () => {
      req.params.orgId = 'org-1';
      vi.mocked(CacheService.get).mockResolvedValue(OrgRole.ADMIN); // priority 80

      const middleware = checkOrgRole([OrgRole.MEMBER]); // Member priority 10
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should fail if user role priority is less than the minimum allowed role priority', async () => {
      req.params.orgId = 'org-1';
      vi.mocked(CacheService.get).mockResolvedValue(OrgRole.MEMBER); // priority 10

      const middleware = checkOrgRole([OrgRole.ADMIN]); // Admin priority 80
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.message).toMatch(/Insufficient permissions/i);
    });
  });

  describe('checkOrgPermission', () => {
    it('should authorize if user role is high enough', async () => {
      req.params.orgId = 'org-1';
      vi.mocked(CacheService.get).mockResolvedValue(OrgRole.OWNER);

      const middleware = checkOrgPermission(OrgRole.ADMIN);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should reject if user role is too low', async () => {
      req.params.orgId = 'org-1';
      vi.mocked(CacheService.get).mockResolvedValue(OrgRole.MEMBER);

      const middleware = checkOrgPermission(OrgRole.ADMIN);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.message).toMatch(/requires at least/i);
    });
  });

  describe('checkCapability', () => {
    it('should allow if org role holds capability (without project context)', async () => {
      req.params.orgId = 'org-1';
      vi.mocked(CacheService.get).mockResolvedValue(OrgRole.ADMIN);

      // 'org:manage_members' is held by ADMIN
      const middleware = checkCapability('org:manage_members');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.orgMember.capabilities).toContain('org:manage_members');
    });

    it('should allow if project role holds capability when project context is present', async () => {
      req.params.orgId = 'org-1';
      req.params.projectId = 'proj-1';
      vi.mocked(CacheService.get).mockResolvedValue(OrgRole.MEMBER); // Member does not have write capabilities globally
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
        role: ProjectRole.LEAD,
      } as any);

      // 'project:archive' is held by Project LEAD
      const middleware = checkCapability('project:archive');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.projectMember).toEqual({ projectId: 'proj-1', role: ProjectRole.LEAD });
    });

    it('should throw ForbiddenError if missing capability', async () => {
      req.params.orgId = 'org-1';
      vi.mocked(CacheService.get).mockResolvedValue(OrgRole.MEMBER);

      // 'project:archive' is NOT held by Org MEMBER (without project context)
      const middleware = checkCapability('project:archive');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.message).toMatch(/Missing required capability/i);
    });
  });

  describe('requireSystemAdmin', () => {
    it('should call next on success for SYSTEM_ADMIN', () => {
      req.user.role = SystemRole.SYSTEM_ADMIN;

      const middleware = requireSystemAdmin();
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should throw UnauthorizedError if user is not authenticated', () => {
      req.user = null;

      const middleware = requireSystemAdmin();
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });

    it('should throw ForbiddenError if user role is not SYSTEM_ADMIN', () => {
      req.user.role = SystemRole.USER;

      const middleware = requireSystemAdmin();
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.message).toMatch(/administrator access required/i);
    });
  });
});
