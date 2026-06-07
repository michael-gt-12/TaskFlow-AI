import { z } from 'zod';
import { MilestoneStatus } from '@prisma/client';
import { uuidSchema, isoDateStringSchema } from '../shared/validation';

export const CreateMilestoneSchema = z.object({
  body: z.object({
    projectId: uuidSchema,
    name: z.string().min(2, 'Name must be at least 2 characters').max(120),
    description: z.string().max(2000).optional(),
    dueDate: isoDateStringSchema.optional(),
  }),
});

export const UpdateMilestoneSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    dueDate: isoDateStringSchema.nullable().optional(),
  }),
});

export const ListMilestonesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    status: z.nativeEnum(MilestoneStatus).optional(),
  }),
});

export const ReachMilestoneSchema = z.object({
  body: z.object({
    // Allow closing a milestone even when some attached tasks remain open.
    force: z.boolean().optional(),
  }),
});

export const AssignTaskSchema = z.object({
  body: z.object({
    taskId: uuidSchema,
  }),
});
