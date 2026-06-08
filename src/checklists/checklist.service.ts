import { Checklist, ChecklistItem } from '@prisma/client';
import {
  checklistRepository,
  ChecklistRepository,
  ChecklistWithItems,
} from './checklist.repository';
import { NotFoundError } from '../shared/errors';
import { prisma } from '../database/client';
import { logger } from '../shared/logger';

export interface CreateChecklistInput {
  taskId: string;
  title: string;
}

export interface AddItemInput {
  content: string;
}

export interface UpdateItemInput {
  content?: string;
  isComplete?: boolean;
}

export interface ChecklistProgress {
  total: number;
  completed: number;
  /** Fraction complete in the range 0..1, rounded to two decimals. */
  ratio: number;
}

/**
 * Task checklist service. A task can hold several checklists, each a small
 * ordered list of yes/no items used for lightweight sub-task tracking. Checking
 * an item stamps its completion time; the service also derives a progress
 * roll-up (completed / total) for display on the task.
 */
export class ChecklistService {
  private static repo: ChecklistRepository = checklistRepository;

  static async create(input: CreateChecklistInput): Promise<ChecklistWithItems> {
    const task = await prisma.task.findFirst({ where: { id: input.taskId, deletedAt: null } });
    if (!task) throw new NotFoundError('Task');

    const checklist = await this.repo.create({
      taskId: input.taskId,
      title: input.title.trim(),
    });
    logger.info(`Checklist ${checklist.id} created on task ${input.taskId}`);
    return { ...checklist, items: [] };
  }

  static async getById(checklistId: string): Promise<ChecklistWithItems> {
    const checklist = await this.repo.findById(checklistId);
    if (!checklist) throw new NotFoundError('Checklist');
    return checklist;
  }

  static async listForTask(taskId: string): Promise<ChecklistWithItems[]> {
    return this.repo.listForTask(taskId);
  }

  static async rename(checklistId: string, title: string): Promise<Checklist> {
    await this.requireChecklist(checklistId);
    return this.repo.update(checklistId, { title: title.trim() });
  }

  static async remove(checklistId: string): Promise<void> {
    await this.requireChecklist(checklistId);
    await this.repo.delete(checklistId);
    logger.info(`Checklist ${checklistId} deleted`);
  }

  static async addItem(checklistId: string, input: AddItemInput): Promise<ChecklistItem> {
    await this.requireChecklist(checklistId);
    const position = await this.repo.nextItemPosition(checklistId);
    return this.repo.createItem({
      checklistId,
      content: input.content.trim(),
      position,
    });
  }

  static async updateItem(itemId: string, input: UpdateItemInput): Promise<ChecklistItem> {
    const item = await this.repo.findItemById(itemId);
    if (!item) throw new NotFoundError('Checklist item');

    const data: Record<string, unknown> = {};
    if (input.content !== undefined) data.content = input.content.trim();
    if (input.isComplete !== undefined) {
      data.isComplete = input.isComplete;
      // Stamp or clear the completion time so it always matches isComplete and
      // we don't carry a stale timestamp on an unchecked item.
      data.completedAt = input.isComplete ? new Date() : null;
    }

    return this.repo.updateItem(itemId, data);
  }

  static async removeItem(itemId: string): Promise<void> {
    const item = await this.repo.findItemById(itemId);
    if (!item) throw new NotFoundError('Checklist item');
    await this.repo.deleteItem(itemId);
  }

  /**
   * Aggregate completion across every checklist on a task, used to show a single
   * "12/20 done" style indicator on the task card.
   */
  static async getTaskProgress(taskId: string): Promise<ChecklistProgress> {
    const checklists = await this.repo.listForTask(taskId);
    let total = 0;
    let completed = 0;
    for (const checklist of checklists) {
      for (const item of checklist.items) {
        total += 1;
        if (item.isComplete) completed += 1;
      }
    }
    const ratio = total > 0 ? Math.round((completed / total) * 100) / 100 : 0;
    return { total, completed, ratio };
  }

  // --- internal helpers -----------------------------------------------------

  private static async requireChecklist(checklistId: string): Promise<ChecklistWithItems> {
    const checklist = await this.repo.findById(checklistId);
    if (!checklist) throw new NotFoundError('Checklist');
    return checklist;
  }
}
