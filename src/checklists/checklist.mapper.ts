import { Checklist, ChecklistItem } from '@prisma/client';
import { ChecklistWithItems } from './checklist.repository';
import { ChecklistProgress } from './checklist.service';

export interface ChecklistItemDto {
  id: string;
  checklistId: string;
  content: string;
  isComplete: boolean;
  completedAt: string | null;
  position: number;
}

export interface ChecklistDto {
  id: string;
  taskId: string;
  title: string;
  position: number;
  createdAt: string;
  items: ChecklistItemDto[];
  progress: ChecklistProgress;
}

export class ChecklistMapper {
  static toItemDto(item: ChecklistItem): ChecklistItemDto {
    return {
      id: item.id,
      checklistId: item.checklistId,
      content: item.content,
      isComplete: item.isComplete,
      completedAt: item.completedAt ? item.completedAt.toISOString() : null,
      position: item.position,
    };
  }

  static toDto(checklist: ChecklistWithItems): ChecklistDto {
    const items = checklist.items ?? [];
    const completed = items.filter((i) => i.isComplete).length;
    const total = items.length;
    return {
      id: checklist.id,
      taskId: checklist.taskId,
      title: checklist.title,
      position: checklist.position,
      createdAt: checklist.createdAt.toISOString(),
      items: items.map((item) => this.toItemDto(item)),
      progress: {
        total,
        completed,
        ratio: total > 0 ? Math.round((completed / total) * 100) / 100 : 0,
      },
    };
  }

  static toDtoList(checklists: ChecklistWithItems[]): ChecklistDto[] {
    return checklists.map((checklist) => this.toDto(checklist));
  }
}
