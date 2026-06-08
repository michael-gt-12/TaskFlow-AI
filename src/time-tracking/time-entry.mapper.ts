import { TimeEntry } from '@prisma/client';
import { TaskTimeSummary } from './time-entry.service';

export interface TimeEntryDto {
  id: string;
  taskId: string;
  userId: string;
  minutes: number;
  description: string | null;
  startedAt: string | null;
  loggedAt: string;
}

export interface TaskTimeSummaryDto {
  taskId: string;
  totalMinutes: number;
  totalHours: number;
  byUser: Array<{ userId: string; minutes: number }>;
}

export class TimeEntryMapper {
  static toDto(entry: TimeEntry): TimeEntryDto {
    return {
      id: entry.id,
      taskId: entry.taskId,
      userId: entry.userId,
      minutes: entry.minutes,
      description: entry.description,
      startedAt: entry.startedAt ? entry.startedAt.toISOString() : null,
      loggedAt: entry.loggedAt.toISOString(),
    };
  }

  static toDtoList(entries: TimeEntry[]): TimeEntryDto[] {
    return entries.map((entry) => this.toDto(entry));
  }

  static toSummaryDto(summary: TaskTimeSummary): TaskTimeSummaryDto {
    return {
      taskId: summary.taskId,
      totalMinutes: summary.totalMinutes,
      totalHours: summary.totalHours,
      byUser: summary.byUser,
    };
  }
}
