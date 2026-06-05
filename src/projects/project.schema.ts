import { z } from 'zod';
import { ProjectRole } from '@prisma/client';
import { colorSchema, uuidSchema } from '../shared/validation';

export const CreateProjectSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(120),
    description: z.string().max(2000).optional(),
    key: z
      .string()
      .min(2)
      .max(10)
      .regex(/^[A-Za-z0-9]+$/, 'Key may only contain letters and numbers')
      .optional(),
    color: colorSchema.optional(),
    leadId: uuidSchema.optional(),
    templateId: uuidSchema.optional(),
    orgId: z.string({ required_error: 'Organization ID is required' }),
  }),
});

export const UpdateProjectSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    color: colorSchema.optional(),
    leadId: uuidSchema.nullable().optional(),
  }),
});

export const ListProjectsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    includeArchived: z.enum(['true', 'false']).optional(),
    search: z.string().max(120).optional(),
    leadId: uuidSchema.optional(),
  }),
});

export const TransferLeadSchema = z.object({
  body: z.object({
    newLeadId: uuidSchema,
  }),
});

export const AddProjectMemberSchema = z.object({
  body: z.object({
    userId: uuidSchema,
    role: z.nativeEnum(ProjectRole).optional(),
  }),
});
