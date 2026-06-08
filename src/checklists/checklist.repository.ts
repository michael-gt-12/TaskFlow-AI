import { Prisma, Checklist, ChecklistItem } from '@prisma/client';
import { BaseRepository, TxClient } from '../shared/base.repository';

export type ChecklistWithItems = Checklist & { items: ChecklistItem[] };

/**
 * Data-access layer for task checklists and their items. A checklist belongs to
 * a task and holds an ordered list of items; ordering is maintained with a
 * float `position` so an item can be inserted between two others without
 * renumbering the whole list.
 */
export class ChecklistRepository extends BaseRepository {
  async create(data: Prisma.ChecklistUncheckedCreateInput, tx?: TxClient): Promise<Checklist> {
    return this.client(tx).checklist.create({ data });
  }

  async findById(id: string, tx?: TxClient): Promise<ChecklistWithItems | null> {
    return this.client(tx).checklist.findUnique({
      where: { id },
      include: { items: { orderBy: { position: 'asc' } } },
    });
  }

  async update(id: string, data: Prisma.ChecklistUpdateInput, tx?: TxClient): Promise<Checklist> {
    return this.client(tx).checklist.update({ where: { id }, data });
  }

  async delete(id: string, tx?: TxClient): Promise<void> {
    await this.client(tx).checklist.delete({ where: { id } });
  }

  async listForTask(taskId: string, tx?: TxClient): Promise<ChecklistWithItems[]> {
    return this.client(tx).checklist.findMany({
      where: { taskId },
      include: { items: { orderBy: { position: 'asc' } } },
      orderBy: { position: 'asc' },
    });
  }

  // --- items ----------------------------------------------------------------

  async findItemById(id: string, tx?: TxClient): Promise<ChecklistItem | null> {
    return this.client(tx).checklistItem.findUnique({ where: { id } });
  }

  async createItem(
    data: Prisma.ChecklistItemUncheckedCreateInput,
    tx?: TxClient
  ): Promise<ChecklistItem> {
    return this.client(tx).checklistItem.create({ data });
  }

  async updateItem(
    id: string,
    data: Prisma.ChecklistItemUpdateInput,
    tx?: TxClient
  ): Promise<ChecklistItem> {
    return this.client(tx).checklistItem.update({ where: { id }, data });
  }

  async deleteItem(id: string, tx?: TxClient): Promise<void> {
    await this.client(tx).checklistItem.delete({ where: { id } });
  }

  /**
   * Position to append a new item at the end of a checklist: one step past the
   * current maximum, or 0 for the first item.
   */
  async nextItemPosition(checklistId: string, tx?: TxClient): Promise<number> {
    const last = await this.client(tx).checklistItem.findFirst({
      where: { checklistId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return last ? last.position + 1 : 0;
  }
}

export const checklistRepository = new ChecklistRepository();
