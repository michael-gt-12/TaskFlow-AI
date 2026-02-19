import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types';
import { prisma } from '../database/client';
import { ForbiddenError, NotFoundError } from '../shared/errors';
import { OrgRole, SystemRole } from '@prisma/client';
import { CacheService } from '../utils/cache';

export const checkOrgRole = (allowedRoles: OrgRole[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;
      const orgId = req.params.orgId || req.body.orgId;

      if (!user) return next(new ForbiddenError());
      if (user.role === SystemRole.SYSTEM_ADMIN) return next();

      if (!orgId) return next(new ForbiddenError('Organization ID is required'));

      // Check cached membership
      const cacheKey = `member:${orgId}:${user.id}`;
      let role = await CacheService.get<OrgRole>(cacheKey);

      if (!role) {
        const member = await prisma.orgMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: orgId,
              userId: user.id
            }
          }
        });

        if (!member) {
          return next(new ForbiddenError('You are not a member of this organization'));
        }
        role = member.role;
        await CacheService.set(cacheKey, role, 120); // cached for 2 minutes
      }

      const rolePriority: Record<OrgRole, number> = {
        OWNER: 4,
        ADMIN: 3,
        MEMBER: 2,
        GUEST: 1
      };

      const maxAllowedPriority = Math.max(...allowedRoles.map(r => rolePriority[r]));
      const userPriority = rolePriority[role];

      if (userPriority < maxAllowedPriority) {
        return next(new ForbiddenError('Insufficient permissions in this organization'));
      }

      req.orgMember = { orgId, role };
      next();
    } catch (err) {
      next(err);
    }
  };
};
