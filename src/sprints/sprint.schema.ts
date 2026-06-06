import { z } from 'zod';
import { SprintStatus } from '@prisma/client';
import { uuidSchema, isoDateStringSchema } from '../shared/validation';

export const CreateSprintSchema = z.object({
  body: z.object({
    projectId: uuidSchema,
    name: z.string().min(2, 'Name must be at least 2 characters').max(120),
    goal: z.string().max(2000).optional(),
    startDate: isoDateStringSchema.optional(),
    endDate: isoDateStringSchema.optional(),
  }),
});

export const UpdateSprintSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    goal: z.string().max(2000).nullable().optional(),
    startDate: isoDateStringSchema.nullable().optional(),
    endDate: isoDateStringSchema.nullable().optional(),
  }),
});

export const ListSprintsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    status: z.nativeEnum(SprintStatus).optional(),
  }),
});

export const CompleteSprintSchema = z.object({
  body: z.object({
    // When provided, unfinished tasks roll over to this sprint instead of
    // returning to the project backlog.
    moveUnfinishedToSprintId: uuidSchema.optional(),
  }),
});

export const AssignTaskSchema = z.object({
  body: z.object({
    taskId: uuidSchema,
  }),
});
