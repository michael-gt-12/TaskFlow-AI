import { prisma } from '../database/client';
import { ConflictError, NotFoundError, ForbiddenError } from '../shared/errors';
import { OrgRole } from '@prisma/client';
import { CacheService } from '../utils/cache';
import { BillingService } from '../billing/billing.service';

export class OrgService {
  static async create(userId: string, data: any) {
    const slugExists = await prisma.organization.findUnique({
      where: { slug: data.slug }
    });

    if (slugExists) {
      throw new ConflictError('Organization slug is already taken');
    }

    const org = await prisma.$transaction(async (tx) => {
      const newOrg = await tx.organization.create({
        data: {
          name: data.name,
          slug: data.slug,
          ownerId: userId
        }
      });

      await tx.orgMember.create({
        data: {
          organizationId: newOrg.id,
          userId,
          role: OrgRole.OWNER
        }
      });

      return newOrg;
    });

    return org;
  }

  static async getById(orgId: string) {
    const cacheKey = `org:${orgId}`;
    const cached = await CacheService.get<any>(cacheKey);
    if (cached) return cached;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { members: { include: { user: true } } }
    });

    if (!org) {
      throw new NotFoundError('Organization');
    }

    await CacheService.set(cacheKey, org, 300);
    return org;
  }

  static async inviteMember(orgId: string, inviterId: string, email: string, role: OrgRole) {
    await BillingService.checkMemberLimit(orgId);

    const userToInvite = await prisma.user.findUnique({
      where: { email }
    });

    if (!userToInvite) {
      throw new NotFoundError('Invited User');
    }

    const membership = await prisma.orgMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: userToInvite.id
        }
      }
    });

    if (membership) {
      throw new ConflictError('User is already a member of this organization');
    }

    const newMember = await prisma.orgMember.create({
      data: {
        organizationId: orgId,
        userId: userToInvite.id,
        role
      }
    });

    await CacheService.del(`org:${orgId}`);
    return newMember;
  }
}
