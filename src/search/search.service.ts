import { prisma } from '../database/client';
import { logger } from '../shared/logger';

export class SearchService {
  static async indexEntity(entityType: string, entityId: string, document: string) {
    try {
      const index = await prisma.searchIndex.upsert({
        where: { entityId },
        update: { document, updatedAt: new Date() },
        create: { entityType, entityId, document }
      });
      logger.info(`Indexed search entity ${entityType} (ID: ${entityId})`);
      return index;
    } catch (err: any) {
      logger.error('Failed to create search index entry:', err.message);
    }
  }

  static async search(queryText: string, entityType?: string, limit = 20) {
    // Basic search filtering using LIKE operand mapping
    return prisma.searchIndex.findMany({
      where: {
        document: {
          contains: queryText,
          mode: 'insensitive'
        },
        ...(entityType ? { entityType } : {})
      },
      take: limit
    });
  }
}
