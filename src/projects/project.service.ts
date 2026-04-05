import { prisma } from '../database/client';
import { NotFoundError } from '../shared/errors';
import { CacheService } from '../utils/cache';

export class ProjectService {
  static async create(orgId: string, data: any) {
    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description || '',
        organizationId: orgId
      }
    });

    await CacheService.delPattern(`projects:${orgId}:*`);
    return project;
  }

  static async getById(projectId: string) {
    const cacheKey = `project:${projectId}`;
    const cached = await CacheService.get<any>(cacheKey);
    if (cached) return cached;

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new NotFoundError('Project');
    }

    await CacheService.set(cacheKey, project, 300);
    return project;
  }

  static async archive(projectId: string) {
    const project = await prisma.project.update({
      where: { id: projectId },
      data: { isArchived: true }
    });

    await CacheService.del(`project:${projectId}`);
    await CacheService.delPattern(`projects:${project.organizationId}:*`);
    return project;
  }
}
