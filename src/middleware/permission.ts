import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { prisma } from '../database/client';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../shared/errors';
import { OrgRole, ProjectRole, SystemRole } from '@prisma/client';
import { CacheService } from '../utils/cache';
import { CacheKeys, CACHE_TTL_MEMBERSHIP } from '../shared/constants';
import {
  Capability,
  ORG_ROLE_PRIORITY,
  orgRoleAtLeast,
  effectiveCapabilities,
} from '../shared/permissions';

/**
 * Resolve the organization id for a request from params, body or — when only a
 * project id is available — by looking up the project. The resolved id is cached
 * on the request via req.orgMember once membership is confirmed.
 */
async function resolveOrgId(req: AuthenticatedRequest): Promise<string | null> {
  const direct = req.params.orgId || req.body?.orgId || (req.query?.orgId as string | undefined);
  if (direct) return direct;

  const projectId = req.params.projectId || req.body?.projectId || (req.query?.projectId as string | undefined);
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project');
    return project.organizationId;
  }

  const taskId = req.params.taskId || req.body?.taskId || req.body?.sourceTaskId;
  if (taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) throw new NotFoundError('Task');
    return task.project.organizationId;
  }

  const dependencyId = req.params.dependencyId;
  if (dependencyId) {
    const dependency = await prisma.taskDependency.findUnique({
      where: { id: dependencyId },
      include: { source: { include: { project: { select: { organizationId: true } } } } },
    });
    if (!dependency) throw new NotFoundError('Dependency');
    return dependency.source.project.organizationId;
  }

  const entryId = req.params.entryId;
  if (entryId) {
    const entry = await prisma.timeEntry.findUnique({
      where: { id: entryId },
      include: { task: { include: { project: { select: { organizationId: true } } } } },
    });
    if (!entry) throw new NotFoundError('Time entry');
    return entry.task.project.organizationId;
  }

  const sprintId = req.params.sprintId || req.body?.sprintId;
  if (sprintId) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { project: { select: { organizationId: true } } },
    });
    if (!sprint) throw new NotFoundError('Sprint');
    return sprint.project.organizationId;
  }

  const milestoneId = req.params.milestoneId || req.body?.milestoneId;
  if (milestoneId) {
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { project: { select: { organizationId: true } } },
    });
    if (!milestone) throw new NotFoundError('Milestone');
    return milestone.project.organizationId;
  }

  return null;
}

/**
 * Look up (and cache) the caller's organization role.
 */
async function loadOrgRole(orgId: string, userId: string): Promise<OrgRole | null> {
  const cacheKey = CacheKeys.membership(orgId, userId);
  const cached = await CacheService.get<OrgRole>(cacheKey);
  if (cached) return cached;

  const member = await prisma.orgMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
  if (!member) return null;

  await CacheService.set(cacheKey, member.role, CACHE_TTL_MEMBERSHIP);
  return member.role;
}

/**
 * Attach the resolved membership context to the request after confirming the
 * caller belongs to the organization.
 */
async function establishMembership(
  req: AuthenticatedRequest
): Promise<{ orgId: string; role: OrgRole }> {
  const user = req.user;
  if (!user) throw new UnauthorizedError();

  const orgId = await resolveOrgId(req);
  if (!orgId) throw new ForbiddenError('Organization context could not be determined');

  if (user.role === SystemRole.SYSTEM_ADMIN) {
    req.orgMember = { orgId, role: OrgRole.OWNER };
    return { orgId, role: OrgRole.OWNER };
  }

  const role = await loadOrgRole(orgId, user.id);
  if (!role) throw new ForbiddenError('You are not a member of this organization');

  req.orgMember = {
    orgId,
    role,
    capabilities: Array.from(effectiveCapabilities(role)),
  };
  return { orgId, role };
}

/**
 * Require that the caller has at least one of the provided organization roles.
 * Retained for existing call sites; new code should prefer checkCapability.
 */
export const checkOrgRole = (allowedRoles: OrgRole[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { role } = await establishMembership(req);
      const minPriority = Math.min(...allowedRoles.map((r) => ORG_ROLE_PRIORITY[r]));
      if (ORG_ROLE_PRIORITY[role] < minPriority) {
        return next(new ForbiddenError('Insufficient permissions in this organization'));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Require that the caller's organization role is at least `minimumRole`.
 */
export const checkOrgPermission = (minimumRole: OrgRole) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { role } = await establishMembership(req);
      if (!orgRoleAtLeast(role, minimumRole)) {
        return next(
          new ForbiddenError(`This action requires at least the ${minimumRole} role`)
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Require that the caller holds a specific capability. Project level roles are
 * merged into the effective capability set when a project context is present.
 */
export const checkCapability = (capability: Capability) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { orgId, role } = await establishMembership(req);
      let projectRole: ProjectRole | null = null;

      const projectId =
        req.params.projectId || req.body?.projectId || (req.query?.projectId as string | undefined);
      if (projectId && req.user) {
        const pm = await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId: req.user.id } },
        });
        projectRole = pm?.role ?? null;
        if (projectRole) req.projectMember = { projectId, role: projectRole };
      }

      const caps = effectiveCapabilities(role, projectRole);
      if (!caps.has(capability)) {
        return next(new ForbiddenError(`Missing required capability: ${capability}`));
      }
      req.orgMember = { orgId, role, capabilities: Array.from(caps) };
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Restrict an endpoint to platform administrators.
 */
export const requireSystemAdmin = () => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());
    if (req.user.role !== SystemRole.SYSTEM_ADMIN) {
      return next(new ForbiddenError('Platform administrator access required'));
    }
    next();
  };
};
